import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  bool _isAuthenticated = false;
  bool _isLoading = false;
  Map<String, dynamic>? _userProfile;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get userProfile => _userProfile;

  Future<void> checkAuth() async {
    final token = await _apiService.token;
    _isAuthenticated = token != null;
    if (_isAuthenticated) {
      await fetchProfile();
    }
    notifyListeners();
  }

  Future<void> fetchProfile() async {
    try {
      _userProfile = await _apiService.get('/auth/get_current_user_profile');
      notifyListeners();
    } catch (e) {
      print('Fetch Profile Error: $e');
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();

    final success = await _apiService.login(username, password);
    if (success) {
      _isAuthenticated = true;
      await fetchProfile();
    }
    
    _isLoading = false;
    notifyListeners();
    return success;
  }

  Future<void> logout() async {
    await _apiService.logout();
    _isAuthenticated = false;
    _userProfile = null;
    notifyListeners();
  }
}
