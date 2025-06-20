import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import 'dart:math';

class CartScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final String storeName;
  final List<String> ingredients;

  CartScreen({
    required this.userId,
    required this.authToken,
    required this.storeName,
    required this.ingredients,
  });

  @override
  _CartScreenState createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  List<dynamic> _cartItems = [];
  double _totalCost = 0.0;
  bool _isLoading = false;
  String _statusMessage = '';

  @override
  void initState() {
    super.initState();
    _fetchCartData();
  }

  Future<void> _fetchCartData() async {
    setState(() => _isLoading = true);

    // Force storeName to Kroger for compatibility
    final storeName = "Kroger";
    print("Using Kroger as store name for cart (original: ${widget.storeName})");
    
    // Print cart parameters for debugging
    print("Cart parameters:");
    print("User ID: ${widget.userId}");
    print("Auth token available: ${widget.authToken.isNotEmpty}");
    print("Ingredients count: ${widget.ingredients.length}");
    print("Ingredients: ${widget.ingredients}");
    
    try {
      // First, check that we have Kroger authentication
      final prefs = await SharedPreferences.getInstance();
      final krogerAuthenticated = prefs.getBool('kroger_authenticated') ?? false;
      final krogerAccessToken = prefs.getString('kroger_access_token');
      
      print("Kroger authentication status: $krogerAuthenticated");
      print("Kroger access token available: ${krogerAccessToken?.isNotEmpty ?? false}");
      
      if (!krogerAuthenticated || krogerAccessToken == null || krogerAccessToken.isEmpty) {
        print("WARNING: Kroger auth missing before adding to cart");
        
        // Attempt to get a temp token before proceeding
        try {
          print("Attempting to get temp tokens from backend");
          final tempResult = await ApiService.getKrogerAuthStatus(widget.userId, widget.authToken);
          if (tempResult != null && tempResult.containsKey('access_token')) {
            print("Got temp token from backend: ${tempResult['access_token'].toString().substring(0, min(10, tempResult['access_token'].toString().length))}...");
            
            // Store in SharedPreferences
            await prefs.setString('kroger_access_token', tempResult['access_token'].toString());
            if (tempResult.containsKey('refresh_token')) {
              await prefs.setString('kroger_refresh_token', tempResult['refresh_token'].toString());
            }
            await prefs.setBool('kroger_authenticated', true);
            
            print("Saved temp tokens to SharedPreferences");
          }
        } catch (e) {
          print("Error getting temp tokens: $e");
        }
      }
    
      final result = await ApiService.addToInternalCart(
        userId: widget.userId,
        authToken: widget.authToken,
        storeName: storeName,
        ingredients: widget.ingredients,
      );
  
      setState(() => _isLoading = false);
  
      if (result != null) {
        print("Cart data received successfully");
        print("Items count: ${result["items"]?.length ?? 0}");
        print("Total cost: ${result["total_cost"] ?? 'not provided'}");
        
        setState(() {
          _cartItems = result["items"] ?? [];
          _totalCost = result["total_cost"]?.toDouble() ?? 0.0;
        });
        
        // Log first few items for debugging
        if (_cartItems.isNotEmpty) {
          print("First ${min(3, _cartItems.length)} items:");
          for (var i = 0; i < min(3, _cartItems.length); i++) {
            print("Item $i: ${_cartItems[i]['ingredient'] ?? _cartItems[i]['name']} - ${_cartItems[i]['price']}");
            
            // Check if image URL exists and is properly formatted
            if (_cartItems[i].containsKey('image_url') && _cartItems[i]['image_url'] != null) {
              print("  Image URL: ${_cartItems[i]['image_url']}");
              print("  Cleaned Image URL: ${ApiService.cleanImageUrl(_cartItems[i]['image_url'])}");
            }
          }
        }
      } else {
        print("Failed to fetch cart data");
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to fetch cart data."))
        );
      }
    } catch (e) {
      print("Error fetching cart data: $e");
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error fetching cart data: $e"))
      );
    }
  }

  Future<void> _placeOrder() async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Placing Kroger order...';
    });
    
    try {
      // Use Kroger as the store name regardless of what was passed in
      final storeName = "Kroger";
      print("Using Kroger as store name for order (original: ${widget.storeName})");
      
      // Verify we have Kroger authentication first
      final prefs = await SharedPreferences.getInstance();
      final krogerAuthenticated = prefs.getBool('kroger_authenticated') ?? false;
      final krogerAccessToken = prefs.getString('kroger_access_token');
      
      if (!krogerAuthenticated || krogerAccessToken == null || krogerAccessToken.isEmpty) {
        print("Kroger authentication missing, cannot place order");
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Kroger authentication required to place order"),
            duration: Duration(seconds: 3),
            action: SnackBarAction(
              label: 'Login',
              onPressed: () async {
                // Navigate to Kroger authentication screen
                await Navigator.pushNamed(
                  context, 
                  '/kroger-auth',
                  arguments: {
                    'userId': widget.userId,
                    'authToken': widget.authToken,
                  }
                );
                
                // Retry order after authentication
                _placeOrder();
              },
            ),
          )
        );
        setState(() {
          _isLoading = false;
          _statusMessage = '';
        });
        return;
      }
      
      // Ensure we have items to order
      if (_cartItems.isEmpty) {
        print("No items in cart, cannot place order");
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("No items in cart to order"))
        );
        setState(() {
          _isLoading = false;
          _statusMessage = '';
        });
        return;
      }
      
      // Log order parameters for debugging
      print("Placing Kroger order:");
      print("User ID: ${widget.userId}");
      print("Items: ${_cartItems.length}");
      print("Total: $_totalCost");
      
      final result = await ApiService.placeOrder(
        userId: widget.userId,
        authToken: widget.authToken,
        storeName: storeName,
        cartItems: _cartItems,
        totalCost: _totalCost,
      );
      
      setState(() {
        _isLoading = false;
        _statusMessage = '';
      });

      if (result != null && result["order_id"] != null) {
        // Order placed successfully
        final orderId = result["order_id"];
        print("Order placed successfully! ID: $orderId");
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Order Placed Successfully"),
            backgroundColor: Colors.green,
          )
        );
        
        // Navigate to order confirmation screen
        await Navigator.pushReplacementNamed(
          context,
          '/order',
          arguments: {
            'orderId': orderId,
            'totalCost': _totalCost,
            'status': 'pending',
          },
        );
      } else {
        // Order failed
        print("Failed to place order: ${result != null ? result.toString() : 'null response'}");
        
        String errorMessage = "Failed to place order.";
        if (result != null && result.containsKey('error')) {
          errorMessage = result['error'].toString();
        } else if (result != null && result.containsKey('message')) {
          errorMessage = result['message'].toString();
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
          )
        );
      }
    } catch (e) {
      print("Error placing order: $e");
      setState(() {
        _isLoading = false;
        _statusMessage = '';
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error: $e"),
          backgroundColor: Colors.red,
        )
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Shopping Cart (Kroger)"),
      ),
      body: Stack(
        children: [
          _isLoading && _statusMessage.isEmpty
            ? Center(child: CircularProgressIndicator())
            : Column(
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      ListView.builder(
                        itemCount: _cartItems.length,
                        itemBuilder: (context, index) {
                          final item = _cartItems[index];
                          final ingredient = item["ingredient"];
                          final price = item["price"] ?? 0.0;
                          final imageUrl = item["image_url"];
                          
                          // Extract image URL from nested objects if needed
                          String finalImageUrl = imageUrl;
                          if (finalImageUrl == null && item.containsKey('images')) {
                            if (item['images'] is List && (item['images'] as List).isNotEmpty) {
                              finalImageUrl = item['images'][0].toString();
                            } else if (item['images'] is Map) {
                              final imagesMap = item['images'] as Map;
                              if (imagesMap.isNotEmpty) {
                                finalImageUrl = imagesMap.values.first.toString();
                              }
                            }
                          }

                          return ListTile(
                            leading: finalImageUrl != null
                                ? SizedBox(
                                    width: 60,
                                    height: 60,
                                    child: Image.network(
                                      ApiService.cleanImageUrl(finalImageUrl),
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) {
                                        print("Error loading image: $error");
                                        print("Original URL: $finalImageUrl");
                                        print("Cleaned URL: ${ApiService.cleanImageUrl(finalImageUrl)}");
                                        return Container(
                                          width: 60,
                                          height: 60,
                                          color: Colors.grey[200],
                                          child: Icon(Icons.image_not_supported, color: Colors.grey),
                                        );
                                      },
                                    ),
                                  )
                                : Container(
                                    width: 60,
                                    height: 60,
                                    color: Colors.grey[200],
                                    child: Icon(Icons.image_not_supported, color: Colors.grey),
                                  ),
                            title: Text(ingredient),
                            subtitle: Text("\$${price.toStringAsFixed(2)}"),
                          );
                        },
                      ),
                      
                      // Add debug button
                      Positioned(
                        bottom: 10,
                        right: 10,
                        child: Opacity(
                          opacity: 0.7,
                          child: FloatingActionButton.small(
                            backgroundColor: Colors.grey[800],
                            child: Icon(Icons.bug_report, size: 20),
                            onPressed: () {
                              // Show debug info dialog with cart data
                              showDialog(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: Text("Kroger Cart Debug Info"),
                                  content: SingleChildScrollView(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text("Cart items count: ${_cartItems.length}"),
                                        Divider(),
                                        if (_cartItems.isNotEmpty) ...[
                                          Text("First item keys:", style: TextStyle(fontWeight: FontWeight.bold)),
                                          Text(_cartItems[0].keys.toList().toString()),
                                          SizedBox(height: 10),
                                          if (_cartItems[0].containsKey('image_url')) ...[
                                            Text("Image URL: ${_cartItems[0]['image_url']}"),
                                            Text("Cleaned URL: ${ApiService.cleanImageUrl(_cartItems[0]['image_url'])}"),
                                          ],
                                          if (_cartItems[0].containsKey('images')) ...[
                                            Text("Images field type: ${_cartItems[0]['images'].runtimeType}"),
                                            Text("Images value: ${_cartItems[0]['images']}"),
                                          ],
                                          Divider(),
                                          Text("First item:", style: TextStyle(fontWeight: FontWeight.bold)),
                                          Container(
                                            padding: EdgeInsets.all(8),
                                            color: Colors.grey[200],
                                            child: Text(
                                              _cartItems[0].toString(),
                                              style: TextStyle(fontSize: 12),
                                            ),
                                          ),
                                        ] else
                                          Text("No cart items available"),
                                      ],
                                    ),
                                  ),
                                  actions: [
                                    TextButton(
                                      child: Text("Close"),
                                      onPressed: () => Navigator.of(context).pop(),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text("Total Cost: \$${_totalCost.toStringAsFixed(2)}",
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                ),
                ElevatedButton(
                  onPressed: _placeOrder,
                  child: Text("Place Order"),
                ),
                SizedBox(height: 20),
              ],
            ),
          // Loading overlay with status message
          if (_statusMessage.isNotEmpty)
            Container(
              color: Colors.black54,
              child: Center(
                child: Card(
                  margin: EdgeInsets.all(24),
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 20),
                        Text(
                          _statusMessage,
                          style: TextStyle(fontSize: 16),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}