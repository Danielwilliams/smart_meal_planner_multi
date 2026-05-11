class UserProfile {
  final int id;
  final String name;
  final String email;
  final String? accountType;
  final bool isActive;
  final DateTime? createdAt;
  final String? subscription;
  final bool? isOrganization;
  final int? organizationId;
  
  UserProfile({
    required this.id,
    required this.name,
    required this.email,
    this.accountType,
    required this.isActive,
    this.createdAt,
    this.subscription,
    this.isOrganization,
    this.organizationId,
  });
  
  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? json['username'] ?? '',
      email: json['email'] ?? '',
      accountType: json['account_type'] ?? json['accountType'],
      isActive: json['is_active'] ?? true,
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at']) 
          : null,
      subscription: json['subscription'],
      isOrganization: json['is_organization'],
      organizationId: json['organization_id'] is int 
          ? json['organization_id'] 
          : int.tryParse(json['organization_id'].toString()),
    );
  }
}

class ClientUser extends UserProfile {
  final String? dietType;
  final List<String>? allergies;
  final String? notes;
  // 'active' | 'inactive' | 'pending'
  final String status;

  ClientUser({
    required int id,
    required String name,
    required String email,
    required bool isActive,
    String? accountType,
    DateTime? createdAt,
    String? subscription,
    bool? isOrganization,
    int? organizationId,
    this.dietType,
    this.allergies,
    this.notes,
    this.status = 'active',
  }) : super(
    id: id,
    name: name,
    email: email,
    accountType: accountType,
    isActive: isActive,
    createdAt: createdAt,
    subscription: subscription,
    isOrganization: isOrganization,
    organizationId: organizationId,
  );

  factory ClientUser.fromJson(Map<String, dynamic> json) {
    List<String>? allergies;
    if (json['allergies'] != null) {
      if (json['allergies'] is List) {
        allergies = List<String>.from(json['allergies'].map((a) => a.toString()));
      } else if (json['allergies'] is String) {
        allergies = json['allergies'].toString().split(',').map((a) => a.trim()).toList();
      }
    }

    // Derive status: explicit 'status' field takes priority, then is_active, then default active
    final rawStatus = json['status']?.toString().toLowerCase();
    final isActive = json['is_active'] ?? true;
    final String status;
    if (rawStatus == 'pending') {
      status = 'pending';
    } else if (rawStatus == 'inactive' || isActive == false) {
      status = 'inactive';
    } else {
      status = 'active';
    }

    return ClientUser(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? json['username'] ?? '',
      email: json['email'] ?? '',
      accountType: json['account_type'] ?? json['accountType'],
      isActive: isActive == true,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'])
          : null,
      subscription: json['subscription'],
      isOrganization: json['is_organization'],
      organizationId: json['organization_id'] is int
          ? json['organization_id']
          : int.tryParse(json['organization_id']?.toString() ?? ''),
      dietType: json['diet_type'] ?? json['dietType'],
      allergies: allergies,
      notes: json['notes'],
      status: status,
    );
  }
}