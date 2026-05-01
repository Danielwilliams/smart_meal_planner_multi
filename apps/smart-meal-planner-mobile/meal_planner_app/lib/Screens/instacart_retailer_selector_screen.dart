import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import '../services/instacart_service.dart';

class InstacartRetailerSelectorScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final String? initialZipCode;
  // Callback function that will be called when a retailer is selected
  // Use dynamic Function type to handle any callback structure
  final dynamic onRetailerSelected;

  const InstacartRetailerSelectorScreen({
    Key? key,
    required this.userId,
    required this.authToken,
    this.initialZipCode,
    this.onRetailerSelected,
  }) : super(key: key);

  @override
  _InstacartRetailerSelectorScreenState createState() => _InstacartRetailerSelectorScreenState();
}

class _InstacartRetailerSelectorScreenState extends State<InstacartRetailerSelectorScreen> {
  bool _isLoading = false;
  List<Map<String, dynamic>> _retailers = [];
  String? _error;
  String? _zipCode;
  final _zipCodeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _zipCode = widget.initialZipCode;
    _zipCodeController.text = _zipCode ?? '';
    
    if (_zipCode != null) {
      _fetchRetailers();
    }
  }

  @override
  void dispose() {
    _zipCodeController.dispose();
    super.dispose();
  }

  Future<void> _fetchRetailers() async {
    if (_zipCode == null || _zipCode!.isEmpty) {
      setState(() {
        _error = "Please enter a ZIP code";
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for Instacart retailers search");
      }

      if (validToken == null) {
        setState(() {
          _isLoading = false;
          _error = 'Authentication token is invalid. Please log in again.';
        });
        return;
      }

      final result = await InstacartService.getNearbyRetailers(
        validToken,
        _zipCode!,
      );

      // Check if the result is an error response with token expiration
      if (result.isNotEmpty &&
          result[0] is Map &&
          result[0].containsKey('detail') &&
          (result[0]['detail'] == 'Token has expired' || result[0]['detail'] == 'Could not validate credentials')) {

        print("🔑 Token expired error detected in Instacart retailers response");

        // Try to refresh the token
        if (await authProvider.refreshTokenIfNeeded()) {
          // Token refreshed, retry the fetch with the new token
          print("🔄 Token refreshed, retrying Instacart retailers search");
          setState(() {
            _isLoading = false; // Reset loading state before retrying
          });
          return _fetchRetailers();
        } else {
          // Token refresh failed, show login error
          setState(() {
            _isLoading = false;
            _error = 'Your session has expired. Please log in again.';
          });
          return;
        }
      }

      setState(() {
        _isLoading = false;
        _retailers = result;
        if (result.isEmpty) {
          _error = "No retailers found for ZIP code $_zipCode";
        }
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = "Error fetching retailers: $e";
      });
    }
  }

  void _updateZipCode() {
    setState(() {
      _zipCode = _zipCodeController.text.trim();
    });
    _fetchRetailers();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Select Instacart Retailer"),
      ),
      body: Column(
        children: [
          // Instacart branding
          Container(
            padding: EdgeInsets.all(16),
            color: Color(0xFFF36D00), // Instacart orange color
            child: Center(
              child: Text(
                "Powered by Instacart",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          
          // ZIP code input
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _zipCodeController,
                    decoration: InputDecoration(
                      labelText: "Enter ZIP Code",
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.location_on),
                    ),
                    keyboardType: TextInputType.number,
                    maxLength: 5,
                  ),
                ),
                SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _updateZipCode,
                  child: Text("Search"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Color(0xFF43B02A), // Instacart green
                    padding: EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ],
            ),
          ),
          
          // Error message
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Text(
                _error!,
                style: TextStyle(color: Colors.red),
              ),
            ),
          
          // Loading indicator
          if (_isLoading)
            Expanded(
              child: Center(
                child: CircularProgressIndicator(),
              ),
            ),
          
          // Retailers list
          if (!_isLoading && _retailers.isNotEmpty)
            Expanded(
              child: ListView.builder(
                itemCount: _retailers.length,
                itemBuilder: (context, index) {
                  final retailer = _retailers[index];
                  return Card(
                    margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: ListTile(
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.grey[200],
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Icon(
                          Icons.store,
                          color: Color(0xFF43B02A), // Instacart green
                        ),
                      ),
                      title: Text(retailer['name']?.toString() ?? "Unknown Store"),
                      subtitle: Text(retailer['address']?.toString() ?? ""),
                      trailing: Icon(Icons.chevron_right),
                      onTap: () {
                        // Create a type-safe copy of the retailer map
                        final Map<String, dynamic> safeRetailer = Map<String, dynamic>.from(retailer);

                        // Extract retailer ID, ensuring it's a string
                        var retailerId = safeRetailer['id'] ?? safeRetailer['retailer_id'] ?? '';
                        print("Raw retailerId from API: $retailerId (${retailerId.runtimeType})");

                        // Force conversion to string no matter what type it is
                        String retailerIdStr = retailerId.toString();
                        String retailerNameStr = (safeRetailer['name'] ?? 'Unknown Store').toString();

                        print("Converted retailerId to string: $retailerIdStr (${retailerIdStr.runtimeType})");
                        print("Retailer name: $retailerNameStr (${retailerNameStr.runtimeType})");

                        if (widget.onRetailerSelected != null) {
                          print("Calling onRetailerSelected with ID: $retailerIdStr (${retailerIdStr.runtimeType})");
                          print("Retailer name: $retailerNameStr (${retailerNameStr.runtimeType})");

                          // Ensure we're passing string values - use string interpolation for absolute safety
                          String finalRetailerId = '$retailerIdStr';
                          String finalRetailerName = '$retailerNameStr';

                          print("FINAL callback values - ID: $finalRetailerId (${finalRetailerId.runtimeType})");
                          print("FINAL callback values - Name: $finalRetailerName (${finalRetailerName.runtimeType})");

                          // Handle all possible callback types
                          try {
                            // Try to determine the type of callback
                            if (widget.onRetailerSelected is Function) {
                              print("Callback is a Function");
                              // Standard function call
                              (widget.onRetailerSelected as Function)(finalRetailerId, finalRetailerName);
                            } else if (widget.onRetailerSelected is Map) {
                              print("Callback is a Map");
                              // Handle Map-based callback (sometimes Flutter passes callbacks as maps)
                              if ((widget.onRetailerSelected as Map).containsKey('call')) {
                                var callFunction = (widget.onRetailerSelected as Map)['call'];
                                if (callFunction is Function) {
                                  callFunction(finalRetailerId, finalRetailerName);
                                }
                              }
                            } else {
                              print("Attempting to call dynamic callback directly");
                              // Try direct invocation as last resort
                              widget.onRetailerSelected(finalRetailerId, finalRetailerName);
                            }
                          } catch (e) {
                            print("All callback attempts failed: $e");
                            // Fallback: navigate directly to the shopping list
                            Navigator.pushNamed(
                              context,
                              '/instacart-search',
                              arguments: {
                                'userId': widget.userId,
                                'authToken': widget.authToken,
                                'retailerId': finalRetailerId,
                                'retailerName': finalRetailerName,
                                'ingredients': <String>[], // Empty list, will prompt user for search
                              },
                            );
                          }
                          Navigator.pop(context);
                        } else {
                          // Navigate to search screen if callback is not provided
                          Navigator.pushNamed(
                            context,
                            '/instacart-search',
                            arguments: {
                              'userId': widget.userId,
                              'authToken': widget.authToken,
                              'retailerId': '$retailerIdStr',  // Force string with interpolation
                              'retailerName': '$retailerNameStr', // Force string with interpolation
                              'ingredients': <String>[], // Empty list, will prompt user for search
                            },
                          );
                        }
                      },
                    ),
                  );
                },
              ),
            ),
          
          // Empty state
          if (!_isLoading && _retailers.isEmpty && _error == null)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.store_outlined,
                      size: 64,
                      color: Colors.grey,
                    ),
                    SizedBox(height: 16),
                    Text(
                      "Enter a ZIP code to find nearby retailers",
                      style: TextStyle(fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}