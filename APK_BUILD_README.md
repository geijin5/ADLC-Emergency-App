# APK Build Instructions

This project includes a GitHub Actions workflow that automatically builds an Android APK from the React app on every push to the `main` branch.

## How It Works

1. **Automatic Build**: When you push to the `main` branch, GitHub Actions will:
   - Build the React app
   - Use Capacitor to wrap the app as a native Android app
   - Build the APK using Gradle
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

No additional configuration is required! The workflow works automatically using the local build files.

## Manual Build

To build the APK locally:

```bash
# Install dependencies
npm run install-all

# Build React app
cd client
npm run build

# Install Capacitor CLI (if not already installed)
npm install -g @capacitor/cli

# Initialize Capacitor (first time only)
npx cap init "ADLC Emergency Services" "com.adlc.emergency" --web-dir=build

# Add Android platform (first time only)
npx cap add android

# Sync web assets
npx cap sync android

# Build APK
cd android
./gradlew assembleRelease
```

The APK will be in `client/android/app/build/outputs/apk/release/`.

## Notes

- The APK is built unsigned (for testing). To distribute, you'll need to sign it with a keystore.
- The workflow uses Capacitor, which wraps your React app in a native Android container.
- Render deployment happens automatically via webhook - no changes needed.
- If the APK build fails, it won't block Render deployment.

