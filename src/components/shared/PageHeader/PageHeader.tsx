import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PAGE_HEADER_DESCRIPTION,
  PAGE_HEADER_GRADIENT,
  PAGE_HEADER_SURFACE,
  PAGE_HEADER_TITLE,
} from './pageHeaderStyles'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
  onBack?: () => void
  breadcrumb?: ReactNode
  /** Badge / label phía trên tiêu đề */
  eyebrow?: ReactNode
  /** Tiêu đề gradient (manager, dashboard, HR) */
  gradientTitle?: boolean
  /** Nền tối / banner — chữ sáng */
  inverse?: boolean
  /** Không viền dưới — dùng trong layout hub/dashboard */
  variant?: 'default' | 'flat'
  /** Padding surface chuẩn */
  surface?: boolean
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  onBack,
  breadcrumb,
  eyebrow,
  gradientTitle = false,
  inverse = false,
  variant = 'default',
  surface = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:gap-5',
        variant === 'default' && 'pb-5',
        surface && PAGE_HEADER_SURFACE,
        className
      )}
    >
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}
      <div
        className={cn(
          'flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6',
          actions ? undefined : 'w-full'
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {onBack ? (
              <Button
                onClick={onBack}
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 rounded-md border border-border bg-card hover:bg-muted"
                aria-label="Quay lại"
              >
                <ArrowLeft className="h-4 w-4 text-foreground" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
              <h1
                className={cn(
                  gradientTitle && !inverse
                    ? PAGE_HEADER_TITLE
                    : 'truncate text-xl font-bold tracking-tight sm:text-2xl',
                  inverse ? 'text-white' : 'text-foreground'
                )}
              >
                {gradientTitle && !inverse ? (
                  <span className={PAGE_HEADER_GRADIENT}>{title}</span>
                ) : (
                  title
                )}
              </h1>
              {description ? (
                <p
                  className={cn(
                    gradientTitle && !inverse
                      ? PAGE_HEADER_DESCRIPTION
                      : 'mt-1.5 max-w-3xl text-sm leading-6',
                    inverse ? 'text-white/80' : 'text-muted-foreground'
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
