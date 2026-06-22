import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

const MACHINE_ID_KEY = 'printer_machine_id';

function getOrCreateMachineId() {
  let id = localStorage.getItem(MACHINE_ID_KEY);
  if (!id) {
    id = 'PC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem(MACHINE_ID_KEY, id);
  }
  return id;
}

const CONTEXT_LABELS = {
  DONATION_RECEIPT: 'Donation Receipt',
  TOKEN: 'Token Receipt',
  REPORT_STOCK: 'Stock Summary Report',
  REPORT_CANTEEN: 'Canteen Summary Report',
  REPORT_MANPOWER: 'Manpower Report',
  REPORT_DONATION: 'Donation Report',
  REPORT_TOKEN: 'Token Issued Report',
  REPORT_PURCHASE: 'Purchase Report',
};

const CONTEXTS = Object.keys(CONTEXT_LABELS);

export function usePrinterContexts() {
  return useQuery({
    queryKey: ['printer-contexts'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/printer-contexts');
        return res.data; // Array of {code, label}
      } catch (err) {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
}

export function usePrinterConfig(context) {
  const queryClient = useQueryClient();
  const machineId = getOrCreateMachineId();
  const [printerName, setPrinterName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['printer-config', context, machineId],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/printer-config', {
          params: { context, machine_id: machineId },
        });
        return res.data;
      } catch (err) {
        return null;
      }
    },
    enabled: !!context,
    retry: false,
  });

  useEffect(() => {
    if (config?.printer_name) {
      setPrinterName(config.printer_name);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (name) => {
      return (await api.put('/settings/printer-config', {
        machine_id: machineId,
        context,
        printer_name: name,
        is_default: true,
      })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-config', context, machineId] });
      queryClient.invalidateQueries({ queryKey: ['printer-configs'] });
    },
  });

  const save = useCallback(async (name) => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(name);
      setPrinterName(name);
    } finally {
      setIsSaving(false);
    }
  }, [saveMutation]);

  return {
    machineId,
    printerName,
    setPrinterName,
    save,
    isSaving,
    isLoading,
    config,
  };
}

export { CONTEXT_LABELS, CONTEXTS, getOrCreateMachineId };
