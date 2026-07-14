import 'dart:ui';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/token_file_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  Future<void> _showSettingsDialog() async {
    final baseUrl = ApiService().baseUrl;
    final outputFolder = await TokenFileService.getOutputFolder();
    if (!mounted) return;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => _SettingsDialog(
        initialBaseUrl: baseUrl,
        initialOutputFolder: outputFolder,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final sessionExpiredMessage = authProvider.sessionExpiredMessage;
    final connectionErrorMessage = authProvider.connectionErrorMessage;

    return Scaffold(
      body: Stack(
        children: [
          // Blurred Background Image
          Positioned.fill(
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: Image.asset(
                'assets/images/login-bg.jpg',
                fit: BoxFit.cover,
              ),
            ),
          ),
          // Semi-transparent overlay to make text more readable
          Positioned.fill(
            child: Container(color: Colors.black.withOpacity(0.15)),
          ),
          // Settings Icon
          Positioned(
            top: 20,
            right: 20,
            child: IconButton(
              icon: const Icon(Icons.settings, color: Colors.white70),
              onPressed: () => _showSettingsDialog(),
            ),
          ),
          // Login Form
          Center(
            child: Container(
              width: 400,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.95), // Slightly more opaque
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFD9C8AF), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 25,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/images/logo.png',
                    height: 80,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Meal Token System',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF4A3728), // Updated to match dashboard
                    ),
                  ),
                  if (connectionErrorMessage != null) ...[
                    const SizedBox(height: 20),
                    _LoginBanner(
                      icon: Icons.wifi_off,
                      title: 'Connection issue',
                      message: connectionErrorMessage,
                      accentColor: const Color(0xFFB3261E),
                      backgroundColor: const Color(0xFFFDF0EE),
                      onDismiss: authProvider.clearConnectionError,
                    ),
                  ],
                  if (sessionExpiredMessage != null) ...[
                    const SizedBox(height: 20),
                    _LoginBanner(
                      icon: Icons.lock_clock,
                      title: 'Session expired',
                      message: sessionExpiredMessage,
                      accentColor: const Color(0xFF4A3728),
                      backgroundColor: const Color(0xFFFAF6F0),
                      onDismiss: authProvider.clearSessionMessage,
                    ),
                  ],
                  const SizedBox(height: 32),
                  TextField(
                    controller: _usernameController,
                    onSubmitted: (_) => _handleLogin(authProvider),
                    decoration: InputDecoration(
                      labelText: 'Username',
                      filled: true,
                      fillColor: Colors.grey[100],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      prefixIcon: const Icon(Icons.person),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    onSubmitted: (_) => _handleLogin(authProvider),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      filled: true,
                      fillColor: Colors.grey[100],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      prefixIcon: const Icon(Icons.lock),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off
                              : Icons.visibility,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: authProvider.isLoading
                          ? null
                          : () => _handleLogin(authProvider),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD9C8AF),
                        foregroundColor: const Color(0xFF4A3728),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30),
                        ),
                      ),
                      child: authProvider.isLoading
                          ? const SizedBox(
                              height: 24,
                              width: 24,
                              child: CircularProgressIndicator(strokeWidth: 3),
                            )
                          : const Text(
                              'LOGIN',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                letterSpacing: 1.1,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogin(AuthProvider authProvider) async {
    final success = await authProvider.login(
      _usernameController.text.trim(),
      _passwordController.text.trim(),
    );
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.loginError ?? 'Login Failed'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }
}

class _LoginBanner extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Color accentColor;
  final Color backgroundColor;
  final VoidCallback onDismiss;

  const _LoginBanner({
    required this.icon,
    required this.title,
    required this.message,
    required this.accentColor,
    required this.backgroundColor,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: accentColor.withOpacity(0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 36,
            width: 36,
            decoration: BoxDecoration(
              color: accentColor.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: accentColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: TextStyle(
                    color: accentColor.withOpacity(0.85),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minHeight: 32, minWidth: 32),
            icon: Icon(Icons.close, size: 18, color: accentColor.withOpacity(0.85)),
            onPressed: onDismiss,
          ),
        ],
      ),
    );
  }
}

