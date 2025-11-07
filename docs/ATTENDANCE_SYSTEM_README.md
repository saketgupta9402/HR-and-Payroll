# Attendance System - Punch In/Out + Bulk Upload

## Overview

Complete Punch In/Out + Attendance Upload feature for multi-tenant HR & Payroll web application. Supports real-time API endpoints for punch in/out and bulk CSV/Excel uploads with full processing pipeline.

## Features

- ✅ Real-time punch in/out API endpoints
- ✅ Bulk CSV/Excel file upload with mapping
- ✅ Automatic file processing and validation
- ✅ Idempotent uploads (no duplicates)
- ✅ Row-level error tracking
- ✅ Upload history and audit trail
- ✅ Timezone handling
- ✅ Multi-tenant support
- ✅ Timesheet integration

## Database Schema

### Migration File
Run the migration file to create all required tables:
```sql
server/db/migrations/20251103_add_attendance_system.sql
```

### Tables Created

1. **attendance_events** - Real-time punch in/out events
2. **attendance_uploads** - Bulk upload records
3. **attendance_upload_rows** - Row-level tracking with validation
4. **attendance_audit_logs** - Audit trail for all actions
5. **timesheet_entries** - Extended with attendance source fields

## API Endpoints

### Base URL: `/api/v1/attendance`

#### POST `/punch`
Real-time punch in/out API

**Request:**
```json
{
  "employee_id": "emp_123",
  "timestamp": "2025-11-03T09:03:00+05:30",
  "type": "IN",
  "device_id": "device_01",
  "metadata": {}
}
```

**Response:**
```json
{
  "event_id": "evt_987",
  "paired_timesheet_id": null,
  "message": "Punch recorded. Waiting for OUT to create timesheet."
}
```

#### POST `/upload`
Bulk upload CSV/Excel file

**Request:** Multipart form data
- `file`: CSV or Excel file
- `mapping` (optional): JSON column mapping config

**Response:**
```json
{
  "upload_id": "upl_123",
  "status": "processing",
  "message": "File accepted and queued for processing"
}
```

#### GET `/upload/:upload_id/status`
Get upload processing status

**Response:**
```json
{
  "id": "upl_123",
  "status": "completed",
  "total_rows": 100,
  "succeeded_rows": 95,
  "failed_rows": 5,
  "ignored_rows": 0,
  "failed_rows_details": [...]
}
```

#### GET `/uploads`
List all uploads for tenant (HR only)

**Response:**
```json
[
  {
    "id": "upl_123",
    "original_filename": "attendance.csv",
    "status": "completed",
    "total_rows": 100,
    "succeeded_rows": 95,
    "failed_rows": 5,
    "created_at": "2025-11-03T09:00:00Z"
  }
]
```

#### GET `/employee/:employee_id/timesheet?from=YYYY-MM-DD&to=YYYY-MM-DD`
Get attendance-derived timesheet entries for an employee

**Response:**
```json
{
  "employee_id": "emp_123",
  "period": { "from": "2025-11-01", "to": "2025-11-30" },
  "entries": [
    {
      "id": "entry_123",
      "work_date": "2025-11-03",
      "hours": 8.5,
      "start_time_utc": "2025-11-03T03:30:00Z",
      "end_time_utc": "2025-11-03T12:00:00Z",
      "source": "api",
      "payroll_status": "pending_for_payroll"
    }
  ]
}
```

#### POST `/upload/:upload_id/retry`
Retry failed rows in an upload

**Request:**
```json
{
  "force": false
}
```

## CSV/Excel Format

### Required Columns
- `employee_identifier` (or `employee_id`, `emp_id`, `employee_code`)
- `date` (or `work_date`, `attendance_date`)
- `time_in` (or `timein`, `check_in`, `punch_in`, `start_time`)

### Optional Columns
- `employee_email` - For employee lookup
- `time_out` - Punch out time
- `timezone` - Timezone (defaults to tenant timezone)
- `device_id` - Device identifier
- `notes` - Additional notes

### Sample CSV
```csv
employee_identifier,employee_email,date,time_in,time_out,timezone,notes
E123,jane.doe@acme.com,2025-11-03,09:00,17:30,Asia/Kolkata,onsite
E124,john.smith@acme.com,2025-11-03,08:50,17:00,Asia/Kolkata,
```

## Frontend Components

### Pages

