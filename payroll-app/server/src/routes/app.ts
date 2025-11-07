import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import PDFDocument from "pdfkit";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

export const appRouter = Router();
appRouter.get("/test", (req, res) => {
  res.json({ message: "Router is working!" });
});

// Test route without auth to verify routing works
appRouter.post("/employees-test", (req, res) => {
  console.log("[TEST ROUTE] POST /api/employees-test called");
  res.json({ message: "Test route works!", body: req.body });
});

// Debug: Log all registered routes on startup
console.log("[ROUTES] Router initialized");
console.log("[ROUTES] POST /api/employees-test registered (test route)");

// --- UPDATED HELPER FUNCTION ---
// This function is defined once and used by the auth middleware
// Payroll uses 'users' table, not 'profiles' table
async function getUserTenant(userId: string) {
  const user = await query<{ org_id: string; email: string }>(
    "SELECT org_id as tenant_id, email FROM users WHERE id = $1",
    [userId]
  );
  if (!user.rows[0]) {
    throw new Error("User not found");
  }
  return user.rows[0];
}

// Helper function to calculate LOP days and paid days for an employee in a payroll month
async function calculateLopAndPaidDays(
  tenantId: string,
  employeeId: string,
  month: number,
  year: number
): Promise<{ lopDays: number; paidDays: number; totalWorkingDays: number }> {
  // Calculate total working days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalWorkingDays = daysInMonth;

  // LOP days calculation removed - leave and attendance are handled by HR system
  // TODO: If LOP days are needed for payroll calculation, they should be fetched from HR system
  const lopDays = 0;
  
  // Calculate paid days (working days - LOP days)
  const paidDays = Math.max(0, totalWorkingDays - lopDays);

  return {
    lopDays,
    paidDays,
    totalWorkingDays
  };
}

// --- UPDATED MIDDLEWARE ---
// This middleware is now async. It verifies the user AND gets their tenant info.
// If user doesn't exist, it attempts to create them from JWT token data.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Wrap async logic to properly handle errors
  (async () => {
    try {
      const token = (req as any).cookies?.["session"];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // 1. Verify the token to get userId
      const payload = jwt.verify(token, JWT_SECRET) as any;
      const userId = payload.userId;
      (req as any).userId = userId;

      // 2. Try to fetch tenant_id and email
      let profile;
      try {
        profile = await getUserTenant(userId);
      } catch (e: any) {
        // User doesn't exist - try to create from JWT token data
        if (e.message === "User not found") {
          console.log(`[AUTH] User not found in Payroll: ${userId}, attempting to create from session`);
          
          // Try to create user from JWT payload
          const email = payload.email || null;
          const orgId = payload.orgId || payload.tenantId || null;
          const payrollRole = payload.payrollRole || 'payroll_employee';
          const hrUserId = payload.hrUserId || payload.sub || null;
          
          if (!email || !orgId) {
            console.error(`[AUTH] Cannot create user: missing email (${email}) or orgId (${orgId})`);
            return res.status(403).json({ 
              error: "User profile not found",
              message: "User does not exist in Payroll system. Please access through HR system to be auto-provisioned."
            });
          }
          
          // Create user in Payroll
          const createResult = await query(
            `INSERT INTO users (id, email, org_id, payroll_role, hr_user_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               email = COALESCE(EXCLUDED.email, users.email),
               org_id = COALESCE(EXCLUDED.org_id, users.org_id),
               payroll_role = COALESCE(EXCLUDED.payroll_role, users.payroll_role)
             RETURNING org_id as tenant_id, email`,
            [userId, email, orgId, payrollRole, hrUserId]
          );
          
          if (!createResult.rows[0]) {
            throw new Error("Failed to create user");
          }
          
          profile = createResult.rows[0];
          console.log(`✅ Created user from session: ${userId} (${email})`);
        } else {
          throw e;
        }
      }
      
      // Validate user data
      if (!profile.tenant_id) {
        console.error("[AUTH] User found but org_id (tenant_id) is null for userId:", userId);
        return res.status(403).json({ error: "User is not associated with an organization" });
      }
      if (!profile.email) {
        console.error("[AUTH] User found but email is null for userId:", userId);
        return res.status(403).json({ error: "User email not found" });
      }

      (req as any).tenantId = profile.tenant_id;
      (req as any).userEmail = profile.email;

      next();
    } catch (e: any) {
      let error = "Unauthorized";
      if (e.message === "User not found" || e.message === "Profile not found") {
        error = "User profile not found. Please sign in again.";
      } else if (e.name === "JsonWebTokenError") {
        error = "Invalid token";
      } else if (e.name === "TokenExpiredError") {
        error = "Token expired";
      }
      console.error("[AUTH] Authentication error:", e);
      return res.status(401).json({ error });
    }
  })().catch((err) => {
    console.error("[AUTH] Unexpected error in requireAuth:", err);
    res.status(500).json({ error: "Authentication error" });
  });
}

// --- ALL ENDPOINTS BELOW ARE NOW CORRECT ---
// They can safely assume (req as any).userId and (req as any).tenantId exist

appRouter.get("/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  const userEmail = (req as any).userEmail as string;
  
  // Payroll uses 'users' table, not 'profiles' table
  let result = await query(
    `SELECT 
      id,
      org_id as tenant_id, 
      email, 
      COALESCE(first_name || ' ' || last_name, email) as full_name,
      first_name,
      last_name,
      payroll_role,
      hr_user_id
    FROM users WHERE id = $1`,
    [userId]
  );
  
  // If user doesn't exist, try to create from session data
  if (!result.rows[0]) {
    console.log(`[PROFILE] User not found in Payroll: ${userId}, attempting to create from session`);
    
    // Try to get user info from JWT token (might have hr_user_id)
    const token = (req as any).cookies?.["session"];
    if (token) {
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
        const payload = jwt.verify(token, JWT_SECRET) as any;
        
        // Try to create user with minimal info from session
        // This happens if user was created but not properly synced
        const insertResult = await query(
          `INSERT INTO users (id, email, org_id, payroll_role, hr_user_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             email = COALESCE(EXCLUDED.email, users.email),
             org_id = COALESCE(EXCLUDED.org_id, users.org_id),
             payroll_role = COALESCE(EXCLUDED.payroll_role, users.payroll_role)
           RETURNING id, org_id as tenant_id, email,
             COALESCE(first_name || ' ' || last_name, email) as full_name,
             first_name, last_name, payroll_role, hr_user_id`,
          [
            userId,
            userEmail || payload.email || null,
            tenantId || payload.orgId || null,
            payload.payrollRole || 'payroll_employee',
            payload.hrUserId || null
          ]
        );
        
        result = insertResult;
        console.log(`✅ Created user profile from session: ${userId}`);
      } catch (createError: any) {
        console.error(`[PROFILE] Failed to create user from session:`, createError);
        // Continue to return 404 below
      }
    }
    
    // If still no user, return 404
    if (!result.rows[0]) {
      console.error(`[PROFILE] User not found and could not be created: ${userId}`);
      return res.status(404).json({ 
        error: 'User profile not found',
        message: 'User does not exist in Payroll system. Please access through HR system to be auto-provisioned.'
      });
    }
  }
  
  // Fetch HR role from database (user_roles table) if hr_user_id exists
  let hrRole = null;
  if (result.rows[0]?.hr_user_id) {
    try {
      // Try to get role from user_roles table directly
      const roleResult = await query(
        `SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1`,
        [result.rows[0].hr_user_id]
      );
      
      if (roleResult.rows.length > 0) {
        hrRole = roleResult.rows[0].role;
        console.log('[PROFILE] Found HR role from database:', hrRole);
      } else {
        // Fallback: Try HR API if role not found in database
        try {
          const hrApiUrl = process.env.HR_API_URL || process.env.HR_BASE_URL || 
            (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV ? 'http://api:3001' : 'http://localhost:3001');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const hrResponse = await fetch(`${hrApiUrl}/api/profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(req as any).cookies?.["session"] || ''}`,
            },
            credentials: 'include',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (hrResponse.ok) {
            const hrData = await hrResponse.json();
            hrRole = hrData?.role || hrData?.profile?.role || null;
            console.log('[PROFILE] Found HR role from API:', hrRole);
          }
        } catch (hrError: any) {
          // Silently fail - HR role is optional
          if (hrError.name !== 'AbortError' && hrError.code !== 'ECONNREFUSED') {
            console.warn('[PROFILE] Could not fetch HR role from API:', hrError.message);
          }
        }
      }
    } catch (dbError: any) {
      console.warn('[PROFILE] Could not fetch HR role from database:', dbError.message);
    }
  }
  
  // Add HR role to profile response
  const profile = result.rows[0];
  if (hrRole) {
    profile.hr_role = hrRole;
  }
  
  return res.json({ profile });
});

