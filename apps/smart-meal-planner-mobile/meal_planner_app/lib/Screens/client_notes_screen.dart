import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientNotesScreen extends StatefulWidget {
  final int orgId;
  final int clientId;
  final String clientName;
  final String authToken;

  const ClientNotesScreen({
    Key? key,
    required this.orgId,
    required this.clientId,
    required this.clientName,
    required this.authToken,
  }) : super(key: key);

  @override
  _ClientNotesScreenState createState() => _ClientNotesScreenState();
}

class _ClientNotesScreenState extends State<ClientNotesScreen> {
  bool _isLoading = true;
  List<dynamic> _notes = [];
  String _error = '';
  bool _showArchived = false;

  static const _typeLabels = {
    'general': 'General',
    'consultation': 'Consultation',
    'preference': 'Preference',
    'goal': 'Goal',
    'observation': 'Observation',
  };

  static const _priorityColors = {
    'low': Colors.grey,
    'normal': Colors.blue,
    'high': Colors.orange,
    'urgent': Colors.red,
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final notes = await ApiService.getClientNotes(
        orgId: widget.orgId,
        clientId: widget.clientId,
        authToken: widget.authToken,
        includeArchived: _showArchived,
      );
      setState(() => _notes = notes);
    } catch (e) {
      setState(() => _error = 'Failed to load notes: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showNoteForm({Map<String, dynamic>? existing}) {
    final titleCtrl =
        TextEditingController(text: existing?['title']?.toString() ?? '');
    final contentCtrl =
        TextEditingController(text: existing?['content']?.toString() ?? '');
    String noteType = existing?['note_type']?.toString() ?? 'general';
    String priority = existing?['priority']?.toString() ?? 'normal';
    final formKey = GlobalKey<FormState>();
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setBS) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 16,
            right: 16,
            top: 16,
          ),
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      existing == null ? 'New Note' : 'Edit Note',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Title (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: contentCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Note *',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 4,
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Note content is required'
                      : null,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: noteType,
                        decoration: const InputDecoration(
                          labelText: 'Type',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: _typeLabels.entries
                            .map((e) => DropdownMenuItem(
                                value: e.key, child: Text(e.value)))
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setBS(() => noteType = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: priority,
                        decoration: const InputDecoration(
                          labelText: 'Priority',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: const [
                          DropdownMenuItem(value: 'low', child: Text('Low')),
                          DropdownMenuItem(
                              value: 'normal', child: Text('Normal')),
                          DropdownMenuItem(value: 'high', child: Text('High')),
                          DropdownMenuItem(
                              value: 'urgent', child: Text('Urgent')),
                        ],
                        onChanged: (v) {
                          if (v != null) setBS(() => priority = v);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setBS(() => saving = true);
                          try {
                            final data = {
                              'client_id': widget.clientId,
                              'title': titleCtrl.text.trim().isEmpty
                                  ? null
                                  : titleCtrl.text.trim(),
                              'content': contentCtrl.text.trim(),
                              'note_type': noteType,
                              'priority': priority,
                              'is_private': true,
                              'tags': <String>[],
                            };
                            Map<String, dynamic> result;
                            if (existing == null) {
                              result = await ApiService.createClientNote(
                                orgId: widget.orgId,
                                data: data,
                                authToken: widget.authToken,
                              );
                            } else {
                              result = await ApiService.updateClientNote(
                                orgId: widget.orgId,
                                noteId: existing['id'] as int,
                                data: {
                                  'title': data['title'],
                                  'content': data['content'],
                                  'note_type': noteType,
                                  'priority': priority,
                                },
                                authToken: widget.authToken,
                              );
                            }
                            if (!mounted) return;
                            Navigator.pop(ctx);
                            final ok = result.containsKey('id') ||
                                result.containsKey('note_id') ||
                                result['message']
                                        ?.toString()
                                        .contains('success') ==
                                    true;
                            ScaffoldMessenger.of(context)
                                .showSnackBar(SnackBar(
                              content: Text(ok
                                  ? existing == null
                                      ? 'Note created'
                                      : 'Note updated'
                                  : result['error'] ??
                                      result['detail'] ??
                                      'Failed to save note'),
                              backgroundColor: ok ? null : Colors.red,
                            ));
                            if (ok) _load();
                          } finally {
                            if (mounted) setBS(() => saving = false);
                          }
                        },
                  style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 48)),
                  child: saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text(existing == null ? 'Create Note' : 'Save Changes'),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _archiveNote(Map<String, dynamic> note) async {
    final isArchived = note['is_archived'] == true;
    final result = await ApiService.updateClientNote(
      orgId: widget.orgId,
      noteId: note['id'] as int,
      data: {'is_archived': !isArchived},
      authToken: widget.authToken,
    );
    if (!mounted) return;
    final ok = !result.containsKey('error');
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? isArchived
              ? 'Note unarchived'
              : 'Note archived'
          : 'Failed to update note'),
      backgroundColor: ok ? null : Colors.red,
    ));
    if (ok) _load();
  }

  Future<void> _deleteNote(Map<String, dynamic> note) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Note'),
        content: Text(
            'Delete "${note['title'] ?? 'this note'}"? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    final ok = await ApiService.deleteClientNote(
      orgId: widget.orgId,
      noteId: note['id'] as int,
      authToken: widget.authToken,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok ? 'Note deleted' : 'Failed to delete note'),
      backgroundColor: ok ? null : Colors.red,
    ));
    if (ok) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.clientName}'s Notes"),
        actions: [
          IconButton(
            icon: Icon(
                _showArchived ? Icons.archive : Icons.archive_outlined),
            tooltip: _showArchived ? 'Hide archived' : 'Show archived',
            onPressed: () {
              setState(() => _showArchived = !_showArchived);
              _load();
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showNoteForm,
        tooltip: 'Add Note',
        child: const Icon(Icons.add),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_error, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _notes.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.notes_outlined,
                              size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 16),
                          Text(
                            _showArchived
                                ? 'No archived notes'
                                : 'No notes yet',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Tap + to add your first note',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _notes.length,
                        itemBuilder: (ctx, i) =>
                            _buildNoteCard(_notes[i] as Map<String, dynamic>),
                      ),
                    ),
    );
  }

  Widget _buildNoteCard(Map<String, dynamic> note) {
    final title = note['title']?.toString();
    final content = note['content']?.toString() ?? '';
    final noteType = note['note_type']?.toString() ?? 'general';
    final priority = note['priority']?.toString() ?? 'normal';
    final isArchived = note['is_archived'] == true;
    final updatedAt = note['updated_at'] != null
        ? DateTime.tryParse(note['updated_at'].toString())
        : null;

    final priorityColor =
        _priorityColors[priority] ?? Colors.blue;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: isArchived ? Colors.grey[50] : null,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (priorityColor as Color).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    priority.toUpperCase(),
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: priorityColor),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _typeLabels[noteType] ?? noteType,
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Colors.purple),
                  ),
                ),
                if (isArchived) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.archive, size: 14, color: Colors.grey[500]),
                ],
                const Spacer(),
                PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == 'edit') _showNoteForm(existing: note);
                    if (v == 'archive') _archiveNote(note);
                    if (v == 'delete') _deleteNote(note);
                  },
                  itemBuilder: (_) => [
                    const PopupMenuItem(
                        value: 'edit',
                        child: Row(children: [
                          Icon(Icons.edit_outlined, size: 18),
                          SizedBox(width: 8),
                          Text('Edit')
                        ])),
                    PopupMenuItem(
                        value: 'archive',
                        child: Row(children: [
                          Icon(
                              isArchived
                                  ? Icons.unarchive_outlined
                                  : Icons.archive_outlined,
                              size: 18),
                          const SizedBox(width: 8),
                          Text(isArchived ? 'Unarchive' : 'Archive')
                        ])),
                    const PopupMenuItem(
                        value: 'delete',
                        child: Row(children: [
                          Icon(Icons.delete_outline,
                              size: 18, color: Colors.red),
                          SizedBox(width: 8),
                          Text('Delete',
                              style: TextStyle(color: Colors.red))
                        ])),
                  ],
                  icon: const Icon(Icons.more_vert, size: 18),
                ),
              ],
            ),
            if (title != null && title.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(title,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 6),
            Text(content,
                style:
                    TextStyle(fontSize: 13, color: Colors.grey[800])),
            if (updatedAt != null) ...[
              const SizedBox(height: 8),
              Text(
                'Updated ${_formatDate(updatedAt)}',
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.month}/${d.day}/${d.year}';
}
