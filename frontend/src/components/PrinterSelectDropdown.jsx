import { useEffect, useState, useCallback } from 'react';
import { Printer, Check, Loader2, AlertCircle, Settings2, RefreshCw, X, ExternalLink, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { usePrinterConfig, usePrinterContexts, getOrCreateMachineId } from '../hooks/usePrinterConfig';
import { usePrinterAgent } from '../hooks/usePrinterAgent';
import { useNotification } from '../context/NotificationContext';

export function PrinterSelectDropdown({ context, onPrint, disabled, buttonLabel = 'Print', pdfUrl }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { printerName, setPrinterName, save, isSaving } = usePrinterConfig(context);
  const { data: contexts } = usePrinterContexts();
  const {
    availablePrinters,
    printerDetails,
    defaultPrinter,
    isAgentRunning,
    checking: agentChecking,
    refreshPrinters,
    printViaAgent,
  } = usePrinterAgent();
  const { showSuccess, showError } = useNotification();

  const downloadAgentZip = useCallback(async () => {
    try {
      const res = await api.get('/downloads/printer-agent', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Anegudde_PrinterAgent.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showError('Failed to download Printer Agent. Please try again.');
    }
  }, [showError]);
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(printerName);
  const [saveDefault, setSaveDefault] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');

  const contextLabel = contexts?.find(c => c.code === context)?.label || context;
  const machineId = getOrCreateMachineId();

  const { data: savedList } = useQuery({
    queryKey: ['printer-configs', machineId],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/printer-configs', { params: { machine_id: machineId } });
        return res.data?.items || [];
      } catch (err) {
        return [];
      }
    },
    retry: false,
  });

  const savedPrinters = savedList?.filter((c) => c.printer_name) || [];
  const uniqueNames = [...new Set(savedPrinters.map((c) => c.printer_name))];
  const detailByName = new Map(printerDetails.map((printer) => [printer.name, printer]));
  const livePrinterNames = availablePrinters;
  const fallbackDefaultPrinters = [
    'Microsoft Print to PDF',
    'Microsoft XPS Document Writer',
    'OneNote (Desktop)',
    'Fax',
  ];
  const defaultPrinterNames = [
    ...uniqueNames,
    ...fallbackDefaultPrinters,
  ].filter((pname, index, list) => pname && list.indexOf(pname) === index);
  const nonLiveDefaultNames = defaultPrinterNames.filter((pname) => !livePrinterNames.includes(pname));
  const printerOptions = [
    ...livePrinterNames,
    ...nonLiveDefaultNames,
  ];
  const selectedPrinterName = printerName || defaultPrinter || livePrinterNames[0] || defaultPrinterNames[0] || '';
  const isVirtualPrinterName = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return [
      'microsoft print to pdf',
      'microsoft xps document writer',
      'onenote',
      'fax',
    ].some((virtualName) => normalized.includes(virtualName));
  };

  useEffect(() => {
    if (!printerName && selectedPrinterName) {
      setName(selectedPrinterName);
    }
  }, [printerName, selectedPrinterName]);

  const handleOpen = (e) => {
    e.stopPropagation();
    setName(selectedPrinterName);
    setSaveDefault(false);
    setPrintError('');
    setOpen(true);
  };

  const executePrint = useCallback(async (targetPrinter) => {
    setPrintError('');
    setPrinting(true);

    try {
      const selectedName = (targetPrinter || name || '').trim();
      if (!selectedName) {
        setOpen(true);
        setPrinting(false);
        return;
      }

      if (selectedName.trim().toLowerCase() === 'microsoft print to pdf') {
        if (onPrint) onPrint();
        setOpen(false);
        return;
      }

      const selectedDetail = detailByName.get(selectedName);
      const isVirtual = selectedDetail?.is_virtual || isVirtualPrinterName(selectedName);
      if (selectedDetail && selectedDetail.is_online === false && !isVirtual) {
        setPrintError(`${selectedName} is ${selectedDetail.status_text || 'offline'}. Select an active printer or click Refresh.`);
        setOpen(true);
        setPrinting(false);
        return;
      }

      if (isAgentRunning && pdfUrl) {
        const result = await printViaAgent(selectedName, pdfUrl);
        if (result.error) {
          setPrintError(result.error);
          setPrinting(false);
          // If direct print failed, open dialog to let user choose another
          if (!open) setOpen(true);
          return;
        }
        showSuccess(`Sent to ${selectedName}`);
        setOpen(false);
      } else {
        // Fallback to browser print if agent not running or no PDF
        if (onPrint) onPrint();
        setOpen(false);
      }
    } catch (err) {
      setPrintError(err.message);
      if (!open) setOpen(true);
    } finally {
      setPrinting(false);
    }
  }, [name, detailByName, isAgentRunning, pdfUrl, printViaAgent, onPrint, showSuccess, open]);

  const handleQuickPrint = (e) => {
    e.stopPropagation();
    if (selectedPrinterName) {
      executePrint(selectedPrinterName);
    } else {
      handleOpen(e);
    }
  };

  const handleModalPrint = async () => {
    const selectedName = name.trim();
    if (saveDefault && selectedName) {
      await save(selectedName);
    }
    setPrinterName(selectedName);
    executePrint(selectedName);
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (onPrint) onPrint();
      }}
      disabled={disabled}
      className="flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg"
      title={buttonLabel}
    >
      <Printer className="h-4 w-4" />
      <span>{buttonLabel}</span>
    </button>
  );
}
