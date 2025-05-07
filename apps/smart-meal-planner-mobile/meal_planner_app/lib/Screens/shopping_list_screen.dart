import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/menu_model.dart';
import '../main.dart'; // Import to access CartState provider

class ShoppingListScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final int menuId;
  final String menuTitle;

  ShoppingListScreen({
    required this.userId,
    required this.authToken,
    required this.menuId,
    required this.menuTitle,
  });

  @override
  _ShoppingListScreenState createState() => _ShoppingListScreenState();
}

class _ShoppingListScreenState extends State<ShoppingListScreen> {
  bool _isLoading = true;
  Map<String, List<Map<String, dynamic>>> _categorizedItems = {};
  String _selectedStore = 'Walmart'; // Default store
  String _error = '';
  List<Menu> _availableMenus = [];
  int _selectedMenuId = 0;
  String _selectedMenuTitle = '';

  @override
  void initState() {
    super.initState();
    _selectedMenuId = widget.menuId;
    _selectedMenuTitle = widget.menuTitle;
    _fetchAvailableMenus();
    _fetchShoppingList();
  }
  
  // Fetch available menus for selection
  Future<void> _fetchAvailableMenus() async {
    try {
      // Get saved menus from API
      final result = await ApiService.getSavedMenus(widget.userId, widget.authToken);
      
      if (result != null) {
        List<Menu> parsedMenus = [];
        
        // Extract menu data - similar to the logic in menu_screen.dart
        List<dynamic> menuDataItems = [];
        
        if (result.containsKey('menus') && result['menus'] is List) {
          menuDataItems = result['menus'] as List<dynamic>;
        } else if (result.containsKey('data') && result['data'] is List) {
          menuDataItems = result['data'] as List<dynamic>;
        } else if (result is List) {
          menuDataItems = result as List<dynamic>;
        } else if (result.containsKey('menu') && result['menu'] is Map) {
          menuDataItems = [result['menu']];
        }
        
        // Parse each menu
        for (var menuItem in menuDataItems) {
          try {
            if (menuItem is Map<String, dynamic>) {
              final menu = Menu.fromJson(menuItem);
              if (menu.days.isNotEmpty) {
                // Only add menus with days
                parsedMenus.add(menu);
              }
            }
          } catch (e) {
            print("Error parsing menu: $e");
          }
        }
        
        // Sort menus by created date (newest first)
        parsedMenus.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        
        setState(() {
          _availableMenus = parsedMenus;
        });
        
        print("Loaded ${_availableMenus.length} menus for selection");
      }
    } catch (e) {
      print("Error fetching available menus: $e");
    }
  }

