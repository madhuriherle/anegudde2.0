import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  DatabaseBackup,
  DatabaseZap,
  FileText,
  Globe,
  ImagePlus,
  Mail,
  MapPin,
  Phone,
  Printer,
  ReceiptText,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';

import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { usePermission } from '../hooks/usePermission';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Switch } from '../components/ui/Switch';
import { convertTo24H, convertToAMPM } from '../utils/date';

const settingsSchema = z
  .object({
    temple_name: z.string().nullish().transform((value) => value ?? ''),
    temple_name_kn: z.string().nullish().transform((value) => value ?? ''),
    temple_address: z.string().nullish().transform((value) => value ?? ''),
    temple_contact: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').nullish().transform((value) => value ?? '').optional().or(z.literal('')),
    alternate_contact: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').nullish().transform((value) => value ?? '').optional().or(z.literal('')),
    receipt_office_contact: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').nullish().transform((value) => value ?? '').optional().or(z.literal('')),
    receipt_seva_counter_contact: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').nullish().transform((value) => value ?? '').optional().or(z.literal('')),
    receipt_guest_house_contact: z.string().regex(/^\+?[\d\s-]{8,15}$/, 'Invalid contact number').nullish().transform((value) => value ?? '').optional().or(z.literal('')),
    temple_email: z
      .string()
      .email('Invalid email address')
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    temple_website: z
      .string()
      .refine((val) => !val || /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(val), {
        message: 'Invalid website URL (e.g. https://temple.com)',
      })
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    opening_time: z.string().nullish().transform((value) => value ?? ''),
    closing_time: z.string().nullish().transform((value) => value ?? ''),
    google_maps_link: z
      .string()
      .refine((val) => !val || /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(val) || val.includes('maps'), {
        message: 'Invalid Google Maps link',
      })
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    temple_logo: z.string().nullish().transform((value) => value ?? ''),
    footer_note: z.string().nullish().transform((value) => value ?? ''),
    receipt_padding: z.coerce
      .number()
      .min(1, 'Must be at least 1 digit')
      .max(10, 'Max 10 digits allowed')
      .nullish()
      .transform((val) => val ?? 4),
    receipt_top_offset: z.coerce
      .number()
      .min(-50, 'Must be -50 mm or more')
      .max(50, 'Must be 50 mm or less')
      .optional()
      .default(0),
    receipt_left_offset: z.coerce
      .number()
      .min(-50, 'Must be -50 mm or more')
      .max(50, 'Must be 50 mm or less')
      .optional()
      .default(0),
    // Toggles
    show_temple_logo: z.boolean().optional().default(true),
    show_temple_name: z.boolean().optional().default(true),
    show_temple_name_kn: z.boolean().optional().default(true),
    show_temple_address: z.boolean().optional().default(true),
    show_temple_contact: z.boolean().optional().default(true),
    show_alternate_contact: z.boolean().optional().default(true),
    show_temple_email: z.boolean().optional().default(true),
    show_temple_website: z.boolean().optional().default(true),
    show_temple_timings: z.boolean().optional().default(true),
    show_google_maps_link: z.boolean().optional().default(true),
  })
  .refine((data) => data.temple_name || data.temple_name_kn, {
    message: 'At least one temple name (English or Kannada) is required',
    path: ['temple_name'],
  });

const fieldClass =
  'h-11 rounded-lg border-border-temple/60 bg-white px-4 text-base text-text-main focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full';

const labelClass =
  'block text-sm font-medium text-[#5F5F5F] mb-2';

const VisibilityToggle = ({ label, name, control, disabled = false }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-base font-semibold text-text-main">{label}</span>
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
          disabled={disabled}
          className="scale-90"
        />
      )}
    />
  </div>
);

const ToggleField = VisibilityToggle;

const cleanupGroups = [
  {
    id: 'canteen_tokens',
    title: 'Mahaprasad Token Data',
    description: 'Token generations and token receipt details.',
  },
  {
    id: 'inventory_transactions',
    title: 'Inventory Transactions',
    description: 'Purchases, returns, usage, wastage, adjustments, stock ledger, summaries, and vendor payments.',
  },
  {
    id: 'donation_records',
    title: 'Donation Records',
    description: 'Devotees, donation receipts and donated item lines. Donation types stay protected.',
  },
  {
    id: 'system_logs',
    title: 'System Logs',
    description: 'Login history and activity audit logs.',
  },
];

