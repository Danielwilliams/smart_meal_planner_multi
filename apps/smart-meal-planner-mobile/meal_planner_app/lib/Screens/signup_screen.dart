import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../Providers/auth_providers.dart';

class SignUpScreen extends StatefulWidget {
  @override
  _SignUpScreenState createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  String _name = "";
  String _email = "";
  String _password = "";
  bool _isLoading = false;
  String? _errorMsg;

  Future<void> _submit() async {
    // Validate form fields
    if (!_formKey.currentState!.validate()) {
      return; // Validation failed
    }
    // Save field values
    _formKey.currentState!.save();

    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    // Access AuthProvider
    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.signUp(_name, _email, _password);

    setState(() => _isLoading = false);

    if (success) {
      // Navigate to preferences or main menu
      Navigator.pushReplacementNamed(context, '/preferences');
    } else {
      setState(() => _errorMsg = "Sign-up failed. Try a different email.");
    }
  }

  String? _validateName(String? value) {
    if (value == null || value.isEmpty) {
      return "Name is required.";
    }
    return null;
  }

  String? _validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return "Email is required.";
    }
    // Basic email regex check
    final emailRegex = RegExp(r"^[^@]+@[^@]+\.[^@]+");
    if (!emailRegex.hasMatch(value)) {
      return "Enter a valid email.";
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return "Password is required.";
    }
    if (value.length < 6) {
      return "Password must be at least 6 characters.";
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Sign Up"),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey, // identify the form
                child: Column(
                  children: [
                    if (_errorMsg != null)
                      Text(_errorMsg!, style: TextStyle(color: Colors.red)),
                    TextFormField(
                      decoration: InputDecoration(labelText: "Name"),
                      validator: _validateName,
                      onSaved: (val) => _name = val!.trim(),
                    ),
                    TextFormField(
                      decoration: InputDecoration(labelText: "Email"),
                      validator: _validateEmail,
                      onSaved: (val) => _email = val!.trim(),
                    ),
                    TextFormField(
                      decoration: InputDecoration(labelText: "Password"),
                      obscureText: true,
                      validator: _validatePassword,
                      onSaved: (val) => _password = val!.trim(),
                    ),
                    SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _submit,
                      child: Text("Sign Up"),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
                      child: Text("Already have an account? Login"),
                    )
                  ],
                ),
              ),
            ),
    );
  }
}
