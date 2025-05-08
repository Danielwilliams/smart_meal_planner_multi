import 'package:flutter/material.dart';
import '../models/organization_model.dart';
import '../services/api_service.dart';

class OrganizationScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  OrganizationScreen({required this.userId, required this.authToken});

  @override
  _OrganizationScreenState createState() => _OrganizationScreenState();
}

class _OrganizationScreenState extends State<OrganizationScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  String _errorMessage = '';
  UserAccount? _userAccount;
  Organization? _organization;
  List<Client> _clients = [];
  List<Invitation> _invitations = [];
  
  late TabController _tabController;
  
  final _formKey = GlobalKey<FormState>();
  final _clientNameController = TextEditingController();
  final _clientEmailController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadUserInfo();
  }
  
  @override
  void dispose() {
    _tabController.dispose();
    _clientNameController.dispose();
    _clientEmailController.dispose();
    super.dispose();
  }
  
  Future<void> _loadUserInfo() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    
    try {
      // Get user account info to determine if they're a trainer
      print("Loading user account info...");
      final accountResult = await ApiService.getUserAccountInfo(widget.authToken);
      
      if (accountResult != null) {
        print("User account info received: ${accountResult.keys}");
        
        // DEBUG: Print the full account result for troubleshooting
        print("FULL ACCOUNT DATA: $accountResult");
        
        // Parse user account info
        if (accountResult.containsKey('user')) {
          _userAccount = UserAccount.fromJson(accountResult['user']);
        } else {
          _userAccount = UserAccount.fromJson(accountResult);
        }
        
        print("Account type: ${_userAccount?.accountType}");
        print("Is organization/trainer: ${_userAccount?.isOrganization}");
        print("Organization ID: ${_userAccount?.organizationId}");
        
        // Check if the account is recognized as an organization/trainer account
        if (!(_userAccount?.isOrganization == true)) {
          // Try to infer from other account data
          final isTrainer = accountResult['is_organization'] == true || 
                          accountResult['is_trainer'] == true ||
                          accountResult['account_type'] == 'organization';
          
          if (isTrainer) {
            print("Account not explicitly marked as trainer but has trainer flags. Overriding...");
            // Create a modified UserAccount with trainer flag set
            final Map<String, dynamic> updatedAccount = {
              ...accountResult,
              'account_type': 'organization',
              'is_organization': true,
            };
            _userAccount = UserAccount.fromJson(updatedAccount);
          }
        }
        
        // Try to find organization ID if missing
        if (_userAccount?.isOrganization == true && _userAccount?.organizationId == null) {
          print("Missing organization ID - trying to find it in account data");
          int? orgId;
          
          if (accountResult.containsKey('organization_id')) {
            orgId = accountResult['organization_id'] is int 
                  ? accountResult['organization_id'] 
                  : int.tryParse(accountResult['organization_id'].toString());
          }
          
          // If we found a valid ID, update the user account
          if (orgId != null) {
            print("Found organization ID: $orgId");
            // Create updated account with organization ID
            final Map<String, dynamic> updatedAccount = {
              ...accountResult,
              'organization_id': orgId,
            };
            _userAccount = UserAccount.fromJson(updatedAccount);
          } else {
            // Try to fetch organization data to find an ID
            print("Attempting to fetch organizations to find ID");
            try {
              final orgResult = await ApiService.getUserOrganizations(widget.authToken);
              if (orgResult != null && orgResult is List && orgResult.isNotEmpty) {
                final firstOrg = orgResult[0];
                orgId = firstOrg['id'] is int 
                      ? firstOrg['id'] 
                      : int.tryParse(firstOrg['id'].toString());
                              
                if (orgId != null) {
                  print("Found organization ID from orgs list: $orgId");
                  // Create updated account with organization ID
                  final Map<String, dynamic> updatedAccount = {
                    ...accountResult,
                    'organization_id': orgId,
                  };
                  _userAccount = UserAccount.fromJson(updatedAccount);
                }
              }
            } catch (e) {
              print("Error fetching organizations: $e");
            }
          }
        }
        
        // Only proceed if user is an organization/trainer
        if (_userAccount?.isOrganization == true) {
          // If we have organization ID
          if (_userAccount?.organizationId != null) {
            // Get organization details
            print("Loading organization details for ID: ${_userAccount!.organizationId}");
            final orgResult = await ApiService.getOrganizationDetails(
              _userAccount!.organizationId!,
              widget.authToken
            );
            
            if (orgResult != null) {
              print("Organization details received");
              if (orgResult.containsKey('organization')) {
                _organization = Organization.fromJson(orgResult['organization']);
              } else {
                _organization = Organization.fromJson(orgResult);
              }
              
              // Get organization clients
              print("Loading organization clients");
              final clientsResult = await ApiService.getOrganizationClients(
                _userAccount!.organizationId!,
                widget.authToken
              );
              
              if (clientsResult != null) {
                print("Client data received");
                List<Client> clients = [];
                List<Invitation> invitations = [];
                
                // Parse clients
                if (clientsResult.containsKey('clients') && clientsResult['clients'] is List) {
                  for (var clientData in clientsResult['clients']) {
                    clients.add(Client.fromJson(clientData));
                  }
                }
                
                // Parse invitations
                if (clientsResult.containsKey('invitations') && clientsResult['invitations'] is List) {
                  for (var inviteData in clientsResult['invitations']) {
                    invitations.add(Invitation.fromJson(inviteData));
                  }
                }
                
                setState(() {
                  _clients = clients;
                  _invitations = invitations;
                });
              }
            }
          } else {
            // We have a trainer account but no organization ID
            setState(() {
              _errorMessage = 'Your account has trainer permissions but no organization is set up. '
                            'Please complete your organization setup on the web platform.';
            });
          }
        } else {
          setState(() {
            _errorMessage = 'You do not have access to organization management. '
                          'This feature is only available to trainer accounts.';
          });
        }
      } else {
        setState(() {
          _errorMessage = 'Failed to load account information';
        });
      }
    } catch (e) {
      print("Error in organization screen: $e");
      setState(() {
        _errorMessage = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  Future<void> _sendInvitation() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final result = await ApiService.createClientInvitation(
        _userAccount!.organizationId!,
        widget.authToken,
        _clientEmailController.text,
        _clientNameController.text
      );
      
      if (result != null) {
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invitation sent successfully!'))
        );
        
        // Clear form
        _clientNameController.clear();
        _clientEmailController.clear();
        
        // Refresh data
        _loadUserInfo();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send invitation'))
        );
        setState(() => _isLoading = false);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'))
      );
      setState(() => _isLoading = false);
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Organization Management"),
        backgroundColor: Colors.blue[800],
        bottom: _userAccount?.isOrganization == true 
          ? TabBar(
              controller: _tabController,
              tabs: [
                Tab(text: "Clients"),
                Tab(text: "Invitations"),
                Tab(text: "Shared Menus"),
              ],
            )
          : null,
      ),
      body: _isLoading 
        ? Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 20),
                Text(
                  "Loading trainer dashboard...",
                  style: TextStyle(fontSize: 16),
                ),
                SizedBox(height: 8),
                Text(
                  "This may take a moment",
                  style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                ),
              ],
            ),
          )
        : _errorMessage.isNotEmpty 
          ? Center(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Card(
                  elevation: 3,
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 60, color: Colors.orange),
                        SizedBox(height: 16),
                        Text(
                          "Access Issue",
                          style: TextStyle(
                            fontSize: 20, 
                            fontWeight: FontWeight.bold,
                            color: Colors.orange[800],
                          ),
                        ),
                        SizedBox(height: 16),
                        Text(
                          _errorMessage,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 16),
                        ),
                        SizedBox(height: 20),
                        if (_errorMessage.contains("trainer permissions")) 
                          OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            child: Text("Return to App"),
                          )
                        else
                          ElevatedButton(
                            onPressed: _loadUserInfo,
                            child: Text("Try Again"),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            )
          : TabBarView(
              controller: _tabController,
              children: [
                _buildClientsTab(),
                _buildInvitationsTab(),
                _buildSharedMenusTab(),
              ],
            ),
      floatingActionButton: _userAccount?.isOrganization == true
        ? FloatingActionButton(
            onPressed: _showInviteDialog,
            tooltip: 'Invite Client',
            child: Icon(Icons.person_add),
          )
        : null,
    );
  }
  
  Widget _buildClientsTab() {
    if (_clients.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              "No clients yet",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              "Invite clients using the + button below",
              style: TextStyle(color: Colors.grey[700]),
            ),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: _clients.length,
      itemBuilder: (context, index) {
        final client = _clients[index];
        return Card(
          margin: EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              child: Text(client.name.isNotEmpty ? client.name[0].toUpperCase() : "?"),
            ),
            title: Text(client.name),
            subtitle: Text(client.email),
            trailing: client.isActive
              ? Icon(Icons.check_circle, color: Colors.green)
              : Icon(Icons.warning, color: Colors.orange),
            onTap: () => _showClientDetails(client),
          ),
        );
      },
    );
  }
  
  Widget _buildInvitationsTab() {
    if (_invitations.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.mail_outline, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              "No pending invitations",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              "Invite clients using the + button below",
              style: TextStyle(color: Colors.grey[700]),
            ),
          ],
        ),
      );
    }
    
    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: _invitations.length,
      itemBuilder: (context, index) {
        final invitation = _invitations[index];
        return Card(
          margin: EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: invitation.isPending ? Colors.amber : Colors.grey,
              child: Icon(
                invitation.isPending ? Icons.hourglass_empty : Icons.person_outline,
                color: Colors.white,
              ),
            ),
            title: Text(invitation.clientName),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(invitation.clientEmail),
                SizedBox(height: 4),
                Text(
                  invitation.isPending
                    ? "Pending - Expires ${_formatDate(invitation.expiresAt)}"
                    : "Status: ${invitation.status.toUpperCase()}",
                  style: TextStyle(
                    color: invitation.isPending
                      ? invitation.isExpired ? Colors.red : Colors.orange
                      : Colors.grey,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            isThreeLine: true,
            trailing: invitation.isPending
              ? IconButton(
                  icon: Icon(Icons.refresh),
                  tooltip: "Resend invitation",
                  onPressed: () => _resendInvitation(invitation),
                )
              : null,
          ),
        );
      },
    );
  }
  
  Widget _buildSharedMenusTab() {
    // This is a placeholder that will show shared menus across clients
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restaurant_menu, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "Shared Menus",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "Manage menus you've shared with clients",
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.add),
            label: Text("Create New Menu"),
            onPressed: () {
              Navigator.pushNamed(
                context, 
                '/client-menu-creator',
                arguments: {
                  'organizationId': _organization?.id,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                },
              );
            },
          ),
        ],
      ),
    );
  }
  
  void _showClientDetails(Client client) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.4,
        maxChildSize: 0.6,
        minChildSize: 0.3,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      margin: EdgeInsets.only(bottom: 16),
                    ),
                  ),
                  Center(
                    child: CircleAvatar(
                      radius: 36,
                      child: Text(
                        client.name.isNotEmpty ? client.name[0].toUpperCase() : "?",
                        style: TextStyle(fontSize: 24),
                      ),
                    ),
                  ),
                  SizedBox(height: 16),
                  Center(
                    child: Text(
                      client.name,
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                    ),
                  ),
                  Center(
                    child: Text(
                      client.email,
                      style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                    ),
                  ),
                  SizedBox(height: 24),
                  ListTile(
                    leading: Icon(Icons.calendar_today),
                    title: Text("Joined Date"),
                    subtitle: Text(_formatDate(client.joinedDate)),
                  ),
                  ListTile(
                    leading: Icon(Icons.person_pin),
                    title: Text("Status"),
                    subtitle: Text(client.isActive ? "Active" : "Inactive"),
                    trailing: Container(
                      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: client.isActive ? Colors.green[100] : Colors.red[100],
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        client.isActive ? "ACTIVE" : "INACTIVE",
                        style: TextStyle(
                          color: client.isActive ? Colors.green[800] : Colors.red[800],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      ElevatedButton.icon(
                        icon: Icon(Icons.restaurant_menu),
                        label: Text("Create Menu"),
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.pushNamed(
                            context, 
                            '/create-client-menu',
                            arguments: {
                              'clientId': client.id,
                              'clientName': client.name,
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                            },
                          );
                        },
                      ),
                      OutlinedButton.icon(
                        icon: Icon(Icons.preview),
                        label: Text("View Menus"),
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.pushNamed(
                            context, 
                            '/client-menus',
                            arguments: {
                              'clientId': client.id,
                              'clientName': client.name,
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                            },
                          );
                        },
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      OutlinedButton.icon(
                        icon: Icon(Icons.book),
                        label: Text("Saved Recipes"),
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.pushNamed(
                            context, 
                            '/client-recipes',
                            arguments: {
                              'clientId': client.id,
                              'clientName': client.name,
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                            },
                          );
                        },
                      ),
                      OutlinedButton.icon(
                        icon: Icon(Icons.settings),
                        label: Text("Preferences"),
                        onPressed: () {
                          Navigator.pop(context);
                          Navigator.pushNamed(
                            context, 
                            '/client-preferences',
                            arguments: {
                              'clientId': client.id,
                              'clientName': client.name,
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                            },
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
  
  void _resendInvitation(Invitation invitation) async {
    setState(() => _isLoading = true);
    
    try {
      final result = await ApiService.resendInvitation(
        invitation.id,
        widget.authToken
      );
      
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invitation resent successfully to ${invitation.clientEmail}'))
        );
        
        // Refresh data
        _loadUserInfo();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to resend invitation: ${result['error'] ?? "Unknown error"}'))
        );
        setState(() => _isLoading = false);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'))
      );
      setState(() => _isLoading = false);
    }
  }
  
  void _showInviteDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Invite a Client"),
        content: Form(
          key: _formKey,
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
              if (_formKey.currentState!.validate()) {
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
  
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
}