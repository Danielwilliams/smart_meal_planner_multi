import 'package:flutter/material.dart';

class StoreSelectionScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  StoreSelectionScreen({required this.userId, required this.authToken});

  @override
  _StoreSelectionScreenState createState() => _StoreSelectionScreenState();
}

class _StoreSelectionScreenState extends State<StoreSelectionScreen> {
  List<Map<String, dynamic>> _stores = [
    // Example Hard-coded
    {"name": "Kroger", "distance": 1.2},
    {"name": "Walmart", "distance": 2.5},
    {"name": "Sprouts", "distance": 3.0},
  ];

  // In real usage, fetch from your backend
  // e.g. final result = await ApiService.getNearbyStores(widget.userId, widget.authToken)

  void _selectStore(String storeName) {
    // Navigate to Cart or Menu with storeName
    Navigator.pushNamed(context, '/cart', arguments: {
      "userId": widget.userId,
      "authToken": widget.authToken,
      "storeName": storeName
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Select a Store"),
      ),
      body: ListView.builder(
        itemCount: _stores.length,
        itemBuilder: (context, index) {
          final store = _stores[index];
          return ListTile(
            title: Text(store["name"]),
            subtitle: Text("${store["distance"]} miles away"),
            onTap: () => _selectStore(store["name"]),
          );
        },
      ),
    );
  }
}
