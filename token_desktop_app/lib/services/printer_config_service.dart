import 'dart:io';
import 'package:printing/printing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class PrinterConfigService {
  static const String _machineIdKey = 'printer_machine_id';

  final ApiService _api = ApiService();

  Future<String> getMachineId() async {
    final prefs = await SharedPreferences.getInstance();
    String? id = prefs.getString(_machineIdKey);
    if (id == null || id.isEmpty) {
      id = 'PC-${DateTime.now().millisecondsSinceEpoch.toRadixString(36).substring(0, 6).toUpperCase()}';
      await prefs.setString(_machineIdKey, id);
    }
    return id;
  }

  Future<String?> getSavedPrinter(String context) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('printer_$context');
  }

  Future<void> savePrinter(String context, String printerName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('printer_$context', printerName);

    // Sync to backend
    try {
      final machineId = await getMachineId();
      await _api.put('/settings/printer-config', {
        'machine_id': machineId,
        'context': context,
        'printer_name': printerName,
        'is_default': true,
      });
    } catch (e) {
      print('Failed to sync printer config to server: $e');
    }
  }

  Future<List<Printer>> listAvailablePrinters() async {
    try {
      return await Printing.listPrinters();
    } catch (e) {
      print('Failed to list printers: $e');
      return [];
    }
  }

  Future<Printer?> findPrinterByName(String name) async {
    if (name.isEmpty) return null;
    try {
      final printers = await Printing.listPrinters();
      // Try exact match first
      final exact = printers.where((p) => p.name == name).toList();
      if (exact.isNotEmpty) return exact.first;
      // Try case-insensitive
      final lower = name.toLowerCase();
      final fuzzy = printers.where((p) => p.name.toLowerCase().contains(lower)).toList();
      if (fuzzy.isNotEmpty) return fuzzy.first;
    } catch (e) {
      print('Failed to find printer: $e');
    }
    return null;
  }
}
