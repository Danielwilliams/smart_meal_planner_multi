import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  bool _isLoggedIn = false;
  String? _authToken;
  int? _userId;
  String? _userName;
  String? _userEmail;
  String? _accountType;
  bool _isOrganization = false;
  
  // For debugging - allow direct inspection of raw account info
  Map<String, dynamic> _lastAccountResponse = {};

  bool get isLoggedIn => _isLoggedIn;
  String? get authToken => _authToken;
  int? get userId => _userId;
  String? get userName => _userName;
  String? get userEmail => _userEmail;
  String? get accountType => _accountType;
  bool get isOrganization => _isOrganization;
  
  // For debugging - allow access to the last account info response
  Map<String, dynamic> get lastAccountResponse => _lastAccountResponse;
  
  // For debugging - provide methods to override account type
  void overrideAccountType(String type, bool isOrg) {
    _accountType = type;
    _isOrganization = isOrg;
    notifyListeners();
  }

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
      _accountType = prefs.getString('account_type');
      _isOrganization = prefs.getBool('is_organization') ?? false;
      _lastEmail = prefs.getString('last_email');
      _lastPassword = prefs.getString('last_password');
      
      // Check if token is expired
      if (_userId != null) {
        _isLoggedIn = true;
        
        // Refresh organization status on each start
        if (_authToken != null) {
          _checkOrganizationStatus();
        }
        
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
    
    if (_accountType != null) {
      prefs.setString('account_type', _accountType!);
    }
    
    // Save organization status
    prefs.setBool('is_organization', _isOrganization);
    
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
    prefs.remove('account_type');
    prefs.remove('is_organization');
    // Don't clear credentials to enable auto-login later
    // prefs.remove('last_email');  
    // prefs.remove('last_password');
    
    _isLoggedIn = false;
    _authToken = null;
    _userId = null;
    _userName = null;
    _userEmail = null;
    _accountType = null;
    _isOrganization = false;
    // Keep last credentials for potential re-login
    // _lastEmail = null;
    // _lastPassword = null;
  }
  
  // Check if user is an organization account
  Future<void> _checkOrganizationStatus() async {
    try {
      if (_authToken != null) {
        // CRITICAL: First check JWT token data directly
        try {
          Map<String, dynamic> tokenData = JwtDecoder.decode(_authToken!);
          print("\n🔑🔑🔑 JWT TOKEN DATA 🔑🔑🔑");
          tokenData.forEach((key, value) {
            print("JWT.$key: $value (${value?.runtimeType})");
          });
          
          // Store JWT data for debugging
          _lastAccountResponse = Map<String, dynamic>.from(tokenData);
          
          // If account_type is in JWT and it's 'organization', set that immediately
          if (tokenData.containsKey('account_type')) {
            final jwtAccountType = tokenData['account_type'].toString().toLowerCase();
            print("JWT has account_type: '$jwtAccountType'");
            
            if (jwtAccountType == 'organization') {
              print("⭐️ JWT INDICATES THIS IS AN ORGANIZATION ACCOUNT");
              _isOrganization = true;
              _accountType = 'organization';
              
              // Save immediately and return - we trust the JWT
              print("SETTING FROM JWT: IsOrganization=$_isOrganization, AccountType=$_accountType");
              notifyListeners();
              await _saveToPrefs();
              return; // Skip further API calls since we have definitive info
            }
          }
          
          // Also check for explicit role
          if (tokenData.containsKey('role')) {
            final jwtRole = tokenData['role'].toString().toLowerCase();
            print("JWT has role: '$jwtRole'");
            
            if (jwtRole == 'organization') {
              print("⭐️ JWT INDICATES THIS IS AN ORGANIZATION ACCOUNT (from role)");
              _isOrganization = true;
              _accountType = 'organization';
              
              // Save immediately and return - we trust the JWT
              print("SETTING FROM JWT: IsOrganization=$_isOrganization, AccountType=$_accountType");
              notifyListeners();
              await _saveToPrefs();
              return; // Skip further API calls since we have definitive info
            }
          }
          
          // If there's an organization_id in the JWT and no account_type='organization',
          // this is likely a client account
          if (tokenData.containsKey('organization_id') && tokenData['organization_id'] != null &&
              (!tokenData.containsKey('account_type') || 
               tokenData['account_type'].toString().toLowerCase() != 'organization')) {
            print("⚠️ JWT HAS organization_id BUT NOT account_type='organization' - This is likely a CLIENT account");
            _isOrganization = false;
            _accountType = 'client';
            
            // Don't return - continue with API checks to confirm
          }
        } catch (tokenError) {
          print("Error decoding token: $tokenError");
          // Continue with API checks if token decoding fails
        }
        
        // Get account info from API as a fallback
        final accountInfo = await ApiService.getUserAccountInfo(_authToken!);
        
        // Update stored account info for debugging
        _lastAccountResponse = Map<String, dynamic>.from(accountInfo);
        
        // Print the full account info for debugging
        print("ACCOUNT INFO FROM API: $accountInfo");
        
        // EXTREMELY IMPORTANT DEBUG OUTPUT
        print("== ACCOUNT TYPE DETECTION [ENHANCED LOGGING] ==");
        print("Raw JSON: $accountInfo");
        print("Keys available: ${accountInfo.keys.toList()}");
        print("is_organization: ${accountInfo['is_organization']}");
        print("account_type: ${accountInfo['account_type']}");
        print("accountType field: ${accountInfo['accountType']}");
        print("type: ${accountInfo['type']}");
        
        // Check if there's a nested user object
        if (accountInfo.containsKey('user')) {
          print("---- NESTED USER OBJECT ----");
          print("user keys: ${accountInfo['user'].keys.toList()}");
          print("user.is_organization: ${accountInfo['user']['is_organization']}");
          print("user.account_type: ${accountInfo['user']['account_type']}");
          print("user.accountType: ${accountInfo['user']['accountType']}");
          print("user.type: ${accountInfo['user']['type']}");
        }
        print("===============");
        
        // Try multiple possible field names for account type
        String possibleAccountType = '';
        
        // First check top-level keys
        if (accountInfo.containsKey('account_type')) {
          possibleAccountType = accountInfo['account_type'].toString();
          print("Found account_type at top level: $possibleAccountType");
        } else if (accountInfo.containsKey('accountType')) {
          possibleAccountType = accountInfo['accountType'].toString();
          print("Found accountType at top level: $possibleAccountType");
        } else if (accountInfo.containsKey('type')) {
          possibleAccountType = accountInfo['type'].toString();
          print("Found type at top level: $possibleAccountType");
        }
        
        // Then check user object if it exists
        if (possibleAccountType.isEmpty && accountInfo.containsKey('user')) {
          if (accountInfo['user'].containsKey('account_type')) {
            possibleAccountType = accountInfo['user']['account_type'].toString();
            print("Found account_type in user object: $possibleAccountType");
          } else if (accountInfo['user'].containsKey('accountType')) {
            possibleAccountType = accountInfo['user']['accountType'].toString();
            print("Found accountType in user object: $possibleAccountType");
          } else if (accountInfo['user'].containsKey('type')) {
            possibleAccountType = accountInfo['user']['type'].toString();
            print("Found type in user object: $possibleAccountType");
          }
        }
        
        // Specifically look for 'organization' in the account type
        bool isOrganization = possibleAccountType.isNotEmpty && possibleAccountType.toLowerCase() == 'organization';
        
        // Check for is_organization flag at both levels
        bool hasOrgFlag = accountInfo['is_organization'] == true;
        if (!hasOrgFlag && accountInfo.containsKey('user')) {
          hasOrgFlag = accountInfo['user']['is_organization'] == true;
        }
        
        // Combine checks
        isOrganization = isOrganization || hasOrgFlag;
        
        // CRITICAL: Check for organization_id which indicates a CLIENT account
        bool hasOrgId = false;
        if (accountInfo.containsKey('organization_id') && accountInfo['organization_id'] != null) {
          hasOrgId = true;
          print("⚠️ Found organization_id at top level: ${accountInfo['organization_id']} - This indicates a CLIENT account");
        }
        // Also check in user object
        if (!hasOrgId && accountInfo.containsKey('user') && 
            accountInfo['user'].containsKey('organization_id') && 
            accountInfo['user']['organization_id'] != null) {
          hasOrgId = true;
          print("⚠️ Found organization_id in user object: ${accountInfo['user']['organization_id']} - This indicates a CLIENT account");
        }
        
        // If the account has an organization_id, it is a CLIENT account (not an organization)
        if (hasOrgId) {
          isOrganization = false;
          possibleAccountType = 'client';
          print("🔍 This account has an organization_id, marking as CLIENT account");
        }
        
        // Check for jwt_data from API result
        if (accountInfo.containsKey('jwt_data') && accountInfo['jwt_data'] is Map) {
          final jwtData = accountInfo['jwt_data'] as Map;
          
          // If JWT data says account_type is organization, override other checks
          if (jwtData.containsKey('account_type') && 
              jwtData['account_type'].toString().toLowerCase() == 'organization') {
            print("⭐️ JWT DATA IN API RESPONSE INDICATES THIS IS AN ORGANIZATION ACCOUNT");
            isOrganization = true;
            possibleAccountType = 'organization';
          }
        }
        
        print("Account type detection results:");
        print("- possibleAccountType: '$possibleAccountType'");
        print("- hasOrgFlag: $hasOrgFlag");
        print("- hasOrgId (client indicator): $hasOrgId");
        print("- FINAL isOrganization: $isOrganization");
        
        // Update fields
        _isOrganization = isOrganization;
        _accountType = isOrganization ? 'organization' : possibleAccountType.toString();
        
        print("FINAL DETECTION RESULT: IsOrganization=$_isOrganization, AccountType=$_accountType");
        
        notifyListeners();
        
        // Save the updated status
        await _saveToPrefs();
      }
    } catch (e) {
      print("Error checking organization status: $e");
    }
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
          
          // CRITICAL DEBUGGING: Print the entire login result
          print("==== FULL LOGIN USER OBJECT ====");
          print("User object keys: ${result["user"].keys.join(', ')}");
            
          // Print all potential account type fields in user
          final userFields = ['account_type', 'accountType', 'type', 'role', 'userType'];
          for (String field in userFields) {
            if (result["user"].containsKey(field)) {
              print("User $field: ${result["user"][field]}");
            }
          }
          print("===============================");
          
          // Look for account type in various fields
          final userTypeFields = ['account_type', 'accountType', 'type', 'role', 'userType'];
          for (String field in userTypeFields) {
            if (result["user"].containsKey(field)) {
              _accountType = result["user"][field]?.toString();
              print("Found account type in user.$field: $_accountType");
              break;
            }
          }
          
          // CRITICAL: Detailed check for organization type
          print("🔍 Organization Detection: Checking account type '$_accountType'");
          _isOrganization = _accountType?.toLowerCase() == 'organization';
          
          // If we don't have an account type yet, check for it in various places
          if (_accountType == null || _accountType!.isEmpty) {
            // Try to get account type from user object
            if (result["user"].containsKey("type")) {
              _accountType = result["user"]["type"]?.toString();
              print("Found account type 'type' in user object: $_accountType");
              _isOrganization = _accountType?.toLowerCase() == 'organization';
            }
          }
          
          // Also check for explicit organization flag in user object
          if (result["user"].containsKey("is_organization")) {
            bool isOrgFlag = result["user"]["is_organization"] == true;
            print("Found is_organization flag in user object: $isOrgFlag");
            if (isOrgFlag) {
              _isOrganization = true;
              if (_accountType == null || _accountType!.isEmpty) {
                _accountType = 'organization';
              }
            }
          }
          
          // Final organization status after all checks
          print("🔔 RESULT OF ORGANIZATION CHECKS: isOrganization=$_isOrganization, accountType=$_accountType");
        } else {
          _userEmail = email;
        }
        
        // CRITICAL ORGANIZATION DETECTION DURING LOGIN
        print("\n🔥🔥🔥 CHECKING ORGANIZATION STATUS AT LOGIN TIME 🔥🔥🔥");
        print("LOGIN RESPONSE STRUCTURE: ${result.keys.toList()}");
        
        // DUMP THE ENTIRE LOGIN RESPONSE FOR DEBUGGING
        print("========= COMPLETE LOGIN RESPONSE DUMP =========");
        result.forEach((key, value) {
          print("$key: $value ${value?.runtimeType}");
        });
        print("==============================================");
        
        // If account_type is at the top level
        if (result["account_type"] != null) {
          _accountType = result["account_type"].toString();
          print("Found account_type at top level: '$_accountType'");
          
          // DIRECTLY CHECK against all possible organization-related strings
          final acctTypeLC = _accountType?.toLowerCase() ?? '';
          _isOrganization = acctTypeLC == 'organization' || 
                           acctTypeLC == 'org' || 
                           acctTypeLC.contains('organization');
          
          print("Account type check result: $_isOrganization");
        }
        
        // Additional check for organization flag at top level
        if (result.containsKey("is_organization")) {
          bool isOrgFlag = result["is_organization"] == true;
          print("Found is_organization flag at top level: $isOrgFlag");
          if (isOrgFlag) {
            _isOrganization = true;
            if (_accountType == null || _accountType!.isEmpty) {
              _accountType = 'organization';
            }
          }
        }
        
        // Check user field for organization indicators
        if (result.containsKey("user") && result["user"] is Map) {
          final user = result["user"] as Map;
          print("Checking user object for organization indicators: ${user.keys.toList()}");
          
          // Check account_type in user
          if (user.containsKey("account_type")) {
            String userAccountType = user["account_type"].toString();
            print("User account_type: '$userAccountType'");
            if (userAccountType.toLowerCase() == 'organization') {
              _isOrganization = true;
              _accountType = 'organization';
            }
          }
          
          // Check is_organization flag in user
          if (user.containsKey("is_organization")) {
            bool userIsOrg = user["is_organization"] == true;
            print("User is_organization flag: $userIsOrg");
            if (userIsOrg) {
              _isOrganization = true;
              _accountType = 'organization';
            }
          }
          
          // Check for organization_id in user - indicates a CLIENT account, not an organization account
          if (user.containsKey("organization_id") && user["organization_id"] != null) {
            print("User has organization_id: ${user["organization_id"]} - This indicates a CLIENT account (not an organization)");
            _isOrganization = false;
            _accountType = 'client';
          }
        }
        
        // Check for organization_id at top level - indicates a CLIENT account, not an organization
        if (result.containsKey("organization_id") && result["organization_id"] != null) {
          print("Found organization_id at top level: ${result["organization_id"]} - This indicates a CLIENT account");
          _isOrganization = false;
          _accountType = 'client';
        }

        // Extra check for any field containing "organization" as a value
        result.forEach((key, value) {
          if (value is String && value.isNotEmpty && value.toLowerCase() == 'organization') {
            print("Found 'organization' value in field '$key'");
            // Only set organization true if we haven't found an organization_id
            if (_accountType != 'client') {
              _isOrganization = true;
              if (_accountType == null) _accountType = 'organization';
            }
          }
        });
        
        // No longer forcing organization status
        // _isOrganization = true;
        // _accountType = 'organization';
        // print("⚠️ FORCING ORGANIZATION STATUS FOR TESTING ⚠️");
        print("🔍 Using actual account type detection");
        
        print("\n🔔 LOGIN ORGANIZATION DETECTION RESULT: 🔔");
        print("isOrganization: $_isOrganization");
        print("accountType: $_accountType");
        
        // Store credentials for auto-refresh (would be securely stored in production)
        _lastEmail = email;
        _lastPassword = password;
        
        _isLoggedIn = true;
        await _saveToPrefs();
        
        // After login, fetch and update complete user account info
        if (_userId != null && _authToken != null) {
          print("\n⚠️ RUNNING ADDITIONAL ORGANIZATION STATUS CHECK ⚠️");
          await _checkOrganizationStatus();
          print("✅ FINAL organization status after all checks: $_isOrganization (account type: $_accountType)");
        }
        
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