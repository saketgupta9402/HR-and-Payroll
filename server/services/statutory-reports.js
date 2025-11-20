import { query } from '../db/pool.js';

/**
 * Statutory Reports Service
 * 
 * Generates compliant government reports for Indian Payroll:
 * - PF ECR (Electronic Challan cum Return) for EPFO
 * - ESI Return for ESIC
 * - TDS Summary for Income Tax
 */

/**
 * Get payroll data for a specific month/year
 * Checks both payroll_runs (HR system) and payroll_cycles (Payroll app system)
 */
async function getPayrollDataForMonth(tenantId, month, year) {
  // First, try payroll_cycles (Payroll app system)
  const cycleResult = await query(
    `SELECT id, month, year, status, payday
     FROM payroll_cycles
     WHERE tenant_id = $1
       AND month = $2
       AND year = $3
       AND status IN ('approved', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, month, year]
  );
  
  if (cycleResult.rows.length > 0) {
    return {
      type: 'cycle',
      id: cycleResult.rows[0].id,
      month: cycleResult.rows[0].month,
      year: cycleResult.rows[0].year,
      status: cycleResult.rows[0].status,
      pay_date: cycleResult.rows[0].payday || new Date(year, month - 1, 1)
    };
  }
  
  // Fallback to payroll_runs (HR system)
  const runResult = await query(
    `SELECT id, pay_period_start, pay_period_end, pay_date, status
     FROM payroll_runs
     WHERE tenant_id = $1
       AND EXTRACT(MONTH FROM pay_date) = $2
       AND EXTRACT(YEAR FROM pay_date) = $3
       AND status = 'completed'
     ORDER BY pay_date DESC
     LIMIT 1`,
    [tenantId, month, year]
  );
  
  if (runResult.rows.length > 0) {
    return {
      type: 'run',
      id: runResult.rows[0].id,
      pay_date: runResult.rows[0].pay_date,
      status: runResult.rows[0].status
    };
  }
  
  // Check what's available
  const anyCyclesResult = await query(
    `SELECT month, year, status
     FROM payroll_cycles
     WHERE tenant_id = $1
     ORDER BY year DESC, month DESC
     LIMIT 10`,
    [tenantId]
  );
  
  const anyRunsResult = await query(
    `SELECT 
       EXTRACT(MONTH FROM pay_date) as month,
       EXTRACT(YEAR FROM pay_date) as year,
       status
     FROM payroll_runs
     WHERE tenant_id = $1
     ORDER BY year DESC, month DESC
     LIMIT 10`,
    [tenantId]
  );
  
  let errorMessage = `No completed payroll found for ${month}/${year}.`;
  
  const availableCycles = anyCyclesResult.rows
    .filter(row => ['approved', 'completed'].includes(row.status))
    .map(row => `${row.month}/${row.year}`)
    .join(', ');
  
  const availableRuns = anyRunsResult.rows
    .filter(row => row.status === 'completed')
    .map(row => `${row.month}/${row.year}`)
    .join(', ');
  
  if (availableCycles || availableRuns) {
    const allAvailable = [availableCycles, availableRuns].filter(Boolean).join(', ');
    errorMessage += ` Available payroll: ${allAvailable}.`;
  } else {
    errorMessage += ` No payroll data found. Please create and process a payroll cycle first.`;
  }
  
  throw new Error(errorMessage);
}

/**
 * Generate PF ECR (Electronic Challan cum Return) file
 * Format: Delimiter-separated text file following EPFO ECR format
 * 
 * ECR Format Structure:
 * - Header: Establishment details
 * - Employee records: UAN, Name, Gross Wages, EPF Wages, EPS Wages, EPF Contribution, EPS Contribution, EDLI Contribution
 */
export async function generatePFECR(tenantId, month, year) {
  try {
    // Get payroll data (cycle or run)
    const payrollData = await getPayrollDataForMonth(tenantId, month, year);
    
    // Get organization details
    const orgResult = await query(
      `SELECT name, pf_code, company_pan
       FROM organizations
       WHERE id = $1`,
      [tenantId]
    );
    
    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }
    
    const org = orgResult.rows[0];
    
    if (!org.pf_code) {
      throw new Error('PF Code not configured for organization');
    }
    
    let employeesResult;
    
    if (payrollData.type === 'cycle') {
      // Use payroll_cycles and payroll_items
      employeesResult = await query(
        `SELECT 
          e.employee_id,
          e.uan_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          (pi.gross_salary * 100)::bigint as gross_pay_cents,
          (pi.pf_deduction * 100)::bigint as pf_contribution_cents,
          -- EPF Wages: Minimum of (Gross Pay, 15000) for PF calculation
          LEAST((pi.gross_salary * 100)::bigint, 1500000) as epf_wages_cents,
          -- EPS Wages: Minimum of (Gross Pay, 15000) for EPS calculation
          LEAST((pi.gross_salary * 100)::bigint, 1500000) as eps_wages_cents
         FROM payroll_items pi
         JOIN employees e ON e.id = pi.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pi.payroll_cycle_id = $1
           AND pi.tenant_id = $2
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId]
      );
    } else {
      // Use payroll_runs and payroll_run_employees
      employeesResult = await query(
        `SELECT 
          e.employee_id,
          e.uan_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          pre.gross_pay_cents,
          COALESCE((pre.metadata->>'pf_cents')::bigint, 0) as pf_contribution_cents,
          -- EPF Wages: Minimum of (Gross Pay, 15000) for PF calculation
          LEAST(pre.gross_pay_cents, 1500000) as epf_wages_cents,
          -- EPS Wages: Minimum of (Gross Pay, 15000) for EPS calculation
          LEAST(pre.gross_pay_cents, 1500000) as eps_wages_cents
         FROM payroll_run_employees pre
         JOIN employees e ON e.id = pre.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pre.payroll_run_id = $1
           AND pre.status = 'processed'
           AND e.tenant_id = $2
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId]
      );
    }
    
    if (employeesResult.rows.length === 0) {
      throw new Error('No employees found in payroll run');
    }
    
    // ECR Format: Pipe-delimited (|) text file
    const lines = [];
    
    // Header line: Establishment Code|Month|Year|Total Employees|Total EPF|Total EPS|Total EDLI
    const totalEPF = employeesResult.rows.reduce((sum, emp) => sum + Number(emp.pf_contribution_cents || 0), 0);
    const totalEPS = Math.round(totalEPF * 0.8333); // EPS is 8.33% of EPF (which is 12% of wages)
    const totalEDLI = Math.round(totalEPF * 0.0005); // EDLI is 0.5% of EPF
    
    const header = [
      org.pf_code || '',
      String(month).padStart(2, '0'),
      String(year),
      String(employeesResult.rows.length),
      String(Math.round(totalEPF / 100)), // Convert cents to rupees
      String(Math.round(totalEPS / 100)),
      String(Math.round(totalEDLI / 100))
    ].join('|');
    lines.push(header);
    
    // Employee records: UAN|Name|Gross Wages|EPF Wages|EPS Wages|EPF Contribution|EPS Contribution|EDLI Contribution
    employeesResult.rows.forEach((emp) => {
      const uan = emp.uan_number || '';
      const name = (emp.employee_name || '').trim().toUpperCase();
      const grossWages = Math.round(emp.gross_pay_cents / 100);
      const epfWages = Math.round(emp.epf_wages_cents / 100);
      const epsWages = Math.round(emp.eps_wages_cents / 100);
      const epfContribution = Math.round(emp.pf_contribution_cents / 100);
      const epsContribution = Math.round(epfContribution * 0.8333); // EPS is 8.33% of EPF
      const edliContribution = Math.round(epfContribution * 0.0005); // EDLI is 0.5% of EPF
      
      const record = [
        uan,
        name,
        String(grossWages),
        String(epfWages),
        String(epsWages),
        String(epfContribution),
        String(epsContribution),
        String(edliContribution)
      ].join('|');
      
      lines.push(record);
    });
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error generating PF ECR:', error);
    throw error;
  }
}

/**
 * Generate ESI Return file
 * Format: CSV with columns: IP Number, IP Name, Days Worked, Wages
 * 
 * ESI applies to employees with gross pay <= 21000 per month
 */
export async function generateESIReturn(tenantId, month, year) {
  try {
    // Get payroll data (cycle or run)
    const payrollData = await getPayrollDataForMonth(tenantId, month, year);
    
    // Get organization ESI code
    const orgResult = await query(
      `SELECT esi_code
       FROM organizations
       WHERE id = $1`,
      [tenantId]
    );
    
    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }
    
    const org = orgResult.rows[0];
    
    // Calculate days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let employeesResult;
    
    if (payrollData.type === 'cycle') {
      // Use payroll_cycles and payroll_items
      employeesResult = await query(
        `SELECT 
          e.employee_id,
          e.esi_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          (pi.gross_salary * 100)::bigint as gross_pay_cents,
          -- Calculate days worked (assuming full month for now, can be enhanced)
          $3 as days_worked
         FROM payroll_items pi
         JOIN employees e ON e.id = pi.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pi.payroll_cycle_id = $1
           AND pi.tenant_id = $2
           AND (pi.gross_salary * 100) <= 2100000  -- 21000 * 100 (in cents)
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId, daysInMonth]
      );
    } else {
      // Use payroll_runs and payroll_run_employees
      employeesResult = await query(
        `SELECT 
          e.employee_id,
          e.esi_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          pre.gross_pay_cents,
          -- Calculate days worked (assuming full month for now, can be enhanced)
          $3 as days_worked
         FROM payroll_run_employees pre
         JOIN employees e ON e.id = pre.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pre.payroll_run_id = $1
           AND pre.status = 'processed'
           AND e.tenant_id = $2
           AND pre.gross_pay_cents <= 2100000  -- 21000 * 100 (in cents)
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId, daysInMonth]
      );
    }
    
    if (employeesResult.rows.length === 0) {
      throw new Error('No employees eligible for ESI in this payroll run');
    }
    
    // CSV Format: IP Number, IP Name, Days Worked, Wages
    const lines = [];
    
    // Header
    lines.push('IP Number,IP Name,Days Worked,Wages');
    
    // Employee records
    employeesResult.rows.forEach((emp) => {
      const ipNumber = emp.esi_number || emp.employee_id || '';
      const ipName = (emp.employee_name || '').trim();
      const daysWorked = emp.days_worked || daysInMonth;
      const wages = Math.round(emp.gross_pay_cents / 100); // Convert cents to rupees
      
      // Escape CSV values (handle commas and quotes)
      const escapeCSV = (value) => {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const record = [
        escapeCSV(ipNumber),
        escapeCSV(ipName),
        escapeCSV(daysWorked),
        escapeCSV(wages)
      ].join(',');
      
      lines.push(record);
    });
    
    return lines.join('\n');
  } catch (error) {
    console.error('Error generating ESI Return:', error);
    throw error;
  }
}

/**
 * Generate TDS Summary
 * Returns JSON summary of TDS deductions grouped by section
 */
export async function generateTDSSummary(tenantId, month, year) {
  try {
    // Get payroll data (cycle or run)
    const payrollData = await getPayrollDataForMonth(tenantId, month, year);
    
    // Get organization details
    const orgResult = await query(
      `SELECT name, company_pan, company_tan
       FROM organizations
       WHERE id = $1`,
      [tenantId]
    );
    
    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }
    
    const org = orgResult.rows[0];
    
    let tdsResult;
    
    if (payrollData.type === 'cycle') {
      // Use payroll_cycles and payroll_items
      tdsResult = await query(
        `SELECT 
          e.employee_id,
          e.pan_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          (pi.gross_salary * 100)::bigint as gross_pay_cents,
          (pi.tds_deduction * 100)::bigint as tds_cents
         FROM payroll_items pi
         JOIN employees e ON e.id = pi.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pi.payroll_cycle_id = $1
           AND pi.tenant_id = $2
           AND (pi.tds_deduction * 100) > 0
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId]
      );
    } else {
      // Use payroll_runs and payroll_run_employees
      tdsResult = await query(
        `SELECT 
          e.employee_id,
          e.pan_number,
          COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, '') as employee_name,
          pre.gross_pay_cents,
          COALESCE((pre.metadata->>'tds_cents')::bigint, 0) as tds_cents
         FROM payroll_run_employees pre
         JOIN employees e ON e.id = pre.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE pre.payroll_run_id = $1
           AND pre.status = 'processed'
           AND e.tenant_id = $2
           AND COALESCE((pre.metadata->>'tds_cents')::bigint, 0) > 0
         ORDER BY e.employee_id`,
        [payrollData.id, tenantId]
      );
    }
    
    // Group TDS by section (default to Section 192B for salary TDS)
    const summary = {
      organization: {
        name: org.name || '',
        pan: org.company_pan || '',
        tan: org.company_tan || ''
      },
      period: {
        month,
        year,
        pay_date: payrollData.pay_date || new Date(year, month - 1, 1)
      },
      total_tds: 0,
      total_employees: tdsResult.rows.length,
      by_section: {
        '192B': { // Salary TDS
          section: '192B',
          description: 'Tax Deducted at Source on Salary',
          total_amount: 0,
          employee_count: 0,
          employees: []
        }
      },
      employees: []
    };
    
    tdsResult.rows.forEach((emp) => {
      const tdsAmount = Math.round(emp.tds_cents / 100); // Convert cents to rupees
      summary.total_tds += tdsAmount;
      
      const employeeRecord = {
        employee_id: emp.employee_id,
        pan: emp.pan_number || '',
        name: (emp.employee_name || '').trim(),
        gross_pay: Math.round(emp.gross_pay_cents / 100),
        tds_deducted: tdsAmount,
        section: '192B'
      };
      
      summary.employees.push(employeeRecord);
      summary.by_section['192B'].total_amount += tdsAmount;
      summary.by_section['192B'].employee_count += 1;
      summary.by_section['192B'].employees.push(employeeRecord);
    });
    
    return summary;
  } catch (error) {
    console.error('Error generating TDS Summary:', error);
    throw error;
  }
}

export default {
  generatePFECR,
  generateESIReturn,
  generateTDSSummary,
};

