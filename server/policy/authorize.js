/**
 * Centralized RBAC Capability System
 * 
 * This module provides capability-based authorization checks.
 * Capabilities map to specific permissions that can be granted to roles.
 */

import { query } from '../db/pool.js';

// Capability definitions
export const CAPABILITIES = {
  // Timesheet capabilities
  TIMESHEET_SUBMIT_OWN: 'TIMESHEET_SUBMIT_OWN',
  TIMESHEET_APPROVE_TEAM: 'TIMESHEET_APPROVE_TEAM',
  TIMESHEET_OVERRIDE_HR: 'TIMESHEET_OVERRIDE_HR',
  TIMESHEET_OVERRIDE_DEPT: 'TIMESHEET_OVERRIDE_DEPT',
  TIMESHEET_PAYBLOCK: 'TIMESHEET_PAYBLOCK',
  
  // Leave capabilities
  LEAVE_REQUEST_OWN: 'LEAVE_REQUEST_OWN',
  LEAVE_APPROVE_TEAM: 'LEAVE_APPROVE_TEAM',
  LEAVE_APPROVE_ORG: 'LEAVE_APPROVE_ORG',
  LEAVE_APPROVE_DEPT: 'LEAVE_APPROVE_DEPT',
  
  // Onboarding capabilities
  ONBOARDING_OWN_ALL: 'ONBOARDING_OWN_ALL',
  ONBOARDING_DEPT: 'ONBOARDING_DEPT',
  
  // Background check capabilities
  BG_CHECK_TRIGGER: 'BG_CHECK_TRIGGER',
  BG_CHECK_VIEW_DEPT: 'BG_CHECK_VIEW_DEPT',
  
  // Termination/rehire capabilities
  TERMINATE_REHIRE_EXECUTE: 'TERMINATE_REHIRE_EXECUTE',
  TERMINATE_REHIRE_APPROVE_DEPT: 'TERMINATE_REHIRE_APPROVE_DEPT',
  
  // Project allocation capabilities
  PROJECT_ALLOC_SET_ORG: 'PROJECT_ALLOC_SET_ORG',
  PROJECT_ALLOC_SET_DEPT: 'PROJECT_ALLOC_SET_DEPT',
  PROJECT_ALLOC_PROPOSE: 'PROJECT_ALLOC_PROPOSE',
  
  // Policy capabilities
  POLICIES_CREATE_EDIT: 'POLICIES_CREATE_EDIT',
  POLICIES_READ: 'POLICIES_READ',
  
  // Attendance capabilities
  ATTENDANCE_UPLOAD: 'ATTENDANCE_UPLOAD',
  
  // Payroll capabilities
  PAYROLL_RUN: 'PAYROLL_RUN',
  PAYROLL_ROLLBACK: 'PAYROLL_ROLLBACK',
  PAYROLL_READ_TOTALS: 'PAYROLL_READ_TOTALS',
  REIMBURSEMENT_APPROVE: 'REIMBURSEMENT_APPROVE',

  // Tax declaration capabilities
  TAX_DECLARATION_MANAGE: 'TAX_DECLARATION_MANAGE',
  TAX_DECLARATION_REVIEW: 'TAX_DECLARATION_REVIEW',
  
  // User/role admin capabilities
  USER_ROLE_ADMIN: 'USER_ROLE_ADMIN',
  
  // Break-glass override
  BREAK_GLASS_OVERRIDE: 'BREAK_GLASS_OVERRIDE',
  
  // Feature flags
  FEATURE_PAYROLL: 'FEATURE_PAYROLL',
};

