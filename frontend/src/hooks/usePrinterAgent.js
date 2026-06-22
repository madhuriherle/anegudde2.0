import { useState, useEffect, useCallback, useRef } from 'react';

const AGENT_URL = 'http://127.0.0.1:5623';

function parseVersion(v) {
  return (v || '0.0.0').split('.').map(Number);
}

function isNewer(latest, current) {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal, cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function usePrinterAgent() {
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [printerDetails, setPrinterDetails] = useState([]);
  const [activePrinters, setActivePrinters] = useState([]);
  const [defaultPrinter, setDefaultPrinter] = useState('');
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agentVersion, setAgentVersion] = useState(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [updating, setUpdating] = useState(false);
  const mountedRef = useRef(true);
  const isHttps = window.location.protocol === 'https:';

  const updateAvailable = agentVersion && latestVersion && isNewer(latestVersion, agentVersion);

  const refreshPrinters = useCallback(async () => {
    // Browser blocks http://localhost from HTTPS pages — skip on HTTPS
    if (isHttps) {
      if (mountedRef.current) setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${AGENT_URL}/api/printers`, {
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
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
  }, [isHttps]);

  const checkHealth = useCallback(async () => {
    if (isHttps) return; // skip on HTTPS
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const data = await fetchJson(`${AGENT_URL}/api/health`, controller.signal);
      clearTimeout(timeout);
      if (mountedRef.current) {
        setAgentVersion(data.version || null);
      }
    } catch {
      if (mountedRef.current) {
        setAgentVersion(null);
      }
    }
  }, []);

  const checkLatestVersion = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const data = await fetchJson(`${window.location.origin}/api/downloads/printer-agent-version`, controller.signal);
      clearTimeout(timeout);
      if (mountedRef.current) {
        setLatestVersion(data.version || null);
      }
    } catch {
      if (mountedRef.current) {
        setLatestVersion(null);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const init = async () => {
      if (!cancelled) await refreshPrinters();
      if (!cancelled) await checkHealth();
      if (!cancelled) await checkLatestVersion();
    };

    init();

    const interval = setInterval(async () => {
      if (cancelled) return;
      await checkHealth();
      await checkLatestVersion();
    }, 60000);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refreshPrinters, checkHealth, checkLatestVersion]);

  const triggerUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const zipRes = await fetch(`${window.location.origin}/api/downloads/printer-agent`, {
        cache: 'no-store',
      });
      if (!zipRes.ok) throw new Error('Failed to download agent update from server');
      const blob = await zipRes.blob();

      const updateRes = await fetch(`${AGENT_URL}/api/update`, {
        method: 'POST',
        body: blob,
      });
      const result = await updateRes.json();
      if (result.status !== 'ok') throw new Error(result.error || 'Update failed');
      return result;
    } finally {
      if (mountedRef.current) setUpdating(false);
    }
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
    printerDetails,
    activePrinters,
    defaultPrinter,
    isAgentRunning,
    checking,
    agentVersion,
    latestVersion,
    updateAvailable,
    updating,
    refreshPrinters,
    printViaAgent,
    triggerUpdate,
  };
}
