import { query } from '../db/pool.js';

const ANNUAL_MONTHS = 12;

async function getEmployeeDeclaration(employeeId, tenantId, financialYear) {
  const declarationResult = await query(
    `SELECT *
     FROM tax_declarations
     WHERE employee_id = $1
       AND financial_year = $2
       AND tenant_id = $3`,
    [employeeId, financialYear, tenantId]
  );

  if (declarationResult.rows.length === 0) {
    return null;
  }

  const declaration = declarationResult.rows[0];

  const itemsResult = await query(
    `SELECT tdi.*, tcd.section, tcd.section_group, tcd.max_limit
     FROM tax_declaration_items tdi
     JOIN tax_component_definitions tcd ON tcd.id = tdi.component_id
     WHERE tdi.declaration_id = $1`,
    [declaration.id]
  );

  return {
    declaration,
    items: itemsResult.rows,
  };
}

async function getPayrollComponents(employeeId, tenantId) {
  const componentsResult = await query(
    `SELECT ecs.amount, pc.component_type, COALESCE(ecs.is_taxable_override, pc.is_taxable) as is_taxable
     FROM employee_salary_structure ecs
     JOIN payroll_components pc ON pc.id = ecs.component_id
     WHERE ecs.employee_id = $1
       AND ecs.tenant_id = $2`,
    [employeeId, tenantId]
  );
  return componentsResult.rows;
}

async function getTaxSlabs(tenantId, financialYear, regimeType) {
  const slabsResult = await query(
    `SELECT *
     FROM tax_regimes
     WHERE financial_year = $1
       AND regime_type = $2
       AND (tenant_id IS NULL OR tenant_id = $3)
     ORDER BY tenant_id NULLS FIRST`,
    [financialYear, regimeType, tenantId]
  );

  if (slabsResult.rows.length === 0) {
    throw new Error(`Tax regime not configured for ${financialYear} (${regimeType})`);
  }

  // Prefer tenant-specific, fallback to global
  const tenantSpecific = slabsResult.rows.find((row) => row.tenant_id === tenantId);
  return tenantSpecific || slabsResult.rows[0];
}

function calculateProjectedAnnual(compData) {
  let taxable = 0;
  let nonTaxable = 0;
  compData.forEach((component) => {
    const annualAmount = Number(component.amount || 0) * ANNUAL_MONTHS;
    if (component.component_type === 'deduction') {
      taxable -= annualAmount;
    } else if (component.is_taxable) {
      taxable += annualAmount;
    } else {
      nonTaxable += annualAmount;
    }
  });
  return { taxable, nonTaxable };
}

function applyOldRegimeDeductions(declarationItems) {
  const grouped = new Map();
  declarationItems.forEach((item) => {
    const group = item.section_group || item.section || item.component_id;
    const bucket = grouped.get(group) || { total: 0, max: item.max_limit ? Number(item.max_limit) : null };
    bucket.total += Number(item.approved_amount ?? item.declared_amount ?? 0);
    if (bucket.max !== null && bucket.total > bucket.max) {
      bucket.total = bucket.max;
    }
    grouped.set(group, bucket);
  });

  let total = 0;
  grouped.forEach((value) => {
    total += value.total;
  });

  return total;
}

function applyTaxSlabs(netTaxableIncome, taxRegime) {
  const slabs = Array.isArray(taxRegime.slabs) ? taxRegime.slabs : [];
  let remaining = Math.max(0, netTaxableIncome);
  let tax = 0;

  slabs.forEach((slab) => {
    if (remaining <= 0) return;
    const slabFrom = Number(slab.from || 0);
    const slabTo = slab.to == null ? Infinity : Number(slab.to);
    const rate = Number(slab.rate || 0) / 100;
    if (netTaxableIncome > slabFrom) {
      const taxableInSlab = Math.min(remaining, slabTo - slabFrom);
      tax += taxableInSlab * rate;
      remaining -= taxableInSlab;
    }
  });

  const surchargeRules = Array.isArray(taxRegime.surcharge_rules) ? taxRegime.surcharge_rules : [];
  surchargeRules.forEach((rule) => {
    const threshold = Number(rule.threshold || 0);
    const rate = Number(rule.rate || 0) / 100;
    if (netTaxableIncome > threshold) {
      tax += tax * rate;
    }
  });

  const cessPercentage = Number(taxRegime.cess_percentage || 4) / 100;
  tax += tax * cessPercentage;

  return tax;
}

export async function calculateMonthlyTDS(employeeId, tenantId, financialYear) {
  const declarationData = await getEmployeeDeclaration(employeeId, tenantId, financialYear);
  const compData = await getPayrollComponents(employeeId, tenantId);

  const { taxable } = calculateProjectedAnnual(compData);

  const regimeType = declarationData?.declaration?.chosen_regime || 'old';

  let netTaxableIncome = taxable;

  if (regimeType === 'old' && declarationData) {
    const cappedDeductions = applyOldRegimeDeductions(declarationData.items || []);
    const taxRegime = await getTaxSlabs(tenantId, financialYear, 'old');
    const standardDeduction = Number(taxRegime.standard_deduction || 0);
    netTaxableIncome -= cappedDeductions;
    netTaxableIncome -= standardDeduction;
  } else {
    const taxRegime = await getTaxSlabs(tenantId, financialYear, 'new');
    const standardDeduction = Number(taxRegime.standard_deduction || 0);
    netTaxableIncome -= standardDeduction;
  }

  const taxRegime = await getTaxSlabs(tenantId, financialYear, regimeType);
  const annualTax = applyTaxSlabs(netTaxableIncome, taxRegime);

  const monthlyTds = annualTax / ANNUAL_MONTHS;

  return {
    annualTax: Math.max(0, Math.round(annualTax)),
    monthlyTds: Math.max(0, Math.round(monthlyTds)),
    netTaxableIncome: Math.max(0, Math.round(netTaxableIncome)),
    regime: regimeType,
  };
}

export default {
  calculateMonthlyTDS,
};


