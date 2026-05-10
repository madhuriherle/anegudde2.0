import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class TokenProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  int _dailyTotal = 0;
  int _totalReceipts = 0;
  bool _isLoading = false;
  DateTime _selectedDate = DateTime.now();

  int get dailyTotal => _dailyTotal;
  int get totalReceipts => _totalReceipts;
  bool get isLoading => _isLoading;
  DateTime get selectedDate => _selectedDate;

  void setDate(DateTime date) {
    _selectedDate = date;
    fetchDailyTotal();
  }

  Future<void> fetchDailyTotal() async {
    _isLoading = true;
    notifyListeners();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      // Use the existing details endpoint which returns total (receipts) and total_tokens
      final response = await _apiService.get('/tokens/get_details_by_date/$dateStr');
      
      _dailyTotal = response['total_tokens'] ?? 0;
      _totalReceipts = response['total'] ?? 0;
    } catch (e) {
      print('Fetch Total Error: $e');
      _dailyTotal = 0;
      _totalReceipts = 0;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> issueTokens(int count) async {
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
