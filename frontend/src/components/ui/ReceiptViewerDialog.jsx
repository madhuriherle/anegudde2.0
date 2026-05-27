import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { Loader2, ReceiptText, XCircle, X } from 'lucide-react';
import api from "../../api/axios";
import { useNotification } from "../../context/NotificationContext";

export function ReceiptViewerDialog({
  open,
  onOpenChange,
  donationId,
  receiptNumber,
}) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const { showError } = useNotification();

  useEffect(() => {
    if (open && donationId) {
      const fetchPdf = async () => {
        try {
          setLoading(true);
          const response = await api.get("/donations/download_stored_receipt/" + donationId, {
            responseType: "blob",
          });
          const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
          setBlobUrl(url);
        } catch (err) {
          showError("Failed to load receipt preview");
        } finally {
          setLoading(false);
        }
      };
      fetchPdf();
    } else {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    }
  }, [open, donationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[850px] w-full h-[92vh] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white">
        {/* Professional Header - Theme Cream */}
        <DialogHeader className="m-0 bg-[#F6EEDF] px-6 py-3 flex flex-row items-center justify-between shrink-0 border-b border-border-temple/40">
          <div className="flex items-center gap-3">
            <ReceiptText className="text-primary w-5 h-5" />
            <DialogTitle className="text-lg font-bold text-text-main font-temple">
              Donation Receipt
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview and download the selected donation receipt.
            </DialogDescription>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-text-main/50 hover:text-text-main transition-colors ml-4"
          >
            <X className="w-6 h-6" />
          </button>
        </DialogHeader>

        {/* Immersive Body - Direct PDF Display */}
        <div className="flex-1 overflow-hidden bg-white">
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Opening Receipt...</p>
            </div>
          ) : blobUrl ? (
            <iframe
              id="receipt-preview-frame"
              src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              style={{ border: 'none', outline: 'none' }}
              className="w-full h-full"
              title="Receipt Preview"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-red-500">
              <XCircle className="w-12 h-12 mb-2" />
              <p className="font-bold">Failed to load preview</p>
            </div>
          )}
        </div>

        {/* Professional Footer - Theme Footer Cream */}
        <DialogFooter className="!px-6 !py-4 !m-0 border-t border-border-temple/40 flex justify-end shrink-0 bg-[#F3E8D4]">
          <Button onClick={() => onOpenChange(false)} className="px-6 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold border-none shadow-md">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
