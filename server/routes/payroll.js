/**
 * Payroll Routes
 * 
 * Handles payroll calendar, pay runs, off-cycle runs, exports, and exceptions
 * Requires ACCOUNTANT role or CEO for read-only access
 */

import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { requireCapability, CAPABILITIES } from '../policy/authorize.js';
import { audit } from '../utils/auditLog.js';
import { Parser } from 'json2csv';
import { calculateMonthlyTDS } from '../services/taxEngine.js';

const getFinancialYearForDate = (dateString) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 3 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const router = express.Router();

// Ensure payroll tables exist
const ensurePayrollTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      pay_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'rolled_back', 'cancelled')),
      total_employees INTEGER DEFAULT 0,
      total_amount_cents BIGINT DEFAULT 0,
      created_by UUID REFERENCES profiles(id),
      processed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payroll_run_employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE NOT NULL,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
      hours DECIMAL(10,2) DEFAULT 0,
      rate_cents BIGINT DEFAULT 0,
      gross_pay_cents BIGINT DEFAULT 0,
      deductions_cents BIGINT DEFAULT 0,
      net_pay_cents BIGINT DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'excluded', 'exception')),
      exception_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payroll_run_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE NOT NULL,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
      component_name TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      is_taxable BOOLEAN NOT NULL DEFAULT true,
      created_by UUID REFERENCES profiles(id),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON payroll_runs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
    CREATE INDEX IF NOT EXISTS idx_payroll_run_employees_run ON payroll_run_employees(payroll_run_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_run_employees_employee ON payroll_run_employees(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_run ON payroll_run_adjustments(payroll_run_id);
    CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_employee ON payroll_run_adjustments(employee_id);
  `).catch(err => {
    if (!err.message.includes('already exists')) {
      console.error('Error creating payroll tables:', err);
    }
  });
};

ensurePayrollTables();

const getTenantIdForUser = async (userId) => {
  const tenantResult = await query(
    'SELECT tenant_id FROM profiles WHERE id = $1',
    [userId]
  );
  return tenantResult.rows[0]?.tenant_id || null;
};

// Get payroll calendar
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Get payroll runs for calendar view
    const runs = await query(
      `SELECT 
        id,
        pay_period_start,
        pay_period_end,
        pay_date,
        status,
        total_employees,
        total_amount_cents
       FROM payroll_runs
       WHERE tenant_id = $1
       ORDER BY pay_date DESC
       LIMIT 12`,
      [tenantId]
    );

    res.json(runs.rows);
  } catch (error) {
    console.error('Error fetching payroll calendar:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll calendar' });
  }
});

// Get all payroll runs
router.get('/runs', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { status, limit = 50, offset = 0 } = req.query;

    let queryStr = `
      SELECT 
        pr.*,
        json_build_object(
          'id', p.id,
          'email', p.email,
          'first_name', p.first_name,
          'last_name', p.last_name
        ) as created_by_user
      FROM payroll_runs pr
      LEFT JOIN profiles p ON p.id = pr.created_by
      WHERE pr.tenant_id = $1
    `;
    const params = [tenantId];

    if (status) {
      queryStr += ` AND pr.status = $2`;
      params.push(status);
    }

    queryStr += ` ORDER BY pr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), Number(offset));

    const result = await query(queryStr, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payroll runs:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll runs' });
  }
});

// Get payroll run details
router.get('/runs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const runResult = await query(
      `SELECT pr.*,
        json_build_object(
          'id', p.id,
          'email', p.email,
          'first_name', p.first_name,
          'last_name', p.last_name
        ) as created_by_user
       FROM payroll_runs pr
       LEFT JOIN profiles p ON p.id = pr.created_by
       WHERE pr.id = $1`,
      [id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const run = runResult.rows[0];

    // Get employees in this run
    const employeesResult = await query(
      `SELECT 
        pre.*,
        json_build_object(
          'id', e.id,
          'employee_id', e.employee_id,
          'user_id', e.user_id
        ) as employee,
        json_build_object(
          'id', p.id,
          'first_name', p.first_name,
          'last_name', p.last_name,
          'email', p.email
        ) as employee_profile
       FROM payroll_run_employees pre
       JOIN employees e ON e.id = pre.employee_id
       JOIN profiles p ON p.id = e.user_id
       WHERE pre.payroll_run_id = $1
       ORDER BY p.last_name, p.first_name`,
      [id]
    );

    run.employees = employeesResult.rows;

    res.json(run);
  } catch (error) {
    console.error('Error fetching payroll run:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll run' });
  }
});

