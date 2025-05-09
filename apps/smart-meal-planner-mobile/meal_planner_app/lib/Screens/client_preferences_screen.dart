import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientPreferencesScreen extends StatefulWidget {
  final int clientId;
  final String clientName;
  final int userId;
  final String authToken;

  ClientPreferencesScreen({
    required this.clientId,
    required this.clientName,
    required this.userId,
    required this.authToken,
  });

  @override
  _ClientPreferencesScreenState createState() => _ClientPreferencesScreenState();
}

class _ClientPreferencesScreenState extends State<ClientPreferencesScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  Map<String, dynamic> _preferences = {};
  Map<String, dynamic> _editedPreferences = {};
  String _errorMessage = '';
  bool _isEditing = false;
  
  // Form controllers
  final _calorieController = TextEditingController();
  final _proteinController = TextEditingController();
  final _carbsController = TextEditingController();
  final _fatController = TextEditingController();
  final _dietTypeController = TextEditingController();
  final _restrictionsController = TextEditingController();
  
  // Available diet types
  final List<String> _dietTypes = [
    'Mixed', 'Vegetarian', 'Vegan', 'Pescatarian', 
    'Keto', 'Paleo', 'Mediterranean', 'Low Carb', 
    'High Protein', 'Gluten Free'
  ];
  
  // Common dietary restrictions
  final List<String> _commonRestrictions = [
    'Gluten', 'Dairy', 'Nuts', 'Shellfish', 'Eggs', 
    'Soy', 'Fish', 'Red Meat', 'Pork', 'Beef'
  ];
  
  // Selected restrictions
  List<String> _selectedRestrictions = [];

  @override
  void initState() {
    super.initState();
    _loadClientPreferences();
  }
  
  @override
  void dispose() {
    _calorieController.dispose();
    _proteinController.dispose();
    _carbsController.dispose();
    _fatController.dispose();
    _dietTypeController.dispose();
    _restrictionsController.dispose();
    super.dispose();
  }

  Future<void> _loadClientPreferences() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getClientPreferences(
        widget.clientId,
        widget.authToken,
      );
      
      print("Client Preferences API Result: $result");

      // Make sure result is a Map before proceeding
      if (result is Map<String, dynamic>) {
        // First check if result itself is a Map of preferences
        if (result.keys.toList().any((key) => 
            ['diet_type', 'dietary_restrictions', 'calorie_goal', 'macro_protein'].contains(key))) {
          setState(() {
            _preferences = Map<String, dynamic>.from(result);
            _editedPreferences = Map<String, dynamic>.from(result);
          });
          print("Using result directly as preferences");
        } 
        // Then check if it has a preferences field
        else if (result.containsKey('preferences') && result['preferences'] != null) {
          setState(() {
            _preferences = result['preferences'] is Map 
                ? Map<String, dynamic>.from(result['preferences'])
                : {};
            _editedPreferences = Map<String, dynamic>.from(_preferences);
          });
          print("Found 'preferences' key in response");
        } 
        // Check for error
        else if (result.containsKey('error')) {
          setState(() {
            _errorMessage = result['error'] ?? 'Failed to load preferences';
          });
          print("Error found in response: $_errorMessage");
        } 
        // If there's no obvious structure, just use the entire result
        else {
          setState(() {
            _preferences = Map<String, dynamic>.from(result);
            _editedPreferences = Map<String, dynamic>.from(result);
          });
          print("Using entire result as preferences (no recognized structure)");
        }
        
        // Set up controllers with initial values
        _initializeControllers();
        
        // Set up selected restrictions
        _initializeRestrictions();
      } else {
        setState(() {
          _errorMessage = 'Unexpected response format';
        });
        print("Unexpected response format: ${result.runtimeType}");
      }
      
      // Add debug info
      print("Processed preferences: $_preferences");
      if (_preferences.isEmpty) {
        print("Warning: Preferences are empty!");
      }
    } catch (e) {
      print("Error loading client preferences: $e");
      setState(() {
        _errorMessage = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }
  
  void _initializeControllers() {
    // Set calorie goal
    if (_preferences.containsKey('calorie_goal')) {
      _calorieController.text = _preferences['calorie_goal']?.toString() ?? '2000';
    } else {
      _calorieController.text = '2000';
    }
    
    // Set macro values
    if (_preferences.containsKey('macro_protein')) {
      _proteinController.text = _preferences['macro_protein']?.toString() ?? '30';
    } else {
      _proteinController.text = '30';
    }
    
    if (_preferences.containsKey('macro_carbs')) {
      _carbsController.text = _preferences['macro_carbs']?.toString() ?? '40';
    } else {
      _carbsController.text = '40';
    }
    
    if (_preferences.containsKey('macro_fat')) {
      _fatController.text = _preferences['macro_fat']?.toString() ?? '30';
    } else {
      _fatController.text = '30';
    }
    
    // Set diet type
    if (_preferences.containsKey('diet_type')) {
      _dietTypeController.text = _preferences['diet_type']?.toString() ?? 'Mixed';
    } else {
      _dietTypeController.text = 'Mixed';
    }
  }
  
  void _initializeRestrictions() {
    _selectedRestrictions = [];
    
    if (_preferences.containsKey('dietary_restrictions') && 
        _preferences['dietary_restrictions'] is List) {
      
      final restrictions = _preferences['dietary_restrictions'] as List;
      for (var restriction in restrictions) {
        _selectedRestrictions.add(restriction.toString());
      }
    }
  }
  
  Future<void> _savePreferences() async {
    setState(() {
      _isSaving = true;
    });
    
    try {
      // Update the edited preferences with form values
      _editedPreferences['calorie_goal'] = int.tryParse(_calorieController.text) ?? 2000;
      _editedPreferences['macro_protein'] = int.tryParse(_proteinController.text) ?? 30;
      _editedPreferences['macro_carbs'] = int.tryParse(_carbsController.text) ?? 40;
      _editedPreferences['macro_fat'] = int.tryParse(_fatController.text) ?? 30;
      _editedPreferences['diet_type'] = _dietTypeController.text;
      _editedPreferences['dietary_restrictions'] = _selectedRestrictions;
      
      // Save to API
      final result = await ApiService.updatePreferences(
        userId: widget.clientId,
        authToken: widget.authToken,
        preferences: _editedPreferences,
      );
      
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Preferences updated successfully'))
        );
        
        // Update local preferences
        setState(() {
          _preferences = Map<String, dynamic>.from(_editedPreferences);
          _isEditing = false;
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update preferences: ${result['error'] ?? "Unknown error"}'))
        );
      }
    } catch (e) {
      print("Error saving preferences: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'))
      );
    } finally {
      setState(() {
        _isSaving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.clientName}'s Preferences"),
        actions: [
          if (!_isEditing)
            IconButton(
              icon: Icon(Icons.edit),
              tooltip: 'Edit Preferences',
              onPressed: () {
                setState(() {
                  _isEditing = true;
                  _editedPreferences = Map<String, dynamic>.from(_preferences);
                  
                  // Initialize controllers with current values
                  _initializeControllers();
                  _initializeRestrictions();
                });
              },
            ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _errorMessage.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.red),
                      SizedBox(height: 16),
                      Text(
                        _errorMessage,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16),
                      ),
                      SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: _loadClientPreferences,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _preferences.isEmpty
                  ? _buildEmptyState()
                  : _isEditing 
                      ? _buildPreferencesEditForm()
                      : _buildPreferencesView(),
      floatingActionButton: _isEditing 
          ? FloatingActionButton(
              onPressed: _isSaving ? null : _savePreferences,
              tooltip: 'Save Preferences',
              child: _isSaving 
                  ? CircularProgressIndicator(color: Colors.white)
                  : Icon(Icons.save),
            )
          : null,
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.settings_outlined, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "No Preferences Set",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "${widget.clientName} hasn't set any preferences yet",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton.icon(
                icon: Icon(Icons.refresh),
                label: Text('Refresh'),
                onPressed: _loadClientPreferences,
              ),
              SizedBox(width: 16),
              ElevatedButton.icon(
                icon: Icon(Icons.edit),
                label: Text('Create Preferences'),
                onPressed: () {
                  setState(() {
                    _isEditing = true;
                    // Initialize with default values
                    _preferences = {
                      'diet_type': 'Mixed',
                      'dietary_restrictions': [],
                      'calorie_goal': 2000,
                      'macro_protein': 30,
                      'macro_carbs': 40,
                      'macro_fat': 30,
                    };
                    _editedPreferences = Map<String, dynamic>.from(_preferences);
                    _initializeControllers();
                    _initializeRestrictions();
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPreferencesView() {
    List<Widget> preferenceWidgets = [];
    
    // Display diet type
    if (_preferences.containsKey('diet_type') && 
        _preferences['diet_type'] != null) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Diet Type",
          Icon(Icons.fastfood, color: Colors.green),
          Text(
            _preferences['diet_type'].toString(),
            style: TextStyle(fontSize: 16),
          ),
        ),
      );
    }
    
    // Display dietary restrictions
    if (_preferences.containsKey('dietary_restrictions') && 
        _preferences['dietary_restrictions'] is List) {
      
      final restrictions = _preferences['dietary_restrictions'] as List;
      
      if (restrictions.isNotEmpty) {
        preferenceWidgets.add(
          _buildPreferenceSection(
            "Dietary Restrictions",
            Icon(Icons.no_food, color: Colors.red),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: restrictions
                      .map((restriction) => Chip(
                            label: Text(restriction.toString()),
                            backgroundColor: Colors.red[100],
                          ))
                      .toList(),
                ),
              ],
            ),
          ),
        );
      }
    }
    
    // Display calorie goal
    if (_preferences.containsKey('calorie_goal') && 
        _preferences['calorie_goal'] != null) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Calorie Goal",
          Icon(Icons.monitor_weight, color: Colors.blue),
          Text(
            "${_preferences['calorie_goal']} calories per day",
            style: TextStyle(fontSize: 16),
          ),
        ),
      );
    }
    
    // Display macro goals
    if (_preferences.containsKey('macro_protein') && 
        _preferences.containsKey('macro_carbs') && 
        _preferences.containsKey('macro_fat')) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Macro Targets",
          Icon(Icons.pie_chart, color: Colors.green),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildMacroRow("Protein", _preferences['macro_protein'], Colors.red),
              _buildMacroRow("Carbs", _preferences['macro_carbs'], Colors.blue),
              _buildMacroRow("Fat", _preferences['macro_fat'], Colors.yellow[700]!),
            ],
          ),
        ),
      );
    }
    
    // Display allergies if present
    if (_preferences.containsKey('allergies') && 
        _preferences['allergies'] is List &&
        (_preferences['allergies'] as List).isNotEmpty) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Allergies",
          Icon(Icons.dangerous, color: Colors.red),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: (_preferences['allergies'] as List)
                .map((allergy) => Chip(
                      label: Text(allergy.toString()),
                      backgroundColor: Colors.red[100],
                    ))
                .toList(),
          ),
        ),
      );
    }
    
    // Display other preferences
    List<Widget> otherPreferences = [];
    _preferences.forEach((key, value) {
      // Skip already displayed preferences
      if (['diet_type', 'dietary_restrictions', 'calorie_goal', 
           'macro_protein', 'macro_carbs', 'macro_fat', 'allergies'].contains(key)) {
        return;
      }
      
      // Skip empty lists or maps
      if ((value is List && value.isEmpty) || 
          (value is Map && value.isEmpty)) {
        return;
      }
      
      // Format key name
      final formattedKey = key
          .split('_')
          .map((word) => word.isNotEmpty 
              ? word[0].toUpperCase() + word.substring(1) 
              : '')
          .join(' ');
      
      // Format value based on type
      String formattedValue;
      if (value is List) {
        formattedValue = value.join(', ');
      } else if (value is Map) {
        formattedValue = value.entries
            .map((e) => "${e.key}: ${e.value}")
            .join(', ');
      } else {
        formattedValue = value.toString();
      }
      
      otherPreferences.add(
        ListTile(
          title: Text(formattedKey),
          subtitle: Text(formattedValue),
        ),
      );
    });
    
    if (otherPreferences.isNotEmpty) {
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Other Preferences",
          Icon(Icons.more_horiz, color: Colors.purple),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: otherPreferences,
          ),
        ),
      );
    }
    
    // If no preferences were added, show message
    if (preferenceWidgets.isEmpty) {
      return _buildEmptyState();
    }
    
    return ListView(
      padding: EdgeInsets.all(16),
      children: preferenceWidgets,
    );
  }
  
  Widget _buildPreferencesEditForm() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Edit Preferences for ${widget.clientName}",
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).primaryColor,
            ),
          ),
          SizedBox(height: 24),
          
          // Diet Type
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Diet Type",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _dietTypeController.text,
                    decoration: InputDecoration(
                      labelText: 'Select Diet Type',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (String? newValue) {
                      if (newValue != null) {
                        setState(() {
                          _dietTypeController.text = newValue;
                        });
                      }
                    },
                    items: _dietTypes.map<DropdownMenuItem<String>>((String value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text(value),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          
          // Dietary Restrictions
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Dietary Restrictions",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  Text("Select all that apply:"),
                  SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _commonRestrictions.map((restriction) {
                      final isSelected = _selectedRestrictions.contains(restriction);
                      return FilterChip(
                        label: Text(restriction),
                        selected: isSelected,
                        onSelected: (bool selected) {
                          setState(() {
                            if (selected) {
                              _selectedRestrictions.add(restriction);
                            } else {
                              _selectedRestrictions.remove(restriction);
                            }
                          });
                        },
                        selectedColor: Colors.red[100],
                        checkmarkColor: Colors.red[800],
                      );
                    }).toList(),
                  ),
                  SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _restrictionsController,
                          decoration: InputDecoration(
                            labelText: 'Add Custom Restriction',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () {
                          final restriction = _restrictionsController.text.trim();
                          if (restriction.isNotEmpty) {
                            setState(() {
                              _selectedRestrictions.add(restriction);
                              _restrictionsController.clear();
                            });
                          }
                        },
                        child: Icon(Icons.add),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  if (_selectedRestrictions.isNotEmpty)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Selected Restrictions:",
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _selectedRestrictions.map((restriction) => Chip(
                            label: Text(restriction),
                            onDeleted: () {
                              setState(() {
                                _selectedRestrictions.remove(restriction);
                              });
                            },
                            backgroundColor: Colors.red[100],
                            deleteIconColor: Colors.red[800],
                          )).toList(),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          
          // Calorie Goal
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Daily Calorie Goal",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: _calorieController,
                    decoration: InputDecoration(
                      labelText: 'Calories per day',
                      border: OutlineInputBorder(),
                      suffixText: 'calories',
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          
          // Macro Goals
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Macro Nutrient Goals",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Protein %"),
                            SizedBox(height: 8),
                            TextFormField(
                              controller: _proteinController,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(),
                                suffixText: '%',
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Carbs %"),
                            SizedBox(height: 8),
                            TextFormField(
                              controller: _carbsController,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(),
                                suffixText: '%',
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("Fat %"),
                            SizedBox(height: 8),
                            TextFormField(
                              controller: _fatController,
                              decoration: InputDecoration(
                                border: OutlineInputBorder(),
                                suffixText: '%',
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),
                  Text(
                    "Note: Macros should add up to 100%",
                    style: TextStyle(
                      fontStyle: FontStyle.italic,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 32),
          
          // Bottom button row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              OutlinedButton.icon(
                icon: Icon(Icons.cancel),
                label: Text('Cancel'),
                onPressed: () {
                  setState(() {
                    _isEditing = false;
                  });
                },
              ),
              ElevatedButton.icon(
                icon: Icon(Icons.save),
                label: Text('Save Preferences'),
                onPressed: _isSaving ? null : _savePreferences,
              ),
            ],
          ),
          SizedBox(height: 40), // Extra space at bottom for FAB
        ],
      ),
    );
  }

  Widget _buildPreferenceSection(String title, Icon icon, Widget content) {
    return Card(
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                icon,
                SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            Divider(),
            SizedBox(height: 8),
            content,
          ],
        ),
      ),
    );
  }
  
  Widget _buildMacroRow(String label, dynamic value, Color color) {
    double percentage = 0;
    
    try {
      if (value is int) {
        percentage = value / 100;
      } else if (value is double) {
        percentage = value;
      } else if (value is String) {
        // Try to parse as a number
        percentage = double.tryParse(value) ?? 0;
        // If it's a percentage string, convert to decimal
        if (value.contains('%')) {
          percentage = percentage / 100;
        }
      }
    } catch (e) {
      print("Error parsing macro value: $e");
    }
    
    // Ensure percentage is in decimal form (0-1)
    if (percentage > 1) {
      percentage = percentage / 100;
    }
    
    // Limit to 0-1 range
    percentage = percentage.clamp(0.0, 1.0);
    
    // Display as percentage
    final displayPercentage = (percentage * 100).toStringAsFixed(0);
    
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 80,
                child: Text(
                  label,
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              Text("$displayPercentage%"),
            ],
          ),
          SizedBox(height: 4),
          LinearProgressIndicator(
            value: percentage,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}