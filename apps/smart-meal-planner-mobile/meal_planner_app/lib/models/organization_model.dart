class Organization {
  final int id;
  final String name;
  final String ownerEmail;
  final DateTime createdAt;
  final int clientCount;
  final String? description;
  final String? logoUrl;

  Organization({
    required this.id,
    required this.name,
    required this.ownerEmail,
    required this.createdAt,
    this.clientCount = 0,
    this.description,
    this.logoUrl,
  });

  factory Organization.fromJson(Map<String, dynamic> json) {
    return Organization(
      id: json['id'] ?? json['organization_id'] ?? 0,
      name: json['name'] ?? json['organization_name'] ?? 'Unnamed Organization',
      ownerEmail: json['owner_email'] ?? 'Not Available',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      clientCount: json['client_count'] ?? 0,
      description: json['description'],
      logoUrl: json['logo_url'],
    );
  }
}

class Client {
  final int id;
  final int userId;
  final String name;
  final String email;
  final DateTime joinedDate;
  final bool isActive;

  Client({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.joinedDate,
    this.isActive = true,
  });

  factory Client.fromJson(Map<String, dynamic> json) {
    return Client(
      id: json['id'] ?? json['client_id'] ?? 0,
      userId: json['user_id'] ?? 0,
      name: json['name'] ?? json['client_name'] ?? 'Unnamed Client',
      email: json['email'] ?? json['client_email'] ?? 'No Email',
      joinedDate: json['joined_date'] != null
          ? DateTime.parse(json['joined_date'])
          : DateTime.now(),
      isActive: json['is_active'] ?? true,
    );
  }
}

class Invitation {
  final int id;
  final int organizationId;
  final String clientEmail;
  final String clientName;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String status;
  final String? invitationToken;

  Invitation({
    required this.id,
    required this.organizationId,
    required this.clientEmail,
    required this.clientName,
    required this.createdAt,
    required this.expiresAt,
    required this.status,
    this.invitationToken,
  });

  factory Invitation.fromJson(Map<String, dynamic> json) {
    return Invitation(
      id: json['id'] ?? json['invitation_id'] ?? 0,
      organizationId: json['organization_id'] ?? 0,
      clientEmail: json['client_email'] ?? 'No Email',
      clientName: json['client_name'] ?? 'Unnamed Client',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'])
          : DateTime.now().add(Duration(days: 7)),
      status: json['status'] ?? 'pending',
      invitationToken: json['invitation_token'],
    );
  }

  bool get isExpired {
    return DateTime.now().isAfter(expiresAt);
  }

  bool get isPending {
    return status.toLowerCase() == 'pending';
  }
}

class UserAccount {
  final int id;
  final String name;
  final String email;
  final String accountType;
  final int? organizationId;
  final String? organizationName;
  final bool isVerified;

  UserAccount({
    required this.id,
    required this.name,
    required this.email,
    required this.accountType,
    this.organizationId,
    this.organizationName,
    this.isVerified = false,
  });

  factory UserAccount.fromJson(Map<String, dynamic> json) {
    return UserAccount(
      id: json['id'] ?? json['user_id'] ?? 0,
      name: json['name'] ?? 'User',
      email: json['email'] ?? 'No Email',
      accountType: json['account_type'] ?? 'individual',
      organizationId: json['organization_id'],
      organizationName: json['organization_name'],
      isVerified: json['is_verified'] ?? false,
    );
  }

  bool get isOrganization {
    // Only check for organization account type
    return accountType.toLowerCase() == 'organization';
  }

  bool get isClient {
    return accountType.toLowerCase() == 'client';
  }

  bool get isIndividual {
    return accountType.toLowerCase() == 'individual';
  }
}