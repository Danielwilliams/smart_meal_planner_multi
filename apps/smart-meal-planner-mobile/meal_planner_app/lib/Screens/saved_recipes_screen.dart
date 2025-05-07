import 'package:flutter/material.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';

class SavedRecipesScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  SavedRecipesScreen({required this.userId, required this.authToken});

  @override
  _SavedRecipesScreenState createState() => _SavedRecipesScreenState();
}

class _SavedRecipesScreenState extends State<SavedRecipesScreen> {
  List<Recipe> _savedRecipes = [];
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _fetchSavedRecipes();
  }

  Future<void> _fetchSavedRecipes() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final result = await ApiService.getSavedRecipes(
        widget.userId,
        widget.authToken,
      );

      if (result != null) {
        // Check for different API response formats
        List<dynamic> recipesData = [];
        
        print("Saved Recipes API Response Keys: ${result.keys.toList()}");
        
        // Handle different possible response formats from the backend
        if (result.containsKey('saved_recipes')) {
          recipesData = result['saved_recipes'] as List<dynamic>;
        } else if (result.containsKey('recipes')) {
          recipesData = result['recipes'] as List<dynamic>;
        } else if (result.containsKey('data') && result['data'] is List) {
          recipesData = result['data'] as List<dynamic>;
        } else if (result is List) {
          recipesData = result as List<dynamic>;
        } else {
          // Try to find any list in the response
          for (var key in result.keys) {
            if (result[key] is List && recipesData.isEmpty) {
              recipesData = result[key] as List<dynamic>;
              print("Found recipes in unexpected key: $key");
              break;
            }
          }
          
          if (recipesData.isEmpty) {
            print("Unable to find recipe data in saved recipes response: ${result.keys}");
          }
        }
        
        print("Found ${recipesData.length} saved recipes");
        
        // Process each recipe with error handling
        List<Recipe> recipes = [];
        for (var json in recipesData) {
          try {
            // Force isSaved to be true for all recipes in this screen
            final recipeJson = json is Map<String, dynamic> ? 
                Map<String, dynamic>.from(json) : {'id': 0, 'title': 'Unknown Recipe'};
            
            // Make sure recipe has an ID
            if (!recipeJson.containsKey('id') && recipeJson.containsKey('scraped_recipe_id')) {
              recipeJson['id'] = recipeJson['scraped_recipe_id'];
            }
            
            recipeJson['is_saved'] = true;
            
            recipes.add(Recipe.fromJson(recipeJson));
          } catch (e) {
            print("Error parsing saved recipe: $e");
            // Continue processing the rest
          }
        }

        setState(() {
          _isLoading = false;
          _savedRecipes = recipes;
        });
      } else {
        setState(() {
          _isLoading = false;
          _hasError = true;
          _errorMessage = 'Failed to load saved recipes';
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
                          Icons.favorite,
                          color: Colors.red,
                        ),
                        onPressed: () {
                          _unsaveRecipe(recipe);
                          Navigator.pop(context);
                        },
                        tooltip: 'Remove from favorites',
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

  Future<void> _unsaveRecipe(Recipe recipe) async {
    try {
      await ApiService.saveRecipe(
        userId: widget.userId,
        authToken: widget.authToken,
        recipeId: recipe.id,
      );
      
      setState(() {
        // Remove the recipe from our local list
        _savedRecipes.removeWhere((r) => r.id == recipe.id);
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Recipe removed from favorites'),
          duration: Duration(seconds: 2),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error removing recipe: $e'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Saved Recipes'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _fetchSavedRecipes,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _hasError
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
                        onPressed: _fetchSavedRecipes,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _savedRecipes.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.favorite_border, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No saved recipes',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Your favorite recipes will appear here',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          SizedBox(height: 24),
                          ElevatedButton.icon(
                            icon: Icon(Icons.search),
                            label: Text('Browse Recipes'),
                            onPressed: () {
                              Navigator.pushReplacementNamed(context, '/recipe-browser');
                            },
                          ),
                        ],
                      ),
                    )
                  : GridView.builder(
                      padding: EdgeInsets.all(16),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.75,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                      ),
                      itemCount: _savedRecipes.length,
                      itemBuilder: (context, index) {
                        final recipe = _savedRecipes[index];
                        return _buildRecipeCard(recipe);
                      },
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
                // Favorite indicator
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
                        Icons.favorite,
                        color: Colors.red,
                        size: 18,
                      ),
                      padding: EdgeInsets.all(4),
                      constraints: BoxConstraints(),
                      onPressed: () => _unsaveRecipe(recipe),
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