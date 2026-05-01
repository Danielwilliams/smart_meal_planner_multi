@echo off
echo ======================================
echo Kroger Cart Fix - App Builder
echo ======================================
echo.

echo This script will build and run the mobile app with the
echo Kroger cart reconnection loop fix and external cart access
echo.

REM Get the current directory
set APP_DIR=%CD%

echo 1. Cleaning the project...
call flutter clean
if %ERRORLEVEL% NEQ 0 (
  echo Error during clean! Continuing anyway...
)

echo.
echo 2. Getting dependencies...
call flutter pub get
if %ERRORLEVEL% NEQ 0 (
  echo Error getting dependencies! Please check if Flutter is installed correctly.
  goto end
)

echo.
echo 3. Building and running the app...
echo.
echo Running flutter run with --android-skip-build-dependency-validation flag...
call flutter run --android-skip-build-dependency-validation

:end
echo.
echo Press any key to exit...
pause > nul