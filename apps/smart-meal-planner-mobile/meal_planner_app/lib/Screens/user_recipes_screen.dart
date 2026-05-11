import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'user_recipe_form_screen.dart';

class UserRecipesScreen extends StatefulWidget {
  final int userId;
  final String authToken;

  const UserRecipesScreen({Key? key, required this.userId, required this.authToken})
      : super(key: key);

  @override
  _UserRecipesScreenState createState() => _UserRecipesScreenState();
}

class _UserRecipesScreenState extends State<UserRecipesScreen> {
  bool _isLoading = true;
  List<dynamic> _recipes = [];
  String _error = '';

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
      final list = await ApiService.getUserRecipes(widget.authToken);
      setState(() => _recipes = list);
    } catch (e) {
      setState(() => _error = 'Failed to load recipes: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _openForm({Map<String, dynamic>? recipe}) async {
    // For edit mode we need the full recipe (with ingredients + steps).
    Map<String, dynamic>? fullRecipe = recipe;
    if (recipe != null && recipe['ingredients'] == null) {
      fullRecipe = await ApiService.getUserRecipe(recipe['id'] as int, widget.authToken);
    }

    if (!mounted) return;
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => UserRecipeFormScreen(
          userId: widget.userId,
          authToken: widget.authToken,
          existingRecipe: fullRecipe,
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _confirmDelete(Map<String, dynamic> recipe) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete Recipe'),
        content: Text('Delete "${recipe['title']}"? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final ok = await ApiService.deleteUserRecipe(recipe['id'] as int, widget.authToken);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok ? 'Recipe deleted' : 'Failed to delete recipe'),
      backgroundColor: ok ? null : Colors.red,
    ));
    if (ok) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('My Recipes')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openForm(),
        tooltip: 'Create Recipe',
        child: Icon(Icons.add),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.red),
                      SizedBox(height: 16),
                      Text(_error, textAlign: TextAlign.center),
                      SizedBox(height: 16),
                      ElevatedButton(onPressed: _load, child: Text('Retry')),
                    ],
                  ),
                )
              : _recipes.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _recipes.length,
                        itemBuilder: (ctx, i) => _buildRecipeCard(_recipes[i] as Map<String, dynamic>),
                      ),
                    ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.menu_book_outlined, size: 72, color: Colors.grey[400]),
          SizedBox(height: 16),
          Text(
            'No recipes yet',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Tap + to create your first recipe',
            style: TextStyle(color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildRecipeCard(Map<String, dynamic> recipe) {
    final dietTags = recipe['diet_tags'] is List
        ? (recipe['diet_tags'] as List).cast<String>()
        : <String>[];
    final totalTime = recipe['total_time'];
    final servings = recipe['servings'];
    final cuisine = recipe['cuisine']?.toString();
    final difficulty = recipe['complexity']?.toString();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    recipe['title']?.toString() ?? '',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.edit_outlined, size: 20),
                  onPressed: () => _openForm(recipe: recipe),
                  tooltip: 'Edit',
                  padding: EdgeInsets.zero,
                  constraints: BoxConstraints(),
                ),
                SizedBox(width: 8),
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 20, color: Colors.red[400]),
                  onPressed: () => _confirmDelete(recipe),
                  tooltip: 'Delete',
                  padding: EdgeInsets.zero,
                  constraints: BoxConstraints(),
                ),
              ],
            ),
            if (recipe['description'] != null &&
                (recipe['description'] as String).isNotEmpty) ...[
              SizedBox(height: 4),
              Text(
                recipe['description'] as String,
                style: TextStyle(color: Colors.grey[700], fontSize: 13),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                if (cuisine != null)
                  _infoChip(Icons.restaurant, cuisine),
                if (difficulty != null)
                  _infoChip(Icons.bar_chart, difficulty),
                if (totalTime != null)
                  _infoChip(Icons.timer_outlined, '$totalTime min'),
                if (servings != null)
                  _infoChip(Icons.people_outline, '$servings servings'),
                ...dietTags.map((t) => Chip(
                      label: Text(t, style: TextStyle(fontSize: 11)),
                      backgroundColor: Colors.green[100],
                      padding: EdgeInsets.zero,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoChip(IconData icon, String label) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[700]),
          SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[800])),
        ],
      ),
    );
  }
}
