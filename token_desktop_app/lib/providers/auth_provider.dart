import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  bool _isAuthenticated = false;
  bool _isLoading = false;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;

  Future<void> checkAuth() async {
    final token = await _apiService.token;
    _isAuthenticated = token != null;
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    notifyListeners();

    final success = await _apiService.login(username, password);
    if (success) {
      _isAuthenticated = true;
    }
    
    _isLoading = false;
    notifyListeners();
    return success;
  }

  Future<void> logout() async {
    await _apiService.logout();
    _isAuthenticated = false;
    notifyListeners();
  }
}
