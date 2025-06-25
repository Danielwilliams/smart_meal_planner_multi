import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/api_service.dart';
import 'dart:math';
import 'dart:async';
import 'package:flutter/services.dart';

class KrogerAuthScreen extends StatefulWidget {
  final String? authUrl;
  final String redirectUrl;
  final int userId;
  final String authToken;
  final bool isReconnect; // Flag to indicate if this is a reconnection

  KrogerAuthScreen({
    this.authUrl,
    this.redirectUrl = 'https://www.smartmealplannerio.com/kroger/callback',
    required this.userId,
    required this.authToken,
    this.isReconnect = false, // Default to false
  });

  @override
  _KrogerAuthScreenState createState() => _KrogerAuthScreenState();
}

class _KrogerAuthScreenState extends State<KrogerAuthScreen> {
  bool _isLoading = true;
  String _statusMessage = 'Loading authentication page...';
  WebViewController? _controller;
  bool _authInProgress = false;
  int _navigationAttempts = 0;
  DateTime? _lastNavigationTime;

  @override
  void initState() {
    super.initState();
    print('🚀 KrogerAuthScreen initState called');
    
    // Set up a listener for app state changes to detect when returning from browser
    WidgetsBinding.instance.addObserver(_AppLifecycleObserver(this));
    
    // First check if we already have valid Kroger auth
    _checkExistingKrogerAuth();
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(_AppLifecycleObserver(this));
    super.dispose();
  }
  
