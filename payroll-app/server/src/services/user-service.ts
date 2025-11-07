/**
 * User Service for Payroll Application
 * 
 * Handles user auto-provisioning and management from HR SSO
 * 
 * Usage:
 *   import { upsertPayrollUser, getPayrollUserByHrId } from './services/user-service';
 */

import { query, pool } from '../db.js';
import { HrUser } from '../middleware/sso.js';

export interface PayrollUser {
  id: string;
  email: string;
  hr_user_id: string;
  org_id: string;
  payroll_role: 'payroll_admin' | 'payroll_employee';
  first_name?: string;
  last_name?: string;
  created_at?: Date;
  updated_at?: Date;
}

async function ensureBaseTables(client: any) {
  // Ensure required extension for UUID generation exists
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // Create users table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      hr_user_id UUID UNIQUE,
      org_id UUID,
      payroll_role TEXT NOT NULL DEFAULT 'payroll_employee',
      first_name TEXT,
      last_name TEXT,
      pin_hash TEXT,
      pin_set_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Backfill columns for existing deployments (idempotent)
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hr_user_id UUID;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS payroll_role TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_set_at TIMESTAMPTZ;`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();`);
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`);

  // Indexes (idempotent)
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_hr_user_id ON users(hr_user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);`);
}

export async function ensurePayrollUserTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureBaseTables(client);
  } finally {
    client.release();
  }
}

/**
 * Upsert Payroll user from HR SSO data
 * 
 * - If user exists by hr_user_id, update it
 * - If user exists by email (but no hr_user_id), link it
 * - If user doesn't exist, create it
 */
export async function upsertPayrollUser(hrUser: HrUser): Promise<PayrollUser> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    // Ensure base tables/columns exist
    await ensureBaseTables(client);
    
    // Check if user exists by hr_user_id
    let userResult = await client.query(
      `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
       FROM users
       WHERE hr_user_id = $1`,
      [hrUser.hrUserId]
    );
    
    let user: PayrollUser;
    
    if (userResult.rows.length > 0) {
      // Update existing user
      user = userResult.rows[0];
      
      // Use firstName/lastName from hrUser if available, otherwise parse from name
      const firstName = hrUser.firstName || (hrUser.name ? hrUser.name.split(' ')[0] : '') || '';
      const lastName = hrUser.lastName || (hrUser.name ? hrUser.name.split(' ').slice(1).join(' ') : '') || '';
      
      await client.query(
        `UPDATE users
         SET 
           email = $1,
           org_id = $2,
           payroll_role = $3,
           first_name = COALESCE(NULLIF($4, ''), first_name),
           last_name = COALESCE(NULLIF($5, ''), last_name),
           updated_at = now()
         WHERE hr_user_id = $6
         RETURNING id, email, hr_user_id, org_id, payroll_role, first_name, last_name`,
        [
          hrUser.email,
          hrUser.orgId,
          hrUser.payrollRole,
          firstName,
          lastName,
          hrUser.hrUserId
        ]
      );
      
      // Re-fetch to get updated data
      userResult = await client.query(
        `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
         FROM users
         WHERE hr_user_id = $1`,
        [hrUser.hrUserId]
      );
      
      user = userResult.rows[0];
      
      console.log(`✓ Updated Payroll user: ${user.email} (${user.payroll_role})`);
    } else {
      // Check if user exists by email (for linking existing users)
      const emailResult = await client.query(
        `SELECT id, email, hr_user_id, org_id, payroll_role
         FROM users 
         WHERE email = $1`,
        [hrUser.email]
      );
      
      if (emailResult.rows.length > 0) {
        // Link existing user by email
        const existingUser = emailResult.rows[0];
        
        if (existingUser.hr_user_id && existingUser.hr_user_id !== hrUser.hrUserId) {
          console.warn(`⚠️  User ${hrUser.email} already linked to different HR user: ${existingUser.hr_user_id}`);
          // Continue with update (prefer HR's mapping)
        }
        
        // Use firstName/lastName from hrUser if available, otherwise parse from name
        const firstName = hrUser.firstName || (hrUser.name ? hrUser.name.split(' ')[0] : '') || '';
        const lastName = hrUser.lastName || (hrUser.name ? hrUser.name.split(' ').slice(1).join(' ') : '') || '';
        
        await client.query(
          `UPDATE users
           SET 
             hr_user_id = $1,
             org_id = $2,
             payroll_role = $3,
             first_name = COALESCE(NULLIF($4, ''), first_name),
             last_name = COALESCE(NULLIF($5, ''), last_name),
             updated_at = now()
           WHERE email = $6
           RETURNING id, email, hr_user_id, org_id, payroll_role, first_name, last_name`,
          [
            hrUser.hrUserId,
            hrUser.orgId,
            hrUser.payrollRole,
            firstName,
            lastName,
            hrUser.email
          ]
        );
        
        // Re-fetch to get updated data
        userResult = await client.query(
          `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
           FROM users
           WHERE hr_user_id = $1`,
          [hrUser.hrUserId]
        );
        
        user = userResult.rows[0];
        
        console.log(`✓ Linked Payroll user: ${user.email} → HR ID: ${hrUser.hrUserId} (${user.payroll_role})`);
      } else {
        // Create new user
        // Use firstName/lastName from hrUser if available, otherwise parse from name
        const firstName = hrUser.firstName || (hrUser.name ? hrUser.name.split(' ')[0] : '') || '';
        const lastName = hrUser.lastName || (hrUser.name ? hrUser.name.split(' ').slice(1).join(' ') : '') || '';
        
        const insertResult = await client.query(
          `INSERT INTO users (
            hr_user_id, email, org_id, payroll_role, first_name, last_name
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, email, hr_user_id, org_id, payroll_role, first_name, last_name`,
          [
            hrUser.hrUserId,
            hrUser.email,
            hrUser.orgId,
            hrUser.payrollRole,
            firstName,
            lastName
          ]
        );
        
        user = insertResult.rows[0];
        
        console.log(`✓ Created Payroll user: ${user.email} (${user.payroll_role})`);
      }
    }
    
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error upserting Payroll user:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get Payroll user by HR user ID
 */
export async function getPayrollUserByHrId(hrUserId: string): Promise<PayrollUser | null> {
  const result = await query<PayrollUser>(
    `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
     FROM users
     WHERE hr_user_id = $1`,
    [hrUserId]
  );
  
  return result.rows[0] || null;
}

/**
 * Get Payroll user by email
 */
export async function getPayrollUserByEmail(email: string): Promise<PayrollUser | null> {
  const result = await query<PayrollUser>(
    `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
     FROM users
     WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  
  return result.rows[0] || null;
}

/**
 * Get Payroll user by Payroll user ID
 */
export async function getPayrollUserById(userId: string): Promise<PayrollUser | null> {
  const result = await query<PayrollUser>(
    `SELECT id, email, hr_user_id, org_id, payroll_role, first_name, last_name
     FROM users
     WHERE id = $1`,
    [userId]
  );
  
  return result.rows[0] || null;
}

/**
 * Update Payroll user role
 */
export async function updatePayrollUserRole(
  userId: string,
  payrollRole: 'payroll_admin' | 'payroll_employee'
): Promise<PayrollUser> {
  const result = await query<PayrollUser>(
    `UPDATE users
     SET payroll_role = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, email, hr_user_id, org_id, payroll_role, first_name, last_name`,
    [payrollRole, userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }
  
  return result.rows[0];
}

