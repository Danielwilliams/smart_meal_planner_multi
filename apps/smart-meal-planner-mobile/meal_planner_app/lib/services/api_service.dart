import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = "http://127.0.0.1:8000";

  static Future<Map<String, dynamic>?> login(String email, String password) async {
    final url = Uri.parse("$baseUrl/auth/login");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"email": email, "password": password}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  static Future<Map<String, dynamic>?> signUp(String name, String email, String password) async {
    final url = Uri.parse("$baseUrl/auth/signup");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"name": name, "email": email, "password": password}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return null;
  }

  // Add more calls: forgot_password, reset_password, preferences, menu generation, etc.
}


static Future<Map<String, dynamic>?> updatePreferences({
  required int userId,
  required String authToken,
  required List<String> dietaryRestrictions,
  required List<String> dislikedIngredients,
  required String dietType,
}) async {
  final url = Uri.parse("$baseUrl/preferences/$userId");
  final response = await http.put(
    url,
    headers: {
      "Content-Type": "application/json",
      // Optionally add "Authorization": "Bearer $authToken" if your backend checks JWT
    },
    body: jsonEncode({
      "dietary_restrictions": dietaryRestrictions,
      "disliked_ingredients": dislikedIngredients,
      "diet_type": dietType,
    }),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}


static Future<Map<String, dynamic>?> generateMenu({
  required int userId,
  required String authToken,
  required List<String> mealTypes,
}) async {
  final url = Uri.parse("$baseUrl/menu/generate/$userId");
  final response = await http.post(
    url,
    headers: {
      "Content-Type": "application/json",
      // "Authorization": "Bearer $authToken" if needed
    },
    body: jsonEncode({"meal_types": mealTypes}),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
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
    headers: {
      "Content-Type": "application/json",
      // "Authorization": "Bearer $authToken",
    },
    body: jsonEncode({
      "user_id": userId,
      "store_name": storeName,
      "ingredients": ingredients,
    }),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}

static Future<Map<String, dynamic>?> placeOrder({
  required int userId,
  required String authToken,
  required String storeName,
  required List<dynamic> cartItems,
  required double totalCost,
}) async {
  final url = Uri.parse("$baseUrl/order/");
  // Convert cartItems to the format your backend expects
  final response = await http.post(
    url,
    headers: {
      "Content-Type": "application/json",
      // "Authorization": "Bearer $authToken",
    },
    body: jsonEncode({
      "user_id": userId,
      "store_name": storeName,
      "items": cartItems,
      "total_cost": totalCost,
    }),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}

static Future<Map<String, dynamic>?> forgotPassword(String email) async {
  final url = Uri.parse("$baseUrl/auth/forgot_password");
  final response = await http.post(
    url,
    headers: {"Content-Type": "application/json"},
    body: jsonEncode({"email": email}),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}

static Future<Map<String, dynamic>?> resetPassword(String token, String newPassword) async {
  final url = Uri.parse("$baseUrl/auth/reset_password");
  final response = await http.post(
    url,
    headers: {"Content-Type": "application/json"},
    body: jsonEncode({
      "reset_token": token,
      "new_password": newPassword
    }),
  );
  if (response.statusCode == 200) {
    return jsonDecode(response.body);
  }
  return null;
}