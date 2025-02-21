import 'package:flutter/material.dart';
// If you need GPS, import 'package:geolocator/geolocator.dart';

class LocationScreen extends StatefulWidget {
  @override
  _LocationScreenState createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  final _zipController = TextEditingController();
  String? _gpsStatus;
  bool _useGps = false;

  Future<void> _getGPSLocation() async {
    // Example with geolocator
    // final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    // setState(() => _gpsStatus = "Lat: ${position.latitude}, Lng: ${position.longitude}");
    // ... then call an API to store or fetch store data
    setState(() => _gpsStatus = "Mock GPS lat=40.0, lng=-74.0");
  }

  void _submitLocation() {
    // If user typed a ZIP:
    final zip = _zipController.text.trim();
    if (zip.isEmpty && !_useGps) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Please provide a ZIP or enable GPS."))
      );
      return;
    }

    if (_useGps && _gpsStatus == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("GPS not fetched yet."))
      );
      return;
    }

    // Save location data to backend or navigate to store screen
    Navigator.pushReplacementNamed(context, '/storeSelection');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Location")),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            CheckboxListTile(
              title: Text("Use GPS"),
              value: _useGps,
              onChanged: (val) {
                setState(() => _useGps = val ?? false);
                if (_useGps) _getGPSLocation();
              },
            ),
            if (_gpsStatus != null)
              Text("GPS status: $_gpsStatus"),
            SizedBox(height: 20),
            Text("Or enter ZIP code"),
            TextField(
              controller: _zipController,
              decoration: InputDecoration(labelText: "ZIP code"),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: _submitLocation,
              child: Text("Continue"),
            )
          ],
        ),
      ),
    );
  }
}
