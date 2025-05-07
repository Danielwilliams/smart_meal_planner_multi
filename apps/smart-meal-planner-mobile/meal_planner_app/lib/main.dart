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
            ? MenuScreen(userId: auth.userId ?? 0, authToken: auth.authToken ?? '')
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