class _SettingsDialog extends StatefulWidget {
  final String initialBaseUrl;
  final String initialOutputFolder;

  const _SettingsDialog({
    required this.initialBaseUrl,
    required this.initialOutputFolder,
  });

  @override
  State<_SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<_SettingsDialog> {
  late final TextEditingController urlController;
  late final TextEditingController outputFolderController;
  late final TextEditingController passwordController;

  bool unlocked = false;
  bool testing = false;
  bool? testSuccess;
  String testResult = '';

  @override
  void initState() {
    super.initState();
    urlController = TextEditingController(text: widget.initialBaseUrl);
    outputFolderController = TextEditingController(text: widget.initialOutputFolder);
    passwordController = TextEditingController();
  }

  @override
  void dispose() {
    urlController.dispose();
    outputFolderController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: Container(
        width: 600,
        constraints: const BoxConstraints(minHeight: 400),
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFFD9C8AF), width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 30,
              offset: const Offset(0, 15),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFD9C8AF).withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.settings,
                    color: Color(0xFF4A3728),
                  ),
                ),
                const SizedBox(width: 16),
                const Text(
                  'API Configuration',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4A3728),
                    letterSpacing: 0.5,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, size: 24),
                  onPressed: () => Navigator.pop(context),
                  splashRadius: 24,
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Divider(height: 1, color: Color(0xFFD9C8AF)),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              transitionBuilder: (child, animation) => FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.05),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              ),
              child: !unlocked
                  ? Column(
                      key: const ValueKey('locked'),
                      children: [
                        const Icon(
                          Icons.admin_panel_settings,
                          size: 64,
                          color: Color(0xFFD9C8AF),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Administrator Access Required',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4A3728),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Please enter the master password to modify system settings.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey),
                        ),
                        const SizedBox(height: 32),
                        TextField(
                          controller: passwordController,
                          obscureText: true,
                          style: const TextStyle(fontSize: 16),
                          decoration: InputDecoration(
                            labelText: 'Master Password',
                            filled: true,
                            fillColor: Colors.grey[50],
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: Color(0xFFD9C8AF),
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(
                                color: Colors.grey[300]!,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: Color(0xFF4A3728),
                                width: 2,
                              ),
                            ),
                            prefixIcon: const Icon(
                              Icons.lock_person_outlined,
                            ),
                          ),
                          onSubmitted: (_) {
                            if (passwordController.text == 'd-apps@settings') {
                              setState(() => unlocked = true);
                            }
                          },
                        ),
                        const SizedBox(height: 32),
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: () {
                              if (passwordController.text == 'd-apps@settings') {
                                setState(() => unlocked = true);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Invalid Master Password',
                                    ),
                                    backgroundColor: Colors.redAccent,
                                  ),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD9C8AF),
                              foregroundColor: const Color(0xFF4A3728),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 0,
                            ),
                            child: const Text(
                              'UNLOCK SETTINGS',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                        ),
                      ],
                    )
                  : Column(
                      key: const ValueKey('unlocked'),
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: testSuccess == true
                                ? Colors.green.withOpacity(0.1)
                                : (testSuccess == null
                                      ? const Color(
                                          0xFFD9C8AF,
                                        ).withOpacity(0.1)
                                      : Colors.red.withOpacity(0.1)),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: testSuccess == true
                                  ? Colors.green.withOpacity(0.3)
                                  : (testSuccess == null
                                        ? const Color(
                                            0xFFD9C8AF,
                                          ).withOpacity(0.3)
                                        : Colors.red.withOpacity(0.3)),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                testSuccess == true
                                    ? Icons.check_circle
                                    : (testSuccess == null
                                          ? Icons.info_outline
                                          : Icons.error_outline),
                                color: testSuccess == true
                                    ? Colors.green
                                    : (testSuccess == null
                                          ? const Color(0xFF4A3728)
                                          : Colors.red),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  testResult.isEmpty
                                      ? 'Configure the backend server address below.'
                                      : testResult,
                                  style: TextStyle(
                                    color: testSuccess == true
                                        ? Colors.green[800]
                                        : (testSuccess == null
                                              ? const Color(0xFF4A3728)
                                              : Colors.red[800]),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        const Text(
                          'Server API Base URL',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4A3728),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: TextField(
                                controller: urlController,
                                style: const TextStyle(fontSize: 16),
                                decoration: InputDecoration(
                                  hintText:
                                      '187.127.173.27 or 192.168.1.7:2509',
                                  filled: true,
                                  fillColor: Colors.grey[50],
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(
                                      color: Colors.grey[300]!,
                                    ),
                                  ),
                                  prefixIcon: const Icon(Icons.link),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            OutlinedButton.icon(
                              onPressed: testing
                                  ? null
                                  : () async {
                                      setState(() {
                                        testing = true;
                                        testSuccess = null;
                                        testResult = '';
                                      });
                                      final ok = await ApiService().ping(
                                        urlController.text,
                                      );
                                      setState(() {
                                        testing = false;
                                        if (ok) {
                                          testSuccess = true;
                                          testResult =
                                              'Server is reachable';
                                        } else {
                                          testSuccess = false;
                                          testResult = 'Server unreachable';
                                        }
                                      });
                                    },
                              icon: testing
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Color(0xFF4A3728),
                                      ),
                                    )
                                  : const Icon(
                                      Icons.network_check,
                                      size: 20,
                                    ),
                              label: const Text('TEST CONNECTION'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF4A3728),
                                side: const BorderSide(
                                  color: Color(0xFFD9C8AF),
                                  width: 1.5,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 18,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Text(
                          'Token File Save Folder (Managed via Web App)',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF4A3728),
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: TextField(
                                controller: outputFolderController,
                                readOnly: true,
                                style: const TextStyle(fontSize: 16, color: Colors.grey),
                                decoration: InputDecoration(
                                  hintText: 'Syncs automatically after login',
                                  filled: true,
                                  fillColor: Colors.grey[200],
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    borderSide: BorderSide(
                                      color: Colors.grey[300]!,
                                    ),
                                  ),
                                  prefixIcon: const Icon(
                                    Icons.folder_outlined,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 40),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.pop(context),
                                style: OutlinedButton.styleFrom(
                                  minimumSize: const Size(0, 56),
                                  side: const BorderSide(
                                    color: Color(0xFFD9C8AF),
                                    width: 2,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text(
                                  'CANCEL',
                                  style: TextStyle(
                                    color: Color(0xFF4A3728),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: testing
                                    ? null
                                    : () async {
                                        setState(() {
                                          testing = true;
                                          testSuccess = null;
                                          testResult = '';
                                        });
                                        await TokenFileService.saveOutputFolder(
                                          outputFolderController.text,
                                        );
                                        final detected = await ApiService()
                                            .detectBaseUrl(
                                              urlController.text,
                                            );
                                        setState(() {
                                          testing = false;
                                          if (detected != null) {
                                            testSuccess = true;
                                            testResult =
                                                'Connected \u2192 ${detected.replaceFirst('http://', '')}';
                                          } else {
                                            testSuccess = false;
                                            testResult =
                                                'Connection Failed';
                                          }
                                        });
                                        if (detected == null) {
                                          if (!context.mounted) return;
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            const SnackBar(
                                              content: Text(
                                                'Connection failed. Please verify the URL.',
                                              ),
                                              backgroundColor:
                                                  Colors.redAccent,
                                            ),
                                          );
                                          return;
                                        }
                                        await ApiService().updateBaseUrl(
                                          detected,
                                        );
                                        if (!context.mounted) return;
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              'Saved: ${detected.replaceFirst('http://', '')}',
                                            ),
                                          ),
                                        );
                                        Navigator.pop(context);
                                      },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF4A3728),
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(0, 56),
                                  elevation: 4,
                                  shadowColor: Colors.black45,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text(
                                  'SAVE & APPLY',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
