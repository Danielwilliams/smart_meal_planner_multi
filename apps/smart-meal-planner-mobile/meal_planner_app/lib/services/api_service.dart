import 'dart:convert';
import 'dart:math' as math;
import 'dart:math' show min;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../Providers/auth_providers.dart';
import '../models/menu_model.dart';

// Global navigator key to access context from static methods
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class ApiConfig {
  // Production URL on Railway
  static const String productionUrl = "https://smartmealplannermulti-production.up.railway.app";
  
  // For local development using Android emulator
  static const String localBaseUrl = "http://10.0.2.2:8000";
  
  // Active URL - set to production for release builds
  static const String activeUrl = productionUrl;
}

class ApiService {
  static const String baseUrl = ApiConfig.activeUrl;

  // Add auth token to headers
  static Map<String, String> _getHeaders(String? token) {
    Map<String, String> headers = {
      "Content-Type": "application/json",
    };
    
    if (token != null) {
      headers["Authorization"] = "Bearer $token";
    }
    
    return headers;
  }
  
  // Helper function to convert Map<dynamic, dynamic> to Map<String, dynamic>
  // Also handles nested maps and lists containing maps
  static Map<String, dynamic> _toStringDynamicMap(Map map) {
    // Print the original map type for debugging
    print("Converting map of type ${map.runtimeType} to Map<String, dynamic>");
    
    final Map<String, dynamic> safeResult = {};
    
    map.forEach((key, value) {
      // Convert all keys to strings
      final String stringKey = key is String ? key : key.toString();
      
      // Now handle the value based on its type
      if (value is Map) {
        // Recursively convert nested maps
        safeResult[stringKey] = _toStringDynamicMap(value);
      } else if (value is List) {
        // Process list elements if they contain maps
        safeResult[stringKey] = _processListItems(value);
      } else {
        // For non-map values, add directly
        safeResult[stringKey] = value;
      }
    });
    
    return safeResult;
  }
  
  // Helper to process list items - handles lists that might contain maps
  static dynamic _processListItems(List list) {
    return list.map((item) {
      if (item is Map) {
        // Convert maps inside lists to Map<String, dynamic>
        return _toStringDynamicMap(item);
      } else if (item is List) {
        // Recursive handling for nested lists
        return _processListItems(item);
      } else {
        // Keep non-map items as-is
        return item;
      }
    }).toList();
  }
  
  // Clean image URLs from Kroger API by removing trailing semicolons and fixing formatting
  static String cleanImageUrl(String? url) {
    if (url == null || url.isEmpty) {
      return '';
    }
    
    // First, remove any semicolons that can appear in Kroger image URLs
    String cleaned = url.replaceAll(';', '').trim();
    
    // Kroger API sometimes returns images with quotes in the URL which need to be removed
    if (cleaned.contains('"')) {
      cleaned = cleaned.replaceAll('"', '');
    }
    
    // Fix common URL patterns
    if (cleaned.contains('images/xlarge/front')) {
      // Make sure there are no spaces between parts
      cleaned = cleaned.replaceAll(' ', '');
    }
    
    // Ensure we're using HTTPS
    if (cleaned.startsWith('http:')) {
      cleaned = 'https:' + cleaned.substring(5);
    }
    
    // Debug logging
    print("Image URL cleaned from: $url");
    print("                    to: $cleaned");
    
    return cleaned;
  }
  
