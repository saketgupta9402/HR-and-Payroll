# Statutory Reports Implementation

**Date:** 2025-11-18  
**Feature:** Statutory Reporting for Indian Payroll Module  
**Status:** ✅ Complete

## Overview

This document describes the implementation of Statutory Reporting functionality that allows HR/Admins to download compliant government reports (PF ECR, ESI Return, TDS Summary) for specific payroll months. The feature integrates seamlessly with the existing `payroll_runs` and `payroll_run_employees` architecture.

---

## Changes Summary

### Files Created

1. **`server/db/migrations/20251118_add_statutory_fields.sql`**
   - Migration file to add statutory fields to employees and organizations tables

2. **`server/services/statutory-reports.js`**
   - Service module containing business logic for generating statutory reports
   - Functions: `generatePFECR`, `generateESIReturn`, `generateTDSSummary`

3. **`docs/STATUTORY_REPORTS_IMPLEMENTATION.md`** (this file)
   - Complete documentation of the implementation

### Files Modified

1. **`server/routes/reports.js`**
   - Added three new API endpoints for statutory reports:
     - `GET /api/reports/statutory/pf-ecr`
     - `GET /api/reports/statutory/esi-return`
     - `GET /api/reports/statutory/tds-summary`

2. **`payroll-app/src/lib/api.ts`**
   - Added three new methods to the `reports` API client:
     - `downloadPFECR(month, year)`
     - `downloadESIReturn(month, year)`
     - `getTDSSummary(month, year)`

3. **`payroll-app/src/pages/Reports.tsx`**
   - Added "Statutory Downloads" section with month/year selector
   - Added buttons for PF ECR, ESI Return, and TDS Summary
   - Added TDS Summary dialog for viewing detailed TDS information

---

## Schema Changes

### Database Migration

The migration file `server/db/migrations/20251118_add_statutory_fields.sql` adds the following columns:

#### Employees Table
```sql
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS uan_number TEXT,
  ADD COLUMN IF NOT EXISTS esi_number TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_uan ON employees(uan_number) WHERE uan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_esi ON employees(esi_number) WHERE esi_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_pan ON employees(pan_number) WHERE pan_number IS NOT NULL;
```

#### Organizations Table
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS pf_code TEXT,
  ADD COLUMN IF NOT EXISTS esi_code TEXT;
```

### Column Descriptions

- **`employees.uan_number`**: Universal Account Number for EPFO (Employee Provident Fund Organization)
- **`employees.esi_number`**: Employee State Insurance number
- **`employees.pan_number`**: Permanent Account Number for tax purposes
- **`organizations.pf_code`**: EPFO Establishment Code
- **`organizations.esi_code`**: ESI Registration Code

---

## API Contract

### Base URL
All statutory report endpoints are available on the HR API server (default: `http://localhost:3001`).

### Authentication
All endpoints require authentication via JWT token (sent via cookies) and require one of the following roles:
- `hr`
- `admin`
- `accountant`

### Endpoints

#### 1. PF ECR (Electronic Challan cum Return)

**Endpoint:** `GET /api/reports/statutory/pf-ecr`

**Query Parameters:**
- `month` (required): Integer, 1-12
- `year` (required): Integer, 2000-2100

**Response:**
- Content-Type: `text/plain; charset=utf-8`
- Content-Disposition: `attachment; filename="PF-ECR-MM-YYYY.txt"`
- Body: Pipe-delimited (`|`) text file following EPFO ECR format

**Format:**
```
Establishment Code|Month|Year|Total Employees|Total EPF|Total EPS|Total EDLI
UAN|Name|Gross Wages|EPF Wages|EPS Wages|EPF Contribution|EPS Contribution|EDLI Contribution
...
```

**Example Request:**
```bash
GET /api/reports/statutory/pf-ecr?month=11&year=2025
```

**Error Responses:**
- `400 Bad Request`: Invalid month or year
- `403 Forbidden`: No organization found or insufficient permissions
- `404 Not Found`: No completed payroll run found for the specified month/year
- `500 Internal Server Error`: Server error during generation

---

#### 2. ESI Return

**Endpoint:** `GET /api/reports/statutory/esi-return`

**Query Parameters:**
- `month` (required): Integer, 1-12
- `year` (required): Integer, 2000-2100

