import { useCallback } from 'react';

export function usePrinterAgent() {
  const refreshPrinters = useCallback(async () => {}, []);
  
  const printViaAgent = useCallback(async () => {
    throw new Error('Printer agent is disabled.');
  }, []);
  
  const triggerUpdate = useCallback(async () => {
    throw new Error('Printer agent is disabled.');
  }, []);

  return {
    availablePrinters: [],
    printerDetails: [],
    activePrinters: [],
    defaultPrinter: '',
    isAgentRunning: false,
    checking: false,
    agentVersion: null,
    latestVersion: null,
    updateAvailable: false,
    updating: false,
    refreshPrinters,
    printViaAgent,
    triggerUpdate,
  };
}
