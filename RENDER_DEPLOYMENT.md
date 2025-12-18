# Render Deployment Guide

## Issue: Docker Detection

If Render is trying to use Docker and you see an error about missing Dockerfile, follow these steps:

## Solution 1: Manual Service Configuration (Recommended)

1. **Go to Render Dashboard** → Create New → **Web Service**

2. **Connect your GitHub repository**: `geijin5/ADLC-Emergency-App`

3. **Configure the service manually** (don't use render.yaml if it's causing issues):

   - **Name**: `adlc-emergency-app`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: (leave empty - root of repo)
   - **Build Command**: 
     ```
     npm run install-all && npm run build
     ```
   - **Start Command**: 
     ```
     npm start
     ```

4. **Set Environment Variables**:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render sets this automatically, but you can set it)
   - `JWT_SECRET` = (your strong secret key)
   - `VAPID_PUBLIC_KEY` = (your VAPID public key)
   - `VAPID_PRIVATE_KEY` = (your VAPID private key)

5. **Click "Create Web Service"**

## Solution 2: Delete render.yaml (if causing issues)

If Render keeps trying to use Docker, you can temporarily remove or rename `render.yaml` and configure manually as above.

## Solution 3: Create a Dockerfile (Alternative)

If you prefer Docker, we can create a Dockerfile, but Node.js native deployment is simpler.

## Important Notes

- Render will automatically set the `PORT` environment variable
- Make sure all environment variables are set before deploying
- The build process installs dependencies for root, server, and client
- The production server serves the built React app from `client/build`

## Troubleshooting

### Build Fails
- Check that all dependencies are in package.json files
- Verify Node version (should be 18+ or 20+)

### Start Command Fails
- Check that `server/start-production.js` exists
- Verify `NODE_ENV=production` is set
- Check server logs in Render dashboard

### Database Issues
- SQLite database will be created automatically
- Database file is stored in the server directory
- Note: SQLite on Render may have limitations; consider PostgreSQL for production

## After Deployment

1. Your app will be available at: `https://your-app-name.onrender.com`
2. Test the public side first
3. Login with admin credentials
4. Verify push notifications work (may need HTTPS)

