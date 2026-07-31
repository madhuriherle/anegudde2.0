import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Local queue of tokens that were issued and printed while the backend
/// was unreachable. Records live here only until they're successfully
/// synced to the server, at which point they're deleted - the server is
/// the permanent record, this is just the offline holding pen.
///
/// Backed by SQLite (via sqflite_common_ffi) rather than Hive - Hive's
/// single-file locking crashed startup twice in practice (once from
/// OneDrive holding a lock on a redirected folder, once from a second
/// instance of this same app already running) with no graceful recovery.
/// SQLite's locking is far more mature for exactly this kind of shared
/// local-file access and won't crash the app on transient contention.
class OfflineTokenQueue {
  static const _dbName = 'offline_tokens_v1.db';
  static const _localSeqKey = 'offline_local_receipt_seq';
  static const _localSeqDateKey = 'offline_local_receipt_seq_date';

  Database? _db;
  // Mirrors the table in memory so pendingCount/pendingEntries can stay
  // synchronous (matching how callers already use this class) while SQLite
  // is the durable source of truth underneath.
  final Map<int, Map<String, dynamic>> _cache = {};

  /// Never throws - offline printing must never depend on this succeeding.
  /// If the local queue can't be opened for any reason, it's simply
  /// unavailable for this session rather than crashing token issuing.
  Future<void> init() async {
    try {
      sqfliteFfiInit();
      databaseFactory = databaseFactoryFfi;

      // Use the app-specific support directory, not the platform "Documents"
      // folder - on Windows, Documents is commonly redirected into OneDrive,
      // whose background sync could otherwise interfere with the DB file.
      final dir = await getApplicationSupportDirectory();
      final dbPath = p.join(dir.path, _dbName);

      final db = await databaseFactory.openDatabase(dbPath);
      await db.execute('''
        CREATE TABLE IF NOT EXISTS offline_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tokenCount INTEGER NOT NULL,
          date TEXT NOT NULL,
          localReceiptNo INTEGER NOT NULL,
          printedAt TEXT NOT NULL
        )
      ''');
      _db = db;

      final rows = await db.query('offline_tokens');
      for (final row in rows) {
        _cache[row['id'] as int] = Map<String, dynamic>.from(row)..remove('id');
      }
    } catch (e) {
      print(
        'OfflineTokenQueue: failed to open local queue - offline tokens '
        'will still print, but won\'t be queued for sync this session: $e',
      );
    }
  }

  bool get isAvailable => _db != null;

  int get pendingCount => _cache.length;

  /// Snapshot of everything currently queued, keyed by row id (needed to
  /// delete the right record once it's synced).
  Map<dynamic, Map> get pendingEntries => Map.from(_cache);

  /// A plain local counter used as the printed R.No. when offline -
  /// resets to 1 on the first offline print of each new day, matching how
  /// the real backend's receipt number also restarts fresh every day.
  /// Persisted separately from the queue itself (in shared_preferences,
  /// not SQLite) so it survives entries being synced and removed.
  Future<int> nextLocalReceiptNo() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10); // yyyy-MM-dd
    final storedDate = prefs.getString(_localSeqDateKey);
    final current = storedDate == today ? (prefs.getInt(_localSeqKey) ?? 0) : 0;
    final next = current + 1;
    await prefs.setInt(_localSeqKey, next);
    await prefs.setString(_localSeqDateKey, today);
    return next;
  }

  Future<dynamic> addPending({
    required int tokenCount,
    required String date,
    required int localReceiptNo,
    required DateTime printedAt,
  }) async {
    final db = _db;
    if (db == null) return null;
    final record = {
      'tokenCount': tokenCount,
      'date': date,
      'localReceiptNo': localReceiptNo,
      'printedAt': printedAt.toIso8601String(),
    };
    final id = await db.insert('offline_tokens', record);
    _cache[id] = record;
    return id;
  }

  Future<void> removeSynced(dynamic key) async {
    if (key is! int) return;
    await _db?.delete('offline_tokens', where: 'id = ?', whereArgs: [key]);
    _cache.remove(key);
  }
}
