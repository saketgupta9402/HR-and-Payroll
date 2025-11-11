import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireCapability, CAPABILITIES } from '../policy/authorize.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

const safeAudit = async (payload) => {
  try {
    await audit(payload);
  } catch (err) {
    console.warn('[AUDIT] audit log skipped:', err?.message || err);
  }
};

const getTenantIdForUser = async (userId) => {
  const result = await query(
    'SELECT tenant_id FROM profiles WHERE id = $1',
    [userId]
  );
  return result.rows[0]?.tenant_id || null;
};

const getEmployeeIdForUser = async (userId) => {
  const result = await query(
    'SELECT id FROM employees WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.id || null;
};

const ensureDefaultDefinitions = async (tenantId, financialYear) => {
  const defaults = [
    {
      component_code: 'PAYROLL_SECTION_80C',
      label: 'Section 80C Investments',
      section: '80C',
      section_group: '80C',
    },
    {
      component_code: 'PAYROLL_SECTION_80D',
      label: 'Section 80D Medical Insurance',
      section: '80D',
      section_group: '80D',
    },
    {
      component_code: 'PAYROLL_SECTION_24B',
      label: 'Home Loan Interest (Section 24B)',
      section: '24B',
      section_group: null,
    },
    {
      component_code: 'PAYROLL_HRA',
      label: 'HRA Exemption',
      section: 'HRA',
      section_group: null,
    },
    {
      component_code: 'PAYROLL_OTHER_DEDUCTIONS',
      label: 'Other Deductions',
      section: 'Other',
      section_group: null,
    },
  ];

  for (const def of defaults) {
    await query(
      `INSERT INTO tax_component_definitions (
        tenant_id, financial_year, component_code, label, section, section_group, metadata, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, '{}', true)
      ON CONFLICT (tenant_id, financial_year, component_code) DO NOTHING`,
      [tenantId, financialYear, def.component_code, def.label, def.section, def.section_group]
    );
  }
};

router.get('/definitions', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { financial_year } = req.query;
    if (!financial_year) {
      return res.status(400).json({ error: 'financial_year is required' });
    }

    let result = await query(
      `SELECT *
       FROM tax_component_definitions
       WHERE tenant_id = $1
         AND financial_year = $2
         AND is_active = true
       ORDER BY section, label`,
      [tenantId, financial_year]
    );

    if (result.rows.length === 0) {
      await ensureDefaultDefinitions(tenantId, financial_year);
      result = await query(
        `SELECT *
         FROM tax_component_definitions
         WHERE tenant_id = $1
           AND financial_year = $2
           AND is_active = true
         ORDER BY section, label`,
        [tenantId, financial_year]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tax component definitions:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch definitions' });
  }
});

router.get('/me', authenticateToken, requireCapability(CAPABILITIES.TAX_DECLARATION_MANAGE), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const employeeId = await getEmployeeIdForUser(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const { financial_year } = req.query;
    if (!financial_year) {
      return res.status(400).json({ error: 'financial_year is required' });
    }

    const declarationResult = await query(
      `SELECT *
       FROM tax_declarations
       WHERE tenant_id = $1
         AND employee_id = $2
         AND financial_year = $3`,
      [tenantId, employeeId, financial_year]
    );

    const declaration = declarationResult.rows[0] || null;

    if (!declaration) {
      return res.json({ declaration: null, items: [] });
    }

    const itemsResult = await query(
      `SELECT tdi.*, tcd.label, tcd.section, tcd.section_group
       FROM tax_declaration_items tdi
       JOIN tax_component_definitions tcd ON tcd.id = tdi.component_id
       WHERE tdi.declaration_id = $1`,
      [declaration.id]
    );

    res.json({
      declaration,
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching employee tax declaration:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch declaration' });
  }
});

router.post('/', authenticateToken, requireCapability(CAPABILITIES.TAX_DECLARATION_MANAGE), async (req, res) => {
  const client = query;
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const employeeId = await getEmployeeIdForUser(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const { financial_year, chosen_regime, status = 'draft', items = [] } = req.body;

    if (!financial_year || !chosen_regime) {
      return res.status(400).json({ error: 'financial_year and chosen_regime are required' });
    }

    if (!['old', 'new'].includes(chosen_regime)) {
      return res.status(400).json({ error: 'Invalid chosen_regime' });
    }

    if (!['draft', 'submitted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    await client('BEGIN');

    const existingResult = await client(
      `SELECT *
       FROM tax_declarations
       WHERE tenant_id = $1 AND employee_id = $2 AND financial_year = $3
       FOR UPDATE`,
      [tenantId, employeeId, financial_year]
    );

    let declarationId;
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (['approved', 'rejected'].includes(existing.status)) {
        await client('ROLLBACK');
        return res.status(400).json({ error: `Declaration already ${existing.status}` });
      }

      await client(
        `UPDATE tax_declarations
         SET chosen_regime = $1,
             status = $2,
             submitted_at = CASE WHEN $2 = 'submitted' THEN now() ELSE submitted_at END,
             updated_at = now()
         WHERE id = $3`,
        [chosen_regime, status, existing.id]
      );
      declarationId = existing.id;
      await client(
        'DELETE FROM tax_declaration_items WHERE declaration_id = $1',
        [declarationId]
      );
    } else {
      const insertResult = await client(
        `INSERT INTO tax_declarations (
          tenant_id, employee_id, financial_year, chosen_regime, status, submitted_at
        ) VALUES (
          $1, $2, $3, $4, $5, CASE WHEN $5 = 'submitted' THEN now() ELSE NULL END
        )
        RETURNING id`,
        [tenantId, employeeId, financial_year, chosen_regime, status]
      );
      declarationId = insertResult.rows[0].id;
    }

    for (const item of items) {
      if (!item.component_id) {
        await client('ROLLBACK');
        return res.status(400).json({ error: 'component_id is required for each item' });
      }
      const declaredAmount = Number(item.declared_amount || 0);
      if (Number.isNaN(declaredAmount) || declaredAmount < 0) {
        await client('ROLLBACK');
        return res.status(400).json({ error: 'declared_amount must be a non-negative number' });
      }
      const proofUrl = item.proof_url || null;
      await client(
        `INSERT INTO tax_declaration_items (
          declaration_id, component_id, declared_amount, approved_amount, proof_url, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [declarationId, item.component_id, declaredAmount, item.approved_amount || null, proofUrl, item.notes || null]
      );
    }

    await safeAudit({
      actorId: req.user.id,
      action: 'tax_declaration_saved',
      entityType: 'tax_declaration',
      entityId: declarationId,
      details: { financial_year, status, itemCount: items.length },
    });

    await client('COMMIT');

    res.json({ success: true, declaration_id: declarationId });
  } catch (error) {
    await client('ROLLBACK').catch(() => {});
    console.error('Error saving tax declaration:', error);
    res.status(500).json({ error: error.message || 'Failed to save tax declaration' });
  }
});

router.get('/', authenticateToken, requireCapability(CAPABILITIES.TAX_DECLARATION_REVIEW), async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { financial_year, status } = req.query;

    let queryStr = `
      SELECT td.*, p.first_name, p.last_name, p.email, e.employee_id
      FROM tax_declarations td
      JOIN employees e ON e.id = td.employee_id
      JOIN profiles p ON p.id = e.user_id
      WHERE td.tenant_id = $1
    `;
    const params = [tenantId];

    if (financial_year) {
      params.push(financial_year);
      queryStr += ` AND td.financial_year = $${params.length}`;
    }
    if (status) {
      params.push(status);
      queryStr += ` AND td.status = $${params.length}`;
    }

    queryStr += ' ORDER BY td.updated_at DESC';

    const declarationsResult = await query(queryStr, params);
    const declarationIds = declarationsResult.rows.map((row) => row.id);

    let items = [];
    if (declarationIds.length > 0) {
      const itemsResult = await query(
        `SELECT tdi.*, tcd.label, tcd.section, tcd.section_group
         FROM tax_declaration_items tdi
         JOIN tax_component_definitions tcd ON tcd.id = tdi.component_id
         WHERE tdi.declaration_id = ANY($1::uuid[])`,
        [declarationIds]
      );
      items = itemsResult.rows;
    }

    res.json({
      declarations: declarationsResult.rows,
      items,
    });
  } catch (error) {
    console.error('Error fetching tax declarations:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tax declarations' });
  }
});

router.post('/:id/review', authenticateToken, requireCapability(CAPABILITIES.TAX_DECLARATION_REVIEW), async (req, res) => {
  const client = query;
  try {
    const { id } = req.params;
    const { status, items = [], remarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const declarationResult = await client(
      `SELECT td.*, e.tenant_id
       FROM tax_declarations td
       JOIN employees e ON e.id = td.employee_id
       WHERE td.id = $1`,
      [id]
    );

    if (declarationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Declaration not found' });
    }

    const declaration = declarationResult.rows[0];
    const tenantId = await getTenantIdForUser(req.user.id);

    if (!tenantId || tenantId !== declaration.tenant_id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (declaration.status === 'approved') {
      return res.status(400).json({ error: 'Declaration already approved' });
    }

    await client('BEGIN');

    await client(
      `UPDATE tax_declarations
       SET status = $1,
           approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE NULL END,
           approved_by = $2,
           remarks = $3,
           updated_at = now()
       WHERE id = $4`,
      [status, req.user.id, remarks || null, id]
    );

    if (status === 'approved') {
      for (const item of items) {
        const approvedAmount = Number(item.approved_amount ?? item.declared_amount ?? 0);
        if (Number.isNaN(approvedAmount) || approvedAmount < 0) {
          await client('ROLLBACK');
          return res.status(400).json({ error: 'approved_amount must be a non-negative number' });
        }
        await client(
          `UPDATE tax_declaration_items
           SET approved_amount = $1, notes = COALESCE($2, notes), updated_at = now()
           WHERE id = $3 AND declaration_id = $4`,
          [approvedAmount, item.notes || null, item.id, id]
        );
      }
    } else {
      await client(
        `UPDATE tax_declaration_items
         SET approved_amount = NULL, updated_at = now()
         WHERE declaration_id = $1`,
        [id]
      );
    }

    await safeAudit({
      actorId: req.user.id,
      action: 'tax_declaration_reviewed',
      entityType: 'tax_declaration',
      entityId: id,
      details: { status, remarks },
    });

    await client('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client('ROLLBACK').catch(() => {});
    console.error('Error reviewing tax declaration:', error);
    res.status(500).json({ error: error.message || 'Failed to review tax declaration' });
  }
});

export default router;


