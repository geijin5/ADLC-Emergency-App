# Render Deployment Guide

## Issue: Docker Detection

If Render is trying to use Docker and you see an error about missing Dockerfile, follow these steps:

## Solution 1: Use render.yaml (Try This First)

The repository now includes a `render.yaml` file that explicitly sets `env: node`. 

1. **Go to Render Dashboard** → Create New → **Blueprint** (not Web Service)
2. **Connect your GitHub repository**: `geijin5/ADLC-Emergency-App`
3. **Render will automatically detect and use `render.yaml`**
4. **Set Environment Variables** in the Render dashboard:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (your strong secret key)
   - `VAPID_PUBLIC_KEY` = (your VAPID public key - optional)
   - `VAPID_PRIVATE_KEY` = (your VAPID private key - optional)
5. **Click "Apply"**

## Solution 2: Manual Service Configuration (If Blueprint Fails)

If the Blueprint method still tries to use Docker, configure manually:

1. **Go to Render Dashboard** → Create New → **Web Service**

2. **Connect your GitHub repository**: `geijin5/ADLC-Emergency-App`

3. **IMPORTANT**: Before clicking "Create", make sure:
   - **Environment** is set to **"Node"** (NOT "Docker")
   - If you see "Docker" selected, change it to "Node"

4. **Configure the service manually**:

   - **Name**: `adlc-emergency-app`
   - **Environment**: `Node`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: (leave empty - root of repo)
   - **Build Command**: 
     ```
     npm run render-build
     ```
     
     Or alternatively:
     ```
     npm install && cd server && npm install && cd ../client && npm install && cd ../client && npm run build
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

If Render keeps trying to use Docker despite having `render.yaml` with `env: node`, follow these steps:

1. **Delete or rename `render.yaml`** from your repository:
   ```bash
   git rm render.yaml
   git commit -m "Remove render.yaml to prevent Docker detection"
   git push origin main
   ```

2. **Then use Solution 1** (Manual Service Configuration) above.

3. **Alternative**: If you want to keep `render.yaml`, make sure it has `env: node` explicitly set (which it does), but Render sometimes ignores this. In that case, manual configuration is more reliable.

## Solution 3: Create a Dockerfile (Alternative)

If you prefer Docker, we can create a Dockerfile, but Node.js native deployment is simpler.

## Important Notes

- Render will automatically set the `PORT` environment variable
- Make sure all environment variables are set before deploying
- The build process installs dependencies for root, server, and client
- The production server serves the built React app from `client/build`

## Troubleshooting

### Build Fails (Status 1)

If you see "exited with status 1 while building", check the build logs in Render dashboard for specific errors. Common issues:

1. **Node Version Mismatch**:
   - Check `.nvmrc` file specifies Node 20
   - In Render settings, ensure Node version is set to 20.x
   - Or add `"engines": { "node": ">=20.0.0" }` to root `package.json`

2. **Missing Dependencies**:
   - Verify all `package.json` files have correct dependencies
   - Check that `npm install` completes successfully for root, server, and client

3. **Build Memory Issues**:
   - React builds can be memory-intensive
   - Try: `NODE_OPTIONS=--max_old_space_size=4096 npm run build` in build command

4. **Syntax Errors**:
   - Check for JavaScript/React syntax errors in client code
   - Look for missing imports or undefined variables

5. **Alternative Build Command** (if default fails):
   ```
   npm install && (cd server && npm install) && (cd client && npm install) && (cd client && npm run build)
   ```

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


