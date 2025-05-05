import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import 'store_selection_screen.dart';

class ProfileScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Profile'),
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: Colors.blue[100],
                          child: Icon(Icons.person, size: 40, color: Colors.blue[700]),
                        ),
                        SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                authProvider.userName ?? 'User',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                authProvider.userEmail ?? 'email@example.com',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey[700],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),
                    Text(
                      'User ID: ${authProvider.userId}',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'Account',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            ListTile(
              leading: Icon(Icons.settings),
              title: Text('Preferences'),
              trailing: Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, '/preferences'),
            ),
            ListTile(
              leading: Icon(Icons.location_on),
              title: Text('Location'),
              trailing: Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, '/location'),
            ),
            ListTile(
              leading: Icon(Icons.store),
              title: Text('Store Selection'),
              trailing: Icon(Icons.chevron_right),
              onTap: () => Navigator.pushNamed(context, '/store-selection'),
            ),
            Divider(),
            ListTile(
              leading: Icon(Icons.exit_to_app, color: Colors.red),
              title: Text('Logout', style: TextStyle(color: Colors.red)),
              onTap: () {
                // Show confirmation dialog
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text('Logout'),
                    content: Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: Text('CANCEL'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          authProvider.logout();
                          Navigator.of(context).pushReplacementNamed('/login');
                        },
                        child: Text('LOGOUT'),
                        style: TextButton.styleFrom(foregroundColor: Colors.red),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}