const textSettingFields = [
  'temple_name',
  'temple_name_kn',
  'temple_address',
  'temple_contact',
  'alternate_contact',
  'receipt_office_contact',
  'receipt_seva_counter_contact',
  'receipt_guest_house_contact',
  'temple_email',
  'temple_website',
  'opening_time',
  'closing_time',
  'google_maps_link',
  'temple_logo',
  'footer_note',
];

const templeIdentityFields = [
  ...textSettingFields,
];

const receiptSettingsFields = [
  'receipt_padding',
  'receipt_top_offset',
  'receipt_left_offset',
  'show_temple_logo',
  'show_temple_name',
  'show_temple_name_kn',
  'show_temple_address',
  'show_temple_contact',
  'show_alternate_contact',
  'show_temple_email',
  'show_temple_website',
  'show_temple_timings',
  'show_google_maps_link',
];

const normalizeSettings = (settingsData) => {
  if (!settingsData) return settingsData;

  return {
    ...settingsData,
    ...Object.fromEntries(
      textSettingFields.map((field) => [
        field,
        (field === 'opening_time' || field === 'closing_time')
          ? convertTo24H(settingsData[field] ?? '')
          : settingsData[field] ?? ''
      ])
    ),
  };
};

const SettingsPage = ({ section = null }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const { hasPermission } = usePermission();
  const [cleanupSelections, setCleanupSelections] = useState([]);
  const [cleanupPhrase, setCleanupPhrase] = useState('');
  const [logoChanged, setLogoChanged] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState('');
  const activeSection = section;
  const canReadTempleIdentity = hasPermission('settings.temple_identity.read');
  const canReadReceiptSettings = hasPermission('settings.receipt_settings.read');
  const canReadPrinterSettings = hasPermission('settings.printers.read');
  const canReadRecycleBin = (user?.role_rank_level ?? 99) === 1 && hasPermission('recycle_bin.read');
  const canReadDataCleanup = (user?.role_rank_level ?? 99) === 1 && hasPermission('settings.data_cleanup.read');
  const canWrite =
    activeSection === 'temple'
      ? hasPermission('settings.temple_identity.write')
      : activeSection === 'receipt'
        ? hasPermission('settings.receipt_settings.write')
        : activeSection === 'cleanup'
          ? hasPermission('settings.data_cleanup.write')
          : activeSection === 'printers'
            ? hasPermission('settings.printers.write')
            : hasPermission('settings.management.write');
  const settingsReadEndpoint = activeSection === 'temple'
    ? '/settings/temple-identity'
    : activeSection === 'receipt'
      ? '/settings/receipt-settings'
      : activeSection === 'cleanup'
        ? '/settings/data-cleanup'
        : activeSection === 'printers'
          ? '/settings/printer-configs'
          : '/settings/get_current_settings';

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings', activeSection || 'root'],
    queryFn: async () => (await api.get(settingsReadEndpoint)).data,
    enabled: Boolean(activeSection),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (settings) {
      reset(normalizeSettings(settings));
    }
  }, [settings, reset]);

  useEffect(() => {
    if (!pendingLogoFile) {
      setPendingLogoPreview('');
      return;
    }
    const nextPreview = URL.createObjectURL(pendingLogoFile);
    setPendingLogoPreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [pendingLogoFile]);

  const updateAllMutation = useMutation({
    mutationFn: async (settingsData) => {
      if (section === 'temple') {
        const payload = Object.fromEntries(
          templeIdentityFields.map((field) => [field, settingsData[field]])
        );
        return (await api.put('/settings/update_temple_identity_settings', payload)).data;
      }

      if (section === 'receipt') {
        const payload = Object.fromEntries(
          receiptSettingsFields.map((field) => [field, settingsData[field]])
        );
        return (await api.put('/settings/update_receipt_settings', payload)).data;
      }

      return (await api.put('/settings/update', settingsData)).data;
    },
    onSuccess: (savedSettings) => {
      setLogoChanged(false);
      reset(normalizeSettings(savedSettings));
      queryClient.invalidateQueries({
        queryKey: ['system-settings'],
      });
      showSuccess('Settings updated');
    },
    onError: (err) =>
      showError(err.response?.data?.detail || 'Update failed'),
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return (await api.post('/settings/upload_temple_logo', formData)).data;
    },
    onError: (err) =>
      showError(err.response?.data?.detail || 'Logo upload failed'),
  });

  const cleanupMutation = useMutation({
    mutationFn: async (payload) => {
      return (await api.post('/settings/clear_operational_data', payload)).data;
    },
    onSuccess: (result) => {
      const deletedTotal = Object.values(result.deleted_counts || {}).reduce(
        (total, value) => total + Number(value || 0),
        0
      );
      setCleanupSelections([]);
      setCleanupPhrase('');
      showSuccess(`Operational data cleared. ${deletedTotal} records removed.`);
    },
    onError: (err) =>
      showError(err.response?.data?.detail || 'Cleanup failed'),
  });

  const onSubmit = async (data) => {
    if (!canWrite) {
      showError('You have read-only access for this settings page.');
      return;
    }

    const confirmed = await showConfirm(
      'Update Settings',
      'Save these temple identity settings? Changes will apply to receipts and reports.',
      'Save Changes'
    );

    if (!confirmed) return;

    try {
      let payload = {
        ...data,
        opening_time: convertToAMPM(data.opening_time),
        closing_time: convertToAMPM(data.closing_time),
      };
      if (activeSection === 'receipt') {
        payload.receipt_top_offset = 0;
        payload.receipt_left_offset = 0;
      }
      if (pendingLogoFile) {
        const uploadResult = await logoUploadMutation.mutateAsync(pendingLogoFile);
        payload = {
          ...payload,
          temple_logo: uploadResult?.logo_url || payload.temple_logo,
        };
      }
      await updateAllMutation.mutateAsync(payload);
      if (pendingLogoFile) {
        setPendingLogoFile(null);
        setLogoChanged(false);
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Update failed');
    }
  };

  const onInvalid = (formErrors) => {
    console.error('Form Validation Errors:', formErrors);
    const firstError = Object.entries(formErrors)[0];
    if (firstError) {
      const [field, error] = firstError;
      const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      showError(`${fieldName}: ${error.message || 'Invalid value'}`);
    } else {
      showError('Please fix the highlighted fields before saving.');
    }
  };

  const handleDiscard = () => {
    setLogoChanged(false);
    setPendingLogoFile(null);
    reset(normalizeSettings(settings));
  };

  const toggleCleanupSelection = (groupId) => {
    setCleanupSelections((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    );
  };

  const handleCleanup = async () => {
    if (!canWrite) {
      showError('You have read-only access for data cleanup.');
      return;
    }

    if (cleanupSelections.length === 0) {
      showError('Select at least one data group to clear.');
      return;
    }

    if (cleanupPhrase !== 'CLEAR DATA') {
      showError('Type CLEAR DATA exactly to confirm.');
      return;
    }

    const confirmed = await showConfirm(
      'Clear Operational Data',
      'This will permanently clear only the selected operational records. Master data like items, menu items, categories, vendors, donation types, settings, and users will not be deleted.\n\nTake a database backup before continuing.',
      'Clear Selected Data'
    );

    if (!confirmed) return;

    await cleanupMutation.mutateAsync({
      groups: cleanupSelections,
      confirmation_phrase: cleanupPhrase,
    });
  };

  if (settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-lg text-text-light font-medium">
        Loading settings...
      </div>
    );
  }

  const watchedValues = watch();

  const templeName = watchedValues.temple_name || '';
  const templeNameKn = watchedValues.temple_name_kn || '';
  const templeLogo = watchedValues.temple_logo || settings?.temple_logo || '';
  const logoPreview = pendingLogoPreview || templeLogo || '/temple-logo-permanent.png';
  const templeAddress = watchedValues.temple_address || '';
  const templeContact = watchedValues.temple_contact || '';
  const alternateContact = watchedValues.alternate_contact || '';
  const receiptOfficeContact = watchedValues.receipt_office_contact || '';
  const receiptSevaCounterContact = watchedValues.receipt_seva_counter_contact || '';
  const receiptGuestHouseContact = watchedValues.receipt_guest_house_contact || '';
  const templeEmail = watchedValues.temple_email || '';
  const templeWebsite = watchedValues.temple_website || '';
  const openingTime = convertToAMPM(watchedValues.opening_time) || '';
  const closingTime = convertToAMPM(watchedValues.closing_time) || '';
  const googleMapsLink = watchedValues.google_maps_link || '';
  const footerNote = watchedValues.footer_note || '';
  const showTempleName = watchedValues.show_temple_name ?? true;
  const showTempleNameKn = watchedValues.show_temple_name_kn ?? true;
  const showTempleAddress = watchedValues.show_temple_address ?? true;
  const showTempleContact = watchedValues.show_temple_contact ?? true;
  const showAlternateContact = watchedValues.show_alternate_contact ?? true;
  const showTempleEmail = watchedValues.show_temple_email ?? true;
  const showTempleWebsite = watchedValues.show_temple_website ?? true;
  const showTempleTimings = watchedValues.show_temple_timings ?? true;
  const showGoogleMapsLink = watchedValues.show_google_maps_link ?? true;
  const receiptPaddingPreview = Math.min(
    watchedValues.receipt_padding !== undefined && watchedValues.receipt_padding !== ''
      ? Number(watchedValues.receipt_padding)
      : 4,
    10
  );
  const sampleReceiptNumber = String(1).padStart(receiptPaddingPreview, '0');
  const sampleReceiptDisplayNumber = `ADRNO: ${sampleReceiptNumber}`;

  const settingsCards = [
    ...(canReadTempleIdentity ? [{
      id: 'temple',
      title: 'Temple Identity',
      description: 'Manage name, address, and contact info for receipts and reports.',
      icon: Building2,
      action: 'Configure',
      path: '/settings/temple',
    }] : []),
    ...(canReadReceiptSettings ? [{
      id: 'receipt',
      title: 'Receipt Settings',
      description: 'Configure receipt ID format and numbering.',
      icon: ReceiptText,
      action: 'Configure',
      path: '/settings/receipt',
    }] : []),
    /*
    ...(canReadPrinterSettings ? [{
      id: 'printers',
      title: 'Printer Settings',
      description: 'Manage printer assignments per task for each computer.',
      icon: Printer,
      action: 'Configure',
      path: '/settings/printers',
    }] : []),
    */
    ...(canReadRecycleBin ? [{
      id: 'recycle-bin',
      title: 'Recycle Bin',
      description: 'View, restore, or permanently delete soft-deleted records.',
      icon: Trash2,
      action: 'Open',
      path: '/settings/recycle-bin',
    }] : []),
    ...(canReadDataCleanup ? [{
      id: 'cleanup',
      title: 'Data Cleanup',
      description: 'Clear operational history while keeping master setup data protected.',
      icon: DatabaseZap,
      action: 'Open',
      danger: true,
      path: '/settings/cleanup',
    }] : []),
  ];

  const pageTitle =
    activeSection === 'temple'
      ? 'Temple Identity'
      : activeSection === 'receipt'
        ? 'Receipt Settings'
        : activeSection === 'printers'
          ? 'Printer Settings'
          : activeSection === 'cleanup'
            ? 'Data Cleanup'
          : 'System Settings';
  const financialYearName = settings?.financial_year_name || 'Not set';
  const templeFieldClass =
    'h-11 rounded-lg border-border-temple/60 bg-white px-4 text-base text-text-main focus:border-primary focus:ring-1 focus:ring-primary transition-all w-full shadow-none';
  const templeLabelClass =
    'block text-base font-semibold text-text-main mb-1.5';
  const sectionCardClass =
    'rounded-xl border border-border-temple/60 bg-white p-6 shadow-sm';
  const sectionTitleClass =
    'text-lg font-bold text-secondary font-temple';

  return (
    <div className={cn(
      "mx-auto max-w-[1600px] px-4 pb-24 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-64px)]",
      activeSection === 'temple' ? "bg-[#F8F4EE]" : "bg-[#F8F4EE]"
    )}>
      {/* Header */}
      <div
        className={cn(
          "mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
          activeSection === 'receipt' &&
            "sticky top-0 z-30 -mx-4 border-b border-[#E7D8CC] bg-[#F8F4EE]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        )}
      >
        <div className={activeSection ? 'flex items-center gap-3' : ''}>
          {activeSection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="h-9 w-9 rounded-full p-0 bg-white shadow-sm border border-[#E7D8CC]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
          <h2 className="page-title">
            {pageTitle}
          </h2>
          </div>
        </div>

        {activeSection === 'receipt' && canWrite && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscard}
              disabled={!isDirty || updateAllMutation.isPending}
              className="h-10 rounded-lg border border-[#E7D8CC] bg-white px-5 font-bold text-[#2B2B2B] hover:bg-[#F8F4EE]"
            >
              Reset
            </Button>

            <Button
              type="submit"
              form="receipt-settings-form"
              disabled={!isDirty || updateAllMutation.isPending}
              className="h-10 min-w-[160px] rounded-lg border-none bg-primary px-6 font-bold text-white shadow-sm hover:bg-primary/90"
            >
              {updateAllMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {!activeSection && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {settingsCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (!card.disabled) {
                    navigate(card.path);
                  }
                }}
                className={cn(
                  "group relative bg-white p-7 rounded-3xl border-2 border-[#E7D8CC]/30 shadow-sm transition-all duration-500 hover:shadow-2xl hover:border-[#C97B63]/30 hover:-translate-y-2 cursor-pointer overflow-hidden",
                  card.danger && "hover:border-[#B91C1C]/30",
                  card.disabled && "opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-sm"
                )}
              >
                <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={cn(
                      "p-5 rounded-2xl transition-transform group-hover:scale-110 duration-500 shadow-sm bg-[#C97B63]/10 text-[#C97B63]"
                    )}>
                      <Icon size={32} />
                    </div>
                    
                    {!card.disabled && (
                      <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF7F2] border border-[#E7D8CC]/50 transition-colors group-hover:bg-[#C97B63]/10 group-hover:border-[#C97B63]/30"
                      )}>
                        <span className="text-[11px] font-black uppercase tracking-widest text-[#472B20]">
                          {card.action}
                        </span>
                        <ChevronRight size={14} className="text-[#C97B63] transition-transform group-hover:translate-x-1" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-[#2B2B2B] font-temple">
                      {card.title}
                    </h3>
                    <p className="text-[#6B6B6B] text-[15px] leading-relaxed font-medium">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === 'temple' && (
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
          }
        }}
        className="max-w-6xl mx-auto"
      >
        <div className="grid grid-cols-1 gap-6 pb-8 lg:grid-cols-2">
          {/* Section 1: Names */}
          <div className={sectionCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 size={20} />
              </div>
              <h3 className={sectionTitleClass}>Temple Details</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className={templeLabelClass}>Temple Name</Label>
                <Input
                  {...register('temple_name')}
                  disabled={!canWrite}
                  className={templeFieldClass}
                  placeholder="e.g. Anegudde Sri Vinayaka Temple"
                />
                {errors.temple_name && (
                  <p className="text-error font-semibold !text-[15px] flex items-center gap-1 mt-1">
                    <XCircle className="h-4 w-4" />
                    {errors.temple_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Kannada Name</Label>
                <Input
                  {...register('temple_name_kn')}
                  disabled={!canWrite}
                  className={templeFieldClass}
                  placeholder="e.g. ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ"
                />
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Temple Logo</Label>
                <div className="rounded-xl border border-dashed border-border-temple/60 bg-bg-temple/30 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 w-full">
                      <div className="flex aspect-[3/1] w-full items-center justify-center rounded-xl border border-border-temple/60 bg-white shadow-sm overflow-hidden p-2">
                        <img
                          src={logoPreview}
                          alt="Temple Logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </div>

                    {canWrite && (
                    <label className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-white shadow-sm hover:bg-secondary transition-all active:scale-95">
                      <ImagePlus className="h-4 w-4" />
                      Choose Logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setPendingLogoFile(file);
                            setLogoChanged(true);
                          }
                          event.target.value = '';
                        }}
                      />
                    </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact */}
          <div className={sectionCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Phone size={20} />
              </div>
              <h3 className={sectionTitleClass}>Contact</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={templeLabelClass}>Contact Number</Label>
                  <Input
                    {...register('temple_contact')}
                    disabled={!canWrite}
                    className={templeFieldClass}
                    placeholder="08254-261257"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={templeLabelClass}>Alternate Contact</Label>
                  <Input
                    {...register('alternate_contact')}
                    disabled={!canWrite}
                    className={templeFieldClass}
                    placeholder="Additional phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className={templeLabelClass}>Receipt Office</Label>
                  <Input
                    {...register('receipt_office_contact')}
                    disabled={!canWrite}
                    className={templeFieldClass}
                    placeholder="74060 93533"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={templeLabelClass}>Seva Counter</Label>
                  <Input
                    {...register('receipt_seva_counter_contact')}
                    disabled={!canWrite}
                    className={templeFieldClass}
                    placeholder="94802 72221"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={templeLabelClass}>Guest House</Label>
                  <Input
                    {...register('receipt_guest_house_contact')}
                    disabled={!canWrite}
                    className={templeFieldClass}
                    placeholder="97406 73533"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C97B63]/60" />
                  <Input
                    {...register('temple_email')}
                    disabled={!canWrite}
                    className={cn(templeFieldClass, "pl-10")}
                    placeholder="contact@temple.com"
                  />
                </div>
                {errors.temple_email && (
                  <p className="text-error font-semibold !text-[14px] mt-1">
                    {errors.temple_email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C97B63]/60" />
                  <Input
                    {...register('temple_website')}
                    disabled={!canWrite}
                    className={cn(templeFieldClass, "pl-10")}
                    placeholder="https://www.temple.com"
                  />
                </div>
                {errors.temple_website && (
                  <p className="text-error font-semibold !text-[14px] mt-1">
                    {errors.temple_website.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Location */}
          <div className={sectionCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#C97B63]/10 text-[#C97B63]">
                <MapPin className="h-4 w-4" />
              </div>
              <h3 className={sectionTitleClass}>Location</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className={templeLabelClass}>Address</Label>
                <Input
                  {...register('temple_address')}
                  disabled={!canWrite}
                  className={templeFieldClass}
                  placeholder="Temple full address"
                />
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Google Maps</Label>
                <Input
                  {...register('google_maps_link')}
                  disabled={!canWrite}
                  className={templeFieldClass}
                  placeholder="https://maps.google.com/..."
                />
                {errors.google_maps_link && (
                  <p className="text-error font-semibold !text-[14px] mt-1">
                    {errors.google_maps_link.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Hours */}
          <div className={sectionCardClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#C97B63]/10 text-[#C97B63]">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className={sectionTitleClass}>Timings</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-2">
                <Label className={templeLabelClass}>Opening Time</Label>
                <Input
                  type="time"
                  {...register('opening_time')}
                  disabled={!canWrite}
                  className={cn(templeFieldClass, "cursor-pointer")}
                  onClick={(e) => {
                    try {
                      if (typeof e.target.showPicker === 'function') {
                        e.target.showPicker();
                      }
                    } catch (err) {
                      console.debug('showPicker not supported');
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className={templeLabelClass}>Closing Time</Label>
                <Input
                  type="time"
                  {...register('closing_time')}
                  disabled={!canWrite}
                  className={cn(templeFieldClass, "cursor-pointer")}
                  onClick={(e) => {
                    try {
                      if (typeof e.target.showPicker === 'function') {
                        e.target.showPicker();
                      }
                    } catch (err) {
                      console.debug('showPicker not supported');
                    }
                  }}
                />
              </div>
            </div>
          </div>

        </div>

        {canWrite && (
        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDiscard}
            className="h-11 rounded-lg border border-[#D9E0E6] px-6 font-medium text-[#17212B] hover:bg-[#F6F7F8]"
          >
            Discard Changes
          </Button>

          <Button
            type="submit"
            disabled={(!isDirty && !logoChanged) || updateAllMutation.isPending}
            className="h-11 min-w-[180px] rounded-lg border-none bg-primary px-8 font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            {updateAllMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
        )}
      </form>
      )}

      {activeSection === 'receipt' && (
        <form
          id="receipt-settings-form"
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
              e.preventDefault();
            }
          }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start"
        >
          <div className="space-y-5">
          <Card className="rounded-3xl border border-[#E7D8CC] bg-white shadow-lg overflow-hidden">
            <CardContent className="p-8 lg:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-2">
                  <Label className={labelClass}>
                    Receipt ID Digits
                  </Label>

                  <Input
                    type="number"
                    {...register('receipt_padding')}
                    disabled={!canWrite}
                    className={`${fieldClass} w-full text-center font-bold`}
                    placeholder="e.g. 4"
                  />

                    {errors.receipt_padding && (
                      <p className="text-error font-bold !text-[15px] flex items-center gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1">
                        <XCircle className="h-4 w-4" />
                        {errors.receipt_padding.message}
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>
                    Format Preview
                  </Label>
                  <div className="rounded-lg border border-dashed border-[#E7D8CC] bg-[#F8F4EE] flex items-center justify-center h-11 overflow-hidden px-4">
                    <p className="text-base font-bold text-[#2B2B2B] truncate w-full text-center tracking-widest">
                      {sampleReceiptDisplayNumber}
                    </p>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border-temple/60 bg-white shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-bold text-secondary font-temple">Visible on Receipt Header</h3>
                <p className="mt-1 text-text-light text-sm">
                  Select which details appear on printed receipts and reports.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2">
                <VisibilityToggle label="Temple Logo" name="show_temple_logo" control={control} disabled={!canWrite} />
                <VisibilityToggle label="English Name" name="show_temple_name" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Kannada Name" name="show_temple_name_kn" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Address" name="show_temple_address" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Contact Number" name="show_temple_contact" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Alternate Contact" name="show_alternate_contact" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Email Address" name="show_temple_email" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Website" name="show_temple_website" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Timings" name="show_temple_timings" control={control} disabled={!canWrite} />
                <VisibilityToggle label="Google Maps" name="show_google_maps_link" control={control} disabled={!canWrite} />
              </div>
            </CardContent>
          </Card>
          </div>

          <div className="space-y-5">
            <Card className="w-full rounded-2xl border border-[#E7D8CC] bg-white shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="w-full bg-[#FFFDFB] p-5">
                  <div className="w-full rounded-xl border border-[#E7D8CC] bg-white px-8 py-7 text-center shadow-sm">
                    {watchedValues.show_temple_logo && (
                      <img
                        src={logoPreview}
                        alt="Temple Logo"
                        className="mx-auto mb-4 h-[70px] object-contain"
                      />
                    )}

                    {showTempleNameKn && templeNameKn && (
                      <h4 className="text-[22px] font-black text-[#5A2D1F] leading-tight">
                        {templeNameKn}
                      </h4>
                    )}

                    {showTempleName && (
                      <h3 className="mt-2 text-[20px] font-black uppercase text-[#2B2B2B] leading-tight">
                        {templeName || 'YOUR TEMPLE NAME'}
                      </h3>
                    )}

                    {showTempleAddress && templeAddress && (
                      <p className="mt-4 text-[14px] leading-relaxed text-[#4B4B4B]">
                        {templeAddress}
                      </p>
                    )}

                    {(
                      receiptOfficeContact ||
                      receiptSevaCounterContact ||
                      receiptGuestHouseContact ||
                      (showTempleContact && templeContact) ||
                      (showAlternateContact && alternateContact)
                    ) && (
                      <p className="mt-2 text-[14px] font-semibold text-[#2B2B2B]">
                        Contact : {[
                          receiptOfficeContact ? `Office: ${receiptOfficeContact}` : showTempleContact && templeContact,
                          receiptSevaCounterContact ? `Seva Counter: ${receiptSevaCounterContact}` : showAlternateContact && alternateContact,
                          receiptGuestHouseContact ? `Guest House: ${receiptGuestHouseContact}` : null
                        ].filter(Boolean).join(' | ')}
                      </p>
                    )}

                    {[
                      showTempleTimings && (openingTime || closingTime)
                        ? `Timings: ${[openingTime, closingTime].filter(Boolean).join(' - ')}`
                        : null,
                      showTempleEmail && templeEmail ? `Email: ${templeEmail}` : null,
                      showTempleWebsite && templeWebsite
                        ? `Website: ${templeWebsite.replace(/^https?:\/\//, '')}`
                        : null
                    ].filter(Boolean).length > 0 && (
                      <p className="mt-2 text-[13px] leading-6 text-[#2B2B2B]">
                        {[
                          showTempleTimings && (openingTime || closingTime)
                            ? `Timings: ${[openingTime, closingTime].filter(Boolean).join(' - ')}`
                            : null,
                          showTempleEmail && templeEmail ? `Email: ${templeEmail}` : null,
                          showTempleWebsite && templeWebsite
                            ? `Website: ${templeWebsite.replace(/^https?:\/\//, '')}`
                            : null
                        ].filter(Boolean).join('  |  ')}
                      </p>
                    )}

                    {showGoogleMapsLink && googleMapsLink && (
                      <a
                        href={googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#C97B63] hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        View on Google Maps
                      </a>
                    )}

                    <div className="mt-6 flex items-center justify-between rounded-lg border border-[#E7D8CC] bg-[#F8F4EE] px-4 py-3 text-left">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#8B6F5A]">
                          Sample Receipt No
                        </p>
                        <p className="mt-1 break-words font-mono text-[20px] font-black tracking-widest text-[#2B2B2B] sm:text-[22px]">
                          {sampleReceiptDisplayNumber}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="border-t border-[#E7D8CC] bg-white px-8 py-4">
                  {footerNote && (
                    <p className="mt-3 text-center text-[13px] italic font-medium text-[#5A2D1F]/60">
                      "{footerNote}"
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      )}

      {/*
      {activeSection === 'printers' && (
        <PrinterSettingsPage />
      )}
      */}

      {activeSection === 'cleanup' && (
        <div className="max-w-6xl space-y-6">
          <div className="flex items-start gap-4 rounded-2xl border border-border-temple/60 bg-white p-5 shadow-sm">
            <div className="rounded-2xl bg-white p-3 text-[#B91C1C] shadow-sm">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="!text-[19px] font-black text-secondary">
                Clear only operational records
              </h3>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-text-normal">
                Select operational data to clear. Master setup data stays protected.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E7D8CC] bg-white shadow-sm">
            <div className="grid grid-cols-[1.1fr_1.4fr_88px] border-b border-[#E7D8CC] bg-[#F8F4EE] px-5 py-4 text-[15px] font-black uppercase tracking-[0.15em] text-[#8B4513]">
              <span>Data Group</span>
              <span>Description</span>
              <span className="text-center">Clear</span>
            </div>

            {cleanupGroups.map((group) => {
              const checked = cleanupSelections.includes(group.id);

              return (
                <label
                  key={group.id}
                  className={cn(
                    "grid grid-cols-[1.1fr_1.4fr_88px] items-center border-b border-[#F3E8DE] px-5 py-5 transition-colors last:border-b-0",
                    canWrite ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    checked ? "bg-[#FFF7ED]" : canWrite && "hover:bg-[#FFFDFB]"
                  )}
                >
                  <span className="text-[18px] font-black text-[#2B2B2B]">
                    {group.title}
                  </span>
                  <span className="text-[18px] font-medium leading-relaxed text-[#6B6B6B]">
                    {group.description}
                  </span>
                  <span className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canWrite}
                      onChange={() => toggleCleanupSelection(group.id)}
                      className="h-5 w-5 accent-[#B45309]"
                    />
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-border-temple/60 bg-white p-4 shadow-sm">
            <div className="rounded-xl bg-white p-2 text-[#15803D] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="!text-[17px] font-black text-secondary">
                Will not be deleted
              </h3>
              <p className="mt-0.5 text-[13px] font-semibold text-text-normal">
                Master setup data stays protected.
              </p>
            </div>
          </div>

          <div className="border-t border-[#E7D8CC] pt-6">
            <Label className={labelClass}>Confirmation Text</Label>
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={cleanupPhrase}
                onChange={(event) => setCleanupPhrase(event.target.value)}
                disabled={!canWrite}
                className={`${fieldClass} flex-1 font-bold`}
                placeholder="Type CLEAR DATA"
              />
              {canWrite && (
              <Button
                type="button"
                variant="error"
                disabled={
                  cleanupSelections.length === 0 ||
                  cleanupPhrase !== 'CLEAR DATA' ||
                  cleanupMutation.isPending
                }
                onClick={handleCleanup}
                className="h-12 shrink-0 rounded-xl px-6 !text-[16px] font-black"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {cleanupMutation.isPending ? 'Clearing...' : 'Clear Selected Data'}
              </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
