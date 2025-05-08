import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'Screens/login_screen.dart';
import 'Screens/signup_screen.dart';
import 'Screens/menu_screen.dart';
import 'Screens/cart_screen.dart';
import 'Screens/forgot_password_screen.dart';
import 'Screens/reset_password_screen.dart';
import 'Screens/location_screen.dart';
import 'Screens/preferences_screen.dart';
import 'Screens/profile_screen.dart';
import 'Screens/compare_screen.dart';
import 'Screens/store_selection_screen.dart';
import 'Screens/order_screen.dart';
import 'Screens/order_history_screen.dart';
import 'Screens/recipe_browser_screen.dart';
import 'Screens/saved_recipes_screen.dart';
import 'Screens/custom_menu_screen.dart';
import 'Screens/organization_screen.dart';
import 'Screens/menu_history_screen.dart';
import 'Screens/shopping_list_screen.dart';
import 'Screens/carts_screen.dart';
import 'Screens/kroger_auth_screen.dart';
import 'Screens/client_recipes_screen.dart';
import 'Screens/client_menus_screen.dart';
import 'Screens/client_preferences_screen.dart';
import 'Screens/create_client_menu_screen.dart';
import 'Providers/auth_providers.dart';
import 'common/custom_theme.dart';
import 'services/theme_service.dart';
import 'services/api_service.dart';
import 'models/cart_model.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MealPlannerApp());
}

// Global state for cart data to persist across navigations
class CartState extends ChangeNotifier {
  // Store carts
  Map<String, List<dynamic>> storeCarts = {
    'Walmart': [],
    'Kroger': [],
  };
  
  // Track totals for each store
  Map<String, double> storeTotals = {
    'Walmart': 0.0,
    'Kroger': 0.0,
  };
  
  // Add a single item to cart
  void addItemToCart(String store, Map<String, dynamic> item) {
    print("CART STATE: Adding item to $store cart: ${item['name']}");
    storeCarts[store]!.add(item);
    recalculateTotal(store);
    notifyListeners();
  }
  
  // Add multiple items to cart
  void addItemsToCart(String store, List<Map<String, dynamic>> items) {
    print("CART STATE: Adding ${items.length} items to $store cart");
    for (var item in items) {
      storeCarts[store]!.add(item);
    }
    recalculateTotal(store);
    notifyListeners();
  }
  
  // Remove an item from cart
  void removeItemFromCart(String store, dynamic item) {
    print("CART STATE: Removing item from $store cart");
    storeCarts[store]!.removeWhere((cartItem) => 
      cartItem['name'] == item['name'] && 
      cartItem['ingredient'] == item['ingredient']);
    recalculateTotal(store);
    notifyListeners();
  }
  
  // Clear a store's cart
  void clearCart(String store) {
    print("CART STATE: Clearing $store cart");
    storeCarts[store]!.clear();
    storeTotals[store] = 0.0;
    notifyListeners();
  }
  
  // Recalculate total for a store
  void recalculateTotal(String store) {
    double total = 0.0;
    for (var item in storeCarts[store]!) {
      if (item.containsKey('price') && item['price'] != null) {
        // Convert price to double if it exists
        final dynamic price = item['price'];
        if (price is num) {
          total += price.toDouble();
        } else if (price is String) {
          total += double.tryParse(price) ?? 0.0;
        }
      } else {
        // If no price found, use a default estimated price
        // This ensures we display something even with real data that lacks prices
        total += 3.99;
      }
    }
    storeTotals[store] = total;
  }
  
  // Debug method to print current cart state
  void printCartState() {
    for (var store in storeCarts.keys) {
      print("$store cart has ${storeCarts[store]!.length} items");
      for (var i = 0; i < storeCarts[store]!.length; i++) {
        var item = storeCarts[store]![i];
        print("  Item $i: ${item['name']} (${item['ingredient']})");
      }
    }
  }
}

// App state management class to track if the user is a trainer
class AppState extends ChangeNotifier {
  bool _isTrainer = false;
  int _selectedTab = 0;
  
  bool get isTrainer => _isTrainer;
  int get selectedTab => _selectedTab;
  
  void setTrainerStatus(bool isTrainer) {
    _isTrainer = isTrainer;
    notifyListeners();
  }
  
