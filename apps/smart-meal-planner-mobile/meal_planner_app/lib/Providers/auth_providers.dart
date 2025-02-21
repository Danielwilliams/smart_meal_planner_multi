import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  String? _authToken;
  int? _userId;

  bool get isLoggedIn => _isLoggedIn;
  String? get authToken => _authToken;
  int? get userId => _userId;

  Future<bool> login(String email, String password) async {
    final result = await ApiService.login(email, password);
    if (result != null && result["access_token"] != null) {
      _authToken = result["access_token"];
      // (Optional) decode token to get userId if your backend includes it
      // or you may fetch userId from an additional /me endpoint.
      _userId = 999; // placeholder, you might parse from JWT or fetch from API
      _isLoggedIn = true;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> signUp(String name, String email, String password) async {
    final result = await ApiService.signUp(name, email, password);
    if (result != null && result["user_id"] != null) {
      // sign-up success, but user must still log in or auto-login
      // let's do auto-login for convenience:
      bool loggedIn = await login(email, password);
      return loggedIn;
    }
    return false;
  }

  void logout() {
    _isLoggedIn = false;
    _authToken = null;
    _userId = null;
    notifyListeners();
  }
}
