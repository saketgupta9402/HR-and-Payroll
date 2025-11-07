/**
 * SSO Routes for Payroll Application
 * 
 * Handles Single Sign-On from HR system
 * 
 * Usage:
 *   import ssoRoutes from './routes/sso';
 *   app.use('/', ssoRoutes);
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyHrSsoToken } from '../middleware/sso.js';
import { upsertPayrollUser, getPayrollUserById, ensurePayrollUserTables } from '../services/user-service.js';
import { query } from '../db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

/**
 * GET /sso?token=<jwt>
 * 
 * SSO endpoint that:
 * 1. Verifies JWT token from HR system
 * 2. Auto-provisions Payroll user if missing
 * 3. Checks if PIN is required (first-time user)
 * 4. Sets session cookie with user data
 * 5. Redirects to appropriate dashboard or PIN setup
 */
router.get('/sso', verifyHrSsoToken, async (req: Request, res: Response) => {
  try {
    const hrUser = req.hrUser!;
    
    if (!hrUser) {
      return res.status(401).json({ 
        error: 'SSO user not found',
        message: 'Failed to extract user from SSO token'
      });
    }

    // Ensure required payroll tables exist before proceeding
    await ensurePayrollUserTables();

    // Auto-provision user (create or update)
    let user;
    let isNewUser = false;
    try {
      // Check if user exists before upsert
      const existingUser = await query(
        `SELECT id FROM users WHERE hr_user_id = $1 OR email = $2`,
        [hrUser.hrUserId, hrUser.email]
      );
      
      isNewUser = existingUser.rows.length === 0;
      
      user = await upsertPayrollUser(hrUser);
    } catch (error: any) {
      console.error('Error upserting Payroll user:', error);
      return res.status(500).json({ 
        error: 'Failed to provision user',
        message: error.message || 'Internal server error during user provisioning'
      });
    }

    // Ensure employee record exists for this user (all roles should have employee records)
    try {
      const employeeCheck = await query(
        `SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1`,
        [user.org_id, user.email]
      );
      
      if (employeeCheck.rows.length === 0) {
        // Create employee record for this user
        const fullName = `${hrUser.firstName || ''} ${hrUser.lastName || ''}`.trim() || hrUser.name || user.email;
        const employeeCode = `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        
        // Double-check to avoid race conditions
        const doubleCheck = await query(
          `SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2 LIMIT 1`,
          [user.org_id, user.email]
        );

        if (doubleCheck.rows.length === 0) {
          await query(
            `INSERT INTO employees (
              tenant_id, employee_code, full_name, email, status, date_of_joining, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
              user.org_id,
              employeeCode,
              fullName,
              user.email,
              'active',
              new Date().toISOString().split('T')[0],
              user.id
            ]
          );
          console.log(`✅ Created employee record for SSO user: ${user.email}`);
        }
      }
    } catch (empError: any) {
      // Log error but don't fail SSO - employee record can be created later
      console.warn(`⚠️  Failed to create employee record for SSO user (${user.email}):`, empError.message);
    }

    // Check if user needs PIN setup (first-time user or no PIN set)
    const needsPinSetup = await checkIfPinRequired(user.id);

    // Log SSO success
    console.log(`✅ SSO successful: ${user.email} (${user.payroll_role}) from org ${user.org_id}, needsPinSetup: ${needsPinSetup}`);

    // Set JWT token in cookie for frontend (Payroll app uses cookie-based auth)
    // Include all necessary fields for user creation if missing
    const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign({ 
      userId: user.id, 
      payrollRole: user.payroll_role, 
      orgId: user.org_id,
      email: user.email,
      hrUserId: user.hr_user_id || hrUser.hrUserId || null
    }, JWT_SECRET, { expiresIn: '7d' });
    
    // Set cookie with explicit path to ensure it's accessible across all routes
    res.cookie('session', token, { 
      httpOnly: true, 
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Explicit path to ensure cookie is accessible
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    console.log(`✅ Session cookie set for user: ${user.id} (${user.payroll_role})`);

    // Redirect based on PIN requirement
    // Always require PIN verification for security (PIN-based auth only)
    const frontendUrl = process.env.PAYROLL_FRONTEND_URL || process.env.PAYROLL_BASE_URL || 'http://localhost:3002';
    let destination: string;
    if (needsPinSetup) {
      // First-time user: redirect to PIN setup page
      destination = `${frontendUrl}/setup-pin?sso=true${isNewUser ? '&welcome=true' : ''}`;
    } else {
      // User has PIN set: redirect to PIN verification page
      // After PIN verification, user will be redirected to dashboard
      destination = `${frontendUrl}/pin-auth?sso=true`;
    }

    res.redirect(destination);
  } catch (error: any) {
    console.error('SSO error:', error);
    res.status(500).json({ 
      error: 'SSO processing failed',
      message: error.message || 'Internal server error during SSO processing'
    });
  }
});

/**
 * Check if user needs to set up PIN
 */
