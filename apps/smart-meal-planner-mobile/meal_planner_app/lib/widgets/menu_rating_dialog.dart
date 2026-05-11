import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';

/// Shows a dialog to rate a generated meal plan.
/// [menuId] — the menu to rate.
/// [menuTitle] — displayed in the header.
/// [authToken] — bearer token.
/// [onSubmitted] — called after a successful submission.
Future<void> showMenuRatingDialog({
  required BuildContext context,
  required int menuId,
  required String menuTitle,
  required String authToken,
  VoidCallback? onSubmitted,
}) {
  return showDialog(
    context: context,
    builder: (_) => _MenuRatingDialog(
      menuId: menuId,
      menuTitle: menuTitle,
      authToken: authToken,
      onSubmitted: onSubmitted,
    ),
  );
}

class _MenuRatingDialog extends StatefulWidget {
  final int menuId;
  final String menuTitle;
  final String authToken;
  final VoidCallback? onSubmitted;

  const _MenuRatingDialog({
    required this.menuId,
    required this.menuTitle,
    required this.authToken,
    this.onSubmitted,
  });

  @override
  _MenuRatingDialogState createState() => _MenuRatingDialogState();
}

class _MenuRatingDialogState extends State<_MenuRatingDialog> {
  int _overallRating = 0;
  int _varietyScore = 0;
  int _nutritionBalance = 0;
  int _practicality = 0;
  String _feedbackText = '';
  bool _isLoading = false;
  String _error = '';

  Future<void> _submit() async {
    if (_overallRating == 0) {
      setState(() => _error = 'Please give an overall rating');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final result = await ApiService.rateMenu(
        authToken: widget.authToken,
        menuId: widget.menuId,
        overallRating: _overallRating,
        varietyScore: _varietyScore > 0 ? _varietyScore : null,
        nutritionBalance: _nutritionBalance > 0 ? _nutritionBalance : null,
        practicality: _practicality > 0 ? _practicality : null,
        feedbackText: _feedbackText.trim().isNotEmpty ? _feedbackText.trim() : null,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        widget.onSubmitted?.call();
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Menu rated — thanks!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        setState(() => _error = result['detail'] ?? result['error'] ?? 'Failed to submit rating');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rate This Meal Plan',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            widget.menuTitle,
                            style: TextStyle(fontSize: 13, color: Colors.white70),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(),
                    ),
                  ],
                ),
              ),

              // Body
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _sectionTitle('Overall *'),
                      _starRow(_overallRating, 30, (v) => setState(() => _overallRating = v)),
                      SizedBox(height: 20),
                      _sectionTitle('Variety (optional)'),
                      _starRow(_varietyScore, 24, (v) => setState(() => _varietyScore = v)),
                      SizedBox(height: 16),
                      _sectionTitle('Nutrition Balance (optional)'),
                      _starRow(_nutritionBalance, 24, (v) => setState(() => _nutritionBalance = v)),
                      SizedBox(height: 16),
                      _sectionTitle('Practicality (optional)'),
                      _starRow(_practicality, 24, (v) => setState(() => _practicality = v)),
                      SizedBox(height: 20),
                      _sectionTitle('Comments (optional)'),
                      SizedBox(height: 8),
                      TextFormField(
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'What did you think of this plan?',
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (v) => _feedbackText = v,
                      ),
                      if (_error.isNotEmpty) ...[
                        SizedBox(height: 12),
                        Container(
                          padding: EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.red[50],
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(_error,
                              style: TextStyle(color: Colors.red[800], fontSize: 13)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // Actions
              Container(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: Colors.grey[300]!)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: _isLoading ? null : () => Navigator.pop(context),
                        child: Text('Cancel'),
                      ),
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _overallRating > 0 && !_isLoading ? _submit : null,
                        child: _isLoading
                            ? SizedBox(
                                width: 18, height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : Text('Submit'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
        text,
        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
            color: Theme.of(context).primaryColor),
      );

  Widget _starRow(int current, double size, void Function(int) onTap) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            onTap(i + 1);
          },
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: size < 28 ? 2.0 : 3.0),
            child: Icon(
              i < current ? Icons.star : Icons.star_border,
              color: Colors.amber,
              size: size,
            ),
          ),
        );
      }),
    );
  }
}
