import * as React from "react";
import { cn } from "../../utils/cn";









const DetailItem = ({
  label,
  value,
  className,
  labelClassName,
  valueClassName
}) => {
  return (
    <div className={cn("grid grid-cols-[180px_20px_1fr] items-start text-base py-2", className)}>
      <span className={cn("font-bold text-text-main", labelClassName)}>{label}</span>
      <span className="text-text-main/40">:</span>
      <span className={cn("text-text-main break-all whitespace-pre-wrap min-w-0", valueClassName)}>{value || "-"}</span>
    </div>);

};

export { DetailItem };