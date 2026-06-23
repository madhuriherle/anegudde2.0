import 'dart:typed_data';
import 'dart:ui' as ui;
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

class PrintingService {
  static const String _templeName =
      '\u0C86\u0CA8\u0CC6\u0C97\u0CC1\u0CA1\u0CCD\u0CA1\u0CC6 \u0CB6\u0CCD\u0CB0\u0CC0 \u0CB5\u0CBF\u0CA8\u0CBE\u0CAF\u0C95 \u0CA6\u0CC7\u0CB5\u0CB8\u0CCD\u0CA5\u0CBE\u0CA8, \u0C95\u0CC1\u0C82\u0CAD\u0CBE\u0CB6\u0CBF';
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
    // Compact receipt — small footprint. userCode row adds ~30px.
    const double width = 450;
    final double height = userCode.isEmpty ? 250 : 280;
    const double scale = 3;

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.scale(scale);

    final borderPaint = ui.Paint()
      ..color = const Color(0xFF000000)
      ..style = ui.PaintingStyle.fill;
    final linePaint = ui.Paint()
      ..color = const Color(0xFF000000)
      ..style = ui.PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawColor(const Color(0xFFFFFFFF), ui.BlendMode.src);
    const double borderLeft = 34;
    const double borderTop = 4;
    const double borderRight = width - 34;
    // Sit the bottom border just below the largest text line so there is no
    // blank space between the last text row and the border.
    final double borderBottom = height - 6;
    const double borderThickness = 3;

    canvas.drawRect(
      ui.Rect.fromLTWH(
        borderLeft,
        borderTop,
        borderRight - borderLeft,
        borderThickness,
      ),
      borderPaint,
    );
    canvas.drawRect(
      ui.Rect.fromLTWH(
        borderLeft,
        borderBottom - borderThickness,
        borderRight - borderLeft,
        borderThickness,
      ),
      borderPaint,
    );
    canvas.drawRect(
      ui.Rect.fromLTWH(
        borderLeft,
        borderTop,
        borderThickness,
        borderBottom - borderTop,
      ),
      borderPaint,
    );
    canvas.drawRect(
      ui.Rect.fromLTWH(
        borderRight - borderThickness,
        borderTop,
        borderThickness,
        borderBottom - borderTop,
      ),
      borderPaint,
    );

    // Temple name (top, centered)
    _drawParagraph(
      canvas,
      _templeName,
      x: 48,
      y: 20,
      width: width - 96,
      fontSize: 19,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );

    // R.No. row (large)
    _drawParagraph(
      canvas,
      'R.No.: $receiptNo',
      x: 66,
      y: 72,
      width: width - 120,
      fontSize: 26,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );

    // Date + time on a single row
    _drawParagraph(
      canvas,
      'Date: $date',
      x: 66,
      y: 112,
      width: 250,
      fontSize: 22,
      fontWeight: FontWeight.w400,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );
    _drawParagraph(
      canvas,
      time,
      x: width - 172,
      y: 112,
      width: 126,
      fontSize: 22,
      fontWeight: FontWeight.w400,
      textAlign: TextAlign.right,
      fontFamily: 'Arial',
    );

    double y = 124;
    if (userCode.isNotEmpty) {
      _drawParagraph(
        canvas,
        userCode,
        x: 66,
        y: y,
        width: width - 120,
        fontSize: 18,
        fontWeight: FontWeight.w400,
        textAlign: TextAlign.left,
        fontFamily: 'Arial',
      );
      y += 26;
    }

    // ಮಹಾ ಪ್ರಸಾದ — the visual hero of the receipt
    _drawParagraph(
      canvas,
      _mahaPrasada,
      x: 40,
      y: y - 2,
      width: width - 80,
      fontSize: 32,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );

    final dividerY = y + 44;
    canvas.drawLine(
      ui.Offset(borderLeft, dividerY),
      ui.Offset(borderRight, dividerY),
      linePaint,
    );

    // ಭಕ್ತರ ಸಂಖ್ಯೆ label
    _drawParagraph(
      canvas,
      _devoteeCountLabel,
      x: 86,
      y: dividerY + 10,
      width: 220,
      fontSize: 26,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
    );
    // Token number (large, right-aligned)
    _drawParagraph(
      canvas,
      tokenCount,
      x: 320,
      y: dividerY + 2,
      width: 80,
      fontSize: 38,
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

    // Page rotated 90 degrees so the receipt (taller than wide) feeds sideways
    // through the thermal printer and reads upright. Aspect ratio matches the
    // PNG so there's no trailing whitespace.
    const pageWidth = 76 * PdfPageFormat.mm;
    const pageHeight = 50 * PdfPageFormat.mm;
    const rotatedReceiptWidth = 74 * PdfPageFormat.mm;
    final receiptAspectHeight = userCode.isEmpty ? 250 / 450 : 280 / 450;
    final rotatedReceiptHeight = rotatedReceiptWidth * receiptAspectHeight;

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat(
          pageWidth,
          pageHeight,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        ),
        orientation: pw.PageOrientation.landscape,
        build: (pw.Context context) {
          return pw.Center(
            child: pw.Transform.rotate(
              angle: -math.pi / 2,
              child: pw.SizedBox(
                width: rotatedReceiptWidth,
                height: rotatedReceiptHeight,
                child: pw.Image(
                  receiptImage,
                  width: rotatedReceiptWidth,
                  fit: pw.BoxFit.fitWidth,
                ),
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
