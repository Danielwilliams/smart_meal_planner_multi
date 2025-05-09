import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CreateClientMenuScreen extends StatefulWidget {
  final int clientId;
  final String clientName;
  final int userId;
  final String authToken;
  final int? recipeId;
  final String? recipeTitle;

  CreateClientMenuScreen({
    required this.clientId,
    required this.clientName,
    required this.userId,
    required this.authToken,
    this.recipeId,
    this.recipeTitle,
  });

  @override
  _CreateClientMenuScreenState createState() => _CreateClientMenuScreenState();
}

class _CreateClientMenuScreenState extends State<CreateClientMenuScreen> {
  bool _isLoading = false;
  bool _isGenerating = false;
  bool _showAIOptionsExpanded = false;
  String _errorMessage = '';
  final _formKey = GlobalKey<FormState>();
  final _menuTitleController = TextEditingController();
  final _menuDescriptionController = TextEditingController();
  
  // Client preferences for menu generation
  Map<String, dynamic> _clientPreferences = {};
  
  // AI generation options
  int _selectedDays = 7;
  String _selectedModel = 'default';
  
  // Available days options
  final List<int> _daysOptions = [3, 5, 7, 14];
  
  // Available models
  final List<String> _modelOptions = ['default', 'gpt-4', 'gpt-3.5-turbo'];
  
  // Menu data
  Map<String, List<Map<String, dynamic>>> _menuDays = {
    'Monday': <Map<String, dynamic>>[],
    'Tuesday': <Map<String, dynamic>>[],
    'Wednesday': <Map<String, dynamic>>[],
    'Thursday': <Map<String, dynamic>>[],
    'Friday': <Map<String, dynamic>>[],
    'Saturday': <Map<String, dynamic>>[],
    'Sunday': <Map<String, dynamic>>[],
  };
  
  @override
  void initState() {
    super.initState();
    
    // Set a default menu title
    _menuTitleController.text = "Menu for ${widget.clientName}";
    
    // Load client preferences for AI generation
    _loadClientPreferences();
    
    // If we have a recipe ID, add it to the menu
    if (widget.recipeId != null && widget.recipeTitle != null) {
      // Ensure the list exists before adding to it
      _menuDays['Monday'] = _menuDays['Monday'] ?? [];
      _menuDays['Monday']!.add({
        'id': widget.recipeId,
        'title': widget.recipeTitle!,
        'meal_type': 'dinner',
      });
    }
  }
  
  @override
  void dispose() {
    _menuTitleController.dispose();
    _menuDescriptionController.dispose();
    super.dispose();
  }
  
  Future<void> _loadClientPreferences() async {
    try {
      final result = await ApiService.getClientPreferences(
        widget.clientId,
        widget.authToken,
      );
      
      if (result is Map<String, dynamic>) {
        // Check if result already has the preferences structure
        if (result.keys.toList().any((key) => 
            ['diet_type', 'dietary_restrictions', 'calorie_goal', 'macro_protein'].contains(key))) {
          setState(() {
            _clientPreferences = Map<String, dynamic>.from(result);
          });
        } 
        // Or check if it's nested under a preferences key
        else if (result.containsKey('preferences') && result['preferences'] is Map) {
          setState(() {
            _clientPreferences = Map<String, dynamic>.from(result['preferences']);
          });
        }
      }
      
      print("Loaded client preferences for menu generation: $_clientPreferences");
    } catch (e) {
      print("Error loading client preferences: $e");
      // Continue without preferences if there's an error
    }
  }

  Future<void> _createClientMenu() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    // Ensure at least one meal is added
    bool hasMeals = false;
    _menuDays.forEach((day, meals) {
      if (meals.isNotEmpty) {
        hasMeals = true;
      }
    });
    
