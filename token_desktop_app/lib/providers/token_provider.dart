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

  int get dailyTotal => _dailyTotal;
  int get totalReceipts => _totalReceipts;
  bool get isLoading => _isLoading;
  DateTime get selectedDate => _selectedDate;
  String? get fileWriteError => _fileWriteError;

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

  Future<void> fetchDailyTotal() async {
    _syncSelectedDateWithToday();
    _isLoading = true;
    notifyListeners();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      final tokenResponse = await _apiService.get(
        '/tokens/get_details_by_date/$dateStr',
      );

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
    } catch (e) {
      print('Fetch Data Error: $e');
      _dailyTotal = 0;
      _totalReceipts = 0;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> issueTokens(int count) async {
    _syncSelectedDateWithToday();
    _isLoading = true;
    notifyListeners();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final response = await _apiService.post('/tokens/create_token', {
        'token_count': count,
        'date': dateStr,
      });

      print('Token Generated Successfully: $response');

      await fetchDailyTotal(); // Refresh total and update mpd.txt
      _isLoading = false;
      notifyListeners();
      return response;
    } catch (e) {
      print('Issue Token Error: $e');
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }
}
