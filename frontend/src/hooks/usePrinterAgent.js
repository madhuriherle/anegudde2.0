import { useState, useEffect, useCallback, useRef } from 'react';

const AGENT_URL = 'http://localhost:5623';

export function usePrinterAgent() {
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [printerDetails, setPrinterDetails] = useState([]);
  const [activePrinters, setActivePrinters] = useState([]);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const mountedRef = useRef(true);

  const refreshPrinters = useCallback(async () => {
    setChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${AGENT_URL}/api/printers`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error('Printer agent request failed');
      }

      const data = await res.json();
      const details = data.printer_details || [];
      const names = data.printers || details.map((printer) => printer.name).filter(Boolean);
      const activeNames = data.active_printers || details
        .filter((printer) => printer.is_online)
        .map((printer) => printer.name);

      if (mountedRef.current) {
        setAvailablePrinters(names);
        setPrinterDetails(details);
        setActivePrinters(activeNames);
        setDefaultPrinter(data.default || '');
        setIsAgentRunning(true);
      }
    } catch {
      if (mountedRef.current) {
        setIsAgentRunning(false);
        setAvailablePrinters([]);
        setPrinterDetails([]);
        setActivePrinters([]);
      }
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const check = async () => {
      if (!cancelled) await refreshPrinters();
    };

    check();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [refreshPrinters]);

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
    printerDetails,
    activePrinters,
    defaultPrinter,
    isAgentRunning,
    checking,
    refreshPrinters,
    printViaAgent,
  };
}
