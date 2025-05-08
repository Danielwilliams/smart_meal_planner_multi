import 'package:flutter/material.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';

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
      final result = await ApiService.searchRecipes(
        userId: widget.userId,
        authToken: widget.authToken,
        query: _searchQuery,
        categories: _selectedCategories.isNotEmpty ? _selectedCategories : null,
        page: _page,
        pageSize: _pageSize,
      );

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

  void _showRecipeDetails(Recipe recipe) {
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          recipe.title,
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                        ),
                      ),
                      IconButton(
                        icon: Icon(
                          recipe.isSaved == true ? Icons.favorite : Icons.favorite_border,
                          color: recipe.isSaved == true ? Colors.red : null,
                        ),
                        onPressed: () {
                          _saveRecipe(recipe);
                          Navigator.pop(context);
                        },
                        tooltip: recipe.isSaved == true ? 'Remove from favorites' : 'Add to favorites',
                      ),
                    ],
                  ),
                  if (recipe.category != null) ...[
                    SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      children: [
                        Chip(
                          label: Text(recipe.category!),
                          backgroundColor: Theme.of(context).primaryColor.withOpacity(0.1),
                          labelStyle: TextStyle(color: Theme.of(context).primaryColor),
                        ),
                      ],
                    ),
                  ],
                  if (recipe.description != null) ...[
                    SizedBox(height: 8),
                    Text(
                      recipe.description!,
                      style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                    ),
                  ],
                  if (recipe.imageUrl != null) ...[
                    SizedBox(height: 16),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        recipe.imageUrl!,
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
                  SizedBox(height: 16),
                  Row(
                    children: [
                      if (recipe.prepTime != null) ...[
                        _buildInfoItem(Icons.access_time, 'Prep: ${recipe.prepTime}'),
                        SizedBox(width: 16),
                      ],
                      if (recipe.cookTime != null) ...[
                        _buildInfoItem(Icons.timer, 'Cook: ${recipe.cookTime}'),
                        SizedBox(width: 16),
                      ],
                      if (recipe.servings != null) ...[
                        _buildInfoItem(Icons.people, '${recipe.servings} servings'),
                      ],
                    ],
                  ),
                  if (recipe.macros != null) ...[
                    SizedBox(height: 16),
                    Text(
                      "Nutrition",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    _buildMacrosGrid(recipe.macros!),
                  ],
                  if (recipe.ingredients != null && recipe.ingredients!.isNotEmpty) ...[
                    SizedBox(height: 16),
                    Text(
                      "Ingredients",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    ...recipe.ingredients!.map((ingredient) {
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
                  if (recipe.instructions != null && recipe.instructions!.isNotEmpty) ...[
                    SizedBox(height: 16),
                    Text(
                      "Instructions",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 8),
                    ...recipe.instructions!.asMap().entries.map((entry) {
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
      await ApiService.saveRecipe(
        userId: widget.userId,
        authToken: widget.authToken,
        recipeId: recipe.id,
      );
      
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
        actions: [
          IconButton(
            icon: Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
            tooltip: 'Filter',
          ),
        ],
      ),
      body: Column(
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
}