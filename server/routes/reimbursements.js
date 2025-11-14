import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireCapability, CAPABILITIES } from '../policy/authorize.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

const RECEIPTS_DIR =
  process.env.REIMBURSEMENTS_RECEIPT_DIR || path.resolve(process.cwd(), 'uploads', 'receipts');
const RECEIPTS_BASE_URL = process.env.REIMBURSEMENTS_RECEIPT_BASE_URL || '/receipts';
const RECEIPTS_MAX_SIZE =
  Number(process.env.REIMBURSEMENTS_MAX_SIZE || 10 * 1024 * 1024); // default 10 MB

const REIMBURSEMENT_CATEGORIES = [
  { value: 'food', label: 'Food & Meals' },
  { value: 'travel', label: 'Travel' },
  { value: 'stay', label: 'Stay & Lodging' },
  { value: 'transport', label: 'Local Transport' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'internet', label: 'Internet & Connectivity' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_VALUES = new Set(REIMBURSEMENT_CATEGORIES.map((item) => item.value));
const CATEGORY_LABEL_LOOKUP = REIMBURSEMENT_CATEGORIES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const CATEGORY_SYNONYMS = {
  meal: 'food',
  meals: 'food',
  food: 'food',
  dining: 'food',
  lunch: 'food',
  dinner: 'food',
  travel: 'travel',
  trip: 'travel',
  airfare: 'travel',
  flight: 'travel',
  stay: 'stay',
  lodging: 'stay',
  hotel: 'stay',
  accommodation: 'stay',
  transport: 'transport',
  transportation: 'transport',
  cab: 'transport',
  taxi: 'transport',
  commute: 'transport',
  mileage: 'transport',
  office: 'office_supplies',
  supplies: 'office_supplies',
  stationery: 'office_supplies',
  hardware: 'office_supplies',
  internet: 'internet',
  wifi: 'internet',
  broadband: 'internet',
  data: 'internet',
  misc: 'other',
  miscellaneous: 'other',
  other: 'other',
};

const toTitleCase = (value) =>
  value
    .toString()
    .replace(/[_\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const normalizeCategoryValue = (rawValue) => {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }
  const normalized = rawValue.toString().trim().toLowerCase();
  if (CATEGORY_VALUES.has(normalized)) {
    return normalized;
  }
  if (CATEGORY_SYNONYMS[normalized]) {
    return CATEGORY_SYNONYMS[normalized];
  }
  return null;
};

const mapReimbursementRow = (row) => {
  const canonical = normalizeCategoryValue(row.category);
  const fallbackLabel =
    typeof row.category === 'string' && row.category.trim().length > 0
      ? toTitleCase(row.category)
      : 'Other';
  return {
    ...row,
    category_value: canonical || 'other',
    category_label: canonical ? CATEGORY_LABEL_LOOKUP[canonical] : fallbackLabel,
  };
};

fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RECEIPTS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: RECEIPTS_MAX_SIZE },
});

