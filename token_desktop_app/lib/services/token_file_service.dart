import 'dart:io';

class TokenFileService {
  static const String fileName = 'mpd.txt';

  const TokenFileService();

  Future<void> writeLatestTokenCount(Map<String, dynamic> tokenData) async {
    final tokenCount = tokenData['token_count'];
    if (tokenCount == null) {
      throw const FormatException('Token response did not include token_count');
    }

    final content = tokenCount.toString();
    final targetDirs = _targetDirectories();

    Object? lastError;
    StackTrace? lastStackTrace;

    for (final dir in targetDirs) {
      try {
        if (!await dir.exists()) {
          await dir.create(recursive: true);
        }
        await File(
          '${dir.path}${Platform.pathSeparator}$fileName',
        ).writeAsString(content, flush: true);
        return;
      } catch (e, st) {
        lastError = e;
        lastStackTrace = st;
      }
    }

    Error.throwWithStackTrace(
      lastError ?? 'Unable to write $fileName',
      lastStackTrace ?? StackTrace.current,
    );
  }

  List<Directory> _targetDirectories() {
    final dirs = <String>{};

    try {
      dirs.add(File(Platform.resolvedExecutable).parent.path);
    } catch (_) {
      // Keep fallback paths below available.
    }

    dirs.add(Directory.current.path);

    final appData = Platform.environment['APPDATA'];
    if (appData != null && appData.trim().isNotEmpty) {
      dirs.add('$appData${Platform.pathSeparator}Meal Token System');
    }

    return dirs.map(Directory.new).toList(growable: false);
  }
}
