import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../Providers/auth_providers.dart';
import 'kroger_auth_screen.dart';

class PreferencesScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  PreferencesScreen({required this.userId, required this.authToken});

  @override
  _PreferencesScreenState createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  Map<String, dynamic> _preferences = {};
  bool _showKrogerSetup = false;
  
  // Diet type
  String? _selectedDietType;
  String _otherDietType = '';
  
  // Dietary restrictions
  List<String> _dietaryRestrictions = [];
  
  // Disliked ingredients
  List<String> _dislikedIngredients = [];
  final TextEditingController _dislikedIngredientController = TextEditingController();
  final TextEditingController _otherDietTypeController = TextEditingController();
  final TextEditingController _otherRecipeTypeController = TextEditingController();
  
  // Recipe types
  String? _selectedRecipeType;
  String _otherRecipeType = '';
  
  // Macros
  int _calorieGoal = 2000;
  int _proteinPercentage = 30;
  int _carbsPercentage = 40;
  int _fatPercentage = 30;
  
  // Meal settings
  int _servingsPerMeal = 2;
  int _snacksPerDay = 1;
  Map<String, bool> _mealTimes = {
    'breakfast': true,
    'lunch': true,
    'dinner': true,
    'snacks': true,
  };
  
  // Appliances
  Map<String, bool> _appliances = {
    'airFryer': false,
    'instapot': false,
    'crockpot': false,
  };
  
  // Complexity level
  double _complexityLevel = 50;
  
  // New preferences (matching web app)
  // Flavor preferences
  Map<String, bool> _flavorPreferences = {
    'creamy': false,
    'cheesy': false,
    'herbs': false,
    'umami': false,
    'sweet': false,
    'spiced': false,
    'smoky': false,
    'garlicky': false,
    'tangy': false,
    'peppery': false,
    'hearty': false,
    'spicy': false
  };
  
  // Spice level
  String _spiceLevel = 'medium';
  
  // Recipe format preferences
  Map<String, bool> _recipeTypePreferences = {
    'stir-fry': false,
    'grain-bowl': false,
    'salad': false,
    'pasta': false,
    'main-sides': false,
    'pizza': false,
    'burger': false,
    'sandwich': false,
    'tacos': false,
    'wrap': false,
    'soup-stew': false,
    'bake': false,
    'family-meals': false
  };
  
  // Meal time preferences (enhanced)
  Map<String, bool> _mealTimePreferences = {
    'breakfast': false,
    'morning-snack': false,
    'lunch': false,
    'afternoon-snack': false,
    'dinner': false,
    'evening-snack': false
  };
  
  // Time constraints
  Map<String, int> _timeConstraints = {
    'weekday-breakfast': 10,
    'weekday-lunch': 15,
    'weekday-dinner': 30,
    'weekend-breakfast': 20,
    'weekend-lunch': 30,
    'weekend-dinner': 45
  };
  
  // Meal preparation preferences
  Map<String, bool> _prepPreferences = {
    'batch-cooking': false,
    'meal-prep': false,
    'quick-assembly': false,
    'one-pot': false,
    'minimal-dishes': false
  };
  
  // Function to format label from key
  String _formatLabel(String key) {
    return key.split('-')
        .map((word) => word.substring(0, 1).toUpperCase() + word.substring(1))
        .join(' ');
  }
  
  // Store credentials and settings
  // Kroger
  String _krogerZipCode = '';
  String _krogerLocationId = '';
  bool _hasKrogerAuth = false;
  String _krogerUsername = '';
  String _krogerPassword = '';
  
  // Text editing controllers for store settings
  final TextEditingController _krogerZipCodeController = TextEditingController();
  final TextEditingController _krogerLocationIdController = TextEditingController();
  final TextEditingController _krogerUsernameController = TextEditingController();
  final TextEditingController _krogerPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
  }
  
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    
    // Check if we should focus on Kroger setup
    final dynamic args = ModalRoute.of(context)?.settings.arguments;
    if (args != null && args is Map<String, dynamic> && args.containsKey('showKrogerSetup')) {
      _showKrogerSetup = args['showKrogerSetup'] == true;
    }
    
    // Always fetch preferences on first load
    _fetchPreferences();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _dislikedIngredientController.dispose();
    _otherDietTypeController.dispose();
    _otherRecipeTypeController.dispose();
    _krogerZipCodeController.dispose();
    _krogerLocationIdController.dispose();
    _krogerUsernameController.dispose();
    _krogerPasswordController.dispose();
    super.dispose();
  }

  Future<void> _fetchPreferences() async {
    setState(() => _isLoading = true);
    
    print("Fetching preferences for user ID: ${widget.userId}");
    
    try {
      // Add some default preferences in case the API fails
      Map<String, dynamic> defaultPrefs = {
        'diet_type': 'Mixed',
        'dietary_restrictions': '',
        'disliked_ingredients': '',
        'recipe_type': 'Mixed',
        'calorie_goal': 2000,
        'macro_protein': 30,
        'macro_carbs': 40,
        'macro_fat': 30,
        'servings_per_meal': 2,
        'snacks_per_day': 1,
        'meal_times': {
          'breakfast': true,
          'lunch': true,
          'dinner': true,
          'snacks': true,
        },
        'appliances': {
          'airFryer': false,
          'instapot': false,
          'crockpot': false,
        },
        'prep_complexity': 50,
        'kroger_zip_code': '',
        'kroger_location_id': '',
        'kroger_authenticated': false,
      };
      
      final result = await ApiService.getPreferences(widget.userId, widget.authToken);
      
      if (result != null) {
        print("Preferences fetched successfully: ${result.keys}");
        // Merge with defaults to ensure all fields exist
        defaultPrefs.addAll(result);
        setState(() {
          _preferences = defaultPrefs;
          
          // Set diet type - handle potential null or non-string values
          try {
            _selectedDietType = result['diet_type']?.toString() ?? 'Mixed';
            _otherDietType = result['other_diet_type']?.toString() ?? '';
            _otherDietTypeController.text = _otherDietType;
          } catch (e) {
            print("Error parsing diet type: $e");
            _selectedDietType = 'Mixed';
          }
          
          // Set dietary restrictions - with error handling
          try {
            if (result['dietary_restrictions'] != null) {
              _dietaryRestrictions = List<String>.from((result['dietary_restrictions']?.toString() ?? '')
                .split(',')
                .map((item) => item.trim())
                .where((item) => item.isNotEmpty));
            }
          } catch (e) {
            print("Error parsing dietary restrictions: $e");
            _dietaryRestrictions = [];
          }
          
          // Set disliked ingredients - with error handling
          try {
            if (result['disliked_ingredients'] != null) {
              _dislikedIngredients = List<String>.from((result['disliked_ingredients']?.toString() ?? '')
                .split(',')
                .map((item) => item.trim())
                .where((item) => item.isNotEmpty));
            }
          } catch (e) {
            print("Error parsing disliked ingredients: $e");
            _dislikedIngredients = [];
          }
          
          // Set recipe type - handle potential null or non-string values
          try {
            _selectedRecipeType = result['recipe_type']?.toString() ?? 'Mixed';
            _otherRecipeType = result['other_recipe_type']?.toString() ?? '';
            _otherRecipeTypeController.text = _otherRecipeType;
          } catch (e) {
            print("Error parsing recipe type: $e");
            _selectedRecipeType = 'Mixed';
          }
          
          // Set macros - safely parse integers
          try {
            _calorieGoal = int.tryParse(result['calorie_goal']?.toString() ?? '2000') ?? 2000;
            _proteinPercentage = int.tryParse(result['macro_protein']?.toString() ?? '30') ?? 30;
            _carbsPercentage = int.tryParse(result['macro_carbs']?.toString() ?? '40') ?? 40;
            _fatPercentage = int.tryParse(result['macro_fat']?.toString() ?? '30') ?? 30;
          } catch (e) {
            print("Error parsing macros: $e");
            _calorieGoal = 2000;
            _proteinPercentage = 30;
            _carbsPercentage = 40;
            _fatPercentage = 30;
          }
          
          // Set meal settings - safely parse integers
          try {
            _servingsPerMeal = int.tryParse(result['servings_per_meal']?.toString() ?? '2') ?? 2;
            _snacksPerDay = int.tryParse(result['snacks_per_day']?.toString() ?? '1') ?? 1;
          } catch (e) {
            print("Error parsing meal settings: $e");
            _servingsPerMeal = 2;
            _snacksPerDay = 1;
          }
          
          // Set meal times
          if (result['meal_times'] != null) {
            try {
              _mealTimes = {}; // Start with empty map
              
              // Process each entry safely, converting to bool
              (result['meal_times'] as Map<String, dynamic>).forEach((key, value) {
                _mealTimes[key] = value == true || value == "true" || value == 1;
              });
            } catch (e) {
              print("Error parsing meal_times: $e");
              // Keep default values
            }
          }
          
          // Set appliances
          if (result['appliances'] != null) {
            try {
              _appliances = {}; // Start with empty map
              
              // Process each entry safely, converting to bool
              (result['appliances'] as Map<String, dynamic>).forEach((key, value) {
                _appliances[key] = value == true || value == "true" || value == 1;
              });
            } catch (e) {
              print("Error parsing appliances: $e");
              // Keep default values
            }
          }
          
          // Set complexity level - safely parse to double
          try {
            _complexityLevel = double.tryParse(result['prep_complexity']?.toString() ?? '50') ?? 50.0;
          } catch (e) {
            print("Error parsing complexity level: $e");
            _complexityLevel = 50.0;
          }
          
          // Set new preferences fields
          
          // Flavor preferences
          try {
            if (result['flavor_preferences'] != null) {
              // Start with empty map
              _flavorPreferences = {};
              // Process each entry safely, converting to bool
              (result['flavor_preferences'] as Map<String, dynamic>).forEach((key, value) {
                _flavorPreferences[key] = value == true || value == "true" || value == 1;
              });
            }
          } catch (e) {
            print("Error parsing flavor_preferences: $e");
            // Keep default values
          }
          
          // Spice level
          try {
            _spiceLevel = result['spice_level']?.toString() ?? 'medium';
          } catch (e) {
            print("Error parsing spice_level: $e");
            _spiceLevel = 'medium';
          }
          
          // Recipe type preferences
          try {
            if (result['recipe_type_preferences'] != null) {
              // Start with empty map
              _recipeTypePreferences = {};
              // Process each entry safely, converting to bool
              (result['recipe_type_preferences'] as Map<String, dynamic>).forEach((key, value) {
                _recipeTypePreferences[key] = value == true || value == "true" || value == 1;
              });
            }
          } catch (e) {
            print("Error parsing recipe_type_preferences: $e");
            // Keep default values
          }
          
          // Meal time preferences
          try {
            if (result['meal_time_preferences'] != null) {
              // Start with empty map
              _mealTimePreferences = {};
              // Process each entry safely, converting to bool
              (result['meal_time_preferences'] as Map<String, dynamic>).forEach((key, value) {
                _mealTimePreferences[key] = value == true || value == "true" || value == 1;
              });
            }
          } catch (e) {
            print("Error parsing meal_time_preferences: $e");
            // Keep default values
          }
          
          // Time constraints
          try {
            if (result['time_constraints'] != null) {
              // Start with empty map
              _timeConstraints = {};
              // Process each entry safely, converting to int
              (result['time_constraints'] as Map<String, dynamic>).forEach((key, value) {
                _timeConstraints[key] = int.tryParse(value.toString()) ?? 30;
              });
            }
          } catch (e) {
            print("Error parsing time_constraints: $e");
            // Keep default values
          }
          
          // Meal preparation preferences
          try {
            if (result['prep_preferences'] != null) {
              // Start with empty map
              _prepPreferences = {};
              // Process each entry safely, converting to bool
              (result['prep_preferences'] as Map<String, dynamic>).forEach((key, value) {
                _prepPreferences[key] = value == true || value == "true" || value == 1;
              });
            }
          } catch (e) {
            print("Error parsing prep_preferences: $e");
            // Keep default values
          }
          
          // Get Kroger credentials from database
          String krogerZipCode = result['kroger_zip_code'] ?? '';
          String krogerLocationId = result['kroger_location_id'] ?? 
                                    result['kroger_store_location'] ?? 
                                    result['kroger_store_location_id'] ?? '';
          bool hasKrogerAuth = result['kroger_authenticated'] == true;
          String krogerUsername = result['kroger_username'] ?? '';
          String krogerPassword = result['kroger_password'] ?? '';
          
          // Check SharedPreferences for more up-to-date values
          SharedPreferences.getInstance().then((prefs) {
            // If we have a stored auth status, use that
            final localAuthStatus = prefs.getBool('kroger_authenticated');
            if (localAuthStatus != null) {
              setState(() {
                hasKrogerAuth = localAuthStatus;
                _hasKrogerAuth = localAuthStatus;
              });
            }
            
            // If we have a store location ID, use that
            final localLocationId = prefs.getString('kroger_location_id') ?? 
                                   prefs.getString('kroger_store_location');
            if (localLocationId != null && localLocationId.isNotEmpty) {
              setState(() {
                krogerLocationId = localLocationId;
                _krogerLocationId = localLocationId;
                _krogerLocationIdController.text = localLocationId;
              });
            }
            
            // If we have credentials saved locally, use those
            final localUsername = prefs.getString('kroger_username');
            if (localUsername != null && localUsername.isNotEmpty) {
              setState(() {
                krogerUsername = localUsername;
                _krogerUsername = localUsername;
                _krogerUsernameController.text = localUsername;
              });
            }
            
            final localPassword = prefs.getString('kroger_password');
            if (localPassword != null && localPassword.isNotEmpty) {
              setState(() {
                krogerPassword = localPassword;
                _krogerPassword = localPassword;
                _krogerPasswordController.text = localPassword;
              });
            }
            
            // Sync any changes back to the database if needed
            bool needsUpdate = false;
            Map<String, dynamic> updatedPrefs = {};
            
            if (localAuthStatus != null && localAuthStatus != (result['kroger_authenticated'] == true)) {
              updatedPrefs['kroger_authenticated'] = localAuthStatus;
              needsUpdate = true;
            }
            
            if (localLocationId != null && localLocationId.isNotEmpty && 
                localLocationId != (result['kroger_location_id'] ?? '')) {
              updatedPrefs['kroger_location_id'] = localLocationId;
              updatedPrefs['kroger_store_location'] = localLocationId;
              updatedPrefs['kroger_store_location_id'] = localLocationId;
              updatedPrefs['kroger_store_selected'] = true;
              needsUpdate = true;
            }
            
            if (localUsername != null && localUsername.isNotEmpty && 
                localUsername != (result['kroger_username'] ?? '')) {
              updatedPrefs['kroger_username'] = localUsername;
              needsUpdate = true;
            }
            
            if (localPassword != null && localPassword.isNotEmpty && 
                localPassword != (result['kroger_password'] ?? '')) {
              updatedPrefs['kroger_password'] = localPassword;
              needsUpdate = true;
            }
            
            // If we need to update the database, do it silently
            if (needsUpdate) {
              print("Syncing local changes back to database: ${updatedPrefs.keys}");
              
              // Schedule the update without awaiting it
              ApiService.updatePreferences(
                userId: widget.userId,
                authToken: widget.authToken,
                preferences: updatedPrefs,
              ).then((result) {
                print("Database sync completed: ${result != null ? 'Success' : 'Failed'}");
              }).catchError((error) {
                print("Error syncing to database: $error");
              });
            }
          }).catchError((e) {
            print("Error checking local preferences: $e");
          });
          
          // Set the initial values from the database
          _krogerZipCode = krogerZipCode;
          _krogerLocationId = krogerLocationId;
          _hasKrogerAuth = hasKrogerAuth;
          _krogerUsername = krogerUsername;
          _krogerPassword = krogerPassword;
          
          // Set up text controllers for store settings
          _krogerZipCodeController.text = krogerZipCode;
          _krogerLocationIdController.text = krogerLocationId;
          _krogerUsernameController.text = krogerUsername;
          _krogerPasswordController.text = krogerPassword;
          
          print("Kroger auth status: ${_hasKrogerAuth ? 'Authenticated' : 'Not authenticated'}");
          print("Kroger credentials: Username=${_krogerUsername.isNotEmpty ? 'Set' : 'Not set'}, Password=${_krogerPassword.isNotEmpty ? 'Set' : 'Not set'}");
          print("Kroger location: ZIP=${_krogerZipCode}, LocationID=${_krogerLocationId}");
          
          // If asked to show Kroger setup, switch to the Stores tab
          if (_showKrogerSetup && _tabController.length > 4) {
            _tabController.animateTo(4); // Switch to the Stores tab (index 4)
          }
          
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to load preferences"))
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error fetching preferences: $e"))
      );
    }
  }


  // Save Kroger store location to API database
  Future<void> _saveKrogerStoreLocation(String locationId) async {
    try {
      if (locationId.isEmpty) return;
      
      print("Immediately saving Kroger store location to database: $locationId");
      
      // Create a comprehensive set of preferences with all possible field names
      // This ensures compatibility with the web app which might use different field names
      final preferences = {
        // Standard field names
        'kroger_location_id': locationId,
        'kroger_store_location': locationId,
        'kroger_store_location_id': locationId,
        
        // Additional field variations used by web app
        'kroger.location_id': locationId,
        'kroger.store_location': locationId,
        'krogerLocationId': locationId,
        'krogerStoreLocation': locationId,
        
        // Status flags
        'kroger_store_selected': true,
        'kroger_store_configured': true,
        'kroger_store_selection_done': true,
        'kroger_needs_store_selection': false,
        'kroger_store_selection_required': false
      };
      
      // Update immediately in database
      ApiService.updatePreferences(
        userId: widget.userId,
        authToken: widget.authToken,
        preferences: preferences,
      ).then((result) {
        print("Database update result: ${result != null ? 'Success' : 'Failed'}");
        
        // Also save to local storage
        SharedPreferences.getInstance().then((prefs) {
          // Save location ID with all variations
          prefs.setString('kroger_store_location', locationId);
          prefs.setString('kroger_store_location_id', locationId);
          prefs.setString('kroger_location_id', locationId);
          prefs.setString('krogerStoreLocation', locationId);
          prefs.setString('krogerLocationId', locationId);
          
          // Save status flags
          prefs.setBool('kroger_store_selected', true);
          prefs.setBool('kroger_store_configured', true);
          prefs.setBool('kroger_store_selection_done', true);
          prefs.setBool('kroger_needs_store_selection', false);
          prefs.setBool('kroger_store_selection_required', false);
          
          // Save timestamp for debugging
          prefs.setString('kroger_store_selection_timestamp', DateTime.now().toIso8601String());
          
          print("Successfully saved Kroger store location to local storage");
        }).catchError((e) {
          print("Error saving to local storage: $e");
        });
      }).catchError((error) {
        print("Error saving to database: $error");
        
        // Try to save to local storage as fallback
        SharedPreferences.getInstance().then((prefs) {
          prefs.setString('kroger_store_location', locationId);
          prefs.setString('kroger_location_id', locationId);
          prefs.setBool('kroger_store_selected', true);
          print("Saved Kroger store location to local storage as fallback");
        }).catchError((e) {
          print("Error saving to local storage: $e");
        });
      });
    } catch (e) {
      print("Error in _saveKrogerStoreLocation: $e");
    }
    
    // Return immediately since we're using then/catchError pattern
    return Future.value();
  }
  

  // Save Kroger credentials to local storage
  Future<void> _saveKrogerCredentialsLocally() async {
    print("Saving Kroger credentials to local storage");
    
    SharedPreferences.getInstance().then((prefs) {
      try {
        // Store location settings - store in multiple formats for compatibility
        if (_krogerLocationId.isNotEmpty) {
          // Store ID in multiple formats like the web app does
          prefs.setString('kroger_store_location', _krogerLocationId);
          prefs.setString('kroger_store_location_id', _krogerLocationId);
          prefs.setString('kroger_location_id', _krogerLocationId);
          prefs.setString('krogerStoreLocation', _krogerLocationId);
          prefs.setString('krogerLocationId', _krogerLocationId);
          prefs.setString('kroger.store_location', _krogerLocationId);
          prefs.setString('kroger.location_id', _krogerLocationId);
          
          // Save status flags
          prefs.setBool('kroger_store_selected', true);
          prefs.setBool('kroger_store_configured', true);
          prefs.setBool('kroger_store_selection_done', true);
          prefs.setBool('kroger_needs_store_selection', false);
          prefs.setBool('kroger_store_selection_required', false);
          
          // Save timestamp for debugging
          prefs.setString('kroger_store_selection_timestamp', DateTime.now().toIso8601String());
          
          print("Saved Kroger store ID: $_krogerLocationId to local storage with all variations");
        }
        
        // Store user credentials with multiple variations for compatibility
        if (_krogerUsername.isNotEmpty) {
          prefs.setString('kroger_username', _krogerUsername);
          prefs.setString('krogerUsername', _krogerUsername);
          prefs.setString('kroger.username', _krogerUsername);
          print("Saved Kroger username to local storage");
        }
        
        if (_krogerPassword.isNotEmpty) {
          prefs.setString('kroger_password', _krogerPassword);
          prefs.setString('krogerPassword', _krogerPassword);
          prefs.setString('kroger.password', _krogerPassword);
          print("Saved Kroger password to local storage");
        }
        
        // Store authentication state with all possible variations
        if (_hasKrogerAuth) {
          // Standard variations of auth flags
          prefs.setBool('kroger_authenticated', true);
          prefs.setBool('kroger_connected', true);
          prefs.setBool('kroger_auth_code_received', true);
          prefs.setBool('kroger_has_cart_scope', true);
          prefs.setBool('kroger_auth_completed', true);
          
          // Camel case variations
          prefs.setBool('krogerAuthenticated', true);
          prefs.setBool('krogerConnected', true);
          prefs.setBool('krogerHasCartScope', true);
          
          // Dot notation variations
          prefs.setBool('kroger.authenticated', true);
          prefs.setBool('kroger.connected', true);
          
          // Save timestamp
          prefs.setString('kroger_auth_timestamp', DateTime.now().toIso8601String());
          
          print("Saved Kroger auth status to local storage with all variations");
        }
        
        print("Successfully saved all Kroger credentials to local storage");
      } catch (e) {
        print("Error saving Kroger credentials to local storage: $e");
      }
    }).catchError((e) {
      print("Error getting SharedPreferences instance: $e");
    });
    
    // Return immediately since we're using then/catchError pattern
    return Future.value();
  }

  Future<void> _savePreferences() async {
    setState(() => _isLoading = true);
    
    try {
      // Get the latest values from text controllers
      _krogerZipCode = _krogerZipCodeController.text.trim();
      _krogerLocationId = _krogerLocationIdController.text.trim();
      _krogerUsername = _krogerUsernameController.text.trim();
      _krogerPassword = _krogerPasswordController.text.trim();
      
      final preferences = {
        // Original preferences
        'diet_type': _selectedDietType,
        'other_diet_type': _selectedDietType == 'Other' ? _otherDietTypeController.text.trim() : '',
        'dietary_restrictions': _dietaryRestrictions.join(', '),
        'disliked_ingredients': _dislikedIngredients.join(', '),
        'recipe_type': _selectedRecipeType,
        'other_recipe_type': _selectedRecipeType == 'Other' ? _otherRecipeTypeController.text.trim() : '',
        'calorie_goal': _calorieGoal,
        'macro_protein': _proteinPercentage,
        'macro_carbs': _carbsPercentage,
        'macro_fat': _fatPercentage,
        'servings_per_meal': _servingsPerMeal,
        'snacks_per_day': _snacksPerDay,
        'meal_times': _mealTimes,
        'appliances': _appliances,
        'prep_complexity': _complexityLevel.toInt(),
        
        // Store settings - include all possible field names for compatibility
        'kroger_zip_code': _krogerZipCode,
        'kroger_location_id': _krogerLocationId,
        'kroger_username': _krogerUsername,
        'kroger_password': _krogerPassword,
        'kroger_store_location': _krogerLocationId, // Alternate field name
        'kroger_store_location_id': _krogerLocationId, // Another alternate field name
        
        // New preferences added from web app
        'flavor_preferences': _flavorPreferences,
        'spice_level': _spiceLevel,
        'recipe_type_preferences': _recipeTypePreferences,
        'meal_time_preferences': _mealTimePreferences,
        'time_constraints': _timeConstraints,
        'prep_preferences': _prepPreferences,
      };
      
      // Save to API
      final result = await ApiService.updatePreferences(
        userId: widget.userId,
        authToken: widget.authToken,
        preferences: preferences,
      );
      
      // Also save to local storage for redundancy and compatibility with web app
      if (_krogerLocationId.isNotEmpty || _krogerUsername.isNotEmpty || _krogerPassword.isNotEmpty) {
        await _saveKrogerCredentialsLocally();
      }
      
      setState(() => _isLoading = false);
      
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Preferences saved successfully"),
            backgroundColor: Colors.green,
          )
        );
        
        // If we came from a store setup requirement, return to previous screen
        if (_showKrogerSetup) {
          Navigator.pop(context, true); // Return true to indicate successful setup
        } else {
          Navigator.pop(context);
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Failed to save preferences"),
            backgroundColor: Colors.red,
          )
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error saving preferences: $e"),
          backgroundColor: Colors.red,
        )
      );
    }
  }

  void _addDislikedIngredient() {
    final ingredient = _dislikedIngredientController.text.trim();
    if (ingredient.isNotEmpty && !_dislikedIngredients.contains(ingredient)) {
      setState(() {
        _dislikedIngredients.add(ingredient);
        _dislikedIngredientController.clear();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Meal Preferences'),
        actions: [
          TextButton.icon(
            icon: Icon(Icons.save, color: Colors.white),
            label: Text('Save', style: TextStyle(color: Colors.white)),
            onPressed: _savePreferences,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(icon: Icon(Icons.restaurant), text: 'Diet'),
            Tab(icon: Icon(Icons.fitness_center), text: 'Nutrition'),
            Tab(icon: Icon(Icons.schedule), text: 'Meals'),
            Tab(icon: Icon(Icons.kitchen), text: 'Cooking'),
            Tab(icon: Icon(Icons.shopping_cart), text: 'Stores'),
            Tab(icon: Icon(Icons.tune), text: 'Advanced'),
          ],
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white.withOpacity(0.7),
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildDietTab(),
                _buildNutritionTab(),
                _buildMealsTab(),
                _buildCookingTab(),
                _buildStoresTab(),
                _buildAdvancedTab(),
              ],
            ),
      bottomNavigationBar: BottomAppBar(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ElevatedButton(
            onPressed: _savePreferences,
            child: Text('Save Preferences'),
            style: ElevatedButton.styleFrom(
              padding: EdgeInsets.symmetric(vertical: 12),
              textStyle: TextStyle(fontSize: 16),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDietTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Diet Type',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildDietTypeSelector(),
          SizedBox(height: 24),
          
          Text(
            'Dietary Restrictions',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildDietaryRestrictionsSelector(),
          SizedBox(height: 24),
          
          Text(
            'Recipe Style',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildRecipeTypeSelector(),
          SizedBox(height: 24),
          
          Text(
            'Disliked Ingredients',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildDislikedIngredientsSelector(),
          SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildDietTypeSelector() {
    final dietTypes = [
      'Mixed',
      'Vegetarian',
      'Vegan',
      'Pescatarian',
      'Keto',
      'Paleo',
      'Mediterranean',
      'Low Carb',
      'Low Fat',
      'Other',
    ];
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: dietTypes.map((diet) {
            final isSelected = _selectedDietType == diet;
            return ChoiceChip(
              label: Text(diet),
              selected: isSelected,
              selectedColor: Colors.blue,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.black,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              onSelected: (selected) {
                setState(() {
                  _selectedDietType = selected ? diet : null;
                });
              },
            );
          }).toList(),
        ),
        if (_selectedDietType == 'Other') ...[  
          SizedBox(height: 16),
          TextField(
            controller: _otherDietTypeController,
            decoration: InputDecoration(
              labelText: 'Specify other diet type',
              border: OutlineInputBorder(),
              hintText: 'Enter custom diet type',
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildDietaryRestrictionsSelector() {
    final restrictions = [
      'Gluten-Free',
      'Dairy-Free',
      'Nut-Free',
      'Egg-Free',
      'Soy-Free',
      'Shellfish-Free',
      'Low Sodium',
      'Low Sugar',
      'Low Cholesterol',
      'Kosher',
      'Halal',
    ];
    
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: restrictions.map((restriction) {
        final isSelected = _dietaryRestrictions.contains(restriction);
        return FilterChip(
          label: Text(restriction),
          selected: isSelected,
          selectedColor: Colors.green,
          checkmarkColor: Colors.white,
          labelStyle: TextStyle(
            color: isSelected ? Colors.white : Colors.black,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
          onSelected: (selected) {
            setState(() {
              if (selected) {
                _dietaryRestrictions.add(restriction);
              } else {
                _dietaryRestrictions.remove(restriction);
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _buildRecipeTypeSelector() {
    final recipeTypes = [
      'Mixed',
      'American',
      'Italian',
      'Mexican',
      'Asian',
      'Indian',
      'Mediterranean',
      'Middle Eastern',
      'French',
      'Thai',
      'Japanese',
      'Chinese',
      'Korean',
      'Vietnamese',
      'Brazilian',
      'Caribbean',
      'Greek',
      'Other',
    ];
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: recipeTypes.map((type) {
            final isSelected = _selectedRecipeType == type;
            return ChoiceChip(
              label: Text(type),
              selected: isSelected,
              selectedColor: Colors.blue,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.black,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              onSelected: (selected) {
                setState(() {
                  _selectedRecipeType = selected ? type : null;
                });
              },
            );
          }).toList(),
        ),
        if (_selectedRecipeType == 'Other') ...[  
          SizedBox(height: 16),
          TextField(
            controller: _otherRecipeTypeController,
            decoration: InputDecoration(
              labelText: 'Specify other cuisine type',
              border: OutlineInputBorder(),
              hintText: 'Enter custom cuisine type',
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildDislikedIngredientsSelector() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _dislikedIngredientController,
                decoration: InputDecoration(
                  hintText: 'Enter ingredient to avoid',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => _addDislikedIngredient(),
              ),
            ),
            SizedBox(width: 8),
            IconButton(
              icon: Icon(Icons.add),
              onPressed: _addDislikedIngredient,
              tooltip: 'Add ingredient',
            ),
          ],
        ),
        SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _dislikedIngredients.map((ingredient) {
            return Chip(
              label: Text(ingredient),
              onDeleted: () {
                setState(() {
                  _dislikedIngredients.remove(ingredient);
                });
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildNutritionTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Calorie Goal',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Column(
            children: [
              Text(
                '${_calorieGoal.round()} calories',
                style: TextStyle(fontSize: 16),
              ),
              Slider(
                value: _calorieGoal.toDouble(),
                min: 1000,
                max: 4000,
                divisions: 30,
                label: '${_calorieGoal.round()} calories',
                onChanged: (value) {
                  setState(() {
                    _calorieGoal = value.round();
                  });
                },
              ),
            ],
          ),
          SizedBox(height: 24),
          
          Text(
            'Macronutrient Ratio',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildMacroSelector(),
          SizedBox(height: 24),
          
          Container(
            padding: EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Daily Macros',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildMacroCircle('Calories', _calorieGoal.toString(), Colors.blue),
                    _buildMacroCircle('Protein', '${(_calorieGoal * _proteinPercentage / 400).round()}g', Colors.red),
                    _buildMacroCircle('Carbs', '${(_calorieGoal * _carbsPercentage / 400).round()}g', Colors.green),
                    _buildMacroCircle('Fat', '${(_calorieGoal * _fatPercentage / 900).round()}g', Colors.orange),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMacroSelector() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 3,
              child: Text('Protein: $_proteinPercentage%'),
            ),
            Expanded(
              flex: 7,
              child: Slider(
                value: _proteinPercentage.toDouble(),
                min: 10,
                max: 60,
                divisions: 50,
                label: '$_proteinPercentage%',
                onChanged: (value) {
                  setState(() {
                    _proteinPercentage = value.round();
                    _adjustOtherMacros('protein');
                  });
                },
              ),
            ),
          ],
        ),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: Text('Carbs: $_carbsPercentage%'),
            ),
            Expanded(
              flex: 7,
              child: Slider(
                value: _carbsPercentage.toDouble(),
                min: 10,
                max: 60,
                divisions: 50,
                label: '$_carbsPercentage%',
                onChanged: (value) {
                  setState(() {
                    _carbsPercentage = value.round();
                    _adjustOtherMacros('carbs');
                  });
                },
              ),
            ),
          ],
        ),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: Text('Fat: $_fatPercentage%'),
            ),
            Expanded(
              flex: 7,
              child: Slider(
                value: _fatPercentage.toDouble(),
                min: 10,
                max: 60,
                divisions: 50,
                label: '$_fatPercentage%',
                onChanged: (value) {
                  setState(() {
                    _fatPercentage = value.round();
                    _adjustOtherMacros('fat');
                  });
                },
              ),
            ),
          ],
        ),
        Text(
          'Total: ${_proteinPercentage + _carbsPercentage + _fatPercentage}%',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: _proteinPercentage + _carbsPercentage + _fatPercentage == 100
                ? Colors.green
                : Colors.red,
          ),
        ),
      ],
    );
  }

  void _adjustOtherMacros(String changedMacro) {
    // Ensure total is always 100%
    final total = _proteinPercentage + _carbsPercentage + _fatPercentage;
    
    if (total != 100) {
      final adjustment = 100 - total;
      
      if (changedMacro == 'protein') {
        // Adjust carbs and fat
        if (_carbsPercentage > _fatPercentage) {
          final carbsAdjustment = (adjustment * 0.6).round();
          final fatAdjustment = adjustment - carbsAdjustment;
          
          _carbsPercentage = (_carbsPercentage + carbsAdjustment).clamp(10, 60);
          _fatPercentage = (_fatPercentage + fatAdjustment).clamp(10, 60);
        } else {
          final fatAdjustment = (adjustment * 0.6).round();
          final carbsAdjustment = adjustment - fatAdjustment;
          
          _fatPercentage = (_fatPercentage + fatAdjustment).clamp(10, 60);
          _carbsPercentage = (_carbsPercentage + carbsAdjustment).clamp(10, 60);
        }
      } else if (changedMacro == 'carbs') {
        // Adjust protein and fat
        if (_proteinPercentage > _fatPercentage) {
          final proteinAdjustment = (adjustment * 0.6).round();
          final fatAdjustment = adjustment - proteinAdjustment;
          
          _proteinPercentage = (_proteinPercentage + proteinAdjustment).clamp(10, 60);
          _fatPercentage = (_fatPercentage + fatAdjustment).clamp(10, 60);
        } else {
          final fatAdjustment = (adjustment * 0.6).round();
          final proteinAdjustment = adjustment - fatAdjustment;
          
          _fatPercentage = (_fatPercentage + fatAdjustment).clamp(10, 60);
          _proteinPercentage = (_proteinPercentage + proteinAdjustment).clamp(10, 60);
        }
      } else if (changedMacro == 'fat') {
        // Adjust protein and carbs
        if (_proteinPercentage > _carbsPercentage) {
          final proteinAdjustment = (adjustment * 0.6).round();
          final carbsAdjustment = adjustment - proteinAdjustment;
          
          _proteinPercentage = (_proteinPercentage + proteinAdjustment).clamp(10, 60);
          _carbsPercentage = (_carbsPercentage + carbsAdjustment).clamp(10, 60);
        } else {
          final carbsAdjustment = (adjustment * 0.6).round();
          final proteinAdjustment = adjustment - carbsAdjustment;
          
          _carbsPercentage = (_carbsPercentage + carbsAdjustment).clamp(10, 60);
          _proteinPercentage = (_proteinPercentage + proteinAdjustment).clamp(10, 60);
        }
      }
    }
  }

  Widget _buildMacroCircle(String label, String value, Color color) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color.withOpacity(0.2),
            border: Border.all(
              color: color,
              width: 2,
            ),
          ),
          child: Center(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
        ),
        SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildMealsTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Meal Times',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Column(
            children: _mealTimes.entries.map((entry) {
              final mealName = entry.key.substring(0, 1).toUpperCase() + entry.key.substring(1);
              return SwitchListTile(
                title: Text(mealName),
                value: entry.value,
                onChanged: (value) {
                  setState(() {
                    _mealTimes[entry.key] = value;
                  });
                },
              );
            }).toList(),
          ),
          SizedBox(height: 24),
          
          Text(
            'Servings',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          ListTile(
            title: Text('Servings per meal'),
            subtitle: Text('$_servingsPerMeal'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.remove),
                  onPressed: _servingsPerMeal > 1 
                    ? () => setState(() => _servingsPerMeal--) 
                    : null,
                ),
                Text('$_servingsPerMeal', style: TextStyle(fontSize: 18)),
                IconButton(
                  icon: Icon(Icons.add),
                  onPressed: _servingsPerMeal < 10 
                    ? () => setState(() => _servingsPerMeal++) 
                    : null,
                ),
              ],
            ),
          ),
          SizedBox(height: 16),
          
          ListTile(
            title: Text('Snacks per day'),
            subtitle: Text('$_snacksPerDay'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(Icons.remove),
                  onPressed: _snacksPerDay > 0 
                    ? () => setState(() => _snacksPerDay--) 
                    : null,
                ),
                Text('$_snacksPerDay', style: TextStyle(fontSize: 18)),
                IconButton(
                  icon: Icon(Icons.add),
                  onPressed: _snacksPerDay < 3 
                    ? () => setState(() => _snacksPerDay++) 
                    : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCookingTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Kitchen Appliances',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  title: Text('Air Fryer'),
                  subtitle: Text('Include recipes using air fryer'),
                  value: _appliances['airFryer'] ?? false,
                  onChanged: (value) {
                    setState(() {
                      _appliances['airFryer'] = value;
                    });
                  },
                ),
                Divider(height: 1),
                SwitchListTile(
                  title: Text('Instant Pot'),
                  subtitle: Text('Include recipes using Instant Pot'),
                  value: _appliances['instapot'] ?? false,
                  onChanged: (value) {
                    setState(() {
                      _appliances['instapot'] = value;
                    });
                  },
                ),
                Divider(height: 1),
                SwitchListTile(
                  title: Text('Slow Cooker'),
                  subtitle: Text('Include recipes using slow cooker'),
                  value: _appliances['crockpot'] ?? false,
                  onChanged: (value) {
                    setState(() {
                      _appliances['crockpot'] = value;
                    });
                  },
                ),
              ],
            ),
          ),
          SizedBox(height: 24),
          
          Text(
            'Meal Preparation Preferences',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ..._prepPreferences.entries.map((entry) {
                  return SwitchListTile(
                    title: Text(_formatLabel(entry.key)),
                    subtitle: Text('Enable ${_formatLabel(entry.key.toLowerCase())} recipes'),
                    value: entry.value,
                    onChanged: (value) {
                      setState(() {
                        _prepPreferences[entry.key] = value;
                      });
                    },
                  );
                }).toList(),
              ],
            ),
          ),
          SizedBox(height: 24),
          
          Text(
            'Recipe Complexity',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'How complex can recipes be?',
                    style: TextStyle(fontSize: 16),
                  ),
                  SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Slider(
                          value: _complexityLevel,
                          min: 0,
                          max: 100,
                          divisions: 100,
                          label: '${_complexityLevel.round()}',
                          onChanged: (value) {
                            setState(() {
                              _complexityLevel = value;
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Simple', style: TextStyle(color: Colors.grey[600])),
                      Text('Advanced', style: TextStyle(color: Colors.grey[600])),
                    ],
                  ),
                  SizedBox(height: 16),
                  Text(
                    _getComplexityDescription(_complexityLevel.round()),
                    style: TextStyle(
                      fontStyle: FontStyle.italic,
                      color: Colors.grey[700],
                    ),
                  ),
                  SizedBox(height: 8),
                  Container(
                    padding: EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildComplexityLevel('Minimal Prep', 0, 20),
                        _buildComplexityLevel('Moderate Prep', 20, 40),
                        _buildComplexityLevel('Standard Cooking', 40, 60),
                        _buildComplexityLevel('Complex Recipes', 60, 100),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getComplexityDescription(int level) {
    if (level < 20) {
      return 'Very simple recipes with minimal ingredients and prep time.';
    } else if (level < 40) {
      return 'Quick and easy recipes with some basic cooking techniques.';
    } else if (level < 60) {
      return 'Moderate complexity with a balance of convenience and flavor.';
    } else if (level < 80) {
      return 'More involved recipes with multiple steps and cooking techniques.';
    } else {
      return 'Advanced recipes that may require specialized skills and longer prep time.';
    }
  }
  
  Widget _buildComplexityLevel(String label, double min, double max) {
    final bool isActive = _complexityLevel >= min && _complexityLevel <= max;
    return Column(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? Colors.green : Colors.grey[400],
          ),
        ),
        SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            color: isActive ? Colors.green : Colors.grey[600],
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
  
  // Handle Kroger authentication
  Future<void> _authenticateWithKroger() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      // Save any credentials entered in the form to local storage first
      if (_krogerUsernameController.text.isNotEmpty || _krogerPasswordController.text.isNotEmpty) {
        SharedPreferences.getInstance().then((prefs) {
          if (_krogerUsernameController.text.isNotEmpty) {
            prefs.setString('kroger_username', _krogerUsernameController.text.trim());
            print("Saved Kroger username to SharedPreferences");
          }
          
          if (_krogerPasswordController.text.isNotEmpty) {
            prefs.setString('kroger_password', _krogerPasswordController.text.trim());
            print("Saved Kroger password to SharedPreferences");
          }
        }).catchError((e) {
          print("Error saving credentials to shared preferences: $e");
        });
      }
      
      final authUrl = await ApiService.getKrogerAuthUrl(widget.userId, widget.authToken);
      
      setState(() {
        _isLoading = false;
      });
      
      if (authUrl != null && authUrl.isNotEmpty) {
        // Navigate to Kroger auth screen
        final success = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (context) => KrogerAuthScreen(
              authUrl: authUrl,
              userId: widget.userId,
              authToken: widget.authToken,
            ),
          ),
        ) ?? false;
        
        if (success) {
          // Check local storage for updated status
          SharedPreferences.getInstance().then((prefs) {
            final isAuthenticated = prefs.getBool('kroger_authenticated') ?? false;
            
            // Update UI immediately if we have authenticated
            if (isAuthenticated) {
              setState(() {
                _hasKrogerAuth = true;
                
                // Also check for store location
                final storeId = prefs.getString('kroger_location_id') ?? 
                                prefs.getString('kroger_store_location') ?? 
                                '';
                                
                if (storeId.isNotEmpty) {
                  _krogerLocationId = storeId;
                  _krogerLocationIdController.text = storeId;
                }
              });
            }
            
            // Refresh preferences to get updated auth status from backend
            _fetchPreferences();
          }).catchError((e) {
            print("Error checking authentication status: $e");
            
            // Still refresh preferences from backend as fallback
            _fetchPreferences();
          });
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Kroger authentication successful!"),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Failed to get Kroger authentication URL"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error authenticating with Kroger: $e"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  // Find Kroger store by zip code
  Future<void> _findKrogerStore() async {
    final zipCode = _krogerZipCodeController.text.trim();
    
    if (zipCode.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Please enter a zip code"),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    
    setState(() {
      _isLoading = true;
    });
    
    try {
      final result = await ApiService.getKrogerStores(
        widget.userId,
        widget.authToken,
        zipCode,
      );
      
      setState(() {
        _isLoading = false;
      });
      
      if (result != null && result.containsKey('stores') && result['stores'] is List && (result['stores'] as List).isNotEmpty) {
        final stores = result['stores'] as List;
        
        // Show store selection dialog
        final selectedStore = await showDialog<Map<String, dynamic>>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text("Select Kroger Store"),
            content: Container(
              width: double.maxFinite,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: stores.length,
                itemBuilder: (context, index) {
                  final store = stores[index];
                  final storeName = store['name'] ?? 'Unknown Store';
                  final storeAddress = store['address'] ?? 'No Address';
                  
                  return ListTile(
                    title: Text(storeName),
                    subtitle: Text(storeAddress),
                    onTap: () => Navigator.of(context).pop(store),
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                child: Text("Cancel"),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        );
        
        if (selectedStore != null) {
          final storeId = selectedStore['locationId']?.toString() ?? '';
          
          setState(() {
            _krogerLocationId = storeId;
            _krogerLocationIdController.text = storeId;
          });
          
          // Save the store ID to database immediately
          _saveKrogerStoreLocation(storeId);
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Kroger store selected"),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("No Kroger stores found for this zip code"),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error finding Kroger stores: $e"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  
  // Build the stores tab
  Widget _buildStoresTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kroger settings
          Text(
            'Kroger Settings',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildKrogerSettings(),
        ],
      ),
    );
  }
  
  // Build Kroger settings section
  Widget _buildKrogerSettings() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Kroger Authentication',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: _hasKrogerAuth ? Colors.green : Colors.red,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _hasKrogerAuth ? 'Authenticated' : 'Not Authenticated',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Kroger Account',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 8),
                
                // Kroger website credentials
                Text(
                  'Your Kroger Website Credentials',
                  style: TextStyle(fontSize: 14, fontStyle: FontStyle.italic),
                ),
                SizedBox(height: 8),
                TextField(
                  controller: _krogerUsernameController,
                  decoration: InputDecoration(
                    labelText: 'Username/Email',
                    border: OutlineInputBorder(),
                    hintText: 'Your Kroger account email',
                  ),
                ),
                SizedBox(height: 16),
                TextField(
                  controller: _krogerPasswordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(),
                    hintText: 'Your Kroger account password',
                  ),
                ),
                SizedBox(height: 16),
                
                // Kroger API authentication section
                Divider(),
                SizedBox(height: 8),
                Text(
                  'Kroger API Authentication',
                  style: TextStyle(fontSize: 14, fontStyle: FontStyle.italic),
                ),
                SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: _hasKrogerAuth ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: _hasKrogerAuth ? Colors.green : Colors.red,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              _hasKrogerAuth ? Icons.check_circle : Icons.error,
                              color: _hasKrogerAuth ? Colors.green : Colors.red,
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _hasKrogerAuth 
                                  ? 'Authenticated with Kroger API' 
                                  : 'Not authenticated with Kroger API',
                                style: TextStyle(
                                  color: _hasKrogerAuth ? Colors.green : Colors.red,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 16),
                ElevatedButton.icon(
                  icon: Icon(Icons.login),
                  label: Text(_hasKrogerAuth ? 'Re-authenticate with Kroger' : 'Authenticate with Kroger'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: _authenticateWithKroger,
                ),
              ],
            ),
            SizedBox(height: 16),
            Divider(),
            SizedBox(height: 16),
            Text(
              'Store Location',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text(
              'Enter your zip code to find nearby Kroger stores',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 7,
                  child: TextField(
                    controller: _krogerZipCodeController,
                    decoration: InputDecoration(
                      labelText: 'Zip Code',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: ElevatedButton(
                    child: Text('Find'),
                    onPressed: _findKrogerStore,
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            TextField(
              controller: _krogerLocationIdController,
              decoration: InputDecoration(
                labelText: 'Store ID',
                border: OutlineInputBorder(),
                hintText: 'Enter Kroger store ID',
              ),
              readOnly: true,
            ),
            SizedBox(height: 8),
            if (_krogerLocationId.isNotEmpty)
              Text(
                'Store ID set. You can now search for Kroger products.',
                style: TextStyle(color: Colors.green, fontSize: 12),
              ),
          ],
        ),
      ),
    );
  }
  
  
  // Build the advanced tab with new preferences from web app
  Widget _buildAdvancedTab() {
    return SingleChildScrollView(
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Flavor preferences section
          Text(
            'Flavor Preferences',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildFlavorPreferencesSection(),
          SizedBox(height: 24),
          
          // Spice level section
          Text(
            'Spice Level',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildSpiceLevelSection(),
          SizedBox(height: 24),
          
          // Recipe format preferences section
          Text(
            'Recipe Formats',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildRecipeFormatSection(),
          SizedBox(height: 24),
          
          // Time constraints section
          Text(
            'Time Constraints',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          _buildTimeConstraintsSection(),
        ],
      ),
    );
  }
  
  // Flavor preferences section
  Widget _buildFlavorPreferencesSection() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select your preferred flavor profiles',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _flavorPreferences.keys.map((flavor) {
                return FilterChip(
                  label: Text(_formatLabel(flavor)),
                  selected: _flavorPreferences[flavor] ?? false,
                  selectedColor: Colors.orange.shade200,
                  checkmarkColor: Colors.deepOrange,
                  labelStyle: TextStyle(
                    color: (_flavorPreferences[flavor] ?? false) ? Colors.black : Colors.black,
                    fontWeight: (_flavorPreferences[flavor] ?? false) ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (selected) {
                    setState(() {
                      _flavorPreferences[flavor] = selected;
                    });
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
  
  // Spice level section
  Widget _buildSpiceLevelSection() {
    final spiceLevels = ['mild', 'medium', 'hot', 'extra-hot'];
    
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'How spicy do you like your food?',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: spiceLevels.map((level) {
                final isSelected = _spiceLevel == level;
                final color = level == 'mild' 
                    ? Colors.green 
                    : level == 'medium' 
                        ? Colors.orange 
                        : level == 'hot' 
                            ? Colors.deepOrange 
                            : Colors.red;
                
                return GestureDetector(
                  onTap: () {
                    setState(() {
                      _spiceLevel = level;
                    });
                  },
                  child: Column(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected ? color : Colors.grey.shade200,
                          border: Border.all(
                            color: isSelected ? color : Colors.grey,
                            width: 2,
                          ),
                        ),
                        child: Icon(
                          level == 'mild' 
                              ? Icons.local_fire_department 
                              : level == 'medium' 
                                  ? Icons.local_fire_department 
                                  : level == 'hot' 
                                      ? Icons.local_fire_department 
                                      : Icons.whatshot,
                          color: isSelected ? Colors.white : Colors.grey,
                          size: level == 'extra-hot' ? 36 : 30,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        _formatLabel(level),
                        style: TextStyle(
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? color : Colors.black,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
  
  // Recipe format preferences section
  Widget _buildRecipeFormatSection() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Select your preferred meal formats',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recipeTypePreferences.keys.map((type) {
                return FilterChip(
                  label: Text(_formatLabel(type)),
                  selected: _recipeTypePreferences[type] ?? false,
                  selectedColor: Colors.blue.shade200,
                  checkmarkColor: Colors.blue,
                  labelStyle: TextStyle(
                    color: (_recipeTypePreferences[type] ?? false) ? Colors.black : Colors.black,
                    fontWeight: (_recipeTypePreferences[type] ?? false) ? FontWeight.bold : FontWeight.normal,
                  ),
                  onSelected: (selected) {
                    setState(() {
                      _recipeTypePreferences[type] = selected;
                    });
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
  
  // Time constraints section
  Widget _buildTimeConstraintsSection() {
    return Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Maximum cooking time (in minutes)',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            SizedBox(height: 16),
            Column(
              children: [
                _buildTimeConstraintSlider('Weekday Breakfast', 'weekday-breakfast', 5, 60),
                _buildTimeConstraintSlider('Weekday Lunch', 'weekday-lunch', 5, 60),
                _buildTimeConstraintSlider('Weekday Dinner', 'weekday-dinner', 10, 120),
                Divider(height: 32),
                _buildTimeConstraintSlider('Weekend Breakfast', 'weekend-breakfast', 5, 90),
                _buildTimeConstraintSlider('Weekend Lunch', 'weekend-lunch', 10, 90),
                _buildTimeConstraintSlider('Weekend Dinner', 'weekend-dinner', 15, 120),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  // Helper for building time constraint sliders
  Widget _buildTimeConstraintSlider(String label, String key, int min, int max) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label),
            Text('${_timeConstraints[key] ?? 30} minutes'),
          ],
        ),
        Slider(
          value: (_timeConstraints[key] ?? 30).toDouble(),
          min: min.toDouble(),
          max: max.toDouble(),
          divisions: ((max - min) ~/ 5),
          label: '${_timeConstraints[key] ?? 30} min',
          onChanged: (value) {
            setState(() {
              _timeConstraints[key] = value.round();
            });
          },
        ),
        SizedBox(height: 8),
      ],
    );
  }
  
}