router.get('/runs/:id/adjustments', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { id } = req.params;

    const runResult = await query(
      'SELECT id FROM payroll_runs WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const adjustments = await query(
      `SELECT pra.*,
        json_build_object(
          'id', e.id,
          'employee_id', e.employee_id
        ) AS employee
       FROM payroll_run_adjustments pra
       JOIN employees e ON e.id = pra.employee_id
       WHERE pra.payroll_run_id = $1
         AND pra.tenant_id = $2
       ORDER BY pra.created_at DESC`,
      [id, tenantId]
    );

    res.json(adjustments.rows);
  } catch (error) {
    console.error('Error fetching payroll adjustments:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll adjustments' });
  }
});

router.post('/runs/:id/adjustments', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { id } = req.params;
    const { employee_id, component_name, amount, is_taxable = true, notes } = req.body;

    if (!employee_id || !component_name || amount === undefined || amount === null) {
      return res.status(400).json({ error: 'employee_id, component_name and amount are required' });
    }

    const runResult = await query(
      'SELECT id, status FROM payroll_runs WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    if (runResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Adjustments can only be added when payroll run is in draft status' });
    }

    const employeeResult = await query(
      'SELECT id FROM employees WHERE id = $1 AND tenant_id = $2',
      [employee_id, tenantId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found for this tenant' });
    }

    const adjustmentResult = await query(
      `INSERT INTO payroll_run_adjustments (
        tenant_id, payroll_run_id, employee_id, component_name, amount, is_taxable, created_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [tenantId, id, employee_id, component_name, amount, is_taxable, req.user.id, notes || null]
    );

    await audit({
      actorId: req.user.id,
      action: 'payroll_adjustment_created',
      entityType: 'payroll_run_adjustment',
      entityId: adjustmentResult.rows[0].id,
      details: { payroll_run_id: id, employee_id, component_name, amount, is_taxable },
    });

    res.status(201).json(adjustmentResult.rows[0]);
  } catch (error) {
    console.error('Error creating payroll adjustment:', error);
    res.status(500).json({ error: error.message || 'Failed to create payroll adjustment' });
  }
});

router.put('/adjustments/:adjustmentId', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { adjustmentId } = req.params;
    const { component_name, amount, is_taxable, notes } = req.body;

    const adjustmentResult = await query(
      `SELECT pra.*, pr.status
       FROM payroll_run_adjustments pra
       JOIN payroll_runs pr ON pr.id = pra.payroll_run_id
       WHERE pra.id = $1 AND pra.tenant_id = $2`,
      [adjustmentId, tenantId]
    );

    if (adjustmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    if (adjustmentResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Adjustments can only be edited when payroll run is in draft status' });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (component_name !== undefined) {
      fields.push(`component_name = $${index++}`);
      values.push(component_name);
    }

    if (amount !== undefined) {
      fields.push(`amount = $${index++}`);
      values.push(amount);
    }

    if (is_taxable !== undefined) {
      fields.push(`is_taxable = $${index++}`);
      values.push(is_taxable);
    }

    if (notes !== undefined) {
      fields.push(`notes = $${index++}`);
      values.push(notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    values.push(adjustmentId);

    const updatedResult = await query(
      `UPDATE payroll_run_adjustments
       SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${index}
       RETURNING *`,
      values
    );

    await audit({
      actorId: req.user.id,
      action: 'payroll_adjustment_updated',
      entityType: 'payroll_run_adjustment',
      entityId: adjustmentId,
      details: { fields: Object.keys(req.body || {}) },
    });

    res.json(updatedResult.rows[0]);
  } catch (error) {
    console.error('Error updating payroll adjustment:', error);
    res.status(500).json({ error: error.message || 'Failed to update payroll adjustment' });
  }
});

router.delete('/adjustments/:adjustmentId', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { adjustmentId } = req.params;

    const adjustmentResult = await query(
      `SELECT pra.id, pra.payroll_run_id, pr.status
       FROM payroll_run_adjustments pra
       JOIN payroll_runs pr ON pr.id = pra.payroll_run_id
       WHERE pra.id = $1 AND pra.tenant_id = $2`,
      [adjustmentId, tenantId]
    );

    if (adjustmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Adjustment not found' });
    }

    if (adjustmentResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Adjustments can only be deleted when payroll run is in draft status' });
    }

    await query(
      'DELETE FROM payroll_run_adjustments WHERE id = $1',
      [adjustmentId]
    );

    await audit({
      actorId: req.user.id,
      action: 'payroll_adjustment_deleted',
      entityType: 'payroll_run_adjustment',
      entityId: adjustmentId,
      details: { payroll_run_id: adjustmentResult.rows[0].payroll_run_id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting payroll adjustment:', error);
    res.status(500).json({ error: error.message || 'Failed to delete payroll adjustment' });
  }
});

// Create payroll run
router.post('/runs', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const { pay_period_start, pay_period_end, pay_date } = req.body;

    if (!pay_period_start || !pay_period_end || !pay_date) {
      return res.status(400).json({ error: 'pay_period_start, pay_period_end, and pay_date are required' });
    }

    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Create payroll run
    const runResult = await query(
      `INSERT INTO payroll_runs (
        tenant_id, pay_period_start, pay_period_end, pay_date,
        status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, pay_period_start, pay_period_end, pay_date, 'draft', req.user.id]
    );

    const run = runResult.rows[0];

    // Audit log
    await audit({
      actorId: req.user.id,
      action: 'payroll_run_created',
      entityType: 'payroll_run',
      entityId: run.id,
      details: { pay_period_start, pay_period_end, pay_date },
    });

    res.status(201).json(run);
  } catch (error) {
    console.error('Error creating payroll run:', error);
    res.status(500).json({ error: error.message || 'Failed to create payroll run' });
  }
});

