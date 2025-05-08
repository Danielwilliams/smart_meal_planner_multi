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
  String _errorMessage = '';
  final _formKey = GlobalKey<FormState>();
  final _menuTitleController = TextEditingController();
  final _menuDescriptionController = TextEditingController();
  
  // Menu data
  Map<String, List<Map<String, dynamic>>> _menuDays = {
    'Monday': [],
    'Tuesday': [],
    'Wednesday': [],
    'Thursday': [],
    'Friday': [],
    'Saturday': [],
    'Sunday': [],
  };
  
  @override
  void initState() {
    super.initState();
    
    // Set a default menu title
    _menuTitleController.text = "Menu for ${widget.clientName}";
    
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
        SnackBar(content: Text('Please add at least one meal to the menu')),
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
        if (meals.isNotEmpty) {
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
  
  void _addMeal(String day) {
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
                  // Add a placeholder recipe
                  setState(() {
                    _menuDays[day]!.add({
                      'title': value,
                      'meal_type': mealType,
                      // In a real app, you would add more recipe details here
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
                  // In a real app, you would add more recipe details here
                });
              });
            },
            child: Text('Add Sample Recipe'),
          ),
        ],
      ),
    );
  }
  
  void _removeMeal(String day, int index) {
    setState(() {
      _menuDays[day]!.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Create Menu for ${widget.clientName}"),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
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
                  Text(
                    'Menu Schedule',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
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