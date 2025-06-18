import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_management_model.dart';
import '../Providers/auth_providers.dart';
import '../services/organization_client_service.dart';
import '../components/subscription_route_wrapper.dart';

class OrganizationClientsScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  
  OrganizationClientsScreen({
    required this.userId,
    required this.authToken,
  });
  
  @override
  _OrganizationClientsScreenState createState() => _OrganizationClientsScreenState();
}

class _OrganizationClientsScreenState extends State<OrganizationClientsScreen> {
  bool _isLoading = true;
  List<ClientUser> _clients = [];
  String? _errorMessage;
  
  // Controllers for the add client form
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  
  @override
  void initState() {
    super.initState();
    _loadClients();
  }
  
  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
  
  Future<void> _loadClients() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    
    try {
      final clients = await OrganizationClientService.getOrganizationClients(
        widget.authToken
      );
      
      setState(() {
        _clients = clients;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = "Error loading clients: $e";
      });
    }
  }
  
  Future<void> _addClient() async {
    if (_nameController.text.isEmpty || 
        _emailController.text.isEmpty || 
        _passwordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("All fields are required"))
      );
      return;
    }
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final result = await OrganizationClientService.addOrganizationClient(
        widget.authToken,
        _nameController.text,
        _emailController.text,
        _passwordController.text,
      );
      
      if (result['success'] == true) {
        // Clear form and reload clients
        _nameController.clear();
        _emailController.clear();
        _passwordController.clear();
        await _loadClients();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Client added successfully"))
        );
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = result['error'] ?? "Failed to add client";
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_errorMessage!))
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = "Error adding client: $e";
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage!))
      );
    }
  }
  
  Future<void> _removeClient(ClientUser client) async {
    // Show confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Remove Client"),
        content: Text("Are you sure you want to remove ${client.name}?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text("Cancel"),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text("Remove"),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
          ),
        ],
      ),
    );
    
    if (confirm != true) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final result = await OrganizationClientService.removeOrganizationClient(
        widget.authToken,
        client.id,
      );
      
      if (result['success'] == true) {
        await _loadClients();
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Client removed successfully"))
        );
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = result['error'] ?? "Failed to remove client";
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_errorMessage!))
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = "Error removing client: $e";
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_errorMessage!))
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return SubscriptionRouteWrapper(
      child: Scaffold(
        appBar: AppBar(
          title: Text("Organization Clients"),
          actions: [
            IconButton(
              icon: Icon(Icons.refresh),
              onPressed: _loadClients,
            ),
          ],
        ),
        body: _isLoading
            ? Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(child: Text(_errorMessage!))
                : Column(
                    children: [
                      // Add client form
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Add Client",
                                  style: TextStyle(
                                    fontSize: 18, 
                                    fontWeight: FontWeight.bold
                                  ),
                                ),
                                SizedBox(height: 16),
                                TextField(
                                  controller: _nameController,
                                  decoration: InputDecoration(
                                    labelText: "Name",
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                                SizedBox(height: 8),
                                TextField(
                                  controller: _emailController,
                                  decoration: InputDecoration(
                                    labelText: "Email",
                                    border: OutlineInputBorder(),
                                  ),
                                  keyboardType: TextInputType.emailAddress,
                                ),
                                SizedBox(height: 8),
                                TextField(
                                  controller: _passwordController,
                                  decoration: InputDecoration(
                                    labelText: "Password",
                                    border: OutlineInputBorder(),
                                  ),
                                  obscureText: true,
                                ),
                                SizedBox(height: 16),
                                ElevatedButton(
                                  onPressed: _addClient,
                                  child: Text("Add Client"),
                                  style: ElevatedButton.styleFrom(
                                    minimumSize: Size(double.infinity, 48),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      
                      // Clients list
                      Expanded(
                        child: _clients.isEmpty
                            ? Center(child: Text("No clients found"))
                            : ListView.builder(
                                itemCount: _clients.length,
                                itemBuilder: (context, index) {
                                  final client = _clients[index];
                                  return ListTile(
                                    title: Text(client.name),
                                    subtitle: Text(client.email),
                                    trailing: IconButton(
                                      icon: Icon(Icons.delete, color: Colors.red),
                                      onPressed: () => _removeClient(client),
                                    ),
                                    onTap: () {
                                      // Navigate to client detail screen
                                      Navigator.pushNamed(
                                        context, 
                                        '/client-detail',
                                        arguments: {
                                          'clientId': client.id,
                                          'clientName': client.name,
                                          'userId': widget.userId,
                                          'authToken': widget.authToken,
                                        },
                                      ).then((_) => _loadClients());
                                    },
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
      ),
    );
  }
}