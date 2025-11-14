DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reimbursement_status') THEN
    CREATE TYPE reimbursement_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'paid'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS employee_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT,
  receipt_url TEXT,
  status reimbursement_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_employee_id
  ON employee_reimbursements(employee_id);

CREATE INDEX IF NOT EXISTS idx_reimbursements_status
  ON employee_reimbursements(status);

