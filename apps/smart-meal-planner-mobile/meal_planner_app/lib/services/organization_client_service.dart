import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_management_model.dart';
import 'api_service.dart';

class OrganizationClientService {
  // Get organization clients
  static Future<List<ClientUser>> getOrganizationClients(String authToken) async {
    try {
      final clientsData = await ApiService.getOrganizationClientsList(authToken);

      // Convert the raw client data to ClientUser objects
      return clientsData.map((client) => ClientUser.fromJson(client)).toList();
    } catch (e) {
      print("Error getting organization clients: $e");
      return [];
    }
  }

  // Add a client to organization
  static Future<Map<String, dynamic>> addOrganizationClient(
    String authToken, 
    String name, 
    String email,
    String password
  ) async {
    return ApiService.addOrganizationClient(authToken, name, email, password);
  }

  // Remove client from organization
  static Future<Map<String, dynamic>> removeOrganizationClient(
    String authToken,
    int clientId
  ) async {
    return ApiService.removeOrganizationClient(authToken, clientId);
  }
  
  // Get client details
  static Future<ClientUser?> getClientDetails(String authToken, int clientId) async {
    try {
      // Create custom get requests instead of using private methods
      final clientUrl = Uri.parse("${ApiService.baseUrl}/subscriptions/user-management/org/clients/$clientId");
      final headers = {"Authorization": "Bearer $authToken", "Content-Type": "application/json"};

      final response = await http.get(clientUrl, headers: headers);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return ClientUser.fromJson(data);
      }

      // Try fallback endpoint
      final fallbackUrl = Uri.parse("${ApiService.baseUrl}/organization-clients/$clientId");
      final fallbackResponse = await http.get(fallbackUrl, headers: headers);

      if (fallbackResponse.statusCode == 200) {
        final data = json.decode(fallbackResponse.body);
        return ClientUser.fromJson(data);
      }

      // If both fail, return null
      return null;
    } catch (e) {
      print("Error getting client details: $e");
      return null;
    }
  }

  // Update client details
  static Future<Map<String, dynamic>> updateClientDetails(
    String authToken,
    int clientId,
    Map<String, dynamic> updatedData
  ) async {
    try {
      // Create custom post requests instead of using private methods
      final url = Uri.parse("${ApiService.baseUrl}/subscriptions/user-management/org/clients/$clientId/update");
      final headers = {"Authorization": "Bearer $authToken", "Content-Type": "application/json"};

      final response = await http.post(
        url,
        headers: headers,
        body: json.encode(updatedData)
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      }

      // Try fallback endpoint
      final fallbackUrl = Uri.parse("${ApiService.baseUrl}/organization-clients/$clientId/update");
      final fallbackResponse = await http.post(
        fallbackUrl,
        headers: headers,
        body: json.encode(updatedData)
      );

      if (fallbackResponse.statusCode == 200) {
        return json.decode(fallbackResponse.body);
      }

      // Return error if both fail
      return {
        "success": false,
        "error": "Failed to update client - API did not return valid response"
      };
    } catch (e) {
      print("Error updating client details: $e");
      return {
        "success": false,
        "error": e.toString()
      };
    }
  }
}