@echo off
echo Starting app icon update process...

echo Creating icons directory...
mkdir assets\icons 2>nul

echo Copying icon from web app...
copy ..\..\..\apps\smart-meal-planner-web\public\android-chrome-512x512.png assets\icons\icon.png

echo Installing dependencies...
call flutter pub get

echo Generating app icons...
call flutter pub run flutter_launcher_icons

echo App icons have been updated successfully!
echo You can now run the app with: flutter run

pause