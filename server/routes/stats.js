import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get pending counts
router.get('/pending-counts', authenticateToken, async (req, res) => {
  try {
    // Get user's tenant_id
    const tenantResult = await query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );
    const tenantId = tenantResult.rows[0]?.tenant_id;

    if (!tenantId) {
      return res.json({ timesheets: 0, leaves: 0 });
    }

    // Get user's role
    const roleResult = await query(
      `SELECT role FROM user_roles WHERE user_id = $1
       ORDER BY CASE role
         WHEN 'admin' THEN 0
         WHEN 'ceo' THEN 1
         WHEN 'director' THEN 2
         WHEN 'hr' THEN 3
         WHEN 'manager' THEN 4
         WHEN 'employee' THEN 5
       END
       LIMIT 1`,
      [req.user.id]
    );
    let role = roleResult.rows[0]?.role;

    // Get employee ID
    const empResult = await query(
      'SELECT id FROM employees WHERE user_id = $1',
      [req.user.id]
    );
    const employeeId = empResult.rows[0]?.id;

    // Check if user has direct reports and should be treated as manager
    if (employeeId) {
      const hasDirectReports = await query(
        `SELECT COUNT(*) as count FROM employees 
         WHERE reporting_manager_id = $1`,
        [employeeId]
      );
      const directReportsCount = parseInt(hasDirectReports.rows[0]?.count || '0');
      
      if (directReportsCount > 0 && !['admin', 'ceo', 'director', 'hr', 'manager'].includes(role)) {
        role = 'manager';
      }
    }

    let timesheetsCount = 0;
    let leavesCount = 0;
    let taxDeclarationsCount = 0;

    if (['manager', 'hr', 'director', 'ceo', 'admin'].includes(role)) {
      // For managers, count only their team's pending requests
      if (role === 'manager' && employeeId) {
        // Count pending timesheets for manager's team
        const timesheetResult = await query(
          `SELECT COUNT(*) as count FROM timesheets t
           JOIN employees e ON e.id = t.employee_id
           WHERE t.status = 'pending' AND t.tenant_id = $1 AND e.reporting_manager_id = $2`,
          [tenantId, employeeId]
        );
        timesheetsCount = parseInt(timesheetResult.rows[0]?.count || '0');

        // Count pending leave requests for manager's team
        const leaveResult = await query(
          `SELECT COUNT(*) as count FROM leave_requests lr
           JOIN employees e ON e.id = lr.employee_id
           WHERE lr.status = 'pending' AND lr.tenant_id = $1 AND e.reporting_manager_id = $2`,
          [tenantId, employeeId]
        );
        leavesCount = parseInt(leaveResult.rows[0]?.count || '0');

        const taxResult = await query(
          `SELECT COUNT(*) as count FROM tax_declarations td
           JOIN employees e ON e.id = td.employee_id
           WHERE td.status = 'submitted' AND td.tenant_id = $1 AND e.reporting_manager_id = $2`,
          [tenantId, employeeId]
        );
        taxDeclarationsCount = parseInt(taxResult.rows[0]?.count || '0');
      } else {
        // For HR/CEO/Admin, count all pending requests
        const timesheetResult = await query(
          'SELECT COUNT(*) as count FROM timesheets WHERE status = $1 AND tenant_id = $2',
          ['pending', tenantId]
        );
        timesheetsCount = parseInt(timesheetResult.rows[0]?.count || '0');

        const leaveResult = await query(
          'SELECT COUNT(*) as count FROM leave_requests WHERE status = $1 AND tenant_id = $2',
          ['pending', tenantId]
        );
        leavesCount = parseInt(leaveResult.rows[0]?.count || '0');

        const taxResult = await query(
          'SELECT COUNT(*) as count FROM tax_declarations WHERE status = $1 AND tenant_id = $2',
          ['submitted', tenantId]
        );
        taxDeclarationsCount = parseInt(taxResult.rows[0]?.count || '0');
      }
    }

    res.json({
      timesheets: timesheetsCount,
      leaves: leavesCount,
      taxDeclarations: taxDeclarationsCount,
    });
  } catch (error) {
    console.error('Error fetching pending counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get leave balance for current user
router.get('/leave-balance', authenticateToken, async (req, res) => {
  try {
    // Get user's tenant_id
    const tenantResult = await query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );
    const tenantId = tenantResult.rows[0]?.tenant_id;

    if (!tenantId) {
      return res.json({ leaveBalance: 0, totalLeaves: 0, approvedLeaves: 0 });
    }

    // Get employee ID
    const empResult = await query(
      'SELECT id FROM employees WHERE user_id = $1',
      [req.user.id]
    );

    if (empResult.rows.length === 0) {
      return res.json({ leaveBalance: 0, totalLeaves: 0, approvedLeaves: 0 });
    }

    const employeeId = empResult.rows[0].id;

    // Get all leave policies for the tenant
    const policiesResult = await query(
      'SELECT id, annual_entitlement FROM leave_policies WHERE tenant_id = $1 AND is_active = true',
      [tenantId]
    );

    let totalLeaves = 0;
    const policyIds = policiesResult.rows.map(p => p.id);
    
    if (policyIds.length > 0) {
      totalLeaves = policiesResult.rows.reduce((sum, p) => sum + (p.annual_entitlement || 0), 0);
    }

    // Get approved leave requests for current year
    const currentYear = new Date().getFullYear();
    const approvedLeavesResult = await query(
      `SELECT COALESCE(SUM(total_days), 0) as days FROM leave_requests 
       WHERE employee_id = $1 AND status = 'approved' 
       AND EXTRACT(YEAR FROM start_date) = $2`,
      [employeeId, currentYear]
    );

    const approvedLeaves = parseInt(approvedLeavesResult.rows[0]?.days || '0');
    const leaveBalance = totalLeaves - approvedLeaves;

    res.json({
      leaveBalance: Math.max(0, leaveBalance), // Ensure non-negative
      totalLeaves,
      approvedLeaves,
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