  Future<void> _fetchShoppingList() async {
    if (_selectedMenuId <= 0) {
      // No menu selected, handle gracefully
      setState(() {
        _isLoading = false;
        _error = 'Please select a menu to view its shopping list';
      });
      return;
    }
    
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final result = await ApiService.getShoppingList(
        widget.userId,
        widget.authToken,
        _selectedMenuId,
      );

      if (result != null) {
        print("Shopping list API returned result with keys: ${result.keys.toList()}");
        
        if (result.containsKey('ingredient_list')) {
          print("Ingredient list contains ${(result['ingredient_list'] as List).length} items");
        } else if (result.containsKey('ingredients')) {
          print("Ingredients list contains ${(result['ingredients'] as List).length} items");
        } else {
          print("WARNING: Shopping list result doesn't contain expected keys. Available keys: ${result.keys.toList()}");
        }
        
        // Process and categorize items
        await _processShoppingListItems(result);
      } else {
        print("ERROR: Shopping list API returned null result");
        setState(() {
          _error = 'Failed to fetch shopping list data.';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _processShoppingListItems(Map<String, dynamic> data) async {
    // Initialize empty categories map
    Map<String, List<Map<String, dynamic>>> categorizedItems = {};
    
    // Check for 'ingredient_list' or 'ingredients' key
    List<dynamic> ingredients = [];
    if (data.containsKey('ingredient_list')) {
      ingredients = data['ingredient_list'] as List<dynamic>;
    } else if (data.containsKey('ingredients')) {
      ingredients = data['ingredients'] as List<dynamic>;
    }
    
    // Log for debugging
    print("Processing ${ingredients.length} ingredients");
    
    // If no ingredients found and this is a menu with ID, try to extract from the menu object
    if (ingredients.isEmpty && widget.menuId > 0) {
      try {
        // Try to use the menu's getAllIngredients method from the menu_model.dart
        // This requires fetching the menu first
        final menuResult = await ApiService.getLatestMenu(widget.userId, widget.authToken);
        if (menuResult != null) {
          // Import the Menu class if it's available
          try {
            final menu = Menu.fromJson(menuResult);
            ingredients = menu.getAllIngredients();
            print("Extracted ${ingredients.length} ingredients from menu model");
          } catch (e) {
            print("Error parsing menu model: $e");
          }
        }
      } catch (e) {
        print("Error fetching menu for ingredients: $e");
      }
    }

    // Define common categories
    final categories = {
      'Produce': ['fruit', 'vegetable', 'fresh', 'produce'],
      'Meat & Seafood': ['meat', 'seafood', 'beef', 'chicken', 'fish', 'pork', 'turkey'],
      'Dairy & Eggs': ['dairy', 'milk', 'cheese', 'yogurt', 'egg', 'butter', 'cream'],
      'Bakery': ['bread', 'bakery', 'pastry', 'dough'],
      'Pantry': ['pasta', 'rice', 'grain', 'cereal', 'flour', 'sugar', 'oil', 'spice'],
      'Canned Goods': ['canned', 'can', 'soup', 'bean'],
      'Frozen': ['frozen', 'ice cream'],
      'Other': [], // Default category
    };

    // Create a normalized map to combine similar ingredients
    Map<String, Map<String, dynamic>> normalizedItems = {};
    
    // Helper function to normalize ingredient names
    String normalizeIngredient(String name) {
      // Convert to lowercase for consistent comparison
      String normalized = name.toLowerCase().trim();
      
      // Remove common units and quantities embedded in the name
      final unitPattern = RegExp(r'\b(oz|ounce|cup|tablespoon|tbsp|teaspoon|tsp|pound|lb|gram|g)\b');
      final quantityPattern = RegExp(r'\b\d+(\.\d+)?\s*');
      
      normalized = normalized.replaceAll(unitPattern, '').trim();
      normalized = normalized.replaceAll(quantityPattern, '').trim();
      
      // Singularize common plural forms
      if (normalized.endsWith('s')) {
        // Check for special cases
        if (!normalized.endsWith('ss')) { // Don't singularize words like "glass"
          normalized = normalized.substring(0, normalized.length - 1);
        }
      }
      
      // Clean up any extra spaces
      normalized = normalized.replaceAll(RegExp(r'\s+'), ' ').trim();
      
      return normalized;
    }

    // Process each ingredient
    for (var item in ingredients) {
      String ingredient = '';
      double? quantity;
      String? unit;
      String notes = '';
      
      // Handle different formats of ingredient data
      if (item is String) {
        ingredient = item;
        
        // Try to extract quantity and unit from string format
        // Improved regex to better extract quantity, unit, and ingredient name
        final regex = RegExp(r'^(\d+(?:\.\d+)?)\s*([a-zA-Z]{1,4})?\s+(.+)$|^(.+)$');
        final match = regex.firstMatch(ingredient);
        
        if (match != null) {
          quantity = double.tryParse(match.group(1) ?? '');
          unit = match.group(2);
          ingredient = match.group(3) ?? ingredient;
        }
      } else if (item is Map<String, dynamic>) {
        ingredient = item['name'] ?? item['ingredient'] ?? '';
        quantity = item['quantity'] != null ? 
                    (item['quantity'] is int ? 
                     (item['quantity'] as int).toDouble() : 
                     (item['quantity'] is String ? 
                      double.tryParse(item['quantity']) ?? 0.0 : 
                      item['quantity'] as double)) : null;
        unit = item['unit']?.toString();
        notes = item['notes']?.toString() ?? '';
      }
      
      if (ingredient.isEmpty) continue;
      
      // Normalize the ingredient name for combining similar items
      String normalizedName = normalizeIngredient(ingredient);
      
      // Skip any empty normalized names that might occur
      if (normalizedName.isEmpty) {
        normalizedName = ingredient.toLowerCase().trim();
      }
      
      // Create a unique key combining the normalized name and unit (if present)
      String key = unit != null ? '$normalizedName-$unit' : normalizedName;
      
      // Add or update in the normalized map
      if (normalizedItems.containsKey(key)) {
        // Combine quantities if both have quantities
        if (quantity != null && normalizedItems[key]!['quantity'] != null) {
          normalizedItems[key]!['quantity'] = (normalizedItems[key]!['quantity'] as double) + quantity;
        }
        
        // Append unique notes
        if (notes.isNotEmpty && !normalizedItems[key]!['notes'].toString().contains(notes)) {
          String existingNotes = normalizedItems[key]!['notes'] as String;
          normalizedItems[key]!['notes'] = existingNotes.isEmpty ? notes : '$existingNotes, $notes';
        }
        
        // Keep original name if it's more specific or longer
        if (ingredient.length > (normalizedItems[key]!['name'] as String).length) {
          normalizedItems[key]!['name'] = ingredient;
        }
      } else {
        // Create a new entry
        normalizedItems[key] = {
          'name': ingredient,
          'quantity': quantity,
          'unit': unit,
          'notes': notes,
          'checked': false,
          'normalized_name': normalizedName, // Store for category matching
        };
      }
    }
    
    // Now categorize the normalized items
    for (var entry in normalizedItems.entries) {
      var item = entry.value;
      String ingredient = item['normalized_name'] as String;
      
      // Determine category
      String category = 'Other';
      for (var catEntry in categories.entries) {
        bool matchFound = false;
        for (var keyword in catEntry.value) {
          if (ingredient.contains(keyword)) {
            category = catEntry.key;
            matchFound = true;
            break;
          }
        }
        if (matchFound) break;
      }
      
      // Add to categorized map
      if (!categorizedItems.containsKey(category)) {
        categorizedItems[category] = [];
      }
      
      // Remove the normalized_name field before adding to the final list
      item.remove('normalized_name');
      categorizedItems[category]!.add(Map<String, dynamic>.from(item));
    }
    
    // Sort items within each category alphabetically
    for (var category in categorizedItems.keys) {
      categorizedItems[category]!.sort((a, b) => 
        a['name'].toString().toLowerCase().compareTo(b['name'].toString().toLowerCase()));
    }
    
    // Sort categories alphabetically
    Map<String, List<Map<String, dynamic>>> sortedCategories = {};
    List<String> sortedKeys = categorizedItems.keys.toList()..sort();
    
    // Move "Other" to the end if it exists
    if (sortedKeys.contains('Other')) {
      sortedKeys.remove('Other');
      sortedKeys.add('Other');
    }
    
    for (var key in sortedKeys) {
      sortedCategories[key] = categorizedItems[key]!;
    }
    
    setState(() {
      _categorizedItems = sortedCategories;
    });
  }

  // Handle menu selection change
  void _onMenuSelected(int menuId, String menuTitle) {
    setState(() {
      _selectedMenuId = menuId;
      _selectedMenuTitle = menuTitle;
      _categorizedItems = {}; // Clear current list
    });
    
    // Show loading message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Loading shopping list for "$menuTitle"...'),
        duration: Duration(seconds: 1),
      )
    );
    
    // Fetch shopping list for selected menu
    _fetchShoppingList();
  }
  
  Future<void> _addAllToCart() async {
    if (_categorizedItems.isEmpty) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      // Get the cart state provider
      final cartState = Provider.of<CartState>(context, listen: false);
      
      // Create cart items with real data
      List<Map<String, dynamic>> cartItems = [];
      
      for (var category in _categorizedItems.values) {
        for (var item in category) {
          // Format each ingredient with quantity and unit
          String displayText = item['name'];
          if (item['quantity'] != null) {
            displayText = "${item['quantity']} ${item['unit'] ?? ''} $displayText".trim();
          }
          if (item['notes'] != null && item['notes'].isNotEmpty) {
            displayText += " (${item['notes']})";
          }
          
          // Create a cart item with real ingredient data
          final cartItem = {
            'ingredient': displayText,
            'name': item['name'],
            'unit': item['unit'],
            'quantity': item['quantity'],
            'notes': item['notes'],
            'store': _selectedStore
          };
          
          cartItems.add(cartItem);
          
          // Mark as checked
          item['checked'] = true;
        }
      }
      
      print("Adding ${cartItems.length} items to $_selectedStore cart");
      
      // Add all items to the cart state
      cartState.addItemsToCart(_selectedStore, cartItems);
      cartState.printCartState();
      
      // Navigate to carts screen without passing cart data 
      // (it's already in the cart state provider)
      Navigator.pushNamed(
        context, 
        '/carts',
        arguments: {
          'userId': widget.userId,
          'authToken': widget.authToken,
          'selectedStore': _selectedStore,
        }
      );
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Added ${cartItems.length} items to $_selectedStore cart"),
          duration: Duration(seconds: 2),
        )
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"))
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Shopping List: $_selectedMenuTitle"),
        leading: IconButton(
          icon: Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          // Menu selector
          if (_availableMenus.length > 1)
            IconButton(
              icon: Icon(Icons.menu_book),
              tooltip: "Change Menu",
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                  ),
                  builder: (context) {
                    return Container(
                      constraints: BoxConstraints(
                        maxHeight: MediaQuery.of(context).size.height * 0.7,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 40,
                            height: 4,
                            margin: EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: Colors.grey[300],
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                            child: Row(
                              children: [
                                Icon(Icons.menu_book, color: Theme.of(context).primaryColor),
                                SizedBox(width: 12),
                                Text(
                                  'Select Menu',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Spacer(),
                                Text(
                                  '${_availableMenus.length} menus',
                                  style: TextStyle(color: Colors.grey[600]),
                                ),
                              ],
                            ),
                          ),
                          Divider(),
                          Expanded(
                            child: ListView.builder(
                              itemCount: _availableMenus.length,
                              shrinkWrap: true,
                              itemBuilder: (context, index) {
                                final menu = _availableMenus[index];
                                final isSelected = menu.id == _selectedMenuId;
                                final dateStr = _formatDate(menu.createdAt);
                                
                                return ListTile(
                                  title: Text(
                                    menu.title,
                                    style: TextStyle(
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                  subtitle: Text('Created: $dateStr'),
                                  leading: CircleAvatar(
                                    backgroundColor: isSelected ?
                                      Theme.of(context).primaryColor : 
                                      Theme.of(context).primaryColor.withOpacity(0.1),
                                    child: Icon(
                                      Icons.restaurant_menu,
                                      color: isSelected ? Colors.white : Theme.of(context).primaryColor,
                                    ),
                                  ),
                                  trailing: isSelected ? 
                                    Icon(Icons.check_circle, color: Theme.of(context).primaryColor) :
                                    Icon(Icons.arrow_forward_ios, size: 16),
                                  selected: isSelected,
                                  onTap: () {
                                    Navigator.pop(context);
                                    if (menu.id != _selectedMenuId) {
                                      _onMenuSelected(menu.id, menu.title);
                                    }
                                  },
                                );
                              },
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
            
          // Store selector button with dropdown
          PopupMenuButton<String>(
            icon: Row(
              children: [
                Icon(Icons.store, color: Colors.white),
                SizedBox(width: 4),
                Text(_selectedStore, style: TextStyle(color: Colors.white)),
                Icon(Icons.arrow_drop_down, color: Colors.white),
              ],
            ),
            onSelected: (String value) {
              setState(() {
                _selectedStore = value;
              });
              
              // Show confirmation
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Store changed to $value'),
                  duration: Duration(seconds: 1),
                )
              );
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'Walmart',
                child: Row(
                  children: [
                    Icon(Icons.store, color: _selectedStore == 'Walmart' ? 
                         Theme.of(context).primaryColor : Colors.grey),
                    SizedBox(width: 8),
                    Text('Walmart'),
                    if (_selectedStore == 'Walmart')
                      Padding(
                        padding: const EdgeInsets.only(left: 8.0),
                        child: Icon(Icons.check, color: Theme.of(context).primaryColor),
                      ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'Kroger',
                child: Row(
                  children: [
                    Icon(Icons.store, color: _selectedStore == 'Kroger' ? 
                         Theme.of(context).primaryColor : Colors.grey),
                    SizedBox(width: 8),
                    Text('Kroger'),
                    if (_selectedStore == 'Kroger')
                      Padding(
                        padding: const EdgeInsets.only(left: 8.0),
                        child: Icon(Icons.check, color: Theme.of(context).primaryColor),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
              ? Center(child: Text(_error, style: TextStyle(color: Colors.red)))
              : _categorizedItems.isEmpty
                  ? Center(child: Text("No items in shopping list"))
                  : SingleChildScrollView(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Store selection hint
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16.0),
                              child: Text(
                                "Selected Store: $_selectedStore",
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            
                            // Categories and items
                            ..._categorizedItems.entries.map((entry) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Category header
                                  Container(
                                    width: double.infinity,
                                    color: Theme.of(context).primaryColor.withOpacity(0.1),
                                    padding: EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
                                    child: Text(
                                      entry.key,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 18,
                                      ),
                                    ),
                                  ),
                                  
                                  // Items in this category
                                  ...entry.value.map((item) {
                                    String displayText = item['name'];
                                    if (item['quantity'] != null) {
                                      displayText = "${item['quantity']} ${item['unit'] ?? ''} $displayText".trim();
                                    }
                                    if (item['notes'] != null && item['notes'].isNotEmpty) {
                                      displayText += " (${item['notes']})";
                                    }
                                    
                                    return Card(
                                      margin: EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                                      elevation: 1,
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                                        child: CheckboxListTile(
                                          title: Text(
                                            displayText,
                                            style: TextStyle(
                                              decoration: item['checked'] ? TextDecoration.lineThrough : null,
                                            ),
                                          ),
                                          value: item['checked'],
                                          onChanged: (bool? value) {
                                            setState(() {
                                              item['checked'] = value ?? false;
                                            });
                                          },
                                          secondary: ElevatedButton.icon(
                                            icon: Icon(Icons.add_shopping_cart, size: 18),
                                            label: Text("Add"),
                                            style: ElevatedButton.styleFrom(
                                              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            ),
                                            onPressed: () async {
                                              showDialog(
                                                context: context,
                                                builder: (context) => AlertDialog(
                                                  title: Text("Add to Cart"),
                                                  content: Text(
                                                    "Add \"$displayText\" to your ${_selectedStore} cart?"
                                                  ),
                                                  actions: [
                                                    TextButton(
                                                      child: Text("Cancel"),
                                                      onPressed: () => Navigator.of(context).pop(),
                                                    ),
                                                    ElevatedButton(
                                                      child: Text("Add to Cart"),
                                                      onPressed: () async {
                                                        Navigator.of(context).pop();
                                                        setState(() {
                                                          _isLoading = true;
                                                        });
                                                        
                                                        try {
                                                          // Use the displayed text with quantities and units
                                                          print("Adding item to cart: $displayText");
                                                          
                                                          // Directly pass the real ingredient data
                                                          final cartItem = {
                                                            'ingredient': displayText,
                                                            'name': item['name'],
                                                            'unit': item['unit'],
                                                            'quantity': item['quantity'],
                                                            'notes': item['notes'],
                                                            'store': _selectedStore
                                                          };
                                                          
                                                          // Mark as checked
                                                          setState(() {
                                                            item['checked'] = true;
                                                          });
                                                          
                                                          // Add to the cart using the global state provider
                                                          final cartState = Provider.of<CartState>(context, listen: false);
                                                          cartState.addItemToCart(_selectedStore, cartItem);
                                                          cartState.printCartState();
                                                          
                                                          // Show success message
                                                          ScaffoldMessenger.of(context).showSnackBar(
                                                            SnackBar(
                                                              content: Text("Added ${item['name']} to $_selectedStore cart"),
                                                              action: SnackBarAction(
                                                                label: 'VIEW CART',
                                                                onPressed: () {
                                                                  // Navigate to the cart screen without passing item data
                                                                  // (the data is now stored in the CartState provider)
                                                                  Navigator.pushNamed(
                                                                    context, 
                                                                    '/carts',
                                                                    arguments: {
                                                                      'userId': widget.userId,
                                                                      'authToken': widget.authToken,
                                                                      'selectedStore': _selectedStore,
                                                                    }
                                                                  );
                                                                },
                                                              ),
                                                            )
                                                          );
                                                        } catch (e) {
                                                          ScaffoldMessenger.of(context).showSnackBar(
                                                            SnackBar(content: Text("Error: $e"))
                                                          );
                                                        } finally {
                                                          setState(() {
                                                            _isLoading = false;
                                                          });
                                                        }
                                                      },
                                                    ),
                                                  ],
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                  
                                  SizedBox(height: 16),
                                ],
                              );
                            }).toList(),
                          ],
                        ),
                      ),
                    ),
      persistentFooterButtons: _categorizedItems.isNotEmpty 
          ? [
              Container(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: Text("Add All to Cart"),
                        content: Text(
                          "Add all items to your $_selectedStore shopping cart?"
                        ),
                        actions: [
                          TextButton(
                            child: Text("Cancel"),
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                          ElevatedButton.icon(
                            icon: Icon(Icons.shopping_cart),
                            label: Text("Add All & View Cart"),
                            onPressed: () {
                              Navigator.of(context).pop();
                              _addAllToCart();
                            },
                          ),
                        ],
                      ),
                    );
                  },
                  icon: Icon(Icons.shopping_cart),
                  label: Text("ADD ALL ITEMS TO CART"),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ]
          : null,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Navigate directly to the carts screen
          Navigator.pushNamed(
            context, 
            '/carts',
            arguments: {
              'userId': widget.userId,
              'authToken': widget.authToken,
            }
          );
        },
        icon: Icon(Icons.shopping_cart),
        label: Text("View Carts"),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      ),
    );
  }
  
  // Helper method to format date
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
}