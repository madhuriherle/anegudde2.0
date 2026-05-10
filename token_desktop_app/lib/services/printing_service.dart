import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

class PrintingService {
  static Future<void> printToken(Map<String, dynamic> tokenData) async {
    final doc = pw.Document();

    final date = DateFormat('dd-MM-yyyy').format(DateTime.now());
    final time = DateFormat('hh:mm a').format(DateTime.now());
    final tokenCount = tokenData['token_count'];
    final receiptNo = tokenData['receipt_number'];

    doc.addPage(
      pw.Page(
        pageFormat: const PdfPageFormat(80 * PdfPageFormat.mm, double.infinity, marginAll: 5 * PdfPageFormat.mm),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            mainAxisSize: pw.MainAxisSize.min,
            children: [
              pw.Text('ANEGUDDE TEMPLE', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              pw.Text('Inventory System - Meal Token', style: pw.TextStyle(fontSize: 10)),
              pw.SizedBox(height: 5),
              pw.Divider(thickness: 1),
              pw.SizedBox(height: 5),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Date: $date'),
                  pw.Text('Time: $time'),
                ],
              ),
              pw.SizedBox(height: 10),
              pw.Text('Receipt No: #$receiptNo', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 10),
              pw.Container(
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(border: pw.Border.all()),
                child: pw.Column(
                  children: [
                    pw.Text('NUMBER OF PEOPLE', style: pw.TextStyle(fontSize: 12)),
                    pw.Text('$tokenCount', style: pw.TextStyle(fontSize: 32, fontWeight: pw.FontWeight.bold)),
                  ],
                ),
              ),
              pw.SizedBox(height: 10),
              pw.Divider(thickness: 1),
              pw.SizedBox(height: 5),
              pw.Text('Thank You!', style: pw.TextStyle(fontStyle: pw.FontStyle.italic)),
            ],
          );
        },
      ),
    );

    // Direct print to default printer
    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) => doc.save(),
      name: 'Token_$receiptNo',
      // To bypass the print dialog on Windows if possible:
      // printing package doesn't always support bypass dialog on all platforms without user interaction, 
      // but we can try to use direct print if we have the printer name.
      // For now, layoutPdf is the safest standard way.
    );
  }
}
