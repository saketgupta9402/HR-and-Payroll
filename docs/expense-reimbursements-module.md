# Expense Reimbursements Module

Comprehensive overview of the employee reimbursement workflow implemented in **November 2025** for the unified HR + Payroll stack.

---

## 1. Data Layer

| Artifact | Details |
| --- | --- |
| Migration | `server/db/migrations/20251114_add_employee_reimbursements.sql` |
| Tables | `employee_reimbursements` with `reimbursement_status` enum (`pending`, `approved`, `rejected`, `paid`) |

Key columns:

- `employee_id`, `org_id`, `category`, `amount`, optional `description` and `receipt_url`
- Review metadata: `reviewed_by_user_id`, `reviewed_at`
- Payroll linkage: `payroll_run_id` and status transition to `paid`
- Constraints & indexes ensure positive amounts and performant queries by `employee_id` / `status`

### Environment knobs

| Variable | Purpose | Default |
| --- | --- | --- |
| `REIMBURSEMENTS_RECEIPT_DIR` | Filesystem location for uploaded receipts | `<repo>/server/uploads/receipts` |
| `REIMBURSEMENTS_RECEIPT_BASE_URL` | Public base path / URL served for receipts | `/receipts` |
| `REIMBURSEMENTS_MAX_SIZE` | Max upload size (bytes) enforced by multer | `10MB` |

---

## 2. Backend API (`server/routes/reimbursements.js`)

Route prefix: `/api/v1/reimbursements`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/submit` | Employee (`authenticateToken`) | Accepts form-data (`category`, `amount`, `description`, `receipt`) and creates `pending` record |
| `GET` | `/my-claims` | Employee | Returns chronological history for logged-in employee |
| `GET` | `/pending` | `requireCapability('REIMBURSEMENT_APPROVE')` | HR/Admin queue scoped to org |
| `POST` | `/:id/approve` | Same | Marks record `approved`, captures reviewer, emits audit log |
| `POST` | `/:id/reject` | Same | Marks record `rejected`, audit logged |

*Receipts* are saved via `multer` and served statically from `REIMBURSEMENTS_RECEIPT_DIR`. Path is exposed in Express middleware (see `server/index.js`).

### Capabilities

`REIMBURSEMENT_APPROVE` added to `hr`, `ceo`, `accountant`, `admin` roles via `server/policy/authorize.js`.

---

## 3. Payroll Integration (`server/routes/payroll.js`)

During `POST /api/payroll/runs/:id/process`:

1. For each employee, fetch `SUM(amount)` of `approved` reimbursements with `payroll_run_id IS NULL`.
2. Convert to cents, add to net pay as non-taxable addition; metadata on `payroll_run_employees` captures `reimbursement_cents`.
3. After insert, mark those reimbursements as `paid` and attach `payroll_run_id` to prevent double payment.

---

## 4. Frontend (Payroll App)

### Employee Portal

- File: `payroll-app/src/components/employee-portal/ReimbursementsTab.tsx`
- Added as a new tab inside `EmployeePortal.tsx`
- Features:
  - React Hook Form with fields: category select (`Internet/Travel/Meals/Other`), amount, description, receipt upload
  - Submission uses `FormData` + React Query mutation to `/submit`
  - History table with status badges and receipt download links

### Admin / HR Queue

- File: `payroll-app/src/pages/ApproveReimbursements.tsx`
- Protected by new `AdminProtectedRoute` (role check via profile query)
- Route: `/approve-reimbursements` registered in `App.tsx`
- Dashboard quick-action card links to the page
- UI:
  - Pending claims table (employee info, category, amount, submitted timestamp)
  - Review dialog with description + receipt link
  - Approve / Reject mutations refresh the queue and toast results

### API Client additions (`payroll-app/src/lib/api.ts`)

```ts
reimbursements: {
  submit: (formData) => client.upload("/api/v1/reimbursements/submit", formData),
  myClaims: () => client.get("/api/v1/reimbursements/my-claims"),
  pending: () => client.get("/api/v1/reimbursements/pending"),
  approve: (id) => client.post(`/api/v1/reimbursements/${id}/approve`, {}),
  reject: (id) => client.post(`/api/v1/reimbursements/${id}/reject`, {}),
},
```

---

## 5. Rollout Checklist

1. **Database**: run migration `20251114_add_employee_reimbursements.sql`.
2. **Storage**: ensure `REIMBURSEMENTS_RECEIPT_DIR` exists and is writable; configure CDN/public URL if needed.
3. **Backend**: redeploy server to pick up new routes + static serving logic.
4. **Frontend**: ship Payroll app build so new tabs/routes are available.
5. **Access Control**: confirm HR/Accountant/C-suite users have the new capability; update onboarding docs if custom roles exist.
6. **Testing**:
   - Employee submission + receipt upload
   - Admin approve/reject flows (verify audit logs)
   - Payroll processing to verify reimbursement payout + status moves to `paid`.

---

## 6. Future Enhancements

- Add editable categories, per-org policy limits, and currency conversions.
- Surface reimbursement totals inside payslip previews.
- Support bulk approvals and CSV export for finance reconciliation.

---

**Maintainers**: HR/Payroll platform team  

