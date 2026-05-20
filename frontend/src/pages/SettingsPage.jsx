import { useEffect, useState } from 'react';
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
  DatabaseBackup,
  FileText,
  MapPin,
  Printer,
  ReceiptText,
  XCircle,
} from 'lucide-react';

import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { cn } from '../utils/cn';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Switch } from '../components/ui/Switch';
import { useAuth } from '../context/AuthContext';

const settingsSchema = z
  .object({
    temple_name: z.string().nullish().transform((value) => value ?? ''),
    temple_name_kn: z.string().nullish().transform((value) => value ?? ''),
    temple_address: z.string().nullish().transform((value) => value ?? ''),
    temple_contact: z.string().nullish().transform((value) => value ?? ''),
    alternate_contact: z.string().nullish().transform((value) => value ?? ''),
    temple_email: z
      .string()
      .email('Invalid email')
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    temple_website: z
      .string()
      .url('Invalid URL')
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    opening_time: z.string().nullish().transform((value) => value ?? ''),
    closing_time: z.string().nullish().transform((value) => value ?? ''),
    google_maps_link: z
      .string()
      .url('Invalid URL')
      .nullish()
      .transform((value) => value ?? '')
      .optional()
      .or(z.literal('')),
    footer_note: z.string().nullish().transform((value) => value ?? ''),
    receipt_padding: z.coerce
      .number()
      .min(0, 'Must be 0 or more')
      .max(10, 'Max 10 digits allowed'),
    // Toggles
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
  'h-12 rounded-xl border-[#E7D8CC] bg-white px-4 !text-[17px] text-[#2B2B2B] focus:ring-2 focus:ring-[#C97B63]/15 transition-all';

const labelClass =
  'block !text-[16px] font-semibold text-[#2B2B2B] mb-2';

const VisibilityToggle = ({ label, name, control }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[15px] font-semibold text-[#2B2B2B]">{label}</span>
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
          className="scale-90"
        />
      )}
    />
  </div>
);

const ToggleField = VisibilityToggle;

const textSettingFields = [
  'temple_name',
  'temple_name_kn',
  'temple_address',
  'temple_contact',
  'alternate_contact',
  'temple_email',
  'temple_website',
  'opening_time',
  'closing_time',
  'google_maps_link',
  'footer_note',
];

const normalizeSettings = (settingsData) => {
  if (!settingsData) return settingsData;

  return {
    ...settingsData,
    ...Object.fromEntries(
      textSettingFields.map((field) => [field, settingsData[field] ?? ''])
    ),
  };
};

const SettingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showConfirm, showError, showSuccess } = useNotification();
  const [activeSection, setActiveSection] = useState(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => (await api.get('/settings/get')).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
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

  const updateAllMutation = useMutation({
    mutationFn: async (settingsData) => {
      return (await api.put('/settings/update', settingsData)).data;
    },
    onSuccess: (savedSettings) => {
      reset(normalizeSettings(savedSettings));
      queryClient.invalidateQueries({
        queryKey: ['system-settings'],
      });
      showSuccess('Settings updated');
    },
    onError: (err) =>
      showError(err.response?.data?.detail || 'Update failed'),
  });

  const onSubmit = async (data) => {
    const confirmed = await showConfirm(
      'Update Settings',
      'Save these system settings? Header visibility changes will apply to receipts and reports.',
      'Save Changes'
    );

    if (!confirmed) return;

    try {
      await updateAllMutation.mutateAsync(data);
    } catch (err) {
      showError(err.response?.data?.detail || 'Update failed');
    }
  };

  const onInvalid = (formErrors) => {
    const firstError = Object.values(formErrors)[0];
    showError(firstError?.message || 'Please fix the highlighted fields before saving.');
  };

  const handleDiscard = () => {
    reset(normalizeSettings(settings));
  };

  if (settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center !text-[18px] text-[#6B6B6B]">
        Loading...
      </div>
    );
  }

  if (user?.role_id !== 1 && user?.role_id !== 2) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-error" />
        <h2 className="!text-[22px] font-bold text-[#2B2B2B]">
          Access Denied
        </h2>
      </div>
    );
  }

  const watchedValues = watch();

  const logoPreview = '/temple-logo-permanent.png';

  const templeName = watchedValues.temple_name || '';
  const templeNameKn = watchedValues.temple_name_kn || '';
  const templeAddress = watchedValues.temple_address || '';
  const templeContact = watchedValues.temple_contact || '';
  const alternateContact = watchedValues.alternate_contact || '';
  const templeEmail = watchedValues.temple_email || '';
  const templeWebsite = watchedValues.temple_website || '';
  const openingTime = watchedValues.opening_time || '';
  const closingTime = watchedValues.closing_time || '';
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

  const settingsCards = [
    {
      id: 'temple',
      title: 'Temple Identity',
      description: 'Manage name, address, contact info, and logo.',
      icon: Building2,
      action: 'Configure',
    },
    {
      id: 'receipt',
      title: 'Receipt Settings',
      description: 'Configure receipt ID format and numbering.',
      icon: ReceiptText,
      action: 'Configure',
    },
  ];

  const pageTitle =
    activeSection === 'temple'
      ? 'Temple Identity'
      : activeSection === 'receipt'
        ? 'Receipt Settings'
        : 'System Settings';

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-24 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 bg-[#F8F4EE] min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className={activeSection ? 'flex items-center gap-3' : ''}>
          {activeSection && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveSection(null)}
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
      </div>

      {!activeSection && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mt-8">
          {settingsCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (!card.disabled) {
                    setActiveSection(card.id);
                  }
                }}
                className={cn(
                  "group relative bg-white p-7 rounded-3xl border-2 border-[#E7D8CC]/30 shadow-sm transition-all duration-500 hover:shadow-2xl hover:border-[#C97B63]/30 hover:-translate-y-2 cursor-pointer overflow-hidden",
                  card.disabled && "opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-sm"
                )}
              >
                {/* Decorative Background Icon */}
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] transition-transform duration-700 group-hover:scale-125 group-hover:rotate-12 text-[#C97B63]">
                  <Icon size={200} />
                </div>

                <div className="relative space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="p-5 rounded-2xl bg-[#C97B63]/10 text-[#C97B63] transition-transform group-hover:scale-110 duration-500 shadow-sm">
                      <Icon size={32} />
                    </div>
                    
                    {!card.disabled && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF7F2] border border-[#E7D8CC]/50 transition-colors group-hover:bg-[#C97B63]/10 group-hover:border-[#C97B63]/30">
                        <span className="text-[11px] font-black text-[#C97B63] uppercase tracking-widest">
                          {card.action}
                        </span>
                        <ChevronRight size={14} className="text-[#C97B63] transition-transform group-hover:translate-x-1" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-[#2B2B2B] font-temple uppercase tracking-tight">
                      {card.title}
                    </h3>
                    <p className="text-[#6B6B6B] text-[15px] leading-relaxed font-medium">
                      {card.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Border Accent */}
                <div className="absolute bottom-0 left-0 h-1.5 w-0 bg-[#C97B63] transition-all duration-700 group-hover:w-full opacity-60"></div>
              </div>
            );
          })}
        </div>
      )}

      {activeSection === 'temple' && (
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-8 items-start"
      >
        {/* LEFT SIDE */}
        <Card className="rounded-2xl border border-[#E7D8CC] bg-white shadow-md overflow-hidden">
          <CardContent className="p-7 lg:p-8 space-y-6">
            {/* English Name */}
            <div className="space-y-2">
              <Label className={labelClass}>Temple Name (English)</Label>

              <Input
                {...register('temple_name')}
                className={fieldClass}
                placeholder="e.g. Anegudde Sri Vinayaka Temple"
              />

              {errors.temple_name && (
                <p className="text-error font-semibold !text-[15px] flex items-center gap-1 mt-1">
                  <XCircle className="h-4 w-4" />
                  {errors.temple_name.message}
                </p>
              )}
            </div>

            {/* Kannada Name */}
            <div className="space-y-2">
              <Label className={labelClass}>Temple Name (Kannada)</Label>

              <Input
                {...register('temple_name_kn')}
                className={fieldClass}
                placeholder="e.g. ಆನೆಗುಡ್ಡೆ ಶ್ರೀ ವಿನಾಯಕ ದೇವಸ್ಥಾನ"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label className={labelClass}>Temple Address</Label>

              <Input
                {...register('temple_address')}
                className={fieldClass}
                placeholder="Temple full address"
              />
            </div>

            {/* Phone numbers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <Label className={labelClass}>Contact Number</Label>

                <Input
                  {...register('temple_contact')}
                  className={fieldClass}
                  placeholder="08254-261257"
                />
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Alternate Contact</Label>

                <Input
                  {...register('alternate_contact')}
                  className={fieldClass}
                  placeholder="Additional phone number"
                />
              </div>
            </div>

            {/* Email + Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className={labelClass}>Email Address</Label>

                <Input
                  {...register('temple_email')}
                  className={fieldClass}
                  placeholder="contact@temple.com"
                />
                {errors.temple_email && (
                  <p className="text-error font-semibold !text-[14px] mt-1">
                    {errors.temple_email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>Temple Website</Label>

                <Input
                  {...register('temple_website')}
                  className={fieldClass}
                  placeholder="https://www.temple.com"
                />
                {errors.temple_website && (
                  <p className="text-error font-semibold !text-[14px] mt-1">
                    {errors.temple_website.message}
                  </p>
                )}
              </div>
            </div>

            {/* Opening + Closing Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className={labelClass}>Opening Time</Label>

                <Input
                  {...register('opening_time')}
                  className={fieldClass}
                  placeholder="e.g. 5:30 AM"
                />
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>
                  Closing Time
                </Label>

                <Input
                  {...register('closing_time')}
                  className={fieldClass}
                  placeholder="e.g. 9:00 PM"
                />
              </div>
            </div>

            {/* Google Maps Link */}
            <div className="space-y-2">
              <Label className={labelClass}>Google Maps Link</Label>

              <Input
                {...register('google_maps_link')}
                className={fieldClass}
                placeholder="https://maps.google.com/..."
              />
              {errors.google_maps_link && (
                <p className="text-error font-semibold !text-[14px] mt-1">
                  {errors.google_maps_link.message}
                </p>
              )}
            </div>

            {/* Buttons */}
            <div className="sticky bottom-0 -mx-7 flex justify-end gap-4 border-t border-[#E7D8CC] bg-white/95 px-7 py-4 backdrop-blur lg:-mx-8 lg:px-8">
              <Button
                type="button"
                variant="ghost"
                onClick={handleDiscard}
                className="h-14 px-8 font-bold !text-[17px] text-[#2B2B2B] hover:bg-[#F8F4EE] border border-[#E7D8CC]"
              >
                Discard
              </Button>

              <Button
                type="submit"
                disabled={
                  !isDirty || updateAllMutation.isPending
                }
                className="h-14 px-10 font-bold text-white !text-[18px] !bg-[#C97B63] hover:!bg-[#B8654B] border-none shadow-lg rounded-xl min-w-[180px]"
              >
                {updateAllMutation.isPending
                  ? 'Saving...'
                  : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT SIDE */}
        <div className="sticky top-8 space-y-5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-text-normal font-bold">Live Preview</h3>
          </div>

          <Card className="rounded-2xl border border-[#E7D8CC] bg-white shadow-lg overflow-hidden">
            <CardContent className="p-0">
              {/* Header Preview */}
              <div className="bg-[#FFFDFB] px-8 py-8">
                <div className="mx-auto max-w-[520px] rounded-xl border border-[#E7D8CC] bg-white px-8 py-7 text-center shadow-sm">
                  <img
                    src={logoPreview}
                    alt="Temple Logo"
                    className="mx-auto mb-4 h-[70px] object-contain"
                  />

                  {/* Kannada */}
                  {showTempleNameKn && templeNameKn && (
                    <h4 className="text-[22px] font-black text-[#5A2D1F] leading-tight">
                      {templeNameKn}
                    </h4>
                  )}

                  {/* English */}
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

                  {((showTempleContact && templeContact) || (showAlternateContact && alternateContact)) && (
                    <p className="mt-2 text-[14px] font-semibold text-[#2B2B2B]">
                      Contact : {[showTempleContact && templeContact, showAlternateContact && alternateContact].filter(Boolean).join(' / ')}
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
                </div>
              </div>

              {/* Bottom Footer - Single Line */}
              <div className="border-t border-[#E7D8CC] bg-white px-6 py-5">
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
                  {showTempleTimings && (openingTime || closingTime) && (
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
                        Timings
                      </p>
                      <p className="mt-0.5 text-[14px] font-semibold text-[#2B2B2B]">
                        {openingTime} - {closingTime}
                      </p>
                    </div>
                  )}

                  {showTempleEmail && templeEmail && (
                    <div className="flex flex-col items-center border-l border-[#E7D8CC] pl-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
                        Email
                      </p>
                      <p className="mt-0.5 text-[14px] font-semibold text-[#2B2B2B]">
                        {templeEmail}
                      </p>
                    </div>
                  )}

                  {showTempleWebsite && templeWebsite && (
                    <div className="flex flex-col items-center border-l border-[#E7D8CC] pl-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
                        Website
                      </p>
                      <p className="mt-0.5 text-[14px] font-semibold text-[#C97B63]">
                        {templeWebsite.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  )}
                </div>

                {footerNote && (
                  <p className="mt-6 text-center text-[14px] italic font-medium text-[#5A2D1F]/60">
                    "{footerNote}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[#E7D8CC] bg-white shadow-md">
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="!text-[18px] font-bold text-[#5A2D1F]">Visible on Header</h3>
                <p className="mt-1 text-[#6B6B6B] !text-[14px]">
                  Save changes after switching fields on or off.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <VisibilityToggle label="English name" name="show_temple_name" control={control} />
                <VisibilityToggle label="Kannada name" name="show_temple_name_kn" control={control} />
                <VisibilityToggle label="Address" name="show_temple_address" control={control} />
                <VisibilityToggle label="Contact number" name="show_temple_contact" control={control} />
                <VisibilityToggle label="Alternate contact" name="show_alternate_contact" control={control} />
                <VisibilityToggle label="Email" name="show_temple_email" control={control} />
                <VisibilityToggle label="Website" name="show_temple_website" control={control} />
                <VisibilityToggle label="Timings" name="show_temple_timings" control={control} />
                <VisibilityToggle label="Google Maps" name="show_google_maps_link" control={control} />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
      )}

      {activeSection === 'receipt' && (
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="max-w-2xl"
        >
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
                  <div className="rounded-xl border border-dashed border-[#E7D8CC] bg-[#F8F4EE] flex items-center justify-center h-12 overflow-hidden px-4">
                    <p className="text-[20px] font-black text-[#2B2B2B] truncate w-full text-center tracking-widest">
                      {String(1).padStart(
                        Math.min(
                          watchedValues.receipt_padding !== undefined && watchedValues.receipt_padding !== ''
                            ? Number(watchedValues.receipt_padding)
                            : 4,
                          10
                        ),
                        '0'
                      )}
                    </p>
                  </div>
                </div>
              </div>              <div className="flex justify-end gap-4 pt-8 border-t border-[#F8F4EE]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDiscard}
                  className="h-14 px-8 font-bold !text-[17px] text-[#2B2B2B] hover:bg-[#F8F4EE] border border-[#E7D8CC]"
                >
                  Discard
                </Button>

                <Button
                  type="submit"
                  disabled={
                    !isDirty || updateAllMutation.isPending
                  }
                  className="h-14 px-10 font-bold text-white !text-[18px] !bg-[#C97B63] hover:!bg-[#B8654B] border-none shadow-lg rounded-xl min-w-[180px]"
                >
                  {updateAllMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
};

export default SettingsPage;
