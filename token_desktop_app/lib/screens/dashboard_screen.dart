import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../providers/token_provider.dart';
import '../providers/auth_provider.dart';
import '../services/printing_service.dart';
import '../services/printer_config_service.dart';
import 'login_screen.dart';
import 'profile_screen.dart';
import 'package:file_picker/file_picker.dart';
import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _countController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _refreshTimer;
  final PrinterConfigService _printerConfigService = PrinterConfigService();
  String _selectedPrinterName = '';
  List<Printer> _availablePrinters = [];
  bool _showPrinterSelector = false;

  void _refocusCountInput() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _focusNode.requestFocus();
      _countController.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _countController.text.length,
      );
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TokenProvider>(context, listen: false).fetchDailyTotal();
      _initPrinterConfig();
      _refocusCountInput();
    });
    Provider.of<TokenProvider>(context, listen: false).addListener(_onFileError);

    _refreshTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!mounted) return;
      Provider.of<TokenProvider>(context, listen: false).fetchDailyTotal();
    });
  }

  Future<void> _initPrinterConfig() async {
    try {
      final saved = await _printerConfigService.getSavedPrinter('TOKEN');
      final printers = await _printerConfigService.listAvailablePrinters();
      if (!mounted) return;
      setState(() {
        _selectedPrinterName = saved ?? '';
        _availablePrinters = printers;
      });
    } catch (e) {
      print('Printer init error: $e');
    }
  }

  Future<void> _showPrinterPicker() async {
    final printers = await _printerConfigService.listAvailablePrinters();
    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Select Printer for Tokens'),
              content: SizedBox(
                width: 400,
                child: printers.isEmpty
                    ? const Text('No printers found.')
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Available Printers:',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          const SizedBox(height: 8),
                          ...printers.map((p) => RadioListTile<String>(
                            title: Text(p.name, style: const TextStyle(fontSize: 13)),
                            subtitle: p.isDefault
                                ? const Text('Default printer', style: TextStyle(fontSize: 11))
                                : null,
                            value: p.name,
                            groupValue: _selectedPrinterName,
                            onChanged: (val) {
                              if (val != null) {
                                setDialogState(() {
                                  _selectedPrinterName = val;
                                });
                              }
                            },
                          )),
                          const SizedBox(height: 8),
                          TextField(
                            decoration: const InputDecoration(
                              labelText: 'Or type printer name',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            controller: TextEditingController(text: _selectedPrinterName),
                            onChanged: (val) {
                              setDialogState(() {
                                _selectedPrinterName = val;
                              });
                            },
                          ),
                        ],
                      ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    await _printerConfigService.savePrinter('TOKEN', _selectedPrinterName);
                    if (!mounted) return;
                    setState(() {});
                    Navigator.pop(ctx);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Printer saved: $_selectedPrinterName'),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    }
                  },
                  child: const Text('Save & Close'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _openDesktopManual() async {
    try {
      final bytes = await rootBundle.load('assets/manuals/DESKTOP_APP_MANUAL.pdf');
      final file = File(
        '${Directory.systemTemp.path}${Platform.pathSeparator}AVT_Desktop_App_Manual.pdf',
      );
      await file.writeAsBytes(bytes.buffer.asUint8List(), flush: true);

      if (Platform.isWindows) {
        await Process.run('cmd', ['/c', 'start', '', file.path], runInShell: true);
      } else {
        await Process.run('open', [file.path]);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Unable to open manual: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _onFileError() {
    final tokenProvider = Provider.of<TokenProvider>(context, listen: false);
    final fileError = tokenProvider.fileWriteError;
    final fetchError = tokenProvider.fetchError;
    final message = fileError != null ? 'File save error: $fileError' : fetchError;
    if (message != null && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'SETTINGS',
              textColor: Colors.white,
              onPressed: () {
                // Navigate to login to access settings
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const LoginScreen(),
                  ),
                );
              },
            ),
          ),
        );
      });
    }
  }

  @override
  void dispose() {
    Provider.of<TokenProvider>(context, listen: false)
        .removeListener(_onFileError);
    _refreshTimer?.cancel();
    _countController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokenProvider = Provider.of<TokenProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);
    final userProfile = authProvider.userProfile;
    final displayName =
        userProfile?['username'] ?? userProfile?['name'] ?? 'Loading...';

    final screenWidth = MediaQuery.of(context).size.width;
    final screenHeight = MediaQuery.of(context).size.height;

    final contentWidth = screenWidth >= 1600
        ? 1100.0
        : screenWidth >= 1200
            ? 950.0
            : screenWidth * 0.92;

    final fieldWidth = screenWidth >= 1200
        ? 320.0
        : (screenWidth * 0.55).clamp(280.0, 360.0);

    final mainVerticalPadding = screenHeight < 760 ? 28.0 : 48.0;
    final cardPadding = screenWidth < 900 ? 24.0 : 32.0;

    // Responsive dimensions
    final responsiveFieldHeight = (screenHeight * 0.13).clamp(80.0, 110.0);
    final responsiveButtonHeight = (screenHeight * 0.075).clamp(50.0, 60.0);

    return Scaffold(
      backgroundColor: const Color(0xFFFDF8F3),
      body: Column(
        children: [
          // 1. Top Header
          Container(
            height: 64,
            padding: EdgeInsets.symmetric(
              horizontal: screenWidth < 800 ? 16 : 24,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(
                bottom: BorderSide(color: Colors.brown.withOpacity(0.1)),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.brown.withOpacity(0.1)),
                  ),
                  child: ClipOval(
                    child: Image.asset(
                      'assets/images/logo.png',
                      height: 42,
                      width: 42,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Meal Token System',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4A3728),
                  ),
                ),
                const Spacer(),
                // Profile Menu Badge
                MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: PopupMenuButton<String>(
                    offset: const Offset(0, 45),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 3,
                    tooltip: '',
                    onSelected: (value) {
                      if (value == 'profile') {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const ProfileScreen(),
                          ),
                        );
                      } else if (value == 'manual') {
                        _openDesktopManual();
                      } else if (value == 'folder') {
                        _updateTokenFolderPath(context);
                      } else if (value == 'logout') {
                        _showLogoutConfirmation(context, authProvider);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'profile',
                        child: Row(
                          children: [
                            Icon(
                              Icons.person_outline,
                              size: 18,
                              color: Color(0xFF4A3728),
                            ),
                            SizedBox(width: 12),
                            Text(
                              'Profile',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF4A3728),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'manual',
                        child: Row(
                          children: [
                            Icon(
                              Icons.menu_book,
                              size: 18,
                              color: Color(0xFF4A3728),
                            ),
                            SizedBox(width: 12),
                            Text(
                              'Desktop App Manual',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF4A3728),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (authProvider.userProfile?['role_rank_level'] == 1)
                        const PopupMenuItem(
                          value: 'folder',
                          child: Row(
                            children: [
                              Icon(
                                Icons.folder_open,
                                size: 18,
                                color: Color(0xFF4A3728),
                              ),
                              SizedBox(width: 12),
                              Text(
                                'Set Token Folder',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF4A3728),
                                ),
                              ),
                            ],
                          ),
                        ),
                      const PopupMenuDivider(),
                      const PopupMenuItem(
                        value: 'logout',
                        child: Row(
                          children: [
                            Icon(
                              Icons.logout,
                              size: 18,
                              color: Colors.redAccent,
                            ),
                            SizedBox(width: 12),
                            Text(
                              'Logout',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF4A3728),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 5, 5, 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFDF2E9),
                        border: Border.all(color: const Color(0xFFE5D5C5)),
                        borderRadius: BorderRadius.circular(30),
                      ),
                      child: Row(
                        children: [
                          Text(
                            'Hi, ${displayName.toUpperCase()}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF5C2E1F),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.arrow_drop_down,
                            size: 22,
                            color: Color(0xFF5C2E1F),
                          ),
                          const SizedBox(width: 4),
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: const Color(0xFF4A3728),
                            child: Text(
                              displayName.isNotEmpty
                                  ? displayName[0].toUpperCase()
                                  : 'U',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Main Content
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                vertical: mainVerticalPadding,
                horizontal: screenWidth < 800 ? 16 : 24,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: contentWidth),
                  child: Column(
                    children: [
                      // Metrics Row
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final isSmallWidth = constraints.maxWidth < 720;

                          if (isSmallWidth) {
                            return Column(
                              children: [
                                _buildMetricCard(
                                  'TOTAL RECEIPTS',
                                  '${tokenProvider.totalReceipts}',
                                  const Color(0xFF4A3728),
                                  Icons.receipt_long_outlined,
                                ),
                                const SizedBox(height: 16),
                                _buildMetricCard(
                                  'TOTAL DEVOTEES',
                                  '${tokenProvider.dailyTotal}',
                                  const Color(0xFFB45309),
                                  Icons.confirmation_num_outlined,
                                ),
                              ],
                            );
                          }

                          return Row(
                            children: [
                              Expanded(
                                child: _buildMetricCard(
                                  'TOTAL RECEIPTS',
                                  '${tokenProvider.totalReceipts}',
                                  const Color(0xFF4A3728),
                                  Icons.receipt_long_outlined,
                                ),
                              ),
                              const SizedBox(width: 24),
                              Expanded(
                                child: _buildMetricCard(
                                  'TOTAL DEVOTEES',
                                  '${tokenProvider.dailyTotal}',
                                  const Color(0xFFB45309),
                                  Icons.confirmation_num_outlined,
                                ),
                              ),
                            ],
                          );
                        },
                      ),

                      const SizedBox(height: 32),

                      // Issue Tokens Card
                      Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.brown.withOpacity(0.08),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: EdgeInsets.all(cardPadding),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Text(
                                'Issue New Tokens',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF4A3728),
                                ),
                              ),

                              SizedBox(height: screenHeight < 760 ? 24 : 32),

                              // Date Badge
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 24,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFDF8F3),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: Colors.brown.withOpacity(0.05),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.today,
                                      size: 18,
                                      color: Colors.brown.withOpacity(0.6),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      'Date : ${DateFormat('dd MMM yyyy').format(DateTime.now())}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: Color(0xFF4A3728),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              SizedBox(height: screenHeight < 760 ? 32 : 40),

                              const Text(
                                'NUMBER OF DEVOTEES',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: Colors.grey,
                                  fontSize: 13,
                                  letterSpacing: 1.2,
                                ),
                              ),

                              const SizedBox(height: 12),

                              // Responsive Input Field
                              SizedBox(
                                width: fieldWidth,
                                height: responsiveFieldHeight,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFCFBF9),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.black12),
                                  ),
                                  child: Stack(
                                    children: [
                                      TextField(
                                        controller: _countController,
                                        focusNode: _focusNode,
                                        autofocus: true,
                                        keyboardType: TextInputType.text,
                                        textAlign: TextAlign.center,
                                        textAlignVertical: TextAlignVertical.center,
                                        expands: true,
                                        maxLines: null,
                                        minLines: null,
                                        style: const TextStyle(
                                          fontSize: 32,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF4A3728),
                                          height: 1.0,
                                        ),
                                        onSubmitted: (_) =>
                                            _handleIssueTokens(tokenProvider),
                                        onTapOutside: (_) => _refocusCountInput(),
                                        decoration: InputDecoration(
                                          hintText: '',
                                          hintStyle: TextStyle(
                                            color: Colors.grey.withOpacity(0.45),
                                            fontSize: 18,
                                            fontWeight: FontWeight.normal,
                                            height: 1.0,
                                          ),
                                          border: InputBorder.none,
                                          contentPadding: EdgeInsets.zero,
                                          isCollapsed: true,
                                        ),
                                      ),
                                      // Focus border overlay
                                      AnimatedBuilder(
                                        animation: _focusNode,
                                        builder: (context, child) {
                                          return IgnorePointer(
                                            child: Container(
                                              decoration: BoxDecoration(
                                                borderRadius: BorderRadius.circular(12),
                                                border: Border.all(
                                                  color: _focusNode.hasFocus 
                                                      ? const Color(0xFFB45309) 
                                                      : Colors.transparent,
                                                  width: 2,
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ),

                              SizedBox(height: screenHeight < 760 ? 12 : 16),

                              // Printer Selector Button
                              SizedBox(
                                width: fieldWidth,
                                height: 36,
                                child: OutlinedButton.icon(
                                  onPressed: _showPrinterPicker,
                                  icon: Icon(
                                    Icons.print_outlined,
                                    size: 16,
                                    color: const Color(0xFF4A3728).withOpacity(0.6),
                                  ),
                                  label: Text(
                                    _selectedPrinterName.isNotEmpty
                                        ? 'Printer: $_selectedPrinterName'
                                        : 'Select Printer...',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF4A3728),
                                    ),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                      color: Colors.brown.withOpacity(0.15),
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                ),
                              ),

                              SizedBox(height: screenHeight < 760 ? 16 : 20),

                              // Responsive Print Button
                              SizedBox(
                                width: fieldWidth,
                                height: responsiveButtonHeight,
                                child: ElevatedButton(
                                  onPressed: tokenProvider.isLoading
                                      ? null
                                      : () =>
                                          _handleIssueTokens(tokenProvider),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor:
                                        const Color(0xFF4A3728),
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    elevation: 2,
                                  ),
                                  child: tokenProvider.isLoading
                                      ? const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Icon(
                                              Icons.print_outlined,
                                              size: 20,
                                            ),
                                            SizedBox(width: 12),
                                            Text(
                                              'GENERATE & PRINT',
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.bold,
                                                letterSpacing: 1,
                                              ),
                                            ),
                                          ],
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 3. Footer
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              vertical: 16,
              horizontal: 32,
            ),
            color: const Color(0xFF1A1A1A),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '© Aanegudde Inventory Management System (AIMS) ${DateTime.now().year}',
                  style: const TextStyle(
                    color: Color(0xFFB8B8B8),
                    fontSize: 13,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      'Developed by ',
                      style: TextStyle(
                        color: Color(0xFFCDCDCD),
                        fontSize: 13,
                      ),
                    ),
                    SizedBox(width: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.asset(
                        'assets/images/d-apps.png',
                        width: 18,
                        height: 18,
                        fit: BoxFit.cover,
                      ),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'D-apps.in',
                      style: TextStyle(
                        color: Color(0xFFE0E0E0),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleIssueTokens(TokenProvider tokenProvider) async {
    final countText = _countController.text.trim();
    final isValidFormat = RegExp(r'^[0-9]+$').hasMatch(countText);

    if (!isValidFormat) {
      await _showInvalidFormatAlert();
      _countController.clear();
      _refocusCountInput();
      return;
    }

    final count = int.tryParse(countText);

    if (count == null || count <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid count')),
      );
      _refocusCountInput();
      return;
    }

    final response = await tokenProvider.issueTokens(count);
    if (!mounted) return;

    if (response != null) {
      _countController.clear();

      try {
        await PrintingService.printToken(
          response,
          printerName: _selectedPrinterName.isNotEmpty ? _selectedPrinterName : null,
        );
        if (!mounted) return;
        await _showSuccessPopup(context, response);
      } catch (e) {
        print('Printing error: $e');
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Issued successfully, but printing failed: $e'),
          ),
        );
      }
    } else {
      await _showErrorAlert(
        tokenProvider.issueTokenError ?? 'Failed to generate token. Please try again.',
      );
    }

    _refocusCountInput();
  }

  Future<void> _showInvalidFormatAlert() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return Shortcuts(
          shortcuts: <ShortcutActivator, Intent>{
            const SingleActivator(LogicalKeyboardKey.enter): const ActivateIntent(),
            const SingleActivator(LogicalKeyboardKey.numpadEnter): const ActivateIntent(),
          },
          child: Actions(
            actions: <Type, Action<Intent>>{
              ActivateIntent: CallbackAction<ActivateIntent>(
                onInvoke: (_) {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  }
                  return null;
                },
              ),
            },
            child: Dialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              backgroundColor: const Color(0xFFFFF8F1),
              child: Container(
                width: 360,
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFEDD5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.priority_high_rounded,
                        color: Color(0xFFB45309),
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Invalid Format',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF4A3728),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Please enter valid number',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        color: Color(0xFF6B4F3A),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: 140,
                      height: 40,
                      child: ElevatedButton(
                        autofocus: true,
                        onPressed: () {
                          if (Navigator.of(context).canPop()) {
                            Navigator.of(context).pop();
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4A3728),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text(
                          'Okay',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
    _refocusCountInput();
  }

  
  Future<void> _showErrorAlert(String message) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return Shortcuts(
          shortcuts: <ShortcutActivator, Intent>{
            const SingleActivator(LogicalKeyboardKey.enter): const ActivateIntent(),
            const SingleActivator(LogicalKeyboardKey.numpadEnter): const ActivateIntent(),
          },
          child: Actions(
            actions: <Type, Action<Intent>>{
              ActivateIntent: CallbackAction<ActivateIntent>(
                onInvoke: (_) {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  }
                  return null;
                },
              ),
            },
            child: Dialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              backgroundColor: const Color(0xFFFFF1F1),
              child: Container(
                width: 360,
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFEE2E2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFDC2626),
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text(
                      'Access Denied',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF7F1D1D),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 18,
                        color: Color(0xFF4A3728),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: 140,
                      height: 40,
                      child: ElevatedButton(
                        autofocus: true,
                        onPressed: () {
                          if (Navigator.of(context).canPop()) {
                            Navigator.of(context).pop();
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B1E1E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text(
                          'Okay',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
    _refocusCountInput();
  }

  Future<void> _showSuccessPopup(
    BuildContext context,
    Map<String, dynamic> data,
  ) async {
    await showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext context) {
        return _AutoDismissWrapper(
          duration: const Duration(seconds: 1),
          child: Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 8,
            backgroundColor: Colors.white,
            child: Container(
              width: 320,
              padding: const EdgeInsets.symmetric(
                vertical: 32,
                horizontal: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F9F0),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0xFFE1F2E1),
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.check,
                      color: Color(0xFF72C366),
                      size: 40,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Token Generated Successfully',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF555555),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Devotees: ${data['token_count']}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF777777),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _updateTokenFolderPath(BuildContext context) async {
    try {
      // Fetch current settings first so the picker can default to where mpd.txt
      // is actually being written today (explicit path, or the backend's fallback cwd).
      final response = await ApiService().get('/settings/get_current_settings');
      if (response == null || response is! Map) {
        throw Exception('Failed to fetch current settings');
      }
      final currentSettings = Map<String, dynamic>.from(response);
      final currentPath = (currentSettings['token_file_path'] as String?)?.trim().isNotEmpty == true
          ? currentSettings['token_file_path'] as String
          : currentSettings['effective_token_file_path'] as String?;

      final selectedDirectory = await FilePicker.platform.getDirectoryPath(
        dialogTitle: 'Select Token Folder Path',
        initialDirectory: currentPath,
      );

      if (selectedDirectory != null) {
        currentSettings['token_file_path'] = selectedDirectory;

        final updateResponse = await ApiService().put('/settings/update', currentSettings);
        if (updateResponse != null) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Token folder path updated successfully')),
            );
          }
        } else {
          throw Exception('Failed to update settings');
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error updating token path: $e')),
        );
      }
    }
  }

  void _showLogoutConfirmation(
    BuildContext context,
    AuthProvider authProvider,
  ) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          contentPadding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Confirm Logout',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF4A3728),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Are you sure you want to log out of the system?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: Colors.grey[300]!),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        'No',
                        style: TextStyle(
                          color: Colors.grey[700],
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        authProvider.logout();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4A3728),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Yes',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricCard(
    String label,
    String value,
    Color color,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AutoDismissWrapper extends StatefulWidget {
  final Widget child;
  final Duration duration;

  const _AutoDismissWrapper({
    required this.child,
    required this.duration,
  });

  @override
  State<_AutoDismissWrapper> createState() => _AutoDismissWrapperState();
}

class _AutoDismissWrapperState extends State<_AutoDismissWrapper> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.duration, () {
      if (mounted) {
        Navigator.of(context).pop();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}


