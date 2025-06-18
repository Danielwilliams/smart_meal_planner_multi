import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../Providers/auth_providers.dart';
import '../services/instacart_service.dart';

class InstacartCartScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final String retailerId;
  final String retailerName;

  // Constructor to explicitly force string conversion
  InstacartCartScreen({
    Key? key,
    required this.userId,
    required this.authToken,
    required dynamic retailerId,
    required dynamic retailerName,
  }) :
    // Force string conversion during initialization
    this.retailerId = '$retailerId',
    this.retailerName = '$retailerName',
    super(key: key);

  @override
  _InstacartCartScreenState createState() => _InstacartCartScreenState();
}

class _InstacartCartScreenState extends State<InstacartCartScreen> {
  bool _isLoading = true;
  bool _checkingOut = false;
  Map<String, dynamic> _cartData = {};
  List<dynamic> _cartItems = [];
  String? _error;
  double _totalPrice = 0.0;

  @override
  void initState() {
    super.initState();
    _fetchCartContents();
  }

  Future<void> _fetchCartContents() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Debug retailer ID type
      print("In InstacartCartScreen._fetchCartContents");
      print("RetailerId: ${widget.retailerId} (${widget.retailerId.runtimeType})");
      print("RetailerName: ${widget.retailerName} (${widget.retailerName.runtimeType})");

      // Ensure retailerId is a string
      String retailerIdStr = widget.retailerId.toString();

      final cartData = await InstacartService.getCartContents(
        widget.authToken,
        retailerIdStr,
      );

      setState(() {
        _isLoading = false;
        _cartData = cartData;

        if (cartData.containsKey('items')) {
          _cartItems = cartData['items'] as List<dynamic>;
          print("Retrieved ${_cartItems.length} items from cart");
        } else {
          _cartItems = [];
          print("No items found in cart data");
        }

        // Calculate total price
        _totalPrice = 0.0;
        for (var item in _cartItems) {
          final price = item['price'];
          final quantity = item['quantity'] ?? 1;
          if (price != null && price is num) {
            _totalPrice += price * quantity;
          }
        }

        print("Total cart price: \$${_totalPrice.toStringAsFixed(2)}");

        if (_cartItems.isEmpty) {
          _error = "Your cart is empty";
        }
      });
    } catch (e) {
      print("Error in _fetchCartContents: $e");
      setState(() {
        _isLoading = false;
        _error = "Error fetching cart contents: $e";
      });
    }
  }

  Future<void> _proceedToCheckout() async {
    if (_cartItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Your cart is empty")),
      );
      return;
    }

    setState(() {
      _checkingOut = true;
    });

    try {
      print("Proceeding to checkout with retailerId: ${widget.retailerId} (${widget.retailerId.runtimeType})");

      // Ensure retailerId is a string
      String retailerIdStr = widget.retailerId.toString();

      final checkoutUrl = await InstacartService.getCheckoutUrl(
        widget.authToken,
        retailerIdStr,
      );

      setState(() {
        _checkingOut = false;
      });

      if (checkoutUrl != null) {
        print("Got checkout URL: $checkoutUrl");

        // Launch checkout URL in external browser
        final url = Uri.parse(checkoutUrl);
        if (await canLaunchUrl(url)) {
          print("Launching URL in browser");
          await launchUrl(url, mode: LaunchMode.externalApplication);
        } else {
          print("Could not launch URL: $url");
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Could not open checkout URL")),
          );
        }
      } else {
        print("Failed to get checkout URL");
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to get checkout URL")),
        );
      }
    } catch (e) {
      print("Error in _proceedToCheckout: $e");
      setState(() {
        _checkingOut = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error proceeding to checkout: $e")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.retailerName} Cart"),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _fetchCartContents,
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.shopping_cart_outlined,
                        size: 64,
                        color: Colors.grey,
                      ),
                      SizedBox(height: 16),
                      Text(
                        _error!,
                        style: TextStyle(fontSize: 16),
                      ),
                      SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: () {
                          Navigator.pop(context);
                        },
                        child: Text("Go Back"),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // Instacart branding
                    Container(
                      padding: EdgeInsets.all(16),
                      color: Color(0xFFF36D00), // Instacart orange color
                      child: Row(
                        children: [
                          Icon(
                            Icons.shopping_cart,
                            color: Colors.white,
                          ),
                          SizedBox(width: 8),
                          Text(
                            "Instacart Cart",
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          Spacer(),
                          Text(
                            "${_cartItems.length} items",
                            style: TextStyle(
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Cart items
                    Expanded(
                      child: ListView.builder(
                        itemCount: _cartItems.length,
                        itemBuilder: (context, index) {
                          final item = _cartItems[index];
                          final price = item['price'];
                          final formattedPrice = price != null
                              ? "\$${price is double ? price.toStringAsFixed(2) : price}"
                              : "Price unavailable";
                          final quantity = item['quantity'] ?? 1;
                          
                          return ListTile(
                            contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: item['image_url'] != null
                                  ? Image.network(
                                      item['image_url'],
                                      fit: BoxFit.contain,
                                      errorBuilder: (context, error, stackTrace) => Icon(
                                        Icons.image_not_supported,
                                        color: Colors.grey,
                                      ),
                                    )
                                  : Icon(
                                      Icons.shopping_basket,
                                      color: Colors.grey,
                                    ),
                            ),
                            title: Text(
                              item['name'] ?? "Unknown Product",
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text("$formattedPrice × $quantity"),
                                if (item['size'] != null) 
                                  Text(
                                    item['size'],
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                              ],
                            ),
                            trailing: Text(
                              price != null
                                  ? "\$${(price * quantity).toStringAsFixed(2)}"
                                  : "",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: _isLoading || _error != null
          ? null
          : BottomAppBar(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Total",
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[600],
                          ),
                        ),
                        Text(
                          "\$${_totalPrice.toStringAsFixed(2)}",
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    Spacer(),
                    ElevatedButton(
                      onPressed: _checkingOut ? null : _proceedToCheckout,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Color(0xFF43B02A), // Instacart green
                        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      child: _checkingOut
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text("Checkout"),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}