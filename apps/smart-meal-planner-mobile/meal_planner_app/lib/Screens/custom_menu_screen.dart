import 'package:flutter/material.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';

class CustomMenuScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  CustomMenuScreen({required this.userId, required this.authToken});

  @override
  _CustomMenuScreenState createState() => _CustomMenuScreenState();
}

class _CustomMenuScreenState extends State<CustomMenuScreen> {
  bool _isLoading = true;
  List<Recipe> _savedRecipes = [];
  Map<String, Recipe> _selectedRecipes = {};
  String _menuNickname = '';
  String _errorMessage = '';
  
  // Day selection dialog
  bool _showDaySelectionDialog = false;
  Recipe? _currentRecipe;
  String? _currentMealTime;

  @override
  void initState() {
    super.initState();
    _fetchSavedRecipes();
  }

  Future<void> _fetchSavedRecipes() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getSavedRecipes(widget.userId, widget.authToken);

      if (result != null && result['recipes'] is List) {
        final List<dynamic> recipesData = result['recipes'];
        
        setState(() {
          _savedRecipes = recipesData.map((data) {
            return Recipe.fromMap(data is Map<String, dynamic> ? data : {});
          }).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _savedRecipes = [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load saved recipes: $e';
        _isLoading = false;
      });
    }
  }

  void _openDaySelection(Recipe recipe, String mealTime) {
    setState(() {
      _currentRecipe = recipe;
      _currentMealTime = mealTime;
      _showDaySelectionDialog = true;
    });
  }

  void _selectDay(int day) {
    if (_currentRecipe != null && _currentMealTime != null) {
      final key = 'day${day}_$_currentMealTime';
      
      setState(() {
        _selectedRecipes[key] = Recipe(
          id: _currentRecipe!.id,
          title: _currentRecipe!.title,
          ingredients: _currentRecipe!.ingredients,
          instructions: _currentRecipe!.instructions,
          cookTime: _currentRecipe!.cookTime,
          prepTime: _currentRecipe!.prepTime,
          servings: _currentRecipe!.servings,
          imageUrl: _currentRecipe!.imageUrl,
          category: _currentRecipe!.category,
          tags: _currentRecipe!.tags,
          macros: _currentRecipe!.macros,
          difficulty: _currentRecipe!.difficulty,
          // Store day and meal time info
          notes: 'Day $day - ${_currentMealTime!.substring(0, 1).toUpperCase()}${_currentMealTime!.substring(1)}',
          isSaved: true,
        );
        _showDaySelectionDialog = false;
        _currentRecipe = null;
        _currentMealTime = null;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recipe added to Day $day')),
      );
    }
  }

  void _removeRecipe(String key) {
    setState(() {
      _selectedRecipes.remove(key);
    });
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Recipe removed')),
    );
  }