// Role to capability mapping
const ROLE_CAPABILITIES = {
  employee: [
    CAPABILITIES.TIMESHEET_SUBMIT_OWN,
    CAPABILITIES.LEAVE_REQUEST_OWN,
    CAPABILITIES.POLICIES_READ,
    CAPABILITIES.TAX_DECLARATION_MANAGE,
  ],
  manager: [
    CAPABILITIES.TIMESHEET_SUBMIT_OWN,
    CAPABILITIES.TIMESHEET_APPROVE_TEAM,
    CAPABILITIES.LEAVE_REQUEST_OWN,
    CAPABILITIES.LEAVE_APPROVE_TEAM,
    CAPABILITIES.PROJECT_ALLOC_PROPOSE,
    CAPABILITIES.POLICIES_READ,
    CAPABILITIES.TAX_DECLARATION_MANAGE,
  ],
  hr: [
    CAPABILITIES.TIMESHEET_SUBMIT_OWN,
    CAPABILITIES.TIMESHEET_APPROVE_TEAM,
    CAPABILITIES.TIMESHEET_OVERRIDE_HR,
    CAPABILITIES.LEAVE_REQUEST_OWN,
    CAPABILITIES.LEAVE_APPROVE_TEAM,
    CAPABILITIES.LEAVE_APPROVE_ORG,
    CAPABILITIES.ONBOARDING_OWN_ALL,
    CAPABILITIES.BG_CHECK_TRIGGER,
    CAPABILITIES.TERMINATE_REHIRE_EXECUTE,
    CAPABILITIES.PROJECT_ALLOC_SET_ORG,
    CAPABILITIES.POLICIES_CREATE_EDIT,
    CAPABILITIES.POLICIES_READ,
    CAPABILITIES.ATTENDANCE_UPLOAD,
    CAPABILITIES.BREAK_GLASS_OVERRIDE,
    CAPABILITIES.TAX_DECLARATION_MANAGE,
    CAPABILITIES.TAX_DECLARATION_REVIEW,
    CAPABILITIES.REIMBURSEMENT_APPROVE,
  ],
  director: [
    CAPABILITIES.TIMESHEET_SUBMIT_OWN,
    CAPABILITIES.TIMESHEET_APPROVE_TEAM,
    CAPABILITIES.TIMESHEET_OVERRIDE_DEPT,
    CAPABILITIES.LEAVE_REQUEST_OWN,
    CAPABILITIES.LEAVE_APPROVE_TEAM,
    CAPABILITIES.LEAVE_APPROVE_DEPT,
    CAPABILITIES.ONBOARDING_DEPT,
    CAPABILITIES.BG_CHECK_VIEW_DEPT,
    CAPABILITIES.TERMINATE_REHIRE_APPROVE_DEPT,
    CAPABILITIES.PROJECT_ALLOC_SET_DEPT,
    CAPABILITIES.POLICIES_READ,
    CAPABILITIES.BREAK_GLASS_OVERRIDE,
    CAPABILITIES.TAX_DECLARATION_MANAGE,
  ],
  accountant: [
    CAPABILITIES.TIMESHEET_PAYBLOCK,
    CAPABILITIES.ATTENDANCE_UPLOAD,
    CAPABILITIES.PAYROLL_RUN,
    CAPABILITIES.PAYROLL_ROLLBACK,
    CAPABILITIES.FEATURE_PAYROLL,
    CAPABILITIES.TAX_DECLARATION_REVIEW,
    CAPABILITIES.REIMBURSEMENT_APPROVE,
  ],
  ceo: [
    CAPABILITIES.TIMESHEET_OVERRIDE_HR, // Exception only, audited
    CAPABILITIES.LEAVE_APPROVE_ORG,
    CAPABILITIES.PAYROLL_READ_TOTALS,
    CAPABILITIES.POLICIES_READ,
    CAPABILITIES.BREAK_GLASS_OVERRIDE,
    CAPABILITIES.FEATURE_PAYROLL,
    CAPABILITIES.TAX_DECLARATION_REVIEW,
    CAPABILITIES.REIMBURSEMENT_APPROVE,
  ],
  admin: [
    CAPABILITIES.USER_ROLE_ADMIN,
    // Admin has all capabilities
    ...Object.values(CAPABILITIES),
  ],
};

/**
 * Check if a user has a specific capability
 * @param {string} userId - User ID
 * @param {string} capability - Capability to check
 * @param {Object} scope - Optional scope (e.g., { department: 'dept-id', employeeId: 'emp-id' })
 * @returns {Promise<boolean>}
 */
