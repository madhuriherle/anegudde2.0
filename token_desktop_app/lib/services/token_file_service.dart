import 'dart:io';

import 'package:shared_preferences/shared_preferences.dart';

class TokenFileService {
  static const String fileName = 'mpd.txt';
  static const String outputFolderPreferenceKey = 'token_output_folder';

  const TokenFileService();

  static Future<String> getOutputFolder() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(outputFolderPreferenceKey) ?? '';
  }

  static Future<void> saveOutputFolder(String folderPath) async {
    final prefs = await SharedPreferences.getInstance();
    final trimmedPath = folderPath.trim();
    if (trimmedPath.isEmpty) {
      await prefs.remove(outputFolderPreferenceKey);
      return;
    }
    await prefs.setString(outputFolderPreferenceKey, trimmedPath);
  }

  static Future<void> clearOutputFolder() => saveOutputFolder('');

  Future<void> writeTokenCount(int count) async {
    final content = count.toString();
    final savedFolder = await getOutputFolder();
    final hasCustomFolder = savedFolder.trim().isNotEmpty;

    if (hasCustomFolder) {
      final dir = Directory(savedFolder.trim());
      try {
        if (!await dir.exists()) {
          await dir.create(recursive: true);
        }
        await File(
          '${dir.path}${Platform.pathSeparator}$fileName',
        ).writeAsString(content, flush: true);
        print(
          'Successfully updated $fileName with count: $content at ${dir.path}',
        );
        return;
      } catch (e) {
        Error.throwWithStackTrace(
          'Failed to write to saved folder "$savedFolder": $e',
          StackTrace.current,
        );
      }
    }

    final targetDirs = await _targetDirectories();
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
        print(
          'Successfully updated $fileName with count: $content at ${dir.path}',
        );
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

  Future<List<Directory>> _targetDirectories() async {
    final dirs = <String>{};
    final savedFolder = await getOutputFolder();
    if (savedFolder.trim().isNotEmpty) {
      dirs.add(savedFolder.trim());
    }

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
