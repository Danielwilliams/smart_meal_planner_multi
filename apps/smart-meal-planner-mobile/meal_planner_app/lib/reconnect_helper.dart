import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

// Create a reconnect dialog with proper retry logic
Future<void> showKrogerReconnectDialog({
  required BuildContext context,
  required String? message,
  required int userId,
  required String authToken,
  required Function() retryOperation,
}) async {
  final reconnectMessage = message ?? "Your Kroger session has expired. Please reconnect your account to continue.";

  // Check if we've already shown a reconnect dialog in the last few seconds
  // This prevents the reconnection loop by avoiding multiple dialogs
  final prefs = await SharedPreferences.getInstance();
  final lastReconnectTime = prefs.getInt('last_kroger_reconnect_time') ?? 0;
  final currentTime = DateTime.now().millisecondsSinceEpoch;

  // If we've shown a dialog in the last 10 seconds, don't show another one
  if (currentTime - lastReconnectTime < 10000) {
    print("Reconnect dialog shown recently, preventing reconnection loop");
    
    // Just retry the operation - skipping the dialog to break the loop
    print("Retrying operation without showing dialog to break reconnection loop");
    await retryOperation();
    return;
  }

  // CRITICAL FIX: When session expires on server, clear local auth state
  // This prevents the infinite loop where app thinks it's authenticated but server says it's not
  print("Session expired on server - clearing local authentication state to prevent infinite loop");
  
  // Clear all Kroger authentication data from local storage
  await prefs.remove('kroger_authenticated');
  await prefs.remove('kroger_access_token');
  await prefs.remove('kroger_refresh_token');
  await prefs.setInt('kroger_token_refresh_time', 0);
  
  print("Cleared local Kroger auth state - will show reconnection dialog");

  // Save the current time
  await prefs.setInt('last_kroger_reconnect_time', currentTime);

  return showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => AlertDialog(
      title: Text("Kroger Authentication Required"),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(reconnectMessage),
          SizedBox(height: 12),
          Text(
            "Would you like to connect now?",
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
      actions: [
        TextButton(
          child: Text("Cancel"),
          onPressed: () => Navigator.of(context).pop(),
        ),
        ElevatedButton(
          child: Text("Connect"),
          onPressed: () async {
            Navigator.of(context).pop();
            
            // Navigate to Kroger authentication screen and wait for result
            final authResult = await Navigator.pushNamed(
              context,
              '/kroger-auth',
              arguments: {
                'userId': userId,
                'authToken': authToken,
                'isReconnect': true, // Flag to indicate this is a reconnection
              }
            );
            
            // Clear in-progress flag to prevent reconnection loops
            final sharedPrefs = await SharedPreferences.getInstance();
            await sharedPrefs.setBool('kroger_auth_in_progress', false);
            
            // If authentication was successful, retry the operation
            if (authResult == true) {
              // Store the authentication success to prevent loops
              await sharedPrefs.setBool('kroger_authenticated', true);
              
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text("Kroger connection successful! Retrying operation..."),
                    backgroundColor: Colors.green,
                  )
                );
              }
              
              // Retry the operation after a short delay
              await Future.delayed(Duration(seconds: 1));
              await retryOperation();
            } else {
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text("Connection cancelled or failed. Please try again."),
                    backgroundColor: Colors.red,
                  )
                );
              }
            }
          },
        ),
      ],
    ),
  );
}

// Function to open Kroger cart in external browser
Future<void> openKrogerExternalCart(BuildContext context) async {
  try {
    // Try a more generic URL first - the homepage may redirect to cart
    final Uri url = Uri.parse('https://www.kroger.com');
    
    print("Attempting to open Kroger homepage URL: $url");
    
    // Try a simpler approach with just one launch mode
    try {
      final bool launched = await launchUrl(
        url,
        mode: LaunchMode.externalApplication,
      );
      
      if (launched) {
        // Success!
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Opening Kroger website... Navigate to cart from there."),
            duration: Duration(seconds: 3),
          ),
        );
        return;
      } else {
        print("Failed to launch URL: $url");
      }
    } catch (e) {
      print("Error launching URL: $e");
    }
    
    // If the main approach failed, show a dialog with instructions
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text("Couldn't Open Kroger Website"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Please follow these steps:"),
              SizedBox(height: 8),
              Text("1. Open your web browser"),
              Text("2. Go to www.kroger.com"),
              Text("3. Log in to your account"),
              Text("4. Click on the cart icon"),
              SizedBox(height: 12),
              Text("Your items should appear in your Kroger cart after they're processed."),
            ],
          ),
          actions: [
            TextButton(
              child: Text("OK"),
              onPressed: () {
                Navigator.of(context).pop();
              },
            ),
          ],
        );
      },
    );
  } catch (e) {
    print("Error opening Kroger external cart: $e");
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("Error opening Kroger website. Try visiting www.kroger.com in your browser."),
        backgroundColor: Colors.red,
        duration: Duration(seconds: 5),
      ),
    );
  }
}