import * as React from "react";
import { cn } from "../../utils/cn";




const Select = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-border-temple bg-white px-3 py-2 text-base text-text-main ring-offset-white focus:outline-none focus-visible:border-[#C9B296] focus-visible:ring-1 focus-visible:ring-[#D9C8AF] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}>
        
        {children}
      </select>);

  }
);
Select.displayName = "Select";

export { Select };