import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createPool, query as dbQuery } from './db/pool.js';
import authRoutes from './routes/auth.js';
import employeesRoutes from './routes/employees.js';
import profilesRoutes from './routes/profiles.js';
import onboardingRoutes from './routes/onboarding.js';
import onboardingTrackerRoutes from './routes/onboarding-tracker.js';
import organizationsRoutes from './routes/organizations.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';
import notificationsRoutes from './routes/notifications.js';
import timesheetsRoutes from './routes/timesheets.js';
import leavePoliciesRoutes from './routes/leave-policies.js';
import leaveRequestsRoutes from './routes/leave-requests.js';
import appraisalCycleRoutes from './routes/appraisal-cycles.js';
import performanceReviewRoutes from './routes/performance-reviews.js';
import promotionsRoutes from './routes/promotions.js';
import { authenticateToken } from './middleware/auth.js';
import shiftsRoutes from './routes/shifts.js';
import workflowsRoutes from './routes/workflows.js';
import skillsRoutes from './routes/skills.js';
import projectsRoutes from './routes/projects.js';
import employeeProjectsRoutes from './routes/employee-projects.js';
import holidaysRoutes from './routes/holidays.js';
import calendarRoutes from './routes/calendar.js';
import analyticsRoutes from './routes/analytics.js';
import employeeStatsRoutes from './routes/employee-stats.js';
import migrationsRoutes from './routes/migrations.js';
import aiRoutes from './routes/ai.js';
import importsRoutes from './routes/imports.js';
import checkInOutRoutes from './routes/check-in-out.js';
import opalMiniAppsRoutes from './routes/opal-mini-apps.js';
import attendanceRoutes from './routes/attendance.js';
import payrollRoutes from './routes/payroll.js';
import backgroundChecksRoutes from './routes/background-checks.js';
import terminationsRoutes from './routes/terminations.js';
import documentsRoutes from './routes/documents.js';
import offboardingRoutes from './routes/offboarding.js';
import rehireRoutes from './routes/rehire.js';
import policiesRoutes from './routes/policies.js';
import usersRoutes from './routes/users.js';
import payrollSsoRoutes from './routes/payroll-sso.js';
import taxDeclarationsRoutes from './routes/tax-declarations.js';
import reportsRoutes from './routes/reports.js';
import { setTenantContext } from './middleware/tenant.js';
import { scheduleHolidayNotifications, scheduleNotificationRules } from './services/cron.js';
import { scheduleOffboardingJobs } from './services/offboarding-cron.js';
import { createAttendanceTables } from './utils/createAttendanceTables.js';
import { ensureAdminRole } from './utils/runMigration.js';
import { ensureOnboardingColumns } from './utils/ensureOnboardingColumns.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', authenticateToken, employeesRoutes);
app.use('/api/profiles', authenticateToken, profilesRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/timesheets', timesheetsRoutes);
app.use('/api/leave-policies', authenticateToken, setTenantContext, leavePoliciesRoutes);
app.use('/api/leave-requests', authenticateToken, leaveRequestsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shifts', authenticateToken, shiftsRoutes);
// Mount core workflow routes with auth and tenant context
app.use('/api/workflows', authenticateToken, setTenantContext, workflowsRoutes);

// Onboarding routes (no auth required for some endpoints)
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/onboarding-tracker', onboardingTrackerRoutes);
app.use('/api/appraisal-cycles', appraisalCycleRoutes);
app.use('/api/performance-reviews', performanceReviewRoutes);
app.use('/api/promotions', promotionsRoutes);
// Additional feature routes
app.use('/api/ai', aiRoutes);
app.use('/api', importsRoutes);
app.use('/api/v1', authenticateToken, setTenantContext, skillsRoutes);
app.use('/api/v1/projects', authenticateToken, setTenantContext, projectsRoutes);
app.use('/api/v1', authenticateToken, setTenantContext, employeeProjectsRoutes);
app.use('/api', authenticateToken, setTenantContext, holidaysRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/employee-stats', authenticateToken, employeeStatsRoutes);
app.use('/api/migrations', migrationsRoutes);
app.use('/api/check-in-out', checkInOutRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/opal-mini-apps', authenticateToken, setTenantContext, opalMiniAppsRoutes);
app.use('/api/payroll', authenticateToken, payrollRoutes);
app.use('/api/background-checks', authenticateToken, backgroundChecksRoutes);
app.use('/api/terminations', authenticateToken, terminationsRoutes);
app.use('/api/documents', authenticateToken, documentsRoutes);
app.use('/api/offboarding', authenticateToken, offboardingRoutes);
app.use('/api/rehire', authenticateToken, rehireRoutes);
// Multi-tenant routes
app.use('/api/orgs', organizationsRoutes);
app.use('/api/policies', authenticateToken, setTenantContext, policiesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/promotion', authenticateToken, setTenantContext, promotionsRoutes);
// Payroll SSO integration (separate from payroll routes)
app.use('/api/payroll/sso', payrollSsoRoutes);
app.use('/api/tax/declarations', taxDeclarationsRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);

// Tenant info endpoint for payroll service compatibility
app.get('/api/tenant', authenticateToken, async (req, res) => {
  try {
    const profileResult = await dbQuery(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0 || !profileResult.rows[0].tenant_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const tenantId = profileResult.rows[0].tenant_id;

    let orgQuery = `
      SELECT id, name, domain, logo_url, company_size, industry, timezone
      FROM organizations
      WHERE id = $1
    `;

    // Attempt to include slug and subdomain if columns exist
    try {
      const columnCheck = await dbQuery(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'organizations'
          AND column_name IN ('slug', 'subdomain')
      `);

      const columns = columnCheck.rows.map(row => row.column_name);

      if (columns.includes('slug') || columns.includes('subdomain')) {
        const extraColumns = [
          columns.includes('slug') ? 'slug' : null,
          columns.includes('subdomain') ? 'subdomain' : null,
        ].filter(Boolean).join(', ');

        if (extraColumns) {
          orgQuery = `
            SELECT id, name, domain, logo_url, company_size, industry, timezone, ${extraColumns}
            FROM organizations
            WHERE id = $1
          `;
        }
      }
    } catch (error) {
      // Ignore column detection errors and fall back to base columns
    }

    const orgResult = await dbQuery(orgQuery, [tenantId]);

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(orgResult.rows[0]);
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tenant info' });
  }
});

// Public discovery endpoint for AI tools (requires API key in header)
app.get('/discovery', (req, res, next) => {
  req.url = '/api/ai/discovery';
  return aiRoutes.handle(req, res, next);
});

// Initialize database pool
createPool().then(async () => {
  console.log('✅ Database connection pool created');
  
  // Ensure admin role exists in app_role enum
  try {
    await ensureAdminRole();
  } catch (error) {
    console.error('Error ensuring admin role:', error);
    console.warn('⚠️  Please manually run: ALTER TYPE app_role ADD VALUE IF NOT EXISTS \'admin\';');
  }
  
  // Ensure onboarding_data table has all required columns
  try {
    await ensureOnboardingColumns();
  } catch (error) {
    console.error('Error ensuring onboarding columns:', error);
    console.warn('⚠️  Please manually run the migration to add onboarding columns');
  }
  
  // Ensure attendance tables exist
  try {
    const tableCheck = await dbQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_events'
      );
    `);
    
    if (!tableCheck.rows[0]?.exists) {
      console.log('⚠️  Attendance tables not found. Creating tables...');
      await createAttendanceTables();
      console.log('✅ Attendance tables created');
    } else {
      console.log('✅ Attendance tables found');
    }
  } catch (error) {
    console.error('Error checking/creating attendance tables:', error);
    console.warn('⚠️  Please manually run the migration: server/db/migrations/20251103_add_attendance_system.sql');
  }
  // Ensure payments/subscriptions tables exist
  await dbQuery(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending','paid','failed','refunded');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      plan TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      period TEXT NOT NULL DEFAULT 'monthly',
      current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
      current_period_end TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status payment_status NOT NULL DEFAULT 'paid',
      period_start TIMESTAMPTZ,
      period_end TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
    
    -- Workflow execution tables
    CREATE TABLE IF NOT EXISTS workflow_instances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id UUID,
      tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'running', -- running | completed | rejected | error
      current_node_ids TEXT[] DEFAULT '{}',
      trigger_payload JSONB,
      created_by UUID REFERENCES profiles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS workflow_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
      tenant_id UUID,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      label TEXT,
      assignee_role TEXT, -- manager | hr | finance
      assignee_user_id UUID, -- optional direct assignment later
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      decision_reason TEXT,
      decided_by UUID REFERENCES profiles(id),
      decided_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_actions_tenant_pending ON workflow_actions(tenant_id) WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS workflow_logs (
      id BIGSERIAL PRIMARY KEY,
      instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  
  // Error handling middleware (should be last)
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // Schedule cron jobs
  scheduleHolidayNotifications();
  scheduleNotificationRules();
  await scheduleOffboardingJobs();
  console.log('✅ Cron jobs scheduled');

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('❌ Failed to initialize database:', error);
  process.exit(1);
});

export default app;

