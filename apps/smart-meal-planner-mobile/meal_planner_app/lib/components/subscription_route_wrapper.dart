import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import '../Providers/subscription_provider.dart';

class SubscriptionRouteWrapper extends StatefulWidget {
  final Widget child;
  final Widget? fallbackWidget;
  
  const SubscriptionRouteWrapper({
    Key? key,
    required this.child,
    this.fallbackWidget,
  }) : super(key: key);
  
  @override
  _SubscriptionRouteWrapperState createState() => _SubscriptionRouteWrapperState();
}

class _SubscriptionRouteWrapperState extends State<SubscriptionRouteWrapper> {
  bool _checking = true;
  
  @override
  void initState() {
    super.initState();
    _checkSubscription();
  }
  
  Future<void> _checkSubscription() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final subscriptionProvider = Provider.of<SubscriptionProvider>(context, listen: false);
    
    setState(() => _checking = true);
    
    // For authenticated users, check subscription
    if (authProvider.isLoggedIn && authProvider.authToken != null) {
      await subscriptionProvider.checkSubscription(authProvider.authToken!);
    }
    
    setState(() => _checking = false);
  }
  
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final subscriptionProvider = Provider.of<SubscriptionProvider>(context);
    
    // If we're still checking, show a loading spinner
    if (_checking) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }
    
    // For authenticated users, check subscription
    if (authProvider.isLoggedIn) {
      // Check if they have an active subscription
      if (subscriptionProvider.hasActiveSubscription) {
        return widget.child;
      } else {
        // Show subscription required page for logged in users without subscription
        return Scaffold(
          appBar: AppBar(
            title: Text("Subscription Required"),
          ),
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.subscriptions, size: 64, color: Colors.orange),
                SizedBox(height: 20),
                Text(
                  "Subscription Required",
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32.0),
                  child: Text(
                    "Your account requires an active subscription to access this feature.",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 16),
                  ),
                ),
                SizedBox(height: 30),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/subscription');
                  },
                  child: Text("View Subscription Options"),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                  ),
                ),
              ],
            ),
          ),
        );
      }
    }

    // For unauthenticated users, send them to login directly
    // Don't check subscription since they're not logged in
    return widget.fallbackWidget ?? Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Please log in to continue",
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // Navigate to login page
                Navigator.pushReplacementNamed(context, '/login');
              },
              child: Text("Log In"),
            ),
            SizedBox(height: 10),
            TextButton(
              onPressed: () {
                // Navigate to signup page
                Navigator.pushNamed(context, '/signup');
              },
              child: Text("Create Account"),
            ),
          ],
        ),
      ),
    );
  }
}