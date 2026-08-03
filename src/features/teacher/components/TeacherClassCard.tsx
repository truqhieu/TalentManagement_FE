import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CARD_ENTRANCE, staggerStyle } from '@/lib/cardMotion'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import { Award, Crown, Presentation, School, Star, Target, TrendingUp, Users } from 'lucide-react'
import type { TeacherClassRow } from './teacherClassTypes'

export interface TeacherClassCardProps {
  classRow: TeacherClassRow
  selected: boolean
  onSelect: () => void
  cardIndex?: number
}

const ACCENT_CLASSES: Record<TeacherClassRow['accent'], string> = {
  primary: 'from-blue-600/20 to-indigo-600/10 text-blue-700 ring-blue-600/20 bg-blue-50/50',
  amber: 'from-amber-600/20 to-orange-600/10 text-amber-700 ring-amber-600/20 bg-amber-50/50',
  emerald:
    'from-emerald-600/20 to-teal-600/10 text-emerald-700 ring-emerald-600/20 bg-emerald-50/50',
  violet: 'from-violet-600/20 to-purple-600/10 text-violet-700 ring-violet-600/20 bg-violet-50/50',
  rose: 'from-rose-600/20 to-pink-600/10 text-rose-700 ring-rose-600/20 bg-rose-50/50',
}

const BADGE_CLASSES: Record<TeacherClassRow['accent'], string> = {
  primary: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
}

const TRACK_LABELS: Record<string, string> = {
  tap_su: 'Tập sự',
  biet_viec: 'Biết việc',
  duoc_viec: 'Được việc',
  dong_gop_ket_qua: 'Đóng góp',
  tuong: 'Tướng',
}

export function TeacherClassCard({
  classRow: c,
  selected,
  onSelect,
  cardIndex,
}: TeacherClassCardProps) {
  const IconMain = c.track === 'tap_su' ? Presentation : Award
  const MetaIcon = (() => {
    switch (c.metaIcon) {
      case 'trending':
        return TrendingUp
      case 'school':
        return School
      case 'star':
        return Star
      case 'crown':
        return Crown
      case 'target':
        return Target
      default:
        return School
    }
  })()

  const progressPct = Math.min(100, Math.round((c.memberCount / 24) * 100))

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[24px] border-border/50 bg-card p-5 text-left transition-all duration-300 hover:border-primary/30 hover:shadow-xl',
        cardIndex !== undefined && CARD_ENTRANCE,
        selected ? 'border-primary ring-2 ring-primary/20 shadow-lg' : 'shadow-sm'
      )}
      style={cardIndex !== undefined ? staggerStyle(Math.min(cardIndex, 16)) : undefined}
    >
      {/* Decorative background blur */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />

      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-end gap-1.5">
          <Badge
            className={cn(
              'w-fit truncate px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-[#006C49]/90 text-white'
            )}
          >
            {c.periodBadge}
          </Badge>
          <Badge className="inline-flex items-center gap-1.5 border-border/50 bg-muted/40 px-2.5 py-1 text-xs font-bold text-muted-foreground backdrop-blur-sm">
            <Users className="size-3" strokeWidth={2.5} aria-hidden />
            {c.memberCount} HV
          </Badge>
        </div>
      </div>

      <div className="mb-5 flex-1 min-w-0">
        <h3 className="line-clamp-1 text-[15px] font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
          {c.title}
        </h3>
        <p className="mt-1 text-xs font-medium text-muted-foreground/80 uppercase tracking-widest">
          Lớp phụ trách
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-[#006C49]/90 text-white px-2 text-xs font-bold">
            <MetaIcon className="size-3" strokeWidth={2.5} aria-hidden />
            {TRACK_LABELS[c.track] || c.track}
          </Badge>
          <span className="text-xs font-bold text-muted-foreground/30">/</span>
          <span className="text-xs font-semibold text-muted-foreground line-clamp-1">
            {c.examLine}
          </span>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <span className="text-muted-foreground">Sĩ số lớp</span>
          <span className="text-primary">{progressPct}%</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-[width] duration-1000 ease-out shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <Button
        asChild
        className={cn(
          'h-11 w-full rounded-xl text-sm font-bold shadow-md transition-all hover:shadow-lg active:scale-95'
        )}
      >
        <Link
          to="/teacher/classes/$classId"
          params={{ classId: c.id }}
          onClick={(e) => e.stopPropagation()}
        >
          Xem chi tiết
        </Link>
      </Button>
    </Card>
  )
}
