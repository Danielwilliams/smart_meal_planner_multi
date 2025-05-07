import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import 'dart:math';

class KrogerAuthScreen extends StatefulWidget {
  final String? authUrl;
  final String redirectUrl;
  final int userId;
  final String authToken;

  KrogerAuthScreen({
    this.authUrl,
    this.redirectUrl = 'smartmealplanner://kroger-auth-callback',
    required this.userId,
    required this.authToken,
  });

  @override
  _KrogerAuthScreenState createState() => _KrogerAuthScreenState();
}

class _KrogerAuthScreenState extends State<KrogerAuthScreen> {
  bool _isLoading = true;
  String _statusMessage = 'Loading authentication page...';
  WebViewController? _controller;

  @override
  void initState() {
    super.initState();
    // We'll setup WebView in didChangeDependencies
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller == null) {
      _setupWebView();
    }
  }

  void _setupWebView() {
    // If auth URL is null or empty, get one from the API
    if (widget.authUrl == null || widget.authUrl!.isEmpty) {
      setState(() {
        _statusMessage = 'Getting authentication URL...';
      });
      
      print("No auth URL provided, requesting one from API");
      
      // Get auth URL asynchronously
      ApiService.getKrogerAuthUrl(widget.userId, widget.authToken).then((url) {
        if (!mounted) return;
        
        print("Received auth URL from API: ${url?.substring(0, min(url?.length ?? 0, 50)) ?? 'null'}...");
        
        if (url != null && url.isNotEmpty) {
          // Use a hardcoded URL for testing if the API one doesn't work
          String finalUrl = url;
          
          // For testing only - backup URL if the API one doesn't work
          if (!url.contains("kroger.com") && !url.contains("oauth")) {
            print("URL doesn't appear to be a valid OAuth URL, using backup");
            finalUrl = "https://api.kroger.com/v1/connect/oauth2/authorize?scope=cart.basic:write&client_id=smartmealplannermobile-f8d6a2f8dd0b425e73f40cda1f356837&response_type=code&redirect_uri=smartmealplanner://kroger-auth-callback";
          }
          
          print("Initializing WebView with URL: ${finalUrl.substring(0, min(finalUrl.length, 50))}...");
          _initializeWebView(finalUrl);
        } else {
          print("Failed to get auth URL from API");
          setState(() {
            _isLoading = false;
            _statusMessage = 'Failed to get authentication URL';
          });
          
          // Show error and return to previous screen after a delay
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Failed to get Kroger authentication URL'),
                backgroundColor: Colors.red,
              ),
            );
            
            Future.delayed(Duration(seconds: 2), () {
              if (mounted) {
                Navigator.pop(context, false);
              }
            });
          }
        }
      });
    } else {
      print("Using provided auth URL: ${widget.authUrl!.substring(0, min(widget.authUrl!.length, 50))}...");
      _initializeWebView(widget.authUrl!);
    }
  }
  
  void _initializeWebView(String url) {
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
            setState(() {
              _isLoading = true;
              _statusMessage = 'Loading...';
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
          },
          onNavigationRequest: (NavigationRequest request) {
            print('Navigating to: ${request.url}');
            
            // Check if we've reached the redirect URL
            if (request.url.startsWith(widget.redirectUrl) || 
                request.url.contains('kroger-auth-callback') ||
                request.url.contains('auth-callback')) {
              print('Reached redirect URL: ${request.url}');
              
              // Extract authentication code from URL
              Uri uri = Uri.parse(request.url);
              String? code = uri.queryParameters['code'];
              
              if (code != null) {
                print('Found code: $code');
                _completeAuthentication(code);
                return NavigationDecision.prevent;
              }
            }
            
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
  }

  Future<void> _completeAuthentication(String code) async {
    setState(() {
      _isLoading = true;
      _statusMessage = 'Completing authentication...';
    });
    
    try {
      // Call API to complete authentication
      final result = await ApiService.completeKrogerAuth(
        widget.userId,
        widget.authToken,
        code,
      );
      
      setState(() {
        _isLoading = false;
        _statusMessage = 'Authentication successful!';
      });
      
      // Show success message and return to previous screen
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Kroger authentication successful!'),
          backgroundColor: Colors.green,
        ),
      );
      
      // Return with success
      Navigator.pop(context, true);
    } catch (e) {
      print('Error completing authentication: $e');
      
      setState(() {
        _isLoading = false;
        _statusMessage = 'Authentication failed: $e';
      });
      
      // Show error and return to previous screen
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Authentication failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
      
      // Return with failure
      Navigator.pop(context, false);
    }
  }

  // Launch URL in external browser
  Future<void> _launchExternalBrowser(String url) async {
    try {
      final Uri uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Launched Kroger authentication in external browser'),
            duration: Duration(seconds: 5),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not launch browser'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      print('Error launching URL: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Kroger Authentication'),
        leading: IconButton(
          icon: Icon(Icons.close),
          onPressed: () => Navigator.pop(context, false),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.open_in_browser),
            tooltip: 'Open in Browser',
            onPressed: () {
              if (widget.authUrl != null && widget.authUrl!.isNotEmpty) {
                _launchExternalBrowser(widget.authUrl!);
              } else {
                // Get URL first
                ApiService.getKrogerAuthUrl(widget.userId, widget.authToken).then((url) {
                  if (url != null && url.isNotEmpty) {
                    _launchExternalBrowser(url);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Could not get authentication URL'),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                });
              }
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          if (_controller != null) WebViewWidget(controller: _controller!),
          if (_isLoading)
            Container(
              color: Colors.black54,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text(
                      _statusMessage,
                      style: TextStyle(color: Colors.white),
                    ),
                    SizedBox(height: 24),
                    ElevatedButton.icon(
                      icon: Icon(Icons.open_in_browser),
                      label: Text('Open in Browser'),
                      onPressed: () {
                        // Use the URL we're trying to load or get one
                        if (widget.authUrl != null && widget.authUrl!.isNotEmpty) {
                          _launchExternalBrowser(widget.authUrl!);
                        } else {
                          ApiService.getKrogerAuthUrl(widget.userId, widget.authToken).then((url) {
                            if (url != null && url.isNotEmpty) {
                              _launchExternalBrowser(url);
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Could not get authentication URL'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}