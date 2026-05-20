import * as React from "react";
import { cn } from "../../utils/cn";





function Badge({ className, variant = 'default', ...props }) {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-badge-disabled-bg text-badge-disabled-text border-gray-200",
    outline: "border-border-temple text-text-main",
    error: "bg-action-delete-bg text-action-delete-text border-action-delete-hover",
    success: "bg-badge-active-bg text-badge-active-text border-green-200",
    active: "bg-badge-active-bg text-badge-active-text border-green-200",
    disabled: "bg-badge-disabled-bg text-badge-disabled-text border-gray-200",
    warning: "bg-action-view-bg text-action-view-text border-action-view-hover"
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant] || variants.default,
        className
      )}
      {...props} />);


}

export { Badge };