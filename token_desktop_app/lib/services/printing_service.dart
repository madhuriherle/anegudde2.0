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
      final p = builder.build()
        ..layout(ui.ParagraphConstraints(width: maxWidth));

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
      paragraph = builder.build()
        ..layout(ui.ParagraphConstraints(width: maxWidth));
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

  static ui.Paragraph _buildParagraph(
    String text, {
    required double width,
    required double fontSize,
    required FontWeight fontWeight,
    required TextAlign textAlign,
    String fontFamily = 'KannadaFont',
  }) {
    final style = ui.ParagraphStyle(
      textDirection: ui.TextDirection.ltr,
      fontSize: fontSize,
      fontWeight: fontWeight,
      fontFamily: fontFamily,
      maxLines: 1,
      textAlign: textAlign,
    );
    final builder = ui.ParagraphBuilder(style)
      ..pushStyle(
        ui.TextStyle(
          color: const Color(0xFF000000),
          fontSize: fontSize,
          fontWeight: fontWeight,
          fontFamily: fontFamily,
        ),
      )
      ..addText(text);
    return builder.build()..layout(ui.ParagraphConstraints(width: width));
  }

  static void _drawParagraph(
    ui.Canvas canvas,
    String text, {
    required double x,
    required double y,
    required double width,
    required double fontSize,
    required FontWeight fontWeight,
    required TextAlign textAlign,
    String fontFamily = 'KannadaFont',
  }) {
    final paragraph = _buildParagraph(
      text,
      width: width,
      fontSize: fontSize,
      fontWeight: fontWeight,
      textAlign: textAlign,
      fontFamily: fontFamily,
    );
    canvas.drawParagraph(paragraph, ui.Offset(x, y));
  }

  static Future<Uint8List> _renderTokenReceiptAsPng({
    required String receiptNo,
    required String date,
    required String time,
    required String tokenCount,
    required String userCode,
  }) async {
    const double width = 450;
    final double height = userCode.isEmpty ? 390 : 430;
    const double scale = 3;

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.scale(scale);

    final borderPaint = ui.Paint()
      ..color = const Color(0xFF000000)
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = 2;
    final linePaint = ui.Paint()
      ..color = const Color(0xFF000000)
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawColor(const Color(0xFFFFFFFF), ui.BlendMode.src);
    canvas.drawRect(
      ui.Rect.fromLTWH(18, 8, width - 36, height - 16),
      borderPaint,
    );

    _drawParagraph(
      canvas,
      _templeName,
      x: 34,
      y: 34,
      width: width - 68,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );

    _drawParagraph(
      canvas,
      'R.No.: $receiptNo',
      x: 42,
      y: 96,
      width: width - 84,
      fontSize: 28,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );

    _drawParagraph(
      canvas,
      'Date: $date',
      x: 42,
      y: 142,
      width: 250,
      fontSize: 24,
      fontWeight: FontWeight.w400,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );
    _drawParagraph(
      canvas,
      time,
      x: width - 170,
      y: 142,
      width: 130,
      fontSize: 24,
      fontWeight: FontWeight.w400,
      textAlign: TextAlign.right,
      fontFamily: 'Arial',
    );

    double y = 174;
    if (userCode.isNotEmpty) {
      _drawParagraph(
        canvas,
        userCode,
        x: 42,
        y: y,
        width: width - 84,
        fontSize: 20,
        fontWeight: FontWeight.w400,
        textAlign: TextAlign.left,
        fontFamily: 'Arial',
      );
      y += 30;
    }

    _drawParagraph(
      canvas,
      _mahaPrasada,
      x: 34,
      y: y + 6,
      width: width - 68,
      fontSize: 39,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );

    final dividerY = y + 76;
    canvas.drawLine(
      ui.Offset(18, dividerY),
      ui.Offset(width - 18, dividerY),
      linePaint,
    );

    _drawParagraph(
      canvas,
      _devoteeCountLabel,
      x: 84,
      y: dividerY + 30,
      width: 220,
      fontSize: 31,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
    );
    _drawParagraph(
      canvas,
      tokenCount,
      x: 318,
      y: dividerY + 20,
      width: 80,
      fontSize: 45,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
      fontFamily: 'Arial',
    );

    final picture = recorder.endRecording();
    final image = await picture.toImage(
      (width * scale).round(),
      (height * scale).round(),
    );
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static Future<void> printToken(
    Map<String, dynamic> tokenData, {
    String? printerName,
  }) async {
    final doc = pw.Document();

    // The complete receipt is rendered as one high-resolution image so Kannada
    // shaping stays clear on thermal printers.

    // Use server-provided timestamp if available, otherwise fallback to local time
    final createdAtStr = tokenData['created_at'];
    final DateTime createdAt = createdAtStr != null
        ? DateTime.parse(createdAtStr).toLocal()
        : DateTime.now();

    final date = DateFormat('dd-MM-yyyy').format(createdAt);
    final time = DateFormat('HH:mm:ss').format(createdAt);
    final tokenCount = tokenData['token_count'];
    final receiptNo = tokenData['receipt_number'];
    final creator = tokenData['creator'];
    final userCode =
        ((tokenData['user_code'] ??
                    (creator is Map ? creator['user_code'] : null)) ??
                '')
            .toString()
            .trim();
    final receiptImage = pw.MemoryImage(
      await _renderTokenReceiptAsPng(
        receiptNo: receiptNo?.toString() ?? '',
        date: date,
        time: time,
        tokenCount: tokenCount?.toString() ?? '',
        userCode: userCode,
      ),
    );

    const cardWidth = 66 * PdfPageFormat.mm;
    final cardHeight = userCode.isEmpty
        ? 58 * PdfPageFormat.mm
        : 64 * PdfPageFormat.mm;
    const pageWidth =
        80 * PdfPageFormat.mm; // Standard 80mm width for thermal printers

    doc.addPage(
      pw.Page(
        // Fixed custom portrait page to avoid landscape auto-rotation by drivers
        pageFormat: PdfPageFormat(
          pageWidth,
          cardHeight,
          marginTop: 1 * PdfPageFormat.mm,
          marginBottom: 1 * PdfPageFormat.mm,
          marginLeft: 3 * PdfPageFormat.mm,
          marginRight: 3 * PdfPageFormat.mm,
        ),
        orientation: pw.PageOrientation.portrait,
        build: (pw.Context context) {
          return pw.Align(
            alignment: pw.Alignment.topCenter,
            child: pw.Image(
              receiptImage,
              width: cardWidth,
              fit: pw.BoxFit.fitWidth,
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
        targetPrinter =
            printers.where((p) => p.name == printerName).toList().isNotEmpty
            ? printers.firstWhere((p) => p.name == printerName)
            : null;
        // Try case-insensitive contains
        targetPrinter ??=
            printers
                .where(
                  (p) =>
                      p.name.toLowerCase().contains(printerName.toLowerCase()),
                )
                .toList()
                .isNotEmpty
            ? printers.firstWhere(
                (p) => p.name.toLowerCase().contains(printerName.toLowerCase()),
              )
            : null;
      }

      // Fall back to default printer if no match
      targetPrinter ??= printers.firstWhere(
        (p) => p.isDefault,
        orElse: () => printers.first,
      );

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
