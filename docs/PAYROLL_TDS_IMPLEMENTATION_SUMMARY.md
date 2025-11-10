# Payroll & TDS Implementation Summary

This document captures the database, API, and UI work delivered for the payroll tax workflow, including flexible salary structures, one-time adjustments, tax declarations, TDS computation, and Form 16 generation.

---

## New Database Tables

- `payroll_components`
- `employee_salary_structure`
- `payroll_run_adjustments`
- `tax_component_definitions`
- `tax_declarations`
- `tax_declaration_items`
- `tax_regimes`

## Schema Modifications

- `organizations` — added `company_pan`, `company_tan`
- `payroll_run_employees` — existing table now stores per-run metadata (TDS cents) alongside gross/deductions

## New Backend Endpoints

- Payroll adjustments  
  - `GET /api/payroll/runs/:id/adjustments`  
  - `POST /api/payroll/runs/:id/adjustments`  
  - `PUT /api/payroll/adjustments/:adjustmentId`  
  - `DELETE /api/payroll/adjustments/:adjustmentId`
- Tax declarations  
  - `GET /api/tax/declarations/definitions`  
  - `GET /api/tax/declarations/me`  
  - `POST /api/tax/declarations`  
  - `GET /api/tax/declarations` (reviewers)  
  - `POST /api/tax/declarations/:id/review`
- Form 16 reporting  
  - `GET /api/reports/form16`

## New Frontend Pages & Components

- `src/pages/PayrollAdjustments.tsx`
- `src/pages/TaxDeclaration.tsx`
- `src/pages/TaxDeclarationReview.tsx`
- `src/pages/Form16.tsx`
- Sidebar navigation updates to surface the new flows
- Payroll list integration linking to the adjustments page

## Modified Files (Highlights)

- Database definitions: `server/db/full-schema.sql`, `server/db/schema.sql`
- Payroll routes: `server/routes/payroll.js`
- Tax declaration routes: `server/routes/tax-declarations.js`
- Reports: `server/routes/reports.js`
- Capability matrix: `server/policy/authorize.js`
- Server bootstrap: `server/index.js`
- Tax engine: `server/services/taxEngine.js`
- Client API wrapper: `src/lib/api.ts`
- App routing & layout: `src/App.tsx`, `src/components/layout/AppSidebar.tsx`
- Existing payroll page enhancements: `src/pages/Payroll.tsx`

---

For any follow-up implementation notes (migrations, seeds, or rollout steps), see the project README or contact the payroll engineering team.
