import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/token_provider.dart';
import '../providers/auth_provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _countController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TokenProvider>(context, listen: false).fetchDailyTotal();
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _countController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokenProvider = Provider.of<TokenProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);

    // Use FY from API if available, otherwise fallback to local logic
    String displayFY = tokenProvider.activeFinancialYear;
    if (displayFY.isEmpty) {
      final now = DateTime.now();
      final year = now.year;
      final month = now.month;
      displayFY = month >= 4 
        ? '$year-${(year + 1).toString().substring(2)}' 
        : '${year - 1}-${year.toString().substring(2)}';
    }

    return Scaffold(
      backgroundColor: const Color(0xFFFDF8F3), // Match bg-temple / bg-cream
      body: Column(
        children: [
          // 1. Top Header (Web Style - Clean & Compact)
          Container(
            height: 64,
            padding: const EdgeInsets.symmetric(horizontal: 24),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Colors.brown.withOpacity(0.1))),
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
                // Minimal Logo with Image
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    'assets/images/logo.png',
                    height: 48,
                    width: 48,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(width: 16),
                const Text(
                  'AIMS Meal & Token System',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF4A3728)),
                ),
                const Spacer(),
                // Website Style FY Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFDF2E9),
                    border: Border.all(color: const Color(0xFFE5D5C5)),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'Financial Year : $displayFY',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF5C2E1F),
                    ),
                  ),
                ),
                const SizedBox(width: 24),
                IconButton(
                  icon: const Icon(Icons.logout, color: Color(0xFF4A3728), size: 20),
                  onPressed: () => _showLogoutConfirmation(context, authProvider),
                  tooltip: 'Logout',
                ),
              ],
            ),
          ),
          
          // ... rest of the build method ...
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child: Column(
                    children: [
                      // Metrics Row (Compact Cards)
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricCard(
                              'TOTAL DEVOTEES',
                              '${tokenProvider.dailyTotal}',
                              const Color(0xFFB45309),
                              Icons.confirmation_num_outlined,
                            ),
                          ),
                          const SizedBox(width: 24),
                          Expanded(
                            child: _buildMetricCard(
                              'TOTAL RECEIPTS',
                              '${tokenProvider.totalReceipts}',
                              const Color(0xFF4A3728),
                              Icons.receipt_long_outlined,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 32),
                      // Issue Tokens Card (Professional & Clean)
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.brown.withOpacity(0.08)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(32.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              const Text(
                                'Issue New Tokens',
                                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF4A3728)),
                              ),
                              const SizedBox(height: 32),
                              // Date/Operator Info
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _buildInfoField('DATE', DateFormat('dd MMM yyyy').format(DateTime.now()), Icons.today),
                                ],
                              ),
                              const SizedBox(height: 40),
                              const Text(
                                'NUMBER OF DEVOTEES',
                                style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey, fontSize: 10, letterSpacing: 1.2),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: 320,
                                child: TextField(
                                  controller: _countController,
                                  focusNode: _focusNode,
                                  keyboardType: TextInputType.number,
                                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Color(0xFF4A3728)),
                                  textAlign: TextAlign.center,
                                  onSubmitted: (_) => _handleIssueTokens(tokenProvider),
                                  decoration: InputDecoration(
                                    hintText: 'Enter count',
                                    hintStyle: TextStyle(color: Colors.grey.withOpacity(0.3), fontSize: 18, fontWeight: FontWeight.normal),
                                    filled: true,
                                    fillColor: const Color(0xFFFCFBF9),

                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black12)),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.black12)),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(color: Color(0xFFB45309), width: 2),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(vertical: 16),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 32),
                              SizedBox(
                                width: 320,
                                height: 56,
                                child: ElevatedButton(
                                  onPressed: tokenProvider.isLoading
                                      ? null
                                      : () => _handleIssueTokens(tokenProvider),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF4A3728),
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    elevation: 2,
                                  ),
                                  child: tokenProvider.isLoading
                                      ? const CircularProgressIndicator(color: Colors.white)
                                      : const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.print_outlined, size: 20),
                                            const SizedBox(width: 12),
                                            Text(
                                              'GENERATE & PRINT',
                                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1),
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
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
            color: const Color(0xFF1A1A1A),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '© Anegudde Inventory Management System (AIMS) ${DateTime.now().year}',
                  style: const TextStyle(color: Color(0xFF777777), fontSize: 11),
                ),
                const Text(
                  'Design By D-apps.in',
                  style: TextStyle(color: Colors.white24, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleIssueTokens(TokenProvider tokenProvider) async {
    final countText = _countController.text;
    final count = int.tryParse(countText);
    if (count == null || count <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid count')),
      );
      _focusNode.requestFocus();
      return;
    }

    final response = await tokenProvider.issueTokens(count);
    if (response != null) {
      _countController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tokens issued successfully!')),
      );
    }
    
    // Always return focus to the text field for the next entry
    _focusNode.requestFocus();
  }

  void _showLogoutConfirmation(BuildContext context, AuthProvider authProvider) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          contentPadding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          title: Center(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFDF2E9),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.logout_rounded, color: Color(0xFFB45309), size: 28),
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Confirm Logout',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF4A3728)),
              ),
              const SizedBox(height: 12),
              Text(
                'Are you sure you want to log out of the system?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
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
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: Text('No, Cancel', style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.bold)),
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
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 0,
                      ),
                      child: const Text('Yes, Logout', style: TextStyle(fontWeight: FontWeight.bold)),
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

  Widget _buildMetricCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 1)),
                const SizedBox(height: 4),
                Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoField(String label, String value, IconData icon) {
    return Container(
      constraints: const BoxConstraints(minWidth: 150),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF8F3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.brown.withOpacity(0.05)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: Colors.brown.withOpacity(0.6)),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF4A3728))),
            ],
          ),
        ],
      ),
    );
  }
}