// Process payroll run (approve timesheets and calculate payroll)
router.post('/runs/:id/process', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const { id } = req.params;

    // Get payroll run
    const runResult = await query(
      'SELECT * FROM payroll_runs WHERE id = $1',
      [id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const run = runResult.rows[0];

    if (run.status !== 'draft') {
      return res.status(400).json({ error: 'Payroll run can only be processed from draft status' });
    }

    // Update status to processing
    await query(
      'UPDATE payroll_runs SET status = $1, processed_at = now() WHERE id = $2',
      ['processing', id]
    );

    // Get approved timesheets for this pay period
    const timesheetsResult = await query(
      `SELECT 
        t.id,
        t.employee_id,
        t.total_hours,
        e.employee_id as emp_id
       FROM timesheets t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.tenant_id = $1
       AND t.status = 'approved'
       AND t.week_start_date >= $2
       AND t.week_end_date <= $3`,
      [run.tenant_id, run.pay_period_start, run.pay_period_end]
    );

    const adjustmentsResult = await query(
      `SELECT employee_id, amount, is_taxable
       FROM payroll_run_adjustments
       WHERE payroll_run_id = $1 AND tenant_id = $2`,
      [id, run.tenant_id]
    );

    const adjustmentsByEmployee = adjustmentsResult.rows.reduce((acc, adjustment) => {
      if (!acc[adjustment.employee_id]) {
        acc[adjustment.employee_id] = [];
      }
      acc[adjustment.employee_id].push(adjustment);
      return acc;
    }, {});

    // Process each employee (simplified - would need actual rate calculation)
    let totalAmount = 0;
    let totalEmployees = 0;

    for (const ts of timesheetsResult.rows) {
      // Get employee rate (placeholder - would come from employee compensation table)
      const rateCents = 5000 * 100; // $50/hour placeholder
      const hours = parseFloat(ts.total_hours) || 0;
      const baseGrossPayCents = Math.round(hours * rateCents);

      const adjustments = adjustmentsByEmployee[ts.employee_id] || [];
      let taxableAdjustmentCents = 0;
      let nonTaxableAdjustmentCents = 0;
      for (const adj of adjustments) {
        const adjCents = Math.round(Number(adj.amount || 0) * 100);
        if (adj.is_taxable) {
          taxableAdjustmentCents += adjCents;
        } else {
          nonTaxableAdjustmentCents += adjCents;
        }
      }

      const grossPayCents = baseGrossPayCents + taxableAdjustmentCents;

      const reimbursementResult = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_reimbursements
         FROM employee_reimbursements
         WHERE employee_id = $1
           AND org_id = $2
           AND status = 'approved'
           AND payroll_run_id IS NULL`,
        [ts.employee_id, run.tenant_id]
      );
      const reimbursementTotal = Number(reimbursementResult.rows[0]?.total_reimbursements || 0);
      const reimbursementCents = Math.round(reimbursementTotal * 100);

      let tdsCents = 0;
      try {
        const financialYear = getFinancialYearForDate(run.pay_date);
        const tdsResult = await calculateMonthlyTDS(ts.employee_id, run.tenant_id, financialYear);
        tdsCents = Math.round(tdsResult.monthlyTds * 100);
      } catch (tdsError) {
        console.warn('Failed to calculate TDS for employee', ts.employee_id, tdsError);
      }

      const otherDeductionsCents = Math.round(grossPayCents * 0.1); // placeholder for other deductions
      const totalDeductionsCents = tdsCents + otherDeductionsCents;
      const netPayCents = grossPayCents - totalDeductionsCents + nonTaxableAdjustmentCents + reimbursementCents;

      await query(
        `INSERT INTO payroll_run_employees (
          payroll_run_id, employee_id, hours, rate_cents,
          gross_pay_cents, deductions_cents, net_pay_cents, status,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          ts.employee_id,
          hours,
          rateCents,
          grossPayCents,
          totalDeductionsCents,
          netPayCents,
          'processed',
          JSON.stringify({
            tds_cents: tdsCents,
            reimbursement_cents: reimbursementCents,
            non_taxable_adjustments_cents: nonTaxableAdjustmentCents,
          }),
        ]
      );

      if (reimbursementCents > 0) {
        await query(
          `UPDATE employee_reimbursements
           SET status = 'paid',
               payroll_run_id = $1
           WHERE employee_id = $2
             AND org_id = $3
             AND status = 'approved'
             AND payroll_run_id IS NULL`,
          [id, ts.employee_id, run.tenant_id]
        );
      }

      totalAmount += netPayCents;
      totalEmployees++;
    }

    // Update payroll run
    await query(
      `UPDATE payroll_runs 
       SET status = $1, total_employees = $2, total_amount_cents = $3, completed_at = now()
       WHERE id = $4`,
      ['completed', totalEmployees, totalAmount, id]
    );

    // Audit log
    await audit({
      actorId: req.user.id,
      action: 'payroll_run_processed',
      entityType: 'payroll_run',
      entityId: id,
      details: { total_employees: totalEmployees, total_amount_cents: totalAmount },
    });

    res.json({ success: true, message: 'Payroll run processed successfully' });
  } catch (error) {
    console.error('Error processing payroll run:', error);
    res.status(500).json({ error: error.message || 'Failed to process payroll run' });
  }
});

