@echo off
echo ========================================
echo Smart Meal Planner - Kroger Auth Fix
echo ========================================
echo.

echo This script will perform the following steps:
echo 1. Clean the Flutter project
echo 2. Get dependencies
echo 3. Run the app with AGP validation bypass
echo.

echo Step 1: Cleaning the project...
call flutter clean
if %ERRORLEVEL% NEQ 0 (
  echo Error during clean! Continuing anyway...
)

echo.
echo Step 2: Getting dependencies...
call flutter pub get
if %ERRORLEVEL% NEQ 0 (
  echo Error getting dependencies! Please check if Flutter is installed correctly.
  goto end
)

echo.
echo Step 3: Running the app with Android Gradle Plugin validation bypass...
echo.
echo Starting app...
call flutter run --android-skip-build-dependency-validation
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo App failed to start. Try the following command manually:
  echo flutter run --android-skip-build-dependency-validation
)

:end
echo.
echo Press any key to exit...
pause > nul