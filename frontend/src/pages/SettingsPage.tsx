import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Settings, Landmark, Receipt, AlertTriangle } from 'lucide-react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { useAuth } from '../context/AuthContext';

const settingsSchema = z.object({
  temple_name: z.string().min(1, 'Temple name is required'),
  temple_address: z.string().optional(),
  temple_contact: z.string().optional(),
  token_prefix: z.string().min(1, 'Token prefix is required'),
  purchase_prefix: z.string().min(1, 'Purchase prefix is required'),
  receipt_padding: z.coerce.number().min(0).max(10),
  current_financial_year_id: z.coerce.number().nullable(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [donationPrefixes, setDonationPrefixes] = useState<Record<number, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => (await api.get('/settings/get')).data,
  });

  const { data: donationTypesData, isLoading: donationTypesLoading } = useQuery({
    queryKey: ['donation-types'],
    queryFn: async () => (await api.get('/donation-types/list_donation_types', { params: { page_size: 1000 } })).data,
  });

  const donationTypes = useMemo(() => donationTypesData?.items || [], [donationTypesData]);
  const savedDonationPrefixes = useMemo(() => {
    const values: Record<number, string> = {};
    donationTypes.forEach((type: any) => {
      values[Number(type.id)] = type.receipt_prefix || '';
    });
    return values;
  }, [donationTypes]);
  const donationPrefixesDirty = useMemo(() => {
    return donationTypes.some((type: any) => donationPrefixes[Number(type.id)] !== savedDonationPrefixes[Number(type.id)]);
  }, [donationPrefixes, donationTypes, savedDonationPrefixes]);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema) as any,
  });

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  useEffect(() => {
    if (donationTypes.length > 0) {
      setDonationPrefixes(savedDonationPrefixes);
    }
  }, [donationTypes.length, savedDonationPrefixes]);

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      return await api.put('/settings/update', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      showSuccess('System settings updated successfully');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to update settings');
    },
  });

  const updateDonationPrefixesMutation = useMutation({
    mutationFn: async () => {
      const changedTypes = donationTypes.filter((type: any) => {
        const id = Number(type.id);
        return donationPrefixes[id] !== savedDonationPrefixes[id];
      });
      return Promise.all(changedTypes.map((type: any) => {
        const id = Number(type.id);
        return api.put(`/donation-types/update_donation_type/${id}`, {
          receipt_prefix: donationPrefixes[id],
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donation-types'] });
      showSuccess('Donation receipt prefixes updated');
    },
    onError: (err: any) => {
      showError(err.response?.data?.detail || 'Failed to update donation prefixes');
    },
  });

  const onSubmit = async (data: SettingsFormValues) => {
    const confirmed = await showConfirm(
      'Update Settings',
      'Are you sure you want to update the system-wide configuration?'
    );
    if (confirmed) {
      updateMutation.mutate(data);
    }
  };

  const saveDonationPrefixes = async () => {
    const confirmed = await showConfirm(
      'Update Donation Prefixes',
      'Are you sure you want to update donation receipt prefixes?'
    );
    if (confirmed) {
      updateDonationPrefixesMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-text-light">Loading settings...</div>;
  }

  // Permission check
  if (user?.role_id !== 1 && user?.role_id !== 2) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="w-12 h-12 text-error" />
        <h2 className="text-xl font-bold text-text-main">Access Denied</h2>
        <p className="text-text-light">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title text-2xl font-black text-text-main">System Configuration</h2>
        </div>
        <Settings className="w-8 h-8 text-primary opacity-20" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Temple Details */}
        <Card className="border-border-temple shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/20 py-4 px-6 flex flex-row items-center gap-3">
            <Landmark className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-black text-secondary uppercase tracking-widest">Temple Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-text-main font-bold">Temple Name *</Label>
              <Input {...register('temple_name')} className="h-11" />
              {errors.temple_name && <p className="text-xs text-error font-medium">{errors.temple_name.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Contact Number</Label>
                <Input {...register('temple_contact')} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Temple Address</Label>
                <Input {...register('temple_address')} className="h-11" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Formats */}
        <Card className="border-border-temple shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-[#FAF7F2] border-b border-border-temple/20 py-4 px-6 flex flex-row items-center gap-3">
            <Receipt className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-black text-secondary uppercase tracking-widest">Receipt & ID Formats</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Token Prefix</Label>
                <Input {...register('token_prefix')} className="h-11 font-mono uppercase" />
                <p className="text-[10px] text-text-light font-medium italic">e.g., TOK-</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Purchase Prefix</Label>
                <Input {...register('purchase_prefix')} className="h-11 font-mono uppercase" />
                <p className="text-[10px] text-text-light font-medium italic">e.g., PUR-</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border-temple/10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-text-main font-bold">Receipt Number Padding</Label>
                <Input type="number" {...register('receipt_padding')} className="h-11" />
                <p className="text-[10px] text-text-light font-medium italic">e.g., 4 results in 0001</p>
              </div>
              <div className="space-y-1.5 opacity-50 pointer-events-none">
                <Label className="text-text-main font-bold">Active Financial Year</Label>
                <Input value={settings?.current_year?.name || 'Auto-Managed'} disabled className="h-11 bg-bg-temple" />
                <p className="text-[10px] text-primary font-bold italic uppercase">Controlled by system</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border-temple/10 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-black text-secondary uppercase tracking-widest">Donation Receipt Prefixes</h3>
                <Button
                  type="button"
                  size="sm"
                  disabled={!donationPrefixesDirty || updateDonationPrefixesMutation.isPending}
                  onClick={saveDonationPrefixes}
                  className="h-9 px-4 text-xs font-black uppercase tracking-widest"
                >
                  {updateDonationPrefixesMutation.isPending ? 'Saving...' : 'Save Prefixes'}
                </Button>
              </div>

              {donationTypesLoading ? (
                <div className="text-sm text-text-light">Loading donation types...</div>
              ) : donationTypes.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {donationTypes.map((type: any) => {
                    const id = Number(type.id);
                    return (
                      <div key={id} className="space-y-1.5">
                        <Label className="text-text-main font-bold">
                          {type.type_name}
                          {Number(type.status) !== 1 && <span className="ml-2 text-[10px] uppercase text-text-light">Disabled</span>}
                        </Label>
                        <Input
                          value={donationPrefixes[id] || ''}
                          onChange={(e) => setDonationPrefixes(prev => ({ ...prev, [id]: e.target.value.toUpperCase() }))}
                          className="h-11 font-mono uppercase"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-text-light">No donation types found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => reset(settings)}
            className="w-32 h-11 border border-border-temple bg-white text-text-main hover:bg-bg-temple font-bold uppercase tracking-widest"
          >
            Reset
          </Button>
          <Button 
            type="submit" 
            disabled={!isDirty || updateMutation.isPending}
            className="w-48 h-11 bg-primary hover:bg-secondary text-white font-black uppercase tracking-widest shadow-lg border-none disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Updating...' : 'Save Configuration'}
            <Save className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
