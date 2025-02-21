import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class CompareScreen extends StatefulWidget {
  final int userId;
  final List<String> ingredients;

  CompareScreen({
    required this.userId,
    required this.ingredients,
  });

  @override
  _CompareScreenState createState() => _CompareScreenState();
}

class _CompareScreenState extends State<CompareScreen> {
  // Example store options
  final List<String> allStores = ["Kroger", "Walmart", "Sprouts", "Albertsons"];
  List<String> selectedStores = [];

  // Results
  List<dynamic> comparisonData = []; // will hold "comparison" from the API
  bool isLoading = false;

  Future<void> _comparePrices() async {
    if (selectedStores.isEmpty || widget.ingredients.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Select stores and have at least one ingredient."))
      );
      return;
    }

    setState(() => isLoading = true);

    final url = Uri.parse("http://127.0.0.1:8000/cart/compare");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "user_id": widget.userId,
        "stores": selectedStores,
        "ingredients": widget.ingredients
      }),
    );

    setState(() => isLoading = false);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      setState(() {
        comparisonData = data["comparison"] ?? [];
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Error fetching comparison."))
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Compare Prices"),
      ),
      body: isLoading
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Step 1: Let user pick which stores to compare
                Expanded(
                  flex: 1,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: allStores.length,
                    itemBuilder: (context, index) {
                      final store = allStores[index];
                      final isSelected = selectedStores.contains(store);
                      return Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: FilterChip(
                          label: Text(store),
                          selected: isSelected,
                          onSelected: (val) {
                            setState(() {
                              if (val) {
                                selectedStores.add(store);
                              } else {
                                selectedStores.remove(store);
                              }
                            });
                          },
                        ),
                      );
                    },
                  ),
                ),

                ElevatedButton(
                  onPressed: _comparePrices,
                  child: Text("Compare Prices"),
                ),

                // Step 2: Display comparison results
                Expanded(
                  flex: 5,
                  child: ListView.builder(
                    itemCount: comparisonData.length,
                    itemBuilder: (context, index) {
                      final item = comparisonData[index];
                      final ingredient = item["ingredient"];
                      final options = item["options"] as List<dynamic>;

                      return Card(
                        margin: EdgeInsets.all(8),
                        child: Padding(
                          padding: const EdgeInsets.all(8.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ingredient.toUpperCase(),
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              SizedBox(height: 8),
                              Column(
                                children: options.map((opt) {
                                  final storeName = opt["store_name"];
                                  final price = opt["price"];
                                  final imageUrl = opt["image_url"];
                                  return ListTile(
                                    leading: imageUrl != null
                                      ? Image.network(imageUrl, width: 50, height: 50)
                                      : Icon(Icons.store),
                                    title: Text("$storeName - \$${price.toStringAsFixed(2)}"),
                                  );
                                }).toList(),
                              )
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Step 3: A button to proceed to selecting which store for each item
                if (comparisonData.isNotEmpty)
                  ElevatedButton(
                    child: Text("Select Store Options"),
                    onPressed: () {
                      // Navigate to the finalize screen, passing the entire comparisonData
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => FinalizeMultiStoreScreen(
                            userId: widget.userId,
                            comparisonData: comparisonData,
                          ),
                        ),
                      );
                    },
                  )
              ],
            ),
    );
  }
}

// We'll define the FinalizeMultiStoreScreen below
class FinalizeMultiStoreScreen extends StatefulWidget {
  final int userId;
  final List<dynamic> comparisonData;

  FinalizeMultiStoreScreen({
    required this.userId,
    required this.comparisonData,
  });

  @override
  _FinalizeMultiStoreScreenState createState() => _FinalizeMultiStoreScreenState();
}
