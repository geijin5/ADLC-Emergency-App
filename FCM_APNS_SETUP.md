# Firebase Cloud Messaging (FCM) and Apple Push Notification Service (APNs) Setup

## Firebase Cloud Messaging (FCM) Setup for Android

### Prerequisites
- Google account
- Firebase project

### Steps

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project"
   - Follow the setup wizard

2. **Enable Cloud Messaging API**
   - In Firebase Console, go to Project Settings
   - Navigate to "Cloud Messaging" tab
   - Enable Cloud Messaging API (if not already enabled)

3. **Generate Service Account Key**
   - In Firebase Console, go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

4. **Configure Environment Variables**
   - Add the service account key JSON content to `.env` file:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
   ```
   - Or set it as an environment variable in your deployment platform

5. **Android App Configuration**
   - In Firebase Console, add an Android app to your project
   - Download `google-services.json`
   - Place it in `client/android/app/` directory
   - Register device tokens from the Android app (see client-side implementation)

### Device Token Registration

The Android app needs to:
1. Get the FCM token using Firebase SDK
2. Send the token to the server via API endpoint (to be implemented)
3. Store the token with platform='android' in the database

## Apple Push Notification Service (APNs) Setup for iOS

### Prerequisites
- Apple Developer account ($99/year)
- Mac computer (for key generation)

### Steps

1. **Generate APNs Authentication Key**
   - Go to [Apple Developer Portal](https://developer.apple.com/account/)
   - Navigate to Certificates, Identifiers & Profiles
   - Go to Keys section
   - Click "+" to create a new key
   - Enable "Apple Push Notifications service (APNs)"
   - Download the key file (`.p8` file)
   - Note the Key ID and Team ID

2. **Configure App ID**
   - In Apple Developer Portal, go to Identifiers
   - Select your App ID
   - Enable "Push Notifications" capability
   - Save the Bundle ID (e.g., `com.yourcompany.adlc-emergency`)

3. **Configure Environment Variables**
   Add to `.env` file:
   ```
   APN_KEY_ID=your-key-id
   APN_TEAM_ID=your-team-id
   APN_KEY_PATH=/path/to/AuthKey_XXXXX.p8
   APN_BUNDLE_ID=com.yourcompany.adlc-emergency
   APN_PRODUCTION=false  # Set to true for production
   ```

   For deployment platforms (like Render):
   - Upload the `.p8` file securely
   - Set environment variables with the path to the key file

4. **iOS App Configuration**
   - Enable Push Notifications capability in Xcode
   - Register for remote notifications
   - Get the device token from iOS
   - Send the token to the server via API endpoint (to be implemented)

### Device Token Registration

The iOS app needs to:
1. Register for remote notifications using `UNUserNotificationCenter`
2. Get the device token from `didRegisterForRemoteNotificationsWithDeviceToken`
3. Send the token to the server via API endpoint (to be implemented)
4. Store the token with platform='ios' in the database

## API Endpoints for Device Token Registration

### Register Android Device Token
```
POST /api/personnel/push/register-device
Body: {
  deviceToken: string,
  platform: 'android'
}
```

### Register iOS Device Token
```
POST /api/personnel/push/register-device
Body: {
  deviceToken: string,
  platform: 'ios'
}
```

These endpoints will store the device token in the database with the appropriate platform flag.

## Testing

### Test FCM
1. Use Firebase Console → Cloud Messaging → Send test message
2. Or use the notification management UI with test mode enabled

### Test APNs
1. Use Apple's APNs Testing Tool
2. Or use the notification management UI with test mode enabled
3. Ensure APN_PRODUCTION matches your environment (false for development, true for production)

## Troubleshooting

### FCM Issues
- Verify service account key JSON is valid
- Check that Cloud Messaging API is enabled
- Ensure device token is correctly formatted
- Check Firebase Console logs for errors

### APNs Issues
- Verify key file path is correct and accessible
- Check that Key ID and Team ID match
- Ensure Bundle ID matches your app
- Verify APN_PRODUCTION setting matches environment
- Check APNs connection logs in server console

## Security Notes

- **Never commit service account keys or APNs keys to version control**
- Store keys securely in environment variables or secret management systems
- Rotate keys periodically
- Use separate keys for development and production when possible

