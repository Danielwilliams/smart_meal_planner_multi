import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
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
  // Hardcoded to Kroger - no longer a user selection
  final String _selectedStore = 'Kroger';
  String _error = '';
  List<Menu> _availableMenus = [];
  int _selectedMenuId = 0;
  String _selectedMenuTitle = '';

  // Debounce timer for snackbar notifications
  DateTime _lastSnackbarTime = DateTime.now().subtract(Duration(seconds: 10));
  String _lastSnackbarMessage = '';

  @override
  void initState() {
    super.initState();
    _selectedMenuId = widget.menuId;
    _selectedMenuTitle = widget.menuTitle;
    _fetchAvailableMenus();
    _fetchShoppingList();
  }

  // Helper function to show snackbar with debouncing to prevent duplicates
  void _showSnackbar(String message, {Duration duration = const Duration(seconds: 2)}) {
    final now = DateTime.now();
    // Only show if it's been at least 2 seconds or the message is different
    if (now.difference(_lastSnackbarTime).inSeconds > 2 || message != _lastSnackbarMessage) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          duration: duration,
        )
      );
      _lastSnackbarTime = now;
      _lastSnackbarMessage = message;
    } else {
      print("Suppressing duplicate snackbar: $message");
    }
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
      // Show a message for AI generation using debounced function
      _showSnackbar('Generating AI-enhanced shopping list...');

      // Cache validation - create a menu-specific ID key
      final String menuIdKey = 'menu_$_selectedMenuId';

      // Check for locally cached data first
      final prefs = await SharedPreferences.getInstance();
      final String? cachedData = prefs.getString(menuIdKey);

      if (cachedData != null) {
        try {
          // Parse cached data
          final Map<String, dynamic> cachedResult = json.decode(cachedData);
          // Add a timestamp to the cache to ensure it's not too old
          final int cachedTimestamp = cachedResult['timestamp'] ?? 0;
          final int currentTime = DateTime.now().millisecondsSinceEpoch;

          // Check if cache is valid (less than 24 hours old)
          if (currentTime - cachedTimestamp < 86400000) { // 24 hours in milliseconds
            print("Using cached AI shopping list data for menu $_selectedMenuId");
            await _processShoppingListItems(cachedResult['data']);
            _showSnackbar(
              'Using cached shopping list for "$_selectedMenuTitle"',
              duration: Duration(seconds: 2)
            );
            setState(() {
              _isLoading = false;
            });
            return;
          } else {
            print("Cached data is too old, fetching fresh data");
          }
        } catch (cacheError) {
          print("Error parsing cached data: $cacheError");
          // Continue with normal fetch if cache fails
        }
      }

      // STEP 1: Make the initial POST request to start the AI shopping list generation
      print("Making initial POST request to start AI shopping list generation for menu ID: $_selectedMenuId");

      final initialAiResult = await ApiService.generateAiShoppingList(
        _selectedMenuId,
        widget.authToken,
      );

      if (initialAiResult != null) {
        print("Initial AI request returned with keys: ${initialAiResult.keys.toList()}");

        // STEP 2: Check if the result indicates it's processing in the background
        if (initialAiResult.containsKey('status') &&
            (initialAiResult['status'].toString().toLowerCase() == 'processing' ||
             initialAiResult['status'].toString().toLowerCase() == 'pending')) {

          // Show a notification that we're waiting using debounced function
          _showSnackbar(
            'AI is processing your shopping list for "$_selectedMenuTitle", please wait...',
            duration: Duration(seconds: 3)
          );

          // STEP 3: Start polling for status using a better approach
          int retryAttempts = 0;
          const int maxRetries = 10; // Increased max retries
          const int initialDelay = 2; // Initial delay in seconds
          int currentDelay = initialDelay; // Current delay that will increase
          bool processingComplete = false;

          while (!processingComplete && retryAttempts < maxRetries) {
            // Use exponential backoff with a maximum delay of 10 seconds
            await Future.delayed(Duration(seconds: currentDelay));
            retryAttempts++;

            // Double the delay for next attempt, but cap at 10 seconds
            currentDelay = (currentDelay * 2).clamp(initialDelay, 10);

            try {
              print("Polling attempt $retryAttempts: checking AI shopping list status");

              // STEP 4: Check the status endpoint
              final statusResult = await ApiService.getAiShoppingListStatus(_selectedMenuId, widget.authToken);

              if (statusResult == null) {
                print("Status check returned null, continuing to next attempt");
                continue;
              }

              print("Status response keys: ${statusResult.keys.toList()}");

              // STEP 5: Check if processing is complete with comprehensive conditions
              final bool isCompleted =
                // Has explicit completed status
                statusResult['status']?.toString()?.toLowerCase() == 'completed' ||
                // Has explicit ready flag
                statusResult['is_ready'] == true ||
                // Has cache flag set
                statusResult['cached'] == true ||
                // Has groceryList with content
                (statusResult.containsKey('groceryList') &&
                 statusResult['groceryList'] is List &&
                 (statusResult['groceryList'] as List).isNotEmpty) ||
                // Has ingredient_list with content
                (statusResult.containsKey('ingredient_list') &&
                 statusResult['ingredient_list'] is List &&
                 (statusResult['ingredient_list'] as List).isNotEmpty) ||
                // Has nutritionTips populated (indicates completion)
                (statusResult.containsKey('nutritionTips') &&
                 statusResult['nutritionTips'] is List &&
                 (statusResult['nutritionTips'] as List).isNotEmpty) ||
                // Has recommendations populated (indicates completion)
                (statusResult.containsKey('recommendations') &&
                 statusResult['recommendations'] is List &&
                 (statusResult['recommendations'] as List).isNotEmpty);

              if (isCompleted) {
                processingComplete = true;
                print("AI shopping list processing complete!");

                // STEP 6: Get the completed list data
                Map<String, dynamic> completedData;

                // Use the status data if it contains the shopping list
                if ((statusResult.containsKey('groceryList') && statusResult['groceryList'] is List) ||
                    (statusResult.containsKey('ingredient_list') && statusResult['ingredient_list'] is List) ||
                    (statusResult.containsKey('ingredients') && statusResult['ingredients'] is List)) {
                  print("Using data directly from status response");
                  completedData = statusResult;
                } else {
                  // If status doesn't contain the full list, request it again
                  print("Requesting full shopping list data after completion");
                  final completedResult = await ApiService.generateAiShoppingList(
                    _selectedMenuId,
                    widget.authToken,
                  );

                  if (completedResult == null) {
                    throw Exception("Failed to get completed shopping list");
                  }

                  completedData = completedResult;
                }

                // Process the shopping list
                await _processShoppingListItems(completedData);

                // Cache the result for future use
                try {
                  final cacheData = {
                    'data': completedData,
                    'timestamp': DateTime.now().millisecondsSinceEpoch,
                  };

                  await prefs.setString(menuIdKey, json.encode(cacheData));
                  print("Cached AI shopping list data for menu $_selectedMenuId");
                } catch (cacheError) {
                  print("Error caching shopping list data: $cacheError");
                }

                // Show success notification
                _showSnackbar(
                  'AI shopping list for "$_selectedMenuTitle" is ready!',
                  duration: Duration(seconds: 3)
                );

                setState(() {
                  _isLoading = false;
                });
                return;
              } else if (statusResult['status']?.toString()?.toLowerCase() == 'error') {
                print("AI shopping list error: ${statusResult['message']}");
                break;
              }

              // Show progress update with estimated time remaining
              final int attemptsRemaining = maxRetries - retryAttempts;
              _showSnackbar(
                'AI is still working on your shopping list (${retryAttempts}/$maxRetries)...',
                duration: Duration(seconds: 2)
              );
            } catch (statusError) {
              print("Error checking status: $statusError");
              // Continue to next attempt on error
            }
          }

          if (!processingComplete) {
            print("AI shopping list processing timed out, falling back to regular list");
            _showSnackbar(
              'AI shopping list is taking too long, using standard list instead',
              duration: Duration(seconds: 3)
            );
          }
        } else if ((initialAiResult.containsKey('groceryList') && initialAiResult['groceryList'] is List) ||
                 (initialAiResult.containsKey('ingredients') && initialAiResult['ingredients'] is List) ||
                 (initialAiResult.containsKey('ingredient_list') && initialAiResult['ingredient_list'] is List)) {
          // We got an immediate result (likely from cache)
          print("Got immediate AI shopping list result (likely cached)");
          await _processShoppingListItems(initialAiResult);

          // Cache the result for future use
          try {
            final cacheData = {
              'data': initialAiResult,
              'timestamp': DateTime.now().millisecondsSinceEpoch,
            };

            await prefs.setString(menuIdKey, json.encode(cacheData));
            print("Cached AI shopping list data for menu $_selectedMenuId");
          } catch (cacheError) {
            print("Error caching shopping list data: $cacheError");
          }

          setState(() {
            _isLoading = false;
          });
          return; // Success, exit early
        } else if (initialAiResult.containsKey('error')) {
          print("AI shopping list returned an error: ${initialAiResult['error']}");
          _showSnackbar(
            'AI shopping list error: ${initialAiResult['error']}',
            duration: Duration(seconds: 3)
          );
        } else {
          print("AI shopping list returned unexpected response: $initialAiResult");
        }
      } else {
        print("AI shopping list initial request returned null");
      }

      // Fallback to regular shopping list if AI generation fails
      print("Fetching regular shopping list as fallback");
      final result = await ApiService.getShoppingList(
        widget.userId,
        widget.authToken,
        _selectedMenuId,
      );

      if (result != null) {
        print("Regular shopping list API returned result with keys: ${result.keys.toList()}");

        if (result.containsKey('ingredient_list')) {
          print("Ingredient list contains ${(result['ingredient_list'] as List).length} items");
        } else if (result.containsKey('ingredients')) {
          print("Ingredients list contains ${(result['ingredients'] as List).length} items");
        } else if (result.containsKey('groceryList')) {
          print("Grocery list found, examining format");
          var groceryList = result['groceryList'];
          if (groceryList is List) {
            print("Grocery list contains ${groceryList.length} items/categories");
          }
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
      print("Error in _fetchShoppingList: $e");
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
    // Safety check for null data
    if (data == null) {
      print("WARNING: Null data passed to _processShoppingListItems");
      return;
    }

    // Initialize empty categories map
    Map<String, List<Map<String, dynamic>>> categorizedItems = {};

    // Check for various possible keys for ingredient data
    List<dynamic> ingredients = [];

    // Debug log
    print("Processing shopping list data with keys: ${data.keys.toList()}");

    // Check for 'ingredient_list' key - common in the backend API
    if (data.containsKey('ingredient_list')) {
      print("Found 'ingredient_list' key");
      ingredients = data['ingredient_list'] as List<dynamic>;
    }
    // Check for 'ingredients' key
    else if (data.containsKey('ingredients')) {
      print("Found 'ingredients' key");
      ingredients = data['ingredients'] as List<dynamic>;
    }
    // Check for 'groceryList' key - common in AI-enhanced responses
    else if (data.containsKey('groceryList')) {
      print("Found 'groceryList' key (AI-enhanced format)");

      // Handle groceryList which could be a list of categories or a list of items
      var groceryList = data['groceryList'];
      if (groceryList is List) {
        if (groceryList.isNotEmpty) {
          // Check if first item is a category or a direct item
          if (groceryList[0] is Map &&
              (groceryList[0].containsKey('category') || groceryList[0].containsKey('items'))) {
            // This is a categorized list
            print("Grocery list contains categorized items");
            for (var category in groceryList) {
              if (category is Map && category.containsKey('items') && category['items'] is List) {
                print("Processing category: ${category['category'] ?? 'unnamed'} with ${(category['items'] as List).length} items");
                ingredients.addAll(category['items'] as List);
              }
            }
          } else {
            // Direct list of items
            print("Grocery list contains direct items");
            ingredients.addAll(groceryList);
          }
        }
      }
    }
    // Check for 'data' key with embedded ingredient information
    else if (data.containsKey('data')) {
      print("Found 'data' key, examining contents");
      var dataField = data['data'];

      if (dataField is Map && (dataField.containsKey('ingredients') ||
                               dataField.containsKey('ingredient_list') ||
                               dataField.containsKey('groceryList'))) {
        // Recursively process the nested data
        print("Found nested ingredient data, processing recursively");
        return _processShoppingListItems(dataField as Map<String, dynamic>);
      } else if (dataField is List) {
        // Direct list of ingredients
        print("Data field is a direct list of ${dataField.length} items");
        ingredients.addAll(dataField);
      }
    }
    // Check for AI status field with shopping list data
    else if (data.containsKey('ai_shopping_list')) {
      print("Found 'ai_shopping_list' key");
      var aiList = data['ai_shopping_list'];

      if (aiList is Map && (aiList.containsKey('ingredients') ||
                           aiList.containsKey('groceryList') ||
                           aiList.containsKey('items'))) {
        // Process the AI shopping list data
        print("Found structured AI shopping list data");
        if (aiList.containsKey('ingredients')) {
          ingredients.addAll(aiList['ingredients'] as List);
        } else if (aiList.containsKey('groceryList')) {
          var groceryList = aiList['groceryList'];
          if (groceryList is List) {
            for (var item in groceryList) {
              if (item is Map && item.containsKey('items')) {
                ingredients.addAll(item['items'] as List);
              } else {
                ingredients.add(item);
              }
            }
          }
        } else if (aiList.containsKey('items')) {
          ingredients.addAll(aiList['items'] as List);
        }
      } else if (aiList is List) {
        // Direct list of items
        print("AI shopping list is a direct list of ${aiList.length} items");
        ingredients.addAll(aiList);
      } else if (aiList is String) {
        // Handle string format (could be JSON)
        print("AI shopping list is a string, attempting to parse");
        try {
          var parsed = json.decode(aiList);
          if (parsed is List) {
            ingredients.addAll(parsed);
          } else if (parsed is Map) {
            // Try to extract ingredients from parsed data
            if (parsed.containsKey('ingredients')) {
              ingredients.addAll(parsed['ingredients'] as List);
            } else if (parsed.containsKey('groceryList')) {
              var groceryList = parsed['groceryList'];
              if (groceryList is List) {
                ingredients.addAll(groceryList);
              }
            }
          }
        } catch (e) {
          print("Error parsing AI shopping list string: $e");
          // If can't parse as JSON, treat as a single ingredient
          ingredients.add(aiList);
        }
      }
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

    // Define common categories with expanded keywords
    final categories = {
      'Produce': [
        'fruit', 'vegetable', 'fresh', 'produce', 'lettuce', 'spinach', 'carrot',
        'broccoli', 'onion', 'garlic', 'pepper', 'cucumber', 'tomato', 'apple',
        'banana', 'orange', 'berry', 'grape', 'pineapple', 'mango', 'avocado',
        'potato', 'celery', 'cilantro', 'parsley', 'herb', 'lemon', 'lime'
      ],
      'Protein': [
        'meat', 'seafood', 'beef', 'chicken', 'fish', 'pork', 'turkey', 'lamb',
        'shrimp', 'salmon', 'tuna', 'steak', 'breast', 'thigh', 'ground', 'bacon',
        'sausage', 'ham', 'tofu', 'tempeh', 'protein'
      ],
      'Dairy': [
        'dairy', 'milk', 'cheese', 'yogurt', 'egg', 'butter', 'cream', 'sour cream',
        'whipping cream', 'half and half', 'mozzarella', 'cheddar', 'feta', 'parmesan',
        'cottage cheese', 'ricotta', 'ice cream'
      ],
      'Grains': [
        'bread', 'bakery', 'pastry', 'dough', 'pasta', 'rice', 'grain', 'cereal',
        'flour', 'tortilla', 'oat', 'quinoa', 'wheat', 'barley', 'couscous', 'noodle',
        'pita', 'bun', 'roll'
      ],
      'Pantry': [
        'sugar', 'salt', 'spice', 'oil', 'sauce', 'condiment', 'vinegar', 'ketchup',
        'mustard', 'syrup', 'baking', 'stock', 'broth', 'canned', 'can', 'soup',
        'bean', 'lentil', 'chickpea', 'soy sauce', 'honey', 'maple', 'peanut butter',
        'jelly', 'jam', 'nuts', 'seed', 'dried', 'pasta sauce', 'tomato sauce',
        'coconut milk', 'curry paste'
      ],
      'Frozen': [
        'frozen', 'ice cream', 'frozen vegetables', 'frozen fruit', 'freezer',
        'frozen pizza', 'frozen meal'
      ],
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
      // Skip null items
      if (item == null) {
        print("WARNING: Null item in ingredients list");
        continue;
      }

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

        // Also check for common format "X lbs of Y" or "X pounds of Y"
        final weightRegex = RegExp(r'(\d+)\s*(lb|lbs|pound|pounds)\s+(?:of\s+)?(.+)', caseSensitive: false);
        final weightMatch = weightRegex.firstMatch(ingredient);

        if (weightMatch != null) {
          int? weightValue = int.tryParse(weightMatch.group(1)!);
          String? itemName = weightMatch.group(3);

          if (weightValue != null && itemName != null) {
            // Check for unreasonably large quantities (like 96 lbs of chicken)
            if (weightValue > 10 && (
                itemName.toLowerCase().contains('chicken') ||
                itemName.toLowerCase().contains('breast') ||
                itemName.toLowerCase().contains('beef') ||
                itemName.toLowerCase().contains('steak') ||
                itemName.toLowerCase().contains('pork'))) {
              // Convert to ounces instead
              print("Converting $weightValue lbs to oz for $itemName");
              ingredient = itemName;
              quantity = weightValue.toDouble();
              unit = "oz"; // Change unit to oz instead of lb
            }
          }
        }
      } else if (item is Map<String, dynamic>) {
        // Extract ingredient name
        ingredient = item['name'] ?? item['ingredient'] ?? '';

        // Better quantity handling for various data types
        if (item['quantity'] != null) {
          var qtyVal = item['quantity'];
          // Handle various quantity formats
          if (qtyVal is int) {
            quantity = qtyVal.toDouble();
          } else if (qtyVal is double) {
            quantity = qtyVal;
          } else if (qtyVal is String) {
            // Try to parse string to double
            try {
              quantity = double.tryParse(qtyVal);
            } catch (e) {
              print("Error parsing quantity from string: $qtyVal");
            }
          } else {
            print("Unknown quantity type: ${qtyVal.runtimeType}");
            // Try to convert to string and parse
            try {
              quantity = double.tryParse(qtyVal.toString());
            } catch (e) {
              print("Failed to parse quantity: $e");
            }
          }
        }

        unit = item['unit']?.toString();
        notes = item['notes']?.toString() ?? '';

        // Check for unreasonably large quantities in meat items
        if (quantity != null && unit != null &&
            (unit.toLowerCase() == 'lb' || unit.toLowerCase() == 'lbs' ||
             unit.toLowerCase() == 'pound' || unit.toLowerCase() == 'pounds')) {

          if (quantity > 10 && (
              ingredient.toLowerCase().contains('chicken') ||
              ingredient.toLowerCase().contains('breast') ||
              ingredient.toLowerCase().contains('beef') ||
              ingredient.toLowerCase().contains('steak') ||
              ingredient.toLowerCase().contains('pork'))) {
            // Convert to ounces instead
            print("Converting $quantity lbs to oz for $ingredient");
            unit = "oz"; // Change unit to oz instead of lb
          }
        }

        print("Processed item: name=$ingredient, quantity=$quantity, unit=$unit");
      }
      
      if (ingredient.isEmpty) continue;
      
      // Normalize the ingredient name for combining similar items
      String normalizedName = normalizeIngredient(ingredient);
      
      // Skip any empty normalized names that might occur
      if (normalizedName.isEmpty) {
        normalizedName = ingredient.toLowerCase().trim();
      }

      // Skip extremely short normalized names (likely not valid ingredients)
      if (normalizedName.length < 2) {
        print("Skipping very short ingredient name: '$normalizedName'");
        continue;
      }
      
      // Create a unique key combining the normalized name and unit (if present)
      String key = unit != null ? '$normalizedName-$unit' : normalizedName;
      
      // Add or update in the normalized map
      if (normalizedItems.containsKey(key)) {
        // Combine quantities if both have quantities
        if (quantity != null && normalizedItems[key]!['quantity'] != null) {
          try {
            // Safely add quantities with null checks and type conversions
            var existingQty = normalizedItems[key]!['quantity'];
            double existingDouble = 0;

            if (existingQty is double) {
              existingDouble = existingQty;
            } else if (existingQty is int) {
              existingDouble = existingQty.toDouble();
            } else if (existingQty is String) {
              existingDouble = double.tryParse(existingQty) ?? 0;
            }

            normalizedItems[key]!['quantity'] = existingDouble + quantity;
          } catch (e) {
            print("Error combining quantities: $e");
            // On error, just keep the existing quantity
          }
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
      try {
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
      } catch (e) {
        print("Error determining category: $e");
        // On error, use Other category
        category = 'Other';
      }

      // Add to categorized map
      if (!categorizedItems.containsKey(category)) {
        categorizedItems[category] = [];
      }

      try {
        // Remove the normalized_name field before adding to the final list
        item.remove('normalized_name');
        categorizedItems[category]!.add(Map<String, dynamic>.from(item));
      } catch (e) {
        print("Error adding item to category: $e");
        // Try to add a basic version of the item if conversion fails
        categorizedItems[category]!.add({
          'name': ingredient,
          'quantity': quantity,
          'unit': unit,
          'notes': notes,
          'checked': false
        });
      }
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
    // Skip if same menu is selected
    if (menuId == _selectedMenuId) {
      print("Same menu selected, not reloading");
      return;
    }

    setState(() {
      _selectedMenuId = menuId;
      _selectedMenuTitle = menuTitle;
      _categorizedItems = {}; // Clear current list
    });

    // Show loading message using debounced function
    _showSnackbar('Loading shopping list for "$menuTitle"...', duration: Duration(seconds: 1));

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
          String displayText = item['name'] ?? 'Unknown item';

          if (item['quantity'] != null) {
            // Handle malformed property names like "car carbs" instead of "carbs"
            // by checking all keys for partial matches
            if (item.keys.any((key) => key.toString().contains('carb'))) {
              var carbsKeys = item.keys.where((key) => key.toString().contains('carb')).toList();
              print("Found carbs-like keys: $carbsKeys");
              // If there's a malformed carbs key, fix it
              if (carbsKeys.isNotEmpty && !item.containsKey('carbs')) {
                item['carbs'] = item[carbsKeys.first];
              }
            }

            // Similarly fix protein key if malformed
            if (item.keys.any((key) => key.toString().contains('protein'))) {
              var proteinKeys = item.keys.where((key) => key.toString().contains('protein')).toList();
              if (proteinKeys.isNotEmpty && !item.containsKey('protein')) {
                item['protein'] = item[proteinKeys.first];
              }
            }

            // Similarly fix fat key if malformed
            if (item.keys.any((key) => key.toString().contains('fat'))) {
              var fatKeys = item.keys.where((key) => key.toString().contains('fat')).toList();
              if (fatKeys.isNotEmpty && !item.containsKey('fat')) {
                item['fat'] = item[fatKeys.first];
              }
            }

            // Check if this is a cheese item with "1 g" quantity
            if ((displayText.toLowerCase().contains('cheese') ||
                 displayText.toLowerCase().contains('mozzarella')) &&
                item['quantity'] != null && item['quantity'].toString() == '1' &&
                (item['unit'] == 'g' || item['unit'] == null)) {

              // Apply proper cheese quantities based on type
              if (displayText.toLowerCase().contains('cheddar') ||
                  displayText.toLowerCase().contains('mozzarella')) {
                displayText = "$displayText: 8 oz";
              } else if (displayText.toLowerCase().contains('feta') ||
                        displayText.toLowerCase().contains('parmesan')) {
                displayText = "$displayText: 1/4 cup";
              } else {
                displayText = "$displayText: 4 oz";
              }
            } else {
              // Standard quantity formatting
              String quantityText = "";
              var qty = item['quantity'];
              if (qty is int) {
                quantityText = qty.toString();
              } else if (qty is double) {
                // Format double to avoid showing decimals for whole numbers
                quantityText = qty == qty.toInt() ? qty.toInt().toString() : qty.toString();
              } else if (qty != null) {
                // Just use the value directly
                quantityText = qty.toString();
              }

              // Only add quantity if it exists
              if (quantityText.isNotEmpty) {
                // Combine with unit and name
                displayText = "$quantityText ${item['unit'] ?? ''} $displayText".trim();
              }
            }
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
            'store': 'Kroger' // Always Kroger
          };
          
          cartItems.add(cartItem);
          
          // Mark as checked
          item['checked'] = true;
        }
      }
      
      print("Adding ${cartItems.length} items to Kroger cart");
      
      // Add all items to the cart state
      cartState.addItemsToCart('Kroger', cartItems);
      cartState.printCartState();
      
      // Navigate to carts screen without passing cart data 
      // (it's already in the cart state provider)
      Navigator.pushNamed(
        context, 
        '/carts',
        arguments: {
          'userId': widget.userId,
          'authToken': widget.authToken,
          'selectedStore': 'Kroger',
        }
      );
      
      _showSnackbar("Added ${cartItems.length} items to Kroger cart", duration: Duration(seconds: 2));
    } catch (e) {
      _showSnackbar("Error: $e");
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
            
          // Store indicator - Kroger only
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.store, color: Colors.white),
                SizedBox(width: 4),
                Text(_selectedStore, style: TextStyle(color: Colors.white)),
              ],
            ),
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
                                    // Process the item name and extract quantity/unit if needed
                                    if (displayText.contains(': ') && item['quantity'] == null) {
                                      final parts = displayText.split(': ');
                                      if (parts.length >= 2) {
                                        displayText = parts[0];
                                        final quantityStr = parts[1];

                                        // Try to extract quantity and unit using regex
                                        final unitRegex = RegExp(r'(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?');
                                        final unitMatch = unitRegex.firstMatch(quantityStr);

                                        if (unitMatch != null) {
                                          item['quantity'] = unitMatch.group(1);
                                          if (unitMatch.group(2) != null && item['unit'] == null) {
                                            item['unit'] = unitMatch.group(2);
                                          }
                                        } else {
                                          item['quantity'] = quantityStr;
                                        }
                                      }
                                    }

                                    if (item['quantity'] != null) {
                                      // Check if this is a cheese item with "1 g" quantity
                                      if ((displayText.toLowerCase().contains('cheese') ||
                                           displayText.toLowerCase().contains('mozzarella')) &&
                                          item['quantity'] != null && item['quantity'].toString() == '1' &&
                                          (item['unit'] == 'g' || item['unit'] == null)) {

                                        // Apply proper cheese quantities based on type
                                        if (displayText.toLowerCase().contains('cheddar') ||
                                            displayText.toLowerCase().contains('mozzarella')) {
                                          displayText = "$displayText: 8 oz";
                                        } else if (displayText.toLowerCase().contains('feta') ||
                                                  displayText.toLowerCase().contains('parmesan')) {
                                          displayText = "$displayText: 1/4 cup";
                                        } else {
                                          displayText = "$displayText: 4 oz";
                                        }
                                      } else {
                                        // Standard quantity formatting
                                        String quantityText = "";
                                        var qty = item['quantity'];
                                        if (qty is int) {
                                          quantityText = qty.toString();
                                        } else if (qty is double) {
                                          // Format double to avoid showing decimals for whole numbers
                                          quantityText = qty == qty.toInt() ? qty.toInt().toString() : qty.toString();
                                        } else if (qty != null) {
                                          // Just use the value directly
                                          quantityText = qty.toString();
                                        }

                                        // Only add quantity if it exists
                                        if (quantityText.isNotEmpty) {
                                          // Display name: quantity unit
                                          displayText = "$displayText: $quantityText${item['unit'] != null ? ' ' + item['unit'] : ''}";
                                        }
                                      }
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
                                                    "Add \"$displayText\" to your Kroger cart?"
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
                                                          print("Adding item to cart: $displayText (quantity: ${item['quantity']}, unit: ${item['unit']})");
                                                          
                                                          // Directly pass the real ingredient data
                                                          final cartItem = {
                                                            'ingredient': displayText,
                                                            'name': item['name'],
                                                            'unit': item['unit'],
                                                            'quantity': item['quantity'],
                                                            'notes': item['notes'],
                                                            'store': 'Kroger'
                                                          };
                                                          
                                                          // Mark as checked
                                                          setState(() {
                                                            item['checked'] = true;
                                                          });
                                                          
                                                          // Add to the cart using the global state provider
                                                          final cartState = Provider.of<CartState>(context, listen: false);
                                                          cartState.addItemToCart('Kroger', cartItem);
                                                          cartState.printCartState();
                                                          
                                                          // Show success message
                                                          _showSnackbar("Added ${item['name'] ?? 'item'} to Kroger cart",
                                                            duration: Duration(seconds: 3),
                                                          );

                                                          // Use SnackBar action for view cart
                                                          ScaffoldMessenger.of(context).showSnackBar(
                                                            SnackBar(
                                                              content: Text("Item added to cart"),
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
                                                                      'selectedStore': 'Kroger',
                                                                    }
                                                                  );
                                                                },
                                                              ),
                                                            )
                                                          );
                                                        } catch (e) {
                                                          _showSnackbar("Error: $e");
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
                          "Add all items to your Kroger shopping cart?"
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
                  label: Text("ADD ALL ITEMS TO KROGER CART"),
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
              'selectedStore': 'Kroger',
            }
          );
        },
        icon: Icon(Icons.shopping_cart),
        label: Text("View Kroger Cart"),
        backgroundColor: Theme.of(context).colorScheme.secondary,
      ),
    );
  }
  
  // Helper method to format date
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
}