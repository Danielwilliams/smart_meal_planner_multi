import 'package:flutter/material.dart';
import '../models/user_management_model.dart';
import '../services/organization_client_service.dart';
import '../services/api_service.dart';
import '../components/subscription_route_wrapper.dart';

class OrganizationClientsScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  OrganizationClientsScreen({
    required this.userId,
    required this.authToken,
  });

  @override
  _OrganizationClientsScreenState createState() =>
      _OrganizationClientsScreenState();
}

class _OrganizationClientsScreenState
    extends State<OrganizationClientsScreen> {
  bool _isLoading = true;
  List<ClientUser> _clients = [];
  String? _errorMessage;
  int? _orgId;

  @override
  void initState() {
    super.initState();
    _loadClients();
  }

  Future<void> _loadClients() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      // Fetch org ID once (needed for invitations)
      _orgId ??= await ApiService.getUserOrganizationId(widget.authToken);

      final clients = await OrganizationClientService.getOrganizationClients(
          widget.authToken);
      setState(() {
        _clients = clients;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error loading clients: $e';
      });
    }
  }

  // ── Invite by email ─────────────────────────────────────────────────────

  void _showInviteDialog() {
    final emailCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool sending = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (dialogCtx, setDS) => AlertDialog(
          title: Text('Invite Client'),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: emailCtrl,
              decoration: InputDecoration(
                labelText: 'Client email',
                prefixIcon: Icon(Icons.email_outlined),
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.emailAddress,
              autofocus: true,
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Email is required';
                if (!RegExp(r'^[\w\.\-]+@([\w\-]+\.)+[\w]{2,}$')
                    .hasMatch(v.trim())) return 'Enter a valid email';
                return null;
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: sending ? null : () => Navigator.pop(dialogCtx),
              child: Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: sending
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      if (_orgId == null) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(
                              'Could not determine organization. Please retry.'),
                          backgroundColor: Colors.red,
                        ));
                        return;
                      }
                      setDS(() => sending = true);
                      try {
                        final result = await ApiService.inviteClient(
                          orgId: _orgId!,
                          email: emailCtrl.text.trim(),
                          authToken: widget.authToken,
                        );
                        if (!mounted) return;
                        Navigator.pop(dialogCtx);
                        final ok = result.containsKey('invitation_id') ||
                            result['message']
                                    ?.toString()
                                    .toLowerCase()
                                    .contains('sent') ==
                                true ||
                            result['message']
                                    ?.toString()
                                    .toLowerCase()
                                    .contains('invitation') ==
                                true;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(ok
                              ? 'Invitation sent to ${emailCtrl.text.trim()}'
                              : result['detail'] ??
                                  result['error'] ??
                                  result['message'] ??
                                  'Failed to send invitation'),
                          backgroundColor: ok ? Colors.green : Colors.red,
                        ));
                        if (ok) _loadClients();
                      } finally {
                        if (mounted) setDS(() => sending = false);
                      }
                    },
              child: sending
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text('Send Invitation'),
            ),
          ],
        ),
      ),
    );
  }

  // ── Manual add (kept as secondary option) ───────────────────────────────

  void _showAddClientDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool saving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (dialogCtx, setDS) => AlertDialog(
          title: Text('Add Client Manually'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  decoration: InputDecoration(
                      labelText: 'Name', border: OutlineInputBorder()),
                  textCapitalization: TextCapitalization.words,
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                SizedBox(height: 10),
                TextFormField(
                  controller: emailCtrl,
                  decoration: InputDecoration(
                      labelText: 'Email', border: OutlineInputBorder()),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                SizedBox(height: 10),
                TextFormField(
                  controller: passCtrl,
                  decoration: InputDecoration(
                      labelText: 'Password', border: OutlineInputBorder()),
                  obscureText: true,
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: saving ? null : () => Navigator.pop(dialogCtx),
                child: Text('Cancel')),
            ElevatedButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setDS(() => saving = true);
                      try {
                        final result =
                            await OrganizationClientService.addOrganizationClient(
                          widget.authToken,
                          nameCtrl.text.trim(),
                          emailCtrl.text.trim(),
                          passCtrl.text.trim(),
                        );
                        if (!mounted) return;
                        Navigator.pop(dialogCtx);
                        final ok = result['success'] == true;
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(ok
                              ? 'Client added successfully'
                              : result['error'] ?? 'Failed to add client'),
                          backgroundColor: ok ? null : Colors.red,
                        ));
                        if (ok) _loadClients();
                      } finally {
                        if (mounted) setDS(() => saving = false);
                      }
                    },
              child: saving
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text('Add Client'),
            ),
          ],
        ),
      ),
    );
  }

  // ── Remove ───────────────────────────────────────────────────────────────

  Future<void> _removeClient(ClientUser client) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove Client'),
        content: Text('Remove ${client.name} from your organization?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text('Cancel')),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Remove'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      final result = await OrganizationClientService.removeOrganizationClient(
          widget.authToken, client.id);
      if (!mounted) return;
      final ok = result['success'] == true;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok ? 'Client removed' : result['error'] ?? 'Failed'),
        backgroundColor: ok ? null : Colors.red,
      ));
      if (ok) _loadClients();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  // ── Client action sheet ──────────────────────────────────────────────────

  void _showClientActions(ClientUser client) {
    showModalBottomSheet(
      context: context,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                client.name,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
            Divider(height: 1),
            ListTile(
              leading: Icon(Icons.notes_outlined),
              title: Text('Notes'),
              onTap: () {
                Navigator.pop(ctx);
                if (_orgId != null) {
                  Navigator.pushNamed(context, '/client-notes', arguments: {
                    'orgId': _orgId!,
                    'clientId': client.id,
                    'clientName': client.name,
                    'authToken': widget.authToken,
                  });
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                      content: Text('Organization ID not available')));
                }
              },
            ),
            ListTile(
              leading: Icon(Icons.settings_outlined),
              title: Text('Preferences'),
              onTap: () {
                Navigator.pop(ctx);
                Navigator.pushNamed(context, '/client-preferences',
                    arguments: {
                      'clientId': client.id,
                      'clientName': client.name,
                      'userId': widget.userId,
                      'authToken': widget.authToken,
                    });
              },
            ),
            ListTile(
              leading: Icon(Icons.restaurant_menu),
              title: Text('Meal Plans'),
              onTap: () {
                Navigator.pop(ctx);
                Navigator.pushNamed(context, '/client-menus', arguments: {
                  'clientId': client.id,
                  'clientName': client.name,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                });
              },
            ),
            ListTile(
              leading: Icon(Icons.book_outlined),
              title: Text('Saved Recipes'),
              onTap: () {
                Navigator.pop(ctx);
                Navigator.pushNamed(context, '/client-recipes', arguments: {
                  'clientId': client.id,
                  'clientName': client.name,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                });
              },
            ),
            ListTile(
              leading: Icon(Icons.delete_outline, color: Colors.red),
              title:
                  Text('Remove Client', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(ctx);
                _removeClient(client);
              },
            ),
            SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ── Status chip ─────────────────────────────────────────────────────────

  Widget _statusChip(String status) {
    final Map<String, _ChipStyle> styles = {
      'active': _ChipStyle(Colors.green[100]!, Colors.green[800]!, 'Active'),
      'inactive': _ChipStyle(Colors.grey[200]!, Colors.grey[700]!, 'Inactive'),
      'pending': _ChipStyle(Colors.amber[100]!, Colors.amber[800]!, 'Pending'),
    };
    final style = styles[status] ?? styles['active']!;
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(style.label,
          style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: style.fg)),
    );
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return SubscriptionRouteWrapper(
      child: Scaffold(
        appBar: AppBar(
          title: Text('Clients'),
          actions: [
            IconButton(
              icon: Icon(Icons.person_add_outlined),
              tooltip: 'Invite Client',
              onPressed: _showInviteDialog,
            ),
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'add_manual') _showAddClientDialog();
                if (v == 'refresh') _loadClients();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                    value: 'add_manual',
                    child: Row(children: [
                      Icon(Icons.person_add, size: 18),
                      SizedBox(width: 8),
                      Text('Add manually')
                    ])),
                PopupMenuItem(
                    value: 'refresh',
                    child: Row(children: [
                      Icon(Icons.refresh, size: 18),
                      SizedBox(width: 8),
                      Text('Refresh')
                    ])),
              ],
            ),
          ],
        ),
        body: _isLoading
            ? Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.error_outline, size: 48, color: Colors.red),
                        SizedBox(height: 16),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        SizedBox(height: 16),
                        ElevatedButton(
                            onPressed: _loadClients, child: Text('Retry')),
                      ],
                    ),
                  )
                : _clients.isEmpty
                    ? _buildEmptyState()
                    : RefreshIndicator(
                        onRefresh: _loadClients,
                        child: ListView.builder(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          itemCount: _clients.length,
                          itemBuilder: (ctx, i) => _buildClientTile(_clients[i]),
                        ),
                      ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline, size: 72, color: Colors.grey[400]),
          SizedBox(height: 16),
          Text('No clients yet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text('Invite clients by tapping the + icon above',
              style: TextStyle(color: Colors.grey[600])),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.person_add_outlined),
            label: Text('Invite Client'),
            onPressed: _showInviteDialog,
          ),
        ],
      ),
    );
  }

  Widget _buildClientTile(ClientUser client) {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Theme.of(context).primaryColor.withOpacity(0.15),
          child: Text(
            client.name.isNotEmpty ? client.name[0].toUpperCase() : '?',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).primaryColor),
          ),
        ),
        title: Text(client.name,
            style: TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(client.email,
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            SizedBox(height: 4),
            _statusChip(client.status),
          ],
        ),
        isThreeLine: true,
        trailing: Icon(Icons.chevron_right, color: Colors.grey),
        onTap: () => _showClientActions(client),
      ),
    );
  }
}

class _ChipStyle {
  final Color bg, fg;
  final String label;
  const _ChipStyle(this.bg, this.fg, this.label);
}
