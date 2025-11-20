-- Migration: Add Statutory Reporting Fields
-- Date: 2025-11-18
-- Description: Adds required columns for Indian statutory compliance reports (PF ECR, ESI Return, TDS)

-- Add statutory fields to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS uan_number TEXT,
  ADD COLUMN IF NOT EXISTS esi_number TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_uan ON employees(uan_number) WHERE uan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_esi ON employees(esi_number) WHERE esi_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_pan ON employees(pan_number) WHERE pan_number IS NOT NULL;

-- Add statutory registration codes to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS pf_code TEXT,
  ADD COLUMN IF NOT EXISTS esi_code TEXT;

-- Add comments for documentation
COMMENT ON COLUMN employees.uan_number IS 'Universal Account Number for EPFO';
COMMENT ON COLUMN employees.esi_number IS 'Employee State Insurance number';
COMMENT ON COLUMN employees.pan_number IS 'Permanent Account Number for tax purposes';
COMMENT ON COLUMN organizations.pf_code IS 'EPFO Establishment Code';
COMMENT ON COLUMN organizations.esi_code IS 'ESI Registration Code';

