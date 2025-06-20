import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../services/instacart_service.dart';
import '../models/menu_model.dart';
import '../main.dart'; // Import to access CartState provider
import '../Providers/auth_providers.dart'; // Import AuthProvider

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

      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for shopping list fetch");
      }

      if (validToken == null) {
        setState(() {
          _isLoading = false;
          _error = 'Authentication token is invalid. Please log in again.';
        });
        return;
      }

      // Use the correct endpoint that's used in the web app
      Map<String, dynamic>? result;
      bool success = false;
      List<String> attemptedEndpoints = [];

      // Try the web app's grocery list endpoint first
      print("APPROACH 1: Using the web app's grocery list endpoint");
      final groceryListEndpoint = "/menu/$_selectedMenuId/grocery-list";
      attemptedEndpoints.add(groceryListEndpoint);

      try {
        // This is the same endpoint used in the web app's apiService.js
        print("Fetching from: $groceryListEndpoint");
        result = await ApiService.callApiEndpoint(
          'GET',
          groceryListEndpoint,
          validToken,
          null
        );

        if (result != null && result is Map) {
          print("Got grocery list from web app endpoint");
          if (result.containsKey('groceryList') || result.containsKey('items') || result.containsKey('ingredients')) {
            success = true;
          }
        }
      } catch (e) {
        print("Error fetching from web app endpoint: $e");
      }

      // Try 2: Get menu details - as fallback
      print("APPROACH 2: Get menu details and extract grocery list");
      final menuDetailsEndpoint = "/menu/details/$_selectedMenuId";
      attemptedEndpoints.add(menuDetailsEndpoint);

      try {
        final menuDetails = await ApiService.callApiEndpoint(
          'GET',
          menuDetailsEndpoint,
          validToken,
          null
        );

        if (menuDetails != null && menuDetails is Map) {
          print("Got menu details, menu title: ${menuDetails['title'] ?? 'Unknown'}");
          // Extract groceryList if it exists
          if (menuDetails.containsKey('groceryList')) {
            print("Menu details contains groceryList key");
            result = {"groceryList": menuDetails['groceryList']};
            success = true;
          }
          // Extract ingredients if it exists
          else if (menuDetails.containsKey('ingredients') && menuDetails['ingredients'] is List) {
            print("Menu details contains ingredients key");
            result = {"groceryList": menuDetails['ingredients']};
            success = true;
          }
          // Try meal_plan
          else if ((menuDetails.containsKey('meal_plan') || menuDetails.containsKey('meal_plan_json'))) {
            print("Menu details contains meal_plan, extracting ingredients");
            // Get meal plan data
            var mealPlan = menuDetails.containsKey('meal_plan')
                ? menuDetails['meal_plan']
                : menuDetails['meal_plan_json'];

            // If meal plan is a string, parse it
            if (mealPlan is String) {
              try {
                mealPlan = json.decode(mealPlan);
              } catch (e) {
                print("Error parsing meal plan JSON: $e");
              }
            }

            // Extract ingredients from the meal plan
            List<Map<String, dynamic>> extractedIngredients = [];

            if (mealPlan is Map && mealPlan.containsKey('days') && mealPlan['days'] is List) {
              print("Found days in meal plan, extracting ingredients");
              List<dynamic> days = mealPlan['days'];

              for (var day in days) {
                if (day is Map) {
                  // Extract from meals
                  if (day.containsKey('meals') && day['meals'] is List) {
                    for (var meal in day['meals']) {
                      if (meal is Map && meal.containsKey('ingredients') && meal['ingredients'] is List) {
                        for (var ingredient in meal['ingredients']) {
                          if (ingredient is String) {
                            extractedIngredients.add({'name': ingredient, 'quantity': '', 'unit': ''});
                          } else if (ingredient is Map) {
                            extractedIngredients.add({
                              'name': ingredient['name'] ?? 'Unknown',
                              'quantity': ingredient['quantity'] ?? '',
                              'unit': ingredient['unit'] ?? '',
                            });
                          }
                        }
                      }
                    }
                  }

                  // Extract from snacks
                  if (day.containsKey('snacks') && day['snacks'] is List) {
                    for (var snack in day['snacks']) {
                      if (snack is Map && snack.containsKey('ingredients') && snack['ingredients'] is List) {
                        for (var ingredient in snack['ingredients']) {
                          if (ingredient is String) {
                            extractedIngredients.add({'name': ingredient, 'quantity': '', 'unit': ''});
                          } else if (ingredient is Map) {
                            extractedIngredients.add({
                              'name': ingredient['name'] ?? 'Unknown',
                              'quantity': ingredient['quantity'] ?? '',
                              'unit': ingredient['unit'] ?? '',
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            if (extractedIngredients.isNotEmpty) {
              print("Extracted ${extractedIngredients.length} ingredients from meal plan");
              result = {"groceryList": extractedIngredients};
              success = true;
            }
          }

          // If we couldn't extract grocery list, try using the whole menu details
          if (!success) {
            print("Could not extract grocery list from menu details, using raw data");
            // Convert to Map<String, dynamic> for type safety
            result = Map<String, dynamic>.from(menuDetails);
            success = true;
          }
        }
      } catch (e) {
        print("Error in menu details approach: $e");
      }

      // Try 3: Try direct grocery list endpoint
      if (!success) {
        print("APPROACH 3: Try direct grocery list endpoints");
        List<String> groceryListEndpoints = [
          "/menu/$_selectedMenuId/grocery-list",
          "/grocery-list/menu/$_selectedMenuId",
          "/grocery-list/$_selectedMenuId",
          "/menu/grocery-list/$_selectedMenuId",
        ];

        for (String endpoint in groceryListEndpoints) {
          if (success) break;
          attemptedEndpoints.add(endpoint);

          try {
            print("Trying endpoint: $endpoint");
            final response = await ApiService.callApiEndpoint('GET', endpoint, validToken, null);

            if (response != null) {
              print("Got response from $endpoint");
              if (response is Map) {
                if (response.containsKey('groceryList')) {
                  print("Response contains groceryList key");
                  result = {"groceryList": response['groceryList']};
                  success = true;
                  break;
                } else if (response.containsKey('ingredients')) {
                  print("Response contains ingredients key");
                  result = {"groceryList": response['ingredients']};
                  success = true;
                  break;
                } else {
                  // Use the whole response - Convert to Map<String, dynamic> for type safety
                  result = Map<String, dynamic>.from(response);
                  success = true;
                  break;
                }
              } else if (response is List) {
                print("Response is a list with ${response.length} items");
                result = {"groceryList": response};
                success = true;
                break;
              }
            }
          } catch (e) {
            print("Error with endpoint $endpoint: $e");
          }
        }
      }

      // Try 4: POST to grocery list endpoints
      if (!success) {
        print("APPROACH 4: Try POST to grocery list endpoints");
        List<String> postEndpoints = [
          "/grocery-list",
          "/menu/grocery-list",
        ];

        for (String endpoint in postEndpoints) {
          if (success) break;
          attemptedEndpoints.add("POST $endpoint");

          try {
            print("Trying POST to: $endpoint");
            final response = await ApiService.callApiEndpoint(
              'POST',
              endpoint,
              validToken,
              {"menu_id": _selectedMenuId}
            );

            if (response != null) {
              print("Got response from POST $endpoint");
              if (response is Map) {
                if (response.containsKey('groceryList')) {
                  print("Response contains groceryList key");
                  result = {"groceryList": response['groceryList']};
                  success = true;
                  break;
                } else if (response.containsKey('ingredients')) {
                  print("Response contains ingredients key");
                  result = {"groceryList": response['ingredients']};
                  success = true;
                  break;
                } else {
                  // Use the whole response - Convert to Map<String, dynamic> for type safety
                  result = Map<String, dynamic>.from(response);
                  success = true;
                  break;
                }
              } else if (response is List) {
                print("Response is a list with ${response.length} items");
                result = {"groceryList": response};
                success = true;
                break;
              }
            }
          } catch (e) {
            print("Error with POST to $endpoint: $e");
          }
        }
      }

      // If we couldn't get the grocery list, try to build it from meal shopping lists
      if (!success || result == null) {
        print("Direct grocery list approaches failed, trying to build from meal lists");

        try {
          // Get meal shopping lists which we know works
          final mealListsResult = await ApiService.callApiEndpoint(
            'GET',
            "/menu/$_selectedMenuId/meal-shopping-lists",
            validToken,
            null
          );

          if (mealListsResult != null && mealListsResult is Map &&
              mealListsResult.containsKey('meal_lists') && mealListsResult['meal_lists'] is List) {

            print("Building grocery list from meal shopping lists");
            List<dynamic> mealLists = mealListsResult['meal_lists'];
            List<Map<String, dynamic>> combinedIngredients = [];

            // Extract and combine all ingredients from all meals
            for (var meal in mealLists) {
              if (meal is Map && meal.containsKey('ingredients') && meal['ingredients'] is List) {
                List<dynamic> mealIngredients = meal['ingredients'];

                for (var ingredient in mealIngredients) {
                  if (ingredient is Map) {
                    // Convert to Map<String, dynamic> for type safety
                    Map<String, dynamic> safeIngredient = Map<String, dynamic>.from(ingredient);

                    // Add meal name as source
                    safeIngredient['source'] = meal['title'] ?? 'Unknown Meal';

                    combinedIngredients.add(safeIngredient);
                  }
                }
              }
            }

            if (combinedIngredients.isNotEmpty) {
              print("Built grocery list with ${combinedIngredients.length} items from meal lists");
              result = {"groceryList": combinedIngredients};
              success = true;
            }
          }
        } catch (e) {
          print("Error building grocery list from meal lists: $e");
        }

        // If all approaches failed, return empty response
        if (!success || result == null) {
          print("All approaches failed, attempted: $attemptedEndpoints");
          result = {"groceryList": []};
        }
      }

      print("Shopping list API response received");
      if (result != null) {
        print("Shopping list API response keys: ${result.keys.toList()}");
      } else {
        print("Shopping list API response is null");
      }

      // Check if the result is an error response with token expiration
      if (result != null &&
          result is Map &&
          result.containsKey('detail') &&
          (result['detail'] == 'Token has expired' || result['detail'] == 'Could not validate credentials')) {

        print("🔑 Token expired error detected in shopping list response");

        // Try to refresh the token
        if (await authProvider.refreshTokenIfNeeded()) {
          // Token refreshed, retry the fetch with the new token
          print("🔄 Token refreshed, retrying shopping list fetch");
          setState(() {
            _isLoading = false; // Reset loading state before retrying
          });
          return _fetchShoppingList();
        } else {
          // Token refresh failed, show login error
          setState(() {
            _isLoading = false;
            _error = 'Your session has expired. Please log in again.';
          });
          return;
        }
      }

      if (result != null) {
        // Process the shopping list data
        Map<String, List<Map<String, dynamic>>> categorizedItems = {};
        print("Processing shopping list data");

        // Skip processing if we got an error response
        if (result.containsKey('detail') && result['detail'] == "Method Not Allowed") {
          print("Got error response, skipping processing");
          setState(() {
            _isLoading = false;
            _error = 'Failed to fetch shopping list data - Method Not Allowed';
          });
          return;
        }

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

      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for meal shopping lists fetch");
      }

      if (validToken == null) {
        print("Invalid token for meal shopping lists, skipping");
        return;
      }

      // Try different approaches to get meal shopping lists
      Map<String, dynamic>? result;
      bool success = false;

      // Try 1: Direct API call to meal shopping lists endpoint
      try {
        print("APPROACH 1: Direct meal shopping lists endpoint");
        result = await ApiService.callApiEndpoint(
          'GET',
          "/menu/$_selectedMenuId/meal-shopping-lists",
          validToken,
          null
        );

        if (result != null && result is Map) {
          print("Got meal shopping lists from direct endpoint");
          success = true;
        }
      } catch (e) {
        print("Error with direct meal shopping lists endpoint: $e");
      }

      // Try 2: Alternative endpoint
      if (!success) {
        try {
          print("APPROACH 2: Alternative meal shopping lists endpoint");
          result = await ApiService.callApiEndpoint(
            'GET',
            "/menu/$_selectedMenuId/by-meal-groceries",
            validToken,
            null
          );

          if (result != null && result is Map) {
            print("Got meal shopping lists from alternative endpoint");
            success = true;
          }
        } catch (e) {
          print("Error with alternative meal shopping lists endpoint: $e");
        }
      }

      // Try 3: Extract from menu details
      if (!success) {
        try {
          print("APPROACH 3: Extract from menu details");
          final menuDetails = await ApiService.callApiEndpoint(
            'GET',
            "/menu/details/$_selectedMenuId",
            validToken,
            null
          );

          if (menuDetails != null && menuDetails is Map) {
            print("Got menu details, looking for meal-specific data");

            // Try different possible keys
            if (menuDetails.containsKey('meal_lists')) {
              result = {"meal_lists": menuDetails['meal_lists']};
              success = true;
            } else if (menuDetails.containsKey('by_meal_groceries')) {
              result = {"meal_lists": menuDetails['by_meal_groceries']};
              success = true;
            }
          }
        } catch (e) {
          print("Error extracting meal lists from menu details: $e");
        }
      }

      // If all approaches failed, try using ApiService.getMealShoppingLists as fallback
      if (!success) {
        try {
          print("FALLBACK: Using ApiService.getMealShoppingLists");
          result = await ApiService.getMealShoppingLists(
            validToken,
            _selectedMenuId,
          );

          if (result != null) {
            success = true;
          }
        } catch (e) {
          print("Error with getMealShoppingLists fallback: $e");
        }
      }

      // If all approaches failed, return empty result
      if (!success || result == null) {
        print("All approaches for meal shopping lists failed");
        result = {"meal_lists": []};
      }

      print("Meal shopping lists API response received");
      if (result != null) {
        print("Meal shopping lists API response keys: ${result.keys.toList()}");

        // Check if the result is an error response with token expiration
        if (result is Map &&
            result.containsKey('detail') &&
            (result['detail'] == 'Token has expired' || result['detail'] == 'Could not validate credentials')) {

          print("🔑 Token expired error detected in meal shopping lists response");

          // Try to refresh the token
          if (await authProvider.refreshTokenIfNeeded()) {
            // Token refreshed, retry the fetch with the new token
            print("🔄 Token refreshed, retrying meal shopping lists fetch");
            return _fetchMealShoppingLists();
          } else {
            print("Token refresh failed for meal shopping lists");
            return;
          }
        }

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
      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for adding items to cart");
      }

      if (validToken == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Authentication token is invalid. Please log in again.'))
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      // Get the cart state provider
      final cartState = Provider.of<CartState>(context, listen: false);

      // Create cart items with real data
      List<Map<String, dynamic>> cartItems = [];

      // First check if any items are already checked
      bool anyChecked = false;
      _categorizedItems.forEach((category, items) {
        for (var item in items) {
          if (item['checked'] == true) {
            anyChecked = true;
            break;
          }
        }
      });

      print("Any items checked? $anyChecked");

      for (var category in _categorizedItems.values) {
        for (var item in category) {
          // If some items are checked, only include checked items
          // If no items are checked, include all items and mark them as checked
          if (anyChecked && item['checked'] != true) {
            // Skip unchecked items if we have some checked items
            continue;
          }

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
            'store': _selectedStore // Use the selected store
          };

          cartItems.add(cartItem);

          // Mark as checked
          item['checked'] = true;
        }
      }

      print("Adding ${cartItems.length} items to $_selectedStore cart");

      // Clear existing cart to avoid duplicates
      cartState.clearCart(_selectedStore);
      // Add all items to the cart state
      cartState.addItemsToCart(_selectedStore, cartItems);
      // Debug print to verify items were added
      cartState.printCartState();

      // Navigate to carts screen
      Navigator.pushNamed(
        context,
        '/carts',
        arguments: {
          'userId': widget.userId,
          'authToken': validToken, // Use the refreshed token
          'selectedStore': _selectedStore,
        }
      );

      // Show success message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Added ${cartItems.length} items to $_selectedStore cart"),
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
      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for adding meal to cart");
      }

      if (validToken == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Authentication token is invalid. Please log in again.'))
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      // Check if we're adding to Instacart
      if (_selectedStore == 'Instacart') {
        // For Instacart, we need to show the retailer selector
        setState(() {
          _isLoading = false;
        });

        // Convert ingredients to list of ingredient names
        List<String> ingredientNames = ingredients.map((item) {
          String name = item['name'] ?? 'Unknown item';
          if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
            name = "$name: ${item['quantity']} ${item['unit'] ?? ''}".trim();
          }
          return name;
        }).toList();

        // Store this in the cart state for immediate access
        final cartState = Provider.of<CartState>(context, listen: false);
        List<Map<String, dynamic>> cartItems = ingredients.map((item) {
          String displayText = item['name'] ?? 'Unknown item';
          if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
            displayText = "$displayText: ${item['quantity']} ${item['unit'] ?? ''}".trim();
          }
          return {
            'ingredient': displayText,
            'name': item['name'],
            'quantity': item['quantity'],
            'unit': item['unit'] ?? '',
            'notes': 'From: $mealTitle',
            'store': 'Instacart'
          };
        }).toList();

        cartState.addItemsToCart('Instacart', cartItems);

        // Show snackbar and prompt for Instacart retailer
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Select an Instacart retailer for ${ingredientNames.length} items from $mealTitle"),
            duration: Duration(seconds: 3),
          )
        );

        // Show the Instacart retailer selector
        _showInstacartDialog();
        return;
      }

      // For other stores (like Kroger), continue with normal cart process
      // Get the cart state provider
      final cartState = Provider.of<CartState>(context, listen: false);

      // Create cart items for this meal
      List<Map<String, dynamic>> cartItems = [];

      for (var item in ingredients) {
        // Format each ingredient with quantity and unit
        String displayText = item['name'] ?? 'Unknown item';

        if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
          displayText = "$displayText: ${item['quantity']} ${item['unit'] ?? ''}".trim();
        }

        // Create a cart item
        final cartItem = {
          'ingredient': displayText,
          'name': item['name'],
          'quantity': item['quantity'],
          'unit': item['unit'] ?? '',
          'notes': 'From: $mealTitle',
          'store': _selectedStore
        };

        cartItems.add(cartItem);
      }

      print("Adding ${cartItems.length} items from $mealTitle to $_selectedStore cart");

      // Add items to the cart state
      cartState.addItemsToCart(_selectedStore, cartItems);
      // Debug print to verify items were added
      cartState.printCartState();

      // Show success message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Added ${cartItems.length} items from $mealTitle to $_selectedStore cart"),
            action: SnackBarAction(
              label: 'VIEW CART',
              onPressed: () {
                Navigator.pushNamed(
                  context,
                  '/carts',
                  arguments: {
                    'userId': widget.userId,
                    'authToken': validToken, // Use the refreshed token
                    'selectedStore': _selectedStore,
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
                                  'store': _selectedStore // Use selected store
                                };
                                cartState.addItemToCart(_selectedStore, cartItem);

                                // Mark as checked
                                setState(() {
                                  item['checked'] = true;
                                });

                                // Show success message
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text("Added ${item['name']} to $_selectedStore cart"),
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

      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for Instacart dialog");
      }

      if (validToken == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Authentication token is invalid. Please log in again.'))
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      // Get user's zip code from preferences
      final prefs = await SharedPreferences.getInstance();
      String? zipCode = prefs.getString('zipCode') ?? '80538'; // Default to Loveland, CO

      setState(() {
        _isLoading = false;
      });

      final result = await showDialog<Map<String, dynamic>?>(
        context: context,
        barrierDismissible: false, // Prevent closing by tapping outside
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              Image.asset(
                'assets/instacart/Instacart_Carrot.png',
                height: 24,
                width: 24,
              ),
              SizedBox(width: 8),
              Text('Send to Instacart'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Select an Instacart retailer to create your shopping list',
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 16),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF43B02A), // Instacart green
                  foregroundColor: Colors.white,
                  elevation: 2,
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
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
                      'userId': widget.userId,
                      'authToken': validToken, // Use the refreshed token
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

      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for Instacart list creation");
      }

      if (validToken == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Authentication token is invalid. Please log in again.'))
        );
        setState(() {
          _isLoading = false;
        });
        return;
      }

      // Force conversion to string using string interpolation for absolute safety
      final String safeRetailerId = '$retailerId';
      final String safeRetailerName = '$retailerName';

      print("Safe retailerId for navigation: $safeRetailerId (${safeRetailerId.runtimeType})");
      print("Safe retailerName for navigation: $safeRetailerName (${safeRetailerName.runtimeType})");

      // Prepare ingredients list - only include checked items, or mark all as checked if none selected
      List<String> ingredients = [];
      bool anyChecked = false;

      // First check if any items are already checked
      _categorizedItems.forEach((category, items) {
        for (var item in items) {
          if (item['checked'] == true) {
            anyChecked = true;
            break;
          }
        }
      });

      _categorizedItems.forEach((category, items) {
        for (var item in items) {
          // If some items are checked, only include checked items
          // If no items are checked, include all items and mark them as checked
          if (anyChecked && item['checked'] != true) {
            // Skip unchecked items if we have some checked items
            continue;
          }

          String ingredient = item['name'];
          if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
            ingredient = "${ingredient}: ${item['quantity']} ${item['unit'] ?? ''}".trim();
          }
          ingredients.add(ingredient);

          // Mark the item as checked in the UI
          item['checked'] = true;
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

      print("Prepared ${ingredients.length} ingredients for Instacart");

      // Add to the cart state for consistency and to ensure it's available in other screens
      try {
        final cartState = Provider.of<CartState>(context, listen: false);
        List<Map<String, dynamic>> cartItems = [];

        for (var category in _categorizedItems.values) {
          for (var item in category) {
            // Only include checked items (we already filtered them for ingredients above)
            if (anyChecked && item['checked'] != true) {
              continue;
            }

            String displayText = item['name'] ?? 'Unknown item';

            if (item['quantity'] != null && item['quantity'].toString().isNotEmpty) {
              displayText = "$displayText: ${item['quantity']} ${item['unit'] ?? ''}".trim();
            }

            final cartItem = {
              'ingredient': displayText,
              'name': item['name'],
              'unit': item['unit'],
              'quantity': item['quantity'],
              'notes': item['notes'] ?? '',
              'store': 'Instacart',
              'retailer_id': safeRetailerId,
              'retailer_name': safeRetailerName
            };

            cartItems.add(cartItem);
          }
        }

        print("Adding ${cartItems.length} items to Instacart cart");
        // Clear existing Instacart cart to avoid duplicates
        cartState.clearCart('Instacart');
        // Add new items
        cartState.addItemsToCart('Instacart', cartItems);
        cartState.printCartState(); // Debug print to verify items were added
      } catch (cartError) {
        print("Error adding to cart state: $cartError");
        // Continue anyway - the direct shopping list URL is more important
      }

      // Show pending indicator
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Creating Instacart shopping list with ${ingredients.length} items"),
          duration: Duration(seconds: 2),
        )
      );

      // Get ZIP code from shared preferences
      final prefs = await SharedPreferences.getInstance();
      String? zipCode = prefs.getString('zipCode') ?? '80538'; // Default to Loveland, CO

      // Use the new direct shopping list URL approach from the web app
      final result = await InstacartService.createShoppingListUrl(
        validToken,
        safeRetailerId,
        ingredients,
        zipCode
      );

      if (result['success'] == true && result['url'] != null) {
        // We got a direct URL - launch it
        print("Got direct shopping list URL: ${result['url']}");

        final url = Uri.parse(result['url']);

        // First try to open in the Instacart app
        try {
          print("Attempting to open Instacart app with URL: $url");

          // Try to open in the app first (platformSpecific mode)
          final appOpened = await launchUrl(
            url,
            mode: LaunchMode.platformDefault  // This should try to open in the app if available
          );

          if (appOpened) {
            print("Successfully opened URL with default handler (likely Instacart app)");
            // Show success message
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text("Opening in Instacart"),
                  duration: Duration(seconds: 3),
                )
              );
            }
            return; // Exit early if app opened successfully
          } else {
            print("Could not open with default handler, falling back to browser");
          }
        } catch (e) {
          print("Error opening in app, will try browser: $e");
          // Continue to browser fallback
        }

        // Fallback to browser if app doesn't open
        try {
          print("Launching URL in browser: $url");
          await launchUrl(
            url,
            mode: LaunchMode.externalApplication  // External browser
          );

          // Show success message
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("Instacart shopping list opened in browser"),
                duration: Duration(seconds: 3),
              )
            );
          }
        } catch (e) {
          print("Error launching in browser: $e");
          // Automatically copy to clipboard as a final fallback
          await Clipboard.setData(ClipboardData(text: result['url']));

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("URL copied to clipboard. Please paste in your browser."),
                backgroundColor: Colors.orange,
                duration: Duration(seconds: 5),
              )
            );
          }
        }
      } else {
        // Fallback to the old approach if direct URL fails
        print("Direct shopping list URL creation failed, falling back to search results screen");
        print("Error: ${result['error']}");

        // Navigate to Instacart search results
        Navigator.pushNamed(
          context,
          '/instacart-search',
          arguments: {
            'retailerId': safeRetailerId,
            'retailerName': safeRetailerName,
            'ingredients': ingredients,
            'userId': widget.userId,
            'authToken': validToken, // Use the refreshed token
          },
        );
      }

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      print("Error creating Instacart list: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error creating Instacart shopping list: $e'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 5),
        )
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
                    backgroundColor: _selectedStore == 'Instacart'
                        ? Color(0xFF43B02A) // Instacart green
                        : Theme.of(context).primaryColor, // Default theme color for Kroger
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
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Debug button for troubleshooting
          Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: FloatingActionButton.small(
              heroTag: "debug-btn",
              onPressed: _showDebugInfo,
              tooltip: "Show debug info",
              child: Icon(Icons.bug_report),
              backgroundColor: Colors.grey[700],
            ),
          ),
          FloatingActionButton.extended(
            heroTag: "instacart-btn",
            onPressed: _showInstacartDialog,
            icon: Image.asset(
              'assets/instacart/Instacart_Carrot.png',
              height: 24,
              width: 24,
              color: Colors.white,
            ),
            label: Text("Order with Instacart"),
            backgroundColor: Color(0xFF43B02A), // Instacart green
          ),
        ],
      );
    } else if (_selectedStore == 'Kroger') {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Debug button for troubleshooting
          Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: FloatingActionButton.small(
              heroTag: "debug-btn",
              onPressed: _showDebugInfo,
              tooltip: "Show debug info",
              child: Icon(Icons.bug_report),
              backgroundColor: Colors.grey[700],
            ),
          ),
          FloatingActionButton.extended(
            heroTag: "kroger-btn",
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
            backgroundColor: Theme.of(context).primaryColor, // Match Kroger theme
          ),
        ],
      );
    }

    // Fallback - just show debug button
    return FloatingActionButton.small(
      heroTag: "debug-btn",
      onPressed: _showDebugInfo,
      tooltip: "Show debug info",
      child: Icon(Icons.bug_report),
      backgroundColor: Colors.grey[700],
    );
  }

  // Helper method to format date
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }

  // Show debug information
  void _showDebugInfo() {
    final debugInfo = StringBuffer();

    // General info
    debugInfo.writeln("=== SHOPPING LIST DEBUG INFO ===");
    debugInfo.writeln("Menu ID: $_selectedMenuId");
    debugInfo.writeln("Menu Title: $_selectedMenuTitle");
    debugInfo.writeln("User ID: ${widget.userId}");
    debugInfo.writeln("Token Length: ${widget.authToken.length}");
    debugInfo.writeln("Selected Store: $_selectedStore");
    debugInfo.writeln("Current Tab: ${_tabController?.index ?? 'null'}");
    debugInfo.writeln("Is Loading: $_isLoading");

    // Token info
    try {
      debugInfo.writeln("\n=== TOKEN INFO ===");
      final authProvider = Provider.of<AuthProvider>(context, listen: false);

      // Use JwtDecoder directly since AuthProvider doesn't expose these properties
      bool isExpired = false;
      String expTime = "Unknown";

      if (authProvider.authToken != null) {
        try {
          isExpired = JwtDecoder.isExpired(authProvider.authToken!);
          final decoded = JwtDecoder.decode(authProvider.authToken!);
          if (decoded.containsKey('exp')) {
            final expTimestamp = decoded['exp'];
            if (expTimestamp is int) {
              final expDate = DateTime.fromMillisecondsSinceEpoch(expTimestamp * 1000);
              expTime = expDate.toString();
            }
          }
        } catch (e) {
          debugInfo.writeln("Error decoding token: $e");
        }
      }

      debugInfo.writeln("Token Expired: $isExpired");
      debugInfo.writeln("Token Expiration: $expTime");
      debugInfo.writeln("User ID: ${authProvider.userId}");
      debugInfo.writeln("User Name: ${authProvider.userName}");
      debugInfo.writeln("User Email: ${authProvider.userEmail}");
      debugInfo.writeln("Account Type: ${authProvider.accountType}");
      debugInfo.writeln("Is Organization: ${authProvider.isOrganization}");
    } catch (e) {
      debugInfo.writeln("Error getting token info: $e");
    }

    // Shopping list info
    debugInfo.writeln("\n=== SHOPPING LIST INFO ===");
    debugInfo.writeln("Categories: ${_categorizedItems.keys.join(', ')}");
    debugInfo.writeln("Total Categories: ${_categorizedItems.length}");
    int totalItems = 0;
    _categorizedItems.forEach((category, items) {
      totalItems += items.length;
      debugInfo.writeln("Category '$category': ${items.length} items");
    });
    debugInfo.writeln("Total Items: $totalItems");

    // Meal lists info
    debugInfo.writeln("\n=== MEAL SHOPPING LISTS INFO ===");
    debugInfo.writeln("Total Meal Lists: ${_mealShoppingLists.length}");

    // Error info
    if (_error.isNotEmpty) {
      debugInfo.writeln("\n=== ERROR INFO ===");
      debugInfo.writeln("Error: $_error");
    }

    // Show in a dialog
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.bug_report, color: Colors.grey[700]),
            SizedBox(width: 8),
            Text("Debug Information"),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Debug text
              SelectableText(
                debugInfo.toString(),
                style: TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
              SizedBox(height: 16),
              // Actions
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton.icon(
                    onPressed: () {
                      // Copy to clipboard
                      final data = ClipboardData(text: debugInfo.toString());
                      Clipboard.setData(data);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text("Debug info copied to clipboard"),
                          duration: Duration(seconds: 2),
                        )
                      );
                      Navigator.pop(context);
                    },
                    icon: Icon(Icons.copy),
                    label: Text("Copy"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.grey[700],
                      foregroundColor: Colors.white,
                    ),
                  ),
                  ElevatedButton.icon(
                    onPressed: () {
                      // Refresh shopping list
                      Navigator.pop(context);
                      setState(() {
                        _isLoading = true;
                        _error = '';
                      });
                      _fetchShoppingList();
                      _fetchMealShoppingLists();
                    },
                    icon: Icon(Icons.refresh),
                    label: Text("Retry"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).primaryColor,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 16),
              // Force API approach selection
              Text("Force API Approach:", style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _forceApiApproach(1);
                    },
                    child: Text("Web App Endpoint"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      textStyle: TextStyle(fontSize: 12),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _forceApiApproach(2);
                    },
                    child: Text("Menu Details"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      textStyle: TextStyle(fontSize: 12),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _forceApiApproach(3);
                    },
                    child: Text("Direct Endpoints"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      textStyle: TextStyle(fontSize: 12),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _forceApiApproach(4);
                    },
                    child: Text("POST Endpoints"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.purple,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      textStyle: TextStyle(fontSize: 12),
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _forceApiApproach(5);
                    },
                    child: Text("From Meal Lists"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      textStyle: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Close"),
          ),
        ],
      ),
    );
  }

  // Force a specific API approach for testing
  Future<void> _forceApiApproach(int approach) async {
    setState(() {
      _isLoading = true;
      _error = '';
      _categorizedItems = {};
    });

    try {
      print("🔧 Forcing API approach #$approach");

      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for forced approach");
      }

      if (validToken == null) {
        setState(() {
          _isLoading = false;
          _error = 'Authentication token is invalid. Please log in again.';
        });
        return;
      }

      Map<String, dynamic>? result;
      bool success = false;

      switch (approach) {
        case 1:
          // Web app's grocery list endpoint
          print("FORCED APPROACH 1: Using the web app's grocery list endpoint");
          final groceryListEndpoint = "/menu/$_selectedMenuId/grocery-list";

          try {
            print("Fetching from: $groceryListEndpoint");
            result = await ApiService.callApiEndpoint(
              'GET',
              groceryListEndpoint,
              validToken,
              null
            );

            if (result != null && result is Map) {
              print("Got grocery list from web app endpoint");
              success = true;
            }
          } catch (e) {
            print("Error fetching from web app endpoint: $e");
            setState(() {
              _error = 'Error with web app endpoint: $e';
            });
          }
          break;

        case 2:
          // Get menu details approach
          print("FORCED APPROACH 2: Get menu details and extract grocery list");
          final menuDetailsEndpoint = "/menu/details/$_selectedMenuId";

          try {
            final menuDetails = await ApiService.callApiEndpoint(
              'GET',
              menuDetailsEndpoint,
              validToken,
              null
            );

            if (menuDetails != null && menuDetails is Map) {
              print("Got menu details");
              result = Map<String, dynamic>.from(menuDetails);
              success = true;
            } else {
              setState(() {
                _error = 'Menu details response was null or not a Map';
              });
            }
          } catch (e) {
            print("Error in menu details approach: $e");
            setState(() {
              _error = 'Error with menu details endpoint: $e';
            });
          }
          break;

        case 3:
          // Try direct grocery list endpoints
          print("FORCED APPROACH 3: Try direct grocery list endpoints");
          List<String> groceryListEndpoints = [
            "/menu/$_selectedMenuId/grocery-list",
            "/grocery-list/menu/$_selectedMenuId",
            "/grocery-list/$_selectedMenuId",
            "/menu/grocery-list/$_selectedMenuId",
          ];

          for (String endpoint in groceryListEndpoints) {
            if (success) break;

            try {
              print("Trying endpoint: $endpoint");
              final response = await ApiService.callApiEndpoint('GET', endpoint, validToken, null);

              if (response != null) {
                print("Got response from $endpoint");
                if (response is Map) {
                  result = Map<String, dynamic>.from(response);
                  success = true;
                  break;
                } else if (response is List) {
                  print("Response is a list with ${response.length} items");
                  result = {"groceryList": response};
                  success = true;
                  break;
                }
              }
            } catch (e) {
              print("Error with endpoint $endpoint: $e");
            }
          }

          if (!success) {
            setState(() {
              _error = 'All direct endpoints failed';
            });
          }
          break;

        case 4:
          // POST to grocery list endpoints
          print("FORCED APPROACH 4: Try POST to grocery list endpoints");
          List<String> postEndpoints = [
            "/grocery-list",
            "/menu/grocery-list",
          ];

          for (String endpoint in postEndpoints) {
            if (success) break;

            try {
              print("Trying POST to: $endpoint");
              final response = await ApiService.callApiEndpoint(
                'POST',
                endpoint,
                validToken,
                {"menu_id": _selectedMenuId}
              );

              if (response != null) {
                print("Got response from POST $endpoint");
                if (response is Map) {
                  result = Map<String, dynamic>.from(response);
                  success = true;
                  break;
                } else if (response is List) {
                  print("Response is a list with ${response.length} items");
                  result = {"groceryList": response};
                  success = true;
                  break;
                }
              }
            } catch (e) {
              print("Error with POST to $endpoint: $e");
            }
          }

          if (!success) {
            setState(() {
              _error = 'All POST endpoints failed';
            });
          }
          break;

        case 5:
          // Build from meal shopping lists
          print("FORCED APPROACH 5: Building from meal lists");

          try {
            // Get meal shopping lists
            final mealListsResult = await ApiService.callApiEndpoint(
              'GET',
              "/menu/$_selectedMenuId/meal-shopping-lists",
              validToken,
              null
            );

            if (mealListsResult != null && mealListsResult is Map &&
                mealListsResult.containsKey('meal_lists') && mealListsResult['meal_lists'] is List) {

              print("Building grocery list from meal shopping lists");
              List<dynamic> mealLists = mealListsResult['meal_lists'];
              List<Map<String, dynamic>> combinedIngredients = [];

              // Extract and combine all ingredients from all meals
              for (var meal in mealLists) {
                if (meal is Map && meal.containsKey('ingredients') && meal['ingredients'] is List) {
                  List<dynamic> mealIngredients = meal['ingredients'];

                  for (var ingredient in mealIngredients) {
                    if (ingredient is Map) {
                      // Convert to Map<String, dynamic> for type safety
                      Map<String, dynamic> safeIngredient = Map<String, dynamic>.from(ingredient);

                      // Add meal name as source
                      safeIngredient['source'] = meal['title'] ?? 'Unknown Meal';

                      combinedIngredients.add(safeIngredient);
                    }
                  }
                }
              }

              if (combinedIngredients.isNotEmpty) {
                print("Built grocery list with ${combinedIngredients.length} items from meal lists");
                result = {"groceryList": combinedIngredients};
                success = true;
              } else {
                setState(() {
                  _error = 'No ingredients found in meal lists';
                });
              }
            } else {
              setState(() {
                _error = 'Meal lists response was invalid';
              });
            }
          } catch (e) {
            print("Error building grocery list from meal lists: $e");
            setState(() {
              _error = 'Error with meal lists approach: $e';
            });
          }
          break;

        default:
          setState(() {
            _error = 'Invalid approach selected';
          });
          break;
      }

      if (success && result != null) {
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
        } else if (result.containsKey('ingredients') && result['ingredients'] is List) {
          // Format is a flat list of ingredients
          print("Format is a flat list of ingredients");
          List<dynamic> ingredients = result['ingredients'];
          print("Found ${ingredients.length} ingredients");

          // Simple categorization
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
              continue;
            }

            // Place all items in a single category for simplicity
            if (!categorizedItems.containsKey(category)) {
              categorizedItems[category] = [];
            }
            categorizedItems[category]!.add(parsedItem);
          }
        } else if (result.containsKey('items') && result['items'] is List) {
          // Format with 'items' key
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

        print("Final categorized items count: ${categorizedItems.length} categories");
        categorizedItems.forEach((category, items) {
          print("Category '$category' has ${items.length} items");
        });

        setState(() {
          _categorizedItems = categorizedItems;
          _isLoading = false;
          if (categorizedItems.isEmpty) {
            print("No items found in the response");
            _error = 'No items found in the shopping list using approach #$approach.';
          } else {
            _error = '';
          }
        });
      } else {
        setState(() {
          _isLoading = false;
          if (_error.isEmpty) {
            _error = 'Failed to fetch shopping list data using approach #$approach.';
          }
        });
      }
    } catch (e) {
      print("Error in _forceApiApproach: $e");
      setState(() {
        _error = 'Error with approach #$approach: $e';
        _isLoading = false;
      });
    }
  }
}