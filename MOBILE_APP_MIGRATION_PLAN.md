# Mobile App Feature Migration Plan

## 1. Overview of the Current Mobile App

The mobile app is built with Flutter and follows a structured architecture:

- **API Service:** A comprehensive service for communicating with the backend API
- **Models:** Well-structured models for menu, recipe, and other data
- **Providers:** Authentication and state management using Provider pattern
- **Screens:** UI components for different app functionalities

The mobile app already supports:
- User authentication (login/signup)
- Organization vs client account distinction
- Menu generation and viewing
- Shopping list functionality
- Integration with Kroger for grocery ordering

## 2. Migration Strategy

I recommend a phased approach to migrating features from the web app:

### Phase 1: Core Features (Essential)
1. **Subscription System Integration**
   - Implement subscription checking similar to web app
   - Use environment variable-based access control
   - Add SessionStorage equivalent for Flutter (using SharedPreferences)

2. **User Management**
   - Add organization admin capabilities
   - Implement client management screens
   - Port user/client dashboard views

### Phase 2: Enhancement Features
1. **Rating System**
   - Implement recipe rating components
   - Add analytics integration
   - Create recommendation UI

2. **Recipe Management**
   - Add custom recipe creation/editing
   - Implement recipe saving functionality
   - Create recipe browsing screens

### Phase 3: Advanced Features
1. **Instacart Integration**
   - Port the web app's Instacart API integration
   - Implement store selection
   - Add cart management

2. **AI Shopping List Enhancements**
   - Implement AI-enhanced shopping experience
   - Add smart categorization
   - Implement meal-based shopping lists

## 3. Implementation Plan

### Phase 1: Subscription System Integration

#### 1.1 Add Subscription Models
```dart
// Create a new file: lib/models/subscription_model.dart
class Subscription {
  final bool hasSubscription;
  final bool isActive;
  final String status;
  final String subscriptionType;
  final bool isFreeTier;
  final String currency;
  final double monthlyAmount;
  
  Subscription({
    required this.hasSubscription,
    required this.isActive,
    required this.status,
    this.subscriptionType = 'free',
    this.isFreeTier = true,
    this.currency = 'usd',
    this.monthlyAmount = 0.0,
  });
  
  factory Subscription.fromJson(Map<String, dynamic> json) {
    return Subscription(
      hasSubscription: json['has_subscription'] ?? false,
      isActive: json['is_active'] ?? false,
      status: json['status'] ?? 'inactive',
      subscriptionType: json['subscription_type'] ?? 'free',
      isFreeTier: json['is_free_tier'] ?? true,
      currency: json['currency'] ?? 'usd',
      monthlyAmount: (json['monthly_amount'] is num) 
          ? (json['monthly_amount'] as num).toDouble() 
          : 0.0,
    );
  }
  
  // Default free subscription
  factory Subscription.free() {
    return Subscription(
      hasSubscription: true,
      isActive: true,
      status: 'active',
      subscriptionType: 'free',
      isFreeTier: true,
      currency: 'usd',
      monthlyAmount: 0.0,
    );
  }
}
```

