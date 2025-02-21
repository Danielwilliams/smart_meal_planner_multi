import 'package:flutter/material.dart';
import '../services/api_service.dart';

class MenuScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  MenuScreen({required this.userId, required this.authToken});

  @override
  _MenuScreenState createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> {
  String _menuText = "";
  bool _isLoading = false;
  
  // Example meal types: you might let the user pick these dynamically
  List<String> mealTypes = ["breakfast", "lunch", "dinner"];

  Future<void> _generateMenu() async {
    setState(() => _isLoading = true);

    final result = await ApiService.generateMenu(
      userId: widget.userId,
      authToken: widget.authToken,
      mealTypes: mealTypes,
    );

    setState(() => _isLoading = false);

    if (result != null && result["menu_text"] != null) {
      setState(() => _menuText = result["menu_text"]);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Failed to generate menu."))
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _generateMenu(); // Automatically generate on screen load
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("AI-Generated Menu")),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: _isLoading 
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(child: Text(_menuText)),
      ),
    );
  }
}