appRouter.get("/tenant", requireAuth, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  if (!tenantId) return res.json({ tenant: null });
  
  // Try to fetch organization from HR system first
  // In Docker, use service name 'api' instead of 'localhost'
  // For local development, use 'localhost:3001'
  const hrApiUrl = process.env.HR_API_URL || process.env.HR_BASE_URL || 
    (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV ? 'http://api:3001' : 'http://localhost:3001');
  try {
    // Get user's HR user ID to make authenticated request
    const userId = (req as any).userId as string;
    const userResult = await query(
      `SELECT hr_user_id FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows[0]?.hr_user_id) {
      // Try to fetch organization from HR system
      try {
        // Use a timeout for the HR API call to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        console.log('[TENANT] Attempting to fetch from HR API:', hrApiUrl);
        
        // HR API uses /api/organizations/me, not /current
        const hrResponse = await fetch(`${hrApiUrl}/api/organizations/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(req as any).cookies?.["session"] || ''}`,
          },
          credentials: 'include',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (hrResponse.ok) {
          const hrOrgData = await hrResponse.json();
          console.log('[TENANT] HR API response:', JSON.stringify(hrOrgData, null, 2));
          
          // HR API returns organization directly, not wrapped in 'organization' object
          // Check both structures for compatibility
          const orgData = hrOrgData?.organization || hrOrgData;
          
          if (orgData && (orgData.name || orgData.id)) {
            // Check if logo_url column exists before updating
            const columnCheck = await query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = 'organizations' 
                 AND column_name = 'logo_url'`
            );
            const hasLogoUrl = columnCheck.rows.length > 0;
            
            // Update local organization record with HR data - use INSERT ... ON CONFLICT to ensure it's created/updated
            const orgName = orgData.name || null;
            const orgLogo = orgData.logo_url || null;
            const orgSubdomain = orgData.subdomain || null;
            
            if (hasLogoUrl) {
              await query(
                `INSERT INTO organizations (org_id, company_name, logo_url, id)
                 VALUES ($1, $2, $3, gen_random_uuid())
                 ON CONFLICT (org_id) DO UPDATE SET
                   company_name = CASE 
                     WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != 'Organization' 
                     THEN EXCLUDED.company_name 
                     ELSE organizations.company_name 
                   END,
                   logo_url = COALESCE(EXCLUDED.logo_url, organizations.logo_url)`,
                [tenantId, orgName, orgLogo]
              );
            } else {
              await query(
                `INSERT INTO organizations (org_id, company_name, id)
                 VALUES ($1, $2, gen_random_uuid())
                 ON CONFLICT (org_id) DO UPDATE SET
                   company_name = CASE 
                     WHEN EXCLUDED.company_name IS NOT NULL AND EXCLUDED.company_name != 'Organization' 
                     THEN EXCLUDED.company_name 
                     ELSE organizations.company_name 
                   END`,
                [tenantId, orgName]
              );
            }
            
            // Return the updated organization data
            const updatedOrg = await query(
              `SELECT id, COALESCE(company_name, org_name, 'Organization') as company_name, 
                      org_id, subdomain${hasLogoUrl ? ', logo_url' : ', NULL as logo_url'}
               FROM organizations 
               WHERE org_id = $1`,
              [tenantId]
            );
            
            if (updatedOrg.rows[0]) {
              console.log('[TENANT] Returning updated org from database:', updatedOrg.rows[0]);
              return res.json({ 
                tenant: {
                  id: updatedOrg.rows[0].id,
                  company_name: updatedOrg.rows[0].company_name || orgName || 'Organization',
                  logo_url: updatedOrg.rows[0].logo_url || orgLogo || null,
                  org_id: tenantId,
                  subdomain: updatedOrg.rows[0].subdomain || orgSubdomain || null
                }
              });
            }
            
            // Fallback to HR data if query fails
            console.log('[TENANT] Returning HR data directly (fallback):', { orgName, orgLogo, orgSubdomain });
            return res.json({ 
              tenant: {
                id: tenantId,
                company_name: orgName || 'Organization',
                logo_url: orgLogo || null,
                org_id: tenantId,
                subdomain: orgSubdomain || null
              }
            });
          } else {
            console.warn('[TENANT] HR API returned data but no organization found:', hrOrgData);
          }
        } else {
          console.warn('[TENANT] HR API response not OK:', hrResponse.status, hrResponse.statusText);
        }
      } catch (hrError: any) {
        // Handle abort errors and connection errors gracefully
        if (hrError.name === 'AbortError') {
          console.warn('HR API request timed out after 5 seconds');
        } else if (hrError.code === 'ECONNREFUSED') {
          console.warn('HR API connection refused - HR system may not be running');
        } else {
          // Log more details about the error
          console.error('Error fetching organization from HR:', {
            message: hrError.message,
            name: hrError.name,
            code: hrError.code,
            cause: hrError.cause,
            stack: hrError.stack
          });
        }
        // Continue to fallback
      }
    }
  } catch (hrError: any) {
    console.error('Error in tenant endpoint:', hrError);
    // Continue to fallback
  }
  
  // Use payroll_organization_view for organization data (unified database)
  try {
    // Try to use payroll_organization_view first
    const tenant = await query(
      `SELECT org_id as id, company_name, org_id, domain as subdomain, logo_url
       FROM payroll_organization_view 
       WHERE org_id = $1`,
      [tenantId]
    );
    
    // If organization found, return it
    if (tenant.rows.length > 0 && tenant.rows[0].company_name) {
      console.log('[TENANT] Found organization in view:', tenant.rows[0]);
      return res.json({ tenant: tenant.rows[0] });
    }
    
    // Fallback: query organizations table directly (for INSERT operations)
    try {
      const columnCheck = await query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = 'public' 
           AND table_name = 'organizations' 
           AND column_name = 'logo_url'`
      );
      const hasLogoUrl = columnCheck.rows.length > 0;
      const logoUrlSelect = hasLogoUrl ? ', logo_url' : ', NULL as logo_url';
      
      const insertResult = await query(
        `INSERT INTO organizations (id, name, domain)
         VALUES ($1, 'Organization', 'default')
         ON CONFLICT (id) DO UPDATE SET name = COALESCE(organizations.name, 'Organization')
         RETURNING id, name as company_name, id as org_id, domain as subdomain${logoUrlSelect}`,
        [tenantId]
      );
      if (insertResult.rows.length > 0) {
        return res.json({ tenant: insertResult.rows[0] });
      }
      
      // Final fallback
      return res.json({ tenant: { id: tenantId, company_name: 'Organization', org_id: tenantId, logo_url: null } });
    } catch (createError: any) {
      // If creation fails, return a default tenant
      console.error('Error creating organization:', createError.message);
      return res.json({ 
        tenant: { 
          id: tenantId, 
          company_name: 'Organization',
          org_id: tenantId,
          logo_url: null
        } 
      });
    }
  } catch (error: any) {
    // If query fails (table doesn't exist or column doesn't exist), return default tenant
    console.error('Error fetching tenant:', error.message);
    return res.json({ 
      tenant: { 
        id: tenantId, 
        company_name: 'Organization',
        org_id: tenantId,
        logo_url: null
      } 
    });
  }
});

appRouter.get("/stats", requireAuth, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  if (!tenantId) {
    return res.json({ 
      stats: { 
        totalEmployees: 0, 
        monthlyPayroll: 0, 
        pendingApprovals: 0, 
        activeCycles: 0,
        totalNetPayable: 0,
        completedCycles: 0,
        totalAnnualPayroll: 0
      } 
    });
  }

  // Get employee count - try hr_employees_view first, fallback to employees table
  let totalEmployees = 0;
  try {
    // Use payroll_employee_view for employee count (unified database)
    const employeeCountQ = await query<{ count: string }>(
      "SELECT count(*)::text as count FROM payroll_employee_view WHERE org_id = $1 AND employment_status = 'active'",
      [tenantId]
    );
    totalEmployees = Number(employeeCountQ.rows[0]?.count || 0);
  } catch (viewError: any) {
    // If view doesn't exist, fallback to employees table
    try {
      const employeeCountQ = await query<{ count: string }>(
        "SELECT count(*)::text as count FROM employees WHERE tenant_id = $1 AND status = 'active'",
        [tenantId]
      );
      totalEmployees = Number(employeeCountQ.rows[0]?.count || 0);
    } catch (empError: any) {
      console.error('Error fetching employee count:', empError);
      totalEmployees = 0;
    }
  }

  // Get payroll cycles stats
  const cyclesQ = await query<{ total_amount: string; status: string; year: number; month: number; net_total?: string }>(
    `SELECT 
      total_amount::text, 
      status,
      year,
      month,
      (
        SELECT COALESCE(SUM(net_salary), 0)::text 
        FROM payroll_items 
        WHERE payroll_cycle_id = payroll_cycles.id AND tenant_id = $1
      ) as net_total
    FROM payroll_cycles 
    WHERE tenant_id = $1 
    ORDER BY year DESC, month DESC, created_at DESC`,
    [tenantId]
  );

  const cycles = cyclesQ.rows;
  const activeCycles = cycles.filter(c => c.status === "draft" || c.status === "processing").length;
  const pendingApprovals = cycles.filter(c => c.status === "pending_approval" || c.status === "pending").length;
  const completedCycles = cycles.filter(c => c.status === "completed" || c.status === "approved").length;
  
  // Calculate monthly payroll - use current month cycle if exists, otherwise most recent cycle with data
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();
  
  // First try to get current month's cycle (any status)
  let monthlyPayroll = 0;
  let totalNetPayable = 0;
  const currentMonthCycle = cycles.find(c => c.year === currentYear && c.month === currentMonth);
  
  if (currentMonthCycle) {
    // Use current month cycle if it has data
    monthlyPayroll = Number(currentMonthCycle.total_amount || 0);
    totalNetPayable = Number(currentMonthCycle.net_total || 0);
  } else {
    // If no current month cycle, try to calculate from payroll_items for current month
    try {
      const currentMonthPayrollQ = await query<{ total_gross: string; total_net: string }>(
        `SELECT 
          COALESCE(SUM(gross_salary), 0)::text as total_gross,
          COALESCE(SUM(net_salary), 0)::text as total_net
        FROM payroll_items pi
        JOIN payroll_cycles pc ON pc.id = pi.payroll_cycle_id
        WHERE pi.tenant_id = $1 
          AND pc.year = $2 
          AND pc.month = $3`,
        [tenantId, currentYear, currentMonth]
      );
      
      if (currentMonthPayrollQ.rows[0]) {
        monthlyPayroll = Number(currentMonthPayrollQ.rows[0].total_gross || 0);
        totalNetPayable = Number(currentMonthPayrollQ.rows[0].total_net || 0);
      } else {
        // Fallback to last completed/approved cycle
        const lastCompleted = cycles.find(c => c.status === "completed" || c.status === "approved");
        monthlyPayroll = lastCompleted ? Number(lastCompleted.total_amount || 0) : 0;
        totalNetPayable = lastCompleted ? Number(lastCompleted.net_total || 0) : 0;
      }
    } catch (payrollError: any) {
      console.error('Error calculating current month payroll:', payrollError);
      // Fallback to last completed/approved cycle
      const lastCompleted = cycles.find(c => c.status === "completed" || c.status === "approved");
      monthlyPayroll = lastCompleted ? Number(lastCompleted.total_amount || 0) : 0;
      totalNetPayable = lastCompleted ? Number(lastCompleted.net_total || 0) : 0;
    }
  }

  // Calculate total annual payroll (sum of all completed cycles this year)
  const annualCycles = cycles.filter(c => 
    (c.status === "completed" || c.status === "approved") && 
    c.year === currentYear
  );
  const totalAnnualPayroll = annualCycles.reduce((sum, cycle) => sum + Number(cycle.total_amount || 0), 0);

  return res.json({ 
    stats: { 
      totalEmployees, 
      monthlyPayroll, 
      pendingApprovals, 
      activeCycles,
      totalNetPayable,
      completedCycles,
      totalAnnualPayroll
    } 
  });
});

appRouter.get("/payroll-cycles", requireAuth, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  if (!tenantId) return res.json({ cycles: [] });
  
  // Get current month and year
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  
  // Auto-update past payroll cycles to "completed" status
  await query(
    `UPDATE payroll_cycles 
     SET status = 'completed', updated_at = NOW()
     WHERE tenant_id = $1 
       AND status != 'completed' 
       AND status != 'failed'
       AND (
         year < $2 OR 
         (year = $2 AND month < $3)
       )`,
    [tenantId, currentYear, currentMonth]
  );
  
  // Get cycles with recalculated employee counts from payroll_items
  const rows = await query(
    `SELECT 
      pc.id, 
      pc.year, 
      pc.month, 
      pc.total_amount, 
      pc.status, 
      pc.created_at,
      COALESCE(
        (SELECT COUNT(DISTINCT employee_id) 
         FROM payroll_items 
         WHERE payroll_cycle_id = pc.id AND tenant_id = $1), 
        pc.total_employees
      ) as total_employees
    FROM payroll_cycles pc 
    WHERE pc.tenant_id = $1 
    ORDER BY pc.year DESC, pc.month DESC`,
    [tenantId]
  );
  
  // Update any cycles that have incorrect employee counts
  for (const cycle of rows.rows) {
    const itemCount = await query<{ count: string }>(
      "SELECT COUNT(DISTINCT employee_id)::text as count FROM payroll_items WHERE payroll_cycle_id = $1 AND tenant_id = $2",
      [cycle.id, tenantId]
    );
    const correctCount = parseInt(itemCount.rows[0]?.count || "0", 10);
    // Update if count is different (and we have items)
    if (correctCount !== Number(cycle.total_employees) && correctCount > 0) {
      await query(
        "UPDATE payroll_cycles SET total_employees = $1 WHERE id = $2 AND tenant_id = $3",
        [correctCount, cycle.id, tenantId]
      );
      (cycle as any).total_employees = correctCount; // Update in response
    }
  }
  
  return res.json({ cycles: rows.rows });
});

appRouter.get("/employees/me", requireAuth, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  const email = (req as any).userEmail as string;
  const userId = (req as any).userId as string;

  if (!tenantId || !email) return res.json({ employee: null });
  
  // Try to use HR view first, fall back to local employees table
  let emp;
  try {
    emp = await query(
      "SELECT * FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
  } catch (viewError: any) {
    // If view doesn't exist, fall back to local employees table
    emp = await query(
      "SELECT * FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
  }

  // Note: With HR view, employee records come directly from HR system
  // No need to auto-create records - they should already exist in HR
  // If not found, it means the employee doesn't exist in HR system

  return res.json({ employee: emp.rows[0] || null });
});

appRouter.get("/payslips", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;
    
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    // First, update any past payroll cycles to "completed" status
    await query(
      `UPDATE payroll_cycles 
       SET status = 'completed', updated_at = NOW()
       WHERE tenant_id = $1 
         AND status != 'completed' 
         AND status != 'failed'
         AND (
           year < $2 OR 
           (year = $2 AND month < $3)
         )`,
      [tenantId, currentYear, currentMonth]
    );
    
    // Use payroll_employee_view for employee data (unified database)
    const emp = await query<{ id: string; date_of_joining: string }>(
      "SELECT employee_id as id, date_of_joining FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
    
    if (!emp.rows[0]) {
      return res.json({ payslips: [] });
    }
    const employeeId = emp.rows[0].id;
    const dateOfJoining = emp.rows[0].date_of_joining ? new Date(emp.rows[0].date_of_joining) : null;

    // Backfill: Process ALL employees for all past months (excluding current month)
    // This ensures payroll cycles have correct totals for all employees
    // Fetch payroll settings once
    let settings: any = {
      pf_rate: 12.0,
      esi_rate: 3.25,
      pt_rate: 200.0,
      tds_threshold: 250000.0,
      basic_salary_percentage: 40.0,
      hra_percentage: 40.0,
      special_allowance_percentage: 20.0,
    };
    try {
      const settingsResult = await query(
        "SELECT * FROM payroll_settings WHERE tenant_id = $1",
        [tenantId]
      );
      if (settingsResult.rows[0]) settings = settingsResult.rows[0];
    } catch (err) {
      console.warn("[PAYSLIPS] payroll_settings not found, using defaults");
    }

    // Get earliest joining date across all employees (not just this one)
    // Use payroll_employee_view for unified database
    const earliestJoin = await query<{ date_of_joining: string }>(
      `SELECT MIN(date_of_joining) as date_of_joining 
       FROM payroll_employee_view 
       WHERE org_id = $1 AND date_of_joining IS NOT NULL AND employment_status != 'terminated'`,
      [tenantId]
    );

    if (earliestJoin.rows[0]?.date_of_joining) {
      const startDate = new Date(earliestJoin.rows[0].date_of_joining);
      // Process only up to last month (exclude current month)
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      // Calculate last month to process (exclude current month)
      // If current month is November (11), we process up to October (10)
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const iter = new Date(start);
      while (true) {
        const y = iter.getFullYear();
        const m = iter.getMonth() + 1; // 1-12
        
        // Stop if we've reached or passed the current month
        // Strict check: if current month is November (11), lastMonth is 10, so we process up to October
        if (y > lastYear || (y === lastYear && m > lastMonth)) {
          console.log(`[PAYSLIPS] Stopping backfill - reached current month (processing up to ${lastMonth}/${lastYear}, current is ${currentMonth}/${currentYear})`);
          break;
        }
        
        // Double-check: never process the current month
        if (y === currentYear && m === currentMonth) {
          console.log(`[PAYSLIPS] Skipping current month ${m}/${y}`);
          iter.setMonth(iter.getMonth() + 1);
          continue;
        }
        
        console.log(`[PAYSLIPS] Processing month ${m}/${y}`);
        const monthEnd = new Date(y, m, 0);

        // Ensure payroll cycle exists
        let cycleId: string;
        try {
          const cycleRow = await query(
            `INSERT INTO payroll_cycles (tenant_id, month, year, status, total_employees, total_amount)
             VALUES ($1, $2, $3, 'draft', 0, 0)
             ON CONFLICT (tenant_id, month, year) DO NOTHING
             RETURNING *`,
            [tenantId, m, y]
          );
          
          if (cycleRow.rows[0]) {
            cycleId = cycleRow.rows[0].id;
          } else {
            const existing = await query<{ id: string }>(
              "SELECT id FROM payroll_cycles WHERE tenant_id = $1 AND month = $2 AND year = $3 LIMIT 1",
              [tenantId, m, y]
            );
            if (!existing.rows[0]) {
              iter.setMonth(iter.getMonth() + 1);
              continue;
            }
            cycleId = existing.rows[0].id;
          }
        } catch (err) {
          console.error("[PAYSLIPS] Failed to ensure cycle for", y, m, err);
          iter.setMonth(iter.getMonth() + 1);
          continue;
        }

        // Process ALL active employees who were employed by this month
        try {
          const allEmployees = await query<{ id: string }>(
            `SELECT employee_id as id FROM payroll_employee_view 
             WHERE org_id = $1 
               AND employment_status = 'active' 
               AND (date_of_joining IS NULL OR date_of_joining <= $2)`,
            [tenantId, monthEnd.toISOString()]
          );

          // First, get ALL existing payroll items for this cycle to count correctly
          const existingItems = await query<{ employee_id: string; gross_salary: number }>(
            "SELECT employee_id, gross_salary FROM payroll_items WHERE tenant_id = $1 AND payroll_cycle_id = $2",
            [tenantId, cycleId]
          );

          let processedCount = existingItems.rows.length; // Start with existing count
          let totalGross = existingItems.rows.reduce((sum, item) => sum + (Number(item.gross_salary) || 0), 0);

          // Track which employees already have items
          const employeesWithItems = new Set<string>(existingItems.rows.map(item => item.employee_id));

          for (const emp of allEmployees.rows) {
            // Skip if employee already has a payroll item
            if (employeesWithItems.has(emp.id)) {
              continue;
            }

            // Find compensation effective for this month
            const compResult = await query(
              `SELECT * FROM compensation_structures
               WHERE employee_id = $1 AND tenant_id = $2 AND effective_from <= $3
               ORDER BY effective_from DESC LIMIT 1`,
              [emp.id, tenantId, monthEnd.toISOString()]
            );

            if (compResult.rows.length === 0) continue;

            const c = compResult.rows[0];
            let basic = Number(c.basic_salary) || 0;
            let hra = Number(c.hra) || 0;
            let sa = Number(c.special_allowance) || 0;
            const da = Number(c.da) || 0;
            const lta = Number(c.lta) || 0;
            const bonus = Number(c.bonus) || 0;
            let gross = basic + hra + sa + da + lta + bonus;

            // Fallback from CTC if components are zero
            if (gross === 0 && c.ctc) {
              const monthlyCtc = Number(c.ctc) / 12;
              const basicPct = Number((settings as any).basic_salary_percentage || 40);
              const hraPct = Number((settings as any).hra_percentage || 40);
              const saPct = Number((settings as any).special_allowance_percentage || 20);
              basic = (monthlyCtc * basicPct) / 100;
              hra = (monthlyCtc * hraPct) / 100;
              sa = (monthlyCtc * saPct) / 100;
              gross = basic + hra + sa;
            }

            if (gross === 0) continue; // Skip if no salary

            // Calculate LOP days and paid days for this month
            const { lopDays, paidDays, totalWorkingDays } = await calculateLopAndPaidDays(
              tenantId,
              emp.id,
              m,
              y
            );

            // Adjust gross salary based on paid days (proportional deduction for LOP)
            const dailyRate = gross / totalWorkingDays;
            const adjustedGross = dailyRate * paidDays;

            // Recalculate components proportionally
            const adjustmentRatio = paidDays / totalWorkingDays;
            const adjustedBasic = basic * adjustmentRatio;
            const adjustedHra = hra * adjustmentRatio;
            const adjustedSa = sa * adjustmentRatio;

            // Calculate deductions based on adjusted gross
            const pf = (adjustedBasic * Number(settings.pf_rate)) / 100;
            const esi = adjustedGross <= 21000 ? (adjustedGross * 0.75) / 100 : 0;
            const pt = Number(settings.pt_rate) || 200;
            const annual = adjustedGross * 12;
            const tds = annual > Number(settings.tds_threshold) ? ((annual - Number(settings.tds_threshold)) * 5) / 100 / 12 : 0;
            const deductions = pf + esi + pt + tds;
            const net = adjustedGross - deductions;

            await query(
              `INSERT INTO payroll_items (
                tenant_id, payroll_cycle_id, employee_id,
                gross_salary, deductions, net_salary,
                basic_salary, hra, special_allowance,
                pf_deduction, esi_deduction, tds_deduction, pt_deduction,
                lop_days, paid_days, total_working_days
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
              ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE SET
                gross_salary = EXCLUDED.gross_salary,
                deductions = EXCLUDED.deductions,
                net_salary = EXCLUDED.net_salary,
                basic_salary = EXCLUDED.basic_salary,
                hra = EXCLUDED.hra,
                special_allowance = EXCLUDED.special_allowance,
                pf_deduction = EXCLUDED.pf_deduction,
                esi_deduction = EXCLUDED.esi_deduction,
                tds_deduction = EXCLUDED.tds_deduction,
                pt_deduction = EXCLUDED.pt_deduction,
                lop_days = EXCLUDED.lop_days,
                paid_days = EXCLUDED.paid_days,
                total_working_days = EXCLUDED.total_working_days,
                updated_at = NOW()`,
              [tenantId, cycleId, emp.id, adjustedGross, deductions, net, adjustedBasic, adjustedHra, adjustedSa, pf, esi, tds, pt, lopDays, paidDays, totalWorkingDays]
            );

            processedCount++;
            totalGross += adjustedGross;
          }

          // Update cycle totals with correct counts
          await query(
            `UPDATE payroll_cycles SET 
               status = 'completed',
               total_employees = $1,
               total_amount = $2,
               updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4`,
            [processedCount, totalGross, cycleId, tenantId]
          );
        } catch (err) {
          console.error("[PAYSLIPS] Failed to process employees for cycle", cycleId, err);
        }

        iter.setMonth(iter.getMonth() + 1);
      }
    }

    // Fetch payslips - show payslips from approved, completed, or processing cycles
    // Note: 'completed' includes past-month payrolls that were processed
    const result = await query(
      `
        SELECT
          pi.*,
          pc.month,
          pc.year,
          pc.status
        FROM payroll_items AS pi
        JOIN payroll_cycles AS pc ON pi.payroll_cycle_id = pc.id
        WHERE pi.employee_id = $1
          AND pi.tenant_id = $2
          AND pc.status IN ('approved', 'completed', 'processing')
        ORDER BY pc.year DESC, pc.month DESC
      `,
      [employeeId, tenantId]
    );

    const payslips = result.rows.map(row => ({
      ...row,
      payroll_cycles: {
        month: row.month,
        year: row.year,
        status: row.status,
      }
    }));
    
    return res.json({ payslips: payslips });

  } catch (e: any) {
    console.error("Error fetching payslips:", e);
    res.status(500).json({ error: e.message || "Failed to fetch payslips" });
  }
});

// Download payslip as PDF
// Supports both employee self-service and admin access (admin can download any payslip in their tenant)
appRouter.get("/payslips/:payslipId/pdf", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;
    const { payslipId } = req.params;

    // First, get the payslip to check if it exists and belongs to the tenant
    const payslipCheck = await query(
      "SELECT employee_id, tenant_id FROM payroll_items WHERE id = $1",
      [payslipId]
    );

    if (payslipCheck.rows.length === 0) {
      return res.status(404).json({ error: "Payslip not found" });
    }

    if (payslipCheck.rows[0].tenant_id !== tenantId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check if user is an employee (self-service) or admin
    const emp = await query<{ id: string }>(
      "SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );

    const employeeId = emp.rows[0]?.id;
    const isEmployee = !!employeeId;
    
    // If user is an employee, verify they own this payslip
    if (isEmployee && payslipCheck.rows[0].employee_id !== employeeId) {
      return res.status(403).json({ error: "You can only download your own payslips" });
    }

    // If not an employee, assume admin (they can download any payslip in their tenant)

    // Get payslip with employee and cycle details including all employee fields
    const payslipResult = await query(
      `
      SELECT 
        *,
        full_name,
        employee_code,
        email,
        designation,
        department,
        date_of_joining,
        pan_number,
        bank_account_number,
        bank_ifsc,
        bank_name,
        month,
        year,
        payday,
        company_name as tenant_name
      FROM payroll_employee_payslip_view
      WHERE payslip_id = $1 
        AND org_id = $2
      `,
      [payslipId, tenantId]
    );

    if (payslipResult.rows.length === 0) {
      return res.status(404).json({ error: "Payslip not found" });
    }

    const payslip = payslipResult.rows[0];
    const monthName = new Date(2000, payslip.month - 1).toLocaleString('en-IN', { month: 'long' });
    
    // Get LOP days and paid days from payroll_items (if available, otherwise calculate)
    const totalWorkingDays = Number(payslip.total_working_days) || new Date(payslip.year, payslip.month, 0).getDate();
    const lopDays = Number(payslip.lop_days) || 0;
    const totalPaidDays = Number(payslip.paid_days) || totalWorkingDays;

    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payslip-${payslip.employee_code}-${monthName}-${payslip.year}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to format currency (number only, no ₹ symbol for table cells)
    const formatCurrency = (amount: number) => {
      return Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    };

    // Helper to format date
    const formatDate = (date: string | Date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' });
    };

    // Calculate additional allowances from gross - (basic + hra + special)
    // These can be stored in compensation_structures or calculated
    const basic = Number(payslip.basic_salary) || 0;
    const hra = Number(payslip.hra) || 0;
    const special = Number(payslip.special_allowance) || 0;
    const gross = Number(payslip.gross_salary) || 0;
    const remaining = gross - (basic + hra + special);
    
    // Distribute remaining as other allowances (can be customized)
    const conveyanceAllowance = Math.round(remaining * 0.3); // 30% of remaining
    const cca = Math.round(remaining * 0.2); // 20% of remaining
    const medicalAllowance = Math.round(remaining * 0.15); // 15% of remaining
    const lta = Math.round(remaining * 0.15); // 15% of remaining
    const bonus = Number(payslip.bonus) || 0;

    const startY = doc.y;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);

    // ===== HEADER SECTION =====
    // Company Logo Area (left side - placeholder for logo)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#DC2626'); // Red color
    doc.text('ZARAVYA', margin, margin);
    doc.fontSize(8).font('Helvetica').fillColor('#000000');
    doc.text('INFORMATION DESTILLED', margin, margin + 20);
    
    // Company Name and Details (right side)
    const companyName = payslip.tenant_name || 'COMPANY NAME';
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
    doc.text(companyName.toUpperCase(), margin + 200, margin, { width: 300, align: 'right' });
    
    // Company Address (placeholder - can be added to tenants table)
    doc.fontSize(8).font('Helvetica');
    doc.text('Mezzenine Floor, Block D, Cyber Gateway, Hitech City,', margin + 200, margin + 20, { width: 300, align: 'right' });
    doc.text('Madhapur, Hyderabad - 500081', margin + 200, margin + 32, { width: 300, align: 'right' });
    doc.text('www.zaravya.com', margin + 200, margin + 44, { width: 300, align: 'right' });

    // Title
    doc.moveDown(3);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000');
    doc.text(`Pay Slip for the month of ${monthName} - ${payslip.year}`, { align: 'center' });
    doc.moveDown(1);

    // ===== EMPLOYEE DETAILS TABLE =====
    const tableStartY = doc.y;
    const rowHeight = 18;
    const col1Width = contentWidth / 2;
    const col2Width = contentWidth / 2;
    const numRows = 6;
    
    // Draw table borders
    doc.rect(margin, tableStartY, contentWidth, rowHeight * numRows).stroke();
    doc.moveTo(margin + col1Width, tableStartY).lineTo(margin + col1Width, tableStartY + rowHeight * numRows).stroke();
    for (let i = 1; i < numRows; i++) {
      doc.moveTo(margin, tableStartY + rowHeight * i).lineTo(margin + contentWidth, tableStartY + rowHeight * i).stroke();
    }

    // Left Column - Row 1
    doc.fontSize(9).font('Helvetica');
    doc.text('Employee No:', margin + 5, tableStartY + 3);
    doc.font('Helvetica-Bold').text(payslip.employee_code || 'N/A', margin + 80, tableStartY + 3);
    
    // Left Column - Row 2
    doc.font('Helvetica').text('Employee Name:', margin + 5, tableStartY + rowHeight + 3);
    doc.font('Helvetica-Bold').text(payslip.full_name || 'N/A', margin + 80, tableStartY + rowHeight + 3);
    
    // Left Column - Row 3
    doc.font('Helvetica').text('Designation:', margin + 5, tableStartY + rowHeight * 2 + 3);
    doc.font('Helvetica-Bold').text(payslip.designation || 'N/A', margin + 80, tableStartY + rowHeight * 2 + 3);
    
    // Left Column - Row 4
    doc.font('Helvetica').text('DOI:', margin + 5, tableStartY + rowHeight * 3 + 3);
    doc.font('Helvetica-Bold').text(formatDate(payslip.date_of_joining), margin + 80, tableStartY + rowHeight * 3 + 3);
    
    // Left Column - Row 5
    doc.font('Helvetica').text('EPF No.:', margin + 5, tableStartY + rowHeight * 4 + 3);
    doc.font('Helvetica-Bold').text('N/A', margin + 80, tableStartY + rowHeight * 4 + 3); // EPF not in schema
    
    // Left Column - Row 6
    doc.font('Helvetica').text('Total Working Days:', margin + 5, tableStartY + rowHeight * 5 + 3);
    doc.font('Helvetica-Bold').text(totalWorkingDays.toString(), margin + 80, tableStartY + rowHeight * 5 + 3);

    // Right Column - Row 1
    doc.font('Helvetica').text('PAN:', margin + col1Width + 5, tableStartY + 3);
    doc.font('Helvetica-Bold').text(payslip.pan_number || 'N/A', margin + col1Width + 60, tableStartY + 3);
    
    // Right Column - Row 2
    doc.font('Helvetica').text('Bank Name:', margin + col1Width + 5, tableStartY + rowHeight + 3);
    doc.font('Helvetica-Bold').text(payslip.bank_name || 'N/A', margin + col1Width + 60, tableStartY + rowHeight + 3);
    
    // Right Column - Row 3
    doc.font('Helvetica').text('Bank Account Number:', margin + col1Width + 5, tableStartY + rowHeight * 2 + 3);
    doc.font('Helvetica-Bold').text(payslip.bank_account_number || 'N/A', margin + col1Width + 60, tableStartY + rowHeight * 2 + 3);
    
    // Right Column - Row 4
    doc.font('Helvetica').text('Gross Salary:', margin + col1Width + 5, tableStartY + rowHeight * 3 + 3);
    doc.font('Helvetica-Bold').text(formatCurrency(gross), margin + col1Width + 60, tableStartY + rowHeight * 3 + 3);
    
    // Right Column - Row 5
    doc.font('Helvetica').text('UAN:', margin + col1Width + 5, tableStartY + rowHeight * 4 + 3);
    doc.font('Helvetica-Bold').text('N/A', margin + col1Width + 60, tableStartY + rowHeight * 4 + 3); // UAN not in schema
    
    // Right Column - Row 6
    doc.font('Helvetica').text('Total Paid Days:', margin + col1Width + 5, tableStartY + rowHeight * 5 + 3);
    doc.font('Helvetica-Bold').text(totalPaidDays.toString(), margin + col1Width + 60, tableStartY + rowHeight * 5 + 3);
    
    doc.y = tableStartY + rowHeight * numRows + 10;
    
    // "Amount in Rs." label
    doc.fontSize(9).font('Helvetica').text('Amount in Rs.', { align: 'right' });
    doc.moveDown(0.5);

    // ===== EARNINGS AND DEDUCTIONS TABLE =====
    const earningsDeductionsY = doc.y;
    const earningsColWidth = contentWidth / 2;
    const itemColWidth = earningsColWidth / 2;
    const amountColWidth = earningsColWidth / 2;
    const maxRows = Math.max(8, 8); // Max rows for earnings and deductions
    
    // Table header
    doc.rect(margin, earningsDeductionsY, earningsColWidth, 20).stroke();
    doc.rect(margin + earningsColWidth, earningsDeductionsY, earningsColWidth, 20).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('EARNINGS', margin + earningsColWidth / 2, earningsDeductionsY + 5, { width: earningsColWidth, align: 'center' });
    doc.text('DEDUCTIONS', margin + earningsColWidth + earningsColWidth / 2, earningsDeductionsY + 5, { width: earningsColWidth, align: 'center' });
    
    // Draw vertical line in middle
    doc.moveTo(margin + earningsColWidth, earningsDeductionsY).lineTo(margin + earningsColWidth, earningsDeductionsY + 20 * (maxRows + 1)).stroke();
    
    // Earnings rows
    const earningsItems = [
      { label: 'Basic Salary', amount: basic },
      { label: 'House Rent Allowance(HRA)', amount: hra },
      { label: 'Conveyance Allowance', amount: conveyanceAllowance },
      { label: 'CCA', amount: cca },
      { label: 'Medical Allowance', amount: medicalAllowance },
      { label: 'LTA', amount: lta },
      { label: 'Special Allowance', amount: special },
      { label: 'Bonus', amount: bonus },
    ];
    
    // Deductions rows
    const deductionsItems = [
      { label: 'Provident Fund', amount: Number(payslip.pf_deduction) || 0 },
      { label: 'ESI', amount: Number(payslip.esi_deduction) || 0 },
      { label: 'Professional Tax', amount: Number(payslip.pt_deduction) || 0 },
      { label: 'Income Tax (TDS)', amount: Number(payslip.tds_deduction) || 0 },
      { label: 'Medical Insurance', amount: 0 },
      { label: 'Other', amount: 0 },
    ];
    
    // Draw earnings table
    for (let i = 0; i < maxRows; i++) {
      const rowY = earningsDeductionsY + 20 + (i * 20);
      doc.rect(margin, rowY, itemColWidth, 20).stroke();
      doc.rect(margin + itemColWidth, rowY, amountColWidth, 20).stroke();
      
      if (earningsItems[i]) {
        doc.fontSize(8).font('Helvetica');
        doc.text(earningsItems[i].label, margin + 2, rowY + 5, { width: itemColWidth - 4 });
        doc.font('Helvetica-Bold');
        doc.text(formatCurrency(earningsItems[i].amount), margin + itemColWidth + 2, rowY + 5, { width: amountColWidth - 4, align: 'right' });
      }
    }
    
    // Draw deductions table
    for (let i = 0; i < maxRows; i++) {
      const rowY = earningsDeductionsY + 20 + (i * 20);
      doc.rect(margin + earningsColWidth, rowY, itemColWidth, 20).stroke();
      doc.rect(margin + earningsColWidth + itemColWidth, rowY, amountColWidth, 20).stroke();
      
      if (deductionsItems[i]) {
        doc.fontSize(8).font('Helvetica');
        doc.text(deductionsItems[i].label, margin + earningsColWidth + 2, rowY + 5, { width: itemColWidth - 4 });
        doc.font('Helvetica-Bold');
        doc.text(formatCurrency(deductionsItems[i].amount), margin + earningsColWidth + itemColWidth + 2, rowY + 5, { width: amountColWidth - 4, align: 'right' });
      }
    }
    
    // Summary section
    const summaryY = earningsDeductionsY + 20 * (maxRows + 1) + 10;
    const summaryRowHeight = 25;
    
    // Total Earnings
    doc.rect(margin, summaryY, contentWidth / 3, summaryRowHeight).stroke();
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total Earnings', margin + 5, summaryY + 8, { width: contentWidth / 3 - 10 });
    doc.text(formatCurrency(gross), margin + 5, summaryY + 8, { width: contentWidth / 3 - 10, align: 'right' });
    
    // Total Deductions
    doc.rect(margin + contentWidth / 3, summaryY, contentWidth / 3, summaryRowHeight).stroke();
    doc.text('Total Deductions', margin + contentWidth / 3 + 5, summaryY + 8, { width: contentWidth / 3 - 10 });
    const totalDeductions = Number(payslip.deductions) || 0;
    doc.text(formatCurrency(totalDeductions), margin + contentWidth / 3 + 5, summaryY + 8, { width: contentWidth / 3 - 10, align: 'right' });
    
    // Net Salary
    doc.rect(margin + (contentWidth / 3) * 2, summaryY, contentWidth / 3, summaryRowHeight).stroke();
    doc.fontSize(12);
    doc.text('Net Salary', margin + (contentWidth / 3) * 2 + 5, summaryY + 8, { width: contentWidth / 3 - 10 });
    const netSalary = Number(payslip.net_salary) || 0;
    doc.text(formatCurrency(netSalary), margin + (contentWidth / 3) * 2 + 5, summaryY + 8, { width: contentWidth / 3 - 10, align: 'right' });
    
    doc.y = summaryY + summaryRowHeight + 20;

    // ===== FOOTER =====
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica').fillColor('#666666');
    doc.text(
      'This is computer generated pay slip, does not require signature.',
      { align: 'center' }
    );
    doc.fillColor('#000000'); // Reset to black

    // Finalize PDF
    doc.end();

  } catch (e: any) {
    console.error("Error generating payslip PDF:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || "Failed to generate payslip PDF" });
    }
  }
});

appRouter.get("/tax-declarations", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;

    const emp = await query<{ id: string }>(
      "SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
    
    if (!emp.rows[0]) {
      return res.json({ declarations: [] });
    }
    const employeeId = emp.rows[0].id;

    const result = await query(
      "SELECT * FROM tax_declarations WHERE employee_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
      [employeeId, tenantId]
    );

    return res.json({ declarations: result.rows });

  } catch (e: any) {
    console.error("Error fetching tax declarations:", e);
    res.status(500).json({ error: e.message || "Failed to fetch tax declarations" });
  }
});

appRouter.post("/tax-declarations", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;
    const { financial_year, declaration_data } = req.body;

    if (!financial_year || !declaration_data) {
      return res.status(400).json({ error: "Missing financial_year or declaration_data" });
    }

    const emp = await query<{ id: string }>(
      "SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
    
    if (!emp.rows[0]) {
      return res.status(404).json({ error: "Employee record not found" });
    }
    const employeeId = emp.rows[0].id;

    const result = await query(
      `INSERT INTO tax_declarations 
        (employee_id, tenant_id, financial_year, declaration_data, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employeeId, tenantId, financial_year, declaration_data, 'submitted', new Date().toISOString()]
    );

    return res.status(201).json({ declaration: result.rows[0] });

  } catch (e: any) {
    console.error("Error creating tax declaration:", e);
    res.status(500).json({ error: e.message || "Failed to create tax declaration" });
  }
});

