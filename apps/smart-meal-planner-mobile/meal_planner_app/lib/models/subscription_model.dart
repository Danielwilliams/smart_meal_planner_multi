class Subscription {
  final bool hasSubscription;
  final bool isActive;
  final String status;
  final String subscriptionType;
  final bool isFreeTier;
  final String currency;
  final double monthlyAmount;
  
  Subscription({
    required this.hasSubscription,
    required this.isActive,
    required this.status,
    this.subscriptionType = 'free',
    this.isFreeTier = true,
    this.currency = 'usd',
    this.monthlyAmount = 0.0,
  });
  
  factory Subscription.fromJson(Map<String, dynamic> json) {
    return Subscription(
      hasSubscription: json['has_subscription'] ?? false,
      isActive: json['is_active'] ?? false,
      status: json['status'] ?? 'inactive',
      subscriptionType: json['subscription_type'] ?? 'free',
      isFreeTier: json['is_free_tier'] ?? true,
      currency: json['currency'] ?? 'usd',
      monthlyAmount: (json['monthly_amount'] is num) 
          ? (json['monthly_amount'] as num).toDouble() 
          : 0.0,
    );
  }
  
  // Default free subscription
  factory Subscription.free() {
    return Subscription(
      hasSubscription: true,
      isActive: true,
      status: 'active',
      subscriptionType: 'free',
      isFreeTier: true,
      currency: 'usd',
      monthlyAmount: 0.0,
    );
  }
}