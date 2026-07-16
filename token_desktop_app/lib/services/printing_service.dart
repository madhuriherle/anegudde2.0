import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:http/http.dart' as http;

import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

const String _printerAgentUrl = 'http://localhost:5623';

class PrintingService {
  // Split across two lines so it isn't cramped onto one tiny row:
  // "Anegudde Sri Vinayaka Devasthana," / "Kumbashi"
  static const String _templeNameLine1 =
      '\u0C86\u0CA8\u0CC6\u0C97\u0CC1\u0CA1\u0CCD\u0CA1\u0CC6 \u0CB6\u0CCD\u0CB0\u0CC0 \u0CB5\u0CBF\u0CA8\u0CBE\u0CAF\u0C95 \u0CA6\u0CC7\u0CB5\u0CB8\u0CCD\u0CA5\u0CBE\u0CA8,';
  static const String _templeNameLine2 =
      '\u0C95\u0CC1\u0C82\u0CAD\u0CBE\u0CB6\u0CBF';
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
    // The temple name now takes two lines instead of one, so the card is
    // 26px taller than before to fit it without crowding the rows below.
    const double width = 450;
    final double height = userCode.isEmpty ? 286 : 316;
    const double scale = 1.5;

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
    const double borderLeft = 24;
    const double borderTop = 8;
    const double borderRight = width - 6;
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

    // Temple name (top, centered) — split across two lines so each one
    // gets a readable size instead of being crammed onto a single row.
    _drawParagraph(
      canvas,
      _templeNameLine1,
      x: 28,
      y: 14,
      width: width - 56,
      fontSize: 21,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );
    _drawParagraph(
      canvas,
      _templeNameLine2,
      x: 28,
      y: 40,
      width: width - 56,
      fontSize: 21,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.center,
    );

    // R.No. row — bold and prominent (the receipt reference)
    _drawParagraph(
      canvas,
      'R.No.: $receiptNo',
      x: 36,
      y: 86,
      width: width - 72,
      fontSize: 26,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );

    // Date + time on a single row
    _drawParagraph(
      canvas,
      'Date: $date',
      x: 36,
      y: 126,
      width: 240,
      fontSize: 21,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
      fontFamily: 'Arial',
    );
    _drawParagraph(
      canvas,
      time,
      x: 286,
      y: 126,
      width: 110,
      fontSize: 21,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.right,
      fontFamily: 'Arial',
    );

    double y = 160;
    if (userCode.isNotEmpty) {
      _drawParagraph(
        canvas,
        userCode,
        x: 36,
        y: y,
        width: width - 72,
        fontSize: 19,
        fontWeight: FontWeight.w400,
        textAlign: TextAlign.left,
        fontFamily: 'Arial',
      );
      y += 22;
    }

    // ಮಹಾ ಪ್ರಸಾದ — the visual hero of the receipt
    _drawParagraph(
      canvas,
      _mahaPrasada,
      x: 28,
      y: y - 2,
      width: width - 56,
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
      x: 52,
      y: dividerY + 12,
      width: 220,
      fontSize: 26,
      fontWeight: FontWeight.w700,
      textAlign: TextAlign.left,
    );
    // Token number (large, right-aligned) — biggest element on the receipt
    _drawParagraph(
      canvas,
      tokenCount,
      x: 318,
      y: dividerY + 4,
      width: 90,
      fontSize: 42,
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

    const receiptWidth = 75 * PdfPageFormat.mm;
    final receiptAspectHeight = userCode.isEmpty ? 286 / 450 : 316 / 450;
    final receiptHeight = receiptWidth * receiptAspectHeight;
    const pageWidth = 76 * PdfPageFormat.mm;
    final pageHeight = receiptHeight;

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
        build: (pw.Context context) {
          return pw.Align(
            alignment: pw.Alignment.topRight,
            child: pw.SizedBox(
              width: receiptWidth,
              height: receiptHeight,
              child: pw.Image(
                receiptImage,
                width: receiptWidth,
                height: receiptHeight,
                fit: pw.BoxFit.contain,
              ),
            ),
          );
        },
      ),
    );

    final pdfBytes = await doc.save();
    final pdfBase64 = base64Encode(pdfBytes);
    final filename = 'Token_${receiptNo}.pdf';

    // Try printer-agent first (faster - direct Windows API call)
    try {
      final agentResponse = await http
          .post(
            Uri.parse('$_printerAgentUrl/api/print'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'printer_name': printerName ?? '',
              'pdf_base64': pdfBase64,
              'filename': filename,
            }),
          )
          .timeout(const Duration(seconds: 5));

      if (agentResponse.statusCode == 200) {
        print('Printed via printer-agent');
        return;
      }
    } catch (e) {
      print('Printer-agent unavailable, falling back to Flutter print: $e');
    }

    // Fallback to Flutter printing plugin
    try {
      final printers = await Printing.listPrinters();
      Printer? targetPrinter;

      if (printerName != null && printerName.isNotEmpty) {
        targetPrinter =
            printers.where((p) => p.name == printerName).toList().isNotEmpty
            ? printers.firstWhere((p) => p.name == printerName)
            : null;
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

      targetPrinter ??= printers.firstWhere(
        (p) => p.isDefault,
        orElse: () => printers.first,
      );

      await Printing.directPrintPdf(
        printer: targetPrinter,
        onLayout: (PdfPageFormat format) => Future.value(pdfBytes),
        name: filename,
      );
    } catch (e) {
      print('Direct print failed, falling back to layoutPdf: $e');
      await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) => Future.value(pdfBytes),
        name: filename,
      );
    }
  }
}
