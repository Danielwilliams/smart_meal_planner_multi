# App Icon Update Instructions

Follow these steps to update the app icon to the Smart Meal Planner icon:

## Steps to Update App Icons

1. Make sure you have Flutter installed and in your PATH.

2. Open a Command Prompt or PowerShell window.

3. Navigate to your project directory:
   ```
   cd D:\smart_meal_planner_multi\apps\smart-meal-planner-mobile\meal_planner_app
   ```

4. Make sure the icon has been copied to the assets directory:
   ```
   mkdir -p assets\icons
   copy D:\smart_meal_planner_multi\apps\smart-meal-planner-web\public\android-chrome-512x512.png assets\icons\icon.png
   ```

5. Install the dependencies:
   ```
   flutter pub get
   ```

6. Run the flutter_launcher_icons package to generate the app icons:
   ```
   flutter pub run flutter_launcher_icons
   ```

7. This will update the app icons for both Android and iOS.

8. Now you can build and run your app with the new icon:
   ```
   flutter run
   ```

## Manual Icon Update (if needed)

If you encounter any issues with the automatic icon generation, you can manually update the Android icons:

1. Copy the Smart Meal Planner icon to each Android mipmap directory with the appropriate size:

   - Copy to `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72 px)
   - Copy to `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48 px)
   - Copy to `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96 px)
   - Copy to `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144 px)
   - Copy to `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192 px)

2. Do the same for the adaptive icons (Android 8.0+):
   - Copy to each mipmap directory with the name `ic_launcher_foreground.png`
   - You'll also need to update `ic_launcher_background.xml` in each directory to set a background color

3. For iOS, update the icon in the iOS directory:
   - Copy appropriate sized icons to `ios/Runner/Assets.xcassets/AppIcon.appiconset/`

## Troubleshooting

If you encounter any issues:

1. Make sure the `pubspec.yaml` file has the correct configuration:
   ```yaml
   flutter_launcher_icons:
     android: true
     ios: true
     image_path: "assets/icons/icon.png"
     adaptive_icon_background: "#FFFFFF"
     adaptive_icon_foreground: "assets/icons/icon.png"
     min_sdk_android: 21
   ```

2. Ensure the `assets/icons` directory is included in your `pubspec.yaml` assets section:
   ```yaml
   assets:
     - assets/images/
     - assets/instacart/
     - assets/icons/
   ```

3. Try cleaning the project before running the icon generator:
   ```
   flutter clean
   flutter pub get
   flutter pub run flutter_launcher_icons
   ```