  void setSelectedTab(int tab) {
    _selectedTab = tab;
    notifyListeners();
  }
}

class MealPlannerApp extends StatefulWidget {
  const MealPlannerApp({Key? key}) : super(key: key);

  @override
  State<MealPlannerApp> createState() => _MealPlannerAppState();
}

class _MealPlannerAppState extends State<MealPlannerApp> {
  ThemeMode _themeMode = ThemeMode.system;
  
  @override
  void initState() {
    super.initState();
    _loadThemeMode();
  }
  
  // Load theme preference
  Future<void> _loadThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    final isDarkMode = prefs.getBool('darkMode') ?? false;
    setState(() {
      _themeMode = isDarkMode ? ThemeMode.dark : ThemeMode.light;
    });
  }
  
  // Toggle theme mode
  void _toggleThemeMode() async {
    final prefs = await SharedPreferences.getInstance();
    final isDarkMode = _themeMode == ThemeMode.dark;
    
    setState(() {
      _themeMode = isDarkMode ? ThemeMode.light : ThemeMode.dark;
    });
    
    await prefs.setBool('darkMode', !isDarkMode);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => CartState()),
        ChangeNotifierProvider(create: (_) => AppState()),
        Provider<ThemeService>(
          create: (_) => ThemeService(
            toggleTheme: _toggleThemeMode,
            currentTheme: _themeMode,
          ),
        ),
      ],
      child: Consumer<AuthProvider>(
        builder: (ctx, auth, _) => MaterialApp(
          title: 'Smart Meal Planner',
          theme: CustomTheme.lightTheme,
          darkTheme: CustomTheme.darkTheme,
          themeMode: _themeMode,
          navigatorKey: navigatorKey, // Add navigator key for global access
          home: auth.isLoggedIn 
            ? MainNavigationScreen(userId: auth.userId ?? 0, authToken: auth.authToken ?? '')
            : LoginScreen(),
          routes: {
            '/login': (context) => LoginScreen(),
            '/signup': (context) => SignUpScreen(),
            '/forgot-password': (context) => ForgotPasswordScreen(),
            '/reset-password': (context) {
              final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
              return ResetPasswordScreen(token: args?['token'] ?? '');
            },
            '/kroger-auth': (context) {
              final args = ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
              return KrogerAuthScreen(
                authUrl: args?['authUrl'],
                userId: args?['userId'] ?? auth.userId ?? 0,
                authToken: args?['authToken'] ?? auth.authToken ?? '',
              );
            },
          },
          onGenerateRoute: (settings) {
            // Authenticated routes
            if (auth.isLoggedIn) {
              final userId = auth.userId ?? 0;
              final token = auth.authToken ?? '';
              
              switch (settings.name) {
                case '/preferences':
                  return MaterialPageRoute(
                    builder: (_) => PreferencesScreen(userId: userId, authToken: token)
                  );
                case '/menu':
                  return MaterialPageRoute(
                    builder: (_) => MenuScreen(userId: userId, authToken: token)
                  );
                case '/cart':
                  final args = settings.arguments as Map<String, dynamic>?;
                  return MaterialPageRoute(
                    builder: (_) => CartScreen(
                      userId: userId,
                      authToken: token,
                      storeName: args?['storeName'] ?? 'Default Store',
                      ingredients: args?['ingredients'] ?? <String>[],
                    )
                  );
                case '/location':
                  return MaterialPageRoute(
                    builder: (_) => LocationScreen()
                  );
                case '/store-selection':
                  return MaterialPageRoute(
                    builder: (_) => StoreSelectionScreen(userId: userId, authToken: token)
                  );
                case '/compare':
                  final args = settings.arguments as Map<String, dynamic>?;
                  return MaterialPageRoute(
                    builder: (_) => CompareScreen(
                      userId: userId,
                      ingredients: args?['ingredients'] ?? <String>[],
                    )
                  );
                case '/order':
                  final args = settings.arguments as Map<String, dynamic>?;
                  return MaterialPageRoute(
                    builder: (_) => OrderScreen(
                      orderId: args?['orderId'] ?? 0,
                      totalCost: args?['totalCost'] ?? 0.0,
                      status: args?['status'] ?? 'pending',
                    )
                  );
                case '/recipe-browser':
                  return MaterialPageRoute(
                    builder: (_) => RecipeBrowserScreen(userId: userId, authToken: token)
                  );
                case '/saved-recipes':
                  return MaterialPageRoute(
                    builder: (_) => SavedRecipesScreen(userId: userId, authToken: token)
                  );
                case '/profile':
                  return MaterialPageRoute(
                    builder: (_) => ProfileScreen(userId: userId, authToken: token)
                  );
                case '/custom-menu':
                  return MaterialPageRoute(
                    builder: (_) => CustomMenuScreen(userId: userId, authToken: token)
                  );
                case '/order-history':
                  return MaterialPageRoute(
                    builder: (_) => OrderHistoryScreen(userId: userId, authToken: token)
                  );
                case '/organization':
                  return MaterialPageRoute(
                    builder: (_) => OrganizationScreen(userId: userId, authToken: token)
                  );
                case '/client-recipes':
                  final args = settings.arguments as Map<String, dynamic>;
                  return MaterialPageRoute(
                    builder: (_) => ClientRecipesScreen(
                      clientId: args['clientId'],
                      clientName: args['clientName'],
                      userId: userId,
                      authToken: token,
                    )
                  );
                case '/client-menus':
                  final args = settings.arguments as Map<String, dynamic>;
                  return MaterialPageRoute(
                    builder: (_) => ClientMenusScreen(
                      clientId: args['clientId'],
                      clientName: args['clientName'],
                      userId: userId,
                      authToken: token,
                    )
                  );
                case '/client-preferences':
                  final args = settings.arguments as Map<String, dynamic>;
                  return MaterialPageRoute(
                    builder: (_) => ClientPreferencesScreen(
                      clientId: args['clientId'],
                      clientName: args['clientName'],
                      userId: userId,
                      authToken: token,
                    )
                  );
                case '/create-client-menu':
                  final args = settings.arguments as Map<String, dynamic>;
                  return MaterialPageRoute(
                    builder: (_) => CreateClientMenuScreen(
                      clientId: args['clientId'],
                      clientName: args['clientName'],
                      userId: userId,
                      authToken: token,
                      recipeId: args['recipeId'],
                      recipeTitle: args['recipeTitle'],
                    )
                  );
                case '/client-menu-creator':
                  final args = settings.arguments as Map<String, dynamic>;
                  return MaterialPageRoute(
                    builder: (_) => CreateClientMenuScreen(
                      clientId: 0, // Will show client selection dialog
                      clientName: 'New Client',
                      userId: userId,
                      authToken: token,
                      recipeId: args['recipeId'],
                      recipeTitle: args['recipeTitle'],
                    )
                  );
                case '/menu-history':
                  return MaterialPageRoute(
                    builder: (_) => MenuHistoryScreen(),
                    settings: settings,
                  );
                case '/shopping-list':
                  final args = settings.arguments as Map<String, dynamic>?;
                  return MaterialPageRoute(
                    builder: (_) => ShoppingListScreen(
                      userId: userId,
                      authToken: token,
                      menuId: args?['menuId'] ?? 0,
                      menuTitle: args?['menuTitle'] ?? 'Menu',
                    )
                  );
                case '/carts':
                  final args = settings.arguments as Map<String, dynamic>?;
                  return MaterialPageRoute(
                    builder: (_) => CartsScreen(
                      userId: userId,
                      authToken: token,
                      selectedStore: args?['selectedStore'],
                      needsSearch: args?['needsSearch'],
                      ingredientCount: args?['ingredientCount'],
                      localCartItem: args?['localCartItem'],
                      localCartItems: args?['localCartItems'] != null ? 
                        List<Map<String, dynamic>>.from(args?['localCartItems']) : null,
                    )
                  );
              }
            }
            
            // Fallback to login for unauthenticated users
            if (!auth.isLoggedIn && settings.name != '/login' && 
                settings.name != '/signup' && settings.name != '/forgot-password') {
              return MaterialPageRoute(builder: (_) => LoginScreen());
            }
            
            return null;
          },
        ),
      ),
    );
  }
}