appRouter.get("/tax-documents", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;

    const emp = await query<{ id: string }>(
      "SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
    
    if (!emp.rows[0]) {
      return res.json({ documents: [] });
    }
    const employeeId = emp.rows[0].id;

    const result = await query(
      "SELECT * FROM tax_documents WHERE employee_id = $1 AND tenant_id = $2 ORDER BY generated_at DESC",
      [employeeId, tenantId]
    );

    return res.json({ documents: result.rows });

  } catch (e: any) {
    console.error("Error fetching tax documents:", e);
    res.status(500).json({ error: e.message || "Failed to fetch tax documents" });
  }
});

// Register POST /employees route
console.log("[ROUTES] Registering POST /employees route");
appRouter.post("/employees", requireAuth, async (req, res) => {
  console.log("[ROUTE HANDLER] POST /api/employees called"); // Debug log
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string;
    
    const {
      employee_code,
      full_name,
      email,
      phone,
      date_of_joining,
      date_of_birth,
      department,
      designation,
      status,
      pan_number,
      aadhaar_number,
      bank_account_number,
      bank_ifsc,
      bank_name,
    } = req.body;

    if (!employee_code || !full_name || !email || !date_of_joining) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const created_by = userId;
    const updated_by = userId;

    const result = await query(
      `INSERT INTO employees (
        tenant_id, employee_code, full_name, email, phone, date_of_joining, 
        date_of_birth, department, designation, status, pan_number, aadhaar_number, 
        bank_account_number, bank_ifsc, bank_name, created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *`,
      [
        tenantId, 
        employee_code, 
        full_name, 
        email, 
        phone || null, 
        date_of_joining,
        date_of_birth || null, 
        department || null, 
        designation || null, 
        status || 'active', 
        pan_number || null, 
        aadhaar_number || null, 
        bank_account_number || null, 
        bank_ifsc || null, 
        bank_name || null, 
        created_by, 
        updated_by
      ]
    );

    return res.status(201).json({ employee: result.rows[0] });

  } catch (e: any) {
    console.error("Error creating employee:", e);
    if (e?.code === '23505') {
        if (e.constraint?.includes('employee_code')) {
            return res.status(409).json({ error: "An employee with this code already exists." });
        }
        if (e.constraint?.includes('email')) { // This will likely conflict with users table, but good to have
            return res.status(409).json({ error: "An employee with this email already exists." });
        }
        return res.status(409).json({ error: "A record with this value already exists." });
    }
    res.status(500).json({ error: e.message || "Failed to create employee" });
  }
});