async function checkIfPinRequired(userId: string): Promise<boolean> {
  try {
    // Check if users table has pin_hash column
    const columnCheck = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'pin_hash'
    `);
    
    if (columnCheck.rows.length === 0) {
      // Column doesn't exist, create it
      await query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
        ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ
      `);
      // New column, all users need PIN setup
      return true;
    }
    
    // Check if user has PIN set
    const userResult = await query(
      `SELECT pin_hash FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return true; // User doesn't exist (shouldn't happen)
    }
    
    const pinHash = userResult.rows[0].pin_hash;
    return !pinHash; // No PIN set
  } catch (error) {
    console.error('Error checking PIN requirement:', error);
    // On error, assume PIN is required for safety
    return true;
  }
}

/**
 * POST /sso/setup-pin
 * 
 * Setup 6-digit PIN for first-time Payroll users
 */
router.post('/sso/setup-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;
    const userId = (req as any).user?.id || req.query.userId;
    
    // Validate PIN
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ 
        error: 'PIN required',
        message: 'Please provide a 6-digit PIN'
      });
    }
    
    // Validate PIN format (6 digits)
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(pin)) {
      return res.status(400).json({ 
        error: 'Invalid PIN format',
        message: 'PIN must be exactly 6 digits'
      });
    }
    
    // Get user from session cookie
    const token = req.cookies?.session;
    if (!token && !userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login first'
      });
    }
    
    let actualUserId = userId;
    if (!actualUserId && token) {
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        actualUserId = decoded.userId;
      } catch (jwtError) {
        return res.status(401).json({ 
          error: 'Invalid session',
          message: 'Please login again'
        });
      }
    }
    
    if (!actualUserId) {
      return res.status(401).json({ 
        error: 'User ID required',
        message: 'Unable to identify user'
      });
    }
    
    // Hash PIN
    const pinHash = await bcrypt.hash(pin, 10);
    
    // Ensure pin_hash and pin_set_at columns exist
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ
    `);
    
    // Update user with PIN and get payroll role
    const updateResult = await query(
      `UPDATE users 
       SET pin_hash = $1, pin_set_at = now() 
       WHERE id = $2
       RETURNING payroll_role`,
      [pinHash, actualUserId]
    );
    
    console.log(`✅ PIN set for user: ${actualUserId}`);
    
    // Get payroll role to determine dashboard URL
    const payrollRole = updateResult.rows[0]?.payroll_role || 'payroll_employee';
    
    // Always redirect to /dashboard - dashboard will adapt based on role
    const dashboardUrl = '/dashboard';
    
    // Mark this session as PIN-verified
    res.cookie('pin_ok', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Explicit path to ensure cookie is accessible
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    console.log(`✅ PIN verified cookie set for user: ${actualUserId} (${payrollRole}), redirecting to: ${dashboardUrl}`);

    res.json({
      success: true,
      message: 'PIN set successfully',
      dashboardUrl: dashboardUrl,
      payrollRole: payrollRole
    });
  } catch (error: any) {
    console.error('Error setting PIN:', error);
    res.status(500).json({ 
      error: 'Failed to set PIN',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /sso/verify-pin
 * 
 * Verify PIN for Payroll authentication
 */
router.post('/sso/verify-pin', async (req: Request, res: Response) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ 
        error: 'PIN required',
        message: 'Please provide your 6-digit PIN'
      });
    }

    // Validate PIN format (must be exactly 6 digits)
    if (typeof pin !== 'string' || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ 
        error: 'Invalid PIN format',
        message: 'PIN must be exactly 6 digits (0-9)'
      });
    }

    // Resolve user from session cookie
    const token = req.cookies?.session;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Get user PIN hash and payroll role
    const userResult = await query(
      `SELECT pin_hash, payroll_role FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].pin_hash) {
      return res.status(404).json({ 
        error: 'PIN not set',
        message: 'Please set up your PIN first'
      });
    }
    
    const pinHash = userResult.rows[0].pin_hash;
    const payrollRole = userResult.rows[0].payroll_role || 'payroll_employee';
    const isValid = await bcrypt.compare(pin, pinHash);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Invalid PIN',
        message: 'PIN is incorrect'
      });
    }
    
    // Determine redirect URL based on role
    // payroll_admin (CEO/HR/Admin) -> /dashboard
    // payroll_employee (Director/Employee/Manager) -> /employee-portal
    const dashboardUrl = payrollRole === 'payroll_admin' ? '/dashboard' : '/employee-portal';
    
    // Mark this session as PIN-verified
    res.cookie('pin_ok', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Explicit path to ensure cookie is accessible
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    console.log(`✅ PIN verified for user: ${userId} (${payrollRole}), role: ${payrollRole}, redirecting to: ${dashboardUrl}`);

    res.json({
      success: true,
      message: 'PIN verified successfully',
      dashboardUrl: dashboardUrl,
      payrollRole: payrollRole
    });
  } catch (error: any) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ 
      error: 'Failed to verify PIN',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /sso/change-pin
 * 
 * Change PIN for authenticated user (requires current PIN verification)
 */
router.post('/sso/change-pin', async (req: Request, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ 
        error: 'Both current PIN and new PIN are required' 
      });
    }

    // Validate PIN format (6 digits)
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(currentPin) || !pinRegex.test(newPin)) {
      return res.status(400).json({ 
        error: 'PIN must be exactly 6 digits' 
      });
    }

    if (currentPin === newPin) {
      return res.status(400).json({ 
        error: 'New PIN must be different from current PIN' 
      });
    }

    // Resolve user from session cookie
    const token = req.cookies?.session;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      userId = decoded.userId;
    } catch (e) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Get user PIN hash
    const userResult = await query(
      `SELECT pin_hash FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].pin_hash) {
      return res.status(404).json({ 
        error: 'PIN not set',
        message: 'Please set up your PIN first'
      });
    }
    
    const pinHash = userResult.rows[0].pin_hash;
    const isValid = await bcrypt.compare(currentPin, pinHash);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Invalid current PIN',
        message: 'Current PIN is incorrect'
      });
    }
    
    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);
    
    // Update user PIN
    await query(
      `UPDATE users SET pin_hash = $1, pin_set_at = now() WHERE id = $2`,
      [newPinHash, userId]
    );
    
    console.log(`✅ PIN changed for user: ${userId}`);
    
    res.json({
      success: true,
      message: 'PIN changed successfully'
    });
  } catch (error: any) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ 
      error: 'Failed to change PIN',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /sso/forgot-pin
 * 
 * Request PIN reset (sends email through HR system)
 */
