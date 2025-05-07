import 'package:flutter/foundation.dart';
import 'dart:convert';

class Recipe {
  final int id;
  final String title;
  final String? description;
  final String? imageUrl;
  final Map<String, dynamic>? macros;
  final List<String>? ingredients;
  final List<String>? instructions;
  final String? category;
  final List<String>? tags;
  final bool? isSaved;
  final double? rating;
  final String? prepTime;
  final String? cookTime;
  final int? servings;
  
  Recipe({
    required this.id,
    required this.title,
    this.description,
    this.imageUrl,
    this.macros,
    this.ingredients,
    this.instructions,
    this.category,
    this.tags,
    this.isSaved = false,
    this.rating,
    this.prepTime,
    this.cookTime,
    this.servings,
  });
  
  factory Recipe.fromJson(Map<String, dynamic> json) {
    // Print the incoming JSON for debugging
    print("Parsing recipe: ${json.keys.toList()}");
    
    // Handle ingredients which could be in different formats
    List<String>? ingredients;
    if (json['ingredients'] != null) {
      // Direct ingredients list
      if (json['ingredients'] is List) {
        ingredients = List<String>.from(json['ingredients'].map((item) {
          // Handle if each ingredient is an object with a name property
          if (item is Map) {
            return item['name'] ?? item.toString();
          }
          return item.toString();
        }));
      } 
      // Handle if it's a JSON string that needs parsing
      else if (json['ingredients'] is String) {
        try {
          var parsed = jsonDecode(json['ingredients']);
          if (parsed is List) {
            ingredients = List<String>.from(parsed.map((i) => i.toString()));
          }
        } catch (e) {
          ingredients = [json['ingredients'].toString()];
        }
      }
    }
    
    // Handle instructions which could be in different formats
    List<String>? instructions;
    if (json['instructions'] != null) {
      // Direct instructions list
      if (json['instructions'] is List) {
        instructions = List<String>.from(json['instructions'].map((i) => i.toString()));
      } 
      // Handle if it's a JSON string that needs parsing
      else if (json['instructions'] is String) {
        try {
          var parsed = jsonDecode(json['instructions']);
          if (parsed is List) {
            instructions = List<String>.from(parsed.map((i) => i.toString()));
          }
        } catch (e) {
          instructions = [json['instructions'].toString()];
        }
      }
    }
    
    // Handle tags which could be in different formats
    List<String>? tags;
    if (json['tags'] != null) {
      if (json['tags'] is List) {
        tags = List<String>.from(json['tags'].map((t) => t.toString()));
      } else if (json['tags'] is String) {
        tags = json['tags'].toString().split(',').map((t) => t.trim()).toList();
      }
    }
    
    // Check for metadata which might contain ingredients
    if (ingredients == null && json['metadata'] != null) {
      var metadata = json['metadata'];
      if (metadata is String) {
        try {
          metadata = jsonDecode(metadata);
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (metadata is Map && metadata['ingredients_list'] != null) {
        if (metadata['ingredients_list'] is List) {
          ingredients = List<String>.from(metadata['ingredients_list']);
        }
      }
    }
    
    // Check for different forms of macros data
    Map<String, dynamic>? macros;
    if (json['macros'] != null) {
      if (json['macros'] is Map) {
        macros = Map<String, dynamic>.from(json['macros']);
      } else if (json['macros'] is String) {
        try {
          var parsed = jsonDecode(json['macros']);
          if (parsed is Map) {
            macros = Map<String, dynamic>.from(parsed);
          }
        } catch (e) {
          print("Error parsing macros string: $e");
        }
      }
    }
    
    if (macros == null && json['nutritional_info'] != null) {
      if (json['nutritional_info'] is Map) {
        macros = Map<String, dynamic>.from(json['nutritional_info']);
      } else if (json['nutritional_info'] is String) {
        try {
          var parsed = jsonDecode(json['nutritional_info']);
          if (parsed is Map) {
            macros = Map<String, dynamic>.from(parsed);
          }
        } catch (e) {
          print("Error parsing nutritional_info string: $e");
        }
      }
    }
    
    // Enhanced safe conversion helpers
    int parseId() {
      try {
        // Try different ID field names
        dynamic id = json['id'] ?? json['scraped_recipe_id'] ?? json['recipe_id'] ?? 0;
        
        // Handle various types
        if (id is int) return id;
        if (id is String) return int.tryParse(id) ?? 0;
        if (id is double) return id.toInt();
        
        // Final fallback - force toString and parse
        return int.tryParse(id.toString()) ?? 0;
      } catch (e) {
        print("Error parsing id from ${json['id'] ?? json['scraped_recipe_id']}: $e");
        return 0;
      }
    }
    
    String? safeString(dynamic value) {
      if (value == null) return null;
      return value.toString();
    }
    
    int? safeInt(dynamic value) {
      if (value == null) return null;
      try {
        if (value is int) return value;
        if (value is double) return value.toInt();
        if (value is String) return int.tryParse(value) ?? null;
        return int.tryParse(value.toString()) ?? null;
      } catch (e) {
        print("Error parsing int from: $value - ${value.runtimeType}: $e");
        return null;
      }
    }
    
    double? safeDouble(dynamic value) {
      if (value == null) return null;
      try {
        if (value is double) return value;
        if (value is int) return value.toDouble();
        if (value is String) return double.tryParse(value) ?? null;
        return double.tryParse(value.toString()) ?? null;
      } catch (e) {
        print("Error parsing double from: $value - ${value.runtimeType}: $e");
        return null;
      }
    }
    
    bool? safeBool(dynamic value) {
      if (value == null) return null;
      if (value is bool) return value;
      if (value is int) return value != 0;
      if (value is String) {
        return value.toLowerCase() == 'true' || value == '1';
      }
      return false;
    }
    
    return Recipe(
      id: parseId(),
      title: safeString(json['title']) ?? safeString(json['name']) ?? safeString(json['recipe_name']) ?? "Unnamed Recipe",
      description: safeString(json['description']) ?? safeString(json['notes']),
      imageUrl: safeString(json['image_url']) ?? safeString(json['imageUrl']),
      macros: macros,
      ingredients: ingredients,
      instructions: instructions,
      category: safeString(json['category']) ?? safeString(json['cuisine']),
      tags: tags,
      isSaved: safeBool(json['is_saved']) ?? false,
      rating: safeDouble(json['rating']),
      prepTime: safeString(json['prep_time']) ?? safeString(json['prepTime']),
      cookTime: safeString(json['cook_time']) ?? safeString(json['cookTime']) ?? safeString(json['total_time']),
      servings: safeInt(json['servings']),
    );
  }
}

class MenuItem {
  final String name;
  final String? description;
  final String? imageUrl;
  final Map<String, dynamic>? macros;
  final List<String>? ingredients;
  final List<String>? instructions;
  
  MenuItem({
    required this.name,
    this.description,
    this.imageUrl,
    this.macros,
    this.ingredients,
    this.instructions,
  });
  
  factory MenuItem.fromJson(Map<String, dynamic> json) {
    print("Parsing menu item: ${json.keys.toList()}");
    
    // Helper for safe extraction of strings
    String? safeString(String key) {
      final value = json[key];
      if (value == null) return null;
      return value.toString();
    }
    
    // Get the name from multiple possible fields
    String getName() {
      // Try common name fields in priority order
      for (var field in ['name', 'title', 'recipe_name', 'meal_name']) {
        if (json.containsKey(field) && json[field] != null) {
          return json[field].toString();
        }
      }
      
      // If no name found, check if we have a meal_time to create a name
      if (json.containsKey('meal_time')) {
        final mealTime = json['meal_time'].toString();
        return mealTime.substring(0, 1).toUpperCase() + mealTime.substring(1);
      }
      
      return "Unnamed Recipe";
    }
    
    // Parse ingredients with more flexible handling
    List<String>? ingredients;
    if (json.containsKey('ingredients') && json['ingredients'] != null) {
      try {
        print("Processing ingredients: ${json['ingredients'].runtimeType}");
        final ingData = json['ingredients'];
        
        // Handle list of ingredients
        if (ingData is List) {
          var ingList = ingData;
          print("Ingredients list has ${ingList.length} items");
          
          ingredients = [];
          for (var item in ingList) {
            if (item is Map) {
              // Handle ingredient objects with different formats
              if (item.containsKey('name')) {
                String ingText = item['name'].toString();
                // Add quantity and unit if available
                if (item.containsKey('quantity')) {
                  if (item.containsKey('unit')) {
                    ingText = "${item['quantity']} ${item['unit']} $ingText";
                  } else {
                    ingText = "${item['quantity']} $ingText";
                  }
                }
                ingredients.add(ingText);
              } else {
                ingredients.add(item.toString());
              }
            } else if (item is String) {
              ingredients.add(item);
            } else {
              ingredients.add(item.toString());
            }
          }
          print("Processed ${ingredients.length} ingredients");
        } 
        // Handle string that might be JSON
        else if (ingData is String) {
          // First try parsing as JSON
          try {
            var parsed = jsonDecode(ingData);
            if (parsed is List) {
              ingredients = List<String>.from(parsed.map((i) => i.toString()));
              print("Parsed ingredients string as JSON list");
            } else if (parsed is Map) {
              // Map might be an object with ingredient fields
              ingredients = [ingData];
              print("Ingredients JSON string is a Map, treating as single ingredient");
            }
          } catch (e) {
            // Not valid JSON, handle as string
            print("Ingredients not valid JSON, treating as string");
            
            // Check if it's a comma-separated list
            if (ingData.contains(',')) {
              ingredients = ingData.split(',').map((i) => i.trim()).toList();
              print("Split ingredients string by commas into ${ingredients.length} items");
            } else {
              ingredients = [ingData];
              print("Using ingredients as single string");
            }
          }
        }
        // Handle map of ingredients
        else if (ingData is Map) {
          ingredients = [];
          ingData.forEach((key, value) {
            if (value is String) {
              ingredients!.add("$key: $value");
            } else {
              ingredients!.add("$key: ${value.toString()}");
            }
          });
          print("Processed ingredients map into ${ingredients.length} items");
        }
      } catch (e) {
        print("Error parsing ingredients: $e");
      }
    }
    
    // Check for ingredients in 'components' field as alternative
    if ((ingredients == null || ingredients.isEmpty) && json.containsKey('components') && json['components'] != null) {
      try {
        final components = json['components'];
        if (components is List) {
          ingredients = List<String>.from(components.map((c) => c.toString()));
          print("Used 'components' field for ingredients: ${ingredients.length} items");
        }
      } catch (e) {
        print("Error parsing components as ingredients: $e");
      }
    }
    
    // Parse instructions with more flexible handling
    List<String>? instructions;
    if (json.containsKey('instructions') && json['instructions'] != null) {
      try {
        final instData = json['instructions'];
        
        // Handle list of instructions
        if (instData is List) {
          instructions = List<String>.from(instData.map((i) => i.toString()));
          print("Processed instructions list: ${instructions.length} items");
        } 
        // Handle string that might be JSON
        else if (instData is String) {
          // Try parsing as JSON first
          try {
            var parsed = jsonDecode(instData);
            if (parsed is List) {
              instructions = List<String>.from(parsed.map((i) => i.toString()));
              print("Parsed instructions string as JSON list");
            } else {
              // For other JSON types, treat as a plain string
              instructions = [instData];
              print("Instructions JSON string is not a list, treating as single instruction");
            }
          } catch (e) {
            print("Instructions not valid JSON, treating as string");
            
            // Check for common text separators
            if (instData.contains('\n\n')) {
              // Split by double newlines
              instructions = instData.split('\n\n').where((s) => s.trim().isNotEmpty).toList();
              print("Split instructions by double newlines: ${instructions.length} items");
            } else if (instData.contains('\n')) {
              // Split by single newlines
              instructions = instData.split('\n').where((s) => s.trim().isNotEmpty).toList();
              print("Split instructions by newlines: ${instructions.length} items");
            } else if (instData.contains('. ')) {
              // Split by periods followed by space (likely sentences)
              final sentences = instData.split(RegExp(r'\.(?=\s)'));
              instructions = sentences.where((s) => s.trim().isNotEmpty).map((s) => s.trim() + '.').toList();
              print("Split instructions by periods: ${instructions.length} items");
            } else {
              // Single instruction
              instructions = [instData];
              print("Using instructions as single string");
            }
          }
        }
        // Handle map of instructions
        else if (instData is Map) {
          instructions = [];
          // Sort the keys if they look like numbers
          final keys = instData.keys.toList();
          try {
            keys.sort((a, b) {
              final numA = int.tryParse(a.toString()) ?? 0;
              final numB = int.tryParse(b.toString()) ?? 0;
              return numA.compareTo(numB);
            });
          } catch (e) {
            print("Could not sort instruction keys numerically: $e");
          }
          
          for (var key in keys) {
            if (instData[key] is String) {
              instructions.add("${key}: ${instData[key]}");
            }
          }
          print("Processed instructions map into ${instructions.length} items");
        }
      } catch (e) {
        print("Error parsing instructions: $e");
      }
    }
    
    // Check for instructions in 'directions' or 'steps' field as alternatives
    if ((instructions == null || instructions.isEmpty)) {
      for (var field in ['directions', 'steps', 'method']) {
        if (json.containsKey(field) && json[field] != null) {
          try {
            final directionsData = json[field];
            if (directionsData is List) {
              instructions = List<String>.from(directionsData.map((d) => d.toString()));
              print("Used '$field' field for instructions: ${instructions.length} items");
              break;
            } else if (directionsData is String) {
              if (directionsData.contains('\n')) {
                instructions = directionsData.split('\n').where((s) => s.trim().isNotEmpty).toList();
              } else {
                instructions = [directionsData];
              }
              print("Used '$field' string for instructions");
              break;
            }
          } catch (e) {
            print("Error parsing $field as instructions: $e");
          }
        }
      }
    }
    
    // Parse macros data with more flexibility
    Map<String, dynamic>? macros;
    
    // Try different fields that might contain nutrition data
    for (var macroField in ['macros', 'nutritional_info', 'nutrition', 'nutrients']) {
      if (json.containsKey(macroField) && json[macroField] != null && (macros == null || macros.isEmpty)) {
        try {
          final macroData = json[macroField];
          
          if (macroData is Map) {
            macros = Map<String, dynamic>.from(macroData);
            print("Used '$macroField' map for macros");
          } else if (macroData is String) {
            try {
              var parsed = jsonDecode(macroData);
              if (parsed is Map) {
                macros = Map<String, dynamic>.from(parsed);
                print("Parsed '$macroField' string as JSON map for macros");
              }
            } catch (e) {
              print("Error parsing $macroField string as JSON: $e");
            }
          }
        } catch (e) {
          print("Error handling $macroField: $e");
        }
      }
    }
    
    // If no structured macros found, check for individual macro fields at the top level
    if (macros == null) {
      final possibleMacroFields = ['calories', 'protein', 'carbs', 'fat'];
      bool foundAnyMacro = false;
      
      for (var field in possibleMacroFields) {
        if (json.containsKey(field) && json[field] != null) {
          foundAnyMacro = true;
          break;
        }
      }
      
      if (foundAnyMacro) {
        macros = {};
        for (var field in possibleMacroFields) {
          if (json.containsKey(field) && json[field] != null) {
            try {
              final rawValue = json[field];
              num value;
              
              if (rawValue is num) {
                value = rawValue;
              } else if (rawValue is String) {
                // Try to parse numeric string
                value = num.tryParse(rawValue.replaceAll(RegExp(r'[^\d\.]'), '')) ?? 0;
              } else {
                value = 0;
              }
              
              macros[field] = value;
              print("Added $field: $value to macros from top level");
            } catch (e) {
              print("Error parsing $field as macro: $e");
            }
          }
        }
      }
    }
    
    // Get image URL from various possible fields
    String? getImageUrl() {
      for (var field in ['image_url', 'imageUrl', 'image', 'thumbnail']) {
        if (json.containsKey(field) && json[field] != null) {
          return json[field].toString();
        }
      }
      return null;
    }
    
    // Create the MenuItem with all the parsed data
    return MenuItem(
      name: getName(),
      description: safeString('description') ?? safeString('summary') ?? safeString('notes'),
      imageUrl: getImageUrl(),
      macros: macros,
      ingredients: ingredients,
      instructions: instructions,
    );
  }
}

class MenuDay {
  final int dayNumber;
  final String dayName;
  final Map<String, MenuItem> meals;
  
  MenuDay({
    required this.dayNumber,
    required this.dayName,
    required this.meals,
  });
  
  factory MenuDay.fromJson(Map<String, dynamic> json, int dayNumber) {
    print("Parsing menu day $dayNumber: ${json.keys.toList()}");
    
    // Try to extract day name and number from JSON
    String? providedDayName;
    
    // If dayName is specified in the JSON, use it
    if (json.containsKey('dayName')) {
      providedDayName = json['dayName']?.toString();
      print("Found 'dayName' in JSON: $providedDayName");
    }
    
    // If dayNumber is specified in the JSON, use it
    if (json.containsKey('dayNumber')) {
      try {
        dynamic rawDayNumber = json['dayNumber'];
        if (rawDayNumber != null) {
          int parsedDayNumber;
          if (rawDayNumber is int) {
            parsedDayNumber = rawDayNumber;
          } else if (rawDayNumber is String) {
            parsedDayNumber = int.tryParse(rawDayNumber) ?? dayNumber;
          } else if (rawDayNumber is double) {
            parsedDayNumber = rawDayNumber.toInt();
          } else {
            parsedDayNumber = int.tryParse(rawDayNumber.toString()) ?? dayNumber;
          }
          
          if (parsedDayNumber > 0) {
            print("Using provided dayNumber: $parsedDayNumber (was: $dayNumber)");
            dayNumber = parsedDayNumber;
          }
        }
      } catch (e) {
        print("Error parsing dayNumber: $e");
      }
    }
    
    // Get the day name based on the dayNumber if not provided
    final dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final dayName = providedDayName ?? dayNames[(dayNumber - 1) % 7];
    
    // Parse meals for this day
    Map<String, MenuItem> meals = {};
    
    // Helper to safely parse a meal - prints more specific details about failure
    void tryAddMeal(String key, dynamic mealData) {
      try {
        if (mealData == null) {
          print("Meal data for $key is null, skipping");
          return;
        }
        
        print("Processing meal '$key' with type: ${mealData.runtimeType}");
        
        if (mealData is Map<String, dynamic>) {
          print("Meal '$key' keys: ${mealData.keys.toList()}");
          
          // Check if this meal has the minimum required data
          if (!mealData.containsKey('name') && !mealData.containsKey('title')) {
            print("Meal '$key' missing required 'name' or 'title' field");
            
            // Try to use a default name based on the meal key
            mealData['name'] = key.substring(0, 1).toUpperCase() + key.substring(1);
            print("Using default name for meal '$key': ${mealData['name']}");
          }
          
          meals[key] = MenuItem.fromJson(mealData);
          print("Successfully added meal '$key'");
        } else if (mealData is String) {
          // Try to parse string as JSON
          try {
            final parsed = jsonDecode(mealData);
            if (parsed is Map<String, dynamic>) {
              meals[key] = MenuItem.fromJson(parsed);
              print("Successfully parsed string meal '$key' as JSON");
            } else {
              print("Parsed string meal '$key' but result is not a Map: ${parsed.runtimeType}");
              // Create a simple meal with just a name
              meals[key] = MenuItem(name: mealData.toString());
              print("Created simple meal with name: ${mealData.toString()}");
            }
          } catch (e) {
            print("Error parsing string meal '$key' as JSON: $e");
            // Create a simple meal with just a name
            meals[key] = MenuItem(name: mealData.toString());
            print("Created simple meal with name: ${mealData.toString()}");
          }
        } else if (mealData is List) {
          print("Meal '$key' is a List with ${mealData.length} items, trying to process first item");
          if (mealData.isNotEmpty && mealData[0] is Map<String, dynamic>) {
            meals[key] = MenuItem.fromJson(mealData[0]);
            print("Successfully added meal '$key' from first list item");
          } else {
            print("Cannot convert List to MenuItem for '$key'");
          }
        } else {
          print("Unsupported meal data type for '$key': ${mealData.runtimeType}");
          // Create a simple meal with the mealData as a string
          meals[key] = MenuItem(name: mealData.toString());
          print("Created simple meal with name derived from: ${mealData.toString()}");
        }
      } catch (e) {
        print("Error adding meal '$key': $e");
      }
    }
    
    // Special format: Handle when 'meals' is an array of objects with 'meal_time' field
    if (json.containsKey('meals') && json['meals'] is List) {
      print("Found 'meals' as a List with ${(json['meals'] as List).length} items");
      final mealsList = json['meals'] as List;
      
      // Loop through each meal in the list
      for (int i = 0; i < mealsList.length; i++) {
        try {
          final meal = mealsList[i];
          
          if (meal is Map) {
            final mealMap = Map<String, dynamic>.from(meal);
            print("Meal ${i+1} keys: ${mealMap.keys.toList()}");
            
            // Determine the meal key (breakfast, lunch, dinner, snack, etc.)
            String mealKey;
            
            // Check for meal_time field (primary method to identify meal type)
            if (mealMap.containsKey('meal_time')) {
              mealKey = mealMap['meal_time'].toString().toLowerCase();
              print("Found meal_time: $mealKey");
            }
            // Check for type field 
            else if (mealMap.containsKey('type')) {
              mealKey = mealMap['type'].toString().toLowerCase();
              print("Found type: $mealKey");
            }
            // Try to infer from title/name
            else if (mealMap.containsKey('title') || mealMap.containsKey('name')) {
              final title = (mealMap['title'] ?? mealMap['name']).toString().toLowerCase();
              print("Inferring meal type from title/name: $title");
              
              if (title.contains('breakfast')) {
                mealKey = 'breakfast';
              } else if (title.contains('lunch')) {
                mealKey = 'lunch';
              } else if (title.contains('dinner')) {
                mealKey = 'dinner';
              } else if (title.contains('snack')) {
                mealKey = 'snack';
              } else {
                mealKey = 'meal${i+1}';
              }
              
              print("Inferred meal type: $mealKey");
            }
            // Default to generic meal ID
            else {
              mealKey = 'meal${i+1}';
              print("Using default meal key: $mealKey");
            }
            
            // Make sure name is available
            if (!mealMap.containsKey('name')) {
              if (mealMap.containsKey('title')) {
                mealMap['name'] = mealMap['title'];
              } else {
                // Create a default name based on the meal type
                mealMap['name'] = mealKey.substring(0, 1).toUpperCase() + mealKey.substring(1);
              }
            }
            
            tryAddMeal(mealKey, mealMap);
          } else if (meal != null) {
            print("Meal ${i+1} is not a Map: ${meal.runtimeType}");
            tryAddMeal('meal${i+1}', meal);
          }
        } catch (e) {
          print("Error processing meal ${i+1}: $e");
        }
      }
    }
    
    // If we have meals from the list, we can return early
    if (meals.isNotEmpty) {
      print("Successfully created MenuDay with ${meals.length} meals from 'meals' list");
      return MenuDay(
        dayNumber: dayNumber,
        dayName: dayName,
        meals: meals,
      );
    }
    
    // Standard meal types to check at the top level
    final mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'snack1', 'snack2', 'snack3'];
    
    // Try to find meals directly in the JSON
    for (var mealType in mealTypes) {
      if (json.containsKey(mealType)) {
        print("Found direct $mealType entry in day JSON");
        tryAddMeal(mealType, json[mealType]);
      }
    }
    
    // Try searching for meal_ prefixed fields
    for (var key in json.keys) {
      if (key.startsWith('meal_') || key.toLowerCase().contains('breakfast') || 
          key.toLowerCase().contains('lunch') || key.toLowerCase().contains('dinner') ||
          key.toLowerCase().contains('snack')) {
        print("Found meal-related field: $key");
        final mealKey = key.replaceAll('meal_', '').toLowerCase();
        tryAddMeal(mealKey, json[key]);
      }
    }
    
    // Handle snacks array if present
    if (json.containsKey('snacks')) {
      try {
        final snacks = json['snacks'];
        print("Found 'snacks' field with type: ${snacks.runtimeType}");
        
        if (snacks is List) {
          for (int i = 0; i < snacks.length; i++) {
            tryAddMeal('snack${i+1}', snacks[i]);
          }
        } else if (snacks is Map) {
          // Handle case where snacks might be a map with keys
          final snacksMap = Map<String, dynamic>.from(snacks);
          int i = 1;
          for (var key in snacksMap.keys) {
            tryAddMeal('snack$i', snacksMap[key]);
            i++;
          }
        } else if (snacks != null) {
          // Try to use as a single snack
          tryAddMeal('snack1', snacks);
        }
      } catch (e) {
        print("Error parsing snacks: $e");
      }
    }
    
    // Try to find any map-like objects and use them as meals
    if (meals.isEmpty) {
      print("No standard meals found, searching for any Map objects");
      
      for (var key in json.keys) {
        if (json[key] is Map || json[key] is List) {
          final sanitizedKey = key.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase();
          if (sanitizedKey.isNotEmpty) {
            print("Found potential meal in field: $key");
            tryAddMeal(sanitizedKey, json[key]);
          }
        }
      }
    }
    
    // If we still don't have any meals, create a dummy meal
    if (meals.isEmpty) {
      print("WARNING: No meals found for day $dayNumber. Adding a placeholder meal.");
      meals['breakfast'] = MenuItem(
        name: "No meals found for $dayName",
        description: "This is a placeholder for day $dayNumber ($dayName) where no meals were found in the data.",
      );
    }
    
    print("Created MenuDay for day $dayNumber ($dayName) with ${meals.length} meals");
    return MenuDay(
      dayNumber: dayNumber,
      dayName: dayName,
      meals: meals,
    );
  }
}

class Menu {
  final int id;
  final String title;
  final DateTime createdAt;
  final int userId;
  final List<MenuDay> days;
  final int? totalCost;
  