appRouter.get("/employees", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const searchTerm = req.query.q as string | undefined;

    // Use payroll_employee_view for unified database
    // This ensures data is always up-to-date with HR system
    // The view is created by migration: 20251107_unified_hr_payroll_schema.sql
    // Get current date for filtering latest compensation
    const now = new Date();
    const currentDate = now.toISOString();

    // Use payroll_employee_view for unified database (unified database)
    let sqlQuery = `
      SELECT 
        e.employee_id as id,
        e.employee_code,
        e.full_name,
        e.email,
        e.department,
        e.designation,
        e.employment_status as status,
        e.date_of_joining,
        e.org_id as tenant_id,
        e.user_id,
        e.first_name,
        e.last_name,
        e.phone,
        e.pan_number,
        e.uan_number,
        e.pf_number,
        e.esi_number,
        e.bank_account_number,
        e.bank_name,
        e.ifsc_code as bank_ifsc,
        e.created_at,
        e.updated_at,
        COALESCE(
          (cs.basic_salary + cs.hra + cs.special_allowance + COALESCE(cs.da, 0) + COALESCE(cs.lta, 0) + COALESCE(cs.bonus, 0)),
          0
        ) as monthly_gross_salary
      FROM payroll_employee_view e
      LEFT JOIN LATERAL (
        SELECT 
          basic_salary, hra, special_allowance, da, lta, bonus
        FROM compensation_structures
        WHERE employee_id = e.employee_id
          AND tenant_id = e.org_id
          AND effective_from <= $2
        ORDER BY effective_from DESC
        LIMIT 1
      ) cs ON true
      WHERE e.org_id = $1 AND e.employment_status != 'terminated'
    `;
    const params: any[] = [tenantId, currentDate];

    if (searchTerm) {
      sqlQuery += " AND (e.full_name ILIKE $3 OR e.email ILIKE $3 OR e.employee_code ILIKE $3)";
      params.push(`%${searchTerm}%`);
    }

    sqlQuery += " ORDER BY e.created_at DESC";

    let result;
    try {
      result = await query(sqlQuery, params);
    } catch (viewError: any) {
      // If view doesn't exist, fall back to employees table with profiles join
      console.warn(`⚠️  payroll_employee_view query failed, using employees table:`, viewError.message);
      sqlQuery = `
        SELECT 
          e.id,
          e.employee_id as employee_code,
          COALESCE(NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''), p.email) as full_name,
          p.email,
          e.department,
          e.position as designation,
          e.status,
          e.join_date as date_of_joining,
          e.tenant_id,
          e.created_at,
          e.updated_at,
          COALESCE(
            (cs.basic_salary + cs.hra + cs.special_allowance + COALESCE(cs.da, 0) + COALESCE(cs.lta, 0) + COALESCE(cs.bonus, 0)),
            0
          ) as monthly_gross_salary
        FROM employees e
        INNER JOIN profiles p ON e.user_id = p.id
        LEFT JOIN LATERAL (
          SELECT 
            basic_salary, hra, special_allowance, da, lta, bonus
          FROM compensation_structures
          WHERE employee_id = e.id
            AND tenant_id = e.tenant_id
            AND effective_from <= $2
          ORDER BY effective_from DESC
          LIMIT 1
        ) cs ON true
        WHERE e.tenant_id = $1 AND e.status != 'terminated'
      `;
      if (searchTerm) {
        sqlQuery += " AND (p.first_name ILIKE $3 OR p.last_name ILIKE $3 OR p.email ILIKE $3 OR e.employee_id ILIKE $3)";
      }
      sqlQuery += " ORDER BY e.created_at DESC";
      result = await query(sqlQuery, params);
    }
    
    return res.json({ employees: result.rows });

  } catch (e: any) {
    console.error("Error fetching employees:", e);
    res.status(500).json({ error: e.message || "Failed to fetch employees" });
  }
});

