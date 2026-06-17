import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static void Function()? onUnauthorized;

  String _baseUrl = 'http://187.127.173.27/api';

  String get baseUrl => _baseUrl;

  String _normalizeBaseUrl(String url) {
    return url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  Uri _buildUri(String endpoint) {
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    return Uri.parse('$_baseUrl$cleanEndpoint');
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = _normalizeBaseUrl(
      prefs.getString('api_base_url') ?? 'http://187.127.173.27/api',
    );
    print('ApiService initialized with baseUrl: $_baseUrl');
  }

  Future<void> updateBaseUrl(String newUrl) async {
    _baseUrl = _normalizeBaseUrl(newUrl);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('api_base_url', _baseUrl);
  }

  /// Auto-detect the correct base URL by trying /api first,
  /// then without (for servers without a reverse proxy prefix).
  /// Returns the detected full base URL, or null if unreachable.
  Future<String?> detectBaseUrl(String input) async {
    var url = input.trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://$url';
    }
    url = _normalizeBaseUrl(url);

    // Try with /api first (reverse proxy – most common for deployed servers)
    try {
      final apiUrl = '$url/api';
      final response = await http
          .post(
            Uri.parse('$apiUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 422 ||
          (response.statusCode >= 200 && response.statusCode < 300)) {
        return apiUrl;
      }
    } catch (_) {}

    // Try direct (no /api – local dev)
    try {
      final response = await http
          .post(
            Uri.parse('$url/auth/login'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 422 ||
          (response.statusCode >= 200 && response.statusCode < 300)) {
        return url;
      }
    } catch (_) {}

    return null;
  }

  /// Real TCP ping — checks if the server is reachable at host:port.
  /// Supports input formats: "host:port", "http://host:port", "http://host:port/path"
  Future<bool> ping(String input) async {
    try {
      final hostPort = _parseHostPort(input);
      if (hostPort == null) return false;
      final socket = await Socket.connect(
        hostPort.$1,
        hostPort.$2,
        timeout: const Duration(seconds: 5),
      );
      await socket.close();
      print('Ping OK: ${hostPort.$1}:${hostPort.$2}');
      return true;
    } catch (e) {
      print('Ping failed: $e');
      return false;
    }
  }

  /// Extract (host, port) from various input formats.
  /// Port defaults to 80 if not specified.
  (String, int)? _parseHostPort(String input) {
    var s = input.trim();
    if (s.isEmpty) return null;

    // Strip scheme
    if (s.startsWith('https://')) s = s.substring(8);
    if (s.startsWith('http://')) s = s.substring(7);

    // Strip path
    final pathIdx = s.indexOf('/');
    if (pathIdx >= 0) s = s.substring(0, pathIdx);

    // Split host:port
    final parts = s.split(':');
    if (parts.length == 2) {
      final port = int.tryParse(parts[1]);
      if (port == null || port < 1 || port > 65535) return null;
      return (parts[0], port);
    }
    return (parts[0], 80);
  }

  Future<String?> get token async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<Map<String, String>> _headers() async {
    final t = await token;
    return {
      'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  Future<bool> login(String username, String password) async {
    try {
      print('Attempting login to: $_baseUrl/auth/login');
      final response = await http.post(
        _buildUri('/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'username': username.trim(),
          'password': password.trim(),
        }),
      );

      print('Login Response Status: ${response.statusCode}');
      if (response.statusCode != 200) {
        print('Login Response Body: ${response.body}');
      }

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', data['access_token']);
        return true;
      }
      return false;
    } catch (e) {
      print('Login Exception: $e');
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
  }

  Future<dynamic> get(String endpoint) async {
    final response = await http.get(
      _buildUri(endpoint),
      headers: await _headers(),
    );
    return _handleResponse(response);
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final response = await http.post(
      _buildUri(endpoint),
      headers: await _headers(),
      body: json.encode(body),
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(String endpoint, Map<String, dynamic> body) async {
    final response = await http.put(
      _buildUri(endpoint),
      headers: await _headers(),
      body: json.encode(body),
    );
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else if (response.statusCode == 401) {
      onUnauthorized?.call();
      throw Exception('Unauthorized');
    } else {
      print('API Error Status: ${response.statusCode}');
      throw Exception('API Error: ${response.statusCode}');
    }
  }
}
