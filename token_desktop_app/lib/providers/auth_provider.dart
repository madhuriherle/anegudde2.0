import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/token_file_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  bool _isAuthenticated = false;
  bool _isLoading = false;
  Map<String, dynamic>? _userProfile;
  String? _sessionExpiredMessage;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get userProfile => _userProfile;
  String? get sessionExpiredMessage => _sessionExpiredMessage;

  AuthProvider() {
    ApiService.onUnauthorized = _handleUnauthorized;
  }

  void _handleUnauthorized() {
    _sessionExpiredMessage = 'Session expired. Please login again.';
    _isAuthenticated = false;
    _userProfile = null;
    _apiService.logout();
    notifyListeners();
  }

  void clearSessionMessage() {
    _sessionExpiredMessage = null;
    notifyListeners();
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    final token = await _apiService.token;
    if (token != null) {
      final sameDay = await _apiService.isSameDay();
      if (!sameDay) {
        _sessionExpiredMessage =
            'Session expired for the day. Please login again.';
        await logout();
      } else {
        try {
          await fetchProfile();
          await syncSettings();
          _isAuthenticated = _userProfile != null;
        } catch (e) {
          _isAuthenticated = false;
          await logout();
        }
      }
    } else {
      _isAuthenticated = false;
    }

    _isLoading = false;
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
      _sessionExpiredMessage = null;
      _isAuthenticated = true;
      await fetchProfile();
      await syncSettings();
    }

    _isLoading = false;
    notifyListeners();
    return success;
  }

  Future<void> syncSettings() async {
    try {
      final settings = await _apiService.get('/settings/get_current_settings');
      if (settings != null && settings['token_file_path'] != null) {
        await TokenFileService.saveOutputFolder(settings['token_file_path']);
      }
    } catch (e) {
      print('Sync Settings Error: $e');
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
    _isAuthenticated = false;
    _userProfile = null;
    notifyListeners();
  }
}
