# Smart Meal Planner Mobile App

A Flutter-based mobile application for meal planning, grocery shopping, and recipe management.

## Setup Instructions

### Prerequisites

- Flutter SDK: Version 3.0.0 or higher
- Android Studio or VS Code with Flutter extensions
- Android SDK for Android builds
- Xcode for iOS builds (Mac only)

### Getting Started

1. **Clone the repository**

2. **Install dependencies**
   ```bash
   cd meal_planner_app
   flutter pub get
   ```

3. **Update API Configuration**
   - In `lib/services/api_service.dart`, update the `ApiConfig` with your backend URLs:
     ```dart
     class ApiConfig {
       static const String baseUrl = "https://your-production-api.com";
       static const String localBaseUrl = "http://10.0.2.2:8000"; // Points to localhost:8000 in Android emulator
       static const String activeUrl = localBaseUrl; // Change to baseUrl for production builds
     }
     ```

4. **Run the app**
   ```bash
   flutter run
   ```

## Building for Production

### Android

1. **Generate keystore for signing**
   ```bash
   keytool -genkey -v -keystore ~/smartmealplanner.keystore -alias smartmealplanner -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Create `android/key.properties` file**
   ```
   storePassword=<password from above>
   keyPassword=<password from above>
   keyAlias=smartmealplanner
   storeFile=<location of the keystore file, e.g., /Users/user/smartmealplanner.keystore>
   ```

3. **Update API endpoint to production**
   - In `lib/services/api_service.dart`, set `activeUrl = baseUrl`

4. **Build APK**
   ```bash
   flutter build apk --release
   ```
   
   or for an AAB file (preferred for Play Store):
   ```bash
   flutter build appbundle --release
   ```

### iOS (requires Mac)

1. **Setup iOS signing**
   ```bash
   open ios/Runner.xcworkspace
   ```
   - Configure signing in Xcode's project settings

2. **Build IPA**
   ```bash
   flutter build ios --release
   ```
   - Archive and upload to App Store using Xcode

## Features

- User authentication with JWT tokens
- User profile management
- Meal planning and generation
- Recipe browsing and saving
- Shopping list creation
- Store integration and comparison
- Order placement

## Project Structure

- **lib/**
  - **common/**: Theme and shared UI components
  - **Providers/**: State management classes 
  - **Screens/**: App screens
  - **services/**: API services and data handling
  - **main.dart**: App entry point

## Dependencies

- **provider**: State management
- **http**: Network requests
- **shared_preferences**: Local storage
- **jwt_decoder**: JWT token handling

## Development Notes

- The app uses the Provider package for state management
- JWT authentication is used for all protected API endpoints
- Secure storage is used for persisting authentication tokens
- Backend API expects and returns JSON data

## Android-specific Configuration

- API Level 21 (Android 5.0) or higher required
- Internet permissions are specified in AndroidManifest.xml
- Location permissions added for store location features

## iOS-specific Configuration

- iOS 9.0 or higher required
- Camera and photo library permissions needed for profile images
- Location permissions for store features

## Troubleshooting

- **API connection issues**: Make sure the backend is running and `localBaseUrl` is correct
- **Android emulator can't reach localhost**: Use `10.0.2.2` instead of `127.0.0.1`
- **JWT token extraction fails**: Check the token format in your backend response
- **Building fails**: Run `flutter clean` and try again

## Next Steps

- Implement location permissions handling
- Complete cart and checkout process
- Add biometric authentication
- Implement push notifications
- Add deep linking for shared recipes