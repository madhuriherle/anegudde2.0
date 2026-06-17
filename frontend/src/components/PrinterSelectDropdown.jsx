import { useEffect, useState, useCallback } from 'react';
import { Printer, Check, Loader2, AlertCircle, Settings2, RefreshCw, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { usePrinterConfig, usePrinterContexts, getOrCreateMachineId } from '../hooks/usePrinterConfig';
import { usePrinterAgent } from '../hooks/usePrinterAgent';
import { useNotification } from '../context/NotificationContext';

export function PrinterSelectDropdown({ context, onPrint, disabled, buttonLabel = 'Print', pdfUrl }) {
  const queryClient = useQueryClient();
  const { printerName, setPrinterName, save, isSaving } = usePrinterConfig(context);
  const { data: contexts } = usePrinterContexts();
  const {
    availablePrinters,
    printerDetails,
    activePrinters,
    defaultPrinter,
    isAgentRunning,
    checking: agentChecking,
    refreshPrinters,
    printViaAgent,
  } = usePrinterAgent();
  const { showSuccess, showError } = useNotification();
  
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
      const res = await api.get('/settings/printer-configs', { params: { machine_id: machineId } });
      return res.data?.items || [];
    },
  });

  const savedPrinters = savedList?.filter((c) => c.printer_name) || [];
  const uniqueNames = [...new Set(savedPrinters.map((c) => c.printer_name))];
  const detailByName = new Map(printerDetails.map((printer) => [printer.name, printer]));
  const activePrinterNames = printerDetails.length > 0 ? activePrinters : availablePrinters;
  const fallbackVirtualPrinters = [
    'Microsoft Print to PDF',
    'Microsoft XPS Document Writer',
    'OneNote (Desktop)',
    'Fax',
  ];
  const shouldShowFallbackPrinters = !isAgentRunning || availablePrinters.length === 0;
  const printerOptions = [
    ...activePrinterNames,
    ...availablePrinters.filter((pname) => !activePrinterNames.includes(pname)),
    ...uniqueNames.filter((pname) => !availablePrinters.includes(pname)),
    ...(
      shouldShowFallbackPrinters
        ? fallbackVirtualPrinters.filter((pname) => !availablePrinters.includes(pname) && !uniqueNames.includes(pname))
        : []
    ),
  ];
  const selectedPrinterName = printerName || defaultPrinter || (shouldShowFallbackPrinters ? 'Microsoft Print to PDF' : '');
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
    <>
      <div className="flex items-center">
        <button
          onClick={handleQuickPrint}
          disabled={disabled || printing}
          className="flex h-11 items-center gap-2 rounded-l-xl bg-primary pl-6 pr-4 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-all border-r border-white/20 shadow-lg"
          title={selectedPrinterName ? `Print directly to ${selectedPrinterName}` : 'Click to select printer'}
        >
          {printing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          <div className="flex flex-col items-start leading-none">
            <span>{printing ? 'Printing...' : buttonLabel}</span>
            {selectedPrinterName && !printing && (
              <span className="text-[10px] opacity-70 font-medium truncate max-w-[120px]">
                via {selectedPrinterName}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={handleOpen}
          disabled={disabled || printing}
          className="flex h-11 w-10 items-center justify-center rounded-r-xl bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg"
          title="Change printer settings"
        >
          <Settings2 className="h-4 w-4 text-white/80" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-[560px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-7 shadow-2xl border border-border-temple/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="-mx-7 -mt-7 mb-6 flex items-center justify-between rounded-t-2xl border-b border-[#E2D2B8] bg-[#F6EEDF] px-7 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Printer className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary leading-tight">Print {contextLabel}</h3>
                  <p className="text-xs font-medium text-text-light">Select a printer for this computer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8C8B8] bg-white text-[#7C5A45] shadow-sm transition-all hover:border-[#CFA98A] hover:bg-[#FDF1E8] hover:text-[#A64B18] focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label="Close printer selector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {printerOptions.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-[#8B4513] uppercase tracking-wider">
                      {isAgentRunning ? 'Active Printers' : 'Default Printers'}
                    </label>
                    <button
                      type="button"
                      onClick={refreshPrinters}
                      disabled={agentChecking}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-temple/60 bg-white px-2 text-[10px] font-bold text-text-main hover:bg-gray-50 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${agentChecking ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  {activePrinterNames.length === 0 && isAgentRunning && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <p className="text-xs font-semibold text-amber-800">
                        No active printer found. Check printer power/cable and click Refresh.
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {printerOptions.map((pname) => {
                      const detail = detailByName.get(pname);
                      const isVirtual = detail?.is_virtual || isVirtualPrinterName(pname);
                      const isOnline = isVirtual || (detail ? detail.is_online : true);
                      const statusText = detail?.status_text || (isOnline ? 'Ready' : 'Offline');

                      return (
                        <button
                          key={pname}
                          onClick={() => setName(pname)}
                          className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left text-sm font-semibold transition-all ${
                            name === pname
                              ? 'border-primary bg-primary/5 text-primary shadow-sm'
                              : 'border-border-temple/50 bg-white text-text-main hover:border-primary/30'
                          } ${!isOnline ? 'opacity-70' : ''}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{pname}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {detail?.is_default && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700">
                                  Default
                                </span>
                              )}
                              {isVirtual && (
                                <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-purple-700">
                                  Virtual
                                </span>
                              )}
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {isOnline ? 'Online' : statusText}
                              </span>
                            </span>
                          </span>
                          {name === pname && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#8B4513] uppercase tracking-wider mb-3 block">Or Type Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. EPSON TM-T81"
                  className="h-12 w-full rounded-xl border border-border-temple/60 bg-white px-4 text-base font-semibold text-text-main focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveDefault}
                    onChange={(e) => setSaveDefault(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text-main">Set as Default</span>
                    <span className="text-[11px] text-text-light font-medium">Remember this printer for next time on this PC</span>
                  </div>
                </label>
              </div>

              {printError && (
                <div className="flex items-start gap-3 bg-red-50 p-4 rounded-xl border border-red-100">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-red-700">{printError}</p>
                </div>
              )}

            </div>

            <div className="flex items-center gap-3 justify-end bg-[#F3E8D4] border-t border-border-temple/40 -mx-7 -mb-7 px-6 py-4 mt-6 rounded-b-2xl">
              <button
                onClick={() => setOpen(false)}
                disabled={printing}
                className="h-12 rounded-xl border border-border-temple/60 bg-white px-8 text-sm font-bold text-text-main hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleModalPrint}
                disabled={printing || !name.trim()}
                className="flex h-12 items-center gap-2 rounded-xl bg-primary px-10 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg"
              >
                {printing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {printing ? 'Printing...' : 'Print Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
