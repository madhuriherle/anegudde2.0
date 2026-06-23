import { Printer } from 'lucide-react';

export function PrinterSelectDropdown({ onPrint, disabled, buttonLabel = 'Print' }) {
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
