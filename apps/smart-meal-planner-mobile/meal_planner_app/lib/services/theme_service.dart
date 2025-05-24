import 'package:flutter/material.dart';

class ThemeService {
  final Function toggleTheme;
  final ThemeMode currentTheme;

  ThemeService({
    required this.toggleTheme,
    required this.currentTheme,
  });

  bool get isDarkMode => currentTheme == ThemeMode.dark;
}