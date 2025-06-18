import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';
import '../services/instacart_service.dart';
import '../main.dart';

class InstacartSearchResultsScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final String retailerId;
  final String retailerName;
  final List<String> ingredients;

  // Constructor to explicitly force string conversion
  InstacartSearchResultsScreen({
    Key? key,
    required this.userId,
    required this.authToken,
    required dynamic retailerId,
    required dynamic retailerName,
    required this.ingredients,
  }) :
    // Force string conversion during initialization
    this.retailerId = '$retailerId',
    this.retailerName = '$retailerName',
    super(key: key);

  @override
  _InstacartSearchResultsScreenState createState() => _InstacartSearchResultsScreenState();
}

class _InstacartSearchResultsScreenState extends State<InstacartSearchResultsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _searchResults = [];
  Map<String, List<Map<String, dynamic>>> _groupedResults = {};
  String? _error;
  List<Map<String, dynamic>> _selectedItems = [];
  bool _addingToCart = false;

  @override
  void initState() {
    super.initState();
    _searchProducts();
  }

  Future<void> _searchProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Debug retailer ID type
      print("In InstacartSearchResultsScreen._searchProducts");
      print("RetailerId: ${widget.retailerId} (${widget.retailerId.runtimeType})");
      print("RetailerName: ${widget.retailerName} (${widget.retailerName.runtimeType})");
      print("Ingredients count: ${widget.ingredients.length}");

      final results = await InstacartService.searchProducts(
        widget.authToken,
        widget.retailerId,
        widget.ingredients,
      );

      // Group results by ingredient
      final grouped = <String, List<Map<String, dynamic>>>{};
      for (var result in results) {
        final ingredient = result['ingredient'] ?? "Other";
        if (!grouped.containsKey(ingredient)) {
          grouped[ingredient] = [];
        }
        grouped[ingredient]!.add(result);
      }

      setState(() {
        _isLoading = false;
        _searchResults = results;
        _groupedResults = grouped;
        if (results.isEmpty) {
          _error = "No products found for your ingredients";
        }
      });
    } catch (e) {
      print("Error in _searchProducts: $e");
      setState(() {
        _isLoading = false;
        _error = "Error searching products: $e";
      });
    }
  }

  void _toggleItemSelection(Map<String, dynamic> item) {
    setState(() {
      final index = _selectedItems.indexWhere((i) => i['id'] == item['id']);
      if (index >= 0) {
        _selectedItems.removeAt(index);
      } else {
        _selectedItems.add({...item, 'quantity': 1});
      }
    });
  }

  bool _isItemSelected(Map<String, dynamic> item) {
    return _selectedItems.any((i) => i['id'] == item['id']);
  }

  Future<void> _addToCart() async {
    if (_selectedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Please select at least one item")),
      );
      return;
    }

    setState(() {
      _addingToCart = true;
    });

    try {
      print("Adding to cart with retailerId: ${widget.retailerId} (${widget.retailerId.runtimeType})");
      print("Selected items count: ${_selectedItems.length}");

      // Make sure retailerId is a string
      dynamic retailerIdRaw = widget.retailerId;
      print("RetailerId raw value: $retailerIdRaw (${retailerIdRaw.runtimeType})");

      // Force conversion to string no matter what
      String retailerIdStr = '$retailerIdRaw';

      final result = await InstacartService.addToCart(
        widget.authToken,
        retailerIdStr,
        _selectedItems,
      );

      setState(() {
        _addingToCart = false;
      });

      if (result['success'] == true) {
        // Add items to cart state for tracking
        final cartState = Provider.of<CartState>(context, listen: false);
        List<Map<String, dynamic>> cartItems = _selectedItems.map((item) {
          // Convert each item to a proper format for the cart
          return {
            'name': item['name'] ?? 'Unknown item',
            'price': item['price'],
            'ingredient': item['ingredient'] ?? 'Unknown',
            'quantity': item['quantity'] ?? 1,
            'store': 'Instacart'
          };
        }).toList();

        // Add all items to Instacart cart
        cartState.addItemsToCart('Instacart', cartItems);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("${_selectedItems.length} items added to Instacart cart"),
            action: SnackBarAction(
              label: "View Cart",
              onPressed: () {
                // Navigate to cart page
                Navigator.pushNamed(context, '/instacart-cart', arguments: {
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                  'retailerId': retailerIdStr,
                  'retailerName': widget.retailerName,
                });
              },
            ),
          ),
        );

        // Clear selection
        setState(() {
          _selectedItems = [];
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['error'] ?? "Failed to add items to cart")),
        );
      }
    } catch (e) {
      print("Error in _addToCart: $e");
      setState(() {
        _addingToCart = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error adding items to cart: $e")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.retailerName} Products"),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : Column(
                  children: [
                    // Header with search info
                    Container(
                      padding: EdgeInsets.all(16),
                      color: Colors.grey[200],
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Search Results",
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            "Found ${_searchResults.length} products for ${widget.ingredients.length} ingredients",
                            style: TextStyle(
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    // Grouped results
                    Expanded(
                      child: _groupedResults.isEmpty
                          ? Center(child: Text("No results found"))
                          : ListView.builder(
                              itemCount: _groupedResults.length,
                              itemBuilder: (context, index) {
                                final ingredient = _groupedResults.keys.elementAt(index);
                                final items = _groupedResults[ingredient]!;
                                
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Ingredient header
                                    Padding(
                                      padding: const EdgeInsets.all(16.0),
                                      child: Text(
                                        ingredient,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    
                                    // Items for this ingredient
                                    ...items.map((item) => _buildProductItem(item)),
                                    
                                    // Divider between ingredient groups
                                    Divider(height: 1, thickness: 1),
                                  ],
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
                    Text(
                      "${_selectedItems.length} items selected",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Spacer(),
                    ElevatedButton(
                      onPressed: _addingToCart ? null : _addToCart,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Color(0xFF43B02A), // Instacart green
                        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      child: _addingToCart
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text("Add to Cart"),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildProductItem(Map<String, dynamic> item) {
    final isSelected = _isItemSelected(item);
    final price = item['price'];
    final formattedPrice = price != null
        ? "\$${price is double ? price.toStringAsFixed(2) : price}"
        : "Price unavailable";
    
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
          Text(formattedPrice),
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
      trailing: IconButton(
        icon: Icon(
          isSelected ? Icons.check_circle : Icons.add_circle_outline,
          color: isSelected ? Color(0xFF43B02A) : Colors.grey,
        ),
        onPressed: () => _toggleItemSelection(item),
      ),
      onTap: () => _toggleItemSelection(item),
      selected: isSelected,
      selectedTileColor: Colors.green[50],
    );
  }
}