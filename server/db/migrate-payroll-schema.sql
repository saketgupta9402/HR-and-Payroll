-- Employee profile enhancements
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_mode TEXT CHECK (work_mode IN ('onsite','remote','hybrid')),
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS holiday_override JSONB,
  ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'online' CHECK (presence_status IN ('online','away','out_of_office','break')),
  ADD COLUMN IF NOT EXISTS last_presence_update TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_employees_presence_status ON employees(presence_status);

-- Presence helpers
CREATE OR REPLACE FUNCTION update_presence_on_leave_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    UPDATE employees
    SET presence_status = 'out_of_office',
        last_presence_update = now()
    WHERE id = NEW.employee_id;
  END IF;

  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE employees
    SET presence_status = 'online',
        last_presence_update = now()
    WHERE id = NEW.employee_id
      AND presence_status = 'out_of_office'
      AND NOT EXISTS (
        SELECT 1 FROM leave_requests lr
        WHERE lr.employee_id = NEW.employee_id
          AND lr.status = 'approved'
          AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_presence_on_leave ON leave_requests;
CREATE TRIGGER trigger_update_presence_on_leave
  AFTER INSERT OR UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_presence_on_leave_approval();

CREATE OR REPLACE FUNCTION has_active_approved_leave(emp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leave_requests
    WHERE employee_id = emp_id
      AND status = 'approved'
      AND CURRENT_DATE BETWEEN start_date AND end_date
  );
$$;

-- Ensure onboarding data has payroll-specific fields
ALTER TABLE onboarding_data
  ADD COLUMN IF NOT EXISTS uan_number TEXT,
  ADD COLUMN IF NOT EXISTS pf_number TEXT,
  ADD COLUMN IF NOT EXISTS esi_number TEXT,
  ADD COLUMN IF NOT EXISTS tax_declaration_section_80c NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_declaration_section_80d NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_declaration_section_24b NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_declaration_other NUMERIC(12,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_onboarding_data_uan ON onboarding_data(uan_number) WHERE uan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_data_pan ON onboarding_data(pan_number) WHERE pan_number IS NOT NULL;

-- Holiday management tables
CREATE TABLE IF NOT EXISTS holiday_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  region TEXT NOT NULL,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_national BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT false,
  locked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_holiday_lists_org_year ON holiday_lists(org_id, year);

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES holiday_lists(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  is_national BOOLEAN DEFAULT false,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_holidays_list ON holidays(list_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_holiday_date_per_list ON holidays(list_id, date);

CREATE TABLE IF NOT EXISTS holiday_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL CHECK (action IN ('create','update','import','publish','lock','override')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS holiday_id UUID REFERENCES holidays(id);
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS readonly BOOLEAN DEFAULT false;
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS conflict BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_holiday ON timesheet_entries(holiday_id);

-- Skills and project management tables
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  years_experience NUMERIC(4,1) DEFAULT 0,
  last_used_date DATE,
  endorsements INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skills_employee ON skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills((lower(name)));

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certs_employee ON certifications(employee_id);

CREATE TABLE IF NOT EXISTS employee_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  project_name TEXT NOT NULL,
  role TEXT,
  start_date DATE,
  end_date DATE,
  technologies TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_projects_employee ON employee_projects(employee_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  required_skills JSONB DEFAULT '[]'::jsonb,
  required_certifications TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  expected_allocation_percent INTEGER DEFAULT 50,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  role TEXT,
  allocation_percent INTEGER NOT NULL CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  start_date DATE,
  end_date DATE,
  assigned_by UUID REFERENCES profiles(id),
  override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assignments_project ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_end_date ON assignments(end_date);

CREATE TABLE IF NOT EXISTS benefit_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id UUID REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_benefit_employee ON benefit_points(employee_id);

CREATE TABLE IF NOT EXISTS ai_suggestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  computed_by TEXT
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assignments_updated_at') THEN
    CREATE TRIGGER update_assignments_updated_at
      BEFORE UPDATE ON assignments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
    CREATE TRIGGER update_projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_skills_updated_at') THEN
    CREATE TRIGGER update_skills_updated_at
      BEFORE UPDATE ON skills
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Ensure payroll_status enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status') THEN
    CREATE TYPE payroll_status AS ENUM (
      'draft',
      'approved',
      'processing',
      'completed',
      'failed',
      'pending_approval',
      'pending'
    );
  END IF;
END;
$$;

-- Compensation structures table (extends HR employees)
CREATE TABLE IF NOT EXISTS compensation_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  ctc NUMERIC(12,2) NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL,
  hra NUMERIC(12,2) DEFAULT 0,
  special_allowance NUMERIC(12,2) DEFAULT 0,
  da NUMERIC(12,2) DEFAULT 0,
  lta NUMERIC(12,2) DEFAULT 0,
  bonus NUMERIC(12,2) DEFAULT 0,
  pf_contribution NUMERIC(12,2) DEFAULT 0,
  esi_contribution NUMERIC(12,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, effective_from)
);

-- Add missing columns if table exists
ALTER TABLE compensation_structures
  ADD COLUMN IF NOT EXISTS effective_to DATE;

CREATE INDEX IF NOT EXISTS idx_comp_structures_tenant ON compensation_structures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comp_structures_employee ON compensation_structures(employee_id);
CREATE INDEX IF NOT EXISTS idx_comp_structures_dates ON compensation_structures(effective_from, effective_to);

-- Payroll cycles table
CREATE TABLE IF NOT EXISTS payroll_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  payday DATE,
  status payroll_status DEFAULT 'draft',
  total_employees INTEGER DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_cycles_tenant ON payroll_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_cycles_period ON payroll_cycles(tenant_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_cycles_status ON payroll_cycles(status);

-- Payroll items table
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  payroll_cycle_id UUID REFERENCES payroll_cycles(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  gross_salary NUMERIC(12,2) NOT NULL,
  deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL,
  hra NUMERIC(12,2) DEFAULT 0,
  special_allowance NUMERIC(12,2) DEFAULT 0,
  pf_deduction NUMERIC(12,2) DEFAULT 0,
  esi_deduction NUMERIC(12,2) DEFAULT 0,
  tds_deduction NUMERIC(12,2) DEFAULT 0,
  pt_deduction NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(payroll_cycle_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_tenant ON payroll_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_cycle ON payroll_items(payroll_cycle_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_items(employee_id);

ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_days NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_working_days NUMERIC(5, 2) DEFAULT 0;

-- Tax declarations table
CREATE TABLE IF NOT EXISTS tax_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  financial_year TEXT NOT NULL,
  section_80c NUMERIC(12,2) DEFAULT 0,
  section_80d NUMERIC(12,2) DEFAULT 0,
  section_24b NUMERIC(12,2) DEFAULT 0,
  section_80g NUMERIC(12,2) DEFAULT 0,
  section_80e NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_tax_declarations_tenant ON tax_declarations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_employee ON tax_declarations(employee_id);
CREATE INDEX IF NOT EXISTS idx_tax_declarations_fy ON tax_declarations(financial_year);

-- Form 16 table
CREATE TABLE IF NOT EXISTS form16 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  financial_year TEXT NOT NULL,
  pan_number TEXT,
  gross_salary NUMERIC(12,2) NOT NULL,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  taxable_income NUMERIC(12,2) NOT NULL,
  tax_paid NUMERIC(12,2) DEFAULT 0,
  tax_refund NUMERIC(12,2) DEFAULT 0,
  tds_certificate_number TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES profiles(id),
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_form16_tenant ON form16(tenant_id);
CREATE INDEX IF NOT EXISTS idx_form16_employee ON form16(employee_id);
CREATE INDEX IF NOT EXISTS idx_form16_fy ON form16(financial_year);

-- Payroll settings table
CREATE TABLE IF NOT EXISTS payroll_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  pf_enabled BOOLEAN DEFAULT true,
  esi_enabled BOOLEAN DEFAULT false,
  pt_enabled BOOLEAN DEFAULT true,
  tds_enabled BOOLEAN DEFAULT true,
  pf_rate NUMERIC(5,2) DEFAULT 12.00,
  esi_rate NUMERIC(5,2) DEFAULT 1.75,
  pt_amount NUMERIC(8,2) DEFAULT 200.00,
  default_payday INTEGER CHECK (default_payday BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_settings_tenant ON payroll_settings(tenant_id);

-- Payroll views
CREATE OR REPLACE VIEW payroll_employee_view AS
SELECT 
  e.id AS employee_id,
  e.tenant_id AS org_id,
  e.employee_id AS employee_code,
  p.id AS user_id,
  p.email,
  p.first_name,
  p.last_name,
  CONCAT(COALESCE(p.first_name, ''), CASE WHEN p.first_name IS NOT NULL AND p.last_name IS NOT NULL THEN ' ' ELSE '' END, COALESCE(p.last_name, '')) AS full_name,
  p.phone,
  e.department,
  e.position AS designation,
  e.join_date AS date_of_joining,
  e.status AS employment_status,
  od.pan_number,
  od.aadhar_number AS aadhaar_number,
  od.uan_number,
  od.pf_number,
  od.esi_number,
  od.bank_account_number,
  od.bank_name,
  od.bank_branch,
  od.ifsc_code,
  od.tax_declaration_section_80c,
  od.tax_declaration_section_80d,
  od.tax_declaration_section_24b,
  od.tax_declaration_other,
  cs.ctc,
  cs.basic_salary,
  cs.hra,
  cs.special_allowance,
  cs.da,
  cs.lta,
  cs.bonus,
  cs.pf_contribution,
  cs.esi_contribution,
  cs.effective_from AS compensation_effective_from,
  cs.effective_to AS compensation_effective_to,
  e.created_at,
  e.updated_at
FROM employees e
INNER JOIN profiles p ON e.user_id = p.id
LEFT JOIN onboarding_data od ON e.id = od.employee_id
LEFT JOIN LATERAL (
  SELECT *
  FROM compensation_structures cs
  WHERE cs.employee_id = e.id
    AND cs.effective_from <= CURRENT_DATE
    AND (cs.effective_to IS NULL OR cs.effective_to >= CURRENT_DATE)
  ORDER BY cs.effective_from DESC
  LIMIT 1
) cs ON TRUE;

CREATE OR REPLACE VIEW payroll_organization_view AS
SELECT
  o.id AS org_id,
  o.name AS company_name,
  o.domain,
  o.logo_url,
  o.timezone,
  ps.pf_enabled,
  ps.esi_enabled,
  ps.pt_enabled,
  ps.tds_enabled,
  ps.pf_rate,
  ps.esi_rate,
  ps.pt_amount,
  ps.default_payday
FROM organizations o
LEFT JOIN payroll_settings ps ON o.id = ps.tenant_id;

CREATE OR REPLACE VIEW payroll_employee_payslip_view AS
SELECT
  pi.id AS payslip_id,
  pi.tenant_id AS org_id,
  pi.employee_id,
  pev.employee_code,
  pev.full_name,
  pev.email,
  pev.department,
  pev.designation,
  pc.id AS payroll_cycle_id,
  pc.month,
  pc.year,
  pc.payday,
  pc.status AS cycle_status,
  pi.gross_salary,
  pi.basic_salary,
  pi.hra,
  pi.special_allowance,
  pi.pf_deduction,
  pi.esi_deduction,
  pi.tds_deduction,
  pi.pt_deduction,
  pi.other_deductions,
  pi.other_allowances,
  pi.deductions,
  pi.net_salary,
  pi.created_at AS payslip_generated_at,
  pi.updated_at AS payslip_updated_at
FROM payroll_items pi
INNER JOIN payroll_cycles pc ON pi.payroll_cycle_id = pc.id
INNER JOIN payroll_employee_view pev ON pi.employee_id = pev.employee_id;

-- Enable Row Level Security on payroll tables
ALTER TABLE compensation_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE form16 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

-- Payroll RLS policies (idempotent rebuild)
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_compensation_structures ON compensation_structures';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_payroll_cycles ON payroll_cycles';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_payroll_items ON payroll_items';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_tax_declarations ON tax_declarations';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_form16 ON form16';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation_payroll_settings ON payroll_settings';
END;
$$;

CREATE POLICY org_isolation_compensation_structures ON compensation_structures
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY org_isolation_payroll_cycles ON payroll_cycles
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY org_isolation_payroll_items ON payroll_items
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY org_isolation_tax_declarations ON tax_declarations
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY org_isolation_form16 ON form16
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

CREATE POLICY org_isolation_payroll_settings ON payroll_settings
  USING (tenant_id = current_setting('app.org_id', true)::uuid);

-- Updated_at triggers for payroll tables (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_compensation_structures_updated_at'
  ) THEN
    CREATE TRIGGER update_compensation_structures_updated_at
      BEFORE UPDATE ON compensation_structures
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payroll_cycles_updated_at'
  ) THEN
    CREATE TRIGGER update_payroll_cycles_updated_at
      BEFORE UPDATE ON payroll_cycles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payroll_items_updated_at'
  ) THEN
    CREATE TRIGGER update_payroll_items_updated_at
      BEFORE UPDATE ON payroll_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_tax_declarations_updated_at'
  ) THEN
    CREATE TRIGGER update_tax_declarations_updated_at
      BEFORE UPDATE ON tax_declarations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_form16_updated_at'
  ) THEN
    CREATE TRIGGER update_form16_updated_at
      BEFORE UPDATE ON form16
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payroll_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_payroll_settings_updated_at
      BEFORE UPDATE ON payroll_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

