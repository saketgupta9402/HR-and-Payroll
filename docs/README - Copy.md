# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/314472f0-9de3-4bb2-84ca-b26dd53941cc

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/314472f0-9de3-4bb2-84ca-b26dd53941cc) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/314472f0-9de3-4bb2-84ca-b26dd53941cc) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

# Petal HR Suite Addendum: Approval, CSV Import, Opal AI API
## Staffing: Skills + AI Candidate Suggestions

### Backend Endpoints
- Skills & Certs
  - GET/POST `/api/v1/employees/:id/skills`
  - GET/POST `/api/v1/employees/:id/certifications`
- Projects
  - POST `/api/v1/projects`
  - POST `/api/v1/projects/:id/suggest-candidates` → returns prioritized candidates with `final_score` and `breakdown`
  - POST `/api/v1/projects/:id/assign` → respects 100% utilization unless HR override is provided

### AI Suggester
- Server-only: `server/services/ai/suggester.js`
- Combines skill match, cert bonus, availability, and past project fit (extensible) and logs to `ai_suggestion_logs`.
- Configure thresholds via request body: `{ include_overloaded: boolean, util_threshold: number }`.

### Frontend Pages
- `/profile/skills` — manage personal skills; adding a skill updates the profile immediately.
- `/projects/new` — create a project with required skills; redirects to suggestions.
- `/projects/:id/suggestions` — list of candidates with score bar, filters (min availability, include overloaded), and assignment modal.
- `/ceo/dashboard` — entry point for staffing flow.

### Run Locally
- Apply migration `server/db/migrations/20251030_skills_projects.sql`.
- `npm install` (adds `reactflow`)
- Start backend and frontend; log in as HR/CEO to access staffing routes.


---

## Database
- Run SQL migration in `server/db/migrations/20251030_add_approvals.sql` for approval/audit tables and thresholds.
- Existing tables for users, employees, orgs as in `server/db/schema.sql` or `full-schema.sql`.

---

## Approval Workflow
- Approvals for leave/expenses use the `/api/approvals/*` endpoints.
- Thresholds for HR stage approval can be set per-tenant in the `hr_approval_thresholds` table or via env vars.
- Audit log for each approval stage; see `approval_audit`.

---

## CSV Import
- New endpoint: `POST /api/v1/orgs/{org_id}/employees/import`
  - Auth required.
  - Multipart/form: field `csv` (CSV upload) or JSON `rows` for data; mapping object required if headers are not standard.
  - `preview=true` returns first 10 rows and auto-mapping for UI.
  - Returns `{imported_count, failed_count, errors, warnings}`. For per-row failures, see detailed errors array.

**Sample CSV** (`first_name,last_name,email,employee_id,department,role,manager_email,join_date,work_location,phone`)

---

## AI/Opal Integration
- Add API Key in backend: `export AI_TOOL_API_KEY="your-long-key"`
- Tool endpoints (as required by Opal/Google Opal):
  - GET `/discovery` (manifest)
  - POST `/api/ai/roster/generate` (shift roster)
  - POST `/api/ai/csv/diagnose` (CSV mapping diagnostcs)
  - GET `/api/ai/policy/explain?topic=leave-approval|expense-approval`
  - API expects header: `x-api-key: your-long-key` (set or rotate in `.env`)
- See `/api/ai/openapi.json` for OpenAPI manifest for tool registration.

**cURL example:**
```
curl -H "x-api-key: your-long-key" http://localhost:3001/discovery
```

**Registering with Opal:**
- Point discovery endpoint to `/discovery`.
- Paste API key where Opal/Google UI requests it.
- Tool API will appear in the Opal tool registry for shift, CSV, and policies.

---

## Runbook: Rollback/Disabling AI/Import
- To disable the AI endpoints quickly: unset `AI_TOOL_API_KEY` and restart the backend _or_ temporarily comment `/api/ai` route in `server/index.js`.
- To rollback failed import: see logs for import job id and manually remove (in a transaction!) the uploaded employees/profiles in batch if needed. See errors in `errors` array from import result.
- To reset approval thresholds for org: update `hr_approval_thresholds` table or set env vars if defaults are incorrect.
- To test CSV: sample files are in `test/` or use the template shown in UI.

# FAQ