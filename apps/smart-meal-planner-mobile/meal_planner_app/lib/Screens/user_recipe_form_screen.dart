import 'package:flutter/material.dart';
import '../services/api_service.dart';

class UserRecipeFormScreen extends StatefulWidget {
  final int userId;
  final String authToken;
  final Map<String, dynamic>? existingRecipe; // null = create mode

  const UserRecipeFormScreen({
    Key? key,
    required this.userId,
    required this.authToken,
    this.existingRecipe,
  }) : super(key: key);

  @override
  _UserRecipeFormScreenState createState() => _UserRecipeFormScreenState();
}

class _UserRecipeFormScreenState extends State<UserRecipeFormScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isSaving = false;

  // Basic info
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _totalTimeController = TextEditingController();
  final _servingsController = TextEditingController();
  String? _selectedCuisine;
  String? _selectedDifficulty;
  List<String> _selectedDietTags = [];

  // Ingredients: each entry is {name, amount, unit}
  List<Map<String, TextEditingController>> _ingredientControllers = [];

  // Steps: each entry holds the instruction controller
  List<TextEditingController> _stepControllers = [];

  static const _cuisines = [
    'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian',
    'Thai', 'French', 'Mediterranean', 'Greek', 'Spanish', 'Korean',
    'Vietnamese', 'German', 'Caribbean', 'Other',
  ];
  static const _difficulties = ['Easy', 'Medium', 'Hard'];
  static const _dietTagOptions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo',
    'Low-Carb', 'High-Protein', 'Low-Fat', 'Nut-Free', 'Soy-Free',
  ];
  static const _units = [
    'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l',
    'piece', 'pieces', 'clove', 'cloves', 'slice', 'slices', 'can', 'cans',
    'bunch', 'head', 'large', 'medium', 'small', 'package',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _addIngredientRow();
    _addStepRow();

    final r = widget.existingRecipe;
    if (r != null) {
      _titleController.text = r['title']?.toString() ?? '';
      _descriptionController.text = r['description']?.toString() ?? '';
      _totalTimeController.text = r['total_time']?.toString() ?? '';
      _servingsController.text = r['servings']?.toString() ?? '';
      _selectedCuisine = _cuisines.contains(r['cuisine']) ? r['cuisine'] : null;
      _selectedDifficulty =
          _difficulties.contains(r['complexity']) ? r['complexity'] : null;

      if (r['diet_tags'] is List) {
        _selectedDietTags = List<String>.from(r['diet_tags'] as List);
      }

      if (r['ingredients'] is List && (r['ingredients'] as List).isNotEmpty) {
        _ingredientControllers.clear();
        for (final ing in r['ingredients'] as List) {
          _ingredientControllers.add({
            'name': TextEditingController(text: ing['name']?.toString() ?? ''),
            'amount': TextEditingController(text: ing['amount']?.toString() ?? ''),
            'unit': TextEditingController(text: ing['unit']?.toString() ?? ''),
          });
        }
      }

      if (r['steps'] is List && (r['steps'] as List).isNotEmpty) {
        _stepControllers.clear();
        final sorted = List.from(r['steps'] as List)
          ..sort((a, b) => (a['step_number'] ?? 0).compareTo(b['step_number'] ?? 0));
        for (final step in sorted) {
          _stepControllers.add(
            TextEditingController(text: step['instruction']?.toString() ?? ''),
          );
        }
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    _descriptionController.dispose();
    _totalTimeController.dispose();
    _servingsController.dispose();
    for (final row in _ingredientControllers) {
      row['name']!.dispose();
      row['amount']!.dispose();
      row['unit']!.dispose();
    }
    for (final ctrl in _stepControllers) {
      ctrl.dispose();
    }
    super.dispose();
  }

  void _addIngredientRow() {
    _ingredientControllers.add({
      'name': TextEditingController(),
      'amount': TextEditingController(),
      'unit': TextEditingController(),
    });
  }

  void _removeIngredientRow(int index) {
    if (_ingredientControllers.length <= 1) return;
    final row = _ingredientControllers.removeAt(index);
    row['name']!.dispose();
    row['amount']!.dispose();
    row['unit']!.dispose();
  }

  void _addStepRow() {
    _stepControllers.add(TextEditingController());
  }

  void _removeStepRow(int index) {
    if (_stepControllers.length <= 1) return;
    _stepControllers.removeAt(index).dispose();
  }

  Future<void> _save() async {
    if (_titleController.text.trim().isEmpty) {
      _tabController.animateTo(0);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Recipe title is required'), backgroundColor: Colors.red),
      );
      return;
    }

    final validIngredients = _ingredientControllers
        .where((r) => r['name']!.text.trim().isNotEmpty)
        .toList();
    if (validIngredients.isEmpty) {
      _tabController.animateTo(1);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('At least one ingredient is required'), backgroundColor: Colors.red),
      );
      return;
    }

    final validSteps = _stepControllers
        .where((c) => c.text.trim().isNotEmpty)
        .toList();
    if (validSteps.isEmpty) {
      _tabController.animateTo(2);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('At least one instruction step is required'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final payload = {
        'title': _titleController.text.trim(),
        'description': _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
        'cuisine': _selectedCuisine,
        'complexity': _selectedDifficulty,
        'total_time': int.tryParse(_totalTimeController.text.trim()),
        'servings': int.tryParse(_servingsController.text.trim()),
        'diet_tags': _selectedDietTags,
        'custom_tags': [],
        'is_public': false,
        'ingredients': validIngredients.asMap().entries.map((e) => {
          'name': e.value['name']!.text.trim(),
          'amount': e.value['amount']!.text.trim().isEmpty ? null : e.value['amount']!.text.trim(),
          'unit': e.value['unit']!.text.trim().isEmpty ? null : e.value['unit']!.text.trim(),
          'sort_order': e.key + 1,
          'is_optional': false,
        }).toList(),
        'steps': validSteps.asMap().entries.map((e) => {
          'step_number': e.key + 1,
          'instruction': e.value.text.trim(),
        }).toList(),
      };

      Map<String, dynamic> result;
      final existing = widget.existingRecipe;
      if (existing != null) {
        result = await ApiService.updateUserRecipe(
          existing['id'] as int, payload, widget.authToken);
      } else {
        result = await ApiService.createUserRecipe(payload, widget.authToken);
      }

      if (!mounted) return;

      if (result.containsKey('error')) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save: ${result['error'] ?? result['detail'] ?? 'Unknown error'}'),
            backgroundColor: Colors.red,
          ),
        );
      } else {
        Navigator.pop(context, true); // signal refresh
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existingRecipe != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Recipe' : 'New Recipe'),
        actions: [
          _isSaving
              ? Padding(
                  padding: const EdgeInsets.all(12),
                  child: SizedBox(
                    width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  ),
                )
              : IconButton(
                  icon: Icon(Icons.check),
                  tooltip: 'Save',
                  onPressed: _save,
                ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.info_outline), text: 'Info'),
            Tab(icon: Icon(Icons.list_alt), text: 'Ingredients'),
            Tab(icon: Icon(Icons.format_list_numbered), text: 'Steps'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildInfoTab(),
          _buildIngredientsTab(),
          _buildStepsTab(),
        ],
      ),
    );
  }

  Widget _buildInfoTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _titleController,
            decoration: InputDecoration(
              labelText: 'Recipe Title *',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.words,
          ),
          SizedBox(height: 16),
          TextField(
            controller: _descriptionController,
            decoration: InputDecoration(
              labelText: 'Description',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedCuisine,
                  decoration: InputDecoration(
                    labelText: 'Cuisine',
                    border: OutlineInputBorder(),
                  ),
                  items: _cuisines
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCuisine = v),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedDifficulty,
                  decoration: InputDecoration(
                    labelText: 'Difficulty',
                    border: OutlineInputBorder(),
                  ),
                  items: _difficulties
                      .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedDifficulty = v),
                ),
              ),
            ],
          ),
          SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _totalTimeController,
                  decoration: InputDecoration(
                    labelText: 'Total Time',
                    border: OutlineInputBorder(),
                    suffixText: 'min',
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _servingsController,
                  decoration: InputDecoration(
                    labelText: 'Servings',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          SizedBox(height: 20),
          Text('Diet Tags', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _dietTagOptions.map((tag) {
              final selected = _selectedDietTags.contains(tag);
              return FilterChip(
                label: Text(tag),
                selected: selected,
                selectedColor: Colors.green[200],
                onSelected: (v) => setState(() {
                  if (v) {
                    _selectedDietTags.add(tag);
                  } else {
                    _selectedDietTags.remove(tag);
                  }
                }),
              );
            }).toList(),
          ),
          SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildIngredientsTab() {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: _ingredientControllers.length,
            itemBuilder: (context, index) {
              final row = _ingredientControllers[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      flex: 4,
                      child: TextField(
                        controller: row['name'],
                        decoration: InputDecoration(
                          labelText: 'Ingredient',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        textCapitalization: TextCapitalization.sentences,
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: row['amount'],
                        decoration: InputDecoration(
                          labelText: 'Amount',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: Autocomplete<String>(
                        initialValue: TextEditingValue(text: row['unit']!.text),
                        optionsBuilder: (v) => _units.where(
                          (u) => u.toLowerCase().startsWith(v.text.toLowerCase()),
                        ),
                        fieldViewBuilder: (ctx, ctrl, focusNode, _) {
                          // Keep the outer controller in sync
                          ctrl.text = row['unit']!.text;
                          return TextField(
                            controller: ctrl,
                            focusNode: focusNode,
                            decoration: InputDecoration(
                              labelText: 'Unit',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            onChanged: (v) => row['unit']!.text = v,
                          );
                        },
                        onSelected: (v) => setState(() => row['unit']!.text = v),
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.remove_circle_outline, color: Colors.red[400]),
                      onPressed: _ingredientControllers.length > 1
                          ? () => setState(() => _removeIngredientRow(index))
                          : null,
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton.icon(
            icon: Icon(Icons.add),
            label: Text('Add Ingredient'),
            onPressed: () => setState(() => _addIngredientRow()),
            style: ElevatedButton.styleFrom(minimumSize: Size(double.infinity, 44)),
          ),
        ),
      ],
    );
  }

  Widget _buildStepsTab() {
    return Column(
      children: [
        Expanded(
          child: ReorderableListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: _stepControllers.length,
            onReorder: (oldIndex, newIndex) {
              setState(() {
                if (newIndex > oldIndex) newIndex--;
                final ctrl = _stepControllers.removeAt(oldIndex);
                _stepControllers.insert(newIndex, ctrl);
              });
            },
            itemBuilder: (context, index) {
              return Padding(
                key: ValueKey('step_$index'),
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 12, right: 8),
                      child: CircleAvatar(
                        radius: 14,
                        backgroundColor: Colors.blue[100],
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.blue[800],
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _stepControllers[index],
                        decoration: InputDecoration(
                          labelText: 'Step ${index + 1}',
                          border: OutlineInputBorder(),
                        ),
                        maxLines: 3,
                        minLines: 2,
                        textCapitalization: TextCapitalization.sentences,
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.remove_circle_outline, color: Colors.red[400]),
                      onPressed: _stepControllers.length > 1
                          ? () => setState(() => _removeStepRow(index))
                          : null,
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton.icon(
            icon: Icon(Icons.add),
            label: Text('Add Step'),
            onPressed: () => setState(() => _addStepRow()),
            style: ElevatedButton.styleFrom(minimumSize: Size(double.infinity, 44)),
          ),
        ),
      ],
    );
  }
}
