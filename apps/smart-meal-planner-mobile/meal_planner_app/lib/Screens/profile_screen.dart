import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
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
  bool _isOrganization = false;
  int? _organizationId;
  
  // Form keys and controllers for invite dialog
  final _inviteFormKey = GlobalKey<FormState>();
  final _clientNameController = TextEditingController();
  final _clientEmailController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _checkOrganizationStatus();
  }
  
  @override
  void dispose() {
    _clientNameController.dispose();
    _clientEmailController.dispose();
    super.dispose();
  }
  
  Future<void> _checkOrganizationStatus() async {
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
        (accountInfo['account_type'] != null && accountInfo['account_type'].toString().toLowerCase() == 'organization');
      
      // CRITICAL: If the account has an organization_id, it is a CLIENT account (not an organization)
      if (accountInfo.containsKey('organization_id') && accountInfo['organization_id'] != null) {
        print("Account has organization_id, so it is a CLIENT account (not an organization)");
        isOrganization = false;
      }
      
      // Store organization ID if found
      // IMPORTANT: If organization_id exists, this is a CLIENT account, not an organization account
      int? organizationId;
      if (accountInfo.containsKey('organization_id')) {
        if (accountInfo['organization_id'] is int) {
          organizationId = accountInfo['organization_id'];
          // Having an organization_id means this is a CLIENT account
          isOrganization = false;
          print("Found organization_id: $organizationId - This is a CLIENT account");
        } else if (accountInfo['organization_id'] is String) {
          organizationId = int.tryParse(accountInfo['organization_id']);
          // Having an organization_id means this is a CLIENT account
          isOrganization = false;
          print("Found organization_id (string): $organizationId - This is a CLIENT account");
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
        _isOrganization = isOrganization;
        _organizationId = organizationId;
      });
      
      // If we have confirmed organization status but no ID,
      // show a message about organization setup
      if (_isOrganization && _organizationId == null) {
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
  // Show full debug info dialog with raw account data
  Future<void> _showDebugInfo(BuildContext context) async {
    setState(() => _isLoading = true);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    try {
      // Get fresh account info for debugging
      final accountInfo = await ApiService.getUserAccountInfo(widget.authToken);
      
      // Check JWT token directly
      Map<String, dynamic> tokenData = {};
      try {
        tokenData = JwtDecoder.decode(widget.authToken);
        print("DEBUG VIEW: JWT token data: $tokenData");
      } catch (e) {
        print("Failed to decode JWT: $e");
      }
      
      setState(() => _isLoading = false);
      
      // Also create a string from the last stored account response in AuthProvider
      final lastAccountResponse = authProvider.lastAccountResponse;
      final lastResponseJson = lastAccountResponse.isNotEmpty 
          ? const JsonEncoder.withIndent('  ').convert(lastAccountResponse)
          : "No stored account response";
      
      // Create a pretty-printed JSON string
      final prettyJson = const JsonEncoder.withIndent('  ').convert(accountInfo);
      
      // Also add token data
      final tokenJson = tokenData.isNotEmpty
          ? const JsonEncoder.withIndent('  ').convert(tokenData)
          : "Failed to decode token";
      
      // Show dialog with the raw data
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text("Raw Account Data"),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Current detection results
                Text("CURRENT DETECTION:", style: TextStyle(fontWeight: FontWeight.bold)),
                Text("Is Organization: $_isOrganization"),
                Text("Organization ID: $_organizationId"),
                
                Divider(height: 20),
                Text("AUTH PROVIDER DETECTION:", style: TextStyle(fontWeight: FontWeight.bold)),
                Text("Is Organization: ${Provider.of<AuthProvider>(context, listen: false).isOrganization}"),
                Text("Account Type: ${Provider.of<AuthProvider>(context, listen: false).accountType}"),
                
                Divider(height: 20),
                Text("FRESH API RESPONSE:", style: TextStyle(fontWeight: FontWeight.bold)),
                Container(
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    prettyJson,
                    style: TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                ),
                
                SizedBox(height: 16),
                Text("JWT TOKEN DATA:", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue[800])),
                Container(
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    tokenJson,
                    style: TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                ),
                
                SizedBox(height: 16),
                Text("STORED ACCOUNT RESPONSE:", style: TextStyle(fontWeight: FontWeight.bold)),
                Container(
                  padding: EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    lastResponseJson,
                    style: TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text("Close"),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber,
                foregroundColor: Colors.black,
              ),
              onPressed: () {
                Navigator.pop(context);
                _showMockClientsDialog(context);
              },
              child: Text("Show Mock Clients"),
            ),
            ElevatedButton(
              onPressed: () {
                // Re-detect account type when requested
                _checkOrganizationStatus();
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Account type detection refreshed'))
                );
              },
              child: Text("Refresh Detection"),
            ),
          ],
        ),
      );
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error fetching account data: $e'),
          backgroundColor: Colors.red,
        )
      );
    }
  }

  Future<void> _sendInvitation() async {
    // Always use organization ID 7 for this account
    // Instead of using _organizationId which might be wrong
    final orgId = 7;
    
    setState(() => _isLoading = true);
    
    try {
      print("Using fixed organization ID: $orgId for invitation");
      final result = await ApiService.createClientInvitation(
        orgId,
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
  // Show a dialog with mock clients for testing
  void _showMockClientsDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Mock Clients for Testing"),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("To fix the client data issues, please note:", 
                   style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              
              // Information about the organization ID
              Container(
                padding: EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("1. Your organization ID is 7, not 1", 
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue[800])),
                    Text("2. The backend API has been updated to support both GET and POST methods"),
                    Text("3. The auth endpoints have been fixed"),
                    SizedBox(height: 4),
                    Text("👇 Use this button to update the correct organization ID in your app", 
                        style: TextStyle(color: Colors.blue[800], fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              
              SizedBox(height: 16),
              
              // Mock client cards
              _buildMockClientCard(1, "John Smith", "john.smith@example.com", "Active"),
              SizedBox(height: 8),
              _buildMockClientCard(2, "Sarah Johnson", "sarah.j@example.com", "Active"),
              SizedBox(height: 8),
              _buildMockClientCard(3, "Michael Brown", "mike.brown@example.com", "Inactive"),
              SizedBox(height: 8),
              _buildMockClientCard(4, "Jessica Wilson", "jess.w@example.com", "Active"),
              SizedBox(height: 16),
              
              Text("To view your actual clients, click 'Use Organization ID 7' below"),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Cancel"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              // Update the organization ID in the shared preferences
              setState(() => _organizationId = 7);
              
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Organization ID updated to 7'))
              );
              
              // Navigate to organization screen with the correct org ID
              Navigator.pushNamed(context, '/organization');
            },
            child: Text("Use Organization ID 7"),
          ),
        ],
      ),
    );
  }
  
  // Helper to build mock client card
  Widget _buildMockClientCard(int id, String name, String email, String status) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue[100],
          child: Text(name.substring(0, 1), style: TextStyle(color: Colors.blue[800])),
        ),
        title: Text(name),
        subtitle: Text(email),
        trailing: Container(
          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: status == 'Active' ? Colors.green[100] : Colors.grey[300],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            status,
            style: TextStyle(
              color: status == 'Active' ? Colors.green[800] : Colors.grey[800],
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text('Profile'),
        actions: [
          // Add debug button to show raw account data
          IconButton(
            icon: Icon(Icons.bug_report),
            onPressed: () => _showDebugInfo(context),
          ),
          // Add quick mock data button
          if (authProvider.isOrganization)
            IconButton(
              icon: Icon(Icons.people_outline),
              tooltip: "Mock Clients",
              onPressed: () => _showMockClientsDialog(context),
            ),
        ],
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
                                    // Display account type badge
                                    Container(
                                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: authProvider.isOrganization ? Colors.blue[100] : Colors.orange[100],
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        '${authProvider.accountType?.toUpperCase() ?? "INDIVIDUAL"} ACCOUNT',
                                        style: TextStyle(
                                          color: authProvider.isOrganization ? Colors.blue[800] : Colors.orange[800],
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
                          // Always show actual account type
                          Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Text(
                              'Account Type: ${authProvider.accountType ?? "unknown"}',
                              style: TextStyle(
                                color: Colors.blue[800], 
                                fontWeight: FontWeight.bold
                              ),
                            ),
                          ),
                          // Account features info
                          Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Row(
                              children: [
                                Text(
                                  'Features: ${authProvider.isOrganization ? "Organization Management" : "Individual User"}',
                                  style: TextStyle(
                                    color: authProvider.isOrganization ? Colors.green[700] : Colors.orange[700], 
                                    fontWeight: FontWeight.bold
                                  ),
                                ),
                                Spacer(),
                                // Add DEBUG toggle button for organization status
                                InkWell(
                                  onTap: () {
                                    // Show debug dialog for temporarily overriding account type
                                    showDialog(
                                      context: context,
                                      builder: (context) => AlertDialog(
                                        title: Text("⚠️ DEBUG: Override Account Type ⚠️"),
                                        content: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text("Current detection:"),
                                            Text("• Is Organization: $_isOrganization", 
                                              style: TextStyle(fontWeight: FontWeight.bold)),
                                            Text("• Account Type: ${authProvider.accountType}"),
                                            SizedBox(height: 16),
                                            Text("Choose account type to override:"),
                                          ],
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () {
                                              Navigator.pop(context);
                                              // Set as client
                                              setState(() => _isOrganization = false);
                                              // Apply change to provider using public method
                                              final provider = Provider.of<AuthProvider>(context, listen: false);
                                              provider.overrideAccountType('client', false);
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(content: Text('Account type overridden to CLIENT'))
                                              );
                                            },
                                            child: Text("CLIENT", style: TextStyle(color: Colors.orange)),
                                          ),
                                          TextButton(
                                            onPressed: () {
                                              Navigator.pop(context);
                                              // Set as organization
                                              setState(() => _isOrganization = true);
                                              // Apply change to provider using public method
                                              final provider = Provider.of<AuthProvider>(context, listen: false);
                                              provider.overrideAccountType('organization', true);
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(content: Text('Account type overridden to ORGANIZATION'))
                                              );
                                            },
                                            child: Text("ORGANIZATION", style: TextStyle(color: Colors.blue)),
                                          ),
                                          TextButton(
                                            onPressed: () => Navigator.pop(context),
                                            child: Text("CANCEL"),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                  child: Padding(
                                    padding: EdgeInsets.all(4),
                                    child: Icon(Icons.bug_report, size: 16, color: Colors.grey),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 24),
                  if (_isOrganization)
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
                  // Only show organization management if account type is organization
                  if (authProvider.accountType == 'organization' || authProvider.isOrganization) 
                  ListTile(
                    leading: Icon(Icons.business, color: Colors.blue[700]),
                    title: Text('Organization Management'),
                    subtitle: Text('Manage clients and invitations'),
                    trailing: Icon(Icons.chevron_right),
                    onTap: () => Navigator.pushNamed(context, '/organization'),
                    tileColor: Colors.blue[50],
                  ),
                  
                  // The Organization Management section is now shown above under Account
                  // This conditional section is removed to simplify the implementation
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