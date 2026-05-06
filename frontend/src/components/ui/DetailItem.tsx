import * as React from "react"
import { cn } from "../../utils/cn"

interface DetailItemProps {
  label: React.ReactNode
  value: React.ReactNode
  className?: string
  labelClassName?: string
  valueClassName?: string
}

const DetailItem: React.FC<DetailItemProps> = ({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}) => {
  return (
    <div className={cn("flex py-2.5 border-b border-border-temple/40 last:border-0 items-center", className)}>
      <span className={cn("text-sm font-normal text-gray-700 w-1/3", labelClassName)}>{label}</span>
      <span className={cn("text-sm font-normal text-gray-700 w-2/3", valueClassName)}>{value ?? "-"}</span>
    </div>
  )
}

export { DetailItem }

