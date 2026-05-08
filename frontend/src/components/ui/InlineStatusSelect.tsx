import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Badge } from './Badge';

interface InlineStatusSelectProps {
  value: number;
  disabled?: boolean;
  onChange: (nextStatus: number) => void;
}

export function InlineStatusSelect({ value, disabled = false, onChange }: InlineStatusSelectProps) {
  const isActive = Number(value) === 1;

  const basePill =
    'inline-flex min-w-[100px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors border outline-none focus:ring-2 focus:ring-primary/20';
  const colorPill = isActive
    ? 'border-green-200 bg-badge-active-bg text-badge-active-text'
    : 'border-gray-200 bg-badge-disabled-bg text-badge-disabled-text';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Change status"
          className={`${basePill} ${colorPill} ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        >
          {isActive ? 'Active' : 'Disabled'}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="center"
          sideOffset={4}
          className="z-50 w-[120px] rounded-lg border border-border-temple bg-white p-1 shadow-xl animate-in fade-in zoom-in duration-200"
        >
          <DropdownMenu.Item
            onClick={() => onChange(1)}
            className="w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-xs font-semibold text-badge-active-text outline-none hover:bg-badge-active-bg transition-colors focus:bg-badge-active-bg"
          >
            Active
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onClick={() => onChange(0)}
            className="w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-xs font-semibold text-badge-disabled-text outline-none hover:bg-badge-disabled-bg transition-colors focus:bg-badge-disabled-bg"
          >
            Disabled
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function ReadOnlyStatusBadge({ value }: { value: number }) {
  return (
    <Badge variant={value === 1 ? 'active' : 'disabled'}>
      {value === 1 ? 'Active' : 'Disabled'}
    </Badge>
  );
}
