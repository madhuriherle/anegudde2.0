import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Trash2, Save, Check, Monitor, XCircle, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { usePermission } from '../hooks/usePermission';
import { usePrinterConfig, CONTEXT_LABELS, CONTEXTS } from '../hooks/usePrinterConfig';
import { usePrinterAgent } from '../hooks/usePrinterAgent';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

const PrinterSettingsPage = () => {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const canWrite = hasPermission('settings.management.write');
  const { machineId } = usePrinterConfig(CONTEXTS[0]);
  const { availablePrinters, isAgentRunning, checking: agentChecking, defaultPrinter } = usePrinterAgent();

  const [newEntries, setNewEntries] = useState({});
  const [editing, setEditing] = useState({});

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
      CONTEXTS.forEach(c => queryClient.invalidateQueries({ queryKey: ['printer-config', c] }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/settings/printer-config/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configs'] });
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
      showSuccess(`Printer saved for ${CONTEXT_LABELS[context]}`);
    } catch {
      showError('Failed to save printer config');
    }
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
      {/* Printer Agent Status Card */}
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
          {isAgentRunning && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Connected
            </span>
          )}
        </div>
        
        <CardContent className="p-6">
          {!isAgentRunning && !agentChecking ? (
            <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-900">Printer Agent Not Found</p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  To automatically detect printers and print directly without browser dialogs, please ensure the <span className="font-bold">Printer Agent</span> is running on this computer.
                </p>
              </div>
            </div>
          ) : agentChecking ? (
            <div className="flex items-center gap-3 py-4 text-text-light">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Scanning for printers...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-secondary uppercase tracking-wider">Available Printers on this PC</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availablePrinters.length > 0 ? (
                  availablePrinters.map((name) => (
                    <div 
                      key={name}
                      className="group flex flex-col p-4 rounded-xl border border-border-temple/60 bg-white hover:border-primary/50 hover:shadow-md transition-all cursor-default"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Printer className="h-4 w-4 text-primary/60 group-hover:text-primary" />
                        {name === defaultPrinter && (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">DEFAULT</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-text-main truncate mb-3" title={name}>{name}</p>
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] font-bold px-0 py-0"
                          onClick={() => handleAddOrUpdate('TOKEN', name)}
                        >
                          SET TOKEN
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] font-bold px-0 py-0"
                          onClick={() => handleAddOrUpdate('DONATION_RECEIPT', name)}
                        >
                          SET DONATION
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-light italic">No printers found by the agent.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border-temple shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center gap-3">
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

          <div className="overflow-hidden rounded-xl border border-border-temple/60">
            <div className="grid grid-cols-[1fr_1.2fr_auto] gap-4 border-b border-border-temple/60 bg-[#F8F4EE] px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#8B4513]">
              <span>Task</span>
              <span>Printer Name</span>
              <span className="w-24 text-center">Actions</span>
            </div>

            {CONTEXTS.map((context) => {
              const key = `${machineId}:${context}`;
              const existing = existingMap[key];
              const isSaving = upsertMutation.isPending;

              return (
                <div
                  key={context}
                  className="grid grid-cols-[1fr_1.2fr_auto] gap-4 items-center border-b border-[#F3E8DE] px-5 py-3 last:border-b-0"
                >
                  <span className="text-sm font-bold text-text-main">
                    {CONTEXT_LABELS[context]}
                  </span>

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
                        disabled={!canWrite || isSaving || !newEntries[context]?.trim()}
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
            Assign a printer name for each task on this computer. The app will remember and use it automatically when printing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrinterSettingsPage;