**Response:**
- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="ESI-Return-MM-YYYY.csv"`
- Body: CSV file with employee ESI data

**Format:**
```csv
IP Number,IP Name,Days Worked,Wages
ESI123456,John Doe,30,15000
...
```

**Note:** Only employees with gross pay <= ₹21,000 are included (ESI threshold).

**Example Request:**
```bash
GET /api/reports/statutory/esi-return?month=11&year=2025
```

**Error Responses:**
- `400 Bad Request`: Invalid month or year
- `403 Forbidden`: No organization found or insufficient permissions
- `404 Not Found`: No completed payroll run found or no eligible employees
- `500 Internal Server Error`: Server error during generation

---

#### 3. TDS Summary

**Endpoint:** `GET /api/reports/statutory/tds-summary`

**Query Parameters:**
- `month` (required): Integer, 1-12
- `year` (required): Integer, 2000-2100

**Response:**
- Content-Type: `application/json`
- Body: JSON object containing TDS summary

**Response Structure:**
```json
{
  "organization": {
    "name": "Company Name",
    "pan": "ABCDE1234F",
    "tan": "ABCD12345E"
  },
  "period": {
    "month": 11,
    "year": 2025,
    "pay_date": "2025-11-30"
  },
  "total_tds": 50000,
  "total_employees": 10,
  "by_section": {
    "192B": {
      "section": "192B",
      "description": "Tax Deducted at Source on Salary",
      "total_amount": 50000,
      "employee_count": 10,
      "employees": [...]
    }
  },
  "employees": [
    {
      "employee_id": "EMP001",
      "pan": "ABCDE1234F",
      "name": "John Doe",
      "gross_pay": 50000,
      "tds_deducted": 5000,
      "section": "192B"
    }
  ]
}
```

**Example Request:**
```bash
GET /api/reports/statutory/tds-summary?month=11&year=2025
```

**Error Responses:**
- `400 Bad Request`: Invalid month or year
- `403 Forbidden`: No organization found or insufficient permissions
- `404 Not Found`: No completed payroll run found for the specified month/year
- `500 Internal Server Error`: Server error during generation

---

## Usage Guide

### Prerequisites

1. **Database Migration**: Run the migration file to add required columns:
   ```bash
   # If using Docker
   docker exec hr-suite-postgres psql -U postgres -d hr_suite -f /path/to/20251118_add_statutory_fields.sql
   
   # Or manually execute the SQL in the migration file
   ```

2. **Configure Organization Details**: Ensure the following are set in the `organizations` table:
   - `pf_code`: EPFO Establishment Code
   - `esi_code`: ESI Registration Code (if applicable)

3. **Configure Employee Details**: Ensure employee records have:
   - `uan_number`: For employees covered under EPF
   - `esi_number`: For employees covered under ESI
   - `pan_number`: For tax reporting

4. **Complete Payroll Run**: A completed payroll run must exist for the month/year you want to generate reports for.

### Generating Reports

#### Via Frontend (Payroll Portal)

1. Navigate to **Reports** page in the Payroll Portal
2. Scroll to the **"Statutory Downloads"** section
3. Select the **Month** (1-12) and **Year** (e.g., 2025)
4. Click the appropriate button:
   - **Download PF ECR**: Downloads a `.txt` file in EPFO ECR format
   - **Download ESI Return**: Downloads a `.csv` file with ESI data
   - **View TDS Summary**: Opens a dialog showing detailed TDS information

#### Via API (Direct)

**PF ECR:**
```bash
curl -X GET "http://localhost:3001/api/reports/statutory/pf-ecr?month=11&year=2025" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -o PF-ECR-11-2025.txt
```

**ESI Return:**
```bash
curl -X GET "http://localhost:3001/api/reports/statutory/esi-return?month=11&year=2025" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -o ESI-Return-11-2025.csv
```

**TDS Summary:**
```bash
curl -X GET "http://localhost:3001/api/reports/statutory/tds-summary?month=11&year=2025" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

### Report Details

#### PF ECR Report
- **Format**: Pipe-delimited text file
- **Data Source**: `payroll_run_employees` table, specifically the `metadata->>'pf_cents'` field
- **Calculations**:
  - EPF Wages: Minimum of (Gross Pay, ₹15,000)
  - EPF Contribution: 12% of EPF Wages (stored in metadata)
  - EPS Contribution: 8.33% of EPF Contribution
  - EDLI Contribution: 0.5% of EPF Contribution
- **Compliance**: Follows EPFO ECR format specifications

