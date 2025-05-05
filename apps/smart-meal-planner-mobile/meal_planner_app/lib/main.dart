import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'Screens/login_screen.dart';
import 'Screens/signup_screen.dart';
import 'Screens/menu_screen.dart';
import 'Screens/cart_screen.dart';
import 'Screens/forgot_password_screen.dart';
import 'Screens/reset_password_screen.dart';
import 'Screens/location_screen.dart';
import 'Screens/preferences_screen.dart';
import 'Screens/compare_screen.dart';
import 'Screens/store_selection_screen.dart';
import 'Screens/order_screen.dart';
import 'Providers/auth_providers.dart';
import 'common/custom_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MealPlannerApp());
}

class MealPlannerApp extends StatelessWidget {
  const MealPlannerApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: Consumer<AuthProvider>(
        builder: (ctx, auth, _) => MaterialApp(
          title: 'Smart Meal Planner',
          theme: CustomTheme.lightTheme,
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
                      menuId: args?['menuId'] ?? 0,
                      storeName: args?['storeName'] ?? 'Default Store',
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
                      authToken: token,
                      menuId: args?['menuId'] ?? 0,
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