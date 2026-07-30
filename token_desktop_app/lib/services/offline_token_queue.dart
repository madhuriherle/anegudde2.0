import 'package:hive/hive.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local queue of tokens that were issued and printed while the backend
/// was unreachable. Records live here only until they're successfully
/// synced to the server, at which point they're deleted - the server is
/// the permanent record, this is just the offline holding pen.
class OfflineTokenQueue {
  static const _boxName = 'offline_tokens_v1';
  static const _localSeqKey = 'offline_local_receipt_seq';

  Box<Map>? _box;

  /// Never throws - offline printing must never depend on this succeeding.
  /// If the local queue can't be opened for any reason (e.g. this app is
  /// already running elsewhere and holds the lock), it's simply
  /// unavailable for this session rather than crashing token issuing.
  Future<void> init() async {
    try {
      // Use the app-specific support directory, not the platform "Documents"
      // folder - on Windows, Documents is commonly redirected into OneDrive,
      // whose background sync can hold a file lock and break Hive's own
      // box-lock file, crashing the app on startup.
      final dir = await getApplicationSupportDirectory();
      Hive.init(dir.path);
      _box = await Hive.openBox<Map>(_boxName);
    } catch (e) {
      print(
        'OfflineTokenQueue: failed to open local queue - offline tokens '
        'will still print, but won\'t be queued for sync this session: $e',
      );
    }
  }

  int get pendingCount => _box?.length ?? 0;

  /// Snapshot of everything currently queued, keyed by the Hive entry key
  /// (needed to delete the right record once it's synced).
  Map<dynamic, Map> get pendingEntries =>
      _box != null ? Map.from(_box!.toMap()) : {};

  /// A plain, ever-increasing local counter used as the printed R.No. when
  /// offline - persisted separately from the queue itself so it keeps
  /// climbing even after entries are synced and removed.
  Future<int> nextLocalReceiptNo() async {
    final prefs = await SharedPreferences.getInstance();
    final next = (prefs.getInt(_localSeqKey) ?? 0) + 1;
    await prefs.setInt(_localSeqKey, next);
    return next;
  }

  Future<dynamic> addPending({
    required int tokenCount,
    required String date,
    required int localReceiptNo,
    required DateTime printedAt,
  }) async {
    final box = _box;
    if (box == null) return null;
    return box.add({
      'tokenCount': tokenCount,
      'date': date,
      'localReceiptNo': localReceiptNo,
      'printedAt': printedAt.toIso8601String(),
    });
  }

  Future<void> removeSynced(dynamic key) async {
    await _box?.delete(key);
  }
}
