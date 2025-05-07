import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'package:intl/intl.dart';

class OrderHistoryScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  OrderHistoryScreen({required this.userId, required this.authToken});

  @override
  _OrderHistoryScreenState createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _orders = [];
  bool _hasError = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _fetchOrderHistory();
  }

  Future<void> _fetchOrderHistory() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final result = await ApiService.getOrderHistory(
        widget.userId,
        widget.authToken,
      );

      if (result != null && result.containsKey('orders')) {
        final ordersData = result['orders'] as List<dynamic>;
        
        setState(() {
          _isLoading = false;
          _orders = ordersData.map((order) => order as Map<String, dynamic>).toList();
        });
      } else {
        setState(() {
          _isLoading = false;
          _hasError = true;
          _errorMessage = 'Failed to load order history';
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _hasError = true;
        _errorMessage = 'An error occurred: $e';
      });
    }
  }

  // Format date string
  String _formatDate(String dateString) {
    try {
      final date = DateTime.parse(dateString);
      return DateFormat('MMM d, yyyy').format(date);
    } catch (e) {
      return dateString;
    }
  }

  // Format currency
  String _formatCurrency(dynamic amount) {
    if (amount == null) return '\$0.00';
    
    final formatter = NumberFormat.currency(symbol: '\$', decimalDigits: 2);
    
    if (amount is int) {
      return formatter.format(amount.toDouble());
    } else if (amount is double) {
      return formatter.format(amount);
    } else if (amount is String) {
      try {
        return formatter.format(double.parse(amount));
      } catch (e) {
        return '\$0.00';
      }
    }
    
    return '\$0.00';
  }

  // Get status color
  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return Colors.green;
      case 'processing':
        return Colors.orange;
      case 'pending':
        return Colors.blue;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  // Display order details
  void _showOrderDetails(Map<String, dynamic> order) {
    final items = order['items'] as List<dynamic>? ?? [];
    
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 5,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      margin: EdgeInsets.only(bottom: 16),
                    ),
                  ),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Order #${order['id']}',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                        ),
                      ),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getStatusColor(order['status'] ?? 'pending').withOpacity(0.2),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          order['status'] ?? 'Pending',
                          style: TextStyle(
                            color: _getStatusColor(order['status'] ?? 'pending'),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Placed on ${_formatDate(order['created_at'] ?? DateTime.now().toIso8601String())}',
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                  Text(
                    'Store: ${order['store_name'] ?? 'Unknown Store'}',
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                  Divider(height: 32),
                  Text(
                    'Items',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  ...items.map((item) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item['name'] ?? 'Unknown Item'),
                      subtitle: Text('Quantity: ${item['quantity'] ?? 1}'),
                      trailing: Text(_formatCurrency(item['price'])),
                    );
                  }).toList(),
                  if (items.isEmpty)
                    Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text(
                          'No items found for this order',
                          style: TextStyle(color: Colors.grey[600]),
                        ),
                      ),
                    ),
                  Divider(height: 32),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        _formatCurrency(order['total_cost']),
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  SizedBox(height: 40),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Order History'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _fetchOrderHistory,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _hasError
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red),
                      SizedBox(height: 16),
                      Text(
                        _errorMessage,
                        style: TextStyle(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchOrderHistory,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _orders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.receipt_long, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text(
                            'No orders yet',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'Your order history will appear here',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.all(16),
                      itemCount: _orders.length,
                      itemBuilder: (context, index) {
                        final order = _orders[index];
                        return Card(
                          margin: EdgeInsets.only(bottom: 16),
                          child: InkWell(
                            onTap: () => _showOrderDetails(order),
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Order #${order['id']}',
                                              style: TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            SizedBox(height: 4),
                                            Text(
                                              _formatDate(order['created_at'] ?? ''),
                                              style: TextStyle(color: Colors.grey[600]),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: _getStatusColor(order['status'] ?? 'pending').withOpacity(0.2),
                                          borderRadius: BorderRadius.circular(16),
                                        ),
                                        child: Text(
                                          order['status'] ?? 'Pending',
                                          style: TextStyle(
                                            color: _getStatusColor(order['status'] ?? 'pending'),
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  SizedBox(height: 8),
                                  Text(
                                    'Store: ${order['store_name'] ?? 'Unknown Store'}',
                                    style: TextStyle(color: Colors.grey[700]),
                                  ),
                                  SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Total: ${_formatCurrency(order['total_cost'])}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          Text('View Details'),
                                          Icon(Icons.chevron_right, size: 16),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
    );
  }
}