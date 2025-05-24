import 'package:flutter/material.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';

class MenuHistoryScreen extends StatefulWidget {
  @override
  _MenuHistoryScreenState createState() => _MenuHistoryScreenState();
}

class _MenuHistoryScreenState extends State<MenuHistoryScreen> {
  List<Menu> _menus = [];
  int? _currentMenuId;
  bool _isLoading = true;
  int _userId = 0;
  String _authToken = '';
  Function(Menu)? _onMenuSelected;
  
  // For menu filtering
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    
    // Get arguments passed from MenuScreen
    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>?;
    
    if (args != null) {
      print("MenuHistoryScreen received args: ${args.keys.toList()}");
      
      // Parse menus - handle both List<Menu> and List<dynamic>
      if (args['menus'] != null) {
        if (args['menus'] is List<Menu>) {
          _menus = args['menus'] as List<Menu>;
          print("Received ${_menus.length} menus as List<Menu>");
        } else if (args['menus'] is List) {
          final dynamicList = args['menus'] as List;
          print("Received list with ${dynamicList.length} items, converting to menus");
          
          // Process each item in the list, attempt to convert to Menu objects
          for (var i = 0; i < dynamicList.length; i++) {
            var item = dynamicList[i];
            if (item is Menu) {
              _menus.add(item);
              print("Added item ${i+1} which is already a Menu");
            } else if (item is Map<String, dynamic>) {
              try {
                // Try to convert Map to Menu
                final menu = Menu.fromJson(item);
                _menus.add(menu);
                print("Converted item ${i+1} from Map to Menu");
              } catch (e) {
                print("Error converting item ${i+1} to Menu: $e");
              }
            } else {
              print("Item ${i+1} is not a Menu or Map: ${item.runtimeType}");
            }
          }
          print("Successfully added ${_menus.length} menus from ${dynamicList.length} items");
        }
      }
      
      _currentMenuId = args['currentMenuId'] as int?;
      print("Current menu ID: $_currentMenuId");
      
      // Get userId and authToken
      if (args.containsKey('userId')) {
        _userId = args['userId'] as int? ?? 0;
        print("User ID: $_userId");
      }
      
      if (args.containsKey('authToken')) {
        _authToken = args['authToken'] as String? ?? '';
        print("Auth token available: ${_authToken.isNotEmpty}");
      }
      
      // Get callback function
      if (args.containsKey('onMenuSelected')) {
        _onMenuSelected = args['onMenuSelected'] as Function(Menu)?;
        print("onMenuSelected callback received: ${_onMenuSelected != null}");
      }
      
      // If we already have menus passed, no need to load them
      // Always fetch from API if we have userId and token
      if (_userId > 0 && _authToken.isNotEmpty) {
        print("Fetching menus from API to ensure we get all menus");
        _fetchMenus();
      } else if (_menus.isNotEmpty) {
        // Use passed menus as fallback if API fetch isn't possible
        print("Using ${_menus.length} menus passed in arguments as fallback");
        setState(() => _isLoading = false);
      } else {
        print("No menus passed and missing userId or authToken, can't fetch menus");
        setState(() => _isLoading = false);
      }
    } else {
      print("No arguments passed to MenuHistoryScreen");
      setState(() => _isLoading = false);
    }
  }
  
  // Fetch menus from API
  Future<void> _fetchMenus() async {
    if (_userId == 0 || _authToken.isEmpty) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Missing user ID or auth token"))
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final result = await ApiService.getSavedMenus(_userId, _authToken);
      print("Got result from getSavedMenus: ${result != null ? 'data with keys: ${result.keys.toList()}' : 'null'}");
      
      if (result != null) {
        List<Menu> fetchedMenus = [];
        List<dynamic> menuDataItems = [];
        
        // Extract menu data from various possible formats
        // First check for 'menus' key which is most common
        if (result.containsKey('menus') && result['menus'] is List) {
          menuDataItems = result['menus'] as List<dynamic>;
          print("Found ${menuDataItems.length} menus in 'menus' key");
        } 
        // Check for data key which is sometimes used
        else if (result.containsKey('data') && result['data'] is List) {
          menuDataItems = result['data'] as List<dynamic>;
          print("Found ${menuDataItems.length} menus in 'data' key");
        } 
        // Check if result itself is a list
        else if (result is List) {
          menuDataItems = result as List<dynamic>;
          print("Result is directly a list with ${menuDataItems.length} items");
        } 
        // Check if it's a single menu
        else if (result.containsKey('menu') && result['menu'] is Map) {
          menuDataItems = [result['menu']];
          print("Found single menu in 'menu' key");
        } 
        // Check if result itself is a single menu
        else if (result.containsKey('id') || result.containsKey('menu_id') || 
                 result.containsKey('meal_plan') || result.containsKey('days')) {
          menuDataItems = [result];
          print("Result appears to be a single menu object");
        } 
        // Last resort - search for any lists or maps that might be menus
        else {
          print("No standard menu format found, searching for potential menus in ${result.keys.length} keys");
          for (var key in result.keys) {
            var value = result[key];
            if (value is List && value.isNotEmpty) {
              print("Found list in key '$key' with ${value.length} items - treating as menu list");
              menuDataItems = value as List<dynamic>;
              break;
            } else if (value is Map<String, dynamic> && 
                      (value.containsKey('id') || value.containsKey('menu_id') || 
                       value.containsKey('meal_plan') || value.containsKey('days'))) {
              print("Found potential menu in key '$key'");
              menuDataItems = [value];
              break;
            }
          }
        }
        
        // Process each menu item
        print("Processing ${menuDataItems.length} menu items");
        for (var i = 0; i < menuDataItems.length; i++) {
          try {
            var menuItem = menuDataItems[i];
            if (menuItem is Map<String, dynamic>) {
              print("Converting menu ${i+1}/${menuDataItems.length} to Menu object");
              final menu = Menu.fromJson(menuItem);
              if (menu.days.isNotEmpty) {
                bool hasMeals = false;
                for (var day in menu.days) {
                  if (day.meals.isNotEmpty) {
                    hasMeals = true;
                    break;
                  }
                }
                
                if (hasMeals) {
                  fetchedMenus.add(menu);
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
          }
        }
        
        // Sort by created date (newest first)
        fetchedMenus.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        
        print("Found ${fetchedMenus.length} valid menus out of ${menuDataItems.length} items");
        
        setState(() {
          _menus = fetchedMenus;
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to fetch menus"))
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error: $e"))
      );
      print("Error fetching menus: $e");
    }
  }
  
  @override
  Widget build(BuildContext context) {
    // Filter menus based on search query
    final filteredMenus = _searchQuery.isEmpty 
      ? _menus 
      : _menus.where((menu) => 
          menu.title.toLowerCase().contains(_searchQuery.toLowerCase())).toList();
    
    return Scaffold(
      appBar: AppBar(
        title: Text("Menu History"),
        actions: [
          // Add refresh button that's more prominent
          TextButton.icon(
            icon: Icon(Icons.refresh, color: Colors.white),
            label: Text("Refresh", style: TextStyle(color: Colors.white)),
            onPressed: _fetchMenus,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search box
          Padding(
            padding: EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: "Search menus...",
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                contentPadding: EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              ),
              onChanged: (value) {
                setState(() => _searchQuery = value);
              },
            ),
          ),
          
          // Menu count
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(
                  "${filteredMenus.length} ${filteredMenus.length == 1 ? 'menu' : 'menus'} found",
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.grey[700],
                  ),
                ),
                Spacer(),
                if (_searchQuery.isNotEmpty)
                  TextButton.icon(
                    icon: Icon(Icons.clear, size: 16),
                    label: Text("Clear"),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  ),
              ],
            ),
          ),
          
          // Menu list
          Expanded(
            child: _isLoading 
            ? Center(child: CircularProgressIndicator())
            : filteredMenus.isEmpty 
              ? _buildEmptyView()
              : ListView.builder(
                  itemCount: filteredMenus.length,
                  itemBuilder: (context, index) {
                    final menu = filteredMenus[index];
                    final isCurrentMenu = menu.id == _currentMenuId;
                    
                    return Card(
                      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      elevation: isCurrentMenu ? 4 : 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: isCurrentMenu ? Theme.of(context).primaryColor : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: InkWell(
                        onTap: () {
                          // Return the selected menu to the previous screen
                          if (_onMenuSelected != null) {
                            _onMenuSelected!(menu);
                          }
                          Navigator.pop(context);
                        },
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      menu.title,
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: isCurrentMenu ? Theme.of(context).primaryColor : null,
                                      ),
                                    ),
                                  ),
                                  if (isCurrentMenu)
                                    Container(
                                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: Theme.of(context).primaryColor,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        "Current",
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              SizedBox(height: 8),
                              Row(
                                children: [
                                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                                  SizedBox(width: 4),
                                  Text(
                                    "Created: ${_formatDate(menu.createdAt)}",
                                    style: TextStyle(color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                              SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.restaurant_menu, size: 14, color: Colors.grey[600]),
                                  SizedBox(width: 4),
                                  Text(
                                    "${menu.days.length} days",
                                    style: TextStyle(color: Colors.grey[600]),
                                  ),
                                  SizedBox(width: 12),
                                  Icon(Icons.food_bank, size: 14, color: Colors.grey[600]),
                                  SizedBox(width: 4),
                                  Text(
                                    "${_getTotalMealsCount(menu)} meals",
                                    style: TextStyle(color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                              if (menu.days.isNotEmpty) ...[
                                SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: _getUniqueMealTypes(menu).map((type) {
                                    return Container(
                                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: _getMealChipColor(type),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _formatMealType(type),
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
          ),
        ],
      ),
    );
  }
  
  // Helper method to get a list of all unique meal types in a menu
  List<String> _getUniqueMealTypes(Menu menu) {
    Set<String> mealTypes = {};
    for (var day in menu.days) {
      mealTypes.addAll(day.meals.keys);
    }
    return mealTypes.toList();
  }
  
  // Get a color for a meal type chip
  Color _getMealChipColor(String mealType) {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return Colors.orange;
      case 'lunch':
        return Colors.green;
      case 'dinner':
        return Colors.blue;
      case 'snack':
      case 'snack1':
      case 'snack2':
      case 'snack3':
        return Colors.purple;
      default:
        return Colors.grey;
    }
  }
  
  // Format a meal type for display
  String _formatMealType(String mealType) {
    return mealType.substring(0, 1).toUpperCase() + mealType.substring(1);
  }
  
  // Format date
  String _formatDate(DateTime date) {
    return "${date.month}/${date.day}/${date.year}";
  }
  
  // Count total meals in a menu
  int _getTotalMealsCount(Menu menu) {
    int count = 0;
    for (var day in menu.days) {
      count += day.meals.length;
    }
    return count;
  }
  
  // Empty view when no menus are found
  Widget _buildEmptyView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history_toggle_off, size: 80, color: Colors.grey[400]),
          SizedBox(height: 16),
          Text(
            "No menus found",
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.grey[700],
            ),
          ),
          SizedBox(height: 8),
          Text(
            _searchQuery.isEmpty
              ? "Generate a menu to get started"
              : "Try a different search term",
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[600],
            ),
          ),
          SizedBox(height: 24),
          if (_searchQuery.isNotEmpty)
            ElevatedButton.icon(
              icon: Icon(Icons.clear),
              label: Text("Clear Search"),
              onPressed: () {
                _searchController.clear();
                setState(() => _searchQuery = '');
              },
            )
          else
            ElevatedButton.icon(
              icon: Icon(Icons.refresh),
              label: Text("Refresh"),
              onPressed: _fetchMenus,
            ),
        ],
      ),
    );
  }
}