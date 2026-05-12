import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class TokenProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  int _dailyTotal = 0;
  int _totalReceipts = 0;
  bool _isLoading = false;
  DateTime _selectedDate = DateTime.now();
  String _activeFinancialYear = '';

  int get dailyTotal => _dailyTotal;
  int get totalReceipts => _totalReceipts;
  bool get isLoading => _isLoading;
  DateTime get selectedDate => _selectedDate;
  String get activeFinancialYear => _activeFinancialYear;

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
      
      // Fetch totals and profile in parallel (profile contains the active FY)
      final results = await Future.wait([
        _apiService.get('/tokens/get_details_by_date/$dateStr'),
        _apiService.get('/auth/get_current_user_profile'),
      ]);

      final tokenResponse = results[0];
      final profileResponse = results[1];
      
      _dailyTotal = tokenResponse['total_tokens'] ?? 0;
      _totalReceipts = tokenResponse['total'] ?? 0;
      
      if (profileResponse['active_financial_year'] != null) {
        _activeFinancialYear = profileResponse['active_financial_year']['name'] ?? '';
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
      
      await fetchDailyTotal(); // Refresh total
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
