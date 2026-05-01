@echo off
echo ======================================
echo Smart Meal Planner Mobile App Build
echo ======================================
echo.

echo Step 1: Clean the project...
call flutter clean

echo.
echo Step 2: Get dependencies...
call flutter pub get

echo.
echo Step 3: Building the app with Android Gradle Plugin version check bypassed...
call flutter build apk --debug --android-skip-build-dependency-validation

echo.
if %ERRORLEVEL% NEQ 0 (
  echo Build failed! Please check the error messages above.
  goto end
) else (
  echo Build successful!
  echo.
  echo Step 4: Running the app...
  echo.
  echo Starting app with Android Gradle Plugin version check bypassed...
  call flutter run --android-skip-build-dependency-validation
)

:end
echo.
echo Press any key to exit...
pause > nul