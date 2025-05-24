import 'package:flutter/material.dart';
import '../models/menu_model.dart';
import '../services/api_service.dart';
// Model selection dialog is integrated directly

class CustomMenuScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  CustomMenuScreen({required this.userId, required this.authToken});

  @override
  _CustomMenuScreenState createState() => _CustomMenuScreenState();
}

class _CustomMenuScreenState extends State<CustomMenuScreen> {
  bool _isLoading = false;
  final List<String> _selectedMealTypes = ['breakfast', 'lunch', 'dinner'];
  int _selectedDurationDays = 7;
  final List<int> _availableDurations = [1, 3, 5, 7, 14, 21, 28];
  
  // Dietary preferences
  List<String> _selectedDietaryRestrictions = [];
  final List<String> _availableDietaryRestrictions = [
    'Vegan', 
    'Vegetarian', 
    'Gluten-Free', 
    'Dairy-Free', 
    'Nut-Free',
    'Low-Carb',
    'Keto',
    'Paleo',
  ];
  
  // Advanced options
  double _caloriesPerDay = 2000;
  double _proteinPercentage = 30;
  double _carbsPercentage = 40;
  double _fatPercentage = 30;
  
  // Complexity
  double _complexity = 2;
  
  // Other options
  bool _allowLeftovers = true;
  bool _familyFriendly = false;
  bool _quickMeals = false;
  
  // AI model selection
  String _selectedModel = 'default';

