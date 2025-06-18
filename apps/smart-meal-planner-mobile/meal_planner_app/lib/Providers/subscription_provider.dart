import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/subscription_model.dart';
import '../services/api_service.dart';

class SubscriptionProvider extends ChangeNotifier {
  Subscription? _subscription;
  bool _isFreeAccessGranted = false;
  
  Subscription? get subscription => _subscription;
  bool get isFreeAccessGranted => _isFreeAccessGranted;
  bool get hasActiveSubscription => 
      _isFreeAccessGranted || (_subscription?.isActive ?? false);
  
  SubscriptionProvider() {
    _loadFromPrefs();
  }
  
  Future<void> _loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    _isFreeAccessGranted = prefs.getBool('freeAccessGranted') ?? false;
    notifyListeners();
  }
  
  Future<void> checkSubscription(String authToken) async {
    try {
      // First check if free access is already granted
      if (_isFreeAccessGranted) {
        _subscription = Subscription.free();
        notifyListeners();
        return;
      }

      // Call API to check subscription status
      final result = await ApiService.getUserSubscription(authToken);

      if (result != null) {
        // If SUBSCRIPTION_ENFORCE is false, always grant access
        if (result['enforce_subscription'] == false) {
          await _grantFreeAccess();
          _subscription = Subscription.free();
        } else {
          _subscription = Subscription.fromJson(result);
        }
      } else {
        // No result from API, set to inactive subscription
        _subscription = Subscription(
          hasSubscription: false,
          isActive: false,
          status: 'inactive'
        );
      }

      notifyListeners();
    } catch (e) {
      print("Error checking subscription: $e");
      // Set to inactive on errors
      _subscription = Subscription(
        hasSubscription: false,
        isActive: false,
        status: 'error',
      );
      notifyListeners();
    }
  }
  
  Future<void> _grantFreeAccess() async {
    _isFreeAccessGranted = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('freeAccessGranted', true);
  }
  
  Future<void> resetSubscriptionCheck() async {
    _subscription = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('freeAccessGranted');
    _isFreeAccessGranted = false;
    notifyListeners();
  }
}