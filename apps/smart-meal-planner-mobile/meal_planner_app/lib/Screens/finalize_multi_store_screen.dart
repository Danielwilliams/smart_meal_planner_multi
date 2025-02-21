class _FinalizeMultiStoreScreenState extends State<FinalizeMultiStoreScreen> {
  // We'll store the user's chosen store for each ingredient
  // e.g. { "milk": { "store_name": "Walmart", "price": 1.89, "product_id": "WMT456" }, ... }
  Map<String, Map<String, dynamic>> userChoices = {};

  bool isLoading = false;
  String? message;

  @override
  void initState() {
    super.initState();
    // Initialize userChoices
    // for each item in comparisonData -> item["ingredient"] -> the user hasn't chosen a store yet
    for (var item in widget.comparisonData) {
      final ingr = item["ingredient"];
      userChoices[ingr] = {};
    }
  }

  Future<void> _finalizeCart() async {
    // Build the list of items for POST /cart/finalize
    // userChoices is a map: { ingredient -> { store_name, price, product_id } }
    List<Map<String, dynamic>> finalItems = [];
    for (var ingr in userChoices.keys) {
      var choice = userChoices[ingr];
      if (choice == null || choice["store_name"] == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Please select a store for $ingr"))
        );
        return;
      }
      finalItems.add({
        "ingredient": ingr,
        "store_name": choice["store_name"],
        "product_id": choice["product_id"],
        "price": choice["price"]
      });
    }

    setState(() => isLoading = true);

    final url = Uri.parse("http://127.0.0.1:8000/cart/finalize");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "user_id": widget.userId,
        "items": finalItems
      }),
    );

    setState(() => isLoading = false);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      setState(() {
        message = "Order placed successfully: ${data["orders"]}";
      });
    } else {
      setState(() {
        message = "Error finalizing cart: ${response.statusCode}";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Finalize Your Choices"),
      ),
      body: isLoading
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (message != null)
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(message!, style: TextStyle(color: Colors.green)),
                  ),
                Expanded(
                  child: ListView.builder(
                    itemCount: widget.comparisonData.length,
                    itemBuilder: (context, index) {
                      final item = widget.comparisonData[index];
                      final ingr = item["ingredient"];
                      final options = item["options"] as List<dynamic>;

                      return Card(
                        margin: EdgeInsets.all(8),
                        child: Padding(
                          padding: EdgeInsets.all(8.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                ingr.toUpperCase(),
                                style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold),
                              ),
                              Column(
                                children: options.map((opt) {
                                  final store = opt["store_name"];
                                  final price = opt["price"];
                                  final selected =
                                      (userChoices[ingr]?["store_name"] == store);
                                  return RadioListTile<bool>(
                                    title: Text("$store - \$${price.toStringAsFixed(2)}"),
                                    value: true,
                                    groupValue: selected,
                                    onChanged: (val) {
                                      // user is picking this store
                                      setState(() {
                                        userChoices[ingr] = {
                                          "store_name": store,
                                          "price": price,
                                          "product_id": opt["product_id"]
                                        };
                                      });
                                    },
                                    selected: selected,
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
                ElevatedButton(
                  onPressed: _finalizeCart,
                  child: Text("Finalize"),
                ),
                SizedBox(height: 16)
              ],
            ),
    );
  }
}