router.post('/sso/forgot-pin', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const userResult = await query(
      `SELECT id, email, hr_user_id, org_id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    
    if (userResult.rows.length === 0) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive instructions to reset your PIN'
      });
    }
    
    const user = userResult.rows[0];
    
    // Generate reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Store reset token in database (create table if needed)
    await query(`
      CREATE TABLE IF NOT EXISTS pin_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    
    await query(
      `INSERT INTO pin_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, resetTokenHash, expiresAt]
    );
    
    // TODO: Send email through HR system with reset link
    // For now, log the reset token (in production, send email)
    const resetLink = `${process.env.PAYROLL_FRONTEND_URL || 'http://localhost:3002'}/reset-pin?token=${resetToken}`;
    console.log(`🔐 PIN Reset Link for ${user.email}: ${resetLink}`);
    
    // In production, call HR system to send email
    // await sendPasswordResetEmail(user.email, resetLink);
    
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive instructions to reset your PIN',
      // Remove in production - only for development
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined
    });
  } catch (error: any) {
    console.error('Error processing forgot PIN:', error);
    res.status(500).json({ 
      error: 'Failed to process forgot PIN request',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /sso/reset-pin
 * 
 * Reset PIN using reset token
 */
router.post('/sso/reset-pin', async (req: Request, res: Response) => {
  try {
    const { token, newPin } = req.body;

    if (!token || !newPin) {
      return res.status(400).json({ 
        error: 'Token and new PIN are required' 
      });
    }

    // Validate PIN format (6 digits)
    const pinRegex = /^\d{6}$/;
    if (!pinRegex.test(newPin)) {
      return res.status(400).json({ 
        error: 'PIN must be exactly 6 digits' 
      });
    }

    // Find valid reset token
    const tokenResult = await query(`
      SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used
      FROM pin_reset_tokens prt
      WHERE prt.expires_at > now() AND prt.used = FALSE
      ORDER BY prt.created_at DESC
    `);
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Verify token
    let validToken = null;
    for (const row of tokenResult.rows) {
      const isValid = await bcrypt.compare(token, row.token_hash);
      if (isValid) {
        validToken = row;
        break;
      }
    }
    
    if (!validToken) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token' 
      });
    }
    
    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);
    
    // Update user PIN
    await query(
      `UPDATE users SET pin_hash = $1, pin_set_at = now() WHERE id = $2`,
      [newPinHash, validToken.user_id]
    );
    
    // Mark token as used
    await query(
      `UPDATE pin_reset_tokens SET used = TRUE WHERE id = $1`,
      [validToken.id]
    );
    
    console.log(`✅ PIN reset for user: ${validToken.user_id}`);
    
    res.json({
      success: true,
      message: 'PIN reset successfully. Please login with your new PIN.'
    });
  } catch (error: any) {
    console.error('Error resetting PIN:', error);
    res.status(500).json({ 
      error: 'Failed to reset PIN',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /sso/verify
 * 
 * Verify SSO token (for testing/debugging)
 */
router.get('/sso/verify', verifyHrSsoToken, (req: Request, res: Response) => {
  const hrUser = req.hrUser!;
  
  res.json({
    success: true,
    message: 'SSO token is valid',
    user: {
      hrUserId: hrUser.hrUserId,
      orgId: hrUser.orgId,
      email: hrUser.email,
      name: hrUser.name,
      roles: hrUser.roles,
      payrollRole: hrUser.payrollRole
    }
  });
});

/**
 * POST /sso/logout
 * 
 * Logout from Payroll (clear session)
 */
router.post('/sso/logout', (req: Request, res: Response) => {
  res.clearCookie('session');
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

export default router;
