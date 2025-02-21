import 'package:flutter/material.dart';
import '../services/api_service.dart';

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

  @override
  void initState() {
    super.initState();
    _fetchCartData();
  }

  Future<void> _fetchCartData() async {
    setState(() => _isLoading = true);

    final result = await ApiService.createCart(
      userId: widget.userId,
      authToken: widget.authToken,
      storeName: widget.storeName,
      ingredients: widget.ingredients,
    );

    setState(() => _isLoading = false);

    if (result != null) {
      setState(() {
        _cartItems = result["items"] ?? [];
        _totalCost = result["total_cost"]?.toDouble() ?? 0.0;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to fetch cart data."))
      );
    }
  }

  Future<void> _placeOrder() async {
    final result = await ApiService.placeOrder(
      userId: widget.userId,
      authToken: widget.authToken,
      storeName: widget.storeName,
      cartItems: _cartItems,
      totalCost: _totalCost,
    );

    if (result != null && result["order_id"] != null) {
      // Order placed
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Order Placed: ${result["order_id"]}"))
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to place order."))
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Shopping Cart (${widget.storeName})"),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: _cartItems.length,
                    itemBuilder: (context, index) {
                      final item = _cartItems[index];
                      final ingredient = item["ingredient"];
                      final price = item["price"] ?? 0.0;
                      final imageUrl = item["image_url"];

                      return ListTile(
                        leading: imageUrl != null
                            ? Image.network(imageUrl, width: 50, height: 50, fit: BoxFit.cover)
                            : Icon(Icons.image_not_supported),
                        title: Text(ingredient),
                        subtitle: Text("\$${price.toStringAsFixed(2)}"),
                      );
                    },
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
    );
  }
}
