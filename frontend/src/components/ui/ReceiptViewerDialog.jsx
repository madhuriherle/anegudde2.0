import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Loader2, X, Receipt } from 'lucide-react';
import api from "../../api/axios";
import { useNotification } from "../../context/NotificationContext";
import PrePrintedSevaReceipt from "../PrePrintedSevaReceipt";
import { PrinterSelectDropdown } from "../PrinterSelectDropdown";
import { useQuery } from '@tanstack/react-query';

export function ReceiptViewerDialog({
  open,
  onOpenChange,
  donationId,
  receiptNumber,
}) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [donationData, setDonationData] = useState(null);
  const { showError } = useNotification();
  const previewScale = 0.9;
  
  const prePrintedRef = useRef();

  const { data: systemSettings } = useQuery({
    queryKey: ['system-settings', 'receipt'],
    queryFn: async () => (await api.get('/settings/get_current_settings')).data,
    enabled: open
  });

  useEffect(() => {
    if (open && donationId) {
      const fetchData = async () => {
        try {
          setLoading(true);
          
          // 1. Fetch PDF Blob for standard view
          const pdfResponse = await api.get("/donations/download_stored_receipt/" + donationId, {
            responseType: "blob",
          });
          const url = window.URL.createObjectURL(new Blob([pdfResponse.data], { type: "application/pdf" }));
          setBlobUrl(url);

          // 2. Fetch Full Donation Data for Card view
          const dataResponse = await api.get("/donations/get_donation/" + donationId);
          setDonationData(dataResponse.data);

        } catch (err) {
          showError("Failed to load receipt data");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setDonationData(null);
    }
  }, [open, donationId]);

  const onPrintClick = () => {
    const printContent = document.getElementById('receipt-print-content');
    if (!printContent) return;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '148mm';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    // Minimal CSS for the receipt
    const printStyles = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;700&family=Merriweather:wght@400;700&display=swap');
      
      html,
      body { 
        width: 210mm;
        height: 148mm;
        margin: 0; 
        padding: 0; 
        background: white !important; 
        font-family: 'Nirmala UI', 'Noto Sans Kannada', sans-serif;
        overflow: hidden;
      }
      @page { 
        size: A5 landscape; 
        margin: 0; 
      }
      * { 
        box-sizing: border-box; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact; 
      }
      .print-only { 
        display: block !important; 
        width: 210mm; 
        height: 148mm; 
        margin: 0;
        padding: 0;
        overflow: hidden; 
        position: relative;
      }
      .preview-only-header {
        display: none !important;
      }
      .print-invisible {
        visibility: hidden !important;
      }
      table { border-collapse: collapse; }
    `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Receipt</title>
          <style>${printStyles}</style>
        </head>
        <body>
          <div class="print-only">
            ${printContent.innerHTML}
          </div>
          <script>
            // Ensure fonts are loaded
            document.fonts.ready.then(() => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 500);
            });
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Cleanup iframe after a delay
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={true} className="w-fit max-w-[calc(100vw-2rem)] h-fit max-h-[96vh] p-0 flex flex-col bg-white overflow-hidden shadow-2xl rounded-2xl border-none">
        {/* Custom Header - Perfect Fit */}
        <div className="shrink-0 flex items-center bg-[#F6EEDF] border-b border-[#E2D2B8] px-6 py-4">
          <div className="flex items-center gap-3 pr-10">
            <Receipt className="h-6 w-6 text-primary" />
            <DialogTitle className="text-lg font-bold font-temple text-[#2F1F14] uppercase tracking-tight m-0">
              Receipt Preview: {donationData?.receipt_display_number || '...'}
            </DialogTitle>
            <DialogDescription className="sr-only">Preview of the donation receipt.</DialogDescription>
          </div>
        </div>

        {/* Content Area - No Padding for perfect fit */}
        <div className="overflow-hidden bg-bg-temple flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 bg-white p-12 min-w-[400px] min-h-[250px]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Loading Receipt...</p>
            </div>
          ) : (
            <div
              className="relative bg-white border border-black shrink-0"
              style={{
                width: `${210 * previewScale}mm`,
                height: `${148 * previewScale}mm`,
              }}
            >
              <div
                className="origin-top-left"
                style={{
                  width: '210mm',
                  height: '148mm',
                  transform: `scale(${previewScale})`,
                }}
              >
                <div id="receipt-print-content">
                  <PrePrintedSevaReceipt 
                    ref={prePrintedRef}
                    donation={donationData}
                    settings={systemSettings}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Custom Footer - Improved UI */}
        <div className="shrink-0 flex items-center justify-between bg-[#F3E8D4] border-t border-[#E2D2B8] px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl bg-white border border-[#D9C8AF] px-8 text-sm font-bold text-text-main transition-all hover:bg-[#FAF7F2]"
          >
            Close
          </button>
          
          <PrinterSelectDropdown
            context="DONATION_RECEIPT"
            pdfUrl={blobUrl || undefined}
            onPrint={onPrintClick}
            disabled={loading}
            buttonLabel="Print Receipt"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
