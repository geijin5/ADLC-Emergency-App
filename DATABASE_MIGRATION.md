# Database Migration Guide

## ⚠️ Why Users Reset on Render

**The Problem**: Render's filesystem is **ephemeral** (temporary). This means:
- Any files written to disk (like SQLite database files) are **deleted** when:
  - The service restarts
  - A new version is deployed
  - The service is stopped/started
- Your `emergency.db` SQLite file is **lost on every redeploy**
- This causes **all users, departments, and data to reset**

**This is why your users disappear after each deployment!**

## Solution
Use **Render's PostgreSQL database service**, which provides **persistent storage** that survives redeployments.

## Migration Steps

### 1. Create PostgreSQL Database on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `adlc-emergency-db`
   - **Database**: `adlc_emergency`
   - **User**: `adlc_emergency_user`
   - **Plan**: Free (or paid if you need more)
4. Click **"Create Database"**
5. Copy the **Internal Database URL** (it will look like: `postgres://user:password@host:5432/database`)

### 2. Update Environment Variables

1. Go to your Web Service settings on Render
2. Add/Update environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: The Internal Database URL from step 1

### 3. Install PostgreSQL Client

The `pg` package is already added to `server/package.json`. After deploying, Render will install it automatically.

### 4. Update Code to Use PostgreSQL

The code needs to be updated to use PostgreSQL instead of SQLite. This requires:

1. Using `pg` (PostgreSQL client) instead of `sqlite3`
2. Updating SQL syntax (PostgreSQL uses different syntax for some operations)
3. Handling connection pooling

**Note**: This is a significant code change. The current codebase uses SQLite-specific syntax that needs to be converted to PostgreSQL-compatible SQL.

### Alternative: Quick Fix (Temporary)

If you need a quick fix while planning the migration:

1. **Backup before redeploy**: Export your database before each deployment
2. **Restore after redeploy**: Import the database after deployment
3. **Use Render's persistent disk** (if available on your plan)

However, the **recommended long-term solution** is to migrate to PostgreSQL.

## Current Status

- ✅ `render.yaml` updated to include PostgreSQL database service
- ✅ `pg` package added to `server/package.json`
- ⚠️ **Code migration still needed** - The server code needs to be updated to use PostgreSQL instead of SQLite

## Next Steps

1. Create the PostgreSQL database on Render (follow step 1 above)
2. The `DATABASE_URL` will be automatically set by Render
3. Update `server/index.js` to use PostgreSQL when `DATABASE_URL` is present
4. Test the migration in a development environment first

## SQL Differences to Consider

- **AUTOINCREMENT** → **SERIAL** or **BIGSERIAL**
- **INTEGER PRIMARY KEY** → **SERIAL PRIMARY KEY**
- **TEXT** → **VARCHAR** or **TEXT** (both work)
- **REAL** → **DOUBLE PRECISION** or **REAL**
- **DATETIME** → **TIMESTAMP**
- **INTEGER DEFAULT 1** → **BOOLEAN DEFAULT true** (for is_active)
- **JSON.parse()** → PostgreSQL has native JSON support

## Need Help?

If you need help with the migration, the main changes needed are in `server/index.js`:
- Replace `sqlite3.Database` with `pg.Pool`
- Update all SQL queries to be PostgreSQL-compatible
- Update callback-based queries to use promises/async-await

