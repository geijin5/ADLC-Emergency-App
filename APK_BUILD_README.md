# APK Build Instructions

This project includes a GitHub Actions workflow that automatically builds an Android APK from the PWA on every push to the `main` branch.

## How It Works

1. **Automatic Build**: When you push to the `main` branch, GitHub Actions will:
   - Build the React app
   - Use Bubblewrap (Google's TWA tool) to convert the PWA to an Android APK
   - Upload the APK as a workflow artifact
   - Create a GitHub release if a release tag is created

2. **Render Deployment**: Render will automatically deploy the web version on push (via webhook integration)

## Accessing the APK

### Option 1: Download from GitHub Actions
1. Go to the **Actions** tab in your GitHub repository
2. Click on the latest workflow run
3. Scroll down to the **Artifacts** section
4. Download `adlc-emergency-apk`

### Option 2: GitHub Release
When you create a GitHub release:
1. Create a new release in the GitHub Releases page
2. The workflow will automatically attach the APK to the release
3. Download the APK from the release page

## Configuration

### Required Secrets (Optional)

If you want to use a custom app URL, add this secret in GitHub Settings → Secrets and variables → Actions:

- `APP_URL`: Your deployed app URL (e.g., `https://your-app.onrender.com`)

If not set, it will use a default URL. The workflow will still work without this secret.

## Manual Build

To build the APK locally:

```bash
# Install dependencies
npm run install-all

# Build React app
cd client
npm run build
cd ..

# Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# Initialize TWA project (first time only)
cd client
bubblewrap init --manifest=https://your-app-url/manifest.json

# Build APK
bubblewrap build
```

The APK will be in the `client/twa/` directory.

## Notes

- The APK is built unsigned (for testing). To distribute, you'll need to sign it with a keystore.
- The workflow uses Bubblewrap, which creates a Trusted Web Activity (TWA) wrapper around your PWA.
- Render deployment happens automatically via webhook - no changes needed.