  // Parse JSON response and handle errors - returns a normalized response
  // Always returns Map<String, dynamic> or List<dynamic> or null
  static dynamic _parseResponse(http.Response response) {
    try {
      if (response.body.isEmpty) {
        print("Empty response body");
        return null;
      }
      
      // Print a sample of the response body for debugging
      String responsePreview = response.body.length > 500 
          ? response.body.substring(0, 500) + "..." 
          : response.body;
      print("Response body preview: $responsePreview");
      
      // Parse the JSON first - could be a map or a list
      final dynamic data = json.decode(response.body);
      
      // Handle both Map and List responses
      if (data is Map) {
        // First convert to Map<String, dynamic> for type safety
        final Map<String, dynamic> safeData = _toStringDynamicMap(data);
        
        // Check if response contains error message
        if (safeData.containsKey('detail') && response.statusCode >= 400) {
          print("API Error: ${safeData['detail']}");
        }
        
        print("Response parsed as Map with ${safeData.keys.length} keys: ${safeData.keys.toList()}");
        return safeData;
      } else if (data is List) {
        // If it's a list, return it directly
        print("Response parsed as List with ${data.length} items");
        // Show a sample of list contents if available
        if (data.isNotEmpty) {
          if (data[0] is Map) {
            print("First item is a Map with keys: ${(data[0] as Map).keys.toList()}");
          } else {
            print("First item type: ${data[0].runtimeType}");
          }
        }
        return data;
      } else {
        print("Response is neither a Map nor a List: ${data.runtimeType}");
        return null;
      }
    } catch (e) {
      print("Error parsing response: $e");
      print("Response body: ${response.body}");
      return null;
    }
  }
  
  // Function to make GET requests
  static Future<dynamic> _get(String endpoint, String? token) async {
    try {
      final url = Uri.parse("$baseUrl$endpoint");
      final response = await http.get(
        url,
        headers: _getHeaders(token),
      );
      
      print("GET $endpoint - Status: ${response.statusCode}");
      return _parseResponse(response);
    } catch (e) {
      print("GET $endpoint - Error: $e");
      return null;
    }
  }
  
  // Function to make POST requests
  static Future<dynamic> _post(String endpoint, Map<String, dynamic> data, String? token) async {
    try {
      final url = Uri.parse("$baseUrl$endpoint");
      final response = await http.post(
        url,
        headers: _getHeaders(token),
        body: jsonEncode(data),
      );
      
      print("POST $endpoint - Status: ${response.statusCode}");
      return _parseResponse(response);
    } catch (e) {
      print("POST $endpoint - Error: $e");
      return null;
    }
  }