// Rollback payroll run
router.post('/runs/:id/rollback', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_ROLLBACK), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for rollback' });
    }

    const runResult = await query(
      'SELECT * FROM payroll_runs WHERE id = $1',
      [id]
    );

    if (runResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found' });
    }

    const run = runResult.rows[0];

    if (run.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed payroll runs can be rolled back' });
    }

    // Update status
    await query(
      'UPDATE payroll_runs SET status = $1 WHERE id = $2',
      ['rolled_back', id]
    );

    // Delete payroll run employees (or mark as excluded)
    await query(
      'UPDATE payroll_run_employees SET status = $1 WHERE payroll_run_id = $2',
      ['excluded', id]
    );

    // Audit log
    await audit({
      actorId: req.user.id,
      action: 'payroll_run_rolled_back',
      entityType: 'payroll_run',
      entityId: id,
      reason,
      details: { reason },
    });

    res.json({ success: true, message: 'Payroll run rolled back successfully' });
  } catch (error) {
    console.error('Error rolling back payroll run:', error);
    res.status(500).json({ error: error.message || 'Failed to rollback payroll run' });
  }
});

// Export approved timesheets for payroll
router.get('/export/timesheets', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const { pay_period_start, pay_period_end } = req.query;

    if (!pay_period_start || !pay_period_end) {
      return res.status(400).json({ error: 'pay_period_start and pay_period_end are required' });
    }

    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Get approved timesheets
    const timesheetsResult = await query(
      `SELECT 
        e.employee_id,
        p.first_name || ' ' || p.last_name as employee_name,
        t.week_start_date,
        t.week_end_date,
        t.total_hours,
        t.status,
        t.submitted_at,
        t.reviewed_at
       FROM timesheets t
       JOIN employees e ON e.id = t.employee_id
       JOIN profiles p ON p.id = e.user_id
       WHERE t.tenant_id = $1
       AND t.status = 'approved'
       AND t.week_start_date >= $2
       AND t.week_end_date <= $3
       ORDER BY e.employee_id, t.week_start_date`,
      [tenantId, pay_period_start, pay_period_end]
    );

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(timesheetsResult.rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-timesheets-${pay_period_start}-${pay_period_end}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting timesheets:', error);
    res.status(500).json({ error: error.message || 'Failed to export timesheets' });
  }
});

