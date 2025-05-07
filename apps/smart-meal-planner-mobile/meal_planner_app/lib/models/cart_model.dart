class CartItem {
  final String displayName;  // The formatted display name with quantity and unit
  final String name;         // The basic ingredient name
  final String? unit;        // Unit of measurement (e.g., cups, oz)
  final dynamic quantity;    // Quantity as a number or string
  final String? notes;       // Additional notes about the item
  final String store;        // Store name (Walmart or Kroger)
  final double? price;       // Optional price (null means use estimated price)
  final String? imageUrl;    // Optional image URL
  
  CartItem({
    required this.displayName,
    required this.name,
    this.unit,
    this.quantity,
    this.notes,
    required this.store,
    this.price,
    this.imageUrl,
  });
  
  // Create from a map (from shopping list item)
  factory CartItem.fromMap(Map<String, dynamic> map) {
    // Extract the basic properties
    final String name = map['name'] ?? '';
    final String displayName = map['ingredient'] ?? name;
    final dynamic quantity = map['quantity'];
    final String? unit = map['unit']?.toString();
    final String? notes = map['notes']?.toString();
    final String store = map['store'] ?? 'Walmart';
    
    // Optional price and image
    final dynamic price = map['price'];
    final String? imageUrl = map['image_url'] ?? map['image'] ?? map['thumbnail'];
    
    return CartItem(
      displayName: displayName,
      name: name,
      unit: unit,
      quantity: quantity,
      notes: notes,
      store: store,
      price: price != null ? 
        (price is num ? price.toDouble() : 
        double.tryParse(price.toString())): null,
      imageUrl: imageUrl,
    );
  }
  
  // Convert to a map for serialization
  Map<String, dynamic> toMap() {
    return {
      'ingredient': displayName,
      'name': name,
      'unit': unit,
      'quantity': quantity,
      'notes': notes,
      'store': store,
      'price': price,
      'image_url': imageUrl,
    };
  }
  
  // Create a copy with modified fields
  CartItem copyWith({
    String? displayName,
    String? name,
    String? unit,
    dynamic quantity,
    String? notes,
    String? store,
    double? price,
    String? imageUrl,
  }) {
    return CartItem(
      displayName: displayName ?? this.displayName,
      name: name ?? this.name,
      unit: unit ?? this.unit,
      quantity: quantity ?? this.quantity,
      notes: notes ?? this.notes,
      store: store ?? this.store,
      price: price ?? this.price,
      imageUrl: imageUrl ?? this.imageUrl,
    );
  }
  
  // Format quantity and unit for display
  String formatQuantityAndUnit() {
    if (quantity == null) return '';
    String qtyStr = quantity.toString();
    if (unit != null && unit!.isNotEmpty) {
      return '$qtyStr $unit';
    }
    return qtyStr;
  }
}

// Class to handle a collection of cart items
class Cart {
  final String store;
  final List<CartItem> items;
  
  Cart({
    required this.store,
    required this.items,
  });
  
  // Calculate total price (with estimated prices if needed)
  double calculateTotal() {
    double total = 0.0;
    for (var item in items) {
      // Use item price if available, otherwise use estimated price
      if (item.price != null) {
        total += item.price!;
      } else {
        // Estimated price based on item name length
        final estimatedPrice = 3.99 + ((item.name.length % 5) * 0.25);
        total += estimatedPrice;
      }
    }
    return total;
  }
  
  // Create a copy with modified fields
  Cart copyWith({
    String? store,
    List<CartItem>? items,
  }) {
    return Cart(
      store: store ?? this.store,
      items: items ?? this.items,
    );
  }
  
  // Add an item to the cart
  Cart addItem(CartItem item) {
    if (item.store != store) {
      return this; // Don't add if store doesn't match
    }
    
    final newItems = List<CartItem>.from(items);
    newItems.add(item);
    return Cart(store: store, items: newItems);
  }
  
  // Remove an item from the cart
  Cart removeItem(CartItem item) {
    final newItems = List<CartItem>.from(items);
    newItems.removeWhere((i) => 
      i.displayName == item.displayName && 
      i.name == item.name);
    return Cart(store: store, items: newItems);
  }
}