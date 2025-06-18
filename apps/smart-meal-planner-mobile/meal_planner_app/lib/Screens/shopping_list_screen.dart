import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../services/instacart_service.dart';
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

class _ShoppingListScreenState extends State<ShoppingListScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  Map<String, List<Map<String, dynamic>>> _categorizedItems = {};
  List<Map<String, dynamic>> _mealShoppingLists = [];
  String _error = '';
  String _selectedStore = 'Kroger'; // Default store
  bool _showStoreSelector = false;
  TabController? _tabController;
  List<Menu> _availableMenus = [];
  int _selectedMenuId = 0;
  String _selectedMenuTitle = '';

  @override
  void initState() {
    super.initState();
    print("ShoppingListScreen.initState - Creating TabController");
    _tabController = TabController(length: 2, vsync: this);
    _selectedMenuId = widget.menuId;
    _selectedMenuTitle = widget.menuTitle;

    print("ShoppingListScreen.initState - Menu ID: $_selectedMenuId");
    print("ShoppingListScreen.initState - Menu Title: $_selectedMenuTitle");
    print("ShoppingListScreen.initState - Auth token length: ${widget.authToken.length}");

    // Print user ID for debugging
    print("ShoppingListScreen.initState - User ID: ${widget.userId}");

    // Default to first tab (Total List)
    _tabController?.index = 0;
    print("ShoppingListScreen.initState - Set tab controller index to 0");

    // Listen to tab changes to update content if needed
    _tabController?.addListener(() {
      print("Tab changed to: ${_tabController?.index}");
      if (_tabController?.indexIsChanging == true) {
        if (_tabController?.index == 0) {
          print("Refreshing total shopping list");
          _fetchShoppingList();
        } else if (_tabController?.index == 1) {
          print("Refreshing meal shopping lists");
          _fetchMealShoppingLists();
        }
      }
    });

    print("ShoppingListScreen.initState - Fetching initial data");
    _fetchAvailableMenus();

    // Add a slight delay before fetching shopping lists to ensure tab controller is fully initialized
    Future.delayed(Duration(milliseconds: 300), () {
      if (mounted) {
        print("ShoppingListScreen - Delayed fetch - Fetching shopping list");
        _fetchShoppingList();
        _fetchMealShoppingLists();
      }
    });
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
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
      }
    } catch (e) {
      print("Error fetching available menus: $e");
    }
  }

  // Fetch standard shopping list
  Future<void> _fetchShoppingList() async {
    print("_fetchShoppingList called - Menu ID: $_selectedMenuId");

    if (_selectedMenuId <= 0) {
      print("Invalid menu ID, showing error");
      setState(() {
        _error = 'Please select a menu to view its shopping list';
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      print("Fetching shopping list for menu ID: $_selectedMenuId");
      print("Auth token available: ${widget.authToken.isNotEmpty}");
      print("Auth token length: ${widget.authToken.length}");

      // Get the shopping list data from API directly (no AI generation)
      final result = await ApiService.getGroceryListByMenuId(
        _selectedMenuId,
        widget.authToken,
      );

      print("Shopping list API response received");
      if (result != null) {
        print("Shopping list API response keys: ${result.keys.toList()}");
      } else {
        print("Shopping list API response is null");
      }

      if (result != null) {
        // Process the shopping list data
        Map<String, List<Map<String, dynamic>>> categorizedItems = {};
        print("Processing shopping list data");

        // Check for different possible response formats
        if (result.containsKey('groceryList')) {
          var groceryList = result['groceryList'];
          print("GroceryList found with type: ${groceryList.runtimeType}");

          if (groceryList is Map) {
            // Format is {category: [items]}
            print("Format is {category: [items]}");
            // Convert dynamically to String keys
            final groceryMap = Map<String, dynamic>.from(groceryList);
            groceryMap.forEach((category, items) {
              print("Processing category: $category with ${items is List ? items.length : 'non-list'} items");
              if (items is List) {
                categorizedItems[category] = [];
                for (var item in items) {
                  if (item is String) {
                    categorizedItems[category]!.add({
                      'name': item,
                      'checked': false,
                    });
                  } else if (item is Map) {
                    categorizedItems[category]!.add({
                      'name': item['name'] ?? 'Unknown item',
                      'quantity': item['quantity'] ?? '',
                      'unit': item['unit'] ?? '',
                      'checked': false,
                    });
                  }
                }
              }
            });
          } else if (groceryList is List) {
            // Format is a flat list in groceryList
            print("Format is a flat list in groceryList with ${groceryList.length} items");
            List<dynamic> groceryItems = groceryList;

            // Use category mapping similar to web app
            Map<String, List<String>> categoryMapping = {
              'meat-seafood': ['beef', 'chicken', 'fish', 'pork', 'lamb', 'turkey', 'steak', 'salmon', 'tuna', 'shrimp', 'bacon'],
              'produce': ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'pepper', 'broccoli', 'fruit', 'vegetable'],
              'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'egg'],
              'bakery': ['bread', 'roll', 'bagel', 'muffin', 'cookie', 'cake', 'pie'],
              'pantry': ['rice', 'pasta', 'flour', 'sugar', 'oil', 'vinegar', 'sauce', 'spice', 'can', 'bean', 'soup'],
              'beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer'],
              'frozen': ['frozen', 'ice cream'],
              'snacks': ['chip', 'cracker', 'pretzel', 'popcorn', 'nut', 'candy'],
            };

            for (var item in groceryItems) {
              print("Processing item of type: ${item.runtimeType}");
              String itemName = '';
              Map<String, dynamic> parsedItem = {};

              if (item is String) {
                itemName = item.toLowerCase();
                parsedItem = {'name': item, 'checked': false};
              } else if (item is Map) {
                itemName = (item['name'] ?? 'Unknown item').toString().toLowerCase();
                parsedItem = {
                  'name': item['name'] ?? 'Unknown item',
                  'quantity': item['quantity'] ?? '',
                  'unit': item['unit'] ?? '',
                  'checked': false,
                };
              } else {
                print("Skipping invalid item type: ${item.runtimeType}");
                continue; // Skip invalid items
              }

              // Find the category using the mapping
              String category = 'Other';
              categoryMapping.forEach((key, keywords) {
                for (var keyword in keywords) {
                  if (itemName.contains(keyword)) {
                    category = key.split('-').map((word) => word[0].toUpperCase() + word.substring(1)).join(' ');
                    break;
                  }
                }
              });

              print("Categorized item '${parsedItem['name']}' as '$category'");
              if (!categorizedItems.containsKey(category)) {
                categorizedItems[category] = [];
              }
              categorizedItems[category]!.add(parsedItem);
            }
          }
        } else if (result.containsKey('ingredient_list') && result['ingredient_list'] is List) {
          // Format is a flat list of ingredients
          print("Format is a flat list of ingredients");
          List<dynamic> ingredients = result['ingredient_list'];
          print("Found ${ingredients.length} ingredients");

          // Categorize ingredients (simplified version)
          for (var item in ingredients) {
            String category = 'Other';
            Map<String, dynamic> parsedItem = {};

            if (item is String) {
              parsedItem = {'name': item, 'checked': false};
            } else if (item is Map) {
              parsedItem = {
                'name': item['name'] ?? 'Unknown item',
                'quantity': item['quantity'] ?? '',
                'unit': item['unit'] ?? '',
                'checked': false,
              };
            } else {
              print("Skipping invalid item type: ${item.runtimeType}");
              continue; // Skip invalid items
            }

            // Simple categorization based on ingredient name
            String name = parsedItem['name'].toString().toLowerCase();
            if (name.contains('chicken') || name.contains('beef') || name.contains('fish')) {
              category = 'Meat & Seafood';
            } else if (name.contains('milk') || name.contains('cheese') || name.contains('yogurt')) {
              category = 'Dairy';
            } else if (name.contains('apple') || name.contains('banana') || name.contains('vegetable')) {
              category = 'Produce';
            } else if (name.contains('bread') || name.contains('pasta') || name.contains('rice')) {
              category = 'Grains';
            } else if (name.contains('oil') || name.contains('sauce') || name.contains('spice')) {
              category = 'Pantry';
            }

            if (!categorizedItems.containsKey(category)) {
              categorizedItems[category] = [];
            }
            categorizedItems[category]!.add(parsedItem);
          }
        }

        // If we didn't find any data using the standard formats, check for other keys
        if (categorizedItems.isEmpty) {
          print("No standard format found, checking other keys");

          // Check for raw 'ingredients' key
          if (result.containsKey('ingredients') && result['ingredients'] is List) {
            print("Found 'ingredients' key with list");
            List<dynamic> ingredients = result['ingredients'];

            // Add all to "Groceries" category
            categorizedItems['Groceries'] = [];
            for (var item in ingredients) {
              if (item is String) {
                categorizedItems['Groceries']!.add({
                  'name': item,
                  'checked': false,
                });
              } else if (item is Map) {
                categorizedItems['Groceries']!.add({
                  'name': item['name'] ?? 'Unknown item',
                  'quantity': item['quantity'] ?? '',
                  'unit': item['unit'] ?? '',
                  'checked': false,
                });
              }
            }
          }

          // Check for 'items' key
          if (categorizedItems.isEmpty && result.containsKey('items') && result['items'] is List) {
            print("Found 'items' key with list");
            List<dynamic> items = result['items'];

            categorizedItems['Items'] = [];
            for (var item in items) {
              if (item is String) {
                categorizedItems['Items']!.add({
                  'name': item,
                  'checked': false,
                });
              } else if (item is Map) {
                categorizedItems['Items']!.add({
                  'name': item['name'] ?? 'Unknown item',
                  'quantity': item['quantity'] ?? '',
                  'unit': item['unit'] ?? '',
                  'checked': false,
                });
              }
            }
          }
        }

        print("Final categorized items count: ${categorizedItems.length} categories");
        categorizedItems.forEach((category, items) {
          print("Category '$category' has ${items.length} items");
        });

        setState(() {
          _categorizedItems = categorizedItems;
          _isLoading = false;
          if (categorizedItems.isEmpty) {
            print("No items found in the response");
            _error = 'No items found in the shopping list.';
          }
        });
      } else {
        print("Shopping list API response is null, showing error");
        setState(() {
          _error = 'Failed to fetch shopping list data.';
          _isLoading = false;
        });
      }
    } catch (e) {
      print("Error in _fetchShoppingList: $e");
      setState(() {
        _error = 'Error: $e';
        _isLoading = false;
      });
    }
  }
  
  // Fetch meal-specific shopping lists
  Future<void> _fetchMealShoppingLists() async {
    print("_fetchMealShoppingLists called - Menu ID: $_selectedMenuId");

    if (_selectedMenuId <= 0) {
      print("Invalid menu ID for meal shopping lists, skipping");
      return; // Already showing error in the regular shopping list
    }

    try {
      print("Fetching meal shopping lists for menu ID: $_selectedMenuId");
      // Get meal-specific shopping list data
      final result = await ApiService.getMealShoppingLists(
        widget.authToken,
        _selectedMenuId,
      );

      print("Meal shopping lists API response received");
      if (result != null) {
        print("Meal shopping lists API response keys: ${result.keys.toList()}");

        if (result.containsKey('meal_lists') && result['meal_lists'] is List) {
          final mealLists = result['meal_lists'] as List;
          print("Found ${mealLists.length} meal lists");

          List<Map<String, dynamic>> typeSafeMealLists = [];
          for (var meal in mealLists) {
            if (meal is Map) {
              typeSafeMealLists.add(Map<String, dynamic>.from(meal));
            }
          }

          print("Processed ${typeSafeMealLists.length} type-safe meal lists");
          setState(() {
            _mealShoppingLists = typeSafeMealLists;
          });
        } else {
          print("No meal_lists key found or not a List");
        }
      } else {
        print("Meal shopping lists API response is null");
      }
    } catch (e) {
      print("Error fetching meal shopping lists: $e");
      // Don't show error since the regular shopping list is the main one
    }
  }

  // Handle menu selection change
  void _onMenuSelected(int menuId, String menuTitle) {
    if (menuId == _selectedMenuId) {
      return; // No change
    }

    setState(() {
      _selectedMenuId = menuId;
      _selectedMenuTitle = menuTitle;
      _categorizedItems = {};
      _mealShoppingLists = [];
    });

    _fetchShoppingList();
    _fetchMealShoppingLists();
  }
  
  // Add all items to cart
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
          String displayText = item['name'] ?? 'Unknown item';
          
          if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
            displayText = "$displayText: ${item['quantity']} ${item['unit'] ?? ''}".trim();
          }
          
          // Create a cart item with real ingredient data
          final cartItem = {
            'ingredient': displayText,
            'name': item['name'],
            'unit': item['unit'],
            'quantity': item['quantity'],
            'notes': item['notes'] ?? '',
            'store': 'Kroger' // Always Kroger
          };
          
          cartItems.add(cartItem);
          
          // Mark as checked
          item['checked'] = true;
        }
      }
      
      // Add all items to the cart state
      cartState.addItemsToCart('Kroger', cartItems);
      
      // Navigate to carts screen
      Navigator.pushNamed(
        context, 
        '/carts',
        arguments: {
          'userId': widget.userId,
          'authToken': widget.authToken,
          'selectedStore': 'Kroger',
        }
      );
      
      // Show success message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Added ${cartItems.length} items to Kroger cart"),
            duration: Duration(seconds: 2),
          )
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error: $e"),
            backgroundColor: Colors.red,
          )
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  // Add a specific meal's items to cart
  Future<void> _addMealToCart(String mealTitle, List<Map<String, dynamic>> ingredients) async {
    if (ingredients.isEmpty) return;
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      // Get the cart state provider
      final cartState = Provider.of<CartState>(context, listen: false);
      
      // Create cart items for this meal
      List<Map<String, dynamic>> cartItems = [];
      
      for (var item in ingredients) {
        // Format each ingredient with quantity and unit
        String displayText = item['name'] ?? 'Unknown item';
        
        if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
          displayText = "$displayText: ${item['quantity']}".trim();
        }
        
        // Create a cart item
        final cartItem = {
          'ingredient': displayText,
          'name': item['name'],
          'quantity': item['quantity'],
          'notes': 'From: $mealTitle',
          'store': 'Kroger'
        };
        
        cartItems.add(cartItem);
      }
      
      // Add items to the cart state
      cartState.addItemsToCart('Kroger', cartItems);
      
      // Show success message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Added ${cartItems.length} items from $mealTitle to Kroger cart"),
            action: SnackBarAction(
              label: 'VIEW CART',
              onPressed: () {
                Navigator.pushNamed(
                  context, 
                  '/carts',
                  arguments: {
                    'userId': widget.userId,
                    'authToken': widget.authToken,
                    'selectedStore': 'Kroger',
                  }
                );
              },
            ),
          )
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error: $e"),
            backgroundColor: Colors.red,
          )
        );
      }
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Build the full shopping list tab
  Widget _buildFullShoppingListTab() {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }
    
    if (_error.isNotEmpty) {
      return Center(child: Text(_error, style: TextStyle(color: Colors.red)));
    }
    
    if (_categorizedItems.isEmpty) {
      return Center(child: Text("No items in shopping list"));
    }
    
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Store selection with dropdown
              Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: Row(
                  children: [
                    Text(
                      "Selected Store: ",
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    Expanded(
                      child: Row(
                        children: [
                          // Kroger button
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _selectedStore = 'Kroger';
                                });
                              },
                              icon: Icon(
                                Icons.shopping_basket,
                                size: 16,
                                color: _selectedStore == 'Kroger' ? Colors.white : Colors.grey,
                              ),
                              label: Text('Kroger'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _selectedStore == 'Kroger'
                                    ? Theme.of(context).primaryColor
                                    : Colors.grey[200],
                                foregroundColor: _selectedStore == 'Kroger'
                                    ? Colors.white
                                    : Colors.black87,
                                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: 8),
                          // Instacart button
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _selectedStore = 'Instacart';
                                });
                                _showInstacartDialog();
                              },
                              icon: Image.asset(
                                'assets/instacart/Instacart_Carrot.png',
                                height: 16,
                                width: 16,
                                color: _selectedStore == 'Instacart' ? Colors.white : null,
                              ),
                              label: Text('Instacart'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _selectedStore == 'Instacart'
                                    ? Colors.green
                                    : Colors.grey[200],
                                foregroundColor: _selectedStore == 'Instacart'
                                    ? Colors.white
                                    : Colors.black87,
                                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                      String displayText = item['name'] ?? 'Unknown item';
                      
                      if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
                        displayText = "$displayText: ${item['quantity']} ${item['unit'] ?? ''}".trim();
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
                            value: item['checked'] ?? false,
                            onChanged: (bool? value) {
                              setState(() {
                                item['checked'] = value ?? false;
                              });
                            },
                            secondary: IconButton(
                              icon: Icon(Icons.add_shopping_cart, size: 22),
                              onPressed: () {
                                // Add single item to cart
                                final cartState = Provider.of<CartState>(context, listen: false);
                                final cartItem = {
                                  'ingredient': displayText,
                                  'name': item['name'],
                                  'unit': item['unit'],
                                  'quantity': item['quantity'],
                                  'store': 'Kroger'
                                };
                                cartState.addItemToCart('Kroger', cartItem);
                                
                                // Mark as checked
                                setState(() {
                                  item['checked'] = true;
                                });
                                
                                // Show success message
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text("Added ${item['name']} to Kroger cart"),
                                      duration: Duration(seconds: 2),
                                    )
                                  );
                                }
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
      ],
    );
  }
  
  // Build the by-meal shopping list tab
  Widget _buildByMealShoppingListTab() {
    if (_isLoading) {
      return Center(child: CircularProgressIndicator());
    }
    
    if (_mealShoppingLists.isEmpty) {
      return Center(child: Text("No meal-specific shopping lists available"));
    }
    
    // Group by day
    Map<int, List<Map<String, dynamic>>> mealsByDay = {};
    
    for (var meal in _mealShoppingLists) {
      int day = meal['day'] ?? 1;
      if (!mealsByDay.containsKey(day)) {
        mealsByDay[day] = [];
      }
      mealsByDay[day]!.add(meal);
    }
    
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Days and meals
              ...mealsByDay.entries.map((entry) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Day header
                    Container(
                      width: double.infinity,
                      color: Theme.of(context).primaryColor.withOpacity(0.2),
                      padding: EdgeInsets.symmetric(vertical: 12.0, horizontal: 16.0),
                      child: Text(
                        "Day ${entry.key}",
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                    
                    // Meals for this day
                    ...entry.value.map((meal) {
                      final mealTitle = meal['title'] ?? 'Unnamed Meal';
                      final mealTime = meal['meal_time'] ?? '';
                      final isSnack = meal['is_snack'] ?? false;
                      final ingredients = List<Map<String, dynamic>>.from(meal['ingredients'] ?? []);
                      
                      return Card(
                        margin: EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                        elevation: 2,
                        child: ExpansionTile(
                          title: Text(
                            mealTitle,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: Text(
                            isSnack ? "Snack" : mealTime,
                            style: TextStyle(
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                          leading: Icon(
                            isSnack ? Icons.cake : Icons.restaurant,
                            color: Theme.of(context).primaryColor,
                          ),
                          children: [
                            // Ingredients list
                            Column(
                              children: [
                                ...ingredients.map((ingredient) {
                                  final name = ingredient['name'] ?? 'Unknown ingredient';
                                  final quantity = ingredient['quantity'] ?? '';
                                  
                                  return ListTile(
                                    title: Text(name),
                                    subtitle: quantity.isNotEmpty ? Text(quantity) : null,
                                    dense: true,
                                  );
                                }).toList(),
                                
                                // Add to cart button
                                Padding(
                                  padding: const EdgeInsets.all(8.0),
                                  child: ElevatedButton.icon(
                                    onPressed: () => _addMealToCart(mealTitle, ingredients),
                                    icon: Icon(Icons.add_shopping_cart),
                                    label: Text("Add All to Cart"),
                                    style: ElevatedButton.styleFrom(
                                      padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
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
      ],
    );
  }

  // Show Instacart integration dialog
  Future<void> _showInstacartDialog() async {
    try {
      setState(() {
        _isLoading = true;
      });

      // Get user's zip code from preferences
      final prefs = await SharedPreferences.getInstance();
      String? zipCode = prefs.getString('zipCode') ?? '80538'; // Default to Loveland, CO

      setState(() {
        _isLoading = false;
      });

      final result = await showDialog<Map<String, dynamic>?>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Send to Instacart'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Select an Instacart retailer to create your shopping list'),
              SizedBox(height: 16),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  elevation: 2,
                ),
                onPressed: () {
                  // Navigate to retailer selector
                  Navigator.pop(context);

                  // Define our callback function separately for clarity
                  dynamic onRetailerSelectedCallback = (dynamic retailerId, dynamic retailerName) {
                    // Ensure retailerId and retailerName are strings
                    print("Received retailerId type: ${retailerId.runtimeType}");
                    print("Received retailerName type: ${retailerName.runtimeType}");

                    // Convert to string using safest string interpolation method
                    String retailerIdStr = '$retailerId';
                    String retailerNameStr = '$retailerName';

                    print("Converted to retailerIdStr: $retailerIdStr");
                    print("Converted to retailerNameStr: $retailerNameStr");

                    _createInstacartList(retailerIdStr, retailerNameStr);
                  };

                  Navigator.pushNamed(
                    context,
                    '/instacart-retailers',
                    arguments: {
                      'zipCode': zipCode,
                      'onRetailerSelected': onRetailerSelectedCallback,
                    },
                  );
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.asset(
                      'assets/instacart/Instacart_Carrot.png',
                      height: 24,
                      width: 24,
                    ),
                    SizedBox(width: 8),
                    Text('Select Instacart Retailer'),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Cancel'),
            ),
          ],
        ),
      );
    } catch (e) {
      print("Error showing Instacart dialog: $e");
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Create Instacart shopping list
  Future<void> _createInstacartList(dynamic retailerId, dynamic retailerName) async {
    try {
      setState(() {
        _isLoading = true;
      });

      print("Creating Instacart list with retailerId: $retailerId (${retailerId.runtimeType})");
      print("Retailer name: $retailerName (${retailerName.runtimeType})");

      // Prepare ingredients list
      List<String> ingredients = [];
      _categorizedItems.forEach((category, items) {
        for (var item in items) {
          String ingredient = item['name'];
          if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
            ingredient = "${ingredient}: ${item['quantity']} ${item['unit'] ?? ''}".trim();
          }
          ingredients.add(ingredient);
        }
      });

      if (ingredients.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No ingredients to add to Instacart'))
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      print("Prepared ${ingredients.length} ingredients for Instacart search");

      // Navigate to Instacart search results
      setState(() {
        _isLoading = false;
      });

      // Force conversion to string using string interpolation for absolute safety
      final String safeRetailerId = '$retailerId';
      final String safeRetailerName = '$retailerName';

      print("Safe retailerId for navigation: $safeRetailerId (${safeRetailerId.runtimeType})");
      print("Safe retailerName for navigation: $safeRetailerName (${safeRetailerName.runtimeType})");

      Navigator.pushNamed(
        context,
        '/instacart-search',
        arguments: {
          'retailerId': safeRetailerId,
          'retailerName': safeRetailerName,
          'ingredients': ingredients,
          'userId': widget.userId,
          'authToken': widget.authToken,
        },
      );
    } catch (e) {
      print("Error creating Instacart list: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'))
      );
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Show store selector dialog
  void _showStoreSelectorDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Select Store'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(Icons.shopping_basket),
              title: Text('Kroger'),
              onTap: () {
                setState(() {
                  _selectedStore = 'Kroger';
                  _showStoreSelector = false;
                });
                Navigator.pop(context);
              },
              selected: _selectedStore == 'Kroger',
              selectedTileColor: Theme.of(context).primaryColor.withOpacity(0.1),
            ),
            ListTile(
              leading: Image.asset(
                'assets/instacart/Instacart_Carrot.png',
                height: 24,
                width: 24,
              ),
              title: Text('Instacart'),
              onTap: () {
                setState(() {
                  _selectedStore = 'Instacart';
                  _showStoreSelector = false;
                });
                Navigator.pop(context);
                _showInstacartDialog();
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        // Handle back button press properly
        Navigator.of(context).pop();
        return false; // Prevent default back behavior
      },
      child: Scaffold(
      extendBody: true, // Ensure content doesn't get hidden behind bottom nav
      appBar: AppBar(
        title: Text("Shopping List: $_selectedMenuTitle"),
        leading: IconButton(
          icon: Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          // Store selector button
          IconButton(
            icon: Icon(Icons.store),
            tooltip: "Change Store",
            onPressed: () {
              setState(() {
                _showStoreSelector = true;
              });
              _showStoreSelectorDialog();
            },
          ),
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
        ],
        bottom: TabBar(
          controller: _tabController!,
          tabs: [
            Tab(text: "Total List", icon: Icon(Icons.list)),
            Tab(text: "By Meal", icon: Icon(Icons.restaurant_menu)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController!,
        children: [
          _buildFullShoppingListTab(),
          _buildByMealShoppingListTab(),
        ],
      ),
      persistentFooterButtons: _categorizedItems.isNotEmpty
          ? [
              Container(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (_selectedStore == 'Instacart') {
                      _showInstacartDialog();
                    } else {
                      _addAllToCart();
                    }
                  },
                  icon: _selectedStore == 'Instacart'
                      ? Image.asset(
                          'assets/instacart/Instacart_Carrot.png',
                          height: 24,
                          width: 24,
                          color: Colors.white,
                        )
                      : Icon(Icons.shopping_cart),
                  label: Text("ADD ALL ITEMS TO ${_selectedStore.toUpperCase()} CART"),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Theme.of(context).primaryColor,
                    foregroundColor: Colors.white,
                  ),
                ),
              ),
            ]
          : null,
      floatingActionButton: _buildFloatingActionButton(),
      ),
    );
  }
  
  // Build appropriate floating action button based on store selection
  Widget? _buildFloatingActionButton() {
    if (_selectedStore == 'Instacart') {
      return FloatingActionButton.extended(
        onPressed: _showInstacartDialog,
        icon: Image.asset(
          'assets/instacart/Instacart_Carrot.png',
          height: 24,
          width: 24,
          color: Colors.white,
        ),
        label: Text("Order with Instacart"),
        backgroundColor: Colors.green,
      );
    } else if (_selectedStore == 'Kroger') {
      return FloatingActionButton.extended(
        onPressed: () {
          // Navigate directly to the carts screen
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
        icon: Icon(Icons.shopping_cart),
        label: Text("View Kroger Cart"),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      );
    }
    return null;
  }

  // Helper method to format date
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
}