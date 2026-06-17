import { useState, useEffect, useCallback, useRef } from 'react';

const AGENT_URL = 'http://localhost:5623';

export function usePrinterAgent() {
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${AGENT_URL}/api/printers`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!cancelled && res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setAvailablePrinters(data.printers || []);
            setDefaultPrinter(data.default || '');
            setIsAgentRunning(true);
          }
        }
      } catch {
        if (!cancelled) {
          setIsAgentRunning(false);
          setAvailablePrinters([]);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    check();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const printViaAgent = useCallback(async (printerName, pdfUrl) => {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    const blob = await response.blob();

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const pdfBase64 = btoa(binary);

    const res = await fetch(`${AGENT_URL}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_name: printerName,
        pdf_base64: pdfBase64,
        filename: 'print.pdf',
      }),
    });

    return res.json();
  }, []);

  return {
    availablePrinters,
    defaultPrinter,
    isAgentRunning,
    checking,
    printViaAgent,
  };
}
