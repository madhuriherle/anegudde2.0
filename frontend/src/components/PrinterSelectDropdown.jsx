import { useEffect, useState, useCallback } from 'react';
import { Printer, Check, Loader2, AlertCircle, ChevronDown, Settings2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { usePrinterConfig, CONTEXT_LABELS, getOrCreateMachineId } from '../hooks/usePrinterConfig';
import { usePrinterAgent } from '../hooks/usePrinterAgent';
import { useNotification } from '../context/NotificationContext';

export function PrinterSelectDropdown({ context, onPrint, disabled, buttonLabel = 'Print', pdfUrl }) {
  const queryClient = useQueryClient();
  const { printerName, setPrinterName, save, isSaving } = usePrinterConfig(context);
  const { availablePrinters, defaultPrinter, isAgentRunning, checking: agentChecking, printViaAgent } = usePrinterAgent();
  const { showSuccess, showError } = useNotification();
  
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(printerName);
  const [saveDefault, setSaveDefault] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');

  const contextLabel = CONTEXT_LABELS[context] || context;
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
  const printerOptions = [
    ...availablePrinters,
    ...uniqueNames.filter((pname) => !availablePrinters.includes(pname)),
  ];
  const selectedPrinterName = printerName || defaultPrinter;
  const isMicrosoftPrintToPdf = (value) =>
    String(value || '').trim().toLowerCase() === 'microsoft print to pdf';

  useEffect(() => {
    if (!printerName && defaultPrinter) {
      setName(defaultPrinter);
    }
  }, [printerName, defaultPrinter]);

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

      if (isMicrosoftPrintToPdf(selectedName)) {
        if (onPrint) onPrint();
        setOpen(false);
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
  }, [name, isAgentRunning, pdfUrl, printViaAgent, onPrint, showSuccess, open]);

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
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Printer className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-secondary leading-tight">Print {contextLabel}</h3>
                  <p className="text-xs font-medium text-text-light">Select a printer for this computer</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Check className="h-5 w-5 text-text-light rotate-45" />
              </button>
            </div>

            <div className="space-y-6">
              {printerOptions.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-[#8B4513] uppercase tracking-wider mb-3 block">Available Printers</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {printerOptions.map((pname) => (
                      <button
                        key={pname}
                        onClick={() => setName(pname)}
                        className={`flex h-12 items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition-all ${
                          name === pname
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-border-temple/50 bg-white text-text-main hover:border-primary/30'
                        }`}
                      >
                        <span className="truncate">{pname}</span>
                        {name === pname && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))}
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

              <div className="flex items-center gap-3 justify-end pt-2">
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
        </div>
      )}
    </>
  );
}
