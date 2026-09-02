# Deployment Guide - Vercel + Railway

## Overview

This guide will help you deploy:
- **Frontend** → Vercel
- **Backend** → Railway

## Prerequisites

1. GitHub account with the project repository
2. Vercel account (https://vercel.com)
3. Railway account (https://railway.app)
4. Supabase project (https://supabase.com) with the database setup

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Project

1. Go to https://railway.app and sign in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Select the **`api`** directory as the root
5. Railway will auto-detect Node.js

### 1.2 Configure Environment Variables

Go to **Settings → Variables** and add:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ACCESS_TOKEN_SECRET=generate_with_openssl_rand_hex_64
REFRESH_TOKEN_SECRET=generate_with_openssl_rand_hex_64
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
```

To generate secrets, run:
```bash
openssl rand -hex 64
```

### 1.3 Get Your Backend URL

1. After deployment, Railway will provide a URL like: `https://your-project.up.railway.app`
2. Test it: `https://your-project.up.railway.app/api/health`
3. Should return: `{"status":"OK","db":"supabase",...}`

**Save this URL - you'll need it for the frontend!**

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Project

1. Go to https://vercel.com and sign in
2. Click **"Add New..." → "Project"**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Configure Environment Variables

Go to **Settings → Environment Variables** and add:

```
VITE_API_URL=https://your-project.up.railway.app
```

**IMPORTANT**: Replace `your-project.up.railway.app` with your actual Railway backend URL.

### 2.3 Deploy

1. Click **"Deploy"**
2. Wait for build to complete
3. Your frontend will be live at: `https://your-project.vercel.app`

---

## Step 3: Update CORS Configuration

### 3.1 Update Railway Environment

Go back to Railway → Settings → Variables and update:

```
CORS_ORIGIN=https://your-project.vercel.app
```

### 3.2 Redeploy Backend

1. In Railway, go to **Deployments**
2. Click **"Redeploy"** to apply the CORS change

---

## Step 4: Test the Deployment

1. Open your Vercel frontend URL
2. Try logging in with demo credentials:
   - **Manager**: `manager1` / `Manager@123`
   - **Dispatcher**: `dispatcher1` / `Dispatcher@123`
   - **Technician**: `tech1` / `Tech@123`
   - **Customer**: `customer1` / `Customer@123`

---

## Troubleshooting

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly in Vercel
- Check Railway logs for errors
- Ensure CORS_ORIGIN includes your Vercel domain

### Backend not starting
- Check Railway logs
- Verify all environment variables are set
- Ensure Supabase credentials are correct

### 401 Unauthorized errors
- Check that JWT secrets are set in Railway
- Verify Supabase service role key is correct

---

## Useful Commands

### Generate JWT Secrets
```bash
# On macOS/Linux
openssl rand -hex 64

# On Windows PowerShell
-join ((1..64) | ForEach-Object { '{0:x2}' -f (Get-Random -Minimum 0 -Maximum 255) })
```

### Test Backend Health
```bash
curl https://your-project.up.railway.app/api/health
```

---

## Environment Variables Summary

### Backend (Railway)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |
| `ACCESS_TOKEN_SECRET` | JWT access token secret |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret |
| `CORS_ORIGIN` | Frontend URL (e.g., https://xxx.vercel.app) |
| `NODE_ENV` | Set to `production` |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (e.g., https://xxx.up.railway.app) |
