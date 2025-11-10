-- Create database (run this manually: CREATE DATABASE hr_suite;)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('employee', 'manager', 'hr', 'director', 'ceo');
CREATE TYPE onboarding_status AS ENUM ('pending', 'in_progress', 'completed', 'not_started');
CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'casual', 'maternity', 'paternity', 'bereavement');

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  company_size TEXT,
  industry TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  logo_url TEXT,
  company_pan TEXT,
  company_tan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  security_question_1 TEXT,
  security_answer_1 TEXT,
  security_question_2 TEXT,
  security_answer_2 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User authentication table
CREATE TABLE user_auth (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- User roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT,
  position TEXT,
  reporting_manager_id UUID REFERENCES employees(id),
  work_location TEXT,
  join_date DATE,
  status TEXT DEFAULT 'active',
  onboarding_status onboarding_status DEFAULT 'pending',
  must_change_password BOOLEAN DEFAULT true,
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add remaining tables from migration (simplified - add more as needed)
-- For now, these are the essential ones

-- Create indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payroll component types
CREATE TYPE payroll_component_type AS ENUM ('earning', 'deduction');

CREATE TABLE payroll_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  component_type payroll_component_type NOT NULL,
  is_taxable BOOLEAN NOT NULL DEFAULT true,
  is_fixed_component BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, LOWER(name))
);

CREATE TABLE employee_salary_structure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  component_id UUID REFERENCES payroll_components(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  is_taxable_override BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, component_id)
);

CREATE INDEX idx_employee_salary_structure_employee ON employee_salary_structure(employee_id);
CREATE INDEX idx_employee_salary_structure_component ON employee_salary_structure(component_id);

CREATE TABLE payroll_run_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX idx_payroll_adjustments_run ON payroll_run_adjustments(payroll_run_id);
CREATE INDEX idx_payroll_adjustments_employee ON payroll_run_adjustments(employee_id);

CREATE TABLE tax_component_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  financial_year TEXT NOT NULL,
  component_code TEXT NOT NULL,
  label TEXT NOT NULL,
  section TEXT NOT NULL,
  section_group TEXT,
  max_limit NUMERIC(12,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, financial_year, component_code)
);

CREATE INDEX idx_tax_component_definitions_tenant_year ON tax_component_definitions(tenant_id, financial_year);
CREATE INDEX idx_tax_component_definitions_group ON tax_component_definitions(section_group);

CREATE TABLE tax_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  financial_year TEXT NOT NULL,
  chosen_regime TEXT NOT NULL CHECK (chosen_regime IN ('old', 'new')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, financial_year)
);

CREATE INDEX idx_tax_declarations_tenant ON tax_declarations(tenant_id);
CREATE INDEX idx_tax_declarations_employee_year ON tax_declarations(employee_id, financial_year);

CREATE TABLE tax_declaration_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES tax_declarations(id) ON DELETE CASCADE NOT NULL,
  component_id UUID REFERENCES tax_component_definitions(id) ON DELETE CASCADE NOT NULL,
  declared_amount NUMERIC(12,2) NOT NULL CHECK (declared_amount >= 0),
  approved_amount NUMERIC(12,2) CHECK (approved_amount >= 0),
  proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (declaration_id, component_id)
);

CREATE INDEX idx_tax_declaration_items_declaration ON tax_declaration_items(declaration_id);

CREATE TABLE tax_regimes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  financial_year TEXT NOT NULL,
  regime_type TEXT NOT NULL CHECK (regime_type IN ('old', 'new')),
  slabs JSONB NOT NULL,
  standard_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  surcharge_rules JSONB DEFAULT '[]'::jsonb,
  cess_percentage NUMERIC(5,2) DEFAULT 4,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (COALESCE(tenant_id::text, 'global'), financial_year, regime_type)
);

CREATE INDEX idx_tax_regimes_tenant_year ON tax_regimes(tenant_id, financial_year);