// Update employee status (e.g., mark as left/terminated)
appRouter.patch("/employees/:employeeId/status", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { employeeId } = req.params;
    const { status } = req.body as { status: string };

    const allowed = new Set(["active", "inactive", "on_leave", "terminated"]);
    if (!status || !allowed.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await query(
      `UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, employeeId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    return res.json({ employee: result.rows[0] });
  } catch (e: any) {
    console.error("Error updating employee status:", e);
    res.status(500).json({ error: e.message || "Failed to update employee status" });
  }
});

// IMPORTANT: This route must come BEFORE /employees/:employeeId/compensation
// to prevent "me" from being treated as an employeeId parameter
appRouter.get("/employees/me/compensation", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const email = (req as any).userEmail as string;

    // Validate required values
    if (!tenantId) {
      console.error("[COMPENSATION] Missing tenantId in request");
      return res.status(400).json({ error: "Tenant ID not found" });
    }
    if (!email) {
      console.error("[COMPENSATION] Missing userEmail in request");
      return res.status(400).json({ error: "User email not found" });
    }

    console.log(`[COMPENSATION] Looking up employee with tenant_id: ${tenantId}, email: ${email}`);

    const emp = await query<{ id: string }>(
      "SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1",
      [tenantId, email]
    );
    
    if (!emp.rows[0]) {
      console.log(`[COMPENSATION] No employee found for email: ${email}, tenant: ${tenantId}`);
      return res.json({ compensation: null });
    }
    const employeeId = emp.rows[0].id;
    console.log(`[COMPENSATION] Found employee_id: ${employeeId}`);

    const result = await query(
      `SELECT * FROM compensation_structures
       WHERE employee_id = $1 AND tenant_id = $2
       ORDER BY effective_from DESC
       LIMIT 1`,
      [employeeId, tenantId]
    );
    
    console.log(`[COMPENSATION] Found ${result.rows.length} compensation record(s) for employee ${employeeId}`);
    return res.json({ compensation: result.rows[0] || null });

  } catch (e: any) {
    console.error("[COMPENSATION] Error fetching employee compensation:", e);
    console.error("[COMPENSATION] Error stack:", e.stack);
    return res.status(500).json({ error: e.message || "Failed to fetch employee compensation" });
  }
});

appRouter.get("/employees/:employeeId/compensation", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { employeeId } = req.params;

    const result = await query(
      `SELECT * FROM compensation_structures 
       WHERE tenant_id = $1 AND employee_id = $2 
       ORDER BY effective_from DESC 
       LIMIT 1`,
      [tenantId, employeeId]
    );

    return res.json({ compensation: result.rows[0] || null });

  } catch (e: any) {
    console.error("Error fetching compensation:", e);
    res.status(500).json({ error: e.message || "Failed to fetch compensation" });
  }
});

appRouter.post("/employees/:employeeId/compensation", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const tenantId = (req as any).tenantId as string;
    const { employeeId } = req.params;
    
    // Check if user has HR role specifically (only HR can add salary)
    const userResult = await query(
      `SELECT payroll_role, hr_user_id FROM users WHERE id = $1 AND org_id = $2`,
      [userId, tenantId]
    );
    
    if (!userResult.rows[0] || userResult.rows[0].payroll_role !== 'payroll_admin') {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: 'Only HR can add salary information'
      });
    }

    // Verify user is actually HR role in HR system
    const hrUserId = userResult.rows[0].hr_user_id;
    if (hrUserId) {
      try {
        // In Docker, use service name 'api' instead of 'localhost'
        const hrApiUrl = process.env.HR_API_URL || process.env.HR_BASE_URL || 
          (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV ? 'http://api:3001' : 'http://localhost:3001');
        const hrResponse = await fetch(`${hrApiUrl}/api/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(req as any).cookies?.["session"] || ''}`,
          },
          credentials: 'include',
        });
        
        if (hrResponse.ok) {
          const hrUserData = await hrResponse.json();
          if (hrUserData?.role !== 'hr') {
            return res.status(403).json({ 
              error: 'Insufficient permissions',
              message: 'Only HR can add salary information'
            });
          }
        }
      } catch (hrError: any) {
        console.error('Error verifying HR role:', hrError);
        // If we can't verify, allow if payroll_role is admin (fallback)
      }
    }
    
    const {
      effective_from,
      ctc,
      basic_salary,
      hra,
      special_allowance,
      da,
      lta,
      bonus,
      pf_contribution,
      esi_contribution
    } = req.body;

    if (!effective_from || !ctc || !basic_salary) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await query(
      `INSERT INTO compensation_structures (
        tenant_id, employee_id, effective_from, ctc, basic_salary, 
        hra, special_allowance, da, lta, bonus, pf_contribution, esi_contribution,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *`,
      [
        tenantId,
        employeeId,
        effective_from,
        ctc,
        basic_salary,
        hra || 0,
        special_allowance || 0,
        da || 0,
        lta || 0,
        bonus || 0,
        pf_contribution || 0,
        esi_contribution || 0,
        userId // created_by
      ]
    );
    
    return res.status(201).json({ compensation: result.rows[0] });

  } catch (e: any) {
    console.error("Error adding compensation:", e);
    res.status(500).json({ error: e.message || "Failed to add compensation" });
  }
});

// --- FIX: All endpoints below now correctly get tenantId ---

appRouter.get("/payroll/new-cycle-data", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  if (!tenantId) {
      return res.status(403).json({ error: "User tenant not found" });
  }

  // Get month and year from query params (optional - defaults to current month)
  const month = req.query.month ? parseInt(req.query.month as string) : null;
  const year = req.query.year ? parseInt(req.query.year as string) : null;

  if (!month || !year) {
      // Default behavior: return current month data
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      // Get active employees who were employed by current month
      const { rows: countRows } = await query(
          `SELECT count(*) 
           FROM employees 
           WHERE tenant_id = $1 
             AND status = 'active'
             AND (date_of_joining IS NULL OR 
                  (EXTRACT(YEAR FROM date_of_joining) < $2 OR 
                   (EXTRACT(YEAR FROM date_of_joining) = $2 AND EXTRACT(MONTH FROM date_of_joining) <= $3)))`,
          [tenantId, currentYear, currentMonth]
      );
      const employeeCount = parseInt(countRows[0].count, 10) || 0;

      // Get total monthly compensation for employees active in current month
      const { rows: compRows } = await query(
        `SELECT SUM(cs.ctc / 12) as total
         FROM compensation_structures cs
         JOIN payroll_employee_view e ON e.employee_id = cs.employee_id
         WHERE e.org_id = $1 
           AND e.employment_status = 'active'
           AND (e.date_of_joining IS NULL OR 
                (EXTRACT(YEAR FROM e.date_of_joining) < $2 OR 
                 (EXTRACT(YEAR FROM e.date_of_joining) = $2 AND EXTRACT(MONTH FROM e.date_of_joining) <= $3)))
         AND cs.effective_from = (
             SELECT MAX(effective_from)
             FROM compensation_structures
             WHERE employee_id = e.id
               AND (EXTRACT(YEAR FROM effective_from) < $2 OR 
                    (EXTRACT(YEAR FROM effective_from) = $2 AND EXTRACT(MONTH FROM effective_from) <= $3))
         )`,
        [tenantId, currentYear, currentMonth]
      );
      const totalCompensation = parseFloat(compRows[0].total) || 0;

      return res.json({
          employeeCount,
          totalCompensation
      });
  }

  // Calculate the payroll month end date for filtering
  const payrollMonthEnd = new Date(year, month, 0); // Last day of the payroll month
  
  // Get active employees who were employed by the payroll month
  const { rows: countRows } = await query(
      `SELECT count(*) 
       FROM payroll_employee_view 
       WHERE org_id = $1 
         AND employment_status = 'active'
         AND (date_of_joining IS NULL OR date_of_joining <= $2)`,
      [tenantId, payrollMonthEnd.toISOString()]
  );
  const employeeCount = parseInt(countRows[0].count, 10) || 0;

  // Get total monthly compensation for employees active in the payroll month
  // Note: Using payroll_employee_view which maps join_date to date_of_joining
  const { rows: compRows } = await query(
    `SELECT SUM(cs.ctc / 12) as total
     FROM compensation_structures cs
     JOIN payroll_employee_view e ON e.employee_id = cs.employee_id
     WHERE e.org_id = $1 
       AND e.employment_status = 'active'
       AND (e.date_of_joining IS NULL OR e.date_of_joining <= $2)
     AND cs.effective_from = (
         SELECT MAX(effective_from)
         FROM compensation_structures
         WHERE employee_id = cs.employee_id
           AND effective_from <= $2
     )`,
    [tenantId, payrollMonthEnd.toISOString()]
  );
  const totalCompensation = parseFloat(compRows[0].total) || 0;

  res.json({
      employeeCount,
      totalCompensation
  });
});

appRouter.post("/payroll-cycles", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string; // Get from middleware
  if (!tenantId) {
      return res.status(403).json({ error: "User tenant not found" });
  }

  const { month, year, payday, employeeCount, totalCompensation } = req.body;
  if (!month || !year) {
      return res.status(400).json({ error: "Month and year are required" });
  }

  try {
      // Check if payday column exists - use a try-catch to handle any errors
      let hasPayday = false;
      try {
        const paydayCheck = await query(
          `SELECT column_name 
           FROM information_schema.columns 
           WHERE table_schema = 'public' 
             AND table_name = 'payroll_cycles' 
             AND column_name = 'payday'`
        );
        hasPayday = paydayCheck.rows.length > 0;
        console.log('[CREATE PAYROLL CYCLE] Payday column check:', hasPayday);
      } catch (checkError: any) {
        console.warn('[CREATE PAYROLL CYCLE] Error checking payday column:', checkError.message);
        hasPayday = false; // Default to false if check fails
      }
      
      // Check if tenant_id foreign key constraint exists and what it references
      let referencesTenants = false;
      try {
        const fkCheck = await query(
          `SELECT 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
            AND tc.table_name = 'payroll_cycles'
            AND kcu.column_name = 'tenant_id'`
        );
        
        const hasFkConstraint = fkCheck.rows.length > 0;
        referencesTenants = hasFkConstraint && fkCheck.rows[0]?.foreign_table_name === 'tenants';
        console.log('[CREATE PAYROLL CYCLE] FK constraint check:', { hasFkConstraint, referencesTenants });
      } catch (fkError: any) {
        console.warn('[CREATE PAYROLL CYCLE] Error checking FK constraint:', fkError.message);
      }
      
      // If foreign key references tenants table, ensure tenant exists there first
      if (referencesTenants) {
        try {
          await query(
            `INSERT INTO tenants (id, company_name, subdomain)
             VALUES ($1, 'Organization', 'default')
             ON CONFLICT (id) DO NOTHING`,
            [tenantId]
          );
        } catch (tenantError: any) {
          // If tenants table doesn't exist or insert fails, continue anyway
          console.warn('[CREATE PAYROLL CYCLE] Could not ensure tenant in tenants table:', tenantError.message);
        }
      }
      
      // Build INSERT query based on whether payday column exists
      let insertQuery: string;
      let insertValues: any[];
      
      // Double-check: if payday is provided but column doesn't exist, log warning
      if (payday && !hasPayday) {
        console.warn('[CREATE PAYROLL CYCLE] payday provided but column does not exist, ignoring payday value');
      }
      
      if (hasPayday && payday) {
        console.log('[CREATE PAYROLL CYCLE] Using INSERT with payday column, payday:', payday);
        insertQuery = `INSERT INTO payroll_cycles
           (tenant_id, created_by, month, year, payday, status, total_employees, total_amount)
           VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
           RETURNING *`;
        insertValues = [
          tenantId,
          userId,
          parseInt(month, 10),
          parseInt(year, 10),
          payday,
          employeeCount || 0,
          totalCompensation || 0
        ];
      } else {
        console.log('[CREATE PAYROLL CYCLE] Using INSERT without payday column, hasPayday:', hasPayday, 'payday provided:', !!payday);
        insertQuery = `INSERT INTO payroll_cycles
           (tenant_id, created_by, month, year, status, total_employees, total_amount)
           VALUES ($1, $2, $3, $4, 'draft', $5, $6)
           RETURNING *`;
        insertValues = [
          tenantId,
          userId,
          parseInt(month, 10),
          parseInt(year, 10),
          employeeCount || 0,
          totalCompensation || 0
        ];
      }
      
      const { rows } = await query(insertQuery, insertValues);
      const cycle = rows[0];

      // Auto-process if the cycle is for a past month so payslips are immediately available
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const isPastCycle = (cycle.year < currentYear) || (cycle.year === currentYear && cycle.month < currentMonth);

      if (!isPastCycle) {
        return res.status(201).json({ payrollCycle: cycle });
      }

      // PROCESS IMMEDIATELY: generate payroll items for eligible employees and mark cycle completed
      const payrollMonthEnd = new Date(cycle.year, cycle.month, 0);

      // Fetch payroll settings
      const settingsResult = await query(
        "SELECT * FROM payroll_settings WHERE tenant_id = $1",
        [tenantId]
      );
      const settings = settingsResult.rows[0] || {
        pf_rate: 12.0,
        esi_rate: 3.25,
        pt_rate: 200.0,
        tds_threshold: 250000.0,
      };

      // Get all active employees who were employed by the payroll month
      const employeesResult = await query(
        `SELECT e.id
         FROM employees e
         WHERE e.tenant_id = $1
           AND e.status = 'active'
           AND (e.date_of_joining IS NULL OR e.date_of_joining <= $2)`,
        [tenantId, payrollMonthEnd.toISOString()]
      );

      let processedCount = 0;
      let totalGrossSalary = 0;
      let totalDeductions = 0;

      for (const emp of employeesResult.rows) {
        const compResult = await query(
          `SELECT * FROM compensation_structures
           WHERE employee_id = $1 AND tenant_id = $2 AND effective_from <= $3
           ORDER BY effective_from DESC LIMIT 1`,
          [emp.id, tenantId, payrollMonthEnd.toISOString()]
        );
        if (compResult.rows.length === 0) continue;

        const c = compResult.rows[0];
        let basic = Number(c.basic_salary) || 0;
        let hra = Number(c.hra) || 0;
        let sa = Number(c.special_allowance) || 0;
        const da = Number(c.da) || 0;
        const lta = Number(c.lta) || 0;
        const bonus = Number(c.bonus) || 0;
        let gross = basic + hra + sa + da + lta + bonus;

        // Fallback: if monthly components are zero but CTC exists, derive from CTC using settings
        if (gross === 0 && c.ctc) {
          const monthlyCtc = Number(c.ctc) / 12;
          const basicPct = Number((settings as any).basic_salary_percentage || 40);
          const hraPct = Number((settings as any).hra_percentage || 40);
          const saPct = Number((settings as any).special_allowance_percentage || 20);
          basic = (monthlyCtc * basicPct) / 100;
          hra = (monthlyCtc * hraPct) / 100;
          sa = (monthlyCtc * saPct) / 100;
          gross = basic + hra + sa; // DA/LTA/Bonus remain 0 in fallback
        }

        // Calculate LOP days and paid days for this month
        const { lopDays, paidDays, totalWorkingDays } = await calculateLopAndPaidDays(
          tenantId,
          emp.id,
          cycle.month,
          cycle.year
        );

        // Adjust gross salary based on paid days (proportional deduction for LOP)
        const dailyRate = gross / totalWorkingDays;
        const adjustedGross = dailyRate * paidDays;

        // Recalculate components proportionally
        const adjustmentRatio = paidDays / totalWorkingDays;
        const adjustedBasic = basic * adjustmentRatio;
        const adjustedHra = hra * adjustmentRatio;
        const adjustedSa = sa * adjustmentRatio;

        // Calculate deductions based on adjusted gross
        const pf = (adjustedBasic * Number(settings.pf_rate)) / 100;
        const esi = adjustedGross <= 21000 ? (adjustedGross * 0.75) / 100 : 0;
        const pt = Number(settings.pt_rate) || 200;
        const annual = adjustedGross * 12;
        const tds = annual > Number(settings.tds_threshold) ? ((annual - Number(settings.tds_threshold)) * 5) / 100 / 12 : 0;
        const deductions = pf + esi + pt + tds;
        const net = adjustedGross - deductions;

        await query(
          `INSERT INTO payroll_items (
            tenant_id, payroll_cycle_id, employee_id,
            gross_salary, deductions, net_salary,
            basic_salary, hra, special_allowance,
            pf_deduction, esi_deduction, tds_deduction, pt_deduction,
            lop_days, paid_days, total_working_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE SET
            gross_salary = EXCLUDED.gross_salary,
            deductions = EXCLUDED.deductions,
            net_salary = EXCLUDED.net_salary,
            basic_salary = EXCLUDED.basic_salary,
            hra = EXCLUDED.hra,
            special_allowance = EXCLUDED.special_allowance,
            pf_deduction = EXCLUDED.pf_deduction,
            esi_deduction = EXCLUDED.esi_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            lop_days = EXCLUDED.lop_days,
            paid_days = EXCLUDED.paid_days,
            total_working_days = EXCLUDED.total_working_days,
            updated_at = NOW()`,
          [
            tenantId,
            cycle.id,
            emp.id,
            adjustedGross,
            deductions,
            net,
            adjustedBasic,
            adjustedHra,
            adjustedSa,
            pf,
            esi,
            tds,
            pt,
            lopDays,
            paidDays,
            totalWorkingDays,
          ]
        );

        processedCount += 1;
        totalGrossSalary += adjustedGross;
        totalDeductions += deductions;
      }

      // Mark cycle as completed (past month) with totals (gross)
      await query(
        `UPDATE payroll_cycles
         SET status = 'completed',
             total_employees = $1,
             total_amount = $2,
             updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [processedCount, totalGrossSalary, cycle.id, tenantId]
      );

      return res.status(201).json({ payrollCycle: { ...cycle, status: 'completed', total_employees: processedCount, total_amount: totalGrossSalary } });
  } catch (e: any) {
      console.error('[CREATE PAYROLL CYCLE] Error:', e);
      if (e.code === '23505') { // unique_violation
          return res.status(409).json({ 
            error: "A payroll cycle for this month and year already exists.",
            message: "A payroll cycle for this month and year already exists."
          });
      }
      if (e.code === '23503') { // foreign_key_violation
          return res.status(400).json({ 
            error: "Invalid reference",
            message: e.message || "Invalid tenant or user reference."
          });
      }
      if (e.code === '23514') { // check_violation
          return res.status(400).json({ 
            error: "Invalid data",
            message: e.message || "Invalid month or year value."
          });
      }
      return res.status(500).json({ 
        error: "Failed to create payroll cycle",
        message: e.message || "An unexpected error occurred while creating the payroll cycle."
      });
  }
});