#### 1.2 Add Subscription Provider
```dart
// Create a new file: lib/Providers/subscription_provider.dart
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/subscription_model.dart';
import '../services/api_service.dart';

class SubscriptionProvider extends ChangeNotifier {
  Subscription? _subscription;
  bool _isFreeAccessGranted = false;
  
  Subscription? get subscription => _subscription;
  bool get isFreeAccessGranted => _isFreeAccessGranted;
  bool get hasActiveSubscription => 
      _isFreeAccessGranted || (_subscription?.isActive ?? false);
  
  SubscriptionProvider() {
    _loadFromPrefs();
  }
  
  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _isFreeAccessGranted = prefs.getBool('freeAccessGranted') ?? false;
    notifyListeners();
  }
  
  Future<void> checkSubscription(String authToken) async {
    try {
      // First check if free access is already granted
      if (_isFreeAccessGranted) {
        _subscription = Subscription.free();
        notifyListeners();
        return;
      }
      
      // Call API to check subscription status
      final result = await ApiService.getUserSubscription(authToken);
      
      if (result != null) {
        // If SUBSCRIPTION_ENFORCE is false, always grant access
        if (result['enforce_subscription'] == false) {
          await _grantFreeAccess();
          _subscription = Subscription.free();
        } else {
          _subscription = Subscription.fromJson(result);
        }
      } else {
        // Default to free tier if API fails
        _subscription = Subscription.free();
      }
      
      notifyListeners();
    } catch (e) {
      print("Error checking subscription: $e");
      // Default to free tier on errors
      _subscription = Subscription.free();
      notifyListeners();
    }
  }
  
  Future<void> _grantFreeAccess() async {
    _isFreeAccessGranted = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('freeAccessGranted', true);
  }
  
  Future<void> resetSubscriptionCheck() async {
    _subscription = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('freeAccessGranted');
    _isFreeAccessGranted = false;
    notifyListeners();
  }
}
```

#### 1.3 Add Subscription API Methods to ApiService
```dart
// Add to api_service.dart
// Get user subscription status
static Future<Map<String, dynamic>> getUserSubscription(String authToken) async {
  try {
    print("Checking user subscription status");
    
    // Try both GET and POST methods since the web app had issues with method compatibility
    // First try GET
    final getResult = await _get("/user/subscription", authToken);
    if (getResult != null && getResult is Map) {
      final safeResult = _toStringDynamicMap(getResult);
      print("Subscription GET response: $safeResult");
      return safeResult;
    }
    
    // If GET fails, try POST
    final postResult = await _post("/user/subscription", {}, authToken);
    if (postResult != null && postResult is Map) {
      final safeResult = _toStringDynamicMap(postResult);
      print("Subscription POST response: $safeResult");
      return safeResult;
    }
    
    // Check if SUBSCRIPTION_ENFORCE environment variable is disabled
    final envResult = await _get("/subscriptions/check-enforcement", authToken);
    if (envResult != null && envResult is Map && envResult.containsKey('enforce_subscription')) {
      final safeResult = _toStringDynamicMap(envResult);
      print("Subscription enforcement check: $safeResult");
      
      if (safeResult['enforce_subscription'] == false) {
        return {
          "has_subscription": true,
          "is_active": true,
          "status": "active",
          "subscription_type": "free",
          "is_free_tier": true,
          "enforce_subscription": false
        };
      }
    }
    
    // Default response when API fails but we still want to grant access
    return {
      "has_subscription": true,
      "is_active": true,
      "status": "active",
      "subscription_type": "free",
      "is_free_tier": true
    };
  } catch (e) {
    print("Error getting subscription status: $e");
    return {
      "has_subscription": true,
      "is_active": true,
      "status": "active",
      "subscription_type": "free",
      "is_free_tier": true,
      "error": e.toString()
    };
  }
}
```

#### 1.4 Create Subscription Route Wrapper (like SubscriptionRoute in web app)
```dart
// Create new file: lib/components/subscription_route_wrapper.dart
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
    
    // For authenticated users, always grant access
    if (authProvider.isLoggedIn) {
      return widget.child;
    }
    
    // For unauthenticated users, check subscription
    if (subscriptionProvider.hasActiveSubscription) {
      return widget.child;
    }
    
    // If no active subscription, show subscription page or login prompt
    return widget.fallbackWidget ?? Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Subscription Required", 
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
                // Navigate to subscription page
                Navigator.pushNamed(context, '/subscription');
              },
              child: Text("View Subscription Options"),
            ),
          ],
        ),
      ),
    );
  }
}
```

### Phase 2: User Management System

