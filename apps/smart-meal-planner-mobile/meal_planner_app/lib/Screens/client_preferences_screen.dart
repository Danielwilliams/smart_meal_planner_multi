import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientPreferencesScreen extends StatefulWidget {
  final int clientId;
  final String clientName;
  final int userId;
  final String authToken;

  ClientPreferencesScreen({
    required this.clientId,
    required this.clientName,
    required this.userId,
    required this.authToken,
  });

  @override
  _ClientPreferencesScreenState createState() => _ClientPreferencesScreenState();
}

class _ClientPreferencesScreenState extends State<ClientPreferencesScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _preferences = {};
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadClientPreferences();
  }

  Future<void> _loadClientPreferences() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getClientPreferences(
        widget.clientId,
        widget.authToken,
      );

      if (result.containsKey('preferences') && result['preferences'] != null) {
        setState(() {
          _preferences = result['preferences'] is Map 
              ? Map<String, dynamic>.from(result['preferences'])
              : {};
        });
      } else if (result.containsKey('error')) {
        setState(() {
          _errorMessage = result['error'] ?? 'Failed to load preferences';
        });
      } else {
        setState(() {
          _preferences = {};
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
        title: Text("${widget.clientName}'s Preferences"),
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
                        onPressed: _loadClientPreferences,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _preferences.isEmpty
                  ? _buildEmptyState()
                  : _buildPreferencesView(),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.settings_outlined, size: 64, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            "No Preferences Set",
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            "${widget.clientName} hasn't set any preferences yet",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[700]),
          ),
          SizedBox(height: 24),
          ElevatedButton.icon(
            icon: Icon(Icons.refresh),
            label: Text('Refresh'),
            onPressed: _loadClientPreferences,
          ),
        ],
      ),
    );
  }

  Widget _buildPreferencesView() {
    List<Widget> preferenceWidgets = [];
    
    // Display dietary restrictions
    if (_preferences.containsKey('dietary_restrictions') && 
        _preferences['dietary_restrictions'] is List &&
        (_preferences['dietary_restrictions'] as List).isNotEmpty) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Dietary Restrictions",
          Icon(Icons.no_food, color: Colors.red),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: (_preferences['dietary_restrictions'] as List)
                    .map((restriction) => Chip(
                          label: Text(restriction.toString()),
                          backgroundColor: Colors.red[100],
                        ))
                    .toList(),
              ),
            ],
          ),
        ),
      );
    }
    
    // Display calorie goals
    if (_preferences.containsKey('calorie_target') && 
        _preferences['calorie_target'] != null) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Calorie Goals",
          Icon(Icons.monitor_weight, color: Colors.blue),
          Text(
            "${_preferences['calorie_target']} calories per day",
            style: TextStyle(fontSize: 16),
          ),
        ),
      );
    }
    
    // Display macro goals
    if (_preferences.containsKey('macros') && 
        _preferences['macros'] is Map &&
        (_preferences['macros'] as Map).isNotEmpty) {
      
      final macros = _preferences['macros'] as Map;
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Macro Targets",
          Icon(Icons.pie_chart, color: Colors.green),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (macros.containsKey('protein'))
                _buildMacroRow("Protein", macros['protein'], Colors.red),
              if (macros.containsKey('carbs') || macros.containsKey('carbohydrates'))
                _buildMacroRow("Carbs", macros['carbs'] ?? macros['carbohydrates'], Colors.blue),
              if (macros.containsKey('fat'))
                _buildMacroRow("Fat", macros['fat'], Colors.yellow[700]!),
            ],
          ),
        ),
      );
    }
    
    // Display cuisine preferences
    if (_preferences.containsKey('cuisine_preferences') && 
        _preferences['cuisine_preferences'] is List &&
        (_preferences['cuisine_preferences'] as List).isNotEmpty) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Cuisine Preferences",
          Icon(Icons.restaurant, color: Colors.orange),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: (_preferences['cuisine_preferences'] as List)
                .map((cuisine) => Chip(
                      label: Text(cuisine.toString()),
                      backgroundColor: Colors.orange[100],
                    ))
                .toList(),
          ),
        ),
      );
    }
    
    // Display allergies
    if (_preferences.containsKey('allergies') && 
        _preferences['allergies'] is List &&
        (_preferences['allergies'] as List).isNotEmpty) {
      
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Allergies",
          Icon(Icons.dangerous, color: Colors.red),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: (_preferences['allergies'] as List)
                .map((allergy) => Chip(
                      label: Text(allergy.toString()),
                      backgroundColor: Colors.red[100],
                    ))
                .toList(),
          ),
        ),
      );
    }
    
    // Display other preferences
    List<Widget> otherPreferences = [];
    _preferences.forEach((key, value) {
      // Skip already displayed preferences
      if (['dietary_restrictions', 'calorie_target', 'macros', 
          'cuisine_preferences', 'allergies'].contains(key)) {
        return;
      }
      
      // Skip empty lists or maps
      if ((value is List && value.isEmpty) || 
          (value is Map && value.isEmpty)) {
        return;
      }
      
      // Format key name
      final formattedKey = key
          .split('_')
          .map((word) => word.isNotEmpty 
              ? word[0].toUpperCase() + word.substring(1) 
              : '')
          .join(' ');
      
      // Format value based on type
      String formattedValue;
      if (value is List) {
        formattedValue = value.join(', ');
      } else if (value is Map) {
        formattedValue = value.entries
            .map((e) => "${e.key}: ${e.value}")
            .join(', ');
      } else {
        formattedValue = value.toString();
      }
      
      otherPreferences.add(
        ListTile(
          title: Text(formattedKey),
          subtitle: Text(formattedValue),
        ),
      );
    });
    
    if (otherPreferences.isNotEmpty) {
      preferenceWidgets.add(
        _buildPreferenceSection(
          "Other Preferences",
          Icon(Icons.more_horiz, color: Colors.purple),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: otherPreferences,
          ),
        ),
      );
    }
    
    // If no preferences were added, show message
    if (preferenceWidgets.isEmpty) {
      return _buildEmptyState();
    }
    
    return ListView(
      padding: EdgeInsets.all(16),
      children: preferenceWidgets,
    );
  }

  Widget _buildPreferenceSection(String title, Icon icon, Widget content) {
    return Card(
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                icon,
                SizedBox(width: 8),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            Divider(),
            SizedBox(height: 8),
            content,
          ],
        ),
      ),
    );
  }
  
  Widget _buildMacroRow(String label, dynamic value, Color color) {
    double percentage = 0;
    
    try {
      if (value is int) {
        percentage = value / 100;
      } else if (value is double) {
        percentage = value;
      } else if (value is String) {
        // Try to parse as a number
        percentage = double.tryParse(value) ?? 0;
        // If it's a percentage string, convert to decimal
        if (value.contains('%')) {
          percentage = percentage / 100;
        }
      }
    } catch (e) {
      print("Error parsing macro value: $e");
    }
    
    // Ensure percentage is in decimal form (0-1)
    if (percentage > 1) {
      percentage = percentage / 100;
    }
    
    // Limit to 0-1 range
    percentage = percentage.clamp(0.0, 1.0);
    
    // Display as percentage
    final displayPercentage = (percentage * 100).toStringAsFixed(0);
    
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SizedBox(
                width: 80,
                child: Text(
                  label,
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              Text("$displayPercentage%"),
            ],
          ),
          SizedBox(height: 4),
          LinearProgressIndicator(
            value: percentage,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      ),
    );
  }
}