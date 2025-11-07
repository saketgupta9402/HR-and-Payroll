# How to Run the HR Suite System

This guide provides multiple options for running the application, depending on your setup preferences.

## 🚀 Quick Start Options

### Option 1: Using Docker (Recommended)

#### Prerequisites
- Docker and Docker Compose installed
- Supabase account (if using cloud) OR local Supabase setup

#### Step 1: Set Up Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Configuration
# Get these from: https://app.supabase.com/project/oopgvhkegreimslgqypl/settings/api
VITE_SUPABASE_URL=https://oopgvhkegreimslgqypl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

#### Step 2: Run with Docker

**Production Mode:**
```bash
docker-compose up --build
```
Access at: http://localhost:8080

**Development Mode (with hot reload):**
```bash
docker-compose --profile dev up app-dev --build
```
Access at: http://localhost:3000

#### Step 3: Stop the Application
```bash
docker-compose down
```

---

### Option 2: Using Node.js Directly (Without Docker)

#### Prerequisites
- Node.js 18+ installed
- npm or yarn

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Set Up Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://oopgvhkegreimslgqypl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

#### Step 3: Run Development Server
```bash
npm run dev
```

The app will start at: http://localhost:8080

#### Step 4: Build for Production
```bash
npm run build
npm run preview
```

---

### Option 3: Full Stack with Local Supabase (Advanced)

If you want to run Supabase locally with Docker:

#### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

#### Step 2: Start Local Supabase
```bash
supabase start
```

This will start:
- Postgres database
- Supabase Studio (http://localhost:54323)
- API Gateway (http://localhost:54321)
- Auth, Storage, and other services

#### Step 3: Update `.env` file
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<get-from-supabase-status>
```

Run `supabase status` to get the anon key.

#### Step 4: Run Database Migrations
```bash
supabase db reset
```

This applies all migrations from the `supabase/migrations/` folder.

#### Step 5: Run the Frontend

Follow Option 2 (Node.js) or Option 1 (Docker) above.

---

## 📋 Environment Variables Explained

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key | Supabase Dashboard → Settings → API |

**For Cloud Supabase:**
- URL format: `https://[project-id].supabase.co`
- Get keys from: https://app.supabase.com/project/oopgvhkegreimslgqypl/settings/api

**For Local Supabase:**
- URL: `http://localhost:54321`
- Get keys by running: `supabase status`

---

## 🔧 Troubleshooting

### Port Already in Use
If port 8080 is already in use:
- **Docker**: Edit `docker-compose.yml` and change `8080:80` to another port (e.g., `3001:80`)
- **Node.js**: Edit `vite.config.ts` and change the port number

### Environment Variables Not Loading
- Ensure `.env` file is in the project root (same level as `package.json`)
- Restart the development server after creating/updating `.env`
- For Vite, environment variables must start with `VITE_`

### Database Connection Issues
- Verify your Supabase URL and keys are correct
- Check if your Supabase project is active and not paused
- For local Supabase, ensure `supabase start` completed successfully

### Docker Build Fails
- Clear Docker cache: `docker-compose build --no-cache`
- Check Docker has enough resources allocated
- Ensure Docker is running

---

## 📁 Project Structure

```
petal-hr-suite/
├── src/                    # React application source
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # Database migrations
├── Dockerfile             # Production Docker image
├── Dockerfile.dev         # Development Docker image
├── docker-compose.yml     # Docker orchestration
└── .env                   # Environment variables (create this)
```

---

## 🎯 Next Steps After Running

1. **Access the Application**
   - Open http://localhost:8080 (or your configured port)
   - You should see the login page

2. **First Time Setup**
   - Create a CEO account to set up your organization
   - Or use existing credentials if you have them

3. **Explore Features**
   - Employee Management
   - Leave Requests
   - Timesheets
   - Appraisals
   - Org Chart
   - Workflows
   - And more!

---

## 💡 Tips

- **Development**: Use `npm run dev` or `docker-compose --profile dev` for hot reload
- **Production**: Use Docker with the production build for best performance
- **Database**: Make sure migrations are applied if using local Supabase
- **Logs**: Check Docker logs with `docker-compose logs app` or `docker-compose logs app-dev`

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

---

## ❓ Need Help?

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Docker logs: `docker-compose logs`
3. Verify environment variables are set correctly
4. Ensure all prerequisites are installed

