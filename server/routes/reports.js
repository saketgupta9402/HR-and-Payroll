import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireCapability, CAPABILITIES, hasCapability } from '../policy/authorize.js';

const router = express.Router();

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

const getFinancialYearRange = (financialYear) => {
  const parts = (financialYear || '').split('-');
  const startYear = parseInt(parts[0], 10);
  if (Number.isNaN(startYear)) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const fyStartYear = month >= 3 ? year : year - 1;
    return {
      financialYear: `${fyStartYear}-${fyStartYear + 1}`,
      start: new Date(fyStartYear, 3, 1),
      end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999),
    };
  }
  return {
    financialYear: financialYear,
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
};

const formatCurrency = (value) => {
  return `₹${(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

router.get('/form16', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantIdForUser(req.user.id);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    const { financial_year: fyParam, employee_id: requestedEmployeeId } = req.query;
    const { financialYear, start, end } = getFinancialYearRange(
      typeof fyParam === 'string' ? fyParam : undefined
    );

    let employeeId = await getEmployeeIdForUser(req.user.id);
    let actingForSelf = true;

    if (requestedEmployeeId && requestedEmployeeId !== employeeId) {
      const canReview = await hasCapability(req.user.id, CAPABILITIES.TAX_DECLARATION_REVIEW);
      if (!canReview) {
        return res.status(403).json({ error: 'Insufficient permissions to view other employees' });
      }
      employeeId = requestedEmployeeId;
      actingForSelf = false;
    }

    if (!employeeId) {
      return res.status(404).json({ error: 'Employee record not found' });
    }

    const employeeResult = await query(
      `SELECT e.employee_id, p.first_name, p.last_name, p.email
       FROM employees e
       JOIN profiles p ON p.id = e.user_id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [employeeId, tenantId]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    const orgResult = await query(
      `SELECT name, company_pan, company_tan, domain
       FROM organizations
       WHERE id = $1`,
      [tenantId]
    );

    const organization = orgResult.rows[0] || {};

    const payrollResult = await query(
      `SELECT pr.pay_date,
              pre.gross_pay_cents,
              pre.deductions_cents,
              pre.net_pay_cents,
              COALESCE((pre.metadata ->> 'tds_cents')::numeric, 0) AS tds_cents
       FROM payroll_run_employees pre
       JOIN payroll_runs pr ON pr.id = pre.payroll_run_id
       WHERE pre.employee_id = $1
         AND pr.tenant_id = $2
         AND pr.status = 'completed'
         AND pr.pay_date BETWEEN $3 AND $4
       ORDER BY pr.pay_date`,
      [employeeId, tenantId, start.toISOString(), end.toISOString()]
    );

    const declarationResult = await query(
      `SELECT td.id
       FROM tax_declarations td
       WHERE td.employee_id = $1
         AND td.financial_year = $2
         AND td.status = 'approved'
         AND td.tenant_id = $3
       LIMIT 1`,
      [employeeId, financialYear, tenantId]
    );

    let declarationItems = [];
    if (declarationResult.rows.length > 0) {
      const itemsResult = await query(
        `SELECT tdi.*, tcd.label, tcd.section, tcd.section_group
         FROM tax_declaration_items tdi
         JOIN tax_component_definitions tcd ON tcd.id = tdi.component_id
         WHERE tdi.declaration_id = $1`,
        [declarationResult.rows[0].id]
      );
      declarationItems = itemsResult.rows;
    }

    const totals = payrollResult.rows.reduce(
      (acc, row) => {
        const gross = Number(row.gross_pay_cents || 0);
        const deductions = Number(row.deductions_cents || 0);
        const tds = Number(row.tds_cents || 0);
        const net = Number(row.net_pay_cents || 0);
        acc.gross += gross;
        acc.deductions += deductions;
        acc.tds += tds;
        acc.net += net;
        return acc;
      },
      { gross: 0, deductions: 0, tds: 0, net: 0 }
    );

    const chapterVIAGroups = new Map();
    declarationItems.forEach((item) => {
      const key = item.section_group || item.section || item.label;
      const entry = chapterVIAGroups.get(key) || {
        label: item.section_group ? `Group ${item.section_group}` : `Section ${item.section}`,
        declared: 0,
        approved: 0,
      };
      entry.declared += Number(item.declared_amount || 0);
      entry.approved += Number(item.approved_amount || 0);
      chapterVIAGroups.set(key, entry);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Form16-${employee.employee_id || employeeId}-${financialYear}.pdf"`
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Form 16 - Part B', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Financial Year: ${financialYear}`);
    doc.text(`Generated On: ${formatDate(new Date().toISOString())}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Employer Details');
    doc.font('Helvetica');
    doc.text(`Name: ${organization.name || 'N/A'}`);
    doc.text(`PAN: ${organization.company_pan || 'N/A'}`);
    doc.text(`TAN: ${organization.company_tan || 'N/A'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Employee Details');
    doc.font('Helvetica');
    const employeeName = [employee.first_name, employee.last_name].filter(Boolean).join(' ') || 'N/A';
    doc.text(`Name: ${employeeName}`);
    doc.text(`Employee ID: ${employee.employee_id || employeeId}`);
    doc.text(`Email: ${employee.email || 'N/A'}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Salary Summary');
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Month     Pay Date       Gross        Deductions     TDS        Net');
    doc.font('Helvetica');

    if (payrollResult.rows.length === 0) {
      doc.text('No payroll records found for the selected financial year.');
    } else {
      payrollResult.rows.forEach((row) => {
        const date = new Date(row.pay_date);
        const month = date.toLocaleString('en-IN', { month: 'short' });
        const line = `${month.padEnd(8)} ${formatDate(row.pay_date).padEnd(13)} ${formatCurrency(
          row.gross_pay_cents / 100
        ).padEnd(12)} ${formatCurrency(row.deductions_cents / 100).padEnd(14)} ${formatCurrency(
          row.tds_cents / 100
        ).padEnd(9)} ${formatCurrency(row.net_pay_cents / 100)}`;
        doc.text(line);
      });

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Totals');
      doc.font('Helvetica');
      doc.text(`Gross Income: ${formatCurrency(totals.gross / 100)}`);
      doc.text(`Total Deductions: ${formatCurrency(totals.deductions / 100)}`);
      doc.text(`TDS Deducted: ${formatCurrency(totals.tds / 100)}`);
      doc.text(`Net Pay: ${formatCurrency(totals.net / 100)}`);
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Chapter VI-A Deductions');
    doc.font('Helvetica');
    if (chapterVIAGroups.size === 0) {
      doc.text('No approved tax-saving declaration items for this year.');
    } else {
      chapterVIAGroups.forEach((value) => {
        doc.text(
          `${value.label}: Declared ${formatCurrency(value.declared)}, Approved ${formatCurrency(value.approved)}`
        );
      });
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Notes');
    doc.font('Helvetica');
    doc.text(
      'This Form 16 summary is generated based on payroll records and approved investment declarations available in the system.'
    );
    if (!actingForSelf) {
      doc.text('Generated by an authorized reviewer.');
    }

    doc.end();
  } catch (error) {
    console.error('Error generating Form 16:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to generate Form 16' });
    } else {
      res.end();
    }
  }
});

export default router;


