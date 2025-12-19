# URGENT: Fix Users Being Deleted & Push Notifications

## Problem 1: Users Keep Being Deleted

**Root Cause**: The app is still using SQLite, which is **ephemeral** on Render. Every deploy wipes the database.

**Solution**: You MUST set up PostgreSQL on Render. The code is ready, but you need to:

### Step 1: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Name it: `adlc-emergency-db`
4. Click **"Create Database"**
5. **Copy the Internal Database URL** (starts with `postgres://...`)

### Step 2: Add DATABASE_URL to Your Web Service

1. Go to your Web Service settings
2. Click **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Key: `DATABASE_URL`
5. Value: Paste the Internal Database URL from Step 1
6. Click **"Save Changes"**

### Step 3: Redeploy

Render will automatically redeploy. Once done, your data will persist!

---

## Problem 2: Push Notifications Not Working

**Possible Causes**:

1. **VAPID keys not configured** - Check if `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set in Render environment variables
2. **Database queries still using old pattern** - Some routes need updating

### Quick Fix for Push Notifications:

1. **Check VAPID Keys**:
   - Go to Render dashboard → Your Web Service → Environment
   - Verify `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set
   - If not, generate them:
     ```bash
     npx web-push generate-vapid-keys
     ```
   - Add both keys to Render environment variables

2. **The code will be updated** to fix remaining database query issues

---

## Current Status

- ✅ Database adapter created (supports both SQLite & PostgreSQL)
- ✅ Table creation updated
- ✅ Login route updated
- ✅ Push notification routes updated
- ⚠️ **~50 more routes need database query updates** (in progress)
- ⚠️ **PostgreSQL database not created on Render yet**

## Next Steps

1. **IMMEDIATE**: Create PostgreSQL database on Render (see Step 1 above)
2. **IMMEDIATE**: Add DATABASE_URL environment variable
3. Code updates will continue to convert remaining routes

