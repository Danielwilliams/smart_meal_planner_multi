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
  
  // Form keys and controllers for invite dialog
  final _inviteFormKey = GlobalKey<FormState>();
  final _clientNameController = TextEditingController();
  final _clientEmailController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _checkTrainerStatus();
  }
  
  @override
  void dispose() {
    _clientNameController.dispose();
    _clientEmailController.dispose();
    super.dispose();
  }
  
  Future<void> _checkTrainerStatus() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      // First, check user account info
      final accountInfo = await ApiService.getUserAccountInfo(widget.authToken);
      
      print("ACCOUNT INFO: $accountInfo");
      
      // Check specifically for organization account type
      bool isOrganization = 
        accountInfo['is_organization'] == true || 
        accountInfo['account_type'] == 'organization';
      
      // Store organization ID if found
      int? organizationId;
      if (accountInfo.containsKey('organization_id')) {
        if (accountInfo['organization_id'] is int) {
          organizationId = accountInfo['organization_id'];
        } else if (accountInfo['organization_id'] is String) {
          organizationId = int.tryParse(accountInfo['organization_id']);
        }
      }
      
      // If we don't find it from account info, try to get organizations
      if (isOrganization && organizationId == null) {
        try {
          final orgResult = await ApiService.getUserOrganizations(widget.authToken);
          print("ORG RESULT: $orgResult");
          
          if (orgResult != null && orgResult is List && orgResult.isNotEmpty) {
            final firstOrg = orgResult[0];
            if (firstOrg['id'] is int) {
              organizationId = firstOrg['id'];
            } else if (firstOrg['id'] is String) {
              organizationId = int.tryParse(firstOrg['id']);
            }
          }
        } catch (orgError) {
          print("Error fetching organizations: $orgError");
        }
      }
      
      // Update UI state
      setState(() {
        _isLoading = false;
        _isTrainer = isOrganization;
        _organizationId = organizationId;
      });
      
      // If we have confirmed organization status but no ID,
      // show a message about organization setup
      if (_isTrainer && _organizationId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Organization ID not found. Some features may be limited.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 5),
          )
        );
      }
    } catch (e) {
      print("Error checking organization status: $e");
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  // Helper to build consistent organization option buttons
  Widget _buildOrgOptionButton({
    required IconData icon,
    required String label,
    required VoidCallback onPressed,
    Color? color,
  }) {
    return ElevatedButton.icon(
      icon: Icon(icon),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: color ?? Colors.blue[700],
        foregroundColor: Colors.white,
        minimumSize: Size(double.infinity, 45),
        alignment: Alignment.centerLeft,
      ),
      onPressed: onPressed,
    );
  }
  
  // Show dialog to invite clients
  void _showInviteDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Invite a Client"),
        content: Form(
          key: _inviteFormKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _clientNameController,
                decoration: InputDecoration(
                  labelText: "Client Name",
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return "Please enter a name";
                  }
                  return null;
                },
              ),
              SizedBox(height: 16),
              TextFormField(
                controller: _clientEmailController,
                decoration: InputDecoration(
                  labelText: "Client Email",
                  prefixIcon: Icon(Icons.email),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return "Please enter an email";
                  }
                  if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                    return "Please enter a valid email";
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () {
              if (_inviteFormKey.currentState!.validate()) {
                Navigator.pop(context);
                _sendInvitation();
              }
            },
            child: Text("Send Invitation"),
          ),
        ],
      ),
    );
  }
  
  // Send invitation to client
  Future<void> _sendInvitation() async {
    if (_organizationId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Organization ID not found. Please try again.'))
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final result = await ApiService.createClientInvitation(
        _organizationId!,
        widget.authToken,
        _clientEmailController.text,
        _clientNameController.text
      );
      
      setState(() => _isLoading = false);
      
      if (result != null && (result['success'] == true || result['id'] != null)) {
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Invitation sent successfully to ${_clientEmailController.text}!'),
            backgroundColor: Colors.green,
          )
        );
        
        // Clear form
        _clientNameController.clear();
        _clientEmailController.clear();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to send invitation: ${result['error'] ?? "Unknown error"}'),
            backgroundColor: Colors.red,
          )
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        )
      );
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
                                    SizedBox(height: 4),
                                    if (authProvider.isTrainer || _isTrainer)
                                      Container(
                                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.blue[100],
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          'Organization Account',
                                          style: TextStyle(
                                            color: Colors.blue[800],
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
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
                                'Account Type: Organization',
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
                  if (_isTrainer)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: Card(
                        color: Colors.blue[50],
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.business, color: Colors.blue[700]),
                                  SizedBox(width: 8),
                                  Text(
                                    'Organization Dashboard',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.blue[700],
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Manage your organization, clients, meal plans, and monitor progress.',
                                style: TextStyle(color: Colors.grey[700]),
                              ),
                              SizedBox(height: 16),
                              
                              // Organization management options
                              Column(
                                children: [
                                  _buildOrgOptionButton(
                                    icon: Icons.people,
                                    label: 'Client Management',
                                    onPressed: () => Navigator.pushNamed(context, '/organization'),
                                  ),
                                  SizedBox(height: 8),
                                  _buildOrgOptionButton(
                                    icon: Icons.restaurant_menu,
                                    label: 'Create Client Meal Plans',
                                    onPressed: () {
                                      try {
                                        Navigator.pushNamed(
                                          context, 
                                          '/create-client-menu',
                                          arguments: {
                                            'clientId': 0, // This will show client selection
                                            'clientName': 'New Client',
                                            'userId': widget.userId,
                                            'authToken': widget.authToken,
                                            'recipeId': 0,
                                            'recipeTitle': '',
                                          }
                                        );
                                      } catch (e) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Feature not available in current version'))
                                        );
                                      }
                                    },
                                  ),
                                  SizedBox(height: 8),
                                  _buildOrgOptionButton(
                                    icon: Icons.add_circle_outline,
                                    label: 'Invite New Clients',
                                    onPressed: () => _showInviteDialog(context),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
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
                  
                  // Organization Management section
                  if (_isTrainer) ...[
                    SizedBox(height: 24),
                    Text(
                      'Organization Management',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.blue[800],
                      ),
                    ),
                    ListTile(
                      leading: Icon(Icons.people, color: Colors.blue[700]),
                      title: Text('Client Management'),
                      trailing: Icon(Icons.chevron_right),
                      onTap: () => Navigator.pushNamed(context, '/organization'),
                      tileColor: Colors.blue[50],
                    ),
                    ListTile(
                      leading: Icon(Icons.restaurant_menu, color: Colors.blue[700]),
                      title: Text('Create Client Meal Plans'),
                      trailing: Icon(Icons.chevron_right),
                      onTap: () {
                        try {
                          Navigator.pushNamed(
                            context, 
                            '/create-client-menu',
                            arguments: {
                              'clientId': 0, // This will show client selection
                              'clientName': 'New Client',
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                              'recipeId': 0,
                              'recipeTitle': '',
                            }
                          );
                        } catch (e) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Feature not available in current version'))
                          );
                        }
                      },
                      tileColor: Colors.blue[50],
                    ),
                    ListTile(
                      leading: Icon(Icons.add_circle_outline, color: Colors.blue[700]),
                      title: Text('Invite New Client'),
                      trailing: Icon(Icons.chevron_right),
                      onTap: () => _showInviteDialog(context),
                      tileColor: Colors.blue[50],
                    ),
                  ],
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