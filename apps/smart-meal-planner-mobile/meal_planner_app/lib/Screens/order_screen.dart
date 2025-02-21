import 'package:flutter/material.dart';

class OrderScreen extends StatelessWidget {
  final int orderId;
  final double totalCost;
  final String status;

  OrderScreen({required this.orderId, required this.totalCost, required this.status});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Order #$orderId"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text("Status: $status", style: TextStyle(fontSize: 18)),
            Text("Total: \$${totalCost.toStringAsFixed(2)}", style: TextStyle(fontSize: 18)),
            SizedBox(height: 20),
            ElevatedButton(
              child: Text("Back to Home"),
              onPressed: () => Navigator.pushNamed(context, '/menu'),
            )
          ],
        ),
      ),
    );
  }
}