    if (!hasMeals) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Please add at least one meal to the menu or use AI to generate a menu')),
      );
      return;
    }
    
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    
    try {
      // Convert menu days to format expected by API
      List<Map<String, dynamic>> days = [];
      _menuDays.forEach((day, meals) {
        // Only add if the meals list exists and is not empty
        if (meals != null && meals.isNotEmpty) {
          days.add({
            'day': day,
            'meals': meals,
          });
        }
      });
      
      // Create menu data
      Map<String, dynamic> menuData = {
        'title': _menuTitleController.text,
        'description': _menuDescriptionController.text,
        'days': days,
        'is_shared': true,
        'shared_with': [widget.clientId],
      };
      
      final result = await ApiService.createClientMenu(
        widget.clientId,
        widget.authToken,
        menuData,
      );
      
      if (result.containsKey('id') || result.containsKey('menu_id') || result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Menu created and shared with ${widget.clientName}')),
        );
        
        // Navigate back after successful creation
        Navigator.pop(context);
      } else if (result.containsKey('error')) {
        setState(() {
          _errorMessage = result['error'] ?? 'Failed to create menu';
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to create menu: Unknown error';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error: $e';
        _isLoading = false;
      });
    }
  }
  
  Future<void> _generateMenuWithAI() async {
    setState(() {
      _isGenerating = true;
      _errorMessage = '';
    });
    
    try {
      // Create parameters for menu generation
      Map<String, dynamic> menuParameters = {
        'user_id': widget.userId,
        'client_id': widget.clientId,
        'meal_types': ['breakfast', 'lunch', 'dinner'],
        'duration_days': _selectedDays,
        'model': _selectedModel,
        'title': _menuTitleController.text,
      };
      
      // Add client preferences if available
      if (_clientPreferences.isNotEmpty) {
        if (_clientPreferences.containsKey('diet_type')) {
          menuParameters['diet_type'] = _clientPreferences['diet_type'];
        }
        
        if (_clientPreferences.containsKey('dietary_restrictions')) {
          menuParameters['dietary_restrictions'] = _clientPreferences['dietary_restrictions'];
        }
        
        if (_clientPreferences.containsKey('calorie_goal')) {
          menuParameters['calorie_goal'] = _clientPreferences['calorie_goal'];
        }
        
        if (_clientPreferences.containsKey('macro_protein') && 
            _clientPreferences.containsKey('macro_carbs') && 
            _clientPreferences.containsKey('macro_fat')) {
          menuParameters['macros'] = {
            'protein': _clientPreferences['macro_protein'],
            'carbs': _clientPreferences['macro_carbs'],
            'fat': _clientPreferences['macro_fat'],
          };
        }
      }
      
      // Generate menu
      final result = await ApiService.generateMenu(
        userId: widget.userId,
        authToken: widget.authToken,
        menuParameters: menuParameters,
      );
      
      if (result != null && !result.containsKey('error')) {
        // Check if the result has meal plan data
        if (result.containsKey('meal_plan') && result['meal_plan'] is Map) {
          Map<String, dynamic> mealPlan = result['meal_plan'];
          
          // Check if meal plan has days
          if (mealPlan.containsKey('days') && mealPlan['days'] is List) {
            // Process the generated menu
            _processGeneratedMenu(mealPlan['days']);
            
            // Show success message
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Menu generated successfully!')),
            );
          } else {
            throw Exception('Generated meal plan missing days structure');
          }
        } else {
          throw Exception('Generated response missing meal plan structure');
        }
      } else {
        setState(() {
          _errorMessage = result.containsKey('error') ? result['error'] : 'Failed to generate menu';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error generating menu: $e';
      });
    } finally {
      setState(() {
        _isGenerating = false;
      });
    }
  }
  
  void _processGeneratedMenu(List<dynamic> days) {
    // Reset current menu
    Map<String, List<Map<String, dynamic>>> newMenu = {
      'Monday': <Map<String, dynamic>>[],
      'Tuesday': <Map<String, dynamic>>[],
      'Wednesday': <Map<String, dynamic>>[],
      'Thursday': <Map<String, dynamic>>[],
      'Friday': <Map<String, dynamic>>[],
      'Saturday': <Map<String, dynamic>>[],
      'Sunday': <Map<String, dynamic>>[],
    };
    
    // Map numerical days to day names
    List<String> dayNames = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 
      'Friday', 'Saturday', 'Sunday'
    ];
    
    // Process each day from the API response
    for (int i = 0; i < days.length; i++) {
      var day = days[i];
      String dayName = i < dayNames.length ? dayNames[i] : 'Day ${i + 1}';
      
      // Check if the day has meals
      if (day is Map && day.containsKey('meals') && day['meals'] is Map) {
        Map meals = day['meals'];
        
        // Process each meal type
        meals.forEach((mealType, mealList) {
          if (mealList is List) {
            for (var meal in mealList) {
              if (meal is Map) {
                // Convert meal to correct format for our app
                Map<String, dynamic> processedMeal = {
                  'title': meal['title'] ?? 'Unnamed Recipe',
                  'meal_type': mealType.toString().toLowerCase(),
                };
                
                // Add recipe ID if available
                if (meal.containsKey('id')) {
                  processedMeal['id'] = meal['id'];
                }
                
                // Add recipe description if available
                if (meal.containsKey('description')) {
                  processedMeal['description'] = meal['description'];
                }
                
                // Add to the day's meals
                if (newMenu.containsKey(dayName)) {
                  newMenu[dayName]!.add(processedMeal);
                }
              }
            }
          }
        });
      }
    }
    
    // Update the menu state
    setState(() {
      _menuDays = newMenu;
    });
  }
  
  void _addMeal(String day) {
    // Ensure the map contains the day
    if (!_menuDays.containsKey(day)) {
      _menuDays[day] = <Map<String, dynamic>>[];
    }
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Add Meal'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Select meal type for $day:'),
            SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _mealTypeButton(day, 'breakfast', 'Breakfast'),
                _mealTypeButton(day, 'lunch', 'Lunch'),
                _mealTypeButton(day, 'dinner', 'Dinner'),
              ],
            ),
            SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _mealTypeButton(day, 'snack', 'Snack'),
                _mealTypeButton(day, 'dessert', 'Dessert'),
              ],
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
  }
  
  Widget _mealTypeButton(String day, String mealType, String label) {
    return ElevatedButton(
      onPressed: () {
        Navigator.pop(context);
        _showRecipeBrowser(day, mealType);
      },
      child: Text(label),
      style: ElevatedButton.styleFrom(
        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      ),
    );
  }
  
  void _showRecipeBrowser(String day, String mealType) {
    // This is a placeholder - in a real app, this would navigate to a recipe browser
    // where the user can select a recipe to add to the menu
    
    // Ensure the map contains the day with a non-null list
    if (!_menuDays.containsKey(day)) {
      _menuDays[day] = <Map<String, dynamic>>[];
    }
    
    // Navigate to recipe browser
    Navigator.pushNamed(
      context, 
      '/recipe-browser',
      arguments: {
        'fromMenuCreator': true,
        'day': day,
        'mealType': mealType,
      },
    ).then((selectedRecipe) {
      if (selectedRecipe != null && selectedRecipe is Map<String, dynamic>) {
        // Add the selected recipe to the menu
        setState(() {
          _menuDays[day]!.add({
            'id': selectedRecipe['id'],
            'title': selectedRecipe['title'],
            'meal_type': mealType,
            'description': selectedRecipe['description'],
          });
        });
      } else {
        // If no recipe was selected, show manual entry dialog
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Text('Add $mealType for $day'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Enter recipe details:'),
                SizedBox(height: 16),
                TextField(
                  decoration: InputDecoration(
                    labelText: 'Recipe Title',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (value) {
                    if (value.isNotEmpty) {
                      Navigator.pop(context);
                      // Add a manually entered recipe
                      setState(() {
                        _menuDays[day]!.add({
                          'title': value,
                          'meal_type': mealType,
                        });
                      });
                    }
                  },
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  // Add a placeholder recipe
                  setState(() {
                    _menuDays[day]!.add({
                      'title': 'Sample Recipe',
                      'meal_type': mealType,
                    });
                  });
                },
                child: Text('Add Sample Recipe'),
              ),
            ],
          ),
        );
      }
    });
  }
  
  void _removeMeal(String day, int index) {
    // Ensure the day exists and has a valid list
    if (_menuDays.containsKey(day) && _menuDays[day] != null && index < _menuDays[day]!.length) {
      setState(() {
        _menuDays[day]!.removeAt(index);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Create Menu for ${widget.clientName}"),
      ),
      body: _isLoading || _isGenerating
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 20),
                  Text(
                    _isGenerating 
                        ? "Generating menu with AI..." 
                        : "Creating menu...",
                    style: TextStyle(fontSize: 16),
                  ),
                  if (_isGenerating)
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                      child: Text(
                        "This may take a minute to generate a personalized menu based on client preferences",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey[600],
                        ),
                      ),
                    ),
                ],
              ),
            )
          : Form(
              key: _formKey,
              child: ListView(
                padding: EdgeInsets.all(16),
                children: [
                  if (_errorMessage.isNotEmpty)
                    Container(
                      padding: EdgeInsets.all(12),
                      margin: EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red[100],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage,
                              style: TextStyle(color: Colors.red[900]),
                            ),
                          ),
                        ],
                      ),
                    ),
                  TextFormField(
                    controller: _menuTitleController,
                    decoration: InputDecoration(
                      labelText: 'Menu Title',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter a menu title';
                      }
                      return null;
                    },
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: _menuDescriptionController,
                    decoration: InputDecoration(
                      labelText: 'Description (Optional)',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                  ),
                  SizedBox(height: 24),
                  
                  // AI Menu Generation Section
                  Card(
                    color: Colors.blue[50],
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.auto_awesome, color: Colors.blue[800]),
                              SizedBox(width: 8),
                              Text(
                                "AI Menu Generation",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.blue[800],
                                ),
                              ),
                              Spacer(),
                              IconButton(
                                icon: Icon(
                                  _showAIOptionsExpanded 
                                      ? Icons.expand_less 
                                      : Icons.expand_more,
                                  color: Colors.blue[800],
                                ),
                                onPressed: () {
                                  setState(() {
                                    _showAIOptionsExpanded = !_showAIOptionsExpanded;
                                  });
                                },
                              ),
                            ],
                          ),
                          if (_showAIOptionsExpanded) ...[
                            SizedBox(height: 16),
                            Text(
                              "Generate a complete menu based on ${widget.clientName}'s preferences",
                              style: TextStyle(
                                color: Colors.blue[800],
                              ),
                            ),
                            SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text("Number of Days:"),
                                      SizedBox(height: 8),
                                      DropdownButtonFormField<int>(
                                        value: _selectedDays,
                                        decoration: InputDecoration(
                                          border: OutlineInputBorder(),
                                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        ),
                                        items: _daysOptions.map((days) {
                                          return DropdownMenuItem<int>(
                                            value: days,
                                            child: Text("$days days"),
                                          );
                                        }).toList(),
                                        onChanged: (value) {
                                          if (value != null) {
                                            setState(() {
                                              _selectedDays = value;
                                            });
                                          }
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text("AI Model:"),
                                      SizedBox(height: 8),
                                      DropdownButtonFormField<String>(
                                        value: _selectedModel,
                                        decoration: InputDecoration(
                                          border: OutlineInputBorder(),
                                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        ),
                                        items: _modelOptions.map((model) {
                                          return DropdownMenuItem<String>(
                                            value: model,
                                            child: Text(model),
                                          );
                                        }).toList(),
                                        onChanged: (value) {
                                          if (value != null) {
                                            setState(() {
                                              _selectedModel = value;
                                            });
                                          }
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 16),
                            if (_clientPreferences.isNotEmpty)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Client Preferences:",
                                    style: TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  SizedBox(height: 8),
                                  if (_clientPreferences.containsKey('diet_type'))
                                    ListTile(
                                      leading: Icon(Icons.restaurant_menu, size: 20),
                                      title: Text("Diet Type: ${_clientPreferences['diet_type']}"),
                                      dense: true,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  if (_clientPreferences.containsKey('calorie_goal'))
                                    ListTile(
                                      leading: Icon(Icons.whatshot, size: 20),
                                      title: Text("Calorie Goal: ${_clientPreferences['calorie_goal']} calories"),
                                      dense: true,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  if (_clientPreferences.containsKey('dietary_restrictions') && 
                                      _clientPreferences['dietary_restrictions'] is List &&
                                      (_clientPreferences['dietary_restrictions'] as List).isNotEmpty)
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        ListTile(
                                          leading: Icon(Icons.not_interested, size: 20),
                                          title: Text("Dietary Restrictions:"),
                                          dense: true,
                                          contentPadding: EdgeInsets.zero,
                                        ),
                                        Padding(
                                          padding: EdgeInsets.only(left: 24),
                                          child: Wrap(
                                            spacing: 8,
                                            runSpacing: 8,
                                            children: (_clientPreferences['dietary_restrictions'] as List)
                                                .map<Widget>((restriction) => Chip(
                                                      label: Text(restriction.toString()),
                                                      backgroundColor: Colors.red[100],
                                                      labelStyle: TextStyle(fontSize: 12),
                                                    ))
                                                .toList(),
                                          ),
                                        ),
                                      ],
                                    ),
                                ],
                              )
                            else
                              Text(
                                "No client preferences found. The menu will be generated with default settings.",
                                style: TextStyle(fontStyle: FontStyle.italic),
                              ),
                          ],
                          SizedBox(height: 16),
                          Center(
                            child: ElevatedButton.icon(
                              icon: Icon(Icons.auto_awesome),
                              label: Text("Generate Menu with AI"),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue[700],
                                foregroundColor: Colors.white,
                                padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                              ),
                              onPressed: _generateMenuWithAI,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Menu Schedule',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      OutlinedButton.icon(
                        icon: Icon(Icons.clear_all),
                        label: Text('Clear All'),
                        onPressed: () {
                          showDialog(
                            context: context,
                            builder: (context) => AlertDialog(
                              title: Text('Clear Menu?'),
                              content: Text('This will remove all meals from the menu. Are you sure?'),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(context),
                                  child: Text('Cancel'),
                                ),
                                ElevatedButton(
                                  onPressed: () {
                                    setState(() {
                                      // Reset menu days
                                      _menuDays = {
                                        'Monday': <Map<String, dynamic>>[],
                                        'Tuesday': <Map<String, dynamic>>[],
                                        'Wednesday': <Map<String, dynamic>>[],
                                        'Thursday': <Map<String, dynamic>>[],
                                        'Friday': <Map<String, dynamic>>[],
                                        'Saturday': <Map<String, dynamic>>[],
                                        'Sunday': <Map<String, dynamic>>[],
                                      };
                                    });
                                    Navigator.pop(context);
                                  },
                                  child: Text('Clear Menu'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.red,
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  
                  // Menu days
                  ..._menuDays.entries.map((entry) {
                    final day = entry.key;
                    final meals = entry.value;
                    
                    return Card(
                      margin: EdgeInsets.only(bottom: 16),
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  day,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                ElevatedButton.icon(
                                  icon: Icon(Icons.add),
                                  label: Text('Add Meal'),
                                  onPressed: () => _addMeal(day),
                                  style: ElevatedButton.styleFrom(
                                    padding: EdgeInsets.symmetric(horizontal: 8),
                                  ),
                                ),
                              ],
                            ),
                            if (meals.isEmpty)
                              Padding(
                                padding: EdgeInsets.symmetric(vertical: 16),
                                child: Center(
                                  child: Text(
                                    'No meals added for $day',
                                    style: TextStyle(
                                      color: Colors.grey[600],
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ),
                              )
                            else
                              ListView.builder(
                                shrinkWrap: true,
                                physics: NeverScrollableScrollPhysics(),
                                itemCount: meals.length,
                                itemBuilder: (context, index) {
                                  final meal = meals[index];
                                  final mealType = meal['meal_type'] ?? 'meal';
                                  final mealTitle = meal['title'] ?? 'Untitled Recipe';
                                  
                                  // Capitalize first letter of meal type
                                  final capitalizedMealType = mealType.substring(0, 1).toUpperCase() + mealType.substring(1);
                                  
                                  return ListTile(
                                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                                    leading: _getMealTypeIcon(mealType),
                                    title: Text(mealTitle),
                                    subtitle: Text(capitalizedMealType),
                                    trailing: IconButton(
                                      icon: Icon(Icons.delete_outline, color: Colors.red),
                                      onPressed: () => _removeMeal(day, index),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                  
                  SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _createClientMenu,
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        'Create and Share Menu',
                        style: TextStyle(fontSize: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
  
  Widget _getMealTypeIcon(String mealType) {
    IconData iconData;
    Color iconColor;
    
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        iconData = Icons.free_breakfast;
        iconColor = Colors.orange;
        break;
      case 'lunch':
        iconData = Icons.lunch_dining;
        iconColor = Colors.green;
        break;
      case 'dinner':
        iconData = Icons.dinner_dining;
        iconColor = Colors.blue;
        break;
      case 'snack':
        iconData = Icons.apple;
        iconColor = Colors.red;
        break;
      case 'dessert':
        iconData = Icons.cake;
        iconColor = Colors.pink;
        break;
      default:
        iconData = Icons.restaurant;
        iconColor = Colors.grey;
    }
    
    return CircleAvatar(
      backgroundColor: iconColor.withOpacity(0.2),
      child: Icon(iconData, color: iconColor),
    );
  }
}