1. **AttendanceUpload** (`/attendance/upload`)
   - File upload with drag & drop
   - Column mapping modal
   - File preview (first 10 rows)
   - Upload status with progress
   - Error display and retry

2. **AttendanceUploadHistory** (`/attendance/history`)
   - List of past uploads
   - Upload status and statistics
   - View failed rows
   - Retry failed uploads

### Navigation

Added to HR/CEO/Director navigation:
- "Attendance Upload" → `/attendance/upload`
- "Upload History" → `/attendance/history`

## Configuration

### Environment Variables

```env
# JWT Secret for authentication
JWT_SECRET=your-secret-key

# Database connection (if not using pool config)
DATABASE_URL=postgresql://user:pass@host:port/dbname

# File upload settings
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_STORAGE_PATH=./uploads  # Local storage path (production: use S3)
```

### Database Indexes

The migration creates optimized indexes for:
- `attendance_events(tenant_id, employee_id, date)`
- `attendance_uploads(tenant_id, status)`
- `attendance_upload_rows(upload_id, status, row_hash)`
- `timesheet_entries(employee_id, source, payroll_status)`

## Processing Flow

1. **File Upload**
   - File validated (type, size)
   - Upload record created with status "pending"
   - File stored (currently in-memory, production: S3/local)

2. **File Processing** (async)
   - Parse CSV/Excel file
   - Extract column headers
   - Auto-detect or use provided column mapping
   - Process rows:
     - Validate required fields
     - Lookup employee by identifier/email
     - Normalize dates/times to UTC
     - Calculate row hash for idempotency
     - Check for duplicates
     - Create timesheet entries
     - Track row status (success/failed/ignored)

3. **Timesheet Integration**
   - Attendance records create timesheet entries
   - Linked to weekly timesheets
   - Includes source tracking (api/upload)
   - Payroll status for downstream processing

## Error Handling

- Row-level validation errors stored in `attendance_upload_rows`
- Upload summary tracks success/failure counts
- Failed rows can be retried after corrections
- Error messages include row number and validation details

## Idempotency

- Row hash computed as: `SHA256(tenant_id|employee_id|date|start_utc|end_utc|source)`
- Duplicate uploads are detected and ignored
- Unique index prevents duplicate successful rows

## Security

- ✅ Multi-tenant isolation (all queries filtered by tenant_id)
- ✅ Role-based access (HR/CEO/Director only for uploads)
- ✅ JWT authentication required
- ✅ File type validation
- ✅ File size limits (50MB)
- ✅ Rate limiting on punch API (60 req/min)

## Deployment Notes

### 1. Database Migration

Run the migration file:
```bash
psql -U your_user -d your_database -f server/db/migrations/20251103_add_attendance_system.sql
```

### 2. Dependencies

Backend dependencies already included:
- `csv-parse` - CSV parsing
- `xlsx` - Excel parsing
- `multer` - File upload handling

No additional npm install required.

### 3. Storage

Currently files are processed in-memory. For production:
- Implement S3/local file storage
- Update `storage_path` in `attendance_uploads` table
- Add file cleanup job for old uploads

### 4. Background Processing

Currently processing happens synchronously. For production:
- Implement job queue (BullMQ, Sidekiq, etc.)
- Move `processAttendanceUpload` to worker
- Add job status tracking

### 5. Notifications

TODO: Implement notification service for:
- Upload completion notifications
- Failed row alerts to HR/managers
- Email/in-app notifications

## Testing

### Manual Testing

1. **Punch API:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/attendance/punch \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "employee_id": "emp_123",
       "timestamp": "2025-11-03T09:00:00+05:30",
       "type": "IN"
     }'
   ```

2. **Upload:**
   - Use frontend UI at `/attendance/upload`
   - Download sample template
   - Upload CSV/Excel file
   - Configure column mapping if needed
   - Monitor processing status

3. **View History:**
   - Navigate to `/attendance/history`
   - View past uploads
   - Check failed rows
   - Retry if needed

## Future Enhancements

- [ ] Streaming processing for large files (100k+ rows)
- [ ] Webhook notifications for external systems
- [ ] Virus scanning for uploaded files
- [ ] Advanced timezone conversion library (luxon/moment)
- [ ] Batch processing job queue
- [ ] Email notifications
- [ ] Export upload results to CSV
- [ ] Bulk employee attendance export

## Support

For issues or questions:
1. Check upload status and error messages
2. Review `attendance_upload_rows` for failed row details
3. Check server logs for processing errors
4. Verify database migration was successful

