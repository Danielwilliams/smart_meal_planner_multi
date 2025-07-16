import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';
import '../Providers/auth_providers.dart';

class RecipeBrowserScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  RecipeBrowserScreen({required this.userId, required this.authToken});

  @override
  _RecipeBrowserScreenState createState() => _RecipeBrowserScreenState();
}

class _RecipeBrowserScreenState extends State<RecipeBrowserScreen> {
  List<Recipe> _recipes = [];
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';
  int _page = 1;
  final int _pageSize = 20;
  bool _hasMoreRecipes = true;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  int _ratingRefreshKey = 0;
  
  // Filter values
  List<String> _selectedCategories = [];
  
  // Available recipe categories
  final List<String> _categories = [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snack',
    'Appetizer',
    'Dessert',
    'Beverage',
    'Side Dish',
    'Salad',
    'Soup',
    'Vegan',
    'Vegetarian',
    'Gluten-Free',
    'Dairy-Free'
  ];

  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchRecipes();
    _scrollController.addListener(_scrollListener);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _scrollListener() {
    if (_scrollController.position.pixels == _scrollController.position.maxScrollExtent) {
      if (!_isLoading && _hasMoreRecipes) {
        _fetchMoreRecipes();
      }
    }
  }

  Future<void> _fetchRecipes({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _page = 1;
        _hasMoreRecipes = true;
      });
    }

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for recipe search");
      }

      if (validToken == null) {
        setState(() {
          _isLoading = false;
          _hasError = true;
          _errorMessage = 'Authentication token is invalid. Please log in again.';
        });
        return;
      }

      final result = await ApiService.searchRecipes(
        userId: widget.userId,
        authToken: validToken,
        query: _searchQuery,
        categories: _selectedCategories.isNotEmpty ? _selectedCategories : null,
        page: _page,
        pageSize: _pageSize,
      );

      // Check if the result contains a token expired error
      if (result is Map &&
          result.containsKey('detail') &&
          (result['detail'] == 'Token has expired' || result['detail'] == 'Could not validate credentials')) {

        print("🔑 Token expired error detected in recipes response");

        // Try to refresh the token
        if (await authProvider.refreshTokenIfNeeded()) {
          // Token refreshed, retry the fetch with the new token
          print("🔄 Token refreshed, retrying recipe search");
          return _fetchRecipes(refresh: refresh);
        } else {
          // Token refresh failed, show login error
          setState(() {
            _isLoading = false;
            _hasError = true;
            _errorMessage = 'Your session has expired. Please log in again.';
          });
          return;
        }
      }

      if (result != null) {
        // Check for different response formats
        List<dynamic> recipesData = [];

        print("API Response Keys: ${result.keys.toList()}");

        // Handle different possible response formats from the backend
        if (result.containsKey('recipes')) {
          // Format: { "recipes": [...] }
          recipesData = result['recipes'] as List<dynamic>;
        } else if (result.containsKey('data') && result['data'] is List) {
          // Format: { "data": [...] }
          recipesData = result['data'] as List<dynamic>;
        } else if (result is List) {
          // Format: Direct array response [...]
          recipesData = result as List<dynamic>;
        } else {
          // Try to parse any iterable values
          for (var key in result.keys) {
            if (result[key] is List && recipesData.isEmpty) {
              recipesData = result[key] as List<dynamic>;
              print("Found recipes in unexpected key: $key");
              break;
            }
          }

          if (recipesData.isEmpty) {
            print("Unable to find recipe data in response: ${result.keys}");
          }
        }

        print("Found ${recipesData.length} recipes in response");

        // Map the recipes with error handling
        List<Recipe> recipes = [];
        for (var recipeJson in recipesData) {
          try {
            recipes.add(Recipe.fromJson(recipeJson));
          } catch (e) {
            print("Error parsing recipe: $e");
            // Continue parsing the rest of the recipes
          }
        }

        setState(() {
          _isLoading = false;
          if (refresh || _page == 1) {
            _recipes = recipes;
          } else {
            _recipes.addAll(recipes);
          }
          _hasMoreRecipes = recipes.length >= _pageSize;
        });
      } else {
        setState(() {
          _isLoading = false;
          _hasError = true;
          _errorMessage = 'Failed to load recipes';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _hasError = true;
        _errorMessage = 'An error occurred: $e';
      });
    }
  }

  Future<void> _fetchMoreRecipes() async {
    _page++;
    await _fetchRecipes();
  }

  void _handleSearch() {
    setState(() {
      _searchQuery = _searchController.text;
    });
    _fetchRecipes(refresh: true);
  }

  void _toggleCategory(String category) {
    setState(() {
      if (_selectedCategories.contains(category)) {
        _selectedCategories.remove(category);
      } else {
        _selectedCategories.add(category);
      }
    });
    _fetchRecipes(refresh: true);
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Filter Recipes'),
        content: Container(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Categories',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _categories.map((category) {
                  final isSelected = _selectedCategories.contains(category);
                  return FilterChip(
                    label: Text(category),
                    selected: isSelected,
                    onSelected: (_) {
                      Navigator.pop(context);
                      _toggleCategory(category);
                    },
                    backgroundColor: Colors.grey[200],
                    selectedColor: Theme.of(context).primaryColor.withOpacity(0.2),
                    checkmarkColor: Theme.of(context).primaryColor,
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
            },
            child: Text('CLOSE'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _selectedCategories = [];
              });
              _fetchRecipes(refresh: true);
            },
            child: Text('CLEAR FILTERS'),
          ),
        ],
      ),
    );
  }

  void _showRecipeDetails(Recipe recipe) async {
    print("Showing recipe details for: ${recipe.title}");
    print("Recipe data: ${recipe.toJson()}");

    // Check if we have complete recipe data
    final hasCompleteData = recipe.ingredients != null && 
                          recipe.ingredients!.isNotEmpty && 
                          recipe.instructions != null && 
                          recipe.instructions!.isNotEmpty;
    
    print("Has complete recipe data: $hasCompleteData");
    print("Ingredients count: ${recipe.ingredients?.length ?? 0}");
    print("Instructions count: ${recipe.instructions?.length ?? 0}");

    Recipe recipeToShow = recipe;

    // If we don't have complete data, try to fetch it
    if (!hasCompleteData) {
      print("Fetching complete recipe details for recipe ID: ${recipe.id}");
      
      try {
        final detailResult = await ApiService.getRecipeDetails(
          userId: widget.userId,
          authToken: widget.authToken,
          recipeId: recipe.id,
        );
        
        if (detailResult != null) {
          print("Got detailed recipe data: ${detailResult.keys}");
          
          // Create a complete recipe object with the detailed data
          // Extract ingredients - check metadata first like the web app does
          List<String>? ingredients;
          if (detailResult['metadata'] != null && detailResult['metadata'] is Map) {
            final metadata = detailResult['metadata'] as Map;
            if (metadata['ingredients_list'] is List) {
              ingredients = (metadata['ingredients_list'] as List).map((e) => e.toString()).toList();
            }
          }
          // Fallback to direct ingredients field
          if (ingredients == null && detailResult['ingredients'] is List) {
            ingredients = (detailResult['ingredients'] as List).map((e) => e.toString()).toList();
          }
          // Final fallback to original recipe data
          if (ingredients == null) {
            ingredients = recipe.ingredients;
          }
          
          List<String>? instructions;
          if (detailResult['instructions'] is List) {
            instructions = (detailResult['instructions'] as List).map((e) => e.toString()).toList();
          } else {
            instructions = recipe.instructions;
          }
          
          // Extract nutrition/macros data like the web app does
          Map<String, dynamic>? macros;
          if (detailResult['metadata'] != null && detailResult['metadata'] is Map) {
            final metadata = detailResult['metadata'] as Map;
            if (metadata['nutrition_per_serving'] is Map) {
              macros = Map<String, dynamic>.from(metadata['nutrition_per_serving']);
            }
          }
          // Fallback to direct macros field
          if (macros == null && detailResult['macros'] is Map) {
            macros = Map<String, dynamic>.from(detailResult['macros']);
          }
          // Final fallback to original recipe data
          if (macros == null) {
            macros = recipe.macros;
          }
          
          recipeToShow = Recipe(
            id: recipe.id,
            title: detailResult['title']?.toString() ?? recipe.title,
            description: detailResult['description']?.toString() ?? recipe.description,
            imageUrl: detailResult['image_url']?.toString() ?? recipe.imageUrl,
            macros: macros,
            ingredients: ingredients,
            instructions: instructions,
            category: detailResult['category']?.toString() ?? recipe.category,
            tags: detailResult['tags'] ?? recipe.tags,
            isSaved: recipe.isSaved,
            rating: detailResult['rating'] ?? recipe.rating,
            prepTime: detailResult['prep_time']?.toString() ?? recipe.prepTime,
            cookTime: detailResult['cook_time']?.toString() ?? recipe.cookTime,
            servings: detailResult['servings'] ?? recipe.servings,
          );
          
          print("Updated recipe with details - ingredients: ${recipeToShow.ingredients?.length}, instructions: ${recipeToShow.instructions?.length}");
        } else {
          print("Failed to fetch detailed recipe data");
        }
      } catch (e) {
        print("Error fetching recipe details: $e");
      }
    }

    // Use a fullscreen dialog instead of bottom sheet for better visibility
    showDialog(
      context: context,
      builder: (context) => Dialog(
        insetPadding: EdgeInsets.all(16),
        child: SafeArea(
          // iOS-specific: respect all safe areas including dynamic island
          top: true,
          bottom: true,
          left: true,
          right: true,
          child: Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
              // App bar with title and close button
              Container(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Theme.of(context).primaryColor,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        recipeToShow.title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),

              // Scrollable content
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Recipe image at the top
                      if (recipeToShow.imageUrl != null && recipeToShow.imageUrl!.isNotEmpty) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            recipeToShow.imageUrl!,
                            height: 200,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              print("Error loading image: $error");
                              return Container(
                                height: 200,
                                color: Colors.grey[200],
                                child: Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.image_not_supported, size: 50, color: Colors.grey),
                                      SizedBox(height: 8),
                                      Text("Image not available", style: TextStyle(color: Colors.grey)),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        SizedBox(height: 16),
                      ],

                      // Category, rating, and save button
                      Row(
                        children: [
                          if (recipeToShow.category != null) ...[
                            Chip(
                              label: Text(recipeToShow.category!),
                              backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                              labelStyle: TextStyle(color: Theme.of(context).primaryColor),
                            ),
                            SizedBox(width: 8),
                          ],
                          
                          // Rating display
                          _buildRatingSection(recipeToShow),
                          
                          Spacer(),
                          
                          IconButton(
                            icon: Icon(
                              recipeToShow.isSaved == true ? Icons.favorite : Icons.favorite_border,
                              color: recipeToShow.isSaved == true ? Colors.red : null,
                            ),
                            onPressed: () => _saveRecipe(recipeToShow),
                            tooltip: recipeToShow.isSaved == true ? 'Remove from favorites' : 'Add to favorites',
                          ),
                        ],
                      ),

                      // Description
                      if (recipeToShow.description != null && recipeToShow.description!.isNotEmpty) ...[
                        SizedBox(height: 8),
                        Text(
                          recipeToShow.description!,
                          style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                        ),
                      ],

                      // Cooking info (time, servings)
                      SizedBox(height: 16),
                      Card(
                        color: Colors.grey[100],
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceAround,
                            children: [
                              if (recipeToShow.prepTime != null)
                                _buildInfoItem(Icons.access_time, 'Prep: ${recipeToShow.prepTime}'),
                              if (recipeToShow.cookTime != null)
                                _buildInfoItem(Icons.timer, 'Cook: ${recipeToShow.cookTime}'),
                              if (recipeToShow.servings != null)
                                _buildInfoItem(Icons.people, '${recipeToShow.servings} servings'),
                            ],
                          ),
                        ),
                      ),

                      // Nutrition info
                      if (recipeToShow.macros != null) ...[
                        SizedBox(height: 16),
                        Text(
                          "Nutrition",
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 8),
                        _buildMacrosGrid(recipeToShow.macros!),
                      ],

                      // Recipe Rating Section
                      SizedBox(height: 16),
                      _buildRecipeRatingSection(recipeToShow),

                      // Ingredients section
                      if (recipeToShow.ingredients != null && recipeToShow.ingredients!.isNotEmpty) ...[
                        SizedBox(height: 24),
                        Text(
                          "Ingredients",
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        Divider(),
                        SizedBox(height: 8),
                        ...recipeToShow.ingredients!.map((ingredient) {
                          return Padding(
                            padding: EdgeInsets.symmetric(vertical: 6),
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

                      // Instructions section
                      if (recipeToShow.instructions != null && recipeToShow.instructions!.isNotEmpty) ...[
                        SizedBox(height: 24),
                        Text(
                          "Instructions",
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        Divider(),
                        SizedBox(height: 8),
                        ...recipeToShow.instructions!.asMap().entries.map((entry) {
                          final index = entry.key;
                          final instruction = entry.value;
                          return Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 26,
                                  height: 26,
                                  alignment: Alignment.center,
                                  margin: EdgeInsets.only(right: 10, top: 2),
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

                      // Bottom padding for system UI
                      SizedBox(height: 60),
                    ],
                  ),
                ),
              ),
            ],
          ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey[600]),
        SizedBox(width: 4),
        Text(text, style: TextStyle(color: Colors.grey[600])),
      ],
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

  Future<void> _saveRecipe(Recipe recipe) async {
    try {
      // Check if the token needs refresh
      String? validToken = widget.authToken;

      // Try to get a valid token from the AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (await authProvider.refreshTokenIfNeeded()) {
        validToken = authProvider.authToken;
        print("🔄 Using refreshed token for saving recipe");
      }

      if (validToken == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Authentication token is invalid. Please log in again.'),
            duration: Duration(seconds: 3),
          ),
        );
        return;
      }

      final result = await ApiService.saveRecipe(
        userId: widget.userId,
        authToken: validToken,
        recipeId: recipe.id,
      );

      // Check if the result contains a token expired error
      if (result is Map &&
          result.containsKey('detail') &&
          (result['detail'] == 'Token has expired' || result['detail'] == 'Could not validate credentials')) {

        print("🔑 Token expired error detected in save recipe response");

        // Try to refresh the token
        if (await authProvider.refreshTokenIfNeeded()) {
          // Token refreshed, retry saving the recipe with the new token
          print("🔄 Token refreshed, retrying save recipe");
          return _saveRecipe(recipe);
        } else {
          // Token refresh failed, show login error
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Your session has expired. Please log in again.'),
              duration: Duration(seconds: 3),
            ),
          );
          return;
        }
      }

      setState(() {
        // Update the saved status in our local list
        final recipeIndex = _recipes.indexWhere((r) => r.id == recipe.id);
        if (recipeIndex != -1) {
          final updatedRecipe = Recipe(
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            imageUrl: recipe.imageUrl,
            macros: recipe.macros,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            category: recipe.category,
            tags: recipe.tags,
            isSaved: !(recipe.isSaved ?? false),
            rating: recipe.rating,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            servings: recipe.servings,
          );

          _recipes[recipeIndex] = updatedRecipe;
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            recipe.isSaved == true
              ? 'Recipe removed from favorites'
              : 'Recipe added to favorites'
          ),
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error saving recipe: $e'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Recipe Browser'),
        leading: Builder(
          builder: (context) => IconButton(
            icon: Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
            tooltip: 'Menu',
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
            tooltip: 'Filter',
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
                    'Recipe Browser',
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
              leading: Icon(Icons.restaurant_menu),
              title: Text('My Menus'),
              onTap: () {
                Navigator.pop(context);
                Navigator.pushNamed(context, '/menu');
              },
            ),
            ListTile(
              leading: Icon(Icons.search),
              title: Text('Recipe Browser'),
              selected: true,
              onTap: () {
                Navigator.pop(context);
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
      body: SafeArea(
        // iOS-specific: maintain bottom padding for home indicator
        bottom: true,
        child: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search recipes...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                suffixIcon: IconButton(
                  icon: Icon(Icons.clear),
                  onPressed: () {
                    _searchController.clear();
                    setState(() {
                      _searchQuery = '';
                    });
                    _fetchRecipes(refresh: true);
                  },
                ),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _handleSearch(),
            ),
          ),
          // Filter chips
          if (_selectedCategories.isNotEmpty)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: _selectedCategories.map((category) {
                    return Padding(
                      padding: EdgeInsets.only(right: 8),
                      child: Chip(
                        label: Text(category),
                        onDeleted: () => _toggleCategory(category),
                        backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                        labelStyle: TextStyle(color: Theme.of(context).primaryColor),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          Expanded(
            child: _hasError
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 64, color: Colors.red),
                        SizedBox(height: 16),
                        Text(
                          _errorMessage,
                          style: TextStyle(fontSize: 16),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: () => _fetchRecipes(refresh: true),
                          child: Text('Retry'),
                        ),
                      ],
                    ),
                  )
                : _recipes.isEmpty && !_isLoading
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off, size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text(
                              'No recipes found',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Try adjusting your search or filters',
                              style: TextStyle(color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => _fetchRecipes(refresh: true),
                        child: GridView.builder(
                          controller: _scrollController,
                          padding: EdgeInsets.all(16),
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 0.75,
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                          ),
                          itemCount: _recipes.length + (_isLoading && _page > 1 ? 2 : 0),
                          itemBuilder: (context, index) {
                            if (index >= _recipes.length) {
                              return Center(child: CircularProgressIndicator());
                            }
                            
                            final recipe = _recipes[index];
                            return _buildRecipeCard(recipe);
                          },
                        ),
                      ),
          ),
          if (_isLoading && _page == 1)
            Container(
              height: 80,
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
      ),
    );
  }

  Widget _buildRecipeCard(Recipe recipe) {
    return GestureDetector(
      onTap: () => _showRecipeDetails(recipe),
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
                  child: recipe.imageUrl != null
                      ? Image.network(
                          recipe.imageUrl!,
                          height: 120,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              height: 120,
                              color: Colors.grey[300],
                              child: Center(
                                child: Icon(Icons.restaurant, size: 40, color: Colors.grey),
                              ),
                            );
                          },
                        )
                      : Container(
                          height: 120,
                          color: Colors.grey[300],
                          child: Center(
                            child: Icon(Icons.restaurant, size: 40, color: Colors.grey),
                          ),
                        ),
                ),
                // Save/favorite button
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.8),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: Icon(
                        recipe.isSaved == true ? Icons.favorite : Icons.favorite_border,
                        color: recipe.isSaved == true ? Colors.red : null,
                        size: 18,
                      ),
                      padding: EdgeInsets.all(4),
                      constraints: BoxConstraints(),
                      onPressed: () => _saveRecipe(recipe),
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    recipe.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: 4),
                  if (recipe.category != null)
                    Text(
                      recipe.category!,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  SizedBox(height: 4),
                  // Rating display
                  if (recipe.averageRating != null && recipe.averageRating! > 0)
                    Row(
                      children: [
                        Icon(Icons.star, size: 12, color: Colors.amber),
                        SizedBox(width: 2),
                        Text(
                          '${recipe.averageRating!.toStringAsFixed(1)}',
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        if (recipe.ratingCount != null && recipe.ratingCount! > 0) ...[
                          SizedBox(width: 4),
                          Text(
                            '(${recipe.ratingCount})',
                            style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                          ),
                        ],
                      ],
                    ),
                  SizedBox(height: 4),
                  // Time/servings info
                  Row(
                    children: [
                      if (recipe.cookTime != null) ...[
                        Icon(Icons.timer, size: 12, color: Colors.grey),
                        SizedBox(width: 2),
                        Text(
                          recipe.cookTime!,
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        SizedBox(width: 8),
                      ],
                      if (recipe.servings != null) ...[
                        Icon(Icons.people, size: 12, color: Colors.grey),
                        SizedBox(width: 2),
                        Text(
                          '${recipe.servings}',
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Build rating section for the top of the dialog
  Widget _buildRatingSection(Recipe recipe) {
    return Row(
      children: [
        Icon(Icons.star, size: 16, color: Colors.amber),
        SizedBox(width: 4),
        Text(
          recipe.averageRating != null && recipe.averageRating! > 0
              ? "${recipe.averageRating!.toStringAsFixed(1)}"
              : "No rating",
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
        if (recipe.ratingCount != null && recipe.ratingCount! > 0) ...[
          SizedBox(width: 4),
          Text(
            "(${recipe.ratingCount})",
            style: TextStyle(fontSize: 10, color: Colors.grey[500]),
          ),
        ],
      ],
    );
  }

  // Build comprehensive rating section that fetches live rating data
  Widget _buildRecipeRatingSection(Recipe recipe) {
    return _RecipeRatingWidget(
      key: ValueKey('rating_${recipe.id}_$_ratingRefreshKey'),
      recipe: recipe,
      userId: widget.userId,
      authToken: widget.authToken,
      onRatePressed: () {
        HapticFeedback.mediumImpact();
        _showRatingDialog(recipe);
      },
    );
  }

  // Build star rating display
  Widget _buildStarRating(double rating) {
    return Row(
      children: List.generate(5, (index) {
        if (index < rating.floor()) {
          return Icon(Icons.star, color: Colors.amber, size: 20);
        } else if (index < rating) {
          return Icon(Icons.star_half, color: Colors.amber, size: 20);
        } else {
          return Icon(Icons.star_border, color: Colors.grey, size: 20);
        }
      }),
    );
  }

  // Show comprehensive rating dialog (matching web app)
  void _showRatingDialog(Recipe recipe) {
    showDialog(
      context: context,
      builder: (context) => _ComprehensiveRatingDialog(
        recipe: recipe,
        userId: widget.userId,
        authToken: widget.authToken,
        onRatingSubmitted: () async {
          // Refresh rating widget by incrementing refresh key
          print("🔄 Rating submitted successfully, refreshing rating display");
          setState(() {
            _ratingRefreshKey++;
          });
        },
      ),
    );
  }

}

// Comprehensive Rating Dialog Widget (matching web app functionality)
class _ComprehensiveRatingDialog extends StatefulWidget {
  final Recipe recipe;
  final int userId;
  final String authToken;
  final VoidCallback onRatingSubmitted;

  const _ComprehensiveRatingDialog({
    required this.recipe,
    required this.userId,
    required this.authToken,
    required this.onRatingSubmitted,
  });

  @override
  _ComprehensiveRatingDialogState createState() => _ComprehensiveRatingDialogState();
}

class _ComprehensiveRatingDialogState extends State<_ComprehensiveRatingDialog> {
  bool _isLoading = false;
  String _errorMessage = '';
  
  // Main rating state (matching web app structure)
  double _overallRating = 0;
  bool _madeRecipe = false;
  bool? _wouldMakeAgain;
  double _difficultyRating = 0;
  double _timeAccuracy = 0;
  String _feedbackText = '';
  
  // Detailed aspect ratings
  double _tasteRating = 0;
  double _easeOfPreparationRating = 0;
  double _ingredientAvailabilityRating = 0;
  double _portionSizeRating = 0;
  double _nutritionBalanceRating = 0;
  double _presentationRating = 0;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: EdgeInsets.all(32),
      child: SafeArea(
        child: Container(
          width: MediaQuery.of(context).size.width * 0.75,
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.9,
            maxWidth: 340,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(4)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rate Recipe',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            widget.recipe.title,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white70,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                      constraints: BoxConstraints(),
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ),
              ),
              
              // Scrollable content
              Expanded(
                child: SingleChildScrollView(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Overall Rating (Required)
                      _buildSectionTitle('Overall Rating *'),
                      _buildStarRating(
                        value: _overallRating,
                        onChanged: (value) => setState(() => _overallRating = value),
                        size: 35,
                      ),
                      if (_overallRating > 0)
                        Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            '${_overallRating.toInt()}/5',
                            style: TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ),
                      
                      SizedBox(height: 24),
                      
                      // Made Recipe Checkbox
                      CheckboxListTile(
                        title: Text('I have made this recipe'),
                        value: _madeRecipe,
                        onChanged: (value) {
                          setState(() {
                            _madeRecipe = value ?? false;
                            if (!_madeRecipe) {
                              _wouldMakeAgain = null;
                            }
                          });
                        },
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                      ),
                      
                      // Would Make Again (only if made recipe)
                      if (_madeRecipe) ...[
                        SizedBox(height: 16),
                        Text(
                          'Would you make this recipe again?',
                          style: TextStyle(fontWeight: FontWeight.w500),
                        ),
                        SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => setState(() => _wouldMakeAgain = true),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _wouldMakeAgain == true 
                                      ? Colors.green 
                                      : Colors.grey[300],
                                  foregroundColor: _wouldMakeAgain == true 
                                      ? Colors.white 
                                      : Colors.black,
                                ),
                                child: Text('Yes'),
                              ),
                            ),
                            SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () => setState(() => _wouldMakeAgain = false),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _wouldMakeAgain == false 
                                      ? Colors.red 
                                      : Colors.grey[300],
                                  foregroundColor: _wouldMakeAgain == false 
                                      ? Colors.white 
                                      : Colors.black,
                                ),
                                child: Text('No'),
                              ),
                            ),
                          ],
                        ),
                      ],
                      
                      SizedBox(height: 24),
                      Divider(),
                      SizedBox(height: 16),
                      
                      // Detailed Aspect Ratings
                      _buildSectionTitle('Detailed Ratings (Optional)'),
                      SizedBox(height: 16),
                      
                      _buildAspectRating('Taste', _tasteRating, (value) => setState(() => _tasteRating = value)),
                      _buildAspectRating('Ease of Preparation', _easeOfPreparationRating, (value) => setState(() => _easeOfPreparationRating = value)),
                      _buildAspectRating('Ingredient Availability', _ingredientAvailabilityRating, (value) => setState(() => _ingredientAvailabilityRating = value)),
                      _buildAspectRating('Portion Size', _portionSizeRating, (value) => setState(() => _portionSizeRating = value)),
                      _buildAspectRating('Nutrition Balance', _nutritionBalanceRating, (value) => setState(() => _nutritionBalanceRating = value)),
                      _buildAspectRating('Presentation', _presentationRating, (value) => setState(() => _presentationRating = value)),
                      
                      SizedBox(height: 24),
                      Divider(),
                      SizedBox(height: 16),
                      
                      // Difficulty Rating
                      _buildSliderRating(
                        'Difficulty Level',
                        'Very Easy → Very Hard',
                        _difficultyRating,
                        (value) => setState(() => _difficultyRating = value),
                      ),
                      
                      SizedBox(height: 16),
                      
                      // Time Accuracy
                      _buildSliderRating(
                        'Time Accuracy',
                        'Much Longer → Spot On',
                        _timeAccuracy,
                        (value) => setState(() => _timeAccuracy = value),
                      ),
                      
                      SizedBox(height: 24),
                      Divider(),
                      SizedBox(height: 16),
                      
                      // Feedback Text
                      _buildSectionTitle('Additional Comments (Optional)'),
                      SizedBox(height: 8),
                      TextField(
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Share your experience with this recipe...',
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (value) => _feedbackText = value,
                      ),
                      
                      // Error message
                      if (_errorMessage.isNotEmpty) ...[
                        SizedBox(height: 16),
                        Container(
                          padding: EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: _errorMessage.contains('success') ? Colors.green[100] : Colors.red[100],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _errorMessage,
                            style: TextStyle(
                              color: _errorMessage.contains('success') ? Colors.green[800] : Colors.red[800],
                            ),
                          ),
                        ),
                      ],
                      
                      SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              
              // Action buttons
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: Colors.grey[300]!)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: Text('Cancel'),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _overallRating > 0 && !_isLoading ? _submitRating : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Theme.of(context).primaryColor,
                          foregroundColor: Colors.white,
                        ),
                        child: _isLoading
                            ? SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : Text('Submit Rating'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.bold,
        color: Theme.of(context).primaryColor,
      ),
    );
  }

  Widget _buildStarRating({
    required double value,
    required Function(double) onChanged,
    double size = 25,
  }) {
    // Use smaller padding for smaller stars to prevent overflow
    final horizontalPadding = size < 18 ? 1.0 : (size < 20 ? 2.0 : 4.0);
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            onChanged((index + 1).toDouble());
          },
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
            child: Icon(
              index < value ? Icons.star : Icons.star_border,
              color: Colors.amber,
              size: size,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildAspectRating(String label, double value, Function(double) onChanged) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: TextStyle(fontSize: 14),
              softWrap: true,
              overflow: TextOverflow.visible,
              maxLines: 2,
            ),
          ),
          SizedBox(width: 4),
          Expanded(
            flex: 3,
            child: _buildStarRating(
              value: value,
              onChanged: onChanged,
              size: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliderRating(String title, String subtitle, double value, Function(double) onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(fontWeight: FontWeight.w500),
        ),
        Text(
          subtitle,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
        Slider(
          value: value,
          min: 0,
          max: 5,
          divisions: 5,
          label: value == 0 ? 'Not Rated' : value.toInt().toString(),
          onChanged: onChanged,
        ),
      ],
    );
  }

  Future<void> _submitRating() async {
    if (_overallRating == 0) {
      setState(() => _errorMessage = 'Please provide an overall rating');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Build rating aspects if any have values
      final ratingAspects = <String, double>{};
      if (_tasteRating > 0) ratingAspects['taste'] = _tasteRating;
      if (_easeOfPreparationRating > 0) ratingAspects['ease_of_preparation'] = _easeOfPreparationRating;
      if (_ingredientAvailabilityRating > 0) ratingAspects['ingredient_availability'] = _ingredientAvailabilityRating;
      if (_portionSizeRating > 0) ratingAspects['portion_size'] = _portionSizeRating;
      if (_nutritionBalanceRating > 0) ratingAspects['nutrition_balance'] = _nutritionBalanceRating;
      if (_presentationRating > 0) ratingAspects['presentation'] = _presentationRating;

      final response = await ApiService.submitComprehensiveRating(
        userId: widget.userId,
        authToken: widget.authToken,
        recipeId: widget.recipe.id,
        ratingScore: _overallRating,
        feedbackText: _feedbackText.isNotEmpty ? _feedbackText : null,
        madeRecipe: _madeRecipe,
        wouldMakeAgain: _wouldMakeAgain,
        difficultyRating: _difficultyRating > 0 ? _difficultyRating : null,
        timeAccuracy: _timeAccuracy > 0 ? _timeAccuracy : null,
        ratingAspects: ratingAspects.isNotEmpty ? ratingAspects : null,
      );

      if (response['success'] == true) {
        setState(() => _errorMessage = 'Rating submitted successfully!');
        widget.onRatingSubmitted();
        
        // Close dialog after showing success
        Future.delayed(Duration(seconds: 1), () {
          if (mounted) Navigator.pop(context);
        });
      } else {
        setState(() => _errorMessage = response['message'] ?? 'Failed to submit rating');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Error submitting rating: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }
}

// Widget to display recipe ratings with live data fetching (similar to web app)
class _RecipeRatingWidget extends StatefulWidget {
  final Recipe recipe;
  final int userId;
  final String authToken;
  final VoidCallback onRatePressed;

  const _RecipeRatingWidget({
    super.key,
    required this.recipe,
    required this.userId,
    required this.authToken,
    required this.onRatePressed,
  });

  @override
  _RecipeRatingWidgetState createState() => _RecipeRatingWidgetState();
}

class _RecipeRatingWidgetState extends State<_RecipeRatingWidget> {
  Map<String, dynamic>? _ratingData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRatingData();
  }

  Future<void> _loadRatingData() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      print("📊 Loading rating data for recipe ID: ${widget.recipe.id}");
      final ratingData = await ApiService.getRecipeRating(
        userId: widget.userId,
        authToken: widget.authToken,
        recipeId: widget.recipe.id,
      );

      print("📊 Rating data response: $ratingData");

      setState(() {
        _ratingData = ratingData;
        _isLoading = false;
      });
    } catch (e) {
      print("Error loading rating data: $e");
      setState(() {
        _error = "Failed to load ratings";
        _isLoading = false;
      });
    }
  }

  Widget _buildStarRating(double rating) {
    return Row(
      children: List.generate(5, (index) {
        if (index < rating.floor()) {
          return Icon(Icons.star, color: Colors.amber, size: 20);
        } else if (index < rating) {
          return Icon(Icons.star_half, color: Colors.amber, size: 20);
        } else {
          return Icon(Icons.star_border, color: Colors.grey, size: 20);
        }
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Rating & Reviews",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        Divider(),
        SizedBox(height: 8),

        if (_isLoading)
          Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_error != null)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text(
              _error!,
              style: TextStyle(color: Colors.red, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          )
        else if (_ratingData == null || (_ratingData!['total_ratings'] ?? 0) == 0)
          Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text(
              "No ratings yet. Be the first to rate this recipe!",
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
          )
        else ...[
          // Display rating summary (similar to web app)
          () {
            final summary = _ratingData!['summary'];
            final averageRating = summary?['average_rating']?.toDouble() ?? 0.0;
            final totalRatings = summary?['total_ratings']?.toInt() ?? 0;
            final timesMade = summary?['times_made']?.toInt() ?? 0;
            final remakePercentage = summary?['remake_percentage']?.toInt() ?? 0;

            return Column(
              children: [
                // Main rating display
                Row(
                  children: [
                    _buildStarRating(averageRating),
                    SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "${averageRating.toStringAsFixed(1)}/5.0",
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                        ),
                        Text(
                          "Based on $totalRatings rating${totalRatings != 1 ? 's' : ''}",
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ],
                ),
                
                // Quick stats (if available)
                if (timesMade > 0 || remakePercentage > 0) ...[
                  SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      if (timesMade > 0)
                        Chip(
                          label: Text("$timesMade made this"),
                          backgroundColor: Colors.green.withOpacity(0.1),
                          labelStyle: TextStyle(color: Colors.green[700], fontSize: 12),
                        ),
                      if (remakePercentage > 0)
                        Chip(
                          label: Text("$remakePercentage% would make again"),
                          backgroundColor: Colors.blue.withOpacity(0.1),
                          labelStyle: TextStyle(color: Colors.blue[700], fontSize: 12),
                        ),
                    ],
                  ),
                ],
              ],
            );
          }(),
        ],

        SizedBox(height: 16),

        // Rate this recipe button
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: widget.onRatePressed,
                icon: Icon(Icons.star_border),
                label: Text("Rate this recipe"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).primaryColor,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}