// Get exceptions report
router.get('/exceptions', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_RUN), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Get timesheets with exceptions (pending, rejected, or missing)
    const exceptionsResult = await query(
      `SELECT 
        e.employee_id,
        p.first_name || ' ' || p.last_name as employee_name,
        t.week_start_date,
        t.week_end_date,
        t.status,
        t.rejection_reason,
        CASE 
          WHEN t.status = 'pending' THEN 'Pending Approval'
          WHEN t.status = 'rejected' THEN 'Rejected: ' || COALESCE(t.rejection_reason, 'No reason provided')
          ELSE 'Missing Timesheet'
        END as exception_type
       FROM employees e
       JOIN profiles p ON p.id = e.user_id
       LEFT JOIN timesheets t ON t.employee_id = e.id 
         AND t.week_start_date >= CURRENT_DATE - INTERVAL '14 days'
         AND t.week_end_date <= CURRENT_DATE
       WHERE e.tenant_id = $1
       AND e.status = 'active'
       AND (t.status IN ('pending', 'rejected') OR t.id IS NULL)
       ORDER BY e.employee_id`,
      [tenantId]
    );

    res.json(exceptionsResult.rows);
  } catch (error) {
    console.error('Error fetching exceptions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch exceptions' });
  }
});

// Get payroll totals (CEO read-only)
router.get('/totals', authenticateToken, requireCapability(CAPABILITIES.PAYROLL_READ_TOTALS), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Get totals for last 12 months
    const totalsResult = await query(
      `SELECT 
        DATE_TRUNC('month', pay_date) as month,
        COUNT(*) as run_count,
        SUM(total_amount_cents) as total_amount_cents,
        SUM(total_employees) as total_employees
       FROM payroll_runs
       WHERE tenant_id = $1
       AND status = 'completed'
       AND pay_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', pay_date)
       ORDER BY month DESC`,
      [tenantId]
    );

    res.json(totalsResult.rows);
  } catch (error) {
    console.error('Error fetching payroll totals:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payroll totals' });
  }
});

export default router;

