import React from 'react';
import { Badge } from './Badge';

interface InlineStatusSelectProps {
  value: number;
  disabled?: boolean;
  onChange: (nextStatus: number) => void;
}

export function InlineStatusSelect({ value, disabled = false, onChange }: InlineStatusSelectProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const isActive = Number(value) === 1;

  React.useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const basePill =
    'inline-flex min-w-[100px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors border';
  const colorPill = isActive
    ? 'border-green-200 bg-badge-active-bg text-badge-active-text'
    : 'border-gray-200 bg-badge-disabled-bg text-badge-disabled-text';

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        aria-label="Change status"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`${basePill} ${colorPill} ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        {isActive ? 'Active' : 'Disabled'}
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 mt-1 w-[120px] rounded-lg border border-border-temple bg-white p-1 shadow-xl animate-in fade-in zoom-in duration-200">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(1);
            }}
            className="w-full rounded-md px-3 py-1.5 text-left text-xs font-semibold text-badge-active-text hover:bg-badge-active-bg transition-colors"
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(0);
            }}
            className="w-full rounded-md px-3 py-1.5 text-left text-xs font-semibold text-badge-disabled-text hover:bg-badge-disabled-bg transition-colors"
          >
            Disabled
          </button>
        </div>
      )}
    </div>
  );
}

export function ReadOnlyStatusBadge({ value }: { value: number }) {
  return (
    <Badge variant={value === 1 ? 'active' : 'disabled'}>
      {value === 1 ? 'Active' : 'Disabled'}
    </Badge>
  );
}
