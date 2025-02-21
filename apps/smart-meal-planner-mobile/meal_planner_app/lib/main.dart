import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/preferences_screen.dart';
import 'screens/menu_screen.dart';
import 'screens/cart_screen.dart';
import 'providers/auth_provider.dart';
import 'common/custom_theme.dart';

void main() {
  runApp(MealPlannerApp());
}

class MealPlannerApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(
        title: 'Meal Planner',
        theme: CustomTheme.lightTheme, // see next section
        initialRoute: '/login',
        routes: {
          '/login': (context) => LoginScreen(),
          '/signup': (context) => SignUpScreen(),
          '/preferences': (context) => PreferencesScreen(),
          '/menu': (context) => MenuScreen(),
          '/cart': (context) => CartScreen(),
        },
      ),
    );
  }
}

#We can prevent accessing certain routes if the user is not logged in. One simple approach is using a onGenerateRoute or onUnknownRoute check in MaterialApp and verifying state from AuthProvider.

MaterialApp(
  onGenerateRoute: (RouteSettings settings) {
    // If route is '/preferences' but user is not logged in, redirect to '/login'
    if (settings.name == '/preferences') {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      if (!authProvider.isLoggedIn) {
        return MaterialPageRoute(builder: (_) => LoginScreen());
      }
    }
    // add more guards for other routes
    // default:
    return null; // fall back to named routes
  },
  routes: { /* ... your named routes ... */ },
);



# Alternatively, you could have a ProtectedScreen widget that checks AuthProvider.isLoggedIn in build(). If not logged in, it redirects. For instance:
# Then wrap any screen with ProtectedScreen(child: MyScreen()).

class ProtectedScreen extends StatelessWidget {
  final Widget child;
  const ProtectedScreen({required this.child});

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = context.watch<AuthProvider>().isLoggedIn;
    if (!isLoggedIn) {
      return LoginScreen();
    }
    return child;
  }
}


theme: CustomTheme.lightTheme,