const normalizeBasePath = () => {
  if (!RECEIPTS_BASE_URL) {
    return '/receipts';
  }

  if (RECEIPTS_BASE_URL.startsWith('http')) {
    try {
      const parsed = new URL(RECEIPTS_BASE_URL);
      return parsed.pathname?.replace(/\/+$/, '') || '/receipts';
    } catch (err) {
      console.warn('Invalid REIMBURSEMENTS_RECEIPT_BASE_URL, defaulting to /receipts:', err);
      return '/receipts';
    }
  }

  const trimmed = RECEIPTS_BASE_URL.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const RECEIPTS_BASE_PATH = normalizeBasePath();

const getOrgIdForUser = async (userId) => {
  const result = await query('SELECT tenant_id FROM profiles WHERE id = $1', [userId]);
  return result.rows[0]?.tenant_id || null;
};

const getEmployeeForUser = async (userId) => {
  const result = await query(
    `SELECT id, tenant_id
     FROM employees
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const buildReceiptUrl = (filename) => {
  if (!filename) {
    return null;
  }
  return `${RECEIPTS_BASE_PATH}/${filename}`;
};

router.post(
  '/submit',
  authenticateToken,
  upload.single('receipt'),
  async (req, res) => {
    try {
      const { category, amount, description } = req.body;

      if (!category) {
        return res.status(400).json({ error: 'Category is required' });
      }

      const normalizedCategory = normalizeCategoryValue(category);
      if (!normalizedCategory) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      if (amount === undefined) {
        return res.status(400).json({ error: 'Amount is required' });
      }

      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }

      const employeeRecord = await getEmployeeForUser(req.user.id);
      if (!employeeRecord) {
        return res.status(404).json({ error: 'Employee profile not found' });
      }

      const orgId = req.user.org_id || req.orgId || employeeRecord.tenant_id;
      if (!orgId) {
        return res.status(400).json({ error: 'Organization context missing' });
      }

      const receiptUrl = req.file ? buildReceiptUrl(req.file.filename) : null;

      const insertResult = await query(
        `INSERT INTO employee_reimbursements (
          employee_id,
          org_id,
          category,
          amount,
          description,
          receipt_url,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *`,
        [
          employeeRecord.id,
          orgId,
          normalizedCategory,
          numericAmount,
          description?.trim() || null,
          receiptUrl,
        ]
      );

      res.status(201).json({ reimbursement: mapReimbursementRow(insertResult.rows[0]) });
    } catch (error) {
      console.error('Error submitting reimbursement:', error);
      res.status(500).json({ error: error.message || 'Failed to submit reimbursement' });
    }
  }
);

router.get('/my-claims', authenticateToken, async (req, res) => {
  try {
    const employeeRecord = await getEmployeeForUser(req.user.id);
    if (!employeeRecord) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    const claimsResult = await query(
      `SELECT *
       FROM employee_reimbursements
       WHERE employee_id = $1
       ORDER BY submitted_at DESC`,
      [employeeRecord.id]
    );

    res.json({ reimbursements: claimsResult.rows.map(mapReimbursementRow) });
  } catch (error) {
    console.error('Error fetching reimbursement claims:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reimbursements' });
  }
});

router.get(
  '/pending',
  authenticateToken,
  requireCapability(CAPABILITIES.REIMBURSEMENT_APPROVE),
  async (req, res) => {
    try {
      const orgId = req.user.org_id || req.orgId || (await getOrgIdForUser(req.user.id));
      if (!orgId) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const pendingResult = await query(
        `SELECT 
          r.*,
          e.employee_id as employee_code,
          p.first_name,
          p.last_name
         FROM employee_reimbursements r
         JOIN employees e ON e.id = r.employee_id
         JOIN profiles p ON p.id = e.user_id
         WHERE r.org_id = $1
           AND r.status = 'pending'
         ORDER BY r.submitted_at ASC`,
        [orgId]
      );

      res.json({ reimbursements: pendingResult.rows.map(mapReimbursementRow) });
    } catch (error) {
      console.error('Error fetching pending reimbursements:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch pending reimbursements' });
    }
  }
);

const handleReview = (status) => [
  authenticateToken,
  requireCapability(CAPABILITIES.REIMBURSEMENT_APPROVE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id || req.orgId || (await getOrgIdForUser(req.user.id));

      if (!orgId) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const updateResult = await query(
        `UPDATE employee_reimbursements
         SET status = $1,
             reviewed_by_user_id = $2,
             reviewed_at = NOW()
         WHERE id = $3
           AND org_id = $4
         RETURNING *`,
        [status, req.user.id, id, orgId]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ error: 'Reimbursement not found' });
      }

      const updated = mapReimbursementRow(updateResult.rows[0]);

      await audit({
        actorId: req.user.id,
        action: status === 'approved' ? 'reimbursement_approved' : 'reimbursement_rejected',
        entityType: 'employee_reimbursement',
        entityId: updated.id,
        details: {
          orgId,
          amount: updated.amount,
          employee_id: updated.employee_id,
        },
      });

      res.json({ reimbursement: updated });
    } catch (error) {
      console.error(`Error updating reimbursement (${status}):`, error);
      res.status(500).json({ error: error.message || 'Failed to update reimbursement' });
    }
  },
];

router.post('/:id/approve', ...handleReview('approved'));
router.post('/:id/reject', ...handleReview('rejected'));

export default router;

