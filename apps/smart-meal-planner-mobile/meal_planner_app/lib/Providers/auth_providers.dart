import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  String? _authToken;
  int? _userId;
  String? _userName;
  String? _userEmail;

  bool get isLoggedIn => _isLoggedIn;
  String? get authToken => _authToken;
  int? get userId => _userId;
  String? get userName => _userName;
  String? get userEmail => _userEmail;

  // Store credentials (encrypted in a real app)
  String? _lastEmail;
  String? _lastPassword;

  // Initialize by checking if token exists in storage
  AuthProvider() {
    _loadFromPrefs();
  }
  
  // Getters for last credentials (would be properly secured in production)
  String? get lastEmail => _lastEmail;
  String? get lastPassword => _lastPassword;

  // Load auth data from SharedPreferences
  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    
    if (token != null) {
      _authToken = token;
      _userId = ApiService.getUserIdFromToken(token);
      _userName = prefs.getString('user_name');
      _userEmail = prefs.getString('user_email');
      _lastEmail = prefs.getString('last_email');
      _lastPassword = prefs.getString('last_password');
      
      // Check if token is expired
      if (_userId != null) {
        _isLoggedIn = true;
        notifyListeners();
      } else {
        // Token is invalid or expired, clear it
        _clearAuthData();
      }
    }
  }

  // Save auth data to SharedPreferences
  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    
    if (_authToken != null) {
      prefs.setString('auth_token', _authToken!);
    }
    
    if (_userName != null) {
      prefs.setString('user_name', _userName!);
    }
    
    if (_userEmail != null) {
      prefs.setString('user_email', _userEmail!);
    }
    
    // Store credentials for auto-refresh (would be securely encrypted in production)
    if (_lastEmail != null) {
      prefs.setString('last_email', _lastEmail!);
    }
    
    if (_lastPassword != null) {
      prefs.setString('last_password', _lastPassword!);
    }
  }

  // Clear auth data from SharedPreferences
  Future<void> _clearAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    prefs.remove('auth_token');
    prefs.remove('user_name');
    prefs.remove('user_email');
    // Don't clear credentials to enable auto-login later
    // prefs.remove('last_email');  
    // prefs.remove('last_password');
    
    _isLoggedIn = false;
    _authToken = null;
    _userId = null;
    _userName = null;
    _userEmail = null;
    // Keep last credentials for potential re-login
    // _lastEmail = null;
    // _lastPassword = null;
  }

  Future<bool> login(String email, String password) async {
    try {
      final result = await ApiService.login(email, password);
      
      if (result != null && result["access_token"] != null) {
        _authToken = result["access_token"];
        _userId = ApiService.getUserIdFromToken(_authToken!);
        
        if (_userId == null) {
          // Failed to extract user ID from token
          return false;
        }
        
        // Extract user information
        if (result["user"] != null) {
          _userName = result["user"]["name"];
          _userEmail = result["user"]["email"];
        } else {
          _userEmail = email;
        }
        
        // Store credentials for auto-refresh (would be securely stored in production)
        _lastEmail = email;
        _lastPassword = password;
        
        _isLoggedIn = true;
        await _saveToPrefs();
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      print("Login error: $e");
      return false;
    }
  }

  Future<bool> signUp(String name, String email, String password) async {
    try {
      // For demo purposes - in prod, get actual captcha token
      String dummyCaptchaToken = "demo-captcha-token";
      
      final result = await ApiService.signUp(name, email, password, dummyCaptchaToken);
      
      if (result != null && result["message"] != null) {
        // Sign-up successful, but user may need to verify email
        // Return true but don't auto-login if verification is required
        
        if (result["message"].toString().contains("verify")) {
          // Email verification required
          return true;
        } else {
          // No verification required, auto-login
          return await login(email, password);
        }
      }
      return false;
    } catch (e) {
      print("Sign up error: $e");
      return false;
    }
  }

  Future<void> logout() async {
    print("AuthProvider logout method called");
    try {
      await _clearAuthData();
      print("Auth data cleared successfully");
      notifyListeners();
    } catch (e) {
      print("Error during logout: $e");
    }
  }
}