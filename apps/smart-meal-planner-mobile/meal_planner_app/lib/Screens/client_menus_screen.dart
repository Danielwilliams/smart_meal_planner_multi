import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientMenusScreen extends StatefulWidget {
  final int clientId;
  final String clientName;
  final int userId;
  final String authToken;

  ClientMenusScreen({
    required this.clientId,
    required this.clientName,
    required this.userId,
    required this.authToken,
  });

  @override
  _ClientMenusScreenState createState() => _ClientMenusScreenState();
}

class _ClientMenusScreenState extends State<ClientMenusScreen> {
  bool _isLoading = true;
  List<dynamic> _menus = [];
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadClientMenus();
  }

  Future<void> _loadClientMenus() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      print("Loading menus for client ID: ${widget.clientId}");
      final result = await ApiService.getClientMenus(
        widget.clientId,
        widget.authToken,
      );
      
      print("Client Menus API Result: $result");
      print("Result type: ${result.runtimeType}");
      
      // Since ApiService.getClientMenus ALWAYS returns a Map<String, dynamic>,
      // we don't need to check if result is List - it will never be a List
      if (result is Map<String, dynamic>) {
        // Check for menus field first
        if (result.containsKey('menus') && result['menus'] is List) {
          setState(() {
            _menus = List<dynamic>.from(result['menus']);
          });
          print("Found 'menus' key with ${_menus.length} menus");
        }
        // Check for shared_menus field (specific to the client dashboard endpoint)
        else if (result.containsKey('shared_menus') && result['shared_menus'] is List) {
          setState(() {
            _menus = List<dynamic>.from(result['shared_menus']);
          });
          print("Found 'shared_menus' key with ${_menus.length} menus");
        }
        // Check for error
        else if (result.containsKey('error')) {
          setState(() {
            _errorMessage = result['error'] ?? 'Failed to load menus';
          });
          print("Error loading menus: $_errorMessage");
        }
        // If no menus are found, set an appropriate error message
        else {
          setState(() {
            _errorMessage = 'No menus found';
          });
          print("No menus found in response");
        }
      } else {
        // This should never happen since getClientMenus always returns Map<String, dynamic>
        setState(() {
          _errorMessage = 'Unexpected response format';
        });
        print("Unexpected response format: ${result.runtimeType}");
      }
    } catch (e) {
      print("Exception loading client menus: $e");
      setState(() {
        _errorMessage = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
      print("Menu loading complete. Found ${_menus.length} menus");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.clientName}'s Menus"),
        actions: [
          IconButton(
            icon: Icon(Icons.add),
            tooltip: 'Create New Menu',
            onPressed: () {
              Navigator.pushNamed(
                context, 
                '/create-client-menu',
                arguments: {
                  'clientId': widget.clientId,
                  'clientName': widget.clientName,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                },
              ).then((_) => _loadClientMenus());
            },
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _errorMessage.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.red),
                      SizedBox(height: 16),
                      Text(
                        _errorMessage,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16),
                      ),
                      SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: _loadClientMenus,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _menus.isEmpty
                  ? _buildEmptyState()
                  : _buildMenuList(),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restaurant_menu, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "No Menus Available",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "You haven't created any menus for ${widget.clientName} yet",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.add),
            label: Text('Create Menu'),
            onPressed: () {
              Navigator.pushNamed(
                context, 
                '/create-client-menu',
                arguments: {
                  'clientId': widget.clientId,
                  'clientName': widget.clientName,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                },
              ).then((_) => _loadClientMenus());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMenuList() {
    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: _menus.length,
      itemBuilder: (context, index) {
        final menu = _menus[index];
        final title = menu['title'] ?? 'Untitled Menu';
        final createdAt = menu['created_at'] != null 
            ? DateTime.parse(menu['created_at'])
            : DateTime.now();
        final formattedDate = _formatDate(createdAt);
        final hasMetadata = menu['metadata'] != null && menu['metadata'] is Map;
        final mealCount = hasMetadata && menu['metadata'].containsKey('meal_count') 
            ? menu['metadata']['meal_count'] 
            : (menu['days'] != null && menu['days'] is List ? menu['days'].length : 'Unknown');
            
        return Card(
          margin: EdgeInsets.only(bottom: 16),
          child: ListTile(
            contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).primaryColor,
              child: Icon(Icons.restaurant_menu, color: Colors.white),
            ),
            title: Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 4),
                Text('Created: $formattedDate'),
                Text('Meals: $mealCount'),
              ],
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.visibility),
                  tooltip: 'View Menu',
                  onPressed: () => _viewMenuDetails(menu),
                ),
                IconButton(
                  icon: Icon(Icons.share),
                  tooltip: 'Share Again',
                  onPressed: () => _reshareMenu(menu),
                ),
              ],
            ),
            onTap: () => _viewMenuDetails(menu),
          ),
        );
      },
    );
  }

  void _viewMenuDetails(dynamic menu) {
    final menuId = menu['id'] ?? 0;
    
    // Navigate to menu details screen
    Navigator.pushNamed(
      context, 
      '/menu-details',
      arguments: {
        'menuId': menuId,
        'userId': widget.userId,
        'authToken': widget.authToken,
        'clientId': widget.clientId,
        'clientName': widget.clientName,
      },
    );
  }

  void _reshareMenu(dynamic menu) async {
    final menuId = menu['id'] ?? 0;
    
    if (menuId == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invalid menu ID')),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final result = await ApiService.shareMenuWithClient(
        menuId, 
        widget.clientId,
        widget.authToken,
      );
      
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Menu shared successfully with ${widget.clientName}')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to share menu: ${result['error'] ?? "Unknown error"}')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
}