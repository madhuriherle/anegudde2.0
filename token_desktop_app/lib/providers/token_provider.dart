import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/token_file_service.dart';

class TokenProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final TokenFileService _tokenFileService = const TokenFileService();
  int _dailyTotal = 0;
  int _totalReceipts = 0;
  bool _isLoading = false;
  DateTime _selectedDate = DateTime.now();
  String? _fileWriteError;
  String? _fetchError;
  String? _issueTokenError;

  int get dailyTotal => _dailyTotal;
  int get totalReceipts => _totalReceipts;
  bool get isLoading => _isLoading;
  DateTime get selectedDate => _selectedDate;
  String? get fileWriteError => _fileWriteError;
  String? get fetchError => _fetchError;
  String? get issueTokenError => _issueTokenError;

  void _syncSelectedDateWithToday() {
    final now = DateTime.now();
    if (_selectedDate.year != now.year ||
        _selectedDate.month != now.month ||
        _selectedDate.day != now.day) {
      _selectedDate = now;
    }
  }

  void setDate(DateTime date) {
    _selectedDate = date;
    fetchDailyTotal();
  }

  /// [silent] skips toggling the shared isLoading flag - used when this
  /// runs as a background refresh piggy-backing on another action (e.g.
  /// right after issueTokens()) so it doesn't re-lock the UI that action
  /// already unlocked.
  Future<void> fetchDailyTotal({bool silent = false}) async {
    _syncSelectedDateWithToday();
    if (!silent) {
      _isLoading = true;
      notifyListeners();
    }

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      final tokenResponse = await _apiService.get(
        '/tokens/get_details_by_date/$dateStr',
      );
      _fetchError = null;

      _dailyTotal = tokenResponse['total_tokens'] ?? 0;
      _totalReceipts = tokenResponse['total'] ?? 0;

      // Update the text file for external displays if it's for today
      final now = DateTime.now();
      if (_selectedDate.year == now.year &&
          _selectedDate.month == now.month &&
          _selectedDate.day == now.day) {
        try {
          await _tokenFileService.writeTokenCount(_dailyTotal);
          _fileWriteError = null;
        } catch (e) {
          _fileWriteError = '$e';
          print('Token file update failed: $e');
        }
      }
    } on NetworkException catch (e) {
      print('Fetch Data Error: $e');
      // Keep the last-known totals instead of flashing to 0 on a transient
      // network blip - the banner tells the user the figure may be stale.
      _fetchError = e.message;
    } catch (e) {
      print('Fetch Data Error: $e');
      _dailyTotal = 0;
      _totalReceipts = 0;
    }

    if (!silent) {
      _isLoading = false;
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>?> issueTokens(int count) async {
    _syncSelectedDateWithToday();
    _isLoading = true;
    _issueTokenError = null;
    notifyListeners();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final response = await _apiService.post('/tokens/create_token', {
        'token_count': count,
        'date': dateStr,
      });

      print('Token Generated Successfully: $response');

      // The create call just proved the server is reachable - clear any
      // stale "could not reach server" banner left over from an earlier
      // totals refresh instead of leaving it stuck until the next fetch
      // happens to succeed.
      _fetchError = null;
      _isLoading = false;
      notifyListeners();

      // Refresh totals and update mpd.txt in the background - don't make
      // the caller (and the printer/next-token flow) wait on this
      // secondary call.
      unawaited(fetchDailyTotal(silent: true));

      return response;
    } catch (e) {
      print('Issue Token Error: $e');
      _issueTokenError = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }
}
