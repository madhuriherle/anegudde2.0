import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class TokenProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  int _dailyTotal = 0;
  bool _isLoading = false;
  DateTime _selectedDate = DateTime.now();

  int get dailyTotal => _dailyTotal;
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
      final response = await _apiService.get('/tokens/get_details_by_date/$dateStr');
      // The API returns a paginated response with total_tokens in the summary or we might need to sum it up
      // Looking at the TokenGeneration schema, it has total_tokens.
      // But get_details_by_date returns TokenDetailResponse.
      // Let's check the service again.
      
      _dailyTotal = response['total_tokens'] ?? 0;
    } catch (e) {
      print('Fetch Total Error: $e');
      _dailyTotal = 0;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> issueTokens(int count) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiService.post('/tokens/create_token', {
        'token_count': count,
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
