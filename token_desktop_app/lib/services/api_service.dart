import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const _kNetworkErrorMessage =
    'Could not reach the server. Please check the server address in Settings and your network connection.';

/// Thrown when a request fails because the server couldn't be reached at all
/// (timeout, DNS/connection failure) - as opposed to the server responding
/// with an error status. Lets callers show a "check your connection" message
/// instead of a generic failure.
class NetworkException implements Exception {
  final String message;
  const NetworkException(this.message);

  @override
  String toString() => message;
}

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

  Future<String?> get loginDate async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('login_date');
  }

  Future<bool> isSameDay() async {
    final stored = await loginDate;
    if (stored == null) return false;
    return stored == DateFormat('yyyy-MM-dd').format(DateTime.now());
  }

  Future<Map<String, String>> _headers() async {
    final t = await token;
    return {
      'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  String? _lastLoginError;
  String? get lastLoginError => _lastLoginError;

  Future<bool> login(String username, String password) async {
    _lastLoginError = null;
    try {
      print('Attempting login to: $_baseUrl/auth/login');
      final response = await http
          .post(
            _buildUri('/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'username': username.trim(),
              'password': password.trim(),
              'client_type': 'desktop',
            }),
          )
          .timeout(const Duration(seconds: 10));

      print('Login Response Status: ${response.statusCode}');
      if (response.statusCode != 200) {
        print('Login Response Body: ${response.body}');
      }

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', data['access_token']);
        await prefs.setString(
            'login_date', DateFormat('yyyy-MM-dd').format(DateTime.now()));
        return true;
      }

      if (response.statusCode == 401) {
        _lastLoginError = 'Invalid username or password.';
      } else {
        try {
          final body = json.decode(response.body);
          _lastLoginError =
              body is Map && body['detail'] != null ? body['detail'].toString() : null;
        } catch (_) {
          // Response body wasn't JSON; fall through to the generic message below.
        }
        _lastLoginError ??= 'Login failed (server error ${response.statusCode}).';
      }
      return false;
    } on TimeoutException catch (e) {
      print('Login Exception: $e');
      _lastLoginError = _kNetworkErrorMessage;
      return false;
    } on SocketException catch (e) {
      print('Login Exception: $e');
      _lastLoginError = _kNetworkErrorMessage;
      return false;
    } catch (e) {
      print('Login Exception: $e');
      _lastLoginError = _kNetworkErrorMessage;
      return false;
    }
  }

  Future<void> logout() async {
    try {
      print('Attempting logout call to backend...');
      await http
          .post(
            _buildUri('/auth/logout'),
            headers: await _headers(),
          )
          .timeout(const Duration(seconds: 10));
    } catch (e) {
      print('Logout API call failed: $e');
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('login_date');
  }

  Future<dynamic> get(String endpoint) async {
    final response = await _sendWithTimeout(
      () async => http.get(_buildUri(endpoint), headers: await _headers()),
    );
    return _handleResponse(response);
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final response = await _sendWithTimeout(
      () async => http.post(
        _buildUri(endpoint),
        headers: await _headers(),
        body: json.encode(body),
      ),
    );
    return _handleResponse(response);
  }

  Future<dynamic> put(String endpoint, Map<String, dynamic> body) async {
    final response = await _sendWithTimeout(
      () async => http.put(
        _buildUri(endpoint),
        headers: await _headers(),
        body: json.encode(body),
      ),
    );
    return _handleResponse(response);
  }

  /// Runs [request] with a bounded timeout, normalizing any connectivity
  /// failure (timeout, DNS/connection error) into a [NetworkException] so
  /// callers can tell "server unreachable" apart from "server said no".
  Future<http.Response> _sendWithTimeout(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request().timeout(const Duration(seconds: 10));
    } on TimeoutException {
      throw const NetworkException(_kNetworkErrorMessage);
    } on SocketException {
      throw const NetworkException(_kNetworkErrorMessage);
    } on http.ClientException {
      throw const NetworkException(_kNetworkErrorMessage);
    }
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else if (response.statusCode == 401) {
      onUnauthorized?.call();
      throw Exception('Unauthorized');
    } else {
      print('API Error Status: ${response.statusCode}');
      String? detail;
      try {
        final body = json.decode(response.body);
        if (body is Map && body['detail'] != null) {
          detail = body['detail'].toString();
        }
      } catch (_) {
        // Response body wasn't JSON; fall through to the generic message below.
      }
      throw Exception(detail ?? 'API Error: ${response.statusCode}');
    }
  }
}
