import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import '../services/api_service.dart';
import 'store_selection_screen.dart';

class ProfileScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  ProfileScreen({required this.userId, required this.authToken});

  @override
  _ProfileScreenState createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = false;
  bool _isTrainer = false;
  int? _organizationId;
  
  @override
  void initState() {
    super.initState();
    _checkTrainerStatus();
  }
  
  Future<void> _checkTrainerStatus() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      final accountInfo = await ApiService.getUserAccountInfo(widget.authToken);
      
      setState(() {
        _isLoading = false;
        _isTrainer = accountInfo['is_organization'] == true || 
                    accountInfo['is_trainer'] == true ||
                    accountInfo['account_type'] == 'organization';
        
        if (_isTrainer && accountInfo.containsKey('organization_id')) {
          _organizationId = accountInfo['organization_id'];
        }
      });
    } catch (e) {
      print("Error checking trainer status: $e");
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Profile'),
      ),
      body: _isLoading 
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
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
                          if (_isTrainer)
                            Padding(
                              padding: const EdgeInsets.only(top: 4.0),
                              child: Text(
                                'Account Type: Trainer',
                                style: TextStyle(
                                  color: Colors.blue[800], 
                                  fontWeight: FontWeight.bold
                                ),
                              ),
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
                  if (_isTrainer)
                    ListTile(
                      leading: Icon(Icons.people),
                      title: Text('Client Management'),
                      trailing: Icon(Icons.chevron_right),
                      onTap: () => Navigator.pushNamed(context, '/organization'),
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