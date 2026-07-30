import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/token_file_service.dart';
import '../services/offline_token_queue.dart';

const int kDefaultSyncIntervalMinutes = 5;
const String _kSyncIntervalPrefKey = 'offline_sync_interval_minutes';
const String _kTryOnlineFirstPrefKey = 'issue_try_online_first';

class TokenProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final TokenFileService _tokenFileService = const TokenFileService();
  final OfflineTokenQueue _offlineQueue = OfflineTokenQueue();
  int _dailyTotal = 0;
  int _totalReceipts = 0;
  // Last totals actually confirmed by the server for the selected date -
  // the displayed totals add whatever's still locally pending on top of
  // this, so the screen reflects reality even before a sync happens.
  int _backendDailyTotal = 0;
  int _backendTotalReceipts = 0;
  bool _isLoading = false;
  DateTime _selectedDate = DateTime.now();
  String? _fileWriteError;
  String? _fetchError;
  String? _issueTokenError;
  bool _isConnected = true;
  int _pendingSyncCount = 0;
  int _syncIntervalMinutes = kDefaultSyncIntervalMinutes;
  bool _tryOnlineFirst = false;
  Timer? _syncTimer;
  bool _syncing = false;

  TokenProvider() {
    unawaited(_initOfflineQueue());
  }

  Future<void> _initOfflineQueue() async {
    await _offlineQueue.init();
    _pendingSyncCount = _offlineQueue.pendingCount;

    final prefs = await SharedPreferences.getInstance();
    _syncIntervalMinutes =
        prefs.getInt(_kSyncIntervalPrefKey) ?? kDefaultSyncIntervalMinutes;
    _tryOnlineFirst = prefs.getBool(_kTryOnlineFirstPrefKey) ?? false;
    notifyListeners();

    _startSyncTimer();
  }

  // Single timer drives all periodic backend polling - the offline-queue
  // sync AND the daily-totals refresh - so one interval setting controls
  // everything instead of the totals refresh running on its own fixed
  // 1-minute schedule regardless of what's configured here. First check
  // fires immediately, then every check after that follows the configured
  // interval (5 min -> next at 5 min, 10 min, ...).
  void _startSyncTimer() {
    _syncTimer?.cancel();
    _pollOnce();
    _syncTimer = Timer.periodic(Duration(minutes: _syncIntervalMinutes), (_) {
      _pollOnce();
    });
  }

  void _pollOnce() {
    unawaited(_pollOnceAsync());
  }

  Future<void> _pollOnceAsync() async {
    // Fetch the fresh server baseline first, then sync - so tokens synced
    // during this cycle add cleanly on top of an up-to-date baseline
    // instead of racing a stale one.
    await fetchDailyTotal(silent: true);
    await _syncPendingTokens();
  }

  /// Displayed totals = last confirmed server totals for the selected date
  /// + whatever's still queued locally for that same date - so the screen
  /// updates the instant a token is queued, not only after it syncs.
  void _recomputeDisplayedTotals() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final pendingForDate = _offlineQueue.pendingEntries.values
        .where((record) => record['date'] == dateStr)
        .toList();
    final pendingDevotees = pendingForDate.fold<int>(
      0,
      (sum, record) => sum + (record['tokenCount'] as int? ?? 0),
    );
    _dailyTotal = _backendDailyTotal + pendingDevotees;
    _totalReceipts = _backendTotalReceipts + pendingForDate.length;
  }

  int get syncIntervalMinutes => _syncIntervalMinutes;

  /// Lets staff tune how often the offline queue retries syncing with the
  /// server - a flaky-LAN counter might want a shorter interval, a stable
  /// one a longer one. Persisted per-device; takes effect immediately by
  /// restarting the timer rather than waiting for the current one to fire.
  Future<void> setSyncIntervalMinutes(int minutes) async {
    final clamped = minutes < 1 ? 1 : (minutes > 60 ? 60 : minutes);
    _syncIntervalMinutes = clamped;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kSyncIntervalPrefKey, clamped);
    _startSyncTimer();
    notifyListeners();
  }

  bool get tryOnlineFirst => _tryOnlineFirst;

  /// Off by default: every token is queued locally and printed with a
  /// local number instantly, synced to the server in batches by the
  /// interval timer - printing never waits on the network.
  ///
  /// On: each issue tries the backend immediately first, so the receipt
  /// can carry the real server-assigned number when possible: the local
  /// number is only a fallback, used if that immediate call fails.
  Future<void> setTryOnlineFirst(bool value) async {
    _tryOnlineFirst = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kTryOnlineFirstPrefKey, value);
    notifyListeners();
  }

  int get dailyTotal => _dailyTotal;
  int get totalReceipts => _totalReceipts;
  bool get isLoading => _isLoading;
  DateTime get selectedDate => _selectedDate;
  String? get fileWriteError => _fileWriteError;
  String? get fetchError => _fetchError;
  String? get issueTokenError => _issueTokenError;
  bool get isConnected => _isConnected;
  int get pendingSyncCount => _pendingSyncCount;

  @override
  void dispose() {
    _syncTimer?.cancel();
    super.dispose();
  }

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

      _backendDailyTotal = tokenResponse['total_tokens'] ?? 0;
      _backendTotalReceipts = tokenResponse['total'] ?? 0;
      _isConnected = true;

      // Update the text file for external displays if it's for today -
      // includes whatever's still locally pending, via _recomputeDisplayedTotals below.
      final now = DateTime.now();
      final isToday = _selectedDate.year == now.year &&
          _selectedDate.month == now.month &&
          _selectedDate.day == now.day;

      _recomputeDisplayedTotals();

      if (isToday) {
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
      // Pending local tokens still count towards what's shown.
      _fetchError = e.message;
      _isConnected = false;
      _recomputeDisplayedTotals();
    } catch (e) {
      print('Fetch Data Error: $e');
      _backendDailyTotal = 0;
      _backendTotalReceipts = 0;
      _recomputeDisplayedTotals();
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

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

    if (!_tryOnlineFirst) {
      // Default: never wait on the network to print. Every token is
      // queued locally with a local number and printed instantly; the
      // sync timer pushes it to the server (in the real backend format,
      // getting the real receipt number) in the background.
      return _queueLocally(count, dateStr);
    }

    try {
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
      _isConnected = true;
      _isLoading = false;
      notifyListeners();

      // Refresh totals and update mpd.txt in the background - don't make
      // the caller (and the printer/next-token flow) wait on this
      // secondary call.
      unawaited(fetchDailyTotal(silent: true));

      return response;
    } on NetworkException catch (e) {
      // Server unreachable right now - fall back to a local number so the
      // token still prints instantly; the sync timer will push it later.
      print('Issue Token Network Error (falling back to local number): $e');
      _isConnected = false;
      return _queueLocally(count, dateStr);
    } catch (e) {
      print('Issue Token Error: $e');
      _issueTokenError = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  Future<Map<String, dynamic>> _queueLocally(int count, String dateStr) async {
    final printedAt = DateTime.now();
    final localReceiptNo = await _offlineQueue.nextLocalReceiptNo();
    await _offlineQueue.addPending(
      tokenCount: count,
      date: dateStr,
      localReceiptNo: localReceiptNo,
      printedAt: printedAt,
    );
    _pendingSyncCount = _offlineQueue.pendingCount;
    _recomputeDisplayedTotals();
    _isLoading = false;
    notifyListeners();

    return {
      'token_count': count,
      'receipt_number': localReceiptNo,
      'date': dateStr,
      'created_at': printedAt.toIso8601String(),
    };
  }

  /// Pushes queued offline tokens to the server. Checks reachability once
  /// up front so a dead server fails this whole cycle fast instead of
  /// letting every queued item run out its own timeout in turn.
  Future<void> _syncPendingTokens() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final reachable = await _apiService.ping(_apiService.baseUrl);
      _isConnected = reachable;
      if (!reachable) {
        notifyListeners();
        return;
      }

      final pending = _offlineQueue.pendingEntries;
      final currentDateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      for (final entry in pending.entries) {
        final record = entry.value;
        try {
          await _apiService.post('/tokens/create_token', {
            'token_count': record['tokenCount'],
            'date': record['date'],
            'was_offline': true,
            'local_receipt_no': record['localReceiptNo'].toString(),
            'printed_at': record['printedAt'],
          });
          await _offlineQueue.removeSynced(entry.key);
          // Fold the now-synced record into the confirmed baseline so the
          // displayed total for the selected date doesn't dip as it moves
          // from "pending" to "confirmed" - only matters for the date
          // currently on screen, other dates just lose the pending count.
          if (record['date'] == currentDateStr) {
            _backendDailyTotal += (record['tokenCount'] as int? ?? 0);
            _backendTotalReceipts += 1;
          }
        } catch (e) {
          print('Sync failed for offline token ${entry.key}: $e');
          // Leave it queued, retry on the next cycle.
        }
      }
      _pendingSyncCount = _offlineQueue.pendingCount;
      _recomputeDisplayedTotals();
      notifyListeners();
    } finally {
      _syncing = false;
    }
  }
}