#### 2.1 Add User Management Models
```dart
// Create new file: lib/models/user_management_model.dart
class UserProfile {
  final int id;
  final String name;
  final String email;
  final String? accountType;
  final bool isActive;
  final DateTime? createdAt;
  final String? subscription;
  final bool? isOrganization;
  final int? organizationId;
  
  UserProfile({
    required this.id,
    required this.name,
    required this.email,
    this.accountType,
    required this.isActive,
    this.createdAt,
    this.subscription,
    this.isOrganization,
    this.organizationId,
  });
  
  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? json['username'] ?? '',
      email: json['email'] ?? '',
      accountType: json['account_type'] ?? json['accountType'],
      isActive: json['is_active'] ?? true,
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at']) 
          : null,
      subscription: json['subscription'],
      isOrganization: json['is_organization'],
      organizationId: json['organization_id'] is int 
          ? json['organization_id'] 
          : int.tryParse(json['organization_id'].toString()),
    );
  }
}

class ClientUser extends UserProfile {
  final String? dietType;
  final List<String>? allergies;
  final String? notes;
  
  ClientUser({
    required int id,
    required String name,
    required String email,
    required bool isActive,
    String? accountType,
    DateTime? createdAt,
    String? subscription,
    bool? isOrganization,
    int? organizationId,
    this.dietType,
    this.allergies,
    this.notes,
  }) : super(
    id: id,
    name: name,
    email: email,
    accountType: accountType,
    isActive: isActive,
    createdAt: createdAt,
    subscription: subscription,
    isOrganization: isOrganization,
    organizationId: organizationId,
  );
  
  factory ClientUser.fromJson(Map<String, dynamic> json) {
    // Parse allergies from various formats
    List<String>? allergies;
    if (json['allergies'] != null) {
      if (json['allergies'] is List) {
        allergies = List<String>.from(json['allergies'].map((a) => a.toString()));
      } else if (json['allergies'] is String) {
        allergies = json['allergies'].toString().split(',').map((a) => a.trim()).toList();
      }
    }
    
    return ClientUser(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? json['username'] ?? '',
      email: json['email'] ?? '',
      accountType: json['account_type'] ?? json['accountType'],
      isActive: json['is_active'] ?? true,
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at']) 
          : null,
      subscription: json['subscription'],
      isOrganization: json['is_organization'],
      organizationId: json['organization_id'] is int 
          ? json['organization_id'] 
          : int.tryParse(json['organization_id'].toString()),
      dietType: json['diet_type'] ?? json['dietType'],
      allergies: allergies,
      notes: json['notes'],
    );
  }
}
```

#### 2.2 Add User Management API Methods to ApiService
```dart
// Add to api_service.dart
// Get organization clients
static Future<List<ClientUser>> getOrganizationClients(String authToken) async {
  try {
    print("Getting organization clients");
    
    // First try the subscriptions endpoint (which is where they were moved in the web app)
    final result = await _get("/subscriptions/user-management/org/clients", authToken);
    
    if (result != null) {
      if (result is List) {
        return result
          .map((client) => ClientUser.fromJson(client))
          .toList();
      } else if (result is Map && result.containsKey('clients') && result['clients'] is List) {
        return (result['clients'] as List)
          .map((client) => ClientUser.fromJson(client))
          .toList();
      }
    }
    
    // If first endpoint fails, try the original endpoint
    final fallbackResult = await _get("/organization-clients", authToken);
    
    if (fallbackResult != null) {
      if (fallbackResult is List) {
        return fallbackResult
          .map((client) => ClientUser.fromJson(client))
          .toList();
      } else if (fallbackResult is Map && fallbackResult.containsKey('clients') && fallbackResult['clients'] is List) {
        return (fallbackResult['clients'] as List)
          .map((client) => ClientUser.fromJson(client))
          .toList();
      }
    }
    
    // Return empty list if both fail
    return [];
  } catch (e) {
    print("Error getting organization clients: $e");
    return [];
  }
}

// Add a client to organization
static Future<Map<String, dynamic>> addOrganizationClient(
  String authToken, 
  String name, 
  String email,
  String password
) async {
  try {
    print("Adding client to organization");
    
    // Try the subscriptions endpoint first
    final result = await _post("/subscriptions/user-management/org/clients", {
      "name": name,
      "email": email,
      "password": password,
    }, authToken);
    
    if (result != null && result is Map) {
      return _toStringDynamicMap(result);
    }
    
    // If first endpoint fails, try the original endpoint
    final fallbackResult = await _post("/organization-clients", {
      "name": name,
      "email": email,
      "password": password,
    }, authToken);
    
    if (fallbackResult != null && fallbackResult is Map) {
      return _toStringDynamicMap(fallbackResult);
    }
    
    // Return error if both fail
    return {
      "success": false,
      "error": "Failed to add client - API did not return valid response"
    };
  } catch (e) {
    print("Error adding organization client: $e");
    return {
      "success": false,
      "error": e.toString()
    };
  }
}

// Remove client from organization
static Future<Map<String, dynamic>> removeOrganizationClient(
  String authToken,
  int clientId
) async {
  try {
    print("Removing client $clientId from organization");
    
    // Try the subscriptions endpoint first
    final result = await _post("/subscriptions/user-management/org/clients/$clientId/delete", {}, authToken);
    
    if (result != null && result is Map) {
      return _toStringDynamicMap(result);
    }
    
    // If first endpoint fails, try the original endpoint
    final fallbackResult = await _post("/organization-clients/$clientId/delete", {}, authToken);
    
    if (fallbackResult != null && fallbackResult is Map) {
      return _toStringDynamicMap(fallbackResult);
    }
    
    // Return error if both fail
    return {
      "success": false,
      "error": "Failed to remove client - API did not return valid response"
    };
  } catch (e) {
    print("Error removing organization client: $e");
    return {
      "success": false,
      "error": e.toString()
    };
  }
}
```

