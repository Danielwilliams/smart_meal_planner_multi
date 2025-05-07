import 'package:flutter/material.dart';

class CustomTheme {
  // Define brand colors to match web app
  static const Color primaryColor = Color(0xFF00695C); // Teal 800
  static const Color secondaryColor = Color(0xFF4CAF50); // Green 500
  static const Color accentColor = Color(0xFFFF6F00); // Amber 900
  static const Color errorColor = Color(0xFFD32F2F); // Red 700
  
  static ThemeData get lightTheme {
    return ThemeData(
      primarySwatch: MaterialColor(
        primaryColor.value,
        <int, Color>{
          50: Color(0xFFE0F2F1),
          100: Color(0xFFB2DFDB),
          200: Color(0xFF80CBC4),
          300: Color(0xFF4DB6AC),
          400: Color(0xFF26A69A),
          500: Color(0xFF009688),
          600: Color(0xFF00897B),
          700: Color(0xFF00796B),
          800: primaryColor,
          900: Color(0xFF004D40),
        },
      ),
      primaryColor: primaryColor,
      colorScheme: ColorScheme.light(
        primary: primaryColor,
        secondary: secondaryColor,
        error: errorColor,
      ),
      scaffoldBackgroundColor: Colors.grey[50],
      fontFamily: 'Roboto',
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontSize: 28.0, fontWeight: FontWeight.bold, color: Color(0xFF212121)),
        displayMedium: TextStyle(fontSize: 24.0, fontWeight: FontWeight.bold, color: Color(0xFF212121)),
        displaySmall: TextStyle(fontSize: 20.0, fontWeight: FontWeight.w500, color: Color(0xFF212121)),
        bodyLarge: TextStyle(fontSize: 16.0, color: Color(0xFF424242)),
        bodyMedium: TextStyle(fontSize: 14.0, color: Color(0xFF616161)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white,
          backgroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: BorderSide(color: primaryColor),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: primaryColor, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        filled: true,
        fillColor: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryColor,
        elevation: 2,
        centerTitle: false,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        margin: EdgeInsets.all(8),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: secondaryColor,
        foregroundColor: Colors.white,
      ),
      dividerTheme: DividerThemeData(
        thickness: 1,
        space: 16,
        color: Colors.grey[300],
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: MaterialStateProperty.resolveWith<Color>((states) {
          if (states.contains(MaterialState.selected)) return primaryColor;
          return Colors.grey;
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.grey[200],
        selectedColor: primaryColor.withOpacity(0.2),
        secondarySelectedColor: primaryColor,
        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 0),
        labelStyle: TextStyle(color: Colors.black87),
        secondaryLabelStyle: TextStyle(color: primaryColor),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primarySwatch: MaterialColor(
        primaryColor.value,
        <int, Color>{
          50: Color(0xFFE0F2F1),
          100: Color(0xFFB2DFDB),
          200: Color(0xFF80CBC4),
          300: Color(0xFF4DB6AC),
          400: Color(0xFF26A69A),
          500: Color(0xFF009688),
          600: Color(0xFF00897B),
          700: Color(0xFF00796B),
          800: primaryColor,
          900: Color(0xFF004D40),
        },
      ),
      primaryColor: primaryColor,
      colorScheme: ColorScheme.dark(
        primary: Color(0xFF4DB6AC), // Lighter teal for dark theme
        secondary: Color(0xFF81C784), // Lighter green for dark theme
        error: errorColor,
      ),
      scaffoldBackgroundColor: Color(0xFF121212),
      fontFamily: 'Roboto',
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontSize: 28.0, fontWeight: FontWeight.bold, color: Colors.white),
        displayMedium: TextStyle(fontSize: 24.0, fontWeight: FontWeight.bold, color: Colors.white),
        displaySmall: TextStyle(fontSize: 20.0, fontWeight: FontWeight.w500, color: Colors.white),
        bodyLarge: TextStyle(fontSize: 16.0, color: Colors.white70),
        bodyMedium: TextStyle(fontSize: 14.0, color: Colors.white60),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white,
          backgroundColor: Color(0xFF00897B), // Slightly lighter teal
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: Color(0xFF4DB6AC),
          side: BorderSide(color: Color(0xFF4DB6AC)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: Color(0xFF4DB6AC),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: BorderSide(color: Color(0xFF4DB6AC), width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        filled: true,
        fillColor: Color(0xFF2A2A2A),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF004D40), // Darker teal
        elevation: 2,
        centerTitle: false,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        margin: EdgeInsets.all(8),
        color: Color(0xFF1E1E1E),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: Color(0xFF81C784), // Lighter green
        foregroundColor: Colors.white,
      ),
      dividerTheme: DividerThemeData(
        thickness: 1,
        space: 16,
        color: Colors.grey[800],
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: MaterialStateProperty.resolveWith<Color>((states) {
          if (states.contains(MaterialState.selected)) return Color(0xFF4DB6AC);
          return Colors.grey;
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Color(0xFF2A2A2A),
        selectedColor: Color(0xFF00897B).withOpacity(0.3),
        secondarySelectedColor: Color(0xFF4DB6AC),
        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 0),
        labelStyle: TextStyle(color: Colors.white70),
        secondaryLabelStyle: TextStyle(color: Color(0xFF4DB6AC)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}