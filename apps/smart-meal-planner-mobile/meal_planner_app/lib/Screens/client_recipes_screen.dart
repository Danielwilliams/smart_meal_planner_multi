import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientRecipesScreen extends StatefulWidget {
  final int clientId;
  final String clientName;
  final int userId;
  final String authToken;

  ClientRecipesScreen({
    required this.clientId,
    required this.clientName,
    required this.userId,
    required this.authToken,
  });

  @override
  _ClientRecipesScreenState createState() => _ClientRecipesScreenState();
}

class _ClientRecipesScreenState extends State<ClientRecipesScreen> {
  bool _isLoading = true;
  List<dynamic> _recipes = [];
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadClientRecipes();
  }

  Future<void> _loadClientRecipes() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getClientSavedRecipes(
        widget.clientId,
        widget.authToken,
      );

      if (result.containsKey('recipes') && result['recipes'] is List) {
        setState(() {
          _recipes = result['recipes'];
        });
      } else if (result.containsKey('error')) {
        setState(() {
          _errorMessage = result['error'] ?? 'Failed to load recipes';
        });
      } else {
        setState(() {
          _errorMessage = 'No recipes found';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("${widget.clientName}'s Recipes"),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _errorMessage.isNotEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48, color: Colors.red),
                      SizedBox(height: 16),
                      Text(
                        _errorMessage,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 16),
                      ),
                      SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: _loadClientRecipes,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _recipes.isEmpty
                  ? _buildEmptyState()
                  : _buildRecipeList(),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.book_outlined, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "No Saved Recipes",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "${widget.clientName} hasn't saved any recipes yet",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.refresh),
            label: Text('Refresh'),
            onPressed: _loadClientRecipes,
          ),
        ],
      ),
    );
  }

  Widget _buildRecipeList() {
    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: _recipes.length,
      itemBuilder: (context, index) {
        final recipe = _recipes[index];
        final title = recipe['title'] ?? recipe['name'] ?? 'Untitled Recipe';
        final description = recipe['description'] ?? 'No description available';
        final imageUrl = recipe['image_url'] ?? recipe['image'] ?? '';
        
        return Card(
          margin: EdgeInsets.only(bottom: 16),
          clipBehavior: Clip.antiAlias,
          elevation: 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (imageUrl.isNotEmpty)
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        color: Colors.grey[300],
                        child: Center(
                          child: Icon(
                            Icons.broken_image,
                            color: Colors.grey[500],
                            size: 36,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.grey[700],
                      ),
                    ),
                    SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        if (recipe['cuisine'] != null)
                          Chip(
                            label: Text(recipe['cuisine']),
                            backgroundColor: Colors.blue[100],
                          ),
                        if (recipe['category'] != null)
                          Chip(
                            label: Text(recipe['category']),
                            backgroundColor: Colors.green[100],
                          ),
                        Spacer(),
                        ElevatedButton(
                          onPressed: () {
                            // Navigate to recipe details or use it to create menu
                            _showRecipeOptionsDialog(recipe);
                          },
                          child: Text('Use Recipe'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showRecipeOptionsDialog(dynamic recipe) {
    final recipeId = recipe['id'] ?? 0;
    final recipeTitle = recipe['title'] ?? recipe['name'] ?? 'Untitled Recipe';
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Recipe Options"),
        content: Text("What would you like to do with '$recipeTitle'?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pushNamed(
                context, 
                '/create-client-menu',
                arguments: {
                  'clientId': widget.clientId,
                  'clientName': widget.clientName,
                  'userId': widget.userId,
                  'authToken': widget.authToken,
                  'recipeId': recipeId,
                  'recipeTitle': recipeTitle,
                },
              );
            },
            child: Text("Create Menu with Recipe"),
          ),
        ],
      ),
    );
  }
}