  Menu({
    required this.id,
    required this.title,
    required this.createdAt,
    required this.userId,
    required this.days,
    this.totalCost,
  });
  
  factory Menu.fromJson(Map<String, dynamic> json) {
    print("Parsing menu: ${json.keys.toList()}");
    
    // Parse days data
    List<MenuDay> days = [];
    
    // Print raw JSON for debugging
    print("Menu.fromJson raw data structure: ${json.runtimeType}");
    try {
      print("Menu top level keys: ${json.keys.toList()}");
      
      if (json.containsKey('menu')) {
        print("Found 'menu' key, checking its structure");
        if (json['menu'] is Map<String, dynamic>) {
          // The menu might be wrapped in another menu object
          print("Using 'menu' key as the primary data source");
          return Menu.fromJson(json['menu']);
        }
      }
    } catch (e) {
      print("Error examining menu structure: $e");
    }
    
    // Handle 'menu_plan' variant from API
    if (json.containsKey('meal_plan')) {
      print("Found 'meal_plan' key: ${json['meal_plan'].runtimeType}");
      
      if (json['meal_plan'] is Map) {
        final mealPlan = json['meal_plan'] as Map<String, dynamic>;
        print("meal_plan keys: ${mealPlan.keys.toList()}");
        
        // Format 1: meal_plan with a days array inside a Map
        if (mealPlan.containsKey('days')) {
          print("Found 'days' key in meal_plan");
          final daysList = mealPlan['days'];
          
          if (daysList is List) {
            print("Processing ${daysList.length} days from meal_plan.days array");
            
            for (int i = 0; i < daysList.length; i++) {
              try {
                final day = daysList[i];
                
                if (day is Map<String, dynamic>) {
                  days.add(MenuDay.fromJson(day, i + 1));
                  print("Successfully parsed day ${i+1}");
                } else {
                  print("Day ${i+1} has type ${day.runtimeType}, attempting conversion");
                  // Try to convert it to a Map if possible
                  if (day != null) {
                    try {
                      final Map<String, dynamic> dayMap = Map<String, dynamic>.from(day as dynamic);
                      days.add(MenuDay.fromJson(dayMap, i + 1));
                      print("Successfully parsed day ${i+1} after conversion");
                    } catch (convE) {
                      print("Failed to convert day ${i+1}: $convE");
                    }
                  }
                }
              } catch (dayE) {
                print("Error parsing day ${i}: $dayE");
              }
            }
          } else if (daysList is Map) {
            // Format: meal_plan.days is a map with day1, day2, etc keys
            print("'days' is a Map with keys: ${daysList.keys.toList()}");
            
            // Sort day keys numerically
            final dayKeys = daysList.keys.toList()
              ..sort((a, b) {
                final numA = int.tryParse(a.replaceAll('day', '')) ?? 0;
                final numB = int.tryParse(b.replaceAll('day', '')) ?? 0;
                return numA.compareTo(numB);
              });
            
            for (var key in dayKeys) {
              if (key.startsWith('day')) {
                final dayNumStr = key.replaceAll('day', '');
                final dayNum = int.tryParse(dayNumStr) ?? 1;
                try {
                  days.add(MenuDay.fromJson(daysList[key], dayNum));
                  print("Successfully parsed $key");
                } catch (e) {
                  print("Error parsing day $key: $e");
                }
              }
            }
          } else {
            print("meal_plan.days is neither a List nor a Map, it's a ${daysList.runtimeType}");
          }
        }
        // Format 2: meal_plan with numbered days as direct keys (day1, day2, etc.)
        else {
          print("Looking for day keys in meal_plan");
          
          // Sort day keys numerically
          final dayKeys = mealPlan.keys.toList()
            ..sort((a, b) {
              final numA = int.tryParse(a.replaceAll('day', '')) ?? 0;
              final numB = int.tryParse(b.replaceAll('day', '')) ?? 0;
              return numA.compareTo(numB);
            });
          
          for (var key in dayKeys) {
            if (key.startsWith('day')) {
              final dayNumStr = key.replaceAll('day', '');
              final dayNum = int.tryParse(dayNumStr) ?? 1;
              try {
                days.add(MenuDay.fromJson(mealPlan[key], dayNum));
                print("Successfully parsed $key from mealPlan keys");
              } catch (e) {
                print("Error parsing $key from mealPlan keys: $e");
              }
            }
          }
        }
      } 
      // Format 3: meal_plan is directly a List of days
      else if (json['meal_plan'] is List) {
        print("meal_plan is directly a List of days");
        final daysList = json['meal_plan'] as List;
        for (int i = 0; i < daysList.length; i++) {
          try {
            final day = daysList[i];
            if (day is Map<String, dynamic>) {
              days.add(MenuDay.fromJson(day, i + 1));
              print("Successfully parsed day ${i+1} from direct list");
            }
          } catch (e) {
            print("Error parsing day ${i+1} from direct list: $e");
          }
        }
      }
      // Format 4: meal_plan is a String that needs to be decoded
      else if (json['meal_plan'] is String) {
        print("meal_plan is a String, attempting to decode as JSON");
        try {
          final mealPlanJson = jsonDecode(json['meal_plan']);
          
          if (mealPlanJson is Map && mealPlanJson.containsKey('days')) {
            print("Found 'days' in decoded meal_plan");
            final daysData = mealPlanJson['days'] as List;
            for (int i = 0; i < daysData.length; i++) {
              try {
                days.add(MenuDay.fromJson(daysData[i], i + 1));
                print("Successfully parsed day ${i+1} from decoded meal_plan");
              } catch (e) {
                print("Error parsing day ${i+1} from decoded meal_plan: $e");
              }
            }
          }
        } catch (e) {
          print("Error parsing meal_plan string as JSON: $e");
        }
      }
    } 
    // Format 5: direct days array at top level
    else if (json.containsKey('days') && json['days'] is List) {
      print("Found direct 'days' array at top level");
      final daysData = json['days'] as List;
      for (int i = 0; i < daysData.length; i++) {
        try {
          days.add(MenuDay.fromJson(daysData[i], i + 1));
          print("Successfully parsed day ${i+1} from top-level days array");
        } catch (e) {
          print("Error parsing day ${i+1} from top-level days array: $e");
        }
      }
    } 
    // Format 6: meals organized by day at top level
    else if (json.containsKey('meals') && json['meals'] is Map) {
      print("Found 'meals' Map organized by day at top level");
      final mealsData = json['meals'] as Map<String, dynamic>;
      
      // Try to extract days from this structure
      for (int i = 1; i <= 7; i++) {
        final dayKey = 'day$i';
        if (mealsData.containsKey(dayKey) && mealsData[dayKey] is Map) {
          try {
            days.add(MenuDay.fromJson(mealsData[dayKey], i));
            print("Successfully parsed $dayKey from meals Map");
          } catch (e) {
            print("Error parsing $dayKey from meals Map: $e");
          }
        }
      }
    }
    // Format 7: Direct day keys at top level (day1, day2, etc.)
    else {
      print("Checking for direct day keys at top level");
      final potentialDayKeys = json.keys.where((key) => key.startsWith('day')).toList()
        ..sort((a, b) {
          final numA = int.tryParse(a.replaceAll('day', '')) ?? 0;
          final numB = int.tryParse(b.replaceAll('day', '')) ?? 0;
          return numA.compareTo(numB);
        });
      
      if (potentialDayKeys.isNotEmpty) {
        print("Found direct day keys at top level: $potentialDayKeys");
        for (var key in potentialDayKeys) {
          final dayNumStr = key.replaceAll('day', '');
          final dayNum = int.tryParse(dayNumStr) ?? 1;
          try {
            days.add(MenuDay.fromJson(json[key], dayNum));
            print("Successfully parsed $key from top level");
          } catch (e) {
            print("Error parsing $key from top level: $e");
          }
        }
      }
    }
    
    if (days.isEmpty) {
      print("WARNING: No days were successfully parsed from the menu JSON");
    } else {
      print("Successfully parsed ${days.length} days for the menu");
    }
    
    // Safe parsing helpers
    int safeParseInt(dynamic value) {
      if (value == null) return 0;
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }
    
    DateTime safeParseDate(dynamic value) {
      if (value == null) return DateTime.now();
      if (value is String) {
        try {
          return DateTime.parse(value);
        } catch (e) {
          print("Error parsing date: $value");
          return DateTime.now();
        }
      }
      return DateTime.now();
    }
    
    return Menu(
      id: safeParseInt(json['id'] ?? json['menu_id']),
      title: json['title']?.toString() ?? json['nickname']?.toString() ?? "Weekly Menu",
      createdAt: json['created_at'] != null 
          ? safeParseDate(json['created_at'])
          : DateTime.now(),
      userId: safeParseInt(json['user_id']),
      days: days,
      totalCost: safeParseInt(json['total_cost']),
    );
  }
  
  // Helper method to extract all ingredients across all days and meals
  List<String> getAllIngredients() {
    List<String> allIngredients = [];
    
    for (var day in days) {
      for (var meal in day.meals.values) {
        if (meal.ingredients != null) {
          allIngredients.addAll(meal.ingredients!);
        }
      }
    }
    
    return allIngredients;
  }
}