// Main navigation screen with bottom tabs
class MainNavigationScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  MainNavigationScreen({required this.userId, required this.authToken});

  @override
  _MainNavigationScreenState createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  late PageController _pageController;
  bool _isLoading = true;
  
  @override
  void initState() {
    super.initState();
    final appState = Provider.of<AppState>(context, listen: false);
    _pageController = PageController(initialPage: appState.selectedTab);
    
    // Check trainer status from both sources for redundancy
    _checkTrainerStatus();
  }
  
  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
  
  // Check if user is a trainer to show organization tab
  Future<void> _checkTrainerStatus() async {
    setState(() => _isLoading = true);
    
    try {
      // Method 1: Check from AuthProvider
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      bool isTrainerFromAuth = authProvider.isTrainer;
      
      print("Trainer status from AuthProvider: $isTrainerFromAuth");
      
      // Method 2: Check directly from API
      final accountInfo = await ApiService.getUserAccountInfo(widget.authToken);
      
      final isTrainerFromApi = accountInfo['is_organization'] == true || 
                             accountInfo['is_trainer'] == true ||
                             accountInfo['account_type'] == 'organization';
      
      print("Trainer status from API: $isTrainerFromApi");
      
      // Combine results - if either source indicates trainer, show organization tab
      final isTrainer = isTrainerFromAuth || isTrainerFromApi;
      
      // Update app state
      Provider.of<AppState>(context, listen: false).setTrainerStatus(isTrainer);
      
      setState(() => _isLoading = false);
    } catch (e) {
      print("Error checking trainer status: $e");
      
      // Fallback to AuthProvider if API fails
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      Provider.of<AppState>(context, listen: false).setTrainerStatus(authProvider.isTrainer);
      
      setState(() => _isLoading = false);
    }
  }
  
  void _selectTab(int index) {
    final appState = Provider.of<AppState>(context, listen: false);
    appState.setSelectedTab(index);
    _pageController.animateToPage(
      index,
      duration: Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    
    if (_isLoading) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 20),
              Text("Loading your account...", style: TextStyle(fontSize: 16))
            ],
          ),
        ),
      );
    }
    
    // Enhanced logging to diagnose trainer status
    print("🔍 TRAINER STATUS CHECK");
    print("AppState isTrainer: ${appState.isTrainer}");
    print("AuthProvider isTrainer: ${authProvider.isTrainer}");
    print("AuthProvider accountType: ${authProvider.accountType}");
    
    // Always show all tabs but use consistent indices regardless of user type
    final hasOrganizationTab = appState.isTrainer;
    
    // Define all possible screens
    final allScreens = {
      'menu': MenuScreen(userId: widget.userId, authToken: widget.authToken),
      'browse': RecipeBrowserScreen(userId: widget.userId, authToken: widget.authToken),
      'shop': CartsScreen(userId: widget.userId, authToken: widget.authToken),
      'organization': OrganizationScreen(userId: widget.userId, authToken: widget.authToken),
      'profile': ProfileScreen(userId: widget.userId, authToken: widget.authToken),
    };
    
    // Define tab order based on user type
    List<String> tabOrder = hasOrganizationTab
      ? ['menu', 'browse', 'shop', 'organization', 'profile']
      : ['menu', 'browse', 'shop', 'profile'];
    
    // Create screens in the right order
    List<Widget> screens = tabOrder.map((key) => allScreens[key]!).toList();
    
    // Create tab items in the right order
    List<BottomNavigationBarItem> tabItems = [
      BottomNavigationBarItem(
        icon: Icon(Icons.restaurant_menu),
        label: 'Menus',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.search),
        label: 'Browse',
      ),
      BottomNavigationBarItem(
        icon: Icon(Icons.shopping_cart),
        label: 'Shop',
      ),
    ];
    
    // Add organization tab for trainers
    if (hasOrganizationTab) {
      tabItems.add(BottomNavigationBarItem(
        icon: Icon(Icons.business),
        label: 'Organization',
      ));
    }
    
    // Always add profile tab at the end
    tabItems.add(BottomNavigationBarItem(
      icon: Icon(Icons.person),
      label: 'Profile',
    ));
    
    return Scaffold(
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) {
          Provider.of<AppState>(context, listen: false).setSelectedTab(index);
        },
        children: screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: appState.selectedTab,
        onTap: _selectTab,
        selectedItemColor: Theme.of(context).primaryColor,
        unselectedItemColor: Colors.grey,
        items: tabItems,
      ),
    );
  }
}