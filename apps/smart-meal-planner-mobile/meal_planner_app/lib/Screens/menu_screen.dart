import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../models/menu_model.dart';
import '../Providers/auth_providers.dart';

class MenuScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  MenuScreen({required this.userId, required this.authToken});

  @override
  _MenuScreenState createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  bool _isLoading = true;
  Menu? _currentMenu;
  List<Menu> _savedMenus = [];
  bool _isTrainer = false;
  
  // Example meal types for new menu generation
  List<String> mealTypes = ["breakfast", "lunch", "dinner"];

  @override
  void initState() {
    super.initState();
    _checkUserType(); // Check if the user is a trainer
    _fetchSavedMenus(); // First try to load existing menus
  }
  
  // Check if the user is a trainer to show organization management
  Future<void> _checkUserType() async {
    try {
      final result = await ApiService.getUserAccountInfo(widget.authToken);
      if (result != null) {
        final accountType = result['account_type'] ?? 
                           result['user']?['account_type'] ?? 
                           'individual';
        setState(() {
          _isTrainer = accountType.toString().toLowerCase() == 'organization' || 
                       accountType.toString().toLowerCase() == 'trainer';
        });
        print("User is ${_isTrainer ? 'a trainer' : 'not a trainer'} (account type: $accountType)");
      }
    } catch (e) {
      print("Error checking user type: $e");
    }
  }
  
  // Fetch user's saved menus
  Future<void> _fetchSavedMenus() async {
    setState(() => _isLoading = true);
    print("============== FETCHING SAVED MENUS ==============");
    print("User ID: ${widget.userId}, Auth Token available: ${widget.authToken.isNotEmpty}");
    
    try {
      // Check if we have a valid auth token
      if (widget.authToken.isEmpty) {
        print("ERROR: No auth token available. Redirecting to login");
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Authentication required. Please log in again."))
        );
        
        // Logout and redirect to login
        Future.delayed(Duration(seconds: 1), () {
          Provider.of<AuthProvider>(context, listen: false).logout();
          Navigator.of(context).pushReplacementNamed('/login');
        });
        return;
      }
      
      print("Calling getSavedMenus API...");
      final result = await ApiService.getSavedMenus(widget.userId, widget.authToken);
      
      // API call complete, process the result
      if (result != null) {
        print("API Response received with keys: ${result.keys.toList()}");
        
        // Parse and process menus
        List<Menu> parsedMenus = [];
        
        // Extract menu data from various possible formats
        List<dynamic> menuDataItems = [];
        
        // Handle different API response formats
        if (result.containsKey('menus') && result['menus'] is List) {
          // Format: { "menus": [menu1, menu2, ...] }
          menuDataItems = result['menus'] as List<dynamic>;
          print("Found menus list in 'menus' key with ${menuDataItems.length} items");
        } else if (result.containsKey('data') && result['data'] is List) {
          // Format: { "data": [menu1, menu2, ...] }
          menuDataItems = result['data'] as List<dynamic>;
          print("Found menus list in 'data' key with ${menuDataItems.length} items");
        } else if (result is List) {
          // Format: [menu1, menu2, ...]
          menuDataItems = result as List<dynamic>;
          print("Result is directly a list with ${menuDataItems.length} items");
        } else if (result.containsKey('menu') && result['menu'] is Map) {
          // Format: { "menu": {...} } (single menu)
          menuDataItems = [result['menu']];
          print("Found single menu in 'menu' key");
        } else if (result.containsKey('id') || result.containsKey('menu_id')) {
          // The result itself might be a single menu
          menuDataItems = [result];
          print("Result appears to be a single menu object");
        } else {
          // Search for any potential menu data
          for (var key in result.keys) {
            var value = result[key];
            if (value is List && value.isNotEmpty) {
              // Found a list, might be a list of menus
              menuDataItems = value as List<dynamic>;
              print("Found potential menus list in '$key' with ${menuDataItems.length} items");
              break;
            } else if (value is Map<String, dynamic> && 
                      (value.containsKey('id') || value.containsKey('menu_id') || 
                       value.containsKey('meal_plan') || value.containsKey('days'))) {
              // Found what looks like a menu object
              menuDataItems = [value];
              print("Found potential single menu in '$key'");
              break;
            }
          }
        }
        
        // Process each menu item found
        if (menuDataItems.isNotEmpty) {
          print("Processing ${menuDataItems.length} menu items");
          
          for (int i = 0; i < menuDataItems.length; i++) {
            try {
              dynamic menuItem = menuDataItems[i];
              
              if (menuItem is Map<String, dynamic>) {
                print("Parsing menu ${i+1}/${menuDataItems.length} with keys: ${menuItem.keys.toList()}");
                
                // Try to parse as Menu object
                final menu = Menu.fromJson(menuItem);
                
                // Only add if it has valid content (days with meals)
                if (menu.days.isNotEmpty) {
                  bool hasMeals = false;
                  for (var day in menu.days) {
                    if (day.meals.isNotEmpty) {
                      hasMeals = true;
                      break;
                    }
                  }
                  
                  if (hasMeals) {
                    parsedMenus.add(menu);
                    print("Successfully added menu with ID ${menu.id} (${menu.days.length} days)");
                  } else {
                    print("Skipping menu with ID ${menu.id} because it has no meals");
                  }
                } else {
                  print("Skipping menu with ID ${menu.id} because it has no days");
                }
              } else {
                print("Menu item ${i+1} is not a Map, but a ${menuItem.runtimeType} - skipping");
              }
            } catch (e) {
              print("ERROR parsing menu ${i+1}: $e");
              // Continue trying to parse other menus
            }
          }
        } else {
          print("No menu data found in the API response");
        }
        
        // Update state with parsed menus
        setState(() {
          _isLoading = false;
          _savedMenus = parsedMenus;
          
          // Sort menus by created date (newest first)
          _savedMenus.sort((a, b) => b.createdAt.compareTo(a.createdAt));
          
          if (_savedMenus.isNotEmpty) {
            _currentMenu = _savedMenus.first;
            print("Set current menu to '${_currentMenu!.title}' with ID ${_currentMenu!.id}");
            
            // Print summary of the current menu for debugging
            print("Current menu has ${_currentMenu!.days.length} days:");
            for (var day in _currentMenu!.days) {
              print("- Day ${day.dayNumber} (${day.dayName}): ${day.meals.length} meals");
              print("  Meal types: ${day.meals.keys.toList()}");
            }
          } else {
            _currentMenu = null;
            print("No valid menus found");
          }
        });
      } else {
        print("API returned null result");
        setState(() {
          _isLoading = false;
          _savedMenus = [];
          _currentMenu = null;
        });
      }
    } catch (e) {
      print("ERROR fetching saved menus: $e");
      setState(() => _isLoading = false);
      
      // Show error and provide option to generate a new menu
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Couldn't load saved menus. Try generating a new one."),
          action: SnackBarAction(
            label: 'Generate',
            onPressed: _generateMenu,
          ),
          duration: Duration(seconds: 6),
        )
      );
    }
    print("============== END FETCH SAVED MENUS ==============");
  }

  // Save current menu
  Future<void> _saveCurrentMenu() async {
    // Make sure we have a menu to save
    if (_currentMenu == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("No menu to save"),
          duration: Duration(seconds: 2),
        )
      );
      return;
    }
    
    // Show loading indicator
    setState(() => _isLoading = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("Saving menu..."),
        duration: Duration(seconds: 1),
      )
    );
    
    try {
      // Prepare menu data for saving
      Map<String, dynamic> menuData = {
        'user_id': widget.userId,
        'title': _currentMenu!.title,
        'meal_plan': {
          'days': _currentMenu!.days.map((day) {
            return {
              'dayNumber': day.dayNumber,
              'dayName': day.dayName,
              'meals': day.meals.map((type, meal) {
                return MapEntry(type, {
                  'name': meal.name,
                  'description': meal.description,
                  'ingredients': meal.ingredients,
                  'instructions': meal.instructions,
                  'macros': meal.macros,
                  'imageUrl': meal.imageUrl,
                });
              }),
            };
          }).toList(),
        }
      };
      
      // Call API to save menu
      final result = await ApiService.saveMenu(
        userId: widget.userId,
        authToken: widget.authToken,
        menuData: menuData,
      );
      
      setState(() => _isLoading = false);
      
      if (result != null) {
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Menu saved successfully"),
            duration: Duration(seconds: 2),
          )
        );
        
        // Refresh saved menus to include the newly saved menu
        _fetchSavedMenus();
      } else {
        // Show error message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Failed to save menu"),
            duration: Duration(seconds: 2),
          )
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      
      // Show error message
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error saving menu: $e"),
          duration: Duration(seconds: 3),
        )
      );
      print("Error saving menu: $e");
    }
  }
  
  // Show model selection dialog and then generate menu
  Future<void> _generateMenu() async {
    print("Starting menu generation process");
    
    // Check if we have a valid auth token
    if (widget.authToken.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Authentication required. Please log in again."))
      );
      // Redirect to login
      Provider.of<AuthProvider>(context, listen: false).logout();
      Navigator.of(context).pushReplacementNamed('/login');
      return;
    }
    
    // First check AI model status to see what models are available
    try {
      final modelStatus = await ApiService.getAIModelStatus();
      print("AI model status: $modelStatus");
      
      if (modelStatus != null && modelStatus.containsKey('isAvailable') && modelStatus['isAvailable'] == false) {
        // AI is not available, show message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(modelStatus['message'] ?? "AI model is currently unavailable for menu generation."),
            duration: Duration(seconds: 5),
          )
        );
        return;
      }
    } catch (e) {
      print("Error checking AI model status: $e");
      // Continue anyway, the model selection dialog will still show
    }
    
    // Show model selection dialog
    String? selectedModel = await _showModelSelectionDialog();
    
    print("Selected model: ${selectedModel ?? 'cancelled'}");
    
    if (selectedModel == null) {
      // User cancelled the dialog
      print("Menu generation cancelled by user");
      return;
    }
    
    // Make sure we have a valid model selection
    if (selectedModel.isEmpty) {
      selectedModel = 'default';
    }
    
    // Show loading indicator
    setState(() => _isLoading = true);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("Generating menu with $selectedModel model..."),
        duration: Duration(seconds: 2),
      )
    );
    
    try {
      print("Generating menu with model: $selectedModel");
      final result = await ApiService.generateMenu(
        userId: widget.userId,
        authToken: widget.authToken,
        menuParameters: {
          'meal_types': mealTypes,
          'duration_days': 7,
          'model': selectedModel,
        },
      );

      setState(() {
        _isLoading = false;
        if (result != null) {
          print("Menu generation response keys: ${result.keys.toList()}");
          
          try {
            // Parse the menu using our improved Menu.fromJson method
            final newMenu = Menu.fromJson(result);
            
            // Only consider the menu valid if it has days with meals
            if (newMenu.days.isNotEmpty) {
              bool hasMeals = false;
              for (var day in newMenu.days) {
                if (day.meals.isNotEmpty) {
                  hasMeals = true;
                  break;
                }
              }
              
              if (hasMeals) {
                _currentMenu = newMenu;
                // Add to saved menus if not already there
                final existingMenuIndex = _savedMenus.indexWhere((menu) => menu.id == newMenu.id);
                if (existingMenuIndex >= 0) {
                  // Replace existing menu
                  _savedMenus[existingMenuIndex] = newMenu;
                } else {
                  // Add as new menu at the beginning
                  _savedMenus = [newMenu, ..._savedMenus];
                }
                
                print("Successfully generated menu with ${newMenu.days.length} days and meals");
                
                // Show success message
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("Menu generated successfully"))
                );
              } else {
                throw Exception("Generated menu has days but no meals");
              }
            } else {
              throw Exception("Generated menu has no days");
            }
          } catch (e) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("Error parsing menu: $e"),
                duration: Duration(seconds: 5),
              )
            );
            print("Error parsing generated menu: $e");
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Failed to generate menu: Empty response"),
              duration: Duration(seconds: 5),
            )
          );
        }
      });
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Failed to generate menu: $e"),
          duration: Duration(seconds: 5),
        )
      );
      print("Exception generating menu: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // Use Builder to get the correct context for the Scaffold
        leading: Builder(
          builder: (context) => IconButton(
            icon: Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        // Add logo in the title area with menu name
        title: Row(
          children: [
            // App icon
            Padding(
              padding: EdgeInsets.only(right: 12.0),
              child: Icon(
                Icons.restaurant_menu,
                size: 30,
                color: Colors.white,
              ),
            ),
            // Menu title
            Expanded(
              child: _currentMenu != null 
                ? Text(_currentMenu!.title, overflow: TextOverflow.ellipsis)
                : Text("My Meal Plan"),
            ),
          ],
        ),
        actions: [
          // Only show history button if we have more than 1 saved menu
          if (_savedMenus.length > 1)
            IconButton(
              icon: Icon(Icons.history),
              onPressed: () => Navigator.pushNamed(context, '/menu-history', arguments: {
                'menus': _savedMenus,
                'currentMenuId': _currentMenu?.id,
                'userId': widget.userId,
                'authToken': widget.authToken,
                'onMenuSelected': (Menu selectedMenu) {
                  setState(() => _currentMenu = selectedMenu);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Switched to menu: ${selectedMenu.title}')),
                  );
                },
              }),
              tooltip: "Menu History",
            ),
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _generateMenu,
            tooltip: "Generate New Menu",
          ),
        ],
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Smart Meal Planner',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Welcome back',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            
            // MEALS SECTION
            Padding(
              padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
              child: Text(
                "MEALS",
                style: TextStyle(
                  color: Colors.grey[600],
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            ListTile(
              leading: Icon(Icons.home),
              title: Text('Home'),
              selected: true,
              onTap: () {
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: Icon(Icons.restaurant_menu),
              title: Text('Current Menu'),
              onTap: () {
                Navigator.pop(context);
              },
            ),
            ListTile(
              leading: Icon(Icons.add_circle_outline),
              title: Text('Generate New Menu'),
              onTap: () {
                Navigator.pop(context);
                _generateMenu();
              },
            ),
            if (_currentMenu != null)
              ListTile(
                leading: Icon(Icons.save),
                title: Text('Save Current Menu'),
                onTap: () {
                  Navigator.pop(context);
                  _saveCurrentMenu();
                },
              ),
            ListTile(
              leading: Icon(Icons.favorite),
              title: Text('Saved Recipes'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/saved-recipes');
              },
            ),
            ListTile(
              leading: Icon(Icons.search),
              title: Text('Recipe Browser'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/recipe-browser');
              },
            ),
            ListTile(
              leading: Icon(Icons.construction),
              title: Text('Custom Menu Builder'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/custom-menu');
              },
            ),
            
            Divider(),
            
            // SHOPPING SECTION
            Padding(
              padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
              child: Text(
                "SHOPPING",
                style: TextStyle(
                  color: Colors.grey[600],
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            ListTile(
              leading: Icon(Icons.format_list_bulleted),
              title: Text('Shopping List'),
              onTap: () {
                Navigator.pop(context);
                // Navigate to shopping list with current menu id
                if (_currentMenu != null) {
                  Navigator.pushNamed(
                    context, 
                    '/shopping-list',
                    arguments: {
                      'userId': widget.userId,
                      'authToken': widget.authToken,
                      'menuId': _currentMenu!.id,
                      'menuTitle': _currentMenu!.title,
                    },
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("No menu available. Generate a menu first."))
                  );
                }
              },
            ),
            ListTile(
              leading: Icon(Icons.shopping_cart),
              title: Text('My Carts'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(
                  context, 
                  '/carts',
                  arguments: {
                    'userId': widget.userId,
                    'authToken': widget.authToken,
                  },
                );
              },
            ),
            ListTile(
              leading: Icon(Icons.compare_arrows),
              title: Text('Compare Stores'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/compare');
              },
            ),
            ListTile(
              leading: Icon(Icons.receipt_long),
              title: Text('Order History'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/order-history');
              },
            ),
            
            Divider(),
            
            // ACCOUNT SECTION
            Padding(
              padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
              child: Text(
                "ACCOUNT",
                style: TextStyle(
                  color: Colors.grey[600],
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            ListTile(
              leading: Icon(Icons.person),
              title: Text('Profile'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/profile');
              },
            ),
            ListTile(
              leading: Icon(Icons.settings),
              title: Text('Preferences'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/preferences');
              },
            ),
            
            // Only show Organization Management for trainers
            if (_isTrainer)
              ListTile(
                leading: Icon(Icons.business),
                title: Text('Organization'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.pushNamed(context, '/organization');
                },
              ),
            
            // Add Menu History section if we have saved menus
            if (_savedMenus.isNotEmpty) ...[
              Divider(),
              
              Padding(
                padding: EdgeInsets.only(left: 16, top: 8, bottom: 8),
                child: Text(
                  "MENU HISTORY",
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              
              // Current menu indicator
              if (_currentMenu != null)
                ListTile(
                  leading: Icon(Icons.restaurant_menu, color: Theme.of(context).primaryColor),
                  title: Text('Current Menu', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(_currentMenu!.title),
                  trailing: Text(_formatDate(_currentMenu!.createdAt)),
                ),
              
              // Menu History button - navigates to menu history page
              ListTile(
                leading: Icon(Icons.history),
                title: Text('View Previous Menus'),
                trailing: Text('${_savedMenus.length} saved'),
                onTap: () {
                  Navigator.pop(context); // Close drawer
                  Navigator.pushNamed(context, '/menu-history', arguments: {
                    'menus': _savedMenus,
                    'currentMenuId': _currentMenu?.id,
                    'userId': widget.userId,
                    'authToken': widget.authToken,
                    'onMenuSelected': (Menu selectedMenu) {
                      setState(() => _currentMenu = selectedMenu);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Switched to menu: ${selectedMenu.title}')),
                      );
                    },
                  });
                },
              ),
            ],
            
            Divider(),
            
            ListTile(
              leading: Icon(Icons.logout, color: Colors.red),
              title: Text('Logout', style: TextStyle(color: Colors.red)),
              onTap: () {
                // Show confirmation dialog
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text('Logout'),
                    content: Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        child: Text('CANCEL'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.of(ctx).pop();
                          // Logout and navigate to login screen
                          Provider.of<AuthProvider>(context, listen: false).logout();
                          Navigator.of(context).pushReplacementNamed('/login');
                        },
                        child: Text('LOGOUT'),
                        style: TextButton.styleFrom(foregroundColor: Colors.red),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
      body: _isLoading 
        ? Center(child: CircularProgressIndicator())
        : _currentMenu == null
          ? _buildNoMenuView()
          : _buildMenuView(),
      floatingActionButton: FloatingActionButton(
        onPressed: _generateMenu,
        tooltip: 'Generate Menu',
        child: Icon(Icons.add),
      ),
    );
  }
  
  // Format date to a readable string
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
  
  // Show model selection dialog and return the selected model
  Future<String?> _showModelSelectionDialog() async {
    String selectedModel = 'default';
    bool wasCancelled = false;
    
    // Try to get available models from API (if possible)
    List<Map<String, String>> models = [
      {
        'id': 'default',
        'name': 'Standard',
        'description': 'Default menu generation without customization',
        'icon': 'restaurant',
      },
      {
        'id': 'enhanced',
        'name': 'Enhanced',
        'description': 'Better recipe variety and customization',
        'icon': 'restaurant_menu',
      },
      {
        'id': 'hybrid',
        'name': 'Hybrid',
        'description': 'Combines standard and enhanced features for balanced results',
        'icon': 'auto_awesome',
      },
      {
        'id': 'local',
        'name': 'Locally Trained',
        'description': 'Uses locally trained model for personalized results',
        'icon': 'person',
      },
    ];
    
    // Show dialog with model options
    await showDialog(
      context: context,
      barrierDismissible: true, // Allow dismissing by tapping outside
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Row(
                children: [
                  Icon(Icons.model_training, color: Theme.of(context).primaryColor),
                  SizedBox(width: 8),
                  Text('Select AI Model'),
                ],
              ),
              content: Container(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Choose the AI model to use for recipe generation:',
                      style: TextStyle(fontSize: 16),
                    ),
                    SizedBox(height: 16),
                    Expanded(
                      child: SingleChildScrollView(
                        child: Column(
                          children: models.map((model) => _buildModelCard(
                            context,
                            model['id']!,
                            model['name']!,
                            model['description']!,
                            model['icon']!,
                            selectedModel,
                            (value) => setState(() => selectedModel = value),
                          )).toList(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    wasCancelled = true;
                    Navigator.of(context).pop();
                  },
                  child: Text('Cancel'),
                ),
                ElevatedButton.icon(
                  icon: Icon(Icons.auto_awesome_motion),
                  label: Text('Generate Menu'),
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
    
    return wasCancelled ? null : selectedModel;
  }
  
  // Helper method to build a nice model card in the dialog
  Widget _buildModelCard(
    BuildContext context,
    String value, 
    String title, 
    String description,
    String iconName,
    String groupValue,
    Function(String) onChanged,
  ) {
    // Convert icon name to IconData
    IconData getIconData(String name) {
      switch (name) {
        case 'restaurant': return Icons.restaurant;
        case 'restaurant_menu': return Icons.restaurant_menu;
        case 'auto_awesome': return Icons.auto_awesome;
        case 'person': return Icons.person;
        default: return Icons.food_bank;
      }
    }
    
    final isSelected = value == groupValue;
    
    return Card(
      margin: EdgeInsets.only(bottom: 12),
      elevation: isSelected ? 4 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isSelected ? Theme.of(context).primaryColor : Colors.transparent,
          width: 2,
        ),
      ),
      child: InkWell(
        onTap: () => onChanged(value),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isSelected 
                    ? Theme.of(context).primaryColor 
                    : Theme.of(context).primaryColor.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  getIconData(iconName),
                  color: isSelected ? Colors.white : Theme.of(context).primaryColor,
                  size: 24,
                ),
              ),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Theme.of(context).primaryColor : null,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              Radio<String>(
                value: value,
                groupValue: groupValue,
                onChanged: (newValue) => onChanged(newValue!),
                activeColor: Theme.of(context).primaryColor,
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  // Build the view when no menu is available
  Widget _buildNoMenuView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.restaurant_menu, size: 80, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "No meal plan found",
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "Generate a new meal plan to get started",
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.add),
            label: Text("Generate Menu"),
            onPressed: _generateMenu,
          ),
        ],
      ),
    );
  }
  
  // Build the menu view with real data
  Widget _buildMenuView() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Menu Selection Button - Prominent and always visible
          Container(
            margin: EdgeInsets.only(bottom: 16),
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: Icon(Icons.history),
              label: Text(_savedMenus.length > 1 
                ? "Select from ${_savedMenus.length} saved menus" 
                : "Menu History"),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 12),
                textStyle: TextStyle(fontSize: 16),
              ),
              onPressed: () {
                // Show bottom sheet with menu options
                _showMenuSelectionBottomSheet();
              },
            ),
          ),
          
          // Menu Title and Date
          Text(
            _currentMenu!.title,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 4),
          Row(
            children: [
              Text(
                "Created: ${_formatDate(_currentMenu!.createdAt)}",
                style: TextStyle(color: Colors.grey[700], fontSize: 14),
              ),
              Spacer(),
              Text(
                "${_currentMenu!.days.length} days, ${_getTotalMealsCount(_currentMenu!)} meals",
                style: TextStyle(color: Colors.grey[700], fontSize: 14),
              ),
            ],
          ),
          SizedBox(height: 16),
          // Display days from actual menu data
          ..._currentMenu!.days.map((day) => _buildDaySection(day)).toList(),
        ],
      ),
    );
  }
  
  // Build day section with real data
  Widget _buildDaySection(MenuDay day) {
    return Card(
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  day.dayName,
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                Spacer(),
                Text(
                  "Day ${day.dayNumber}",
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
            Divider(),
            // Display each meal for this day
            ...day.meals.entries.map((entry) {
              final mealType = entry.key;
              final meal = entry.value;
              return _buildMealTile(mealType, meal);
            }).toList(),
          ],
        ),
      ),
    );
  }
  
  // Build meal tile with real data
  Widget _buildMealTile(String mealType, MenuItem meal) {
    // Capitalize first letter of meal type
    final displayType = mealType.substring(0, 1).toUpperCase() + mealType.substring(1);
    
    return ListTile(
      leading: Icon(_getMealIcon(mealType)),
      title: Text(meal.name),
      subtitle: Text(displayType),
      trailing: Icon(Icons.chevron_right),
      onTap: () {
        // Would open recipe details
        _showRecipeDetails(meal);
      },
    );
  }
  
  // Show recipe details in a modal bottom sheet
  void _showRecipeDetails(MenuItem meal) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      margin: EdgeInsets.only(bottom: 16),
                    ),
                  ),
                  Text(
                    meal.name,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  if (meal.description != null) ...[
                    SizedBox(height: 8),
                    Text(
                      meal.description!,
                      style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                    ),
                  ],
                  if (meal.imageUrl != null) ...[
                    SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        meal.imageUrl!,
                        height: 200,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            height: 200,
                            color: Colors.grey[200],
                            child: Center(
                              child: Icon(Icons.image_not_supported, size: 50, color: Colors.grey),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                  if (meal.macros != null) ...[
                    SizedBox(height: 16),
                    Text(
                      "Nutrition",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    _buildMacrosGrid(meal.macros!),
                  ],
                  if (meal.ingredients != null && meal.ingredients!.isNotEmpty) ...[
                    SizedBox(height: 16),
                    Text(
                      "Ingredients",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    ...meal.ingredients!.map((ingredient) {
                      return Padding(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("• ", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            Expanded(
                              child: Text(
                                ingredient,
                                style: TextStyle(fontSize: 16),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ],
                  if (meal.instructions != null && meal.instructions!.isNotEmpty) ...[
                    SizedBox(height: 16),
                    Text(
                      "Instructions",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    ...meal.instructions!.asMap().entries.map((entry) {
                      final index = entry.key;
                      final instruction = entry.value;
                      return Padding(
                        padding: EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 24,
                              height: 24,
                              alignment: Alignment.center,
                              margin: EdgeInsets.only(right: 8, top: 2),
                              decoration: BoxDecoration(
                                color: Theme.of(context).primaryColor,
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                "${index + 1}",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                instruction,
                                style: TextStyle(fontSize: 16),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ],
                  SizedBox(height: 40),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
  
  // Build a grid to display macros
  Widget _buildMacrosGrid(Map<String, dynamic> macros) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      padding: EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              _buildMacroItem("Calories", "${macros['calories'] ?? 'N/A'}", Colors.orange),
              _buildMacroItem("Protein", "${macros['protein'] ?? 'N/A'}g", Colors.red),
            ],
          ),
          SizedBox(height: 8),
          Row(
            children: [
              _buildMacroItem("Carbs", "${macros['carbs'] ?? 'N/A'}g", Colors.green),
              _buildMacroItem("Fat", "${macros['fat'] ?? 'N/A'}g", Colors.blue),
            ],
          ),
        ],
      ),
    );
  }
  
  // Build individual macro display
  Widget _buildMacroItem(String label, String value, Color color) {
    return Expanded(
      child: Row(
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[700],
                ),
              ),
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  // Show menu selection bottom sheet
  void _showMenuSelectionBottomSheet() {
    if (_savedMenus.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("No saved menus available"))
      );
      return;
    }
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return Container(
          padding: EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Icon(Icons.restaurant_menu, color: Theme.of(context).primaryColor),
                  SizedBox(width: 12),
                  Text(
                    "Select Menu",
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Spacer(),
                  Text(
                    "${_savedMenus.length} menus",
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
              SizedBox(height: 12),
              Divider(),
              
              // Menu list - constrained height
              Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.5,
                ),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _savedMenus.length,
                  itemBuilder: (context, index) {
                    final menu = _savedMenus[index];
                    final isSelected = _currentMenu?.id == menu.id;
                    
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: isSelected 
                          ? Theme.of(context).primaryColor 
                          : Theme.of(context).primaryColor.withOpacity(0.1),
                        child: Icon(
                          Icons.restaurant_menu,
                          color: isSelected ? Colors.white : Theme.of(context).primaryColor,
                          size: 20,
                        ),
                      ),
                      title: Text(
                        menu.title,
                        style: TextStyle(
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      subtitle: Text(
                        "Created: ${_formatDate(menu.createdAt)} • ${menu.days.length} days",
                      ),
                      trailing: isSelected 
                        ? Icon(Icons.check_circle, color: Theme.of(context).primaryColor)
                        : Icon(Icons.chevron_right),
                      selected: isSelected,
                      onTap: () {
                        setState(() => _currentMenu = menu);
                        Navigator.pop(context);
                        
                        // Show confirmation
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Switched to: ${menu.title}'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
              SizedBox(height: 8),
              
              // View all button
              if (_savedMenus.length > 5)
                Container(
                  width: double.infinity,
                  child: TextButton.icon(
                    icon: Icon(Icons.history),
                    label: Text("View all menus"),
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, '/menu-history', arguments: {
                        'menus': _savedMenus,
                        'currentMenuId': _currentMenu?.id,
                        'userId': widget.userId,
                        'authToken': widget.authToken,
                        'onMenuSelected': (Menu selectedMenu) {
                          setState(() => _currentMenu = selectedMenu);
                        },
                      });
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // Show menu history bottom sheet
  void _showMenuHistoryBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true, // Makes it larger
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              // Handle bar
              Container(
                width: 40,
                height: 5,
                margin: EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              
              // Header
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.history, color: Theme.of(context).primaryColor),
                    SizedBox(width: 12),
                    Text(
                      'Menu History',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Spacer(),
                    Text(
                      '${_savedMenus.length} menus',
                      style: TextStyle(
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              ),
              
              Divider(),
              
              // Menu list
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  itemCount: _savedMenus.length,
                  itemBuilder: (context, index) {
                    final menu = _savedMenus[index];
                    final isSelected = _currentMenu?.id == menu.id;
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: isSelected 
                          ? Theme.of(context).primaryColor 
                          : Theme.of(context).primaryColor.withOpacity(0.1),
                        child: Icon(
                          Icons.restaurant_menu,
                          color: isSelected ? Colors.white : Theme.of(context).primaryColor,
                        ),
                      ),
                      title: Text(
                        menu.title,
                        style: TextStyle(
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Created: ${_formatDate(menu.createdAt)}'),
                          Text('${menu.days.length} days, ${_getTotalMealsCount(menu)} meals'),
                        ],
                      ),
                      trailing: isSelected 
                        ? Icon(Icons.check_circle, color: Theme.of(context).primaryColor)
                        : Icon(Icons.arrow_forward_ios, size: 16),
                      selected: isSelected,
                      onTap: () {
                        setState(() => _currentMenu = menu);
                        Navigator.pop(context);
                        
                        // Show confirmation
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Switched to menu: ${menu.title}'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
  
  // Helper method to count total meals in a menu
  int _getTotalMealsCount(Menu menu) {
    int count = 0;
    for (var day in menu.days) {
      count += day.meals.length;
    }
    return count;
  }

  // Get icon for meal type
  IconData _getMealIcon(String mealType) {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return Icons.free_breakfast;
      case 'lunch':
        return Icons.lunch_dining;
      case 'dinner':
        return Icons.dinner_dining;
      case 'snack1':
      case 'snack2':
      case 'snack3':
        return Icons.cookie;
      default:
        return Icons.restaurant;
    }
  }
}