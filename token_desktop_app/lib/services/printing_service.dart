import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

class PrintingService {
  static const String _templeName =
      '\u0C86\u0CA8\u0CC6\u0C97\u0CC1\u0CA1\u0CCD\u0CA1\u0CC6 \u0CB6\u0CCD\u0CB0\u0CC0 \u0CB5\u0CBF\u0CA8\u0CBE\u0CAF\u0C95 \u0CA6\u0CC7\u0CB5\u0CB8\u0CCD\u0CA5\u0CBE\u0CA8';
  static const String _mahaPrasada =
      '\u0CAE\u0CB9\u0CBE \u0CAA\u0CCD\u0CB0\u0CB8\u0CBE\u0CA6';
  static const String _devoteeCountLabel =
      '\u0CAD\u0C95\u0CCD\u0CA4\u0CB0 \u0CB8\u0C82\u0C96\u0CCD\u0CAF\u0CC6:';

  static Future<Uint8List> _renderKannadaTextAsPng(
    String text, {
    required double fontSize,
    required FontWeight fontWeight,
    required double maxWidth,
  }) async {
    final paragraphStyle = ui.ParagraphStyle(
      textDirection: ui.TextDirection.ltr,
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontFamily: 'KannadaFont',
    );
    final paragraphBuilder = ui.ParagraphBuilder(paragraphStyle)
      ..pushStyle(
        ui.TextStyle(
          color: const Color(0xFF000000),
          fontSize: fontSize,
          fontWeight: fontWeight,
          fontFamily: 'KannadaFont',
        ),
      )
      ..addText(text);

    final paragraph = paragraphBuilder.build()
      ..layout(ui.ParagraphConstraints(width: maxWidth));

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawParagraph(paragraph, ui.Offset.zero);
    final picture = recorder.endRecording();
    // Add extra width to prevent edge clipping
    final image = await picture.toImage(
      (maxWidth + 4).ceil(),
      (paragraph.height + 2).ceil(),
    );
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static Future<Uint8List> _renderKannadaSingleLineAsPng(
    String text, {
    required double maxWidth,
    required double startFontSize,
    required double minFontSize,
    required FontWeight fontWeight,
    TextAlign textAlign = TextAlign.center, // Default to center
  }) async {
    double fontSize = startFontSize;
    ui.Paragraph? paragraph;
    while (fontSize >= minFontSize) {
      final style = ui.ParagraphStyle(
        textDirection: ui.TextDirection.ltr,
        fontSize: fontSize,
        fontWeight: fontWeight,
        fontFamily: 'KannadaFont',
        maxLines: 1,
        textAlign: textAlign, // Apply alignment
      );
      final builder = ui.ParagraphBuilder(style)
        ..pushStyle(
          ui.TextStyle(
            color: const Color(0xFF000000),
            fontSize: fontSize,
            fontWeight: fontWeight,
            fontFamily: 'KannadaFont',
          ),
        )
        ..addText(text);
      final p = builder.build()..layout(ui.ParagraphConstraints(width: maxWidth));
      
      if (p.minIntrinsicWidth <= maxWidth) {
        paragraph = p;
        break;
      }
      fontSize -= 0.5;
    }

    // Fallback
    if (paragraph == null) {
      final style = ui.ParagraphStyle(
        textDirection: ui.TextDirection.ltr,
        fontSize: minFontSize,
        fontWeight: fontWeight,
        fontFamily: 'KannadaFont',
        maxLines: 1,
        textAlign: textAlign,
      );
      final builder = ui.ParagraphBuilder(style)
        ..pushStyle(
          ui.TextStyle(
            color: const Color(0xFF000000),
            fontSize: minFontSize,
            fontWeight: fontWeight,
            fontFamily: 'KannadaFont',
          ),
        )
        ..addText(text);
      paragraph = builder.build()..layout(ui.ParagraphConstraints(width: maxWidth));
    }

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawParagraph(paragraph, ui.Offset.zero);
    final picture = recorder.endRecording();
    final image = await picture.toImage(
      maxWidth.ceil(), // Use full maxWidth for the image to maintain centering
      (paragraph.height + 2).ceil(),
    );
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static Future<void> printToken(Map<String, dynamic> tokenData, {String? printerName}) async {
    final doc = pw.Document();

    // Use standard Helvetica fonts for English text to avoid TTF parsing issues
    // Kannada text is rendered as images using Baloo Tamma 2 font for a traditional look
    final fontRegular = pw.Font.helvetica();
    final fontBold = pw.Font.helveticaBold();

    // Use server-provided timestamp if available, otherwise fallback to local time
    final createdAtStr = tokenData['created_at'];
    final DateTime createdAt = createdAtStr != null 
        ? DateTime.parse(createdAtStr).toLocal() 
        : DateTime.now();

    final date = DateFormat('dd-MM-yyyy').format(createdAt);
    final time = DateFormat('HH:mm:ss').format(createdAt);
    final tokenCount = tokenData['token_count'];
    final receiptNo = tokenData['receipt_number'];
    const cardWidth = 72 * PdfPageFormat.mm; // Slightly more width
    const pageContentWidth = cardWidth - (8 * PdfPageFormat.mm); // More padding inside
    final templeNameImage = pw.MemoryImage(
      await _renderKannadaSingleLineAsPng(
        _templeName,
        startFontSize: 18, 
        minFontSize: 8, // Allow it to go smaller to fit the long name
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth,
      ),
    );
    final mahaPrasadaImage = pw.MemoryImage(
      await _renderKannadaSingleLineAsPng(
        _mahaPrasada,
        startFontSize: 22, // Target size
        minFontSize: 14,   // Scale down if needed
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth,
      ),
    );
    final devoteeCountLabelImage = pw.MemoryImage(
      await _renderKannadaSingleLineAsPng(
        _devoteeCountLabel,
        startFontSize: 20, // Slightly reduced from 22
        minFontSize: 16,
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth * 0.7, 
      ),
    );

    const cardHeight = 85 * PdfPageFormat.mm; 
    const pageWidth = 80 * PdfPageFormat.mm; // Standard 80mm width for thermal printers

    doc.addPage(
      pw.Page(
        // Fixed custom portrait page to avoid landscape auto-rotation by drivers
        pageFormat: PdfPageFormat(
          pageWidth,
          cardHeight,
          marginTop: 1 * PdfPageFormat.mm,
          marginBottom: 1 * PdfPageFormat.mm,
          marginLeft: 6 * PdfPageFormat.mm, // Increased from 2mm to avoid cut-off
          marginRight: 4 * PdfPageFormat.mm,
        ),
        orientation: pw.PageOrientation.portrait,
        build: (pw.Context context) {
          return pw.Align(
            alignment: pw.Alignment.topLeft, // Changed from topCenter to allow margin to work
            child: pw.Container(
              width: cardWidth,
              padding: const pw.EdgeInsets.fromLTRB(
                4.0 * PdfPageFormat.mm, 
                5.0 * PdfPageFormat.mm,
                4.0 * PdfPageFormat.mm,
                4.0 * PdfPageFormat.mm,
              ),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.black, width: 1.2), // Thicker border
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                mainAxisSize: pw.MainAxisSize.min,
                children: [
                  // Temple Name
                  pw.Center(
                    child: pw.Image(
                      templeNameImage,
                      width: pageContentWidth,
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                  pw.SizedBox(height: 5),
                  
                  // Receipt Number, Date and Time
                  pw.Container(
                    width: double.infinity,
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('R.No.: $receiptNo', style: pw.TextStyle(font: fontBold, fontSize: 13)), // Increased from 9.5
                        pw.SizedBox(height: 1.5 * PdfPageFormat.mm),
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text('Date: $date', style: pw.TextStyle(font: fontRegular, fontSize: 12)), // Increased from 8.5
                            pw.Text(time, style: pw.TextStyle(font: fontRegular, fontSize: 12)), // Increased from 8.5
                          ],
                        ),
                      ],
                    ),
                  ),
                  
                  pw.SizedBox(height: 4),
                  
                  pw.Container(
                    width: double.infinity,
                    alignment: pw.Alignment.center,
                    child: pw.Image(
                      mahaPrasadaImage,
                      width: pageContentWidth * 0.75, // Increased width
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                  
                  pw.SizedBox(height: 4),
                  pw.Divider(thickness: 1.0, color: PdfColors.black),
                  pw.SizedBox(height: 4),
                  
                  // Devotee Count
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.center,
                    children: [
                      pw.Image(
                        devoteeCountLabelImage,
                        width: pageContentWidth * 0.55, // Increased width
                        fit: pw.BoxFit.contain,
                      ),
                      pw.SizedBox(width: 4 * PdfPageFormat.mm),
                      pw.Text(
                        '$tokenCount',
                        style: pw.TextStyle(font: fontBold, fontSize: 24), // Increased from 13
                      ),
                    ],
                  ),
                  pw.SizedBox(height: 6),
                ],
              ),
            ),
          );
        },
      ),
    );

    // Try to find the target printer
    try {
      final printers = await Printing.listPrinters();
      Printer? targetPrinter;

      if (printerName != null && printerName.isNotEmpty) {
        // Try exact match first
        targetPrinter = printers.where((p) => p.name == printerName).toList().isNotEmpty
            ? printers.firstWhere((p) => p.name == printerName)
            : null;
        // Try case-insensitive contains
        targetPrinter ??= printers.where((p) =>
            p.name.toLowerCase().contains(printerName.toLowerCase())).toList().isNotEmpty
            ? printers.firstWhere((p) =>
                p.name.toLowerCase().contains(printerName.toLowerCase()))
            : null;
      }

      // Fall back to default printer if no match
      targetPrinter ??= printers.firstWhere((p) => p.isDefault, orElse: () => printers.first);

      await Printing.directPrintPdf(
        printer: targetPrinter,
        onLayout: (PdfPageFormat format) => doc.save(),
        name: 'Token_$receiptNo',
      );
    } catch (e) {
      print('Direct print failed, falling back to layoutPdf: $e');
      // Fallback to standard layout print if direct print fails
      await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) => doc.save(),
        name: 'Token_$receiptNo',
      );
    }
  }
}
