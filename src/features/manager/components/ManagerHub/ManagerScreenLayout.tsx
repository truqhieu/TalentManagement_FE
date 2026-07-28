import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ManagerHubNav } from './ManagerHubNav'

export interface ManagerScreenLayoutProps {
  title?: string
  subtitle?: string
  toolbarExtra?: ReactNode
  /** Ẩn thanh pill điều hướng hub (Tiến độ nhóm, Chia lớp, …) khi đã có nav ở shell. */
  hideHubNav?: boolean
  /**
   * Bỏ `page-toolbar-gradient`; đặt tiêu đề trong `children` (cùng kiểu màn `/manager/team-progress`).
   */
  hideToolbar?: boolean
  children: ReactNode
}

/** Khung chung màn Quản lý: toolbar gradient + nav hub + page-shell. */
export function ManagerScreenLayout({
  title,
  subtitle,
  toolbarExtra,
  hideHubNav,
  hideToolbar,
  children,
}: ManagerScreenLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col bg-app-canvas text-sm text-foreground',
        hideToolbar ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-[calc(100vh-3rem)]'
      )}
    >
      {hideToolbar ? null : (
        <Card className="page-toolbar-gradient rounded-none border-0 bg-transparent shadow-none">
          <div
            className="pointer-events-none absolute inset-0 opacity-25 motion-safe:animate-[dash-shimmer_10s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{
              background:
                'linear-gradient(110deg, transparent 0%, hsl(var(--primary) / 0.1) 50%, transparent 90%)',
              backgroundSize: '200% 100%',
            }}
          />
          {title ? (
            <div className="relative text-base font-semibold tracking-tight md:text-lg">
              <span className="bg-gradient-to-r from-primary via-teal-700 to-violet-700 bg-clip-text text-transparent">
                {title}
              </span>
            </div>
          ) : null}
          {subtitle ? (
            <p className="relative mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
          {toolbarExtra ? (
            <div className="relative mt-2 flex flex-wrap gap-2">{toolbarExtra}</div>
          ) : null}
        </Card>
      )}
      {hideHubNav ? null : <ManagerHubNav />}
      <div>{children}</div>
    </div>
  )
}
