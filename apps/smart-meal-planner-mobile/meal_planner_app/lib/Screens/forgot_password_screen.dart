import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  @override
  _ForgotPasswordScreenState createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  String? _message;
  bool _isLoading = false;

  Future<void> _submitEmail() async {
    setState(() => _isLoading = true);

    final result = await ApiService.forgotPassword(_emailController.text.trim());
    setState(() => _isLoading = false);

    if (result != null && result["message"] != null) {
      setState(() => _message = result["message"]);
    } else {
      setState(() => _message = "An error occurred. Please try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Forgot Password")),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: _isLoading 
          ? Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_message != null)
                  Text(_message!, style: TextStyle(color: Colors.blue)),
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(labelText: "Enter your email"),
                ),
                SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _submitEmail,
                  child: Text("Submit"),
                ),
              ],
            ),
      ),
    );
  }
}