export async function hasCapability(userId, capability, scope = {}) {
  // Check if user is superadmin (platform admin)
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const userResult = await query('SELECT email FROM profiles WHERE id = $1', [userId]);
  const userEmail = userResult.rows[0]?.email?.toLowerCase();
  
  if (userEmail && adminEmails.includes(userEmail)) {
    return true; // Superadmins have all capabilities
  }
  
  // Get user's roles
  const roleResult = await query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  
  const roles = roleResult.rows.map(r => r.role);
  
  // Check if any role has the capability
  for (const role of roles) {
    const roleCaps = ROLE_CAPABILITIES[role] || [];
    if (roleCaps.includes(capability)) {
      // Apply scope checks if needed
      if (scope.department) {
        // Verify user belongs to or manages the department
        const deptCheck = await query(
          `SELECT e.department 
           FROM employees e 
           WHERE e.user_id = $1 AND e.department = $2`,
          [userId, scope.department]
        );
        if (deptCheck.rows.length === 0) {
          // Check if user is a director/manager of this department
          const managerCheck = await query(
            `SELECT e.id 
             FROM employees e 
             WHERE e.user_id = $1 
             AND EXISTS (
               SELECT 1 FROM employees e2 
               WHERE e2.department = $2 
               AND e2.reporting_manager_id = e.id
             )`,
            [userId, scope.department]
          );
          if (managerCheck.rows.length === 0) {
            continue; // User doesn't have access to this department
          }
        }
      }
      
      if (scope.employeeId) {
        // Check if user can access this employee
        const empCheck = await query(
          `SELECT e.id, e.user_id, e.reporting_manager_id, e.department
           FROM employees e
           WHERE e.id = $1`,
          [scope.employeeId]
        );
        
        if (empCheck.rows.length === 0) {
          return false;
        }
        
        const emp = empCheck.rows[0];
        
        // Owner can access their own data
        if (emp.user_id === userId) {
          return true;
        }
        
        // Manager can access their team
        if (role === 'manager' && emp.reporting_manager_id) {
          const managerEmp = await query(
            'SELECT id FROM employees WHERE user_id = $1',
            [userId]
          );
          if (managerEmp.rows.length > 0 && emp.reporting_manager_id === managerEmp.rows[0].id) {
            return true;
          }
        }
        
        // HR/Director/CEO can access based on role
        if (['hr', 'director', 'ceo', 'admin'].includes(role)) {
          // Director needs to be in same department
          if (role === 'director') {
            const userDept = await query(
              'SELECT department FROM employees WHERE user_id = $1',
              [userId]
            );
            if (userDept.rows.length > 0 && userDept.rows[0].department === emp.department) {
              return true;
            }
          } else {
            // HR/CEO/Admin can access all
            return true;
          }
        }
        
        return false; // No access to this employee
      }
      
      return true; // Capability granted
    }
  }
  
  return false; // No capability found
}

/**
 * Express middleware to require a capability
 * @param {string} capability - Capability to require
 * @param {Function} getScope - Optional function to extract scope from request
 * @returns {Function} Express middleware
 */
export function requireCapability(capability, getScope = null) {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Not authenticated', errors: [] });
    }
    
    const scope = getScope ? getScope(req) : {};
    
    try {
      const hasAccess = await hasCapability(req.user.id, capability, scope);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions', 
          errors: [],
          required: capability 
        });
      }
      
      next();
    } catch (error) {
      console.error('Capability check error:', error);
      return res.status(500).json({ error: 'Authorization check failed', errors: [] });
    }
  };
}

/**
 * Get all capabilities for a user
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of capability strings
 */
export async function getUserCapabilities(userId) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const userResult = await query('SELECT email FROM profiles WHERE id = $1', [userId]);
  const userEmail = userResult.rows[0]?.email?.toLowerCase();
  
  if (userEmail && adminEmails.includes(userEmail)) {
    return Object.values(CAPABILITIES); // Superadmins have all capabilities
  }
  
  const roleResult = await query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userId]
  );
  
  const roles = roleResult.rows.map(r => r.role);
  const capabilities = new Set();
  
  for (const role of roles) {
    const roleCaps = ROLE_CAPABILITIES[role] || [];
    roleCaps.forEach(cap => capabilities.add(cap));
  }
  
  return Array.from(capabilities);
}

