import 'package:flutter/material.dart';

class CustomTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      primarySwatch: Colors.blue,
      primaryColor: Colors.blue[700],
      secondaryHeaderColor: Colors.green[600],
      scaffoldBackgroundColor: Colors.white,
      fontFamily: 'Roboto',
      textTheme: const TextTheme(
        headline1: TextStyle(fontSize: 28.0, fontWeight: FontWeight.bold, color: Colors.black87),
        headline2: TextStyle(fontSize: 24.0, fontWeight: FontWeight.bold, color: Colors.black87),
        headline3: TextStyle(fontSize: 20.0, fontWeight: FontWeight.w500, color: Colors.black87),
        bodyText1: TextStyle(fontSize: 16.0, color: Colors.black87),
        bodyText2: TextStyle(fontSize: 14.0, color: Colors.black87),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white,
          backgroundColor: Colors.blue[700],
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: Colors.blue[700]!),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.blue[700],
        elevation: 2,
        centerTitle: true,
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primarySwatch: Colors.blue,
      primaryColor: Colors.blue[700],
      secondaryHeaderColor: Colors.green[600],
      scaffoldBackgroundColor: Colors.grey[900],
      fontFamily: 'Roboto',
      textTheme: const TextTheme(
        headline1: TextStyle(fontSize: 28.0, fontWeight: FontWeight.bold, color: Colors.white),
        headline2: TextStyle(fontSize: 24.0, fontWeight: FontWeight.bold, color: Colors.white),
        headline3: TextStyle(fontSize: 20.0, fontWeight: FontWeight.w500, color: Colors.white),
        bodyText1: TextStyle(fontSize: 16.0, color: Colors.white),
        bodyText2: TextStyle(fontSize: 14.0, color: Colors.white),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: Colors.white,
          backgroundColor: Colors.blue[700],
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: Colors.blue[700]!),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.blue[700],
        elevation: 2,
        centerTitle: true,
      ),
    );
  }
}