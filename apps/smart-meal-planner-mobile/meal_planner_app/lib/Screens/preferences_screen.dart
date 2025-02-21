import 'package:flutter/material.dart';
import '../services/api_service.dart';

class PreferencesScreen extends StatefulWidget {
  final int userId;      // You can also store this in a global or provider
  final String authToken;  // If needed to authenticate the request

  PreferencesScreen({required this.userId, required this.authToken});

  @override
  _PreferencesScreenState createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  // Example dietary restrictions
  List<String> allRestrictions = ["Gluten-free", "Low-carb", "Low-fat", "Dairy-free"];
  List<String> selectedRestrictions = [];

  // Disliked ingredients
  List<String> allIngredients = ["Onion", "Shrimp", "Eggplant", "Peanuts", "Tomato"];
  List<String> dislikedIngredients = [];

  // Diet types
  List<String> dietTypes = ["Mediterranean", "Vegetarian", "Vegan", "Pescatarian", "Keto"];
  String? selectedDietType;

  Future<void> _savePreferences() async {
    if (selectedDietType == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Please select a diet type."))
      );
      return;
    }

    final result = await ApiService.updatePreferences(
      userId: widget.userId,
      authToken: widget.authToken,
      dietaryRestrictions: selectedRestrictions,
      dislikedIngredients: dislikedIngredients,
      dietType: selectedDietType!,
    );

    if (result != null && result["message"] == "Preferences updated successfully.") {
      // success
      Navigator.pushReplacementNamed(context, '/menu');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error saving preferences."))
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Dietary Preferences")),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text("Select Dietary Restrictions:", style: TextStyle(fontWeight: FontWeight.bold)),
            ...allRestrictions.map((r) {
              final isSelected = selectedRestrictions.contains(r);
              return CheckboxListTile(
                title: Text(r),
                value: isSelected,
                onChanged: (bool? value) {
                  setState(() {
                    if (value == true) {
                      selectedRestrictions.add(r);
                    } else {
                      selectedRestrictions.remove(r);
                    }
                  });
                },
              );
            }).toList(),
            Divider(),
            Text("Disliked Ingredients:", style: TextStyle(fontWeight: FontWeight.bold)),
            ...allIngredients.map((ing) {
              final isSelected = dislikedIngredients.contains(ing);
              return CheckboxListTile(
                title: Text(ing),
                value: isSelected,
                onChanged: (bool? value) {
                  setState(() {
                    if (value == true) {
                      dislikedIngredients.add(ing);
                    } else {
                      dislikedIngredients.remove(ing);
                    }
                  });
                },
              );
            }).toList(),
            Divider(),
            Text("Choose a Diet Type:", style: TextStyle(fontWeight: FontWeight.bold)),
            ...dietTypes.map((dt) {
              return RadioListTile<String>(
                title: Text(dt),
                value: dt,
                groupValue: selectedDietType,
                onChanged: (value) {
                  setState(() => selectedDietType = value);
                },
              );
            }).toList(),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _savePreferences,
              child: Text("Save Preferences"),
            )
          ],
        ),
      ),
    );
  }
}
