import * as React from "react";
import { cn } from "../../utils/cn";

const Textarea = React.forwardRef(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:border-[#C9B296] focus-visible:ring-1 focus-visible:ring-[#D9C8AF] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props} />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
