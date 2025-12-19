# Quick Fix: Prevent Data Loss on Render

## Immediate Solution (Temporary)

Until you migrate to PostgreSQL, you can minimize data loss:

### Option 1: Manual Backup Before Deploy

1. **Before deploying**, export your current data:
   - Go to your Render dashboard
   - Access your service's shell/console
   - Download the `emergency.db` file
   - Keep it safe

2. **After deploying**, restore the data:
   - Upload the `emergency.db` file back
   - Restart the service

**Note**: This is tedious and not recommended for production.

### Option 2: Auto-Create Admin User

The code already auto-creates an admin user on startup:
- **Username**: `admin`
- **Password**: `admin123`

So at least you can always log in after a deploy, but you'll need to recreate all other users.

### Option 3: Use Environment Variables for Initial Users

You could store initial user data in environment variables and create them on startup, but this is not secure for passwords.

## Recommended Solution

**Migrate to PostgreSQL** - See `DATABASE_MIGRATION.md` for full instructions.

The `render.yaml` file has been updated to include a PostgreSQL database service. Once you:
1. Create the PostgreSQL database on Render
2. Update the code to use PostgreSQL (requires code changes)

Your data will persist across deployments.

## Current Status

- ✅ `render.yaml` configured for PostgreSQL
- ✅ `pg` package added to dependencies
- ⚠️ **Code still uses SQLite** - needs migration to PostgreSQL

