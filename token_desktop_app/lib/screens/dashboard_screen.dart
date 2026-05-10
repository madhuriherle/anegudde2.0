import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/token_provider.dart';
import '../providers/auth_provider.dart';
import '../services/printing_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _countController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TokenProvider>(context, listen: false).fetchDailyTotal();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tokenProvider = Provider.of<TokenProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        title: const Text('Token Distribution Dashboard'),
        backgroundColor: const Color(0xFFD9C8AF),
        foregroundColor: const Color(0xFF4A3728),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => authProvider.logout(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left Side: Entry Form
            Expanded(
              flex: 1,
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Issue New Tokens',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF8B4513)),
                      ),
                      const SizedBox(height: 24),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Distribution Date'),
                        subtitle: Text(DateFormat('EEEE, dd MMMM yyyy').format(DateTime.now())),
                        trailing: const Icon(Icons.lock_outline, color: Colors.grey),
                        onTap: null, // Read-only as it's automatically fetched
                      ),
                      const Divider(height: 32),
                      const Text('Number of People'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _countController,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                        decoration: const InputDecoration(
                          hintText: '0',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 60,
                        child: ElevatedButton(
                          onPressed: tokenProvider.isLoading
                              ? null
                              : () async {
                                  final count = int.tryParse(_countController.text);
                                  if (count == null || count <= 0) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Please enter a valid count')),
                                    );
                                    return;
                                  }

                                  final response = await tokenProvider.issueTokens(count);
                                  if (response != null) {
                                    _countController.clear();
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Tokens issued successfully!')),
                                    );
                                    // Trigger printing (Commented out for testing)
                                    // await PrintingService.printToken(response);
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Failed to issue tokens')),
                                    );
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF8B4513),
                            foregroundColor: Colors.white,
                          ),
                          child: tokenProvider.isLoading
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('ISSUE & PRINT TOKEN', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 24),
            // Right Side: Summary
            Expanded(
              flex: 1,
              child: Column(
                children: [
                  Card(
                    color: const Color(0xFF8B4513),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(32.0),
                      child: Column(
                        children: [
                          const Text(
                            'TOTAL TOKENS ISSUED TODAY',
                            style: TextStyle(color: Colors.white70, letterSpacing: 1.2),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '${tokenProvider.dailyTotal}',
                            style: const TextStyle(fontSize: 64, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: const Padding(
                      padding: EdgeInsets.all(24.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.print, color: Colors.grey),
                              SizedBox(width: 8),
                              Text('Printer Status', style: TextStyle(fontWeight: FontWeight.bold)),
                              Spacer(),
                              CircleAvatar(radius: 6, backgroundColor: Colors.green),
                              SizedBox(width: 8),
                              Text('Connected', style: TextStyle(fontSize: 12, color: Colors.green)),
                            ],
                          ),
                          SizedBox(height: 16),
                          Text('Epson TM-T81 (Default Printer)', style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    ),
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
