import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Handle deep links/URL schemes (for Kroger authentication callback)
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Handle our custom URL scheme for Kroger callback
    if url.scheme == "smartmealplanner" {
      print("Received callback URL: \(url)")
      return true
    }
    
    // Forward to URL launcher plugin
    return super.application(app, open: url, options: options)
  }
}
