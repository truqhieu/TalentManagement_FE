import { Link } from '@tanstack/react-router'
import { Calendar, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/manager/exam-schedule' as const, label: 'Lịch thi', icon: Calendar },
  { to: '/manager/exam-papers' as const, label: 'Đề thi', icon: FileText },
]

export type ExamManagementTab = (typeof TABS)[number]['to']

/**
 * Thanh tab gộp 2 màn Lịch thi (gồm gán đề + xem điểm) & Đề thi — mỗi tab là 1 route riêng để giữ deep link.
 * `className` để màn gọi tự quyết chỗ đặt (vd. đặt inline trong hàng tiêu đề thay vì khối riêng phía trên).
 */
export function ExamManagementTabs({
  active,
  className,
}: {
  active: ExamManagementTab
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex w-fit items-center gap-1 rounded-2xl border border-border bg-muted/40 p-1',
        className
      )}
    >
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors',
            active === t.to
              ? 'bg-card text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <t.icon className="h-3.5 w-3.5" />
          {t.label}
        </Link>
      ))}
    </div>
  )
}
