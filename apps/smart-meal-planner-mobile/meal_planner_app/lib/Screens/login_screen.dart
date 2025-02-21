import 'package:flutter/material.dart';
import '../services/api_service.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _errorMsg;

  Future<void> _login() async {
    final result = await ApiService.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );
    if (result != null && result["access_token"] != null) {
      // Navigate to preferences or menu
      Navigator.pushReplacementNamed(context, '/menu');
    } else {
      setState(() => _errorMsg = "Invalid credentials");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Login")),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            if (_errorMsg != null) Text(_errorMsg!, style: TextStyle(color: Colors.red)),
            TextField(controller: _emailController, decoration: InputDecoration(labelText: "Email")),
            TextField(controller: _passwordController, decoration: InputDecoration(labelText: "Password"), obscureText: true),
            SizedBox(height: 20),
            ElevatedButton(onPressed: _login, child: Text("Login")),
            TextButton(
              onPressed: () => Navigator.pushNamed(context, '/signup'),
              child: Text("Don't have an account? Sign Up"),
            )
          ],
        ),
      ),
    );
  }
}
