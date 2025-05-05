import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _errorMsg;
  bool _isLoading = false;

  Future<void> _login() async {
    if (_emailController.text.trim().isEmpty || _passwordController.text.trim().isEmpty) {
      setState(() => _errorMsg = "Please enter both email and password");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    final bool success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    setState(() => _isLoading = false);

    if (success) {
      // Navigate to menu screen after successful login
      Navigator.pushReplacementNamed(context, '/menu');
    } else {
      setState(() => _errorMsg = "Invalid credentials");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Login")),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_errorMsg != null) 
                    Container(
                      margin: EdgeInsets.only(bottom: 16),
                      padding: EdgeInsets.all(8),
                      color: Colors.red[100],
                      child: Text(_errorMsg!, style: TextStyle(color: Colors.red[900]))
                    ),
                  TextField(
                    controller: _emailController, 
                    decoration: InputDecoration(
                      labelText: "Email",
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  SizedBox(height: 16),
                  TextField(
                    controller: _passwordController, 
                    decoration: InputDecoration(
                      labelText: "Password",
                      border: OutlineInputBorder(),
                    ), 
                    obscureText: true,
                  ),
                  SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _login, 
                    child: Text("Login"),
                    style: ElevatedButton.styleFrom(
                      padding: EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                  SizedBox(height: 16),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/forgot-password'),
                    child: Text("Forgot Password?"),
                  ),
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