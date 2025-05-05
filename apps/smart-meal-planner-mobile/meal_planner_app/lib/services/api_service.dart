import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:jwt_decoder/jwt_decoder.dart';

class ApiConfig {
  // Change this to your actual backend URL before building
  static const String baseUrl = "https://api.smartmealplanner.com";
  
  // For local development using Android emulator
  static const String localBaseUrl = "http://10.0.2.2:8000";
  
  // Active URL - switch between baseUrl and localBaseUrl as needed
  static const String activeUrl = localBaseUrl;
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

  // Parse error responses more effectively
  static Map<String, dynamic>? _parseResponse(http.Response response) {
    try {
      final Map<String, dynamic> data = jsonDecode(response.body);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return data;
      } else {
        print("API Error: ${response.statusCode} - ${data['detail'] ?? 'Unknown error'}");
        return null;
      }
    } catch (e) {
      print("Failed to parse response: $e");
      return null;
    }
  }

  // Auth endpoints
  static Future<Map<String, dynamic>?> login(String email, String password) async {
    final url = Uri.parse("$baseUrl/auth/login");
    final response = await http.post(
      url,
      headers: _getHeaders(null),
      body: jsonEncode({"email": email, "password": password}),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> signUp(
      String name, String email, String password, String captchaToken) async {
    final url = Uri.parse("$baseUrl/auth/signup");
    final response = await http.post(
      url,
      headers: _getHeaders(null),
      body: jsonEncode({
        "name": name, 
        "email": email, 
        "password": password,
        "captchaToken": captchaToken,
        "account_type": "individual"
      }),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> forgotPassword(String email) async {
    final url = Uri.parse("$baseUrl/auth/forgot_password");
    final response = await http.post(
      url,
      headers: _getHeaders(null),
      body: jsonEncode({"email": email}),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> resetPassword(String token, String newPassword) async {
    final url = Uri.parse("$baseUrl/auth/reset_password");
    final response = await http.post(
      url,
      headers: _getHeaders(null),
      body: jsonEncode({
        "reset_token": token,
        "new_password": newPassword
      }),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> verifyEmail(String token) async {
    final url = Uri.parse("$baseUrl/auth/verify-email/$token");
    final response = await http.get(
      url,
      headers: _getHeaders(null),
    );
    
    return _parseResponse(response);
  }

  // User preferences
  static Future<Map<String, dynamic>?> updatePreferences({
    required int userId,
    required String authToken,
    required Map<String, dynamic> preferences,
  }) async {
    final url = Uri.parse("$baseUrl/preferences/$userId");
    final response = await http.put(
      url,
      headers: _getHeaders(authToken),
      body: jsonEncode(preferences),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> getPreferences(int userId, String authToken) async {
    final url = Uri.parse("$baseUrl/preferences/$userId");
    final response = await http.get(
      url,
      headers: _getHeaders(authToken),
    );
    
    return _parseResponse(response);
  }

  // Menu generation
  static Future<Map<String, dynamic>?> generateMenu({
    required int userId,
    required String authToken,
    required Map<String, dynamic> menuParameters,
  }) async {
    final url = Uri.parse("$baseUrl/menu/generate");
    final response = await http.post(
      url,
      headers: _getHeaders(authToken),
      body: jsonEncode({
        "user_id": userId,
        ...menuParameters
      }),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> getSavedMenus(int userId, String authToken) async {
    final url = Uri.parse("$baseUrl/menu/saved/$userId");
    final response = await http.get(
      url,
      headers: _getHeaders(authToken),
    );
    
    return _parseResponse(response);
  }

  // Shopping list & cart
  static Future<Map<String, dynamic>?> getShoppingList(int userId, String authToken, int menuId) async {
    final url = Uri.parse("$baseUrl/grocery_list/$menuId");
    final response = await http.get(
      url,
      headers: _getHeaders(authToken),
    );
    
    return _parseResponse(response);
  }

  static Future<Map<String, dynamic>?> createCart({
    required int userId,
    required String authToken,
    required String storeName,
    required List<String> ingredients,
  }) async {
    final url = Uri.parse("$baseUrl/cart/");
    final response = await http.post(
      url,
      headers: _getHeaders(authToken),
      body: jsonEncode({
        "user_id": userId,
        "store_name": storeName,
        "ingredients": ingredients,
      }),
    );
    
    return _parseResponse(response);
  }

  // Store APIs
  static Future<Map<String, dynamic>?> getStores(String authToken, double latitude, double longitude) async {
    final url = Uri.parse("$baseUrl/store/nearby?lat=$latitude&lng=$longitude");
    final response = await http.get(
      url,
      headers: _getHeaders(authToken),
    );
    
    return _parseResponse(response);
  }

  // Orders
  static Future<Map<String, dynamic>?> placeOrder({
    required int userId,
    required String authToken,
    required String storeName,
    required List<dynamic> cartItems,
    required double totalCost,
  }) async {
    final url = Uri.parse("$baseUrl/order/");
    final response = await http.post(
      url,
      headers: _getHeaders(authToken),
      body: jsonEncode({
        "user_id": userId,
        "store_name": storeName,
        "items": cartItems,
        "total_cost": totalCost,
      }),
    );
    
    return _parseResponse(response);
  }

  // Helper for extracting user ID from JWT token
  static int? getUserIdFromToken(String token) {
    try {
      Map<String, dynamic> decodedToken = JwtDecoder.decode(token);
      return decodedToken['user_id'];
    } catch (e) {
      print("Failed to decode token: $e");
      return null;
    }
  }
}