#### ESI Return Report
- **Format**: CSV file
- **Data Source**: `payroll_run_employees` table
- **Filter**: Only includes employees with `gross_pay_cents <= 2100000` (₹21,000)
- **Columns**: IP Number, IP Name, Days Worked, Wages
- **Days Worked**: Currently defaults to total days in the month (can be enhanced to use actual attendance data)

#### TDS Summary Report
- **Format**: JSON (can be displayed in UI or exported)
- **Data Source**: `payroll_run_employees` table, specifically the `metadata->>'tds_cents'` field
- **Grouping**: By tax section (default: Section 192B for salary TDS)
- **Information**: Includes organization details, period, totals, and per-employee breakdown

---

## Technical Implementation Details

### Service Layer (`server/services/statutory-reports.js`)

The service layer handles:
1. **Payroll Run Lookup**: Finds the completed payroll run for the specified month/year
2. **Data Extraction**: Queries `payroll_run_employees` with joins to `employees` and `profiles`
3. **Format Conversion**: Transforms database data into compliant report formats
4. **Error Handling**: Validates inputs and provides meaningful error messages

### Data Flow

```
User Request (Month/Year)
    ↓
API Endpoint (reports.js)
    ↓
Service Layer (statutory-reports.js)
    ↓
Database Query (payroll_runs + payroll_run_employees)
    ↓
Data Transformation
    ↓
Formatted Report (TXT/CSV/JSON)
    ↓
HTTP Response
```

### Integration Points

1. **Payroll Processing**: The `payroll_run_employees.metadata` JSONB column stores:
   - `pf_cents`: PF contribution amount
   - `tds_cents`: TDS deduction amount
   - Other deduction details

2. **Employee Data**: Joins with `employees` and `profiles` tables to get:
   - Employee names
   - UAN, ESI, PAN numbers
   - Employee codes

3. **Organization Data**: Fetches from `organizations` table:
   - PF Code
   - ESI Code
   - PAN/TAN for TDS reports

---

## Error Handling

### Common Errors

1. **"No completed payroll run found for MM/YYYY"**
   - **Cause**: Payroll hasn't been processed for that month
   - **Solution**: Process payroll for the specified month first

2. **"PF Code not configured for organization"**
   - **Cause**: `organizations.pf_code` is NULL
   - **Solution**: Update organization record with PF code

3. **"No employees eligible for ESI"**
   - **Cause**: All employees have gross pay > ₹21,000
   - **Solution**: This is expected if no employees are ESI-eligible

4. **"Invalid month or year"**
   - **Cause**: Month not in 1-12 range or year outside valid range
   - **Solution**: Ensure valid month (1-12) and year (2000-2100)

---

## Future Enhancements

1. **Enhanced Days Worked Calculation**: Use actual attendance/timesheet data instead of defaulting to full month
2. **ESI Contribution Calculation**: Add ESI contribution amounts to the report (currently only wages)
3. **Multiple Tax Sections**: Support for TDS under multiple sections (192A, 194, etc.)
4. **PDF Export**: Generate PDF versions of reports for official submissions
5. **Bulk Download**: Allow downloading all statutory reports for a month in a single ZIP file
6. **Report History**: Track when reports were generated and by whom
7. **Validation**: Add pre-submission validation to ensure data completeness

---

## Testing

### Manual Testing Checklist

- [ ] Run database migration successfully
- [ ] Configure organization PF code and ESI code
- [ ] Add UAN, ESI, PAN numbers to employee records
- [ ] Process payroll for a test month
- [ ] Generate PF ECR and verify format
- [ ] Generate ESI Return and verify CSV format
- [ ] View TDS Summary and verify data accuracy
- [ ] Test error cases (missing payroll run, invalid dates, etc.)
- [ ] Verify role-based access control (HR/Admin/Accountant only)

### Test Data

Ensure test data includes:
- At least one employee with UAN number
- At least one employee with ESI number (and gross pay <= ₹21,000)
- At least one employee with PAN number
- Completed payroll run with PF and TDS deductions in metadata

---

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify database migration was applied
3. Ensure organization and employee data is properly configured
4. Confirm payroll has been processed for the requested month/year

---

## Changelog

- **2025-11-18**: Initial implementation
  - Added database migration for statutory fields
  - Created statutory-reports service
  - Added API endpoints
  - Updated frontend with statutory downloads UI