#### 2.3 Create Organization Client Management Screen
```dart
// Create new file: lib/Screens/organization_clients_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_management_model.dart';
import '../Providers/auth_providers.dart';
import '../services/api_service.dart';

class OrganizationClientsScreen extends StatefulWidget {
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
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      if (authProvider.authToken == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = "Authentication required";
        });
        return;
      }
      
      final clients = await ApiService.getOrganizationClients(authProvider.authToken!);
      
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
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      if (authProvider.authToken == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = "Authentication required";
        });
        return;
      }
      
      final result = await ApiService.addOrganizationClient(
        authProvider.authToken!,
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
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      
      if (authProvider.authToken == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = "Authentication required";
        });
        return;
      }
      
      final result = await ApiService.removeOrganizationClient(
        authProvider.authToken!,
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
    return Scaffold(
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
                                      arguments: client,
                                    );
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}
```

## 4. Timeline and Resources

### Estimated Timeline
- Phase 1: Subscription System - 2 weeks
- Phase 2: User Management - 2 weeks
- Phase 3: Rating System - 3 weeks
- Phase 4: Recipe Management - 3 weeks
- Phase 5: Instacart Integration - 4 weeks
- Phase 6: AI Shopping List - 3 weeks

### Required Resources
- 1 Flutter Developer
- Access to API endpoints and documentation
- Test accounts for all user types
- Testing devices (Android/iOS)

### Implementation Approach
1. Develop and test each feature in isolation
2. Integrate with existing mobile app code
3. Test on multiple devices and accounts
4. Create detailed documentation for each feature

## 5. Key Considerations

1. **Code Compatibility**: Flutter code syntax differs from React - careful translation needed

2. **State Management**: Use Flutter's Provider pattern instead of React's Context API

3. **Navigation**: Flutter's Navigator differs from React Router - routes need restructuring

4. **API Integration**: Reuse API service patterns in mobile app for consistency

5. **Error Handling**: Implement robust error handling, especially for network calls

6. **User Experience**: Adapt UI components for mobile form factors

7. **Testing**: Create comprehensive tests for each migrated feature

## 6. Next Steps

1. Start with the Subscription System integration as top priority
2. Create a detailed specification for each feature
3. Setup a test environment with all necessary accounts
4. Begin implementation following the phased approach
5. Review and refine the plan as implementation progresses