// Get all payslips for a payroll cycle (for administrators)
appRouter.get("/payroll-cycles/:cycleId/payslips", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { cycleId } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: "User tenant not found" });
    }

    // Get payroll cycle to verify it belongs to tenant
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    // Get all payslips for this cycle
    const payslipsResult = await query(
      `
      SELECT 
        pi.*,
        e.full_name,
        e.employee_code,
        e.email,
        e.designation,
        e.department,
        pc.month,
        pc.year,
        pc.status as cycle_status
      FROM payroll_items pi
      JOIN payroll_employee_view e ON e.employee_id = pi.employee_id
      JOIN payroll_cycles pc ON pi.payroll_cycle_id = pc.id
      WHERE pi.payroll_cycle_id = $1 
        AND pi.tenant_id = $2
      ORDER BY e.full_name ASC
      `,
      [cycleId, tenantId]
    );

    const payslips = payslipsResult.rows.map(row => ({
      ...row,
      payroll_cycles: {
        month: row.month,
        year: row.year,
        status: row.cycle_status,
      }
    }));

    return res.json({ payslips });
  } catch (e: any) {
    console.error("Error fetching payslips for cycle:", e);
    res.status(500).json({ error: e.message || "Failed to fetch payslips" });
  }
});

// Preview payroll - calculate salaries for all eligible employees (before processing)
appRouter.get("/payroll-cycles/:cycleId/preview", requireAuth, async (req, res) => {
  const tenantId = (req as any).tenantId as string;
  const { cycleId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "User tenant not found" });
  }

  try {
    // Get payroll cycle
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleResult.rows[0];

    // Allow preview for draft, pending_approval, approved, processing, and completed cycles
    if (!['draft', 'pending_approval', 'approved', 'processing', 'completed'].includes(cycle.status)) {
      return res.status(400).json({ 
        error: `Cannot preview payroll. Current status is '${cycle.status}'.` 
      });
    }

    const payrollMonth = cycle.month;
    const payrollYear = cycle.year;
    const payrollMonthEnd = new Date(payrollYear, payrollMonth, 0);

    // Get payroll settings
    const settingsResult = await query(
      "SELECT * FROM payroll_settings WHERE tenant_id = $1",
      [tenantId]
    );
    
    const settings = settingsResult.rows[0] || {
      pf_rate: 12.00,
      esi_rate: 3.25,
      pt_rate: 200.00,
      tds_threshold: 250000.00,
    };

    // Get all active employees who were employed by the payroll month
    const employeesResult = await query(
      `SELECT e.id, e.full_name, e.email, e.employee_code
       FROM employees e
       WHERE e.tenant_id = $1 
         AND e.status = 'active'
         AND (e.date_of_joining IS NULL OR e.date_of_joining <= $2)
       ORDER BY e.date_of_joining ASC`,
      [tenantId, payrollMonthEnd.toISOString()]
    );

    const employees = employeesResult.rows;
    const payrollItems: any[] = [];

    // Calculate salary for each employee
    for (const employee of employees) {
      // Get the latest compensation structure effective for the payroll month
      const compResult = await query(
        `SELECT * FROM compensation_structures
         WHERE employee_id = $1 
           AND tenant_id = $2
           AND effective_from <= $3
         ORDER BY effective_from DESC
         LIMIT 1`,
        [employee.id, tenantId, payrollMonthEnd.toISOString()]
      );

      if (compResult.rows.length === 0) {
        continue;
      }

      const compensation = compResult.rows[0];
      
      // All amounts are monthly
      const monthlyBasic = Number(compensation.basic_salary) || 0;
      const monthlyHRA = Number(compensation.hra) || 0;
      const monthlySpecialAllowance = Number(compensation.special_allowance) || 0;
      const monthlyDA = Number(compensation.da) || 0;
      const monthlyLTA = Number(compensation.lta) || 0;
      const monthlyBonus = Number(compensation.bonus) || 0;

      // Gross salary = sum of all monthly earnings
      const grossSalary = monthlyBasic + monthlyHRA + monthlySpecialAllowance + monthlyDA + monthlyLTA + monthlyBonus;

      // Calculate LOP days and paid days for this month
      const { lopDays, paidDays, totalWorkingDays } = await calculateLopAndPaidDays(
        tenantId,
        employee.id,
        payrollMonth,
        payrollYear
      );

      // Adjust gross salary based on paid days (proportional deduction for LOP)
      const dailyRate = grossSalary / totalWorkingDays;
      const adjustedGrossSalary = dailyRate * paidDays;

      // Recalculate components proportionally
      const adjustmentRatio = paidDays / totalWorkingDays;
      const adjustedBasic = monthlyBasic * adjustmentRatio;
      const adjustedHRA = monthlyHRA * adjustmentRatio;
      const adjustedSpecialAllowance = monthlySpecialAllowance * adjustmentRatio;
      const adjustedDA = monthlyDA * adjustmentRatio;
      const adjustedLTA = monthlyLTA * adjustmentRatio;
      const adjustedBonus = monthlyBonus * adjustmentRatio;

      // Calculate deductions based on adjusted gross
      const pfDeduction = (adjustedBasic * Number(settings.pf_rate)) / 100;
      const esiDeduction = adjustedGrossSalary <= 21000 ? (adjustedGrossSalary * 0.75) / 100 : 0;
      const ptDeduction = Number(settings.pt_rate) || 200;
      
      const annualIncome = adjustedGrossSalary * 12;
      let tdsDeduction = 0;
      if (annualIncome > Number(settings.tds_threshold)) {
        const excessAmount = annualIncome - Number(settings.tds_threshold);
        tdsDeduction = (excessAmount * 5) / 100 / 12;
      }

      const totalDeductions = pfDeduction + esiDeduction + ptDeduction + tdsDeduction;
      const netSalary = adjustedGrossSalary - totalDeductions;

      payrollItems.push({
        employee_id: employee.id,
        employee_code: employee.employee_code,
        employee_name: employee.full_name,
        employee_email: employee.email,
        basic_salary: adjustedBasic,
        hra: adjustedHRA,
        special_allowance: adjustedSpecialAllowance,
        da: adjustedDA,
        lta: adjustedLTA,
        bonus: adjustedBonus,
        gross_salary: adjustedGrossSalary,
        pf_deduction: pfDeduction,
        esi_deduction: esiDeduction,
        pt_deduction: ptDeduction,
        tds_deduction: tdsDeduction,
        deductions: totalDeductions,
        net_salary: netSalary,
        lop_days: lopDays,
        paid_days: paidDays,
        total_working_days: totalWorkingDays,
      });
    }

    return res.json({ payrollItems });

  } catch (e: any) {
    console.error("Error previewing payroll:", e);
    return res.status(500).json({ error: e.message || "Failed to preview payroll" });
  }
});

