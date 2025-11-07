# Running the Application with Docker

## Prerequisites
- Docker and Docker Compose installed and running
- Supabase project credentials

## Setup Steps

### 1. Create Environment File
Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
```

You can get these values from your Supabase project dashboard:
https://app.supabase.com/project/{project_id}/settings/api

### 2. Run the Application

**Option A: Production Build (Recommended)**
```bash
docker-compose up --build
```
This will build and run the production version using nginx.
Access the app at: http://localhost:8080

**Option B: Development Mode (with hot reload)**
```bash
docker-compose --profile dev up app-dev --build
```
This runs the Vite dev server with hot reload enabled.
Access the app at: http://localhost:3000

### 3. Stop the Application
```bash
docker-compose down
```

## Troubleshooting

- If port 8080 is already in use, change it in `docker-compose.yml`
- Make sure your `.env` file is in the project root directory
- Check Docker logs: `docker-compose logs app`

## Alternative: Run Without Docker

If you prefer to run without Docker:
```bash
npm install
npm run dev
```

Then access at http://localhost:8080