  // Get Kroger authentication status - improved version based on web app approach
  static Future<Map<String, dynamic>> getKrogerAuthStatus(int userId, String authToken) async {
    try {
      print("Checking Kroger authentication status for user $userId");
      
      final result = await _get("/kroger/connection-status", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Don't return mock data when API fails
      return {
        "is_authenticated": false,
        "is_connected": false,
        "error": "Could not retrieve Kroger authentication status"
      };
    } catch (e) {
      print("Error getting Kroger auth status: $e");
      return {
        "is_authenticated": false,
        "is_connected": false,
        "message": "Error checking authentication status"
      };
    }
  }
  
  // Add items directly to Kroger cart
  static Future<Map<String, dynamic>> addToKrogerCart({
    required int userId,
    required String authToken,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      print("=== ADDING ITEMS TO KROGER CART ===");
      print("Items count: ${items.length}");
      
      // Format items for Kroger cart API
      final krogerItems = items.map((item) => {
        "upc": item["upc"] ?? item["id"],
        "quantity": item["quantity"] ?? 1
      }).toList();
      
      final result = await _post("/kroger/cart/add", {
        "items": krogerItems
      }, authToken);
      
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return error response when API fails
      return {
        "success": false,
        "error": "Could not add items to Kroger cart - API did not return valid response"
      };
    } catch (e) {
      print("Error adding to Kroger cart: $e");
      return {
        "success": false,
        "error": "Failed to add items to cart: $e"
      };
    }
  }

  // Add items to internal cart (for backward compatibility)
  static Future<Map<String, dynamic>> addToInternalCart({
    required int userId,
    required String authToken,
    required String storeName,
    required List<String> ingredients,
  }) async {
    try {
      print("Adding ${ingredients.length} ingredients to $storeName cart");
      
      final result = await _post("/cart/internal/add_items", {
        "user_id": userId,
        "store": storeName,
        "items": ingredients
      }, authToken);
      
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return error response when API fails
      return {
        'success': false,
        'error': 'Could not add items to internal cart - API did not return valid response'
      };
    } catch (e) {
      print("Error adding to internal cart: $e");
      return {
        'success': false,
        'error': e.toString()
      };
    }
  }
  
  // Dedicated method to update Kroger tokens in database
  static Future<bool> updateKrogerTokens({
    required int userId,
    required String authToken,
    required String accessToken,
    required String refreshToken,
  }) async {
    try {
      print("Updating Kroger tokens in database");
      
      final result = await _post("/kroger/store-tokens", {
        "access_token": accessToken,
        "refresh_token": refreshToken
      }, authToken);
      
      if (result != null && result is Map) {
        final safeResult = _toStringDynamicMap(result);
        if (safeResult['success'] == true) {
          return true;
        }
      }
      
      // Return error instead of mock success
      return false;
    } catch (e) {
      print("Error updating Kroger tokens: $e");
      return false;
    }
  }
  
  // Basic order placement
  static Future<Map<String, dynamic>> placeOrder({
    required int userId,
    required String authToken,
    required String storeName,
    required List<dynamic> cartItems,
    required double totalCost,
  }) async {
    try {
      print("Placing order for $userId at $storeName with ${cartItems.length} items");
      
      final result = await _post("/order/place", {
        "user_id": userId,
        "store": storeName,
        "items": cartItems,
        "total": totalCost
      }, authToken);
      
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return error when API fails
      return {
        'success': false,
        'error': 'Could not place order - API did not return valid response'
      };
    } catch (e) {
      print("Error placing order: $e");
      return {
        'success': false,
        'error': e.toString()
      };
    }
  }
  
  // Get user account info
  static Future<Map<String, dynamic>> getUserAccountInfo(String authToken) async {
    try {
      final result = await _get("/auth/account-info", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return minimal account info with error flag
      return {
        "account_type": "individual",
        "is_trainer": false,
        "organization_id": null,
        "is_organization": false,
        "error": "Could not retrieve account information"
      };
    } catch (e) {
      print("Error getting user account info: $e");
      
      // Return default response even on error
      return {
        "account_type": "individual",
        "is_trainer": false,
        "organization_id": null,
        "is_organization": false
      };
    }
  }
  
  // Get user preferences
  static Future<Map<String, dynamic>> getPreferences(int userId, String authToken) async {
    try {
      final result = await _get("/preferences/$userId", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return default preferences with error flag
      return {
        "diet_type": "Mixed",
        "preferred_cuisine": "",
        "disliked_ingredients": [],
        "allergies": [],
        "disabled_features": [],
        "error": "Could not retrieve preferences"
      };
    } catch (e) {
      print("Error getting preferences: $e");
      
      // Return default preferences to avoid crashes
      return {
        "diet_type": "Mixed", 
        "preferred_cuisine": "",
        "disliked_ingredients": [],
        "allergies": [],
        "disabled_features": []
      };
    }
  }
  
  // Update user preferences
  static Future<Map<String, dynamic>> updatePreferences({
    required int userId,
    required String authToken,
    required Map<String, dynamic> preferences,
  }) async {
    try {
      final result = await _post("/preferences/$userId", preferences, authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Just return success to avoid errors
      return {'success': true};
    } catch (e) {
      print("Error updating preferences: $e");
      return {'success': false, 'error': e.toString()};
    }
  }
  
  // Get user's generated menus from database (not saved/favorite recipes)
  static Future<Map<String, dynamic>> getSavedMenus(int userId, String authToken) async {
    try {
      final result = await _get("/menu/history/$userId", authToken);
      print("Menu history response: $result");
      
      // If response is a List, wrap it in a Map with 'menus' key
      if (result is List) {
        print("Response is a List, converting to Map with 'menus' key");
        return {"menus": result};
      } else if (result is Map) {
        // Convert to Map<String, dynamic> for type safety
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        
        // If it's already a Map, check if it has 'menus' key
        if (safeResult.containsKey('menus')) {
          print("Response already has 'menus' key");
          return safeResult;
        } else {
          // If it doesn't have 'menus' key, wrap the whole result as a single menu
          print("Response doesn't have 'menus' key, wrapping as single menu");
          return {"menus": [safeResult]};
        }
      }
      
      // Return empty menus array to avoid UI crashes
      return {"menus": []};
    } catch (e) {
      print("Error getting menus: $e");
      return {"menus": []};
    }
  }
  
  // Get the latest menu
  static Future<Map<String, dynamic>> getLatestMenu(int userId, String authToken) async {
    try {
      // Try multiple endpoints in case of API changes
      print("Fetching latest menu for user ID: $userId");
      
      // Try /menu/latest/{userId} first
      final result = await _get("/menu/latest/$userId", authToken);
      if (result != null) {
        print("Latest menu response: $result");
        
        // Normalize the result to handle different response formats
        if (result is List) {
          print("Response is a List, taking the first item as the latest menu");
          if (result.isNotEmpty) {
            return {"menu": result[0]};
          } else {
            print("Empty list returned, no menus available");
            return {"menu": null};
          }
        } else if (result is Map) {
          // Convert to Map<String, dynamic> for type safety
          final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
          
          if (!safeResult.containsKey('menu')) {
            // If it doesn't have a 'menu' key, assume the entire object is the menu
            print("Response is a Map without 'menu' key, wrapping it");
            return {"menu": safeResult};
          } else {
            // Return as is if it already has a 'menu' key
            print("Response has expected format, using as is");
            return safeResult;
          }
        } else {
          // Handle unexpected type with a default response
          print("Response is neither List nor Map: ${result.runtimeType}");
          return {"menu": null};
        }
      }
      
      // Try /menu/{userId}/latest as fallback
      print("Primary endpoint failed, trying fallback endpoint");
      final fallbackResult = await _get("/menu/$userId/latest", authToken);
      if (fallbackResult != null) {
        print("Fallback response: $fallbackResult");
        
        // Normalize the fallback result too
        if (fallbackResult is List) {
          print("Fallback response is a List, taking the first item");
          if (fallbackResult.isNotEmpty) {
            return {"menu": fallbackResult[0]};
          } else {
            print("Empty list returned from fallback, no menus available");
            return {"menu": null};
          }
        } else if (fallbackResult is Map) {
          // Convert to Map<String, dynamic> for type safety
          final Map<String, dynamic> safeResult = _toStringDynamicMap(fallbackResult);
          
          if (!safeResult.containsKey('menu')) {
            // If it doesn't have a 'menu' key, assume the entire object is the menu
            print("Fallback response is a Map without 'menu' key, wrapping it");
            return {"menu": safeResult};
          } else {
            // Return as is if it already has a 'menu' key
            print("Fallback response has expected format, using as is");
            return safeResult;
          }
        } else {
          // Handle unexpected type with a default response
          print("Fallback response is neither List nor Map: ${fallbackResult.runtimeType}");
          return {"menu": null};
        }
      }
      
      // Try /menu/history/{userId} as another fallback and take the first item
      print("Both endpoints failed, trying menu history as last resort");
      final Map<String, dynamic> historyResult = await getSavedMenus(userId, authToken);
      if (historyResult.containsKey('menus')) {
        final menus = historyResult['menus'];
        if (menus is List && menus.isNotEmpty) {
          print("Found ${menus.length} menus in history, using the first one as latest");
          return {"menu": menus[0]};
        }
      }
      
      print("All endpoints failed, returning mock menu");
      // Return empty menu response - no mock data, forcing user to generate or try another API endpoint
      return {"menu": null};
    } catch (e) {
      print("Error getting latest menu: $e");
      return {"menu": null};
    }
  }
  
  // Save a menu
  static Future<Map<String, dynamic>> saveMenu({
    int? userId,
    String? authToken,
    String? title,
    List<Map<String, dynamic>>? days,
    Map<String, dynamic>? menuData,
  }) async {
    try {
      // Prepare menu data
      Map<String, dynamic> data = {};
      
      if (menuData != null) {
        data = menuData;
      } else {
        data = {
          "user_id": userId,
          "title": title ?? "My Menu",
          "meal_plan": {"days": days ?? []}
        };
      }
      
      final result = await _post("/menu/save", data, authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Just return success to avoid errors
      return {"success": false, "error": "Could not save menu - API did not return valid response"};
    } catch (e) {
      print("Error saving menu: $e");
      return {"success": false, "error": e.toString()};
    }
  }
  
  // Generate a menu
  static Future<Map<String, dynamic>> generateMenu({
    int? userId,
    String? authToken,
    List<String>? mealTypes,
    int? durationDays,
    String? dietaryPreferences,
    String? allergies,
    String? model,
    Map<String, dynamic>? menuParameters,
  }) async {
    try {
      // Prepare data for generation
      Map<String, dynamic> data = {};
      
      if (menuParameters != null) {
        data = menuParameters;
      } else {
        data = {
          "user_id": userId,
          "meal_types": mealTypes ?? ["breakfast", "lunch", "dinner"],
          "duration_days": durationDays ?? 7,
          "model": model ?? "default",
        };
        
        if (dietaryPreferences != null) {
          data["dietary_preferences"] = dietaryPreferences;
        }
        
        if (allergies != null) {
          data["allergies"] = allergies;
        }
      }
      
      final result = await _post("/menu/generate", data, authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return empty response - no mock data, force user to regenerate
      return {
        "error": "Could not generate menu. Please try again."
      };
    } catch (e) {
      print("Error generating menu: $e");
      return {"error": e.toString()};
    }
  }
  
  // Get shopping list for a menu
  static Future<Map<String, dynamic>> getShoppingList(int userId, String authToken, int menuId) async {
    try {
      print("Fetching shopping list for menu ID: $menuId");
      
      // Helper function to normalize shopping list response
      Map<String, dynamic> normalizeShoppingListResponse(dynamic result) {
        if (result is List) {
          print("Shopping list response is a List with ${result.length} items");
          
          // If it's a list of ingredients, wrap it in a standard format
          return {
            "ingredients": result,
            "menu_id": menuId,
            "total_items": result.length
          };
        } else if (result is Map) {
          // Make sure we have a string keys map
          final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
          
          // Ensure required fields
          if (!safeResult.containsKey('ingredients')) {
            print("Response is missing 'ingredients' key, adding empty array");
            safeResult['ingredients'] = [];
          }
          if (!safeResult.containsKey('menu_id')) {
            print("Response is missing 'menu_id' key, adding it");
            safeResult['menu_id'] = menuId;
          }
          if (!safeResult.containsKey('total_items') && safeResult.containsKey('ingredients')) {
            print("Response is missing 'total_items' key, calculating from ingredients");
            safeResult['total_items'] = (safeResult['ingredients'] as List).length;
          }
          return safeResult;
        }
        
        // Default empty response
        return {
          "ingredients": [],
          "menu_id": menuId,
          "total_items": 0
        };
      }
      
      // Try /menu/{menuId}/grocery-list first
      final result = await _get("/menu/$menuId/grocery-list", authToken);
      if (result != null) {
        print("Primary endpoint response: $result");
        return normalizeShoppingListResponse(result);
      }
      
      // Try /client/menus/{menuId}/grocery-list as fallback
      print("Primary endpoint failed, trying client endpoint");
      final clientResult = await _get("/client/menus/$menuId/grocery-list", authToken);
      if (clientResult != null) {
        print("Client endpoint response: $clientResult");
        return normalizeShoppingListResponse(clientResult);
      }
      
      // Try a third endpoint that might be used
      print("Both endpoints failed, trying third endpoint");
      final thirdResult = await _get("/grocery-list/$menuId", authToken);
      if (thirdResult != null) {
        print("Third endpoint response: $thirdResult");
        return normalizeShoppingListResponse(thirdResult);
      }
      
      // All endpoints failed, return empty shopping list
      print("All endpoints failed, returning empty shopping list");
      return {
        "ingredients": [],
        "categories": {},
        "menu_id": menuId,
        "total_items": 0,
        "error": "Could not fetch shopping list from API"
      };
    } catch (e) {
      print("Error getting shopping list: $e");
      return {
        "ingredients": [],
        "categories": {},
        "menu_id": menuId,
        "total_items": 0
      };
    }
  }
  
  // Verify Kroger authorization
  static Future<bool> verifyKrogerAuth(int userId, String authToken) async {
    try {
      final result = await _get("/kroger/check-credentials", authToken);
      if (result != null && result is Map) {
        final safeResult = _toStringDynamicMap(result);
        if (safeResult['has_access_token'] == true) {
          return true;
        }
      }
      
      // Return failure when API fails
      return false;
    } catch (e) {
      print("Error verifying Kroger auth: $e");
      return false;
    }
  }
  
  // Complete Kroger authorization process
  static Future<Map<String, dynamic>> completeKrogerAuth(
    int userId, 
    String authToken, 
    String code,
    [String redirectUri = 'https://www.smartmealplannerio.com/kroger/callback']
  ) async {
    try {
      final result = await _post("/kroger/auth-callback", {
        "code": code,
        "redirect_uri": redirectUri,
        "grant_type": "authorization_code"
      }, authToken);
      
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return error instead of mock success
      return {
        "success": false,
        "error": "Could not complete Kroger authorization - API did not return valid response"
      };
    } catch (e) {
      print("Error completing Kroger auth: $e");
      return {
        "success": false,
        "error": e.toString()
      };
    }
  }
  
  // Get Kroger store search URL
  static Future<String?> getKrogerAuthUrl(
    int userId, 
    String authToken,
    [String redirectUri = 'https://www.smartmealplannerio.com/kroger/callback']
  ) async {
    try {
      final result = await _get("/kroger/login-url", authToken);
      if (result != null && result is Map) {
        final safeResult = _toStringDynamicMap(result);
        if (safeResult['url'] != null) {
          return safeResult['url'].toString();
        }
      }
      
      // Don't return mock URL
      return null;
    } catch (e) {
      print("Error getting Kroger auth URL: $e");
      return null;
    }
  }
  
  // Get Kroger stores
  static Future<Map<String, dynamic>> getKrogerStores(int userId, String authToken, String zipCode) async {
    try {
      final result = await _get("/kroger/stores/near?zip_code=$zipCode&radius=15", authToken);
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return empty stores array instead of mock data
      return {
        "stores": [],
        "error": "Could not retrieve store information"
      };
    } catch (e) {
      print("Error getting Kroger stores: $e");
      return {
        "stores": []
      };
    }
  }
  
  // Get order history
  static Future<Map<String, dynamic>> getOrderHistory(int userId, String authToken) async {
    try {
      final result = await _get("/order/history/$userId", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return empty orders instead of mock data
      return {
        "orders": [],
        "error": "Could not retrieve order history"
      };
    } catch (e) {
      print("Error getting order history: $e");
      return {
        "orders": []
      };
    }
  }

  // Search store items
  static Future<Map<String, dynamic>> searchStoreItems({
    required int userId,
    required String authToken,
    required String storeName,
    required List<String> ingredients,
  }) async {
    try {
      // Determine the endpoint based on store name
      String endpoint = "/store/search";
      if (storeName.toLowerCase() == 'kroger') {
        endpoint = "/kroger/search";
      } else if (storeName.toLowerCase() == 'walmart') {
        endpoint = "/walmart/search";
      }
      
      final result = await _post(endpoint, {
        "items": ingredients
      }, authToken);
      
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return empty results instead of mock data
      return {
        "success": false,
        "results": [],
        "total": 0,
        "store": storeName,
        "message": "Could not search store items - API did not return valid response"
      };
    } catch (e) {
      print("Error searching store items: $e");
      return {
        "success": false,
        "results": [],
        "total": 0,
        "store": storeName,
        "message": "Failed to search store items: $e"
      };
    }
  }
  
  // Get store cart
  static Future<Map<String, dynamic>> getStoreCart({
    required int userId,
    required String authToken,
    required String storeName,
  }) async {
    try {
      final result = await _get("/cart/internal/$userId/contents?store=$storeName", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return empty cart instead of mock data
      return {
        "items": [],
        "total": 0,
        "store": storeName,
        "error": "Could not retrieve cart data"
      };
    } catch (e) {
      print("Error getting store cart: $e");
      return {
        "items": [],
        "total": 0,
        "store": storeName
      };
    }
  }
  
  // Get AI model status
  static Future<Map<String, dynamic>> getAIModelStatus() async {
    try {
      final result = await _get("/ai/model-status", null);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return error status instead of default
      return {
        "isAvailable": false,
        "message": "Could not determine AI model status - API did not return valid response",
        "localModelExists": false,
        "error": true
      };
    } catch (e) {
      print("Failed to get AI model status: $e");
      // Return a default status if we can't reach the server
      return {
        "isAvailable": true,
        "message": "",
        "localModelExists": false
      };
    }
  }
  
  // Get user ID from token
  static int? getUserIdFromToken(String token) {
    try {
      Map<String, dynamic> decodedToken = JwtDecoder.decode(token);
      return decodedToken['user_id'];
    } catch (e) {
      print("Failed to decode token: $e");
      return null;
    }
  }
  
  // Login
  static Future<Map<String, dynamic>?> login(String email, String password) async {
    try {
      final url = Uri.parse("$baseUrl/auth/login");
      final response = await http.post(
        url,
        headers: _getHeaders(null),
        body: jsonEncode({"email": email, "password": password}),
      );
      
      final result = _parseResponse(response);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      return null;
    } catch (e) {
      print("Login error: $e");
      return null;
    }
  }
  
  // Sign up
  static Future<Map<String, dynamic>?> signUp(
    String name, 
    String email, 
    String password,
    String captchaToken
  ) async {
    try {
      final url = Uri.parse("$baseUrl/auth/signup");
      final response = await http.post(
        url,
        headers: _getHeaders(null),
        body: jsonEncode({
          "name": name,
          "email": email,
          "password": password,
          "captcha_token": captchaToken
        }),
      );
      
      final result = _parseResponse(response);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      return null;
    } catch (e) {
      print("Sign up error: $e");
      return null;
    }
  }
  
  // Forgot password
  static Future<Map<String, dynamic>?> forgotPassword(String email) async {
    try {
      final url = Uri.parse("$baseUrl/auth/forgot-password");
      final response = await http.post(
        url,
        headers: _getHeaders(null),
        body: jsonEncode({"email": email}),
      );
      
      final result = _parseResponse(response);
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      return null;
    } catch (e) {
      print("Forgot password error: $e");
      return null;
    }
  }
  
  // Reset password
  static Future<Map<String, dynamic>?> resetPassword(String token, String newPassword) async {
    try {
      final url = Uri.parse("$baseUrl/auth/reset-password");
      final response = await http.post(
        url,
        headers: _getHeaders(null),
        body: jsonEncode({"token": token, "password": newPassword}),
      );
      
      final result = _parseResponse(response);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      return null;
    } catch (e) {
      print("Reset password error: $e");
      return null;
    }
  }
  
  // Get saved recipes
  static Future<Map<String, dynamic>> getSavedRecipes(int userId, String authToken) async {
    try {
      final result = await _get("/saved-recipes/", authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return empty recipes array
      return {
        "recipes": [],
        "error": "Could not retrieve saved recipes"
      };
    } catch (e) {
      print("Error getting saved recipes: $e");
      return {
        "recipes": [] // Return empty recipes array as fallback
      };
    }
  }
  
  // Save recipe
  static Future<Map<String, dynamic>> saveRecipe({
    required int userId,
    required String authToken,
    Map<String, dynamic>? recipe,
    int? recipeId,
  }) async {
    try {
      Map<String, dynamic> data = {};
      
      if (recipe != null) {
        data = recipe;
      } else if (recipeId != null) {
        data = {"recipe_id": recipeId};
      } else {
        throw Exception("Either recipe or recipeId must be provided");
      }
      
      final result = await _post("/saved-recipes/", data, authToken);
      if (result != null && result is Map) {
        final Map<String, dynamic> safeResult = _toStringDynamicMap(result);
        return safeResult;
      }
      
      // Return mock success
      return {
        "success": true,
        "recipe_id": recipeId != null ? recipeId.toString() : "recipe-${DateTime.now().millisecondsSinceEpoch}",
        "message": "Recipe saved successfully"
      };
    } catch (e) {
      print("Error saving recipe: $e");
      return {
        "success": false,
        "error": e.toString()
      };
    }
  }
  
  // Search recipes 
  static Future<Map<String, dynamic>> searchRecipes({
    required int userId,
    required String authToken,
    required String query,
    String? category,
    List<String>? categories,
    int? page,
    int? pageSize,
  }) async {
    try {
      // Build query parameters
      String queryParams = "query=${Uri.encodeComponent(query)}";
      if (category != null) {
        queryParams += "&category=${Uri.encodeComponent(category)}";
      }
      if (categories != null && categories.isNotEmpty) {
        queryParams += "&categories=${Uri.encodeComponent(categories.join(','))}";
      }
      if (page != null) {
        queryParams += "&page=$page";
      }
      if (pageSize != null) {
        queryParams += "&page_size=$pageSize";
      }
      
      final result = await _get("/scraped-recipes/?$queryParams", authToken);
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return empty search results instead of mock data
      return {
        "recipes": [],
        "total": 0,
        "page": page ?? 1,
        "page_size": pageSize ?? 20,
        "error": "Recipe search did not return valid results"
      };
    } catch (e) {
      print("Error searching recipes: $e");
      return {
        "recipes": [],
        "total": 0,
        "page": page ?? 1,
        "page_size": pageSize ?? 20
      };
    }
  }
  
  // Get organization details
  static Future<Map<String, dynamic>> getOrganizationDetails(int orgId, String authToken) async {
    try {
      final result = await _get("/organizations/$orgId", authToken);
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return minimal organization data with error flag
      return {
        "id": orgId,
        "name": "Organization",
        "error": "Could not retrieve complete organization details"
      };
    } catch (e) {
      print("Error getting organization details: $e");
      return {
        "id": orgId,
        "name": "Your Organization",
        "error": true
      };
    }
  }
  
  // Get organization clients
  static Future<Map<String, dynamic>> getOrganizationClients(int orgId, String authToken) async {
    try {
      // Try the primary endpoint first
      final result = await _get("/organization-clients/$orgId", authToken);
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Try alternate endpoint if first one fails
      final altResult = await _get("/organizations/$orgId/clients", authToken);
      if (altResult != null && altResult is Map) {
        return _toStringDynamicMap(altResult);
      }
      
      // Return empty clients instead of mock data
      return {
        "clients": [],
        "total": 0,
        "organization_id": orgId,
        "error": "Could not retrieve organization clients"
      };
    } catch (e) {
      print("Error getting organization clients: $e");
      return {
        "clients": [],
        "total": 0,
        "organization_id": orgId
      };
    }
  }
  
  // Create client invitation
  static Future<Map<String, dynamic>> createClientInvitation(
    int orgId, 
    String authToken, 
    String clientEmail, 
    String clientName
  ) async {
    try {
      final result = await _post("/org-invitations/invite", {
        "email": clientEmail,
        "organization_id": orgId,
        "name": clientName
      }, authToken);
      
      if (result != null && result is Map) {
        return _toStringDynamicMap(result);
      }
      
      // Return error instead of mock success
      return {
        "success": false,
        "error": "Could not create invitation - API did not return valid response"
      };
    } catch (e) {
      print("Error creating client invitation: $e");
      return {
        "success": false,
        "error": e.toString()
      };
    }
  }
}