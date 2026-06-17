import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Trash2, Save, Check, Monitor, XCircle, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { usePermission } from '../hooks/usePermission';
import { usePrinterConfig, usePrinterContexts, getOrCreateMachineId } from '../hooks/usePrinterConfig';
import { usePrinterAgent } from '../hooks/usePrinterAgent';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

const PrinterSettingsPage = () => {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('settings.printers.write');
  const machineId = getOrCreateMachineId();
  
  const { data: contextList, isLoading: contextsLoading } = usePrinterContexts();
  const contexts = contextList || [];
  const assignableContexts = contexts.filter(c => c.code !== 'TOKEN');

  const {
    availablePrinters,
    printerDetails,
    activePrinters,
    isAgentRunning,
    checking: agentChecking,
    defaultPrinter,
    refreshPrinters,
  } = usePrinterAgent();

  const [showManual, setShowManual] = useState(false);
  const [newEntries, setNewEntries] = useState({});
  const [editing, setEditing] = useState({});
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTask, setCustomTask] = useState({ code: '', label: '' });
  const [selectedTasks, setSelectedTasks] = useState({}); // { printerName: [code1, code2] }

  const { data, isLoading } = useQuery({
    queryKey: ['printer-configs'],
    queryFn: async () => {
      const res = await api.get('/settings/printer-configs');
      return res.data;
    },
  });

  const configs = data?.items || [];

  const upsertMutation = useMutation({
    mutationFn: async ({ context, machine_id, printer_name }) => {
      return (await api.put('/settings/printer-config', {
        context, machine_id, printer_name, is_default: true,
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configs'] });
      queryClient.invalidateQueries({ queryKey: ['printer-contexts'] });
      contexts.forEach(c => queryClient.invalidateQueries({ queryKey: ['printer-config', c.code] }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/settings/printer-config/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configs'] });
      queryClient.invalidateQueries({ queryKey: ['printer-contexts'] });
    },
  });

  const handleAddOrUpdate = async (context, nameOverride) => {
    const name = nameOverride || newEntries[context]?.trim();
    if (!name) return;
    try {
      await upsertMutation.mutateAsync({ context, machine_id: machineId, printer_name: name });
      if (!nameOverride) {
        setNewEntries((prev) => ({ ...prev, [context]: '' }));
      }
      const label = contexts.find(c => c.code === context)?.label || context;
      showSuccess(`Printer saved for ${label}`);
    } catch {
      showError('Failed to save printer config');
    }
  };

  const handleBatchAssign = async (printerName) => {
    const codes = selectedTasks[printerName] || [];
    if (codes.length === 0) {
      showError("Please select at least one task");
      return;
    }

    try {
      await Promise.all(codes.map(code => 
        upsertMutation.mutateAsync({ 
          context: code, 
          machine_id: machineId, 
          printer_name: printerName 
        })
      ));
      showSuccess(`Printer assigned to ${codes.length} tasks`);
      setSelectedTasks(prev => ({ ...prev, [printerName]: [] }));
    } catch {
      showError('Failed to save some assignments');
    }
  };

  const toggleTaskSelection = (printerName, code) => {
    setSelectedTasks(prev => {
      const current = prev[printerName] || [];
      const next = current.includes(code) 
        ? current.filter(c => c !== code) 
        : [...current, code];
      return { ...prev, [printerName]: next };
    });
  };

  const handleAddCustom = async () => {
    if (!customTask.code || !customTask.label) return;
    // We just need to trigger a save to make it appear in the list
    // But wait, the list is derived from DB contexts or standard ones.
    // So we need to assign a printer to it to make it "stick" in the DB.
    showAddCustom(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
      showSuccess('Printer config deleted');
    } catch {
      showError('Failed to delete');
    }
  };

  const existingMap = {};
  configs.forEach((c) => {
    const key = `${c.machine_id || ''}:${c.context}`;
    existingMap[key] = c;
  });

  return (
    <div className="max-w-6xl space-y-6">
      {/* ... (Agent card remains same) */}
      <Card className="border-border-temple shadow-sm overflow-hidden">
        <div className="bg-[#F8F4EE] px-6 py-4 border-b border-border-temple/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isAgentRunning ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-secondary">Printer Agent Connection</h3>
              <p className="text-xs font-medium text-text-light">
                {agentChecking ? 'Checking local agent...' : isAgentRunning ? 'Agent is running on localhost:5623' : 'Agent not detected locally'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAgentRunning && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </span>
            )}
            <button
              type="button"
              onClick={refreshPrinters}
              disabled={agentChecking}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border-temple/60 bg-white px-3 text-xs font-bold text-text-main hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${agentChecking ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        
        <CardContent className="p-6">
          {(!isAgentRunning && !agentChecking && !showManual) ? (
            <div className="flex flex-col md:flex-row items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <div>
                  <p className="text-sm font-bold text-amber-900">Browser Security Blocked Connection</p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Modern browsers block websites on <span className="font-mono">HTTP</span> from talking to your local PC. 
                    Your Printer Agent is running, but the browser won't let the website see it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                    onClick={() => setShowManual(true)}
                  >
                    Use Manual Setup
                  </Button>
                </div>
              </div>
            </div>
          ) : (agentChecking && !showManual) ? (
            <div className="flex items-center gap-3 py-4 text-text-light">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Scanning for printers...</span>
            </div>
          ) : isAgentRunning ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-secondary uppercase tracking-wider">Printers on this PC</h4>
                <span className="text-xs font-bold text-text-light">
                  {activePrinters.length} active / {availablePrinters.length} installed
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availablePrinters.length > 0 ? (
                  availablePrinters.map((name) => {
                    const detail = printerDetails.find((printer) => printer.name === name);
                    const isOnline = detail ? detail.is_online : true;
                    const statusText = detail?.status_text || (isOnline ? 'Ready' : 'Offline');

                    return (
                      <div
                        key={name}
                        className={`group flex flex-col p-4 rounded-xl border bg-white transition-all cursor-default ${
                          isOnline
                            ? 'border-border-temple/60 hover:border-primary/50 hover:shadow-md'
                            : 'border-red-100 bg-red-50/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          {isOnline ? (
                            <Printer className="h-4 w-4 text-primary/60 group-hover:text-primary" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <div className="flex flex-wrap justify-end gap-1">
                            {(detail?.is_default || name === defaultPrinter) && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">DEFAULT</span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isOnline ? 'text-green-600 bg-green-50' : 'text-red-700 bg-red-100'
                            }`}>
                              {isOnline ? 'ONLINE' : statusText.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-text-main truncate mb-1" title={name}>{name}</p>
                        <p className="text-[11px] font-medium text-text-light mb-3 truncate" title={statusText}>{statusText}</p>
                        
                        <div className="mt-auto space-y-2">
                          <div className="relative">
                            <div className="max-h-32 overflow-y-auto border border-border-temple/40 rounded bg-gray-50/50 p-1.5 custom-scrollbar">
                              <label className="flex items-center gap-2 px-1 py-0.5 hover:bg-primary/5 rounded cursor-pointer mb-1 border-b border-border-temple/20 pb-1">
                                <input 
                                  type="checkbox" 
                                  className="h-3 w-3 accent-primary"
                                  checked={selectedTasks[name]?.length === assignableContexts.length && assignableContexts.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedTasks(prev => ({ ...prev, [name]: assignableContexts.map(c => c.code) }));
                                    } else {
                                      setSelectedTasks(prev => ({ ...prev, [name]: [] }));
                                    }
                                  }}
                                />
                                <span className="text-[10px] font-bold text-primary">SELECT ALL REPORTS</span>
                              </label>
                              {assignableContexts.map((ctx) => (
                                <label key={ctx.code} className="flex items-center gap-2 px-1 py-0.5 hover:bg-primary/5 rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    className="h-3 w-3 accent-primary"
                                    checked={(selectedTasks[name] || []).includes(ctx.code)}
                                    onChange={() => toggleTaskSelection(name, ctx.code)}
                                  />
                                  <span className="text-[10px] font-medium text-text-main truncate">{ctx.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isOnline || !canWrite || (selectedTasks[name] || []).length === 0}
                            className="h-7 text-[10px] font-bold w-full bg-primary/5 hover:bg-primary/10 text-primary hover:text-primary border-primary/20 shadow-none hover:shadow-none translate-y-0 hover:translate-y-0"
                            onClick={() => handleBatchAssign(name)}
                          >
                            ASSIGN TO {(selectedTasks[name] || []).length || ""} TASKS
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-text-light italic">No printers found by the agent.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-3 bg-amber-50 rounded-full text-amber-600 mb-3">
                <Monitor className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-secondary">Manual Entry Mode Enabled</p>
              <p className="text-xs text-text-light max-w-sm mt-1">
                Type your printer names manually in the table below. The app will use these names to talk to your Printer Agent.
              </p>
              <button 
                onClick={() => setShowManual(false)}
                className="mt-4 text-xs font-bold text-primary hover:underline"
              >
                Try automatic detection again
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-secondary">
                  Saved Configurations
                </h3>
                <p className="text-sm font-medium text-text-light">
                  Machine ID: <span className="font-mono font-bold text-text-main">{machineId}</span>
                </p>
              </div>
            </div>
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="flex items-center gap-2 border-primary/20 text-primary bg-primary/5"
              >
                <Plus className="h-4 w-4" />
                Add Custom Task
              </Button>
            )}
          </div>

          {showAddCustom && (
            <div className="mb-6 p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 space-y-4">
              <p className="text-xs font-bold text-primary uppercase">New Custom Printing Task</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-light uppercase px-1">Task Code (No spaces)</label>
                  <Input 
                    placeholder="e.g. CUSTOM_REPORT"
                    value={customTask.code}
                    onChange={(e) => setCustomTask({...customTask, code: e.target.value.toUpperCase().replace(/\s+/g, '_')})}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-light uppercase px-1">Display Label</label>
                  <Input 
                    placeholder="e.g. My Custom Report"
                    value={customTask.label}
                    onChange={(e) => setCustomTask({...customTask, label: e.target.value})}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    className="h-10 flex-1"
                    disabled={!customTask.code || !customTask.label}
                    onClick={() => {
                      // To make it appear in the list, we must at least give it an empty assignment
                      // Or we can just add it to the local state and let the user assign a printer
                      const newCtx = { code: customTask.code, label: customTask.label };
                      // Since the list comes from backend, we should probably just store it in DB
                      // But the backend combines standard + DB contexts.
                      // So assigning empty name works.
                      handleAddOrUpdate(customTask.code, " ");
                      setCustomTask({ code: '', label: '' });
                      setShowAddCustom(false);
                    }}
                  >
                    Create Task
                  </Button>
                  <Button 
                    variant="ghost"
                    className="h-10 px-3"
                    onClick={() => setShowAddCustom(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border-temple/60">
            <div className="grid grid-cols-[1fr_1.2fr_auto] gap-4 border-b border-border-temple/60 bg-[#F8F4EE] px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#8B4513]">
              <span>Task</span>
              <span>Printer Name</span>
              <span className="w-24 text-center">Actions</span>
            </div>

            {contexts.map((ctx) => {
              const context = ctx.code;
              const key = `${machineId}:${context}`;
              const existing = existingMap[key];
              const isSaving = upsertMutation.isPending;

              return (
                <div
                  key={context}
                  className="grid grid-cols-[1fr_1.2fr_auto] gap-4 items-center border-b border-[#F3E8DE] px-5 py-3 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text-main">
                      {ctx.label}
                    </span>
                    <span className="text-[10px] font-mono text-text-light">{context}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={newEntries[context] ?? existing?.printer_name ?? ''}
                      onChange={(e) =>
                        setNewEntries((prev) => ({ ...prev, [context]: e.target.value }))
                      }
                      disabled={!canWrite}
                      placeholder="e.g. XP-80 Cutter"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-1.5 w-24">
                    {(newEntries[context]?.trim() || existing?.printer_name) && (
                      <button
                        onClick={() => handleAddOrUpdate(context)}
                        disabled={!canWrite || isSaving || (!newEntries[context]?.trim() && existing?.printer_name === newEntries[context])}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-temple/60 bg-white text-primary hover:bg-primary/5 disabled:opacity-40 transition-all"
                        title="Save"
                      >
                        {isSaving ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {existing && (
                      <button
                        onClick={() => handleDelete(existing.id)}
                        disabled={!canWrite}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-temple/60 bg-white text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-text-light/70">
            Assign a printer name for each task on this computer. You can also add custom tasks if you are integrating new reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrinterSettingsPage;
