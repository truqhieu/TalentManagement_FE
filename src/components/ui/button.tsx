import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006C49]/35 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[#006C49] text-white shadow-[0_2px_8px_rgb(0_108_73/0.35)] hover:bg-[#006C49]/90 active:bg-[#006C49]/80',
        outline:
          'border border-game-accent/25 bg-card text-game-soft-foreground shadow-sm hover:bg-game-soft hover:border-game-accent/40',
        ghost: 'rounded-xl text-game-muted hover:bg-game-soft hover:text-game-soft-foreground',
        secondary:
          'bg-game-soft text-game-soft-foreground shadow-sm hover:bg-[hsl(248_90%_94%)] active:bg-[hsl(248_80%_91%)]',
        destructive:
          'border border-danger/40 bg-danger-muted text-danger shadow-sm hover:bg-danger-muted/80 focus-visible:ring-danger/30',
      },
      size: {
        default: 'h-11 min-h-11 px-6 py-2.5',
        sm: 'h-9 min-h-9 rounded-full px-4 text-sm',
        lg: 'h-12 min-h-12 rounded-full px-9 text-lg',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <Loader2
                className={cn(
                  'animate-spin',
                  size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
                )}
              />
            )}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'