// Submit payroll for approval (draft -> pending_approval)
appRouter.post("/payroll-cycles/:cycleId/submit", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  const { cycleId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "User tenant not found" });
  }

  try {
    // Get payroll cycle
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleResult.rows[0];

    // Only allow submission from draft status
    if (cycle.status !== 'draft') {
      return res.status(400).json({ 
        error: `Cannot submit payroll. Current status is '${cycle.status}'. Only 'draft' payroll can be submitted for approval.` 
      });
    }

    // Check if payroll items exist
    const itemsResult = await query(
      "SELECT COUNT(*)::text as count FROM payroll_items WHERE payroll_cycle_id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    const itemsCount = parseInt(itemsResult.rows[0]?.count || '0', 10);
    if (itemsCount === 0) {
      return res.status(400).json({ 
        error: "Cannot submit payroll. No payroll items found. Please process the payroll first." 
      });
    }

    // Update cycle status to pending_approval
    const updateResult = await query(
      `UPDATE payroll_cycles
       SET status = 'pending_approval',
           submitted_by = $1,
           submitted_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, cycleId, tenantId]
    );

    return res.status(200).json({ 
      message: "Payroll submitted for approval successfully",
      payrollCycle: updateResult.rows[0]
    });
  } catch (e: any) {
    console.error("Error submitting payroll for approval:", e);
    return res.status(500).json({ error: e.message || "Failed to submit payroll for approval" });
  }
});

// Approve payroll (pending_approval -> approved)
appRouter.post("/payroll-cycles/:cycleId/approve", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  const { cycleId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "User tenant not found" });
  }

  try {
    // Get payroll cycle
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleResult.rows[0];

    // Only allow approval from pending_approval status
    if (cycle.status !== 'pending_approval') {
      return res.status(400).json({ 
        error: `Cannot approve payroll. Current status is '${cycle.status}'. Only 'pending_approval' payroll can be approved.` 
      });
    }

    // Update cycle status to approved
    const updateResult = await query(
      `UPDATE payroll_cycles
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, cycleId, tenantId]
    );

    return res.status(200).json({ 
      message: "Payroll approved successfully",
      payrollCycle: updateResult.rows[0]
    });
  } catch (e: any) {
    console.error("Error approving payroll:", e);
    return res.status(500).json({ error: e.message || "Failed to approve payroll" });
  }
});