  // Show the model selection dialog
  void _showModelSelectionDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        // Local variable to track selected model in the dialog
        String selectedModel = _selectedModel;
        
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text('Select AI Model'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Choose the AI model to use for recipe generation:',
                      style: TextStyle(fontSize: 16),
                    ),
                    SizedBox(height: 8),
                    _buildModelOption(
                      context, 
                      'default',
                      'Standard',
                      'Default menu generation without customization',
                      selectedModel,
                      (value) => setState(() => selectedModel = value),
                    ),
                    _buildModelOption(
                      context,
                      'enhanced',
                      'Enhanced',
                      'Better recipe variety and customization',
                      selectedModel,
                      (value) => setState(() => selectedModel = value),
                    ),
                    _buildModelOption(
                      context,
                      'hybrid',
                      'Hybrid',
                      'Combines standard and enhanced features for balanced results',
                      selectedModel,
                      (value) => setState(() => selectedModel = value),
                    ),
                    _buildModelOption(
                      context,
                      'local',
                      'Locally Trained',
                      'Uses your locally trained model for personalized results',
                      selectedModel,
                      (value) => setState(() => selectedModel = value),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  child: Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    // Update the parent state with the selected model
                    this.setState(() {
                      _selectedModel = selectedModel;
                    });
                    Navigator.of(context).pop();
                  },
                  child: Text('Select'),
                ),
              ],
            );
          },
        );
      },
    );
  }
  
  // Helper method to build a model option in the dialog
  Widget _buildModelOption(
    BuildContext context,
    String value, 
    String title, 
    String description,
    String groupValue,
    Function(String) onChanged,
  ) {
    return RadioListTile<String>(
      title: Text(
        title,
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      subtitle: Text(description),
      value: value,
      groupValue: groupValue,
      onChanged: (newValue) => onChanged(newValue!),
    );
  }

  Future<void> _generateCustomMenu() async {
    if (_selectedMealTypes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Please select at least one meal type'))
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Prepare menu parameters for the API
      final menuParameters = {
        'meal_types': _selectedMealTypes,
        'duration_days': _selectedDurationDays,
        'dietary_restrictions': _selectedDietaryRestrictions,
        'target_calories': _caloriesPerDay.toInt(),
        'macros': {
          'protein': _proteinPercentage.toInt(),
          'carbs': _carbsPercentage.toInt(),
          'fat': _fatPercentage.toInt(),
        },
        'complexity': _complexity.toInt(),
        'allow_leftovers': _allowLeftovers,
        'family_friendly': _familyFriendly,
        'quick_meals': _quickMeals,
        'model': _selectedModel, // Include the selected AI model
      };

      // Call the API to generate menu
      final result = await ApiService.generateMenu(
        userId: widget.userId,
        authToken: widget.authToken,
        menuParameters: menuParameters,
      );

      setState(() {
        _isLoading = false;
      });

      // Handle successful menu generation
      if (result != null && result.containsKey('menu')) {
        // Navigate back to menu screen which will show the new menu
        Navigator.pop(context, true);
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Menu generated successfully!'))
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate menu'))
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'))
      );
    }
  }

  void _toggleMealType(String mealType) {
    setState(() {
      if (_selectedMealTypes.contains(mealType)) {
        _selectedMealTypes.remove(mealType);
      } else {
        _selectedMealTypes.add(mealType);
      }
    });
  }

  void _toggleDietaryRestriction(String restriction) {
    setState(() {
      if (_selectedDietaryRestrictions.contains(restriction)) {
        _selectedDietaryRestrictions.remove(restriction);
      } else {
        _selectedDietaryRestrictions.add(restriction);
      }
    });
  }

  String _getComplexityDescription() {
    switch (_complexity.toInt()) {
      case 1:
        return 'Simple - Basic recipes with few ingredients';
      case 2:
        return 'Medium - Balanced complexity for everyday cooking';
      case 3:
        return 'Complex - Sophisticated recipes for culinary enthusiasts';
      default:
        return 'Medium - Balanced complexity';
    }
  }
  
  String _getModelDescription() {
    switch (_selectedModel) {
      case 'enhanced':
        return 'Enhanced - Better recipe variety and customization';
      case 'hybrid':
        return 'Hybrid - Balanced mix of standard and enhanced features';
      case 'local':
        return 'Locally Trained - Uses your personalized model';
      default:
        return 'Standard - Default menu generation';
    }
  }
  
  // Ensure macros always add up to 100%
  void _updateMacros(String type, double value) {
    // Validate value is between 0 and 100
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    
    setState(() {
      // Calculate the change
      double delta = 0;
      
      if (type == 'protein') {
        delta = value - _proteinPercentage;
        _proteinPercentage = value;
      } else if (type == 'carbs') {
        delta = value - _carbsPercentage;
        _carbsPercentage = value;
      } else if (type == 'fat') {
        delta = value - _fatPercentage;
        _fatPercentage = value;
      }
      
      // Adjust the other macros proportionally
      if (delta != 0) {
        if (type != 'protein' && type != 'carbs') {
          // If adjusting fat, split the difference between protein and carbs
          double proteinRatio = _proteinPercentage / (_proteinPercentage + _carbsPercentage);
          _proteinPercentage -= delta * proteinRatio;
          _carbsPercentage -= delta * (1 - proteinRatio);
        } else if (type != 'protein' && type != 'fat') {
          // If adjusting carbs, split the difference between protein and fat
          double proteinRatio = _proteinPercentage / (_proteinPercentage + _fatPercentage);
          _proteinPercentage -= delta * proteinRatio;
          _fatPercentage -= delta * (1 - proteinRatio);
        } else if (type != 'carbs' && type != 'fat') {
          // If adjusting protein, split the difference between carbs and fat
          double carbsRatio = _carbsPercentage / (_carbsPercentage + _fatPercentage);
          _carbsPercentage -= delta * carbsRatio;
          _fatPercentage -= delta * (1 - carbsRatio);
        }
      }
      
      // Ensure all values are non-negative
      _proteinPercentage = _proteinPercentage < 0 ? 0 : _proteinPercentage;
      _carbsPercentage = _carbsPercentage < 0 ? 0 : _carbsPercentage;
      _fatPercentage = _fatPercentage < 0 ? 0 : _fatPercentage;
      
      // Normalize to 100%
      double total = _proteinPercentage + _carbsPercentage + _fatPercentage;
      if (total > 0) {
        _proteinPercentage = (_proteinPercentage / total) * 100;
        _carbsPercentage = (_carbsPercentage / total) * 100;
        _fatPercentage = (_fatPercentage / total) * 100;
      } else {
        // Default to equal distribution if all are zero
        _proteinPercentage = _carbsPercentage = _fatPercentage = 33.33;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Custom Menu Builder'),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Meal types selection
                  Text(
                    'Meal Types',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      _buildMealTypeChip('breakfast', 'Breakfast'),
                      SizedBox(width: 8),
                      _buildMealTypeChip('lunch', 'Lunch'),
                      SizedBox(width: 8),
                      _buildMealTypeChip('dinner', 'Dinner'),
                    ],
                  ),
                  
                  SizedBox(height: 24),
                  
                  // Menu duration
                  Text(
                    'Menu Duration',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _availableDurations.map((days) {
                      return ChoiceChip(
                        label: Text('$days days'),
                        selected: _selectedDurationDays == days,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() {
                              _selectedDurationDays = days;
                            });
                          }
                        },
                      );
                    }).toList(),
                  ),
                  
                  SizedBox(height: 24),
                  
                  // Dietary restrictions
                  Text(
                    'Dietary Restrictions',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _availableDietaryRestrictions.map((restriction) {
                      return FilterChip(
                        label: Text(restriction),
                        selected: _selectedDietaryRestrictions.contains(restriction),
                        onSelected: (selected) {
                          _toggleDietaryRestriction(restriction);
                        },
                      );
                    }).toList(),
                  ),
                  
                  SizedBox(height: 24),
                  
                  // Advanced options - calories and macros
                  Text(
                    'Nutrition',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 16),
                  
                  // Calories per day
                  Text('Calories per day: ${_caloriesPerDay.toInt()} kcal'),
                  Slider(
                    value: _caloriesPerDay,
                    min: 1200,
                    max: 3500,
                    divisions: 23,
                    onChanged: (value) {
                      setState(() {
                        _caloriesPerDay = value;
                      });
                    },
                  ),
                  
                  SizedBox(height: 16),
                  
                  // Macros
                  Text('Macronutrients'),
                  SizedBox(height: 8),
                  
                  // Protein
                  Row(
                    children: [
                      SizedBox(width: 100, child: Text('Protein:')),
                      Expanded(
                        child: Slider(
                          value: _proteinPercentage,
                          min: 0,
                          max: 100,
                          onChanged: (value) => _updateMacros('protein', value),
                        ),
                      ),
                      SizedBox(width: 50, child: Text('${_proteinPercentage.toInt()}%')),
                    ],
                  ),
                  
                  // Carbs
                  Row(
                    children: [
                      SizedBox(width: 100, child: Text('Carbs:')),
                      Expanded(
                        child: Slider(
                          value: _carbsPercentage,
                          min: 0,
                          max: 100,
                          onChanged: (value) => _updateMacros('carbs', value),
                        ),
                      ),
                      SizedBox(width: 50, child: Text('${_carbsPercentage.toInt()}%')),
                    ],
                  ),
                  
                  // Fat
                  Row(
                    children: [
                      SizedBox(width: 100, child: Text('Fat:')),
                      Expanded(
                        child: Slider(
                          value: _fatPercentage,
                          min: 0,
                          max: 100,
                          onChanged: (value) => _updateMacros('fat', value),
                        ),
                      ),
                      SizedBox(width: 50, child: Text('${_fatPercentage.toInt()}%')),
                    ],
                  ),
                  
                  // Macro distribution visualization
                  SizedBox(height: 8),
                  Container(
                    height: 20,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          flex: _proteinPercentage.toInt(),
                          child: Container(color: Colors.red),
                        ),
                        Expanded(
                          flex: _carbsPercentage.toInt(),
                          child: Container(color: Colors.green),
                        ),
                        Expanded(
                          flex: _fatPercentage.toInt(),
                          child: Container(color: Colors.blue),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(width: 10, height: 10, color: Colors.red),
                          SizedBox(width: 4),
                          Text('Protein', style: TextStyle(fontSize: 12)),
                        ],
                      ),
                      Row(
                        children: [
                          Container(width: 10, height: 10, color: Colors.green),
                          SizedBox(width: 4),
                          Text('Carbs', style: TextStyle(fontSize: 12)),
                        ],
                      ),
                      Row(
                        children: [
                          Container(width: 10, height: 10, color: Colors.blue),
                          SizedBox(width: 4),
                          Text('Fat', style: TextStyle(fontSize: 12)),
                        ],
                      ),
                    ],
                  ),
                  
                  SizedBox(height: 24),
                  
                  // Recipe complexity
                  Text(
                    'Recipe Complexity',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Slider(
                    value: _complexity,
                    min: 1,
                    max: 3,
                    divisions: 2,
                    label: _complexity.toInt().toString(),
                    onChanged: (value) {
                      setState(() {
                        _complexity = value;
                      });
                    },
                  ),
                  Text(
                    _getComplexityDescription(),
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  
                  SizedBox(height: 24),
                  
                  // AI Model Selection
                  Text(
                    'AI Model',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey[300]!),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _getModelDescription(),
                            style: TextStyle(fontSize: 16),
                          ),
                        ),
                      ),
                      SizedBox(width: 8),
                      ElevatedButton.icon(
                        icon: Icon(Icons.psychology),
                        label: Text('Choose Model'),
                        onPressed: _showModelSelectionDialog,
                        style: ElevatedButton.styleFrom(
                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        ),
                      ),
                    ],
                  ),
                  
                  SizedBox(height: 24),
                  
                  // Other options
                  Text(
                    'Other Options',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  SwitchListTile(
                    title: Text('Allow Leftovers'),
                    subtitle: Text('Include recipes that make multiple servings'),
                    value: _allowLeftovers,
                    onChanged: (value) {
                      setState(() {
                        _allowLeftovers = value;
                      });
                    },
                  ),
                  SwitchListTile(
                    title: Text('Family Friendly'),
                    subtitle: Text('Recipes suitable for children'),
                    value: _familyFriendly,
                    onChanged: (value) {
                      setState(() {
                        _familyFriendly = value;
                      });
                    },
                  ),
                  SwitchListTile(
                    title: Text('Quick Meals'),
                    subtitle: Text('Recipes that can be prepared in 30 minutes or less'),
                    value: _quickMeals,
                    onChanged: (value) {
                      setState(() {
                        _quickMeals = value;
                      });
                    },
                  ),
                  
                  SizedBox(height: 32),
                  
                  // Generate button
                  Center(
                    child: ElevatedButton.icon(
                      icon: Icon(Icons.restaurant_menu),
                      label: Text('GENERATE MENU'),
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      onPressed: _generateCustomMenu,
                    ),
                  ),
                  
                  SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _buildMealTypeChip(String value, String label) {
    final isSelected = _selectedMealTypes.contains(value);
    
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        _toggleMealType(value);
      },
      backgroundColor: Colors.grey[200],
      selectedColor: Theme.of(context).primaryColor.withOpacity(0.2),
      checkmarkColor: Theme.of(context).primaryColor,
    );
  }
}