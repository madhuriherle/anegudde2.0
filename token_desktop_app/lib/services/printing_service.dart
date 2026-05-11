import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:intl/intl.dart';

class PrintingService {
  static const String _templeName =
      '\u0C85\u0CA8\u0CC6\u0C97\u0CC1\u0CA1\u0CCD\u0CA1\u0CC6 \u0CB6\u0CCD\u0CB0\u0CC0 \u0CB5\u0CBF\u0CA8\u0CBE\u0CAF\u0C95 \u0CA6\u0CC7\u0CB5\u0CB8\u0CCD\u0CA5\u0CBE\u0CA8';
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
      fontFamily: 'Nirmala UI',
    );
    final paragraphBuilder = ui.ParagraphBuilder(paragraphStyle)
      ..pushStyle(
        ui.TextStyle(
          color: const Color(0xFF000000),
          fontSize: fontSize,
          fontWeight: fontWeight,
          fontFamily: 'Nirmala UI',
        ),
      )
      ..addText(text);

    final paragraph = paragraphBuilder.build()
      ..layout(ui.ParagraphConstraints(width: maxWidth));

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawParagraph(paragraph, ui.Offset.zero);
    final picture = recorder.endRecording();
    final image = await picture.toImage(
      maxWidth.ceil(),
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
  }) async {
    double fontSize = startFontSize;
    ui.Paragraph? paragraph;
    while (fontSize >= minFontSize) {
      final style = ui.ParagraphStyle(
        textDirection: ui.TextDirection.ltr,
        fontSize: fontSize,
        fontWeight: fontWeight,
        fontFamily: 'Nirmala UI',
        maxLines: 1,
      );
      final builder = ui.ParagraphBuilder(style)
        ..pushStyle(
          ui.TextStyle(
            color: const Color(0xFF000000),
            fontSize: fontSize,
            fontWeight: fontWeight,
            fontFamily: 'Nirmala UI',
          ),
        )
        ..addText(text);
      final p = builder.build()..layout(ui.ParagraphConstraints(width: maxWidth));
      if (!p.didExceedMaxLines) {
        paragraph = p;
        break;
      }
      fontSize -= 0.5;
    }

    paragraph ??= (ui.ParagraphBuilder(
      ui.ParagraphStyle(
        textDirection: ui.TextDirection.ltr,
        fontSize: minFontSize,
        fontWeight: fontWeight,
        fontFamily: 'Nirmala UI',
        maxLines: 1,
      ),
    )..pushStyle(
        ui.TextStyle(
          color: const Color(0xFF000000),
          fontSize: minFontSize,
          fontWeight: fontWeight,
          fontFamily: 'Nirmala UI',
        ),
      )..addText(text))
        .build()
      ..layout(ui.ParagraphConstraints(width: maxWidth));

    final recorder = ui.PictureRecorder();
    final canvas = ui.Canvas(recorder);
    canvas.drawParagraph(paragraph, ui.Offset.zero);
    final picture = recorder.endRecording();
    final image = await picture.toImage(
      maxWidth.ceil(),
      (paragraph.height + 2).ceil(),
    );
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return bytes!.buffer.asUint8List();
  }

  static Future<void> printToken(Map<String, dynamic> tokenData) async {
    final doc = pw.Document();

    // Load Kannada font for the receipt
    final kannadaFont = await PdfGoogleFonts.notoSansKannadaRegular();
    final kannadaFontBold = await PdfGoogleFonts.notoSansKannadaBold();

    final date = DateFormat('dd-MM-yyyy').format(DateTime.now());
    final time = DateFormat('HH:mm:ss').format(DateTime.now());
    final tokenCount = tokenData['token_count'];
    final receiptNo = tokenData['receipt_number'];
    const cardWidth = 56 * PdfPageFormat.mm;
    const pageContentWidth = cardWidth - (4 * PdfPageFormat.mm);
    final templeNameImage = pw.MemoryImage(
      await _renderKannadaSingleLineAsPng(
        _templeName,
        startFontSize: 10,
        minFontSize: 7.5,
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth,
      ),
    );
    final mahaPrasadaImage = pw.MemoryImage(
      await _renderKannadaTextAsPng(
        _mahaPrasada,
        fontSize: 16,
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth,
      ),
    );
    final devoteeCountLabelImage = pw.MemoryImage(
      await _renderKannadaSingleLineAsPng(
        _devoteeCountLabel,
        startFontSize: 12,
        minFontSize: 9,
        fontWeight: FontWeight.w700,
        maxWidth: pageContentWidth * 0.5,
      ),
    );

    const cardHeight = 70 * PdfPageFormat.mm;
    const pageWidth = 62 * PdfPageFormat.mm;

    doc.addPage(
      pw.Page(
        // Fixed custom portrait page to avoid landscape auto-rotation by drivers
        pageFormat: PdfPageFormat(
          pageWidth,
          cardHeight,
          marginTop: 1 * PdfPageFormat.mm,
          marginBottom: 1 * PdfPageFormat.mm,
          marginLeft: 3 * PdfPageFormat.mm,
          marginRight: 0 * PdfPageFormat.mm,
        ),
        orientation: pw.PageOrientation.portrait,
        build: (pw.Context context) {
          return pw.Align(
            alignment: pw.Alignment.topCenter,
            child: pw.Padding(
              padding: const pw.EdgeInsets.only(left: 0.3 * PdfPageFormat.mm),
              child: pw.Container(
              width: cardWidth,
              padding: const pw.EdgeInsets.fromLTRB(
                3.0 * PdfPageFormat.mm,
                3.5 * PdfPageFormat.mm,
                3.0 * PdfPageFormat.mm,
                2.5 * PdfPageFormat.mm,
              ),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.black, width: 1),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.center,
                mainAxisSize: pw.MainAxisSize.min,
                children: [
                  // Temple Name - force single-line feel with smaller font/image
                  pw.Center(
                    child: pw.Image(
                      templeNameImage,
                      width: pageContentWidth,
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                  pw.SizedBox(height: 3),
                  
                  // Receipt Number, Date and Time
                  pw.Container(
                    width: double.infinity,
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('R.No.: $receiptNo', style: pw.TextStyle(font: kannadaFontBold, fontSize: 9.5)),
                        pw.SizedBox(height: 0.8 * PdfPageFormat.mm),
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text('Date: $date', style: pw.TextStyle(font: kannadaFont, fontSize: 8.5)),
                            pw.Text(time, style: pw.TextStyle(font: kannadaFont, fontSize: 8.5)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  
                  pw.SizedBox(height: 2),
                  
                  pw.Container(
                    width: double.infinity,
                    alignment: pw.Alignment.center,
                    child: pw.Image(
                      mahaPrasadaImage,
                      width: pageContentWidth * 0.58,
                      fit: pw.BoxFit.contain,
                    ),
                  ),
                  
                  pw.SizedBox(height: 2),
                  pw.Divider(thickness: 0.8, color: PdfColors.black),
                  pw.SizedBox(height: 2),
                  
                  // Devotee Count - compact spacing between label and value
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.center,
                    children: [
                      pw.Image(
                        devoteeCountLabelImage,
                        width: pageContentWidth * 0.34,
                        fit: pw.BoxFit.contain,
                      ),
                      pw.SizedBox(width: 2 * PdfPageFormat.mm),
                      pw.Text(
                        '$tokenCount',
                        style: pw.TextStyle(font: kannadaFontBold, fontSize: 13),
                      ),
                    ],
                  ),
                  pw.SizedBox(height: 8),
                  pw.Center(
                    child: pw.Text(
                      '--- Thank You ---',
                      style: pw.TextStyle(font: kannadaFont, fontSize: 8),
                    ),
                  ),
                ],
              ),
            ),
            ),
          );
        },
      ),
    );

    // Try to find the default printer to skip the dialog
    try {
      final printers = await Printing.listPrinters();
      final defaultPrinter = printers.firstWhere((p) => p.isDefault, orElse: () => printers.first);
      
      await Printing.directPrintPdf(
        printer: defaultPrinter,
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
