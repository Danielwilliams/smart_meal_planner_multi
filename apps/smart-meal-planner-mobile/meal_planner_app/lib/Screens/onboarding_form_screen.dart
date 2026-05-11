import 'package:flutter/material.dart';
import '../services/api_service.dart';

/// Renders a single onboarding form and handles submission.
/// Used by clients filling in intake forms assigned by their coach.
class OnboardingFormScreen extends StatefulWidget {
  final int orgId;
  final Map<String, dynamic> form; // full form definition from the API
  final String authToken;

  const OnboardingFormScreen({
    Key? key,
    required this.orgId,
    required this.form,
    required this.authToken,
  }) : super(key: key);

  @override
  _OnboardingFormScreenState createState() => _OnboardingFormScreenState();
}

class _OnboardingFormScreenState extends State<OnboardingFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, dynamic> _responses = {};
  bool _submitting = false;
  String _error = '';

  List<dynamic> get _fields =>
      widget.form['form_fields'] as List<dynamic>? ?? [];

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() {
      _submitting = true;
      _error = '';
    });
    try {
      final result = await ApiService.submitOrgForm(
        orgId: widget.orgId,
        formId: widget.form['id'] as int,
        responses: _responses,
        authToken: widget.authToken,
      );
      if (!mounted) return;
      if (result.containsKey('response_id') ||
          result['message']?.toString().contains('success') == true) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Form submitted successfully'),
          backgroundColor: Colors.green,
        ));
      } else {
        setState(() =>
            _error = result['detail'] ?? result['error'] ?? 'Submission failed');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.form['name']?.toString() ?? 'Intake Form'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.form['description'] != null &&
                (widget.form['description'] as String).isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  widget.form['description'] as String,
                  style: TextStyle(color: Colors.blue[900], fontSize: 13),
                ),
              ),
              const SizedBox(height: 16),
            ],
            ..._fields.map((field) => _buildField(field as Map<String, dynamic>)),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red[50],
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(_error,
                    style: TextStyle(color: Colors.red[800], fontSize: 13)),
              ),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _submitting ? null : _submit,
              style: ElevatedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48)),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Submit'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildField(Map<String, dynamic> field) {
    final id = field['id']?.toString() ?? '';
    final type = field['type']?.toString() ?? 'text';
    final label = field['label']?.toString() ?? '';
    final placeholder = field['placeholder']?.toString() ?? '';
    final required = field['required'] == true;
    final helpText = field['help_text']?.toString();
    final options =
        (field['options'] as List<dynamic>?)?.map((o) => o.toString()).toList() ??
            [];

    _responses.putIfAbsent(id, () => type == 'checkbox' ? <String>[] : null);

    Widget input;
    switch (type) {
      case 'textarea':
        input = TextFormField(
          decoration: InputDecoration(
            labelText: label,
            hintText: placeholder,
            helperText: helpText,
            border: const OutlineInputBorder(),
          ),
          maxLines: 4,
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? '$label is required' : null
              : null,
          onSaved: (v) => _responses[id] = v?.trim(),
        );
        break;

      case 'number':
        input = TextFormField(
          decoration: InputDecoration(
            labelText: label,
            hintText: placeholder,
            helperText: helpText,
            border: const OutlineInputBorder(),
          ),
          keyboardType: TextInputType.number,
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? '$label is required' : null
              : null,
          onSaved: (v) => _responses[id] = num.tryParse(v ?? '') ?? v,
        );
        break;

      case 'email':
        input = TextFormField(
          decoration: InputDecoration(
            labelText: label,
            hintText: placeholder,
            helperText: helpText,
            border: const OutlineInputBorder(),
          ),
          keyboardType: TextInputType.emailAddress,
          validator: required
              ? (v) {
                  if (v == null || v.trim().isEmpty) return '$label is required';
                  if (!RegExp(r'^[\w\.\-]+@([\w\-]+\.)+[\w]{2,}$')
                      .hasMatch(v.trim())) return 'Enter a valid email';
                  return null;
                }
              : null,
          onSaved: (v) => _responses[id] = v?.trim(),
        );
        break;

      case 'date':
        input = _DateField(
          label: label,
          helpText: helpText,
          required: required,
          onSaved: (v) => _responses[id] = v,
        );
        break;

      case 'select':
        input = DropdownButtonFormField<String>(
          decoration: InputDecoration(
            labelText: label,
            helperText: helpText,
            border: const OutlineInputBorder(),
          ),
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          validator: required
              ? (v) => v == null ? '$label is required' : null
              : null,
          onChanged: (v) => _responses[id] = v,
          onSaved: (v) => _responses[id] = v,
        );
        break;

      case 'radio':
        input = _RadioField(
          label: label,
          helpText: helpText,
          options: options,
          required: required,
          onChanged: (v) => _responses[id] = v,
          onSaved: (v) => _responses[id] = v,
        );
        break;

      case 'checkbox':
        input = _CheckboxField(
          label: label,
          helpText: helpText,
          options: options,
          required: required,
          onChanged: (v) => _responses[id] = v,
        );
        break;

      default: // 'text'
        input = TextFormField(
          decoration: InputDecoration(
            labelText: label,
            hintText: placeholder,
            helperText: helpText,
            border: const OutlineInputBorder(),
          ),
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? '$label is required' : null
              : null,
          onSaved: (v) => _responses[id] = v?.trim(),
        );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: input,
    );
  }
}

