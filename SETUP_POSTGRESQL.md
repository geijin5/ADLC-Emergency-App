# 🚨 URGENT: Setup PostgreSQL to Stop Users Being Deleted

## The Problem

Your users keep being deleted because **SQLite is ephemeral on Render**. Every time you deploy, the database file is wiped.

## The Solution

You **MUST** set up PostgreSQL on Render. The code is already ready - you just need to create the database.

## Step-by-Step Instructions

### Step 1: Create PostgreSQL Database

1. Go to **https://dashboard.render.com**
2. Click the **"New +"** button (top right)
3. Select **"PostgreSQL"**
4. Fill in:
   - **Name**: `adlc-emergency-db`
   - **Database**: `adlc_emergency` (or leave default)
   - **User**: `adlc_emergency_user` (or leave default)
   - **Region**: Same as your web service (probably `Oregon`)
   - **Plan**: Free (or paid if you need more)
5. Click **"Create Database"**
6. **Wait for it to be created** (takes ~1 minute)

### Step 2: Get the Database URL

1. Once created, click on your new database
2. Go to the **"Info"** tab
3. Find **"Internal Database URL"**
4. **Copy the entire URL** (looks like: `postgres://user:password@host:5432/database`)

### Step 3: Add to Web Service

1. Go to your **Web Service** (not the database)
2. Click on it to open settings
3. Go to **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied
6. Click **"Save Changes"**

### Step 4: Redeploy

Render will automatically redeploy your service. Once it's done:
- ✅ Your data will persist across deployments
- ✅ Users won't be deleted anymore
- ✅ All your data will be saved permanently

## Verify It's Working

After redeploy, check the logs:
1. Go to your Web Service → **"Logs"** tab
2. Look for: `✅ PostgreSQL database connection established`
3. If you see that, it's working!

## Troubleshooting

**If you see "SQLite database connection established"**:
- The `DATABASE_URL` environment variable is not set correctly
- Double-check Step 3

**If the service won't start**:
- Check the logs for database connection errors
- Make sure the Internal Database URL is correct
- The database must be in the same region as your web service

## Push Notifications

For push notifications to work, you also need:
1. **VAPID_PUBLIC_KEY** environment variable
2. **VAPID_PRIVATE_KEY** environment variable

To generate them:
```bash
npx web-push generate-vapid-keys
```

Then add both keys to your Web Service environment variables.

