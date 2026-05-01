import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import '../Providers/subscription_provider.dart';

class SubscriptionPage extends StatefulWidget {
  @override
  _SubscriptionPageState createState() => _SubscriptionPageState();
}

class _SubscriptionPageState extends State<SubscriptionPage> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final subscriptionProvider = Provider.of<SubscriptionProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Subscription'),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Subscription status card
                  Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Subscription Status',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 10),
                          _buildStatusRow(
                            'Status',
                            subscriptionProvider.subscription?.status ?? 'Inactive',
                            subscriptionProvider.subscription?.isActive == true
                                ? Colors.green
                                : Colors.red,
                          ),
                          _buildStatusRow(
                            'Type',
                            subscriptionProvider.subscription?.subscriptionType ?? 'Free',
                            null,
                          ),
                          if (subscriptionProvider.subscription?.monthlyAmount != null &&
                              subscriptionProvider.subscription!.monthlyAmount > 0)
                            _buildStatusRow(
                              'Monthly Cost',
                              '\$${subscriptionProvider.subscription!.monthlyAmount.toStringAsFixed(2)}',
                              null,
                            ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 30),
                  
                  // Available Plans
                  Text(
                    'Available Plans',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 20),
                  
                  // Free Plan Card
                  _buildPlanCard(
                    'Free Plan',
                    'Basic features for individual use',
                    0.00,
                    subscriptionProvider.subscription?.subscriptionType?.toLowerCase() == 'free',
                    onTap: () {
                      _selectPlan('free');
                    },
                  ),
                  SizedBox(height: 15),
                  
                  // Premium Plan Card
                  _buildPlanCard(
                    'Premium Plan',
                    'Advanced features and priority support',
                    9.99,
                    subscriptionProvider.subscription?.subscriptionType?.toLowerCase() == 'premium',
                    onTap: () {
                      _selectPlan('premium');
                    },
                  ),
                  SizedBox(height: 15),
                  
                  // Enterprise Plan Card
                  _buildPlanCard(
                    'Enterprise Plan',
                    'Custom solutions for organizations',
                    29.99,
                    subscriptionProvider.subscription?.subscriptionType?.toLowerCase() == 'enterprise',
                    onTap: () {
                      _selectPlan('enterprise');
                    },
                  ),
                  
                  SizedBox(height: 30),
                  
                  // Login prompt for unauthenticated users
                  if (!authProvider.isLoggedIn)
                    Card(
                      color: Theme.of(context).primaryColor.withOpacity(0.1),
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Column(
                          children: [
                            Text(
                              'Sign in to manage your subscription',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            SizedBox(height: 10),
                            ElevatedButton(
                              onPressed: () {
                                Navigator.pushNamed(context, '/login');
                              },
                              child: Text('Sign In'),
                              style: ElevatedButton.styleFrom(
                                minimumSize: Size(double.infinity, 48),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusRow(String label, String value, Color? valueColor) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[700],
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanCard(
    String title,
    String description,
    double price,
    bool isSelected,
    {required VoidCallback onTap}
  ) {
    return Card(
      elevation: isSelected ? 4 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected
              ? Theme.of(context).primaryColor
              : Colors.transparent,
          width: 2,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (isSelected)
                    Icon(
                      Icons.check_circle,
                      color: Theme.of(context).primaryColor,
                    ),
                ],
              ),
              SizedBox(height: 8),
              Text(
                description,
                style: TextStyle(
                  color: Colors.grey[700],
                ),
              ),
              SizedBox(height: 12),
              Text(
                price == 0 ? 'Free' : '\$${price.toStringAsFixed(2)}/month',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).primaryColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _selectPlan(String planType) async {
    // If free, just show a message
    if (planType == 'free') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Free plan is available to all users')),
      );
      return;
    }
    
    // For authenticated users, show subscription confirmation
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    if (authProvider.isLoggedIn) {
      // Show subscription confirmation dialog
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Upgrade to ${planType.capitalize()} Plan?'),
          content: Text(
            'This is a demonstration of the subscription UI. In a real app, this would connect to a payment processor.'
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context, false);
              },
              child: Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, true);
              },
              child: Text('Upgrade'),
            ),
          ],
        ),
      );
      
      if (confirmed == true) {
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('This is a demo - no actual subscription change was made')),
        );
      }
    } else {
      // For unauthenticated users, prompt to sign in
      final signIn = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Sign in Required'),
          content: Text('You need to sign in to upgrade your subscription'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context, false);
              },
              child: Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context, true);
              },
              child: Text('Sign In'),
            ),
          ],
        ),
      );
      
      if (signIn == true) {
        Navigator.pushNamed(context, '/login');
      }
    }
  }
}

// Extension method to capitalize first letter of a string
extension StringExtension on String {
  String capitalize() {
    return '${this[0].toUpperCase()}${this.substring(1)}';
  }
}