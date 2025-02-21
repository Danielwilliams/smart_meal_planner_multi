import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String token;  // This might come from a deep link or route param

  ResetPasswordScreen({required this.token});

  @override
  _ResetPasswordScreenState createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _newPasswordController = TextEditingController();
  String? _message;
  bool _isLoading = false;

  Future<void> _resetPassword() async {
    setState(() => _isLoading = true);

    final result = await ApiService.resetPassword(
      widget.token,
      _newPasswordController.text.trim(),
    );

    setState(() => _isLoading = false);

    if (result != null && result["message"] == "Password has been reset successfully.") {
      setState(() => _message = "Password reset successful. Please login with your new password.");
    } else {
      setState(() => _message = "Error resetting password.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Reset Password")),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_message != null)
                  Text(_message!, style: TextStyle(color: Colors.blue)),
                TextField(
                  controller: _newPasswordController,
                  decoration: InputDecoration(labelText: "New Password"),
                  obscureText: true,
                ),
                SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _resetPassword,
                  child: Text("Reset Password"),
                )
              ],
            ),
      ),
    );
  }
}
