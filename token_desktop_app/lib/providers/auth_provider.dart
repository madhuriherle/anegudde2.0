import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/token_file_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  bool _isAuthenticated = false;
  bool _isLoading = false;
  Map<String, dynamic>? _userProfile;
  String? _sessionExpiredMessage;
  String? _loginError;
  String? _connectionErrorMessage;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get userProfile => _userProfile;
  String? get sessionExpiredMessage => _sessionExpiredMessage;
  String? get loginError => _loginError;
  String? get connectionErrorMessage => _connectionErrorMessage;

  AuthProvider() {
    ApiService.onUnauthorized = _handleUnauthorized;
  }

  void _handleUnauthorized() {
    _sessionExpiredMessage = 'Session expired. Please login again.';
    _isAuthenticated = false;
    _userProfile = null;
    _apiService.logout();
    _clearCachedProfile();
    notifyListeners();
  }

  void clearSessionMessage() {
    _sessionExpiredMessage = null;
    notifyListeners();
  }

  void clearConnectionError() {
    _connectionErrorMessage = null;
    notifyListeners();
  }

  Future<void> checkAuth() async {
    _isLoading = true;
    _connectionErrorMessage = null;
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
          if (_userProfile != null) {
            await _cacheProfile(_userProfile!);
          }
        } on NetworkException catch (e) {
          // Server is down - stay logged in using cached profile so the
          // app works offline. Don't force the user back to login.
          _connectionErrorMessage = e.message;
          _userProfile ??= await _getCachedProfile();
          _isAuthenticated = _userProfile != null;
          print('Server unreachable on startup, keeping offline session');
        } catch (e) {
          // Non-network error - try cached profile before giving up
          _userProfile ??= await _getCachedProfile();
          _isAuthenticated = _userProfile != null;
          if (!_isAuthenticated) {
            await logout();
          }
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
      if (_userProfile != null) {
        await _cacheProfile(_userProfile!);
      }
      notifyListeners();
    } on NetworkException catch (e) {
      print('Fetch Profile Error: $e');
      _connectionErrorMessage = e.message;
    } catch (e) {
      print('Fetch Profile Error: $e');
    }
  }

  Future<void> _cacheProfile(Map<String, dynamic> profile) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cached_profile', json.encode(profile));
  }

  Future<Map<String, dynamic>?> _getCachedProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('cached_profile');
      if (raw == null) return null;
      final decoded = json.decode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (e) {
      print('Error reading cached profile: $e');
    }
    return null;
  }

  Future<void> _clearCachedProfile() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cached_profile');
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _loginError = null;
    _connectionErrorMessage = null;
    notifyListeners();

    final success = await _apiService.login(username, password);
    if (success) {
      _sessionExpiredMessage = null;
      _isAuthenticated = true;
      await fetchProfile();
      await syncSettings();
    } else {
      _loginError = _apiService.lastLoginError ?? 'Login failed. Please try again.';
    }

    _isLoading = false;
    notifyListeners();
    return success;
  }

  Future<void> syncSettings() async {
    try {
      final settings = await _apiService.get('/settings/get_current_settings');
      // Fall back to effective_token_file_path (where mpd.txt actually lands
      // when no folder is explicitly configured) so this never shows a stale
      // cached value that doesn't match reality.
      final path = settings?['token_file_path'] ?? settings?['effective_token_file_path'];
      if (path != null) {
        await TokenFileService.saveOutputFolder(path);
      }
    } catch (e) {
      print('Sync Settings Error: $e');
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
    _isAuthenticated = false;
    _userProfile = null;
    await _clearCachedProfile();
    notifyListeners();
  }
}