  Future<void> _saveCustomMenu() async {
    if (_menuNickname.trim().isEmpty) {
      setState(() => _errorMessage = 'Menu name is required');
      return;
    }

    if (_selectedRecipes.isEmpty) {
      setState(() => _errorMessage = 'Please add at least one recipe to your custom menu');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // Convert selected recipes to the format expected by backend
      final recipes = _selectedRecipes.entries.map((entry) {
        final key = entry.key;
        final recipe = entry.value;
        
        // Extract day and meal time from key (e.g., "day3_lunch")
        final parts = key.split('_');
        final day = int.parse(parts[0].replaceAll('day', ''));
        final mealTime = parts[1];
        
        return {
          'recipe_id': recipe.id,
          'title': recipe.title,
          'ingredients': recipe.ingredients ?? [],
          'instructions': recipe.instructions ?? [],
          'meal_time': mealTime == 'snacks' ? 'snack' : mealTime,
          'servings': recipe.servings ?? 1,
          'macros': recipe.macros ?? {},
          'image_url': recipe.imageUrl,
          'day': day,
        };
      }).toList();

      // Prepare custom menu request
      final customMenuRequest = {
        'user_id': widget.userId,
        'recipes': recipes,
        'duration_days': 7,
        'nickname': _menuNickname.trim(),
      };

      final result = await ApiService.saveCustomMenu(
        userId: widget.userId,
        authToken: widget.authToken,
        menuData: customMenuRequest,
      );

      if (result != null && result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Custom menu saved successfully!')),
        );
        
        // Navigate back to menu screen
        Navigator.pop(context, true);
      } else {
        setState(() => _errorMessage = result?['message'] ?? 'Failed to save custom menu');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to save custom menu: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Widget _buildMacroChips(Recipe recipe) {
    if (recipe.macros == null) return SizedBox();
    
    final macros = recipe.macros!;
    return Wrap(
      spacing: 4,
      children: [
        if (macros['calories'] != null)
          Chip(
            label: Text('Cal: ${macros['calories']}'),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        if (macros['protein'] != null)
          Chip(
            label: Text('P: ${macros['protein']}g'),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        if (macros['carbs'] != null)
          Chip(
            label: Text('C: ${macros['carbs']}g'),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        if (macros['fat'] != null)
          Chip(
            label: Text('F: ${macros['fat']}g'),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
      ],
    );
  }

  Widget _buildSelectedRecipes() {
    if (_selectedRecipes.isEmpty) {
      return Container(
        padding: EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.restaurant_menu, size: 48, color: Colors.grey),
            SizedBox(height: 8),
            Text(
              'No recipes selected yet',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
            Text(
              'Choose recipes from below and add them to your custom menu',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      children: _selectedRecipes.entries.map((entry) {
        final key = entry.key;
        final recipe = entry.value;
        
        return Card(
          margin: EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(recipe.title),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(recipe.notes ?? 'Custom Recipe'),
                SizedBox(height: 4),
                _buildMacroChips(recipe),
              ],
            ),
            trailing: IconButton(
              icon: Icon(Icons.remove_circle, color: Colors.red),
              onPressed: () => _removeRecipe(key),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDaySelectionDialog() {
    return AlertDialog(
      title: Text('Select Day'),
      content: Container(
        width: double.maxFinite,
        child: GridView.count(
          shrinkWrap: true,
          crossAxisCount: 3,
          childAspectRatio: 2,
          crossAxisSpacing: 8,
          mainAxisSpacing: 8,
          children: List.generate(7, (index) {
            final day = index + 1;
            return ElevatedButton(
              onPressed: () => _selectDay(day),
              child: Text('Day $day'),
            );
          }),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            setState(() {
              _showDaySelectionDialog = false;
              _currentRecipe = null;
              _currentMealTime = null;
            });
          },
          child: Text('Cancel'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Custom Menu Builder'),
      ),
      body: Stack(
        children: [
          // Main content
          _isLoading
              ? Center(child: CircularProgressIndicator())
              : SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Create your own custom menu by selecting recipes from your saved collection.',
                        style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                      ),
                      
                      if (_errorMessage.isNotEmpty) ...[
                        SizedBox(height: 16),
                        Container(
                          padding: EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red[50],
                            border: Border.all(color: Colors.red[200]!),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.error, color: Colors.red),
                              SizedBox(width: 8),
                              Expanded(child: Text(_errorMessage, style: TextStyle(color: Colors.red[700]))),
                            ],
                          ),
                        ),
                      ],

                      SizedBox(height: 24),

                      // Selected Recipes Section
                      Text(
                        'Selected Recipes',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 8),
                      _buildSelectedRecipes(),

                      SizedBox(height: 24),

                      // Saved Recipes Section
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Saved Recipes',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          TextButton.icon(
                            icon: Icon(Icons.search),
                            label: Text('Browse Recipes'),
                            onPressed: () => Navigator.pushNamed(context, '/recipe-browser'),
                          ),
                        ],
                      ),
                      SizedBox(height: 8),

                      if (_savedRecipes.isEmpty)
                        Container(
                          padding: EdgeInsets.all(24),
                          child: Column(
                            children: [
                              Icon(Icons.bookmark_border, size: 48, color: Colors.grey),
                              SizedBox(height: 8),
                              Text(
                                'No saved recipes yet',
                                style: TextStyle(fontSize: 16, color: Colors.grey[600]),
                              ),
                              Text(
                                'Browse our recipe collection to save some first.',
                                style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: NeverScrollableScrollPhysics(),
                          itemCount: _savedRecipes.length,
                          itemBuilder: (context, index) {
                            final recipe = _savedRecipes[index];
                            return Card(
                              margin: EdgeInsets.only(bottom: 12),
                              child: Column(
                                children: [
                                  ListTile(
                                    title: Text(recipe.title),
                                    subtitle: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        if (recipe.ingredients != null)
                                          Text('${recipe.ingredients!.length} ingredients'),
                                        SizedBox(height: 4),
                                        _buildMacroChips(recipe),
                                      ],
                                    ),
                                  ),
                                  ButtonBar(
                                    children: [
                                      TextButton(
                                        onPressed: () => _openDaySelection(recipe, 'breakfast'),
                                        child: Text('Breakfast'),
                                      ),
                                      TextButton(
                                        onPressed: () => _openDaySelection(recipe, 'lunch'),
                                        child: Text('Lunch'),
                                      ),
                                      TextButton(
                                        onPressed: () => _openDaySelection(recipe, 'dinner'),
                                        child: Text('Dinner'),
                                      ),
                                      TextButton(
                                        onPressed: () => _openDaySelection(recipe, 'snacks'),
                                        child: Text('Snacks'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),

                      SizedBox(height: 32),

                      // Menu Name and Save Section
                      Text(
                        'Menu Details',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      SizedBox(height: 16),
                      TextFormField(
                        decoration: InputDecoration(
                          labelText: 'Menu Name *',
                          border: OutlineInputBorder(),
                          errorText: _menuNickname.isEmpty && _errorMessage.contains('Menu name') ? 'Menu name is required' : null,
                        ),
                        initialValue: _menuNickname,
                        onChanged: (value) {
                          setState(() {
                            _menuNickname = value;
                            if (_errorMessage.contains('Menu name')) {
                              _errorMessage = '';
                            }
                          });
                        },
                      ),
                      
                      SizedBox(height: 24),
                      
                      Center(
                        child: ElevatedButton.icon(
                          icon: Icon(Icons.save),
                          label: Text('Save Custom Menu'),
                          style: ElevatedButton.styleFrom(
                            padding: EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                          ),
                          onPressed: _menuNickname.trim().isEmpty || _selectedRecipes.isEmpty
                              ? null
                              : _saveCustomMenu,
                        ),
                      ),

                      SizedBox(height: 40),
                    ],
                  ),
                ),
          
          // Day Selection Dialog Overlay
          if (_showDaySelectionDialog)
            Container(
              color: Colors.black54,
              child: Center(child: _buildDaySelectionDialog()),
            ),
        ],
      ),
    );
  }
}