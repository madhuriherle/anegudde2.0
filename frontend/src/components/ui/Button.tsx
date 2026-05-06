import * as React from "react"
import { cn } from "../../utils/cn"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'error';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-primary !text-white hover:bg-secondary hover:!text-white hover:shadow-lg hover:-translate-y-0.5 shadow-md',
      secondary: 'bg-secondary text-white hover:bg-secondary-light hover:shadow-lg hover:-translate-y-0.5 shadow-md',
      outline: 'border border-primary text-primary bg-transparent hover:bg-primary hover:text-white hover:shadow-lg hover:-translate-y-0.5',
      ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
      error: 'bg-error text-white hover:opacity-90 shadow-md',
    }

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-8 text-lg',
      icon: 'h-10 w-10',
    }

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