  void _handleAppResumed() async {
    print('🔄 App resumed - checking for deep link authentication');
    
    try {
      final prefs = await SharedPreferences.getInstance();
      final authInProgress = prefs.getBool('kroger_auth_in_progress') ?? false;
      
      print('Auth in progress: $authInProgress');
      
      if (authInProgress) {
        print('Kroger auth in progress - checking for completion');
        
        // First priority: Check if we have received an auth code from the deep link
        await _checkForDeepLinkAuthCode();
        
        // Fallback: Check if we now have valid tokens (from backend polling approach)
        final isAuthenticated = prefs.getBool('kroger_authenticated') ?? false;
        final accessToken = prefs.getString('kroger_access_token');
        
        print('Fallback check - isAuthenticated: $isAuthenticated, hasAccessToken: ${accessToken != null}');
        
        if (isAuthenticated && accessToken != null && accessToken.isNotEmpty &&
            !accessToken.contains('mobile_app_token')) {
          print('Found successful authentication after app resume');
          
          // Clear the in-progress flag
          await prefs.setBool('kroger_auth_in_progress', false);
          
          if (mounted) {
            setState(() {
              _isLoading = false;
              _statusMessage = 'Authentication successful!';
            });
            
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Kroger authentication successful!'),
                backgroundColor: Colors.green,
              ),
            );
            
            Navigator.pop(context, true);
          }
        }
      } else {
        print('No auth in progress, but checking for auth code anyway...');
        await _checkForDeepLinkAuthCode();
      }
    } catch (e) {
      print('Error handling app resume: $e');
    }
  }
  
  // Check for authorization code from deep link callback
  Future<void> _checkForDeepLinkAuthCode() async {
    try {
      print('🔍 Checking for deep link auth code...');
      
      // Check if an auth code was passed through the route arguments
      final context = this.context;
      final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
      final code = args?['code'];
      
      print('Route args: $args');
      print('Code from route args: $code');
      
      if (code != null && code.isNotEmpty) {
        print('🎉 Found auth code from route args: ${code.substring(0, 10)}...');
        
        // Process the authorization code
        setState(() {
          _authInProgress = true;
          _statusMessage = 'Processing authentication...';
        });
        
        await _completeAuthentication(code);
        return;
      }
      
      // Also check SharedPreferences in case the code was stored there
      final prefs = await SharedPreferences.getInstance();
      final storedCode = prefs.getString('kroger_auth_code');
      
      print('Stored code in SharedPreferences: ${storedCode?.substring(0, 10) ?? 'null'}...');
      
      if (storedCode != null && storedCode.isNotEmpty) {
        print('🎉 Found stored auth code: ${storedCode.substring(0, 10)}...');
        
        // Clear the stored code
        await prefs.remove('kroger_auth_code');
        
        // Process the authorization code
        setState(() {
          _authInProgress = true;
          _statusMessage = 'Processing authentication...';
        });
        
        await _completeAuthentication(storedCode);
        return;
      }
      
      print('❌ No auth code found in route args or SharedPreferences');
      
      // As a last resort, let's check if there's a way to get the launch URL
      // This would require adding package like 'receive_sharing_intent' or similar
      // For now, let's add a manual way to trigger auth code processing
      
    } catch (e) {
      print('Error checking for deep link auth code: $e');
    }
  }
  
  // Check for existing Kroger authentication
  Future<void> _checkExistingKrogerAuth() async {
    print('🔍 Checking for existing Kroger authentication');
    setState(() {
      _statusMessage = 'Checking for existing authentication...';
    });
    
    try {
      // Load credentials from multiple sources and verify auth
      
      // First check for user credentials in database
      print("Checking for Kroger credentials in database...");
      Map<String, dynamic>? userPreferences;
      
      try {
        userPreferences = await ApiService.getPreferences(widget.userId, widget.authToken);
        if (userPreferences != null) {
          final username = userPreferences['kroger_username'] as String?;
          final password = userPreferences['kroger_password'] as String?;
          
          if (username != null && username.isNotEmpty && password != null && password.isNotEmpty) {
            print("Found Kroger credentials in database. Username: $username");
            
            // Save credentials to local storage for future use
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('kroger_username', username);
            await prefs.setString('kroger_password', password);
            
            // We'll use these credentials later if authentication fails
          }
        }
      } catch (e) {
        print("Error fetching user preferences: $e");
      }
      
      // Check SharedPreferences for existing auth
      final prefs = await SharedPreferences.getInstance();
      final isAuthenticated = prefs.getBool('kroger_authenticated') ?? false;
      final accessToken = prefs.getString('kroger_access_token');
      
      if (isAuthenticated && accessToken != null && accessToken.isNotEmpty) {
        print("Found existing Kroger authentication, verifying...");
        
        // Try to verify the existing auth is still valid
        final result = await ApiService.verifyKrogerAuth(
          widget.userId,
          widget.authToken
        );
        
        if (result == true) {
          print("Existing Kroger authentication is valid");
          
          // Make sure we have a store selected
          await _selectDefaultStoreLocation();
          
          setState(() {
            _isLoading = false;
            _statusMessage = 'Already authenticated with Kroger!';
          });
          
          // Show success message and return to previous screen
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Already authenticated with Kroger!'),
              backgroundColor: Colors.green,
            ),
          );
          
          // Return with success after a short delay
          Future.delayed(Duration(seconds: 1), () {
            if (mounted) {
              Navigator.pop(context, true);
            }
          });
          return;
        } else {
          print("Existing Kroger authentication is invalid or expired");
        }
      }
      
      // Check if we have user credentials to try a direct auth approach
      final storedUsername = prefs.getString('kroger_username');
      final storedPassword = prefs.getString('kroger_password');
      
      if (userPreferences != null && (storedUsername != null && storedUsername.isNotEmpty && 
          storedPassword != null && storedPassword.isNotEmpty)) {
        print("Have stored credentials, could try direct auth approach in future version");
        // For now, we'll just proceed with the WebView auth flow
      }
      
      print("No valid existing authentication found, proceeding with new auth");
      // Proceed with in-app authentication using WebView
      _setupWebView();
      
    } catch (e) {
      print("Error checking existing authentication: $e");
      // Proceed with in-app authentication using WebView
      _setupWebView();
    }
  }
  
  // Monitor backend for authentication completion when using external browser
  void _monitorBackendForAuthCompletion() async {
    print('🔍 Starting backend polling for authentication completion');
    
    setState(() {
      _statusMessage = 'Complete authentication in your browser, then return to the app';
    });
    
    // Poll the backend every 3 seconds to check if auth completed
    for (int i = 0; i < 40; i++) { // Check for up to 2 minutes
      await Future.delayed(Duration(seconds: 3));
      
      if (!mounted) return;
      
      try {
        print('📡 Polling backend for auth status (attempt ${i + 1}/40)');
        
        // Check if Kroger auth is valid by verifying with backend
        final result = await ApiService.verifyKrogerAuth(
          widget.userId,
          widget.authToken
        );
        
        if (result == true) {
          print('✅ Backend confirms successful Kroger authentication');
          
          // Authentication successful on backend
          setState(() {
            _isLoading = false;
            _statusMessage = 'Authentication successful!';
          });
          
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Kroger authentication successful!'),
                backgroundColor: Colors.green,
              ),
            );
          }
          
          Navigator.pop(context, true);
          return;
        }
      } catch (e) {
        print('Error polling backend for auth completion: $e');
      }
      
      // Update status message to show progress
      if (mounted) {
        setState(() {
          _statusMessage = 'Waiting for authentication completion... (${i + 1}/40)';
        });
      }
    }
    
    // Timeout - authentication didn't complete
    if (mounted) {
      setState(() {
        _isLoading = false;
        _statusMessage = 'Authentication timed out. Please try again.';
      });
      
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Authentication timed out. Please make sure you completed the login in your browser.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 5),
          ),
        );
      }
    }
  }

  // Direct authentication method using external browser with deep linking
  void _directAuth() async {
    final clientId = "smartmealplannerio-243261243034247652497361364a447078555731455949714a464f61656e5a676b444e552e42796961517a4f4576367156464b3564774c3039777a614700745159802496692";
    
    // Use the registered mobile deep link redirect URI
    final redirectUri = "smartmealplanner://kroger-auth";
    
    // Match scope exactly from web app - order is important
    final scope = "product.compact cart.basic:write";
    final responseType = "code";
    final state = DateTime.now().millisecondsSinceEpoch.toString();
    
    // Build URL for external browser authentication
    final directUrl = "https://api.kroger.com/v1/connect/oauth2/authorize?scope=${Uri.encodeComponent(scope)}&response_type=$responseType&client_id=$clientId&redirect_uri=${Uri.encodeComponent(redirectUri)}&state=$state";
    
    print("Opening Kroger authentication in external browser: ${directUrl.substring(0, min(directUrl.length, 80))}...");
    print("Full URL: $directUrl");
    
    // Save that we're attempting authentication to SharedPreferences
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('kroger_auth_in_progress', true);
      await prefs.setString('kroger_auth_timestamp', DateTime.now().toIso8601String());
    } catch (e) {
      print("Error saving auth progress state: $e");
    }
    
    // Try to open in external browser directly
    await _launchExternalBrowser(directUrl);
    
    // Start monitoring for deep link callback
    _monitorForDeepLinkCallback();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // We'll set up WebView in _checkExistingKrogerAuth instead
    // to avoid duplicated setup
  }

  void _setupWebView() {
    print('🎯 Setting up external browser authentication (skipping WebView)');
    setState(() {
      _statusMessage = 'Opening authentication in your browser...';
      _isLoading = true;
    });

    // Skip WebView entirely and go straight to external browser
    _directAuth();
    return;
    
    // Use the exact same URL parameters as the web app
    final clientId = "smartmealplannerio-243261243034247652497361364a447078555731455949714a464f61656e5a676b444e552e42796961517a4f4576367156464b3564774c3039777a614700745159802496692";
    
    // Use the registered mobile deep link redirect URI
    final redirectUri = "smartmealplanner://kroger-auth";
    
    // Make sure we request the product and cart scopes
    final scope = "product.compact cart.basic:write";
    final responseType = "code";
    final state = DateTime.now().millisecondsSinceEpoch.toString();
    
    // Build URL in exact same format as web app - parameter order is critical
    final directUrl = "https://api.kroger.com/v1/connect/oauth2/authorize?scope=${Uri.encodeComponent(scope)}&response_type=$responseType&client_id=$clientId&redirect_uri=${Uri.encodeComponent(redirectUri)}&state=$state";
    
    print("Generated OAuth URL for WebView: ${directUrl.substring(0, min(directUrl.length, 100))}...");
    print("Full URL: $directUrl");
    
    // Save that we're attempting authentication to SharedPreferences
    try {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setBool('kroger_auth_in_progress', true);
        prefs.setString('kroger_auth_timestamp', DateTime.now().toIso8601String());
      });
    } catch (e) {
      print("Error saving auth progress state: $e");
    }
    
    _initializeWebView(directUrl);
  }
  
  void _initializeWebView(String url) {
    print('🔧 Initializing WebView with URL: ${url.substring(0, min(url.length, 100))}...');
    
    // Set a global timeout for the entire authentication process
    Timer(Duration(minutes: 5), () {
      if (mounted && !_authInProgress && _isLoading) {
        print('🕐 Authentication timeout reached');
        setState(() {
          _isLoading = false;
          _statusMessage = 'Authentication timed out. Please try the external browser option.';
        });
      }
    });
    
    try {
      _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _statusMessage = 'Loading: $progress%';
            });
          },
          onPageStarted: (String url) {
            print('🚀 Page started loading: $url');
            setState(() {
              _isLoading = true;
              _statusMessage = 'Loading...';
            });
            
            // Set a timeout for loading to prevent infinite spinner
            Future.delayed(Duration(seconds: 30), () {
              if (mounted && _isLoading) {
                print('⏰ Page loading timeout reached for: $url');
                setState(() {
                  _isLoading = false;
                  _statusMessage = 'Page loading timed out. Try refreshing or use the external browser option.';
                });
              }
            });
          },
          onPageFinished: (String url) {
            print('📄 Page finished loading: $url');
            setState(() {
              _isLoading = false;
              _statusMessage = 'Please complete the authentication process.';
            });
            
            // Check if this page contains auth results
            if (_authInProgress) {
              print('Auth already in progress, skipping page finished check');
              return;
            }
            
            // Check for auth completion in finished URLs (especially for fragment-based codes)
            if (url.contains('smartmealplannerio.com/kroger/callback') && 
                url.contains('code=')) {
              print('🔍 Checking finished page for auth code: $url');
              _extractCodeFromUrl(url);
            }
            // Also check for direct Kroger signin-redirect URLs
            else if (url.contains('api.kroger.com/v1/connect/auth/signin-redirect') && 
                     url.contains('code=')) {
              print('🔍 Checking Kroger signin-redirect page for auth code: $url');
              _extractCodeFromUrl(url);
            }
          },
          onNavigationRequest: (NavigationRequest request) {
            print('🔄 Navigation requested to: ${request.url}');
            
            // Circuit breaker: prevent too many rapid navigations
            final now = DateTime.now();
            if (_lastNavigationTime != null && 
                now.difference(_lastNavigationTime!).inSeconds < 2) {
              _navigationAttempts++;
              if (_navigationAttempts > 10) {
                print('🛑 Too many rapid navigation attempts, preventing infinite loop');
                setState(() {
                  _statusMessage = 'Navigation loop detected. Please try the external browser option.';
                  _isLoading = false;
                });
                return NavigationDecision.prevent;
              }
            } else {
              _navigationAttempts = 0;
            }
            _lastNavigationTime = now;
            
            // Log detailed URL analysis
            if (request.url.contains('code=')) {
              print('📋 URL contains code parameter');
            }
            if (request.url.contains('kroger')) {
              print('📋 URL contains kroger');
            }
            if (request.url.contains('callback')) {
              print('📋 URL contains callback');
            }
            if (request.url.contains('smartmealplannerio.com')) {
              print('📋 URL contains smartmealplannerio.com');
            }
            
            // Prevent multiple authentication attempts
            if (_authInProgress) {
              print('Authentication already in progress, preventing navigation to: ${request.url}');
              return NavigationDecision.prevent;
            }
            
            // Check for custom scheme URLs (all variants)
            if (request.url.startsWith('smartmealplanner://') || 
                request.url.startsWith('smartmealplannerIO://') || 
                request.url.startsWith('smartmealplannerio://')) {
              print('Custom scheme detected - handling URL: ${request.url}');
              _handleCustomSchemeUrl(request.url);
              return NavigationDecision.prevent;
            }
            
            // Check for callback URLs with authorization codes - be more specific about what constitutes a callback
            if (request.url.contains('smartmealplannerio.com/kroger/callback') && 
                request.url.contains('code=')) {
              print('✅ Callback URL with code detected: ${request.url}');
              _extractCodeFromUrl(request.url);
              return NavigationDecision.prevent;
            }
            
            // Also check for direct Kroger signin-redirect URLs with codes
            if (request.url.contains('api.kroger.com/v1/connect/auth/signin-redirect') && 
                request.url.contains('code=')) {
              print('✅ Kroger signin-redirect URL with code detected: ${request.url}');
              _extractCodeFromUrl(request.url);
              return NavigationDecision.prevent;
            }
            
            // Check for any other callback patterns but be more restrictive
            if ((request.url.contains('kroger') && request.url.contains('callback')) && 
                request.url.contains('code=')) {
              print('✅ Generic Kroger callback URL with code detected: ${request.url}');
              _extractCodeFromUrl(request.url);
              return NavigationDecision.prevent;
            }
            
            // Allow normal navigation for auth pages
            return NavigationDecision.navigate;
          },
          onWebResourceError: (WebResourceError error) {
            print('Web resource error: ${error.description}');
            setState(() {
              _statusMessage = 'Error: ${error.description}';
            });
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
      
      print('✅ WebView controller initialized and request loaded');
    } catch (e) {
      print('❌ Error initializing WebView: $e');
      setState(() {
        _isLoading = false;
        _statusMessage = 'Failed to initialize authentication. Please try the external browser option.';
      });
    }
  }

  void _extractCodeFromUrl(String url) {
    if (_authInProgress) {
      print('🚫 Auth already in progress, skipping code extraction');
      return;
    }
    
    try {
      print('🔎 Attempting to extract code from URL: ${url.substring(0, min(url.length, 100))}...');
      
      Uri uri = Uri.parse(url);
      String? code;
      String? state;
      
      // Check for code in query parameters first
      code = uri.queryParameters['code'];
      state = uri.queryParameters['state'];
      print('🔍 Query parameters check: ${code != null ? "FOUND" : "NOT FOUND"}');
      if (state != null) {
        print('🔍 State parameter: ${state.substring(0, min(state.length, 10))}...');
      }
      
      // If no code in query params, check fragment (after #) - Kroger often uses fragments
      if (code == null && uri.fragment.isNotEmpty) {
        print('🔍 Checking fragment: ${uri.fragment}');
        final fragmentParams = Uri.splitQueryString(uri.fragment);
        code = fragmentParams['code'];
        state = fragmentParams['state'] ?? state;
        print('🔍 Fragment parameters check: ${code != null ? "FOUND" : "NOT FOUND"}');
      }
      
      // Additional check - sometimes the code is in a different format
      if (code == null) {
        // Check if the URL itself contains code= pattern
        final codeMatch = RegExp(r'code=([^&\s#]+)').firstMatch(url);
        if (codeMatch != null) {
          code = Uri.decodeComponent(codeMatch.group(1) ?? '');
          print('🔍 Regex pattern check: FOUND');
        } else {
          print('🔍 Regex pattern check: NOT FOUND');
        }
      }
      
      // Validate the code looks legitimate (not empty, reasonable length)
      if (code != null && code.isNotEmpty && code.length > 10) {
        print('✅ Successfully extracted auth code: ${code.substring(0, min(code.length, 10))}...');
        
        // Set auth in progress immediately to prevent duplicate attempts
        _authInProgress = true;
        _completeAuthentication(code);
      } else {
        print('❌ No valid authorization code found in URL');
        print('   Full URL: $url');
        print('   Query params: ${uri.queryParameters}');
        print('   Fragment: ${uri.fragment}');
        
        // If this looks like it should have had a code but didn't, show an error
        if (url.contains('callback') || url.contains('signin-redirect')) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Authentication callback received but no authorization code found'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }
    } catch (e) {
      print('❌ Error extracting code from URL: $e');
    }
  }

  Future<void> _completeAuthentication(String code) async {
    if (_authInProgress) {
      print('Authentication already in progress, ignoring duplicate attempt');
      return;
    }
    
    print('🔐 Starting authentication completion process...');
    _authInProgress = true;
    setState(() {
      _isLoading = true;
      _statusMessage = 'Completing authentication...';
    });
    
    try {
      print('Completing authentication with code: ${code.substring(0, min(code.length, 10))}...');
      
      // Match web app's exact 3-step authentication process
      bool success = false;
      Map<String, dynamic> result = {};
      
      // Step 1: Try POST /kroger/process-code (web app's primary method)
      try {
        print('Step 1: Trying POST /kroger/process-code');
        
        final url = Uri.parse("${ApiService.baseUrl}/kroger/process-code");
        final response = await http.post(
          url,
          headers: {"Content-Type": "application/json"},
          body: jsonEncode({
            "code": code,
            "redirect_uri": "smartmealplanner://kroger-auth"
          }),
        );
        
        print('POST process-code response status: ${response.statusCode}');
        print('POST process-code response body: ${response.body}');
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          try {
            final apiResult = jsonDecode(response.body);
            if (apiResult != null && apiResult.containsKey('access_token')) {
              print('POST process-code succeeded!');
              result = apiResult;
              success = true;
            }
          } catch (parseError) {
            print('Error parsing POST process-code response: $parseError');
          }
        }
      } catch (error) {
        print('Error with POST process-code approach: $error');
      }
      
      // Step 2: Try GET /kroger/process-code (web app's fallback)
      if (!success) {
        try {
          print('Step 2: Trying GET /kroger/process-code');
          
          final queryParams = {
            'code': code,
            'redirect_uri': 'smartmealplanner://kroger-auth'
          };
          final uri = Uri.parse("${ApiService.baseUrl}/kroger/process-code")
              .replace(queryParameters: queryParams);
          
          final response = await http.get(uri);
          
          print('GET process-code response status: ${response.statusCode}');
          print('GET process-code response body: ${response.body}');
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              final apiResult = jsonDecode(response.body);
              if (apiResult != null && apiResult.containsKey('access_token')) {
                print('GET process-code succeeded!');
                result = apiResult;
                success = true;
              }
            } catch (parseError) {
              print('Error parsing GET process-code response: $parseError');
            }
          }
        } catch (error) {
          print('Error with GET process-code approach: $error');
        }
      }
      
      // Step 3: Try POST /kroger/auth-callback with form data (web app's last fallback)
      if (!success) {
        try {
          print('Step 3: Trying POST /kroger/auth-callback with form data');
          
          final url = Uri.parse("${ApiService.baseUrl}/kroger/auth-callback");
          final formData = {
            'code': code,
            'redirect_uri': 'smartmealplanner://kroger-auth',
            'grant_type': 'authorization_code'
          };
          
          final response = await http.post(
            url,
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: formData.entries
                .map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
                .join('&'),
          );
          
          print('POST auth-callback response status: ${response.statusCode}');
          print('POST auth-callback response body: ${response.body}');
          
          if (response.statusCode >= 200 && response.statusCode < 300) {
            try {
              final apiResult = jsonDecode(response.body);
              if (apiResult != null && apiResult.containsKey('access_token')) {
                print('POST auth-callback succeeded!');
                result = apiResult;
                success = true;
              }
            } catch (parseError) {
              print('Error parsing POST auth-callback response: $parseError');
            }
          }
        } catch (error) {
          print('Error with POST auth-callback approach: $error');
        }
      }
      
      
      // Final fallback: API Service approach
      if (!success) {
        try {
          print('Final fallback: Using ApiService.completeKrogerAuth');
          final apiResult = await ApiService.completeKrogerAuth(
            widget.userId,
            widget.authToken,
            code,
            "https://www.smartmealplannerio.com/kroger/callback",
          );
          
          if (apiResult != null && apiResult.containsKey('access_token')) {
            print('API Service approach succeeded!');
            result = apiResult;
            success = true;
          }
        } catch (apiError) {
          print('API Service approach failed: $apiError');
        }
      }
      
      // At this point, determine if we have real tokens or need to generate dummy ones
      String accessToken;
      String refreshToken;
      
      if (success && result.containsKey('access_token')) {
        // Use the real tokens from the successful API call
        accessToken = result['access_token'].toString();
        refreshToken = result.containsKey('refresh_token') 
            ? result['refresh_token'].toString() 
            : "refresh_${DateTime.now().millisecondsSinceEpoch}";
            
        print('Using real tokens - access: ${accessToken.substring(0, min(accessToken.length, 10))}...');
      } else {
        // Authentication failed - don't create dummy tokens, return error
        print('❌ All authentication approaches failed');
        
        setState(() {
          _isLoading = false;
        });
        
        _authInProgress = false; // Reset flag on failure
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Authentication failed. Please try again."),
            backgroundColor: Colors.red,
          )
        );
        
        // Return early without saving invalid tokens
        return;
      }
      
      // Save to SharedPreferences first (most critical step)
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('kroger_access_token', accessToken);
      await prefs.setString('kroger_refresh_token', refreshToken);
      await prefs.setBool('kroger_authenticated', true);
      await prefs.setBool('kroger_connected', true);
      await prefs.setString('kroger_auth_code', code);
      await prefs.setString('kroger_auth_timestamp', DateTime.now().toIso8601String());
      
      print('Successfully saved tokens to SharedPreferences');
      
      // Set default store location
      await _selectDefaultStoreLocation();
      
      // Use the enhanced token update method to save tokens to the database in multiple ways
      print('Updating Kroger tokens in database...');
      final tokenUpdateSuccess = await ApiService.updateKrogerTokens(
        userId: widget.userId,
        authToken: widget.authToken,
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      
      print('Token update success: $tokenUpdateSuccess');
      
      // Also directly update preferences with additional auth flags as a backup
      try {
        final preferences = {
          'kroger_authenticated': true,
          'kroger_auth_code': code,
          'kroger_auth_completed': true,
          'kroger_has_cart_scope': true,
          'kroger_auth_timestamp': DateTime.now().toIso8601String(),
          'kroger_connected': true,
          'kroger_store_selected': true,
          'kroger_store_location_id': '02100328',
          'kroger_location_id': '02100328',
          'kroger_store_location': '02100328'
        };
        
        await ApiService.updatePreferences(
          userId: widget.userId,
          authToken: widget.authToken,
          preferences: preferences,
        );
        
        print('Successfully updated additional preferences');
      } catch (prefError) {
        print('Error updating additional preferences: $prefError');
      }
      
      setState(() {
        _isLoading = false;
        _statusMessage = 'Authentication successful!';
      });
      
      // Show success message and return to previous screen
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Kroger authentication successful!'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 3),
        ),
      );
      
      // Return with success
      Navigator.pop(context, true);
    } catch (e) {
      print('❌ Error completing authentication: $e');
      print('Error type: ${e.runtimeType}');
      print('Stack trace: ${StackTrace.current}');
      
      _authInProgress = false; // Reset flag on error
      
      // Authentication failed completely - show error with details
      setState(() {
        _isLoading = false;
        _statusMessage = '';
      });
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Authentication failed: ${e.toString()}"),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 5),
        )
      );
      
      // Return with failure
      Navigator.pop(context, false);
    }
  }
  
  // Select a default store location for testing purposes
  Future<void> _selectDefaultStoreLocation() async {
    try {
      // Default store location for testing - a real Kroger store ID
      const defaultStoreId = '02100328';
      print("Setting default store location: $defaultStoreId");
      
      // Save to local storage first
      try {
        final prefs = await SharedPreferences.getInstance();
        prefs.setString('kroger_location_id', defaultStoreId);
        prefs.setString('kroger_store_location', defaultStoreId);
        prefs.setBool('kroger_store_selected', true);
        print("Saved store ID to local storage");
      } catch (localError) {
        print("Error saving to local storage: $localError");
      }
      
      // Update database in a simpler way
      try {
        final preferences = {
          'kroger_location_id': defaultStoreId,
          'kroger_store_location': defaultStoreId,
          'kroger_store_selected': true
        };
        
        await ApiService.updatePreferences(
          userId: widget.userId,
          authToken: widget.authToken,
          preferences: preferences,
        );
        print("Updated store in database");
      } catch (e) {
        print("Error updating store in database: $e");
      }
    } catch (e) {
      print("Error selecting default store location: $e");
    }
  }
  
  // Save authentication state and tokens to local storage
  Future<void> _saveAuthStateToLocalStorage(String code, Map<String, dynamic>? result) async {
    try {
      print("Saving Kroger auth state to local storage");
      final prefs = await SharedPreferences.getInstance();
      
      // Save essential auth flags
      prefs.setBool('kroger_authenticated', true);
      prefs.setBool('kroger_connected', true);
      prefs.setString('kroger_auth_code', code);
      
      // Only proceed if we have real tokens from the result
      if (result == null || !result.containsKey('access_token')) {
        print("❌ No real tokens available, cannot save authentication state");
        return;
      }
      
      String accessToken = result['access_token'].toString();
      String refreshToken = result.containsKey('refresh_token') 
          ? result['refresh_token'].toString()
          : "refresh_${DateTime.now().millisecondsSinceEpoch}";
      
      print("Using real Kroger access token from result");
      
      // Save tokens
      prefs.setString('kroger_access_token', accessToken);
      prefs.setString('kroger_refresh_token', refreshToken);
      
      // Mark store selection as needed or complete
      prefs.setBool('kroger_store_selected', true);
      prefs.setBool('kroger_needs_store_selection', false);
      prefs.setBool('kroger_auth_in_progress', false);
      
      print("Successfully saved Kroger auth state to local storage");
    } catch (e) {
      print("Error saving Kroger auth state to local storage: $e");
    }
  }

  // Launch URL in external browser
  Future<void> _launchExternalBrowser(String url) async {
    try {
      print('Attempting to launch URL in external browser: ${url.substring(0, min(url.length, 100))}...');
      
      // Clean and encode the URL properly
      String cleanUrl = url.trim();
      if (cleanUrl.contains(' ') || !cleanUrl.startsWith('http')) {
        print('URL needs cleaning or encoding');
        cleanUrl = cleanUrl.replaceAll(' ', '%20');
        if (!cleanUrl.startsWith('http')) {
          cleanUrl = 'https://' + cleanUrl;
        }
      }
      
      // Fallback option: try both standard and external launch modes
      final Uri uri = Uri.parse(cleanUrl);
      
      // First try external application mode
      print('Trying to launch URL in external application mode');
      bool launched = false;
      
      try {
        launched = await launchUrl(
          uri, 
          mode: LaunchMode.externalApplication,
        );
        print('External launch result: $launched');
      } catch (e) {
        print('Error launching in external mode: $e');
      }
      
      // If external mode fails, try platform default mode
      if (!launched) {
        print('External launch failed, trying platform default mode');
        try {
          launched = await launchUrl(
            uri,
            mode: LaunchMode.platformDefault,
          );
          print('Platform default launch result: $launched');
        } catch (e) {
          print('Error launching in platform default mode: $e');
        }
      }
      
      // If platform default fails, try in-app webview mode
      if (!launched) {
        print('Platform default launch failed, trying in-app webview mode');
        try {
          launched = await launchUrl(
            uri,
            mode: LaunchMode.inAppWebView,
          );
          print('In-app webview launch result: $launched');
        } catch (e) {
          print('Error launching in in-app webview mode: $e');
        }
      }
      
      if (launched) {
        print('Successfully launched URL');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Launched Kroger authentication in browser'),
            duration: Duration(seconds: 5),
          ),
        );
      } else {
        // Final fallback: display URL and ask user to copy it
        print('All launch attempts failed, displaying URL to user');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Could not launch browser. Please copy and paste this URL:'),
                SizedBox(height: 8),
                Text(
                  cleanUrl,
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ],
            ),
            duration: Duration(seconds: 30),
            action: SnackBarAction(
              label: 'Dismiss',
              onPressed: () {
                ScaffoldMessenger.of(context).hideCurrentSnackBar();
              },
            ),
          ),
        );
      }
    } catch (e) {
      print('Unhandled error launching URL: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _resetAndRetry() {
    print('🔄 Resetting authentication state and retrying');
    setState(() {
      _authInProgress = false;
      _navigationAttempts = 0;
      _lastNavigationTime = null;
      _isLoading = true;
      _statusMessage = 'Resetting authentication...';
    });
    
    // Clear any stored auth flags
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('kroger_auth_in_progress', false);
    });
    
    // Restart the WebView setup process
    _setupWebView();
  }

  void _handleCustomSchemeUrl(String url) {
    print('🔗 Handling custom scheme URL: $url');
    
    if (_authInProgress) {
      print('Authentication already in progress, ignoring custom scheme URL');
      return;
    }
    
    try {
      Uri uri = Uri.parse(url);
      String? code;
      
      // Check for code in query parameters first
      code = uri.queryParameters['code'];
      
      // If no code in query params, check for code in fragment (after #)
      if (code == null && uri.fragment.isNotEmpty) {
        final fragmentParams = Uri.splitQueryString(uri.fragment);
        code = fragmentParams['code'];
      }
      
      if (code != null) {
        print('🎉 Found authorization code in custom scheme URL: ${code.substring(0, min(code.length, 10))}...');
        
        // Store the code in SharedPreferences for app resume detection
        SharedPreferences.getInstance().then((prefs) {
          prefs.setString('kroger_auth_code', code!);
          print('Stored auth code in SharedPreferences');
        });
        
        // Process the code immediately
        _completeAuthentication(code);
      } else {
        print('❌ No authorization code found in custom scheme URL');
        print('Query parameters: ${uri.queryParameters}');
        print('Fragment: ${uri.fragment}');
        if (uri.fragment.isNotEmpty) {
          print('Fragment parameters: ${Uri.splitQueryString(uri.fragment)}');
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("No authorization code received from Kroger"),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      print('Error parsing custom scheme URL: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error processing Kroger callback: $e"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
  
  // Manual auth code processing for testing
  void _manuallyProcessAuthCode(String authCode) async {
    if (authCode.isNotEmpty) {
      print('🔧 Manually processing auth code: ${authCode.substring(0, 10)}...');
      
      setState(() {
        _authInProgress = true;
        _statusMessage = 'Processing authentication...';
      });
      
      await _completeAuthentication(authCode);
    }
  }
  
  // Show dialog for manual auth code input
  void _showManualAuthCodeDialog() {
    final controller = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Manual Auth Code'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Paste the authorization code from the deep link URL:'),
            SizedBox(height: 16),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'e.g., i30ZlgktrFaNRdvVXZiyiNs2nHwPmPHea8eu-EwE',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            SizedBox(height: 8),
            Text(
              'Extract the "code" parameter from the deep link URL you saw in the browser.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _manuallyProcessAuthCode(controller.text.trim());
            },
            child: Text('Process'),
          ),
        ],
      ),
    );
  }

  // Monitor for deep link callback instead of backend polling
  void _monitorForDeepLinkCallback() {
    print('🔗 Starting deep link monitoring for Kroger auth callback');
    
    setState(() {
      _statusMessage = 'Waiting for authentication completion...';
    });
    
    // Set up periodic checking for deep link handling
    // Since we don't have uni_links, we'll monitor for when the app resumes
    // and check if authentication completed via the existing _handleAppResumed method
    
    // Set a timeout for the entire authentication process
    Timer(Duration(minutes: 10), () {
      if (mounted && _isLoading && !_authInProgress) {
        print('🕐 Deep link monitoring timeout reached');
        setState(() {
          _isLoading = false;
          _statusMessage = 'Authentication timed out. Please try again.';
        });
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Authentication timed out. Please try again.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    });
    
    // Note: The actual deep link handling happens in main.dart route handling
    // and _handleAppResumed when the app comes back to foreground
    print('Deep link monitoring setup complete - waiting for callback');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isReconnect ? 'Reconnect Kroger Account' : 'Kroger Authentication'),
        leading: IconButton(
          icon: Icon(Icons.close),
          onPressed: () => Navigator.pop(context, false),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.open_in_browser),
            tooltip: 'Open in external browser',
            onPressed: () => _directAuth(),
          ),
        ],
      ),
      body: Container(
        color: Colors.black54,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
                SizedBox(height: 24),
                Text(
                  _statusMessage,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: 32),
                if (_statusMessage.contains('browser'))
                  Column(
                    children: [
                      Icon(
                        Icons.open_in_browser,
                        color: Colors.white,
                        size: 48,
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Complete the authentication in your browser, then return to this app.',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    ElevatedButton(
                      onPressed: () => _directAuth(),
                      child: Text('Retry Browser'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: Text('Cancel'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 16),
                // Debug button for manual auth code processing
                ElevatedButton(
                  onPressed: () => _showManualAuthCodeDialog(),
                  child: Text('Manual Auth Code'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AppLifecycleObserver extends WidgetsBindingObserver {
  final _KrogerAuthScreenState _authScreen;
  
  _AppLifecycleObserver(this._authScreen);
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _authScreen._handleAppResumed();
    }
  }
}