// ── Supporting field widgets ─────────────────────────────────────────────────

class _DateField extends FormField<String> {
  _DateField({
    required String label,
    String? helpText,
    required bool required,
    required FormFieldSetter<String> onSaved,
  }) : super(
          onSaved: onSaved,
          validator: required
              ? (v) => (v == null || v.isEmpty) ? '$label is required' : null
              : null,
          builder: (state) {
            return InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: state.context,
                  initialDate: DateTime.now(),
                  firstDate: DateTime(1900),
                  lastDate: DateTime(2100),
                );
                if (picked != null) {
                  state.didChange(
                      '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
                }
              },
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: label,
                  helperText: helpText,
                  border: const OutlineInputBorder(),
                  suffixIcon: const Icon(Icons.calendar_today, size: 18),
                  errorText: state.errorText,
                ),
                child: Text(
                  state.value ?? 'Select date',
                  style: TextStyle(
                      color: state.value == null ? Colors.grey[600] : null),
                ),
              ),
            );
          },
        );
}

class _RadioField extends StatefulWidget {
  final String label;
  final String? helpText;
  final List<String> options;
  final bool required;
  final ValueChanged<String?> onChanged;
  final FormFieldSetter<String> onSaved;

  const _RadioField({
    required this.label,
    this.helpText,
    required this.options,
    required this.required,
    required this.onChanged,
    required this.onSaved,
  });

  @override
  _RadioFieldState createState() => _RadioFieldState();
}

class _RadioFieldState extends State<_RadioField> {
  String? _value;

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      validator: widget.required
          ? (v) => _value == null ? '${widget.label} is required' : null
          : null,
      onSaved: (_) => widget.onSaved(_value),
      builder: (state) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          if (widget.helpText != null)
            Text(widget.helpText!,
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ...widget.options.map((opt) => RadioListTile<String>(
                title: Text(opt),
                value: opt,
                groupValue: _value,
                dense: true,
                contentPadding: EdgeInsets.zero,
                onChanged: (v) {
                  setState(() => _value = v);
                  widget.onChanged(v);
                },
              )),
          if (state.errorText != null)
            Text(state.errorText!,
                style: TextStyle(color: Colors.red[700], fontSize: 12)),
        ],
      ),
    );
  }
}

class _CheckboxField extends StatefulWidget {
  final String label;
  final String? helpText;
  final List<String> options;
  final bool required;
  final ValueChanged<List<String>> onChanged;

  const _CheckboxField({
    required this.label,
    this.helpText,
    required this.options,
    required this.required,
    required this.onChanged,
  });

  @override
  _CheckboxFieldState createState() => _CheckboxFieldState();
}

class _CheckboxFieldState extends State<_CheckboxField> {
  final Set<String> _selected = {};

  @override
  Widget build(BuildContext context) {
    return FormField<List<String>>(
      initialValue: const [],
      validator: widget.required
          ? (v) =>
              _selected.isEmpty ? 'Select at least one option for ${widget.label}' : null
          : null,
      builder: (state) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.label,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          if (widget.helpText != null)
            Text(widget.helpText!,
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ...widget.options.map((opt) => CheckboxListTile(
                title: Text(opt),
                value: _selected.contains(opt),
                dense: true,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: (checked) {
                  setState(() {
                    if (checked == true) {
                      _selected.add(opt);
                    } else {
                      _selected.remove(opt);
                    }
                  });
                  widget.onChanged(_selected.toList());
                },
              )),
          if (state.errorText != null)
            Text(state.errorText!,
                style: TextStyle(color: Colors.red[700], fontSize: 12)),
        ],
      ),
    );
  }
}
