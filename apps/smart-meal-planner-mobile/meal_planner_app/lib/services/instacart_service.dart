import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_service.dart';

class InstacartService {
  static const String baseUrl = ApiService.baseUrl;
  
  // Helper method to get headers with auth token
  static Map<String, String> _getHeaders(String authToken) {
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer $authToken"
    };
  }
  
  // Get nearby retailers based on ZIP code
  static Future<List<Map<String, dynamic>>> getNearbyRetailers(String authToken, String zipCode) async {
    try {
      print("Getting nearby retailers for ZIP code: $zipCode");

      final url = Uri.parse("$baseUrl/instacart/retailers/nearby?zip_code=$zipCode");
      final response = await http.get(url, headers: _getHeaders(authToken));

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        print("Raw response type: ${responseData.runtimeType}");

        if (responseData is Map && responseData.containsKey('retailers')) {
          print("Got ${(responseData['retailers'] as List).length} nearby retailers");

          // Process each retailer to ensure proper types for id field
          final List<dynamic> rawRetailers = responseData['retailers'];
          final List<Map<String, dynamic>> processedRetailers = [];

          for (var retailer in rawRetailers) {
            if (retailer is Map) {
              // Create a new map with all fields
              final Map<String, dynamic> processedRetailer = Map<String, dynamic>.from(retailer);

              // Ensure id is a string
              if (processedRetailer.containsKey('id')) {
                processedRetailer['id'] = processedRetailer['id'].toString();
              }
              if (processedRetailer.containsKey('retailer_id')) {
                processedRetailer['retailer_id'] = processedRetailer['retailer_id'].toString();
              }

              processedRetailers.add(processedRetailer);
            }
          }

          return processedRetailers;
        } else if (responseData is List) {
          print("Got ${responseData.length} nearby retailers");

          // Process each retailer to ensure proper types for id field
          final List<Map<String, dynamic>> processedRetailers = [];

          for (var retailer in responseData) {
            if (retailer is Map) {
              // Create a new map with all fields
              final Map<String, dynamic> processedRetailer = Map<String, dynamic>.from(retailer);

              // Ensure id is a string
              if (processedRetailer.containsKey('id')) {
                processedRetailer['id'] = processedRetailer['id'].toString();
              }
              if (processedRetailer.containsKey('retailer_id')) {
                processedRetailer['retailer_id'] = processedRetailer['retailer_id'].toString();
              }

              processedRetailers.add(processedRetailer);
            }
          }

          return processedRetailers;
        }
      }

      print("Failed to get nearby retailers: ${response.statusCode}");
      return [];
    } catch (e) {
      print("Error getting nearby retailers: $e");
      return [];
    }
  }
  
  // Search for products
  static Future<List<Map<String, dynamic>>> searchProducts(
    String authToken,
    dynamic retailerId,
    List<String> ingredients
  ) async {
    try {
      print("Searching for ${ingredients.length} products at retailer: $retailerId (${retailerId.runtimeType})");

      // Use string interpolation for safest string conversion
      String retailerIdStr = '$retailerId';
      print("Forced retailerId to string: $retailerIdStr (${retailerIdStr.runtimeType})");

      print("Converted retailerId: $retailerIdStr (${retailerIdStr.runtimeType})");
      print("First few ingredients: ${ingredients.take(3).join(', ')}");

      final url = Uri.parse("$baseUrl/instacart/search");
      final requestBody = json.encode({
        "retailer_id": retailerIdStr,
        "items": ingredients
      });

      print("Request body: $requestBody");

      final response = await http.post(
        url,
        headers: _getHeaders(authToken),
        body: requestBody
      );

      print("Search response status: ${response.statusCode}");

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);

        if (responseData is Map && responseData.containsKey('results')) {
          print("Got ${(responseData['results'] as List).length} search results");
          return List<Map<String, dynamic>>.from(responseData['results']);
        } else if (responseData is List) {
          print("Got ${responseData.length} search results");
          return List<Map<String, dynamic>>.from(responseData);
        }
      } else {
        print("Error response: ${response.body}");
      }

      print("Failed to search products: ${response.statusCode}");
      return [];
    } catch (e) {
      print("Error searching products: $e");
      return [];
    }
  }
  
  // Add items to Instacart cart
  static Future<Map<String, dynamic>> addToCart(
    String authToken,
    dynamic retailerId,
    List<Map<String, dynamic>> items
  ) async {
    try {
      print("Adding ${items.length} items to Instacart cart for retailer: $retailerId (${retailerId.runtimeType})");

      // Use string interpolation for safest string conversion
      String retailerIdStr = '$retailerId';
      print("Forced retailerId to string: $retailerIdStr (${retailerIdStr.runtimeType})");

      // Process items to ensure proper types
      final processedItems = items.map((item) {
        // Extract ID, ensuring it's a string
        var productId = item['product_id'] ?? item['id'] ?? '';
        String productIdStr = productId is String ? productId : productId.toString();

        // Extract quantity, ensuring it's an integer
        var quantity = item['quantity'] ?? 1;
        int quantityInt = quantity is int ? quantity : int.tryParse(quantity.toString()) ?? 1;

        return {
          "product_id": productIdStr,
          "quantity": quantityInt
        };
      }).toList();

      print("Processed ${processedItems.length} items for cart");

      final url = Uri.parse("$baseUrl/instacart/cart/add");
      final requestBody = json.encode({
        "retailer_id": retailerIdStr,
        "items": processedItems
      });

      print("Request body: $requestBody");

      final response = await http.post(
        url,
        headers: _getHeaders(authToken),
        body: requestBody
      );

      print("Add to cart response status: ${response.statusCode}");

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);

        if (responseData is Map) {
          print("Successfully added items to cart");
          return Map<String, dynamic>.from(responseData);
        }
      } else {
        print("Error response: ${response.body}");
      }

      print("Failed to add items to cart: ${response.statusCode}");
      return {
        "success": false,
        "error": "Failed to add items to cart",
        "status_code": response.statusCode
      };
    } catch (e) {
      print("Error adding items to cart: $e");
      return {
        "success": false,
        "error": e.toString()
      };
    }
  }
  
  // Get cart contents
  static Future<Map<String, dynamic>> getCartContents(
    String authToken,
    dynamic retailerId
  ) async {
    try {
      print("Getting cart contents for retailer: $retailerId (${retailerId.runtimeType})");

      // Use string interpolation for safest string conversion
      String retailerIdStr = '$retailerId';
      print("Forced retailerId to string: $retailerIdStr (${retailerIdStr.runtimeType})");

      final url = Uri.parse("$baseUrl/instacart/cart?retailer_id=$retailerIdStr");
      print("URL for cart contents: $url");

      final response = await http.get(url, headers: _getHeaders(authToken));

      print("Get cart contents response status: ${response.statusCode}");

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);

        if (responseData is Map) {
          print("Got cart contents with ${responseData['item_count'] ?? 'unknown'} items");
          return Map<String, dynamic>.from(responseData);
        }
      } else {
        print("Error response: ${response.body}");
      }

      print("Failed to get cart contents: ${response.statusCode}");
      return {
        "success": false,
        "error": "Failed to get cart contents",
        "items": []
      };
    } catch (e) {
      print("Error getting cart contents: $e");
      return {
        "success": false,
        "error": e.toString(),
        "items": []
      };
    }
  }
  
  // Get checkout URL
  static Future<String?> getCheckoutUrl(
    String authToken,
    dynamic retailerId
  ) async {
    try {
      print("Getting checkout URL for retailer: $retailerId (${retailerId.runtimeType})");

      // Use string interpolation for safest string conversion
      String retailerIdStr = '$retailerId';
      print("Forced retailerId to string: $retailerIdStr (${retailerIdStr.runtimeType})");

      final url = Uri.parse("$baseUrl/instacart/checkout");
      final requestBody = json.encode({
        "retailer_id": retailerIdStr
      });

      print("Checkout request body: $requestBody");

      final response = await http.post(
        url,
        headers: _getHeaders(authToken),
        body: requestBody
      );

      print("Checkout response status: ${response.statusCode}");

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);

        if (responseData is Map && responseData.containsKey('checkout_url')) {
          print("Got checkout URL: ${responseData['checkout_url']}");
          return responseData['checkout_url'];
        }
      } else {
        print("Error response: ${response.body}");
      }

      print("Failed to get checkout URL: ${response.statusCode}");
      return null;
    } catch (e) {
      print("Error getting checkout URL: $e");
      return null;
    }
  }
}