// Reject/Return payroll (pending_approval -> draft)
appRouter.post("/payroll-cycles/:cycleId/reject", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  const { cycleId } = req.params;
  const { rejectionReason } = req.body;

  if (!tenantId) {
    return res.status(403).json({ error: "User tenant not found" });
  }

  try {
    // Get payroll cycle
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleResult.rows[0];

    // Only allow rejection from pending_approval status
    if (cycle.status !== 'pending_approval') {
      return res.status(400).json({ 
        error: `Cannot reject payroll. Current status is '${cycle.status}'. Only 'pending_approval' payroll can be rejected.` 
      });
    }

    // Update cycle status back to draft
    const updateResult = await query(
      `UPDATE payroll_cycles
       SET status = 'draft',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [userId, rejectionReason || null, cycleId, tenantId]
    );

    return res.status(200).json({ 
      message: "Payroll rejected and returned to draft",
      payrollCycle: updateResult.rows[0]
    });
  } catch (e: any) {
    console.error("Error rejecting payroll:", e);
    return res.status(500).json({ error: e.message || "Failed to reject payroll" });
  }
});

// Process payroll - generate payslips for all eligible employees (accepts edited items)
// Now only works with approved cycles
appRouter.post("/payroll-cycles/:cycleId/process", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const tenantId = (req as any).tenantId as string;
  const { cycleId } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: "User tenant not found" });
  }

  try {
    // Get payroll cycle
    const cycleResult = await query(
      "SELECT * FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleResult.rows[0];

    // Only allow processing of approved cycles
    if (cycle.status !== 'approved') {
      return res.status(400).json({ 
        error: `Cannot process payroll. Current status is '${cycle.status}'. Only 'approved' payroll can be processed. Please approve the payroll first.` 
      });
    }
    const payrollMonth = cycle.month;
    const payrollYear = cycle.year;
    const payrollMonthEnd = new Date(payrollYear, payrollMonth, 0); // Last day of the payroll month

    // Get payroll settings
    const settingsResult = await query(
      "SELECT * FROM payroll_settings WHERE tenant_id = $1",
      [tenantId]
    );
    
    const settings = settingsResult.rows[0] || {
      pf_rate: 12.00,
      esi_rate: 3.25,
      pt_rate: 200.00,
      tds_threshold: 250000.00,
    };

    // Get all active employees who were employed by the payroll month
    const employeesResult = await query(
      `SELECT e.id, e.full_name, e.email
       FROM employees e
       WHERE e.tenant_id = $1 
         AND e.status = 'active'
         AND (e.date_of_joining IS NULL OR e.date_of_joining <= $2)
       ORDER BY e.date_of_joining ASC`,
      [tenantId, payrollMonthEnd.toISOString()]
    );

      // Check if edited payroll items are provided in request body
      const { payrollItems: editedItems } = req.body;

      // If edited items are provided, use them; otherwise calculate fresh
      if (editedItems && Array.isArray(editedItems) && editedItems.length > 0) {
        // For approved cycles, prevent modifications to payroll items
        // Once approved, payroll items should not be changed
        if (cycle.status === 'approved') {
          // Check if any items have changed
          const existingItemsResult = await query(
            "SELECT employee_id, gross_salary, basic_salary, hra, special_allowance FROM payroll_items WHERE payroll_cycle_id = $1 AND tenant_id = $2",
            [cycleId, tenantId]
          );
          
          // If items exist and are approved, don't allow edits - just process as-is
          if (existingItemsResult.rows.length > 0) {
            // Calculate totals from existing items
            let processedCount = 0;
            let totalGrossSalary = 0;
            let totalDeductions = 0;
            
            for (const existingItem of existingItemsResult.rows) {
              processedCount++;
              totalGrossSalary += Number(existingItem.gross_salary || 0);
              // Get deductions from existing item
              const itemDeductions = await query(
                "SELECT deductions FROM payroll_items WHERE payroll_cycle_id = $1 AND employee_id = $2 AND tenant_id = $3",
                [cycleId, existingItem.employee_id, tenantId]
              );
              totalDeductions += Number(itemDeductions.rows[0]?.deductions || 0);
            }

            // Update cycle status to processing
            await query(
              `UPDATE payroll_cycles
               SET status = 'processing',
                   total_employees = $1,
                   total_amount = $2,
                   updated_at = NOW()
               WHERE id = $3 AND tenant_id = $4`,
              [processedCount, totalGrossSalary, cycleId, tenantId]
            );

            return res.status(200).json({
              message: `Payroll processed successfully for ${processedCount} employees (approved payroll - no changes allowed)`,
              processedCount,
              totalGrossSalary,
              totalDeductions,
              totalNetSalary: totalGrossSalary - totalDeductions,
            });
          }
        }

        // Use the edited items provided (for draft cycles only)
        let processedCount = 0;
        let totalGrossSalary = 0;
        let totalDeductions = 0;

        for (const item of editedItems) {
        const {
          employee_id,
          basic_salary,
          hra,
          special_allowance,
          da = 0,
          lta = 0,
          bonus = 0,
          lop_days,
          paid_days,
          total_working_days,
        } = item;

        // If LOP days are provided, use them; otherwise calculate
        let finalLopDays: number;
        let finalPaidDays: number;
        let finalTotalWorkingDays: number;

        if (lop_days !== undefined && paid_days !== undefined && total_working_days !== undefined) {
          // Use provided values
          finalLopDays = Number(lop_days);
          finalPaidDays = Number(paid_days);
          finalTotalWorkingDays = Number(total_working_days);
        } else {
          // Calculate from database
          const calculated = await calculateLopAndPaidDays(tenantId, employee_id, payrollMonth, payrollYear);
          finalLopDays = calculated.lopDays;
          finalPaidDays = calculated.paidDays;
          finalTotalWorkingDays = calculated.totalWorkingDays;
        }

        // Recalculate gross salary from edited components
        const editedGrossSalary = Number(basic_salary) + Number(hra) + Number(special_allowance) + Number(da) + Number(lta) + Number(bonus);

        // Recalculate deductions based on edited values
        const editedPfDeduction = (Number(basic_salary) * Number(settings.pf_rate)) / 100;
        const editedEsiDeduction = editedGrossSalary <= 21000 ? (editedGrossSalary * 0.75) / 100 : 0;
        const editedPtDeduction = Number(settings.pt_rate) || 200;
        
        const annualIncome = editedGrossSalary * 12;
        let editedTdsDeduction = 0;
        if (annualIncome > Number(settings.tds_threshold)) {
          const excessAmount = annualIncome - Number(settings.tds_threshold);
          editedTdsDeduction = (excessAmount * 5) / 100 / 12;
        }

        const calculatedDeductions = editedPfDeduction + editedEsiDeduction + editedPtDeduction + editedTdsDeduction;
        const netSalary = editedGrossSalary - calculatedDeductions;

        // Insert or update payroll item with edited values
        // Only allow updates for draft cycles - approved/processing cycles are locked
        const cycleStatusCheck = await query(
          "SELECT status FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
          [cycleId, tenantId]
        );
        
        if (cycleStatusCheck.rows.length > 0) {
          const currentStatus = cycleStatusCheck.rows[0].status;
          if (['approved', 'processing', 'completed'].includes(currentStatus)) {
            return res.status(400).json({ 
              error: `Cannot modify payroll items. Current status is '${currentStatus}'. Only 'draft' or 'pending_approval' payroll can be modified.` 
            });
          }
        }

        await query(
          `INSERT INTO payroll_items (
            tenant_id, payroll_cycle_id, employee_id,
            gross_salary, deductions, net_salary,
            basic_salary, hra, special_allowance,
            pf_deduction, esi_deduction, tds_deduction, pt_deduction,
            lop_days, paid_days, total_working_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE SET
            gross_salary = EXCLUDED.gross_salary,
            deductions = EXCLUDED.deductions,
            net_salary = EXCLUDED.net_salary,
            basic_salary = EXCLUDED.basic_salary,
            hra = EXCLUDED.hra,
            special_allowance = EXCLUDED.special_allowance,
            pf_deduction = EXCLUDED.pf_deduction,
            esi_deduction = EXCLUDED.esi_deduction,
            tds_deduction = EXCLUDED.tds_deduction,
            pt_deduction = EXCLUDED.pt_deduction,
            lop_days = EXCLUDED.lop_days,
            paid_days = EXCLUDED.paid_days,
            total_working_days = EXCLUDED.total_working_days,
            updated_at = NOW()`,
          [
            tenantId,
            cycleId,
            employee_id,
            editedGrossSalary,
            calculatedDeductions,
            netSalary,
            Number(basic_salary),
            Number(hra),
            Number(special_allowance),
            editedPfDeduction,
            editedEsiDeduction,
            editedTdsDeduction,
            editedPtDeduction,
            finalLopDays,
            finalPaidDays,
            finalTotalWorkingDays,
          ]
        );

        processedCount++;
        totalGrossSalary += editedGrossSalary;
        totalDeductions += calculatedDeductions;
      }

      // Update payroll cycle with processed data
      await query(
        `UPDATE payroll_cycles
         SET status = 'processing',
             total_employees = $1,
             total_amount = $2,
             updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [processedCount, totalGrossSalary, cycleId, tenantId]
      );

      return res.status(200).json({
        message: `Payroll processed successfully for ${processedCount} employees`,
        processedCount,
        totalGrossSalary,
        totalDeductions,
        totalNetSalary: totalGrossSalary - totalDeductions,
      });
    }

    // Original logic: calculate fresh (for backward compatibility)
    // For approved cycles, items should already exist - skip processing
    if (cycle.status === 'approved') {
      const existingItemsResult = await query(
        "SELECT COUNT(*)::text as count, SUM(gross_salary)::text as total_gross, SUM(deductions)::text as total_deductions FROM payroll_items WHERE payroll_cycle_id = $1 AND tenant_id = $2",
        [cycleId, tenantId]
      );
      
      if (existingItemsResult.rows.length > 0 && parseInt(existingItemsResult.rows[0]?.count || '0', 10) > 0) {
        const processedCount = parseInt(existingItemsResult.rows[0]?.count || '0', 10);
        const totalGrossSalary = parseFloat(existingItemsResult.rows[0]?.total_gross || '0');
        const totalDeductions = parseFloat(existingItemsResult.rows[0]?.total_deductions || '0');

        await query(
          `UPDATE payroll_cycles
           SET status = 'processing',
               total_employees = $1,
               total_amount = $2,
               updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [processedCount, totalGrossSalary, cycleId, tenantId]
        );

        return res.status(200).json({
          message: `Payroll processed successfully for ${processedCount} employees (approved payroll - using existing items)`,
          processedCount,
          totalGrossSalary,
          totalDeductions,
          totalNetSalary: totalGrossSalary - totalDeductions,
        });
      }
    }

    const employees = employeesResult.rows;
    let processedCount = 0;
    let totalGrossSalary = 0;
    let totalDeductions = 0;

    // Process each employee
    for (const employee of employees) {
      // Get the latest compensation structure effective for the payroll month
      const compResult = await query(
        `SELECT * FROM compensation_structures
         WHERE employee_id = $1 
           AND tenant_id = $2
           AND effective_from <= $3
         ORDER BY effective_from DESC
         LIMIT 1`,
        [employee.id, tenantId, payrollMonthEnd.toISOString()]
      );

      if (compResult.rows.length === 0) {
        console.warn(`No compensation found for employee ${employee.id}`);
        continue;
      }

      const compensation = compResult.rows[0];
      
      // All amounts are monthly (except CTC which is annual but not used in payroll calculation)
      const monthlyBasic = Number(compensation.basic_salary) || 0;
      const monthlyHRA = Number(compensation.hra) || 0;
      const monthlySpecialAllowance = Number(compensation.special_allowance) || 0;
      const monthlyDA = Number(compensation.da) || 0;
      const monthlyLTA = Number(compensation.lta) || 0; // Already monthly
      const monthlyBonus = Number(compensation.bonus) || 0; // Already monthly

      // Gross salary = sum of all monthly earnings
      const grossSalary = monthlyBasic + monthlyHRA + monthlySpecialAllowance + monthlyDA + monthlyLTA + monthlyBonus;

      // Calculate LOP days and paid days for this month
      const { lopDays, paidDays, totalWorkingDays } = await calculateLopAndPaidDays(
        tenantId,
        employee.id,
        payrollMonth,
        payrollYear
      );

      // Adjust gross salary based on paid days (proportional deduction for LOP)
      const dailyRate = grossSalary / totalWorkingDays;
      const adjustedGrossSalary = dailyRate * paidDays;

      // Recalculate components proportionally
      const adjustmentRatio = paidDays / totalWorkingDays;
      const adjustedBasic = monthlyBasic * adjustmentRatio;
      const adjustedHRA = monthlyHRA * adjustmentRatio;
      const adjustedSpecialAllowance = monthlySpecialAllowance * adjustmentRatio;

      // Calculate deductions based on adjusted gross
      // PF: 12% of basic (employee contribution)
      const pfDeduction = (adjustedBasic * Number(settings.pf_rate)) / 100;
      
      // ESI: 0.75% of gross if gross <= 21000 (employee contribution)
      const esiDeduction = adjustedGrossSalary <= 21000 ? (adjustedGrossSalary * 0.75) / 100 : 0;
      
      // Professional Tax: Fixed amount from settings
      const ptDeduction = Number(settings.pt_rate) || 200;
      
      // TDS: Calculate based on annual income (simplified - 5% if annual > threshold)
      const annualIncome = adjustedGrossSalary * 12;
      let tdsDeduction = 0;
      if (annualIncome > Number(settings.tds_threshold)) {
        // Simplified TDS calculation - 5% of excess over threshold
        const excessAmount = annualIncome - Number(settings.tds_threshold);
        tdsDeduction = (excessAmount * 5) / 100 / 12; // Monthly TDS
      }

      const totalDeductionsForEmployee = pfDeduction + esiDeduction + ptDeduction + tdsDeduction;
      const netSalary = adjustedGrossSalary - totalDeductionsForEmployee;

      // Insert payroll item
      // Only allow inserts/updates for draft and pending_approval cycles
      // Approved/processing/completed cycles are locked
      if (['approved', 'processing', 'completed'].includes(cycle.status)) {
        // Skip this employee - cannot modify approved payroll
        continue;
      }

      await query(
        `INSERT INTO payroll_items (
          tenant_id, payroll_cycle_id, employee_id,
          gross_salary, deductions, net_salary,
          basic_salary, hra, special_allowance,
          pf_deduction, esi_deduction, tds_deduction, pt_deduction,
          lop_days, paid_days, total_working_days
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (payroll_cycle_id, employee_id) DO UPDATE SET
          gross_salary = EXCLUDED.gross_salary,
          deductions = EXCLUDED.deductions,
          net_salary = EXCLUDED.net_salary,
          basic_salary = EXCLUDED.basic_salary,
          hra = EXCLUDED.hra,
          special_allowance = EXCLUDED.special_allowance,
          pf_deduction = EXCLUDED.pf_deduction,
          esi_deduction = EXCLUDED.esi_deduction,
          tds_deduction = EXCLUDED.tds_deduction,
          pt_deduction = EXCLUDED.pt_deduction,
          lop_days = EXCLUDED.lop_days,
          paid_days = EXCLUDED.paid_days,
          total_working_days = EXCLUDED.total_working_days,
          updated_at = NOW()`,
        [
          tenantId,
          cycleId,
          employee.id,
          adjustedGrossSalary,
          totalDeductionsForEmployee,
          netSalary,
          adjustedBasic,
          adjustedHRA,
          adjustedSpecialAllowance,
          pfDeduction,
          esiDeduction,
          tdsDeduction,
          ptDeduction,
          lopDays,
          paidDays,
          totalWorkingDays,
        ]
      );

      processedCount++;
      totalGrossSalary += adjustedGrossSalary;
      totalDeductions += totalDeductionsForEmployee;
    }

    // Update payroll cycle with processed data
    await query(
      `UPDATE payroll_cycles
       SET status = 'processing',
           total_employees = $1,
           total_amount = $2,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [processedCount, totalGrossSalary, cycleId, tenantId]
    );

    return res.status(200).json({
      message: `Payroll processed successfully for ${processedCount} employees`,
      processedCount,
      totalGrossSalary,
      totalDeductions,
      totalNetSalary: totalGrossSalary - totalDeductions,
    });

  } catch (e: any) {
    console.error("Error processing payroll:", e);
    return res.status(500).json({ error: e.message || "Failed to process payroll" });
  }
});

appRouter.get("/payroll-settings", requireAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string; // Get from middleware

  if (!tenantId) {
    return res.status(403).json({ error: "You are not part of a tenant." });
  }

  try {
    const { rows } = await query(
      "SELECT * FROM payroll_settings WHERE tenant_id = $1",
      [tenantId]
    );

    if (rows.length === 0) {
      // This is not an error, just means settings aren't created yet.
      // Return a default structure or an empty object.
      return res.json({ settings: null }); // Send null to indicate not found
    }

    return res.json({ settings: rows[0] });
  } catch (error) {
    console.error("Error fetching payroll settings:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

appRouter.post("/payroll-settings", requireAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string; // Get from middleware

  if (!tenantId) {
    return res.status(403).json({ error: "You are not part of a tenant." });
  }

  const {
    pf_rate,
    esi_rate,
    pt_rate,
    tds_threshold,
    hra_percentage,
    special_allowance_percentage,
    basic_salary_percentage
  } = req.body;

  // Validate required fields
  if (pf_rate === undefined || basic_salary_percentage === undefined) {
    return res.status(400).json({ error: "Missing required settings fields" });
  }

  // Validate percentage fields sum to 100 (with tolerance for rounding)
  const totalPercentage = (parseFloat(basic_salary_percentage) || 0) + 
                          (parseFloat(hra_percentage) || 0) + 
                          (parseFloat(special_allowance_percentage) || 0);
  
  if (Math.abs(totalPercentage - 100) > 0.01) {
    return res.status(400).json({ 
      error: `Salary component percentages must sum to 100%. Current sum: ${totalPercentage.toFixed(2)}%` 
    });
  }

  try {
    const { rows } = await query(
      `
      INSERT INTO payroll_settings (
        tenant_id, pf_rate, esi_rate, pt_rate, tds_threshold, 
        hra_percentage, special_allowance_percentage, basic_salary_percentage,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        pf_rate = EXCLUDED.pf_rate,
        esi_rate = EXCLUDED.esi_rate,
        pt_rate = EXCLUDED.pt_rate,
        tds_threshold = EXCLUDED.tds_threshold,
        hra_percentage = EXCLUDED.hra_percentage,
        special_allowance_percentage = EXCLUDED.special_allowance_percentage,
        basic_salary_percentage = EXCLUDED.basic_salary_percentage,
        updated_at = NOW()
      RETURNING *
    `,
      [
        tenantId,
        pf_rate,
        esi_rate,
        pt_rate,
        tds_threshold,
        hra_percentage,
        special_allowance_percentage,
        basic_salary_percentage
      ]
    );

    return res.status(200).json({ settings: rows[0] });
  } catch (error) {
    console.error("Error saving payroll settings:", error);
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

// Leave and attendance endpoints removed - handled by HR system

// Payroll Register CSV Report
appRouter.get("/reports/payroll-register", requireAuth, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { cycleId } = req.query;

    if (!cycleId || typeof cycleId !== "string") {
      return res.status(400).json({ error: "cycleId query parameter is required" });
    }

    // Verify cycle belongs to tenant
    const cycleCheck = await query<{ month: number; year: number }>(
      "SELECT month, year FROM payroll_cycles WHERE id = $1 AND tenant_id = $2",
      [cycleId, tenantId]
    );

    if (cycleCheck.rows.length === 0) {
      return res.status(404).json({ error: "Payroll cycle not found" });
    }

    const cycle = cycleCheck.rows[0];
    const monthName = new Date(2000, cycle.month - 1).toLocaleString('en-IN', { month: 'long' });

    // Fetch payroll items with employee details
    const payrollItems = await query(
      `
      SELECT 
        e.employee_code,
        e.full_name,
        e.pan_number,
        e.bank_account_number,
        pi.basic_salary,
        pi.hra,
        pi.special_allowance,
        pi.gross_salary,
        pi.pf_deduction,
        pi.esi_deduction,
        pi.tds_deduction,
        pi.pt_deduction,
        pi.deductions,
        pi.net_salary,
        pi.lop_days,
        pi.paid_days,
        pi.total_working_days
      FROM payroll_items pi
      JOIN payroll_employee_view e ON e.employee_id = pi.employee_id
      WHERE pi.payroll_cycle_id = $1
        AND pi.tenant_id = $2
      ORDER BY e.employee_code ASC
      `,
      [cycleId, tenantId]
    );

    if (payrollItems.rows.length === 0) {
      return res.status(404).json({ error: "No payroll data found for this cycle" });
    }

    // Generate CSV
    const headers = [
      "Employee Code",
      "Employee Name",
      "PAN Number",
      "Bank Account Number",
      "Basic Salary",
      "HRA",
      "Special Allowance",
      "Gross Salary",
      "PF Deduction",
      "ESI Deduction",
      "TDS Deduction",
      "PT Deduction",
      "Total Deductions",
      "Net Salary",
      "LOP Days",
      "Paid Days",
      "Total Working Days"
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) {
        return "";
      }
      const str = String(value);
      // If contains comma, newline, or quote, wrap in quotes and escape quotes
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Helper function to format currency (as number without currency symbol)
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined) {
        return "0.00";
      }
      return Number(amount).toFixed(2);
    };

    // Build CSV rows
    const csvRows = [headers.map(escapeCSV).join(",")];

    for (const row of payrollItems.rows) {
      const csvRow = [
        escapeCSV(row.employee_code || ""),
        escapeCSV(row.full_name || ""),
        escapeCSV(row.pan_number || ""),
        escapeCSV(row.bank_account_number || ""),
        formatCurrency(row.basic_salary),
        formatCurrency(row.hra),
        formatCurrency(row.special_allowance),
        formatCurrency(row.gross_salary),
        formatCurrency(row.pf_deduction),
        formatCurrency(row.esi_deduction),
        formatCurrency(row.tds_deduction),
        formatCurrency(row.pt_deduction),
        formatCurrency(row.deductions),
        formatCurrency(row.net_salary),
        escapeCSV(row.lop_days || 0),
        escapeCSV(row.paid_days || 0),
        escapeCSV(row.total_working_days || 0)
      ];
      csvRows.push(csvRow.join(","));
    }

    const csvContent = csvRows.join("\n");

    // Set response headers for CSV download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="payroll-register-${monthName}-${cycle.year}.csv"`
    );

    // Send CSV content
    res.send(csvContent);

  } catch (e: any) {
    console.error("Error generating payroll register report:", e);
    res.status(500).json({ error: e.message || "Failed to generate payroll register report" });
  }
});

