import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkeletonApprovalCardList } from '@/components/ui/skeleton'
import { ManagerScreenLayout } from '@/features/manager/components/ManagerHub/ManagerScreenLayout'
import type { ApprovalsPage } from '@/features/manager/types'
import { CARD_ENTRANCE_HOVER, staggerStyle } from '@/lib/cardMotion'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Award,
  ChevronDown,
  History,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '?'
    const b = parts[parts.length - 1]?.[0] ?? '?'
    return (a + b).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export interface ApprovalQueueProps {
  page: ApprovalsPage | undefined
  isLoading: boolean
  isApproving?: string | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function ApprovalQueue({
  page,
  isLoading,
  isApproving,
  onApprove,
  onReject,
}: ApprovalQueueProps) {
  const user = useAuthStore((s) => s.user)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [levelFilter, setLevelFilter] = React.useState<string>('all')
  const [teamFilter, setTeamFilter] = React.useState<string>('all')

  const hasPromotions = !!page && page.promotions.length > 0
  const hasGrader = !!page && page.graderReviews.length > 0

  const uniqueTeams = React.useMemo(() => {
    if (!page) return []
    const teams = new Set<string>()
    page.promotions.forEach((p) => {
      const match = p.description.match(/Team: (.*?) ·/)
      if (match && match[1]) teams.add(match[1])
    })
    return Array.from(teams).sort()
  }, [page])

  const filteredPromotions = React.useMemo(() => {
    if (!page) return []
    return page.promotions.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
      const levelBadge = p.badges.find((b) =>
        ['Tập sự', 'Biết việc', 'Được việc', 'Đóng góp kết quả', 'Tướng'].includes(b.label)
      )?.label
      const matchesLevel = levelFilter === 'all' || levelBadge === levelFilter
      const matchesTeam = teamFilter === 'all' || p.description.includes(`Team: ${teamFilter}`)
      return matchesSearch && matchesLevel && matchesTeam
    })
  }, [page, searchQuery, levelFilter, teamFilter])

  const [visibleCount, setVisibleCount] = React.useState(40)

  React.useEffect(() => {
    setVisibleCount(40)
  }, [searchQuery, levelFilter, teamFilter])

  const visiblePromotions = React.useMemo(() => {
    return filteredPromotions.slice(0, visibleCount)
  }, [filteredPromotions, visibleCount])

  const showQueueEmpty = !!page && filteredPromotions.length === 0 && !hasGrader

  const onGraderConfirm = (id: string) => {
    toast.success('Đã xác nhận kết quả chấm')
  }

  const onGraderRedo = (id: string) => {
    toast.info('Đã gửi yêu cầu chấm lại')
  }

  const getPromotionAction = (p: ApprovalsPage['promotions'][number]) => {
    const levelBadge = p.badges.find((b) =>
      ['Tập sự', 'Biết việc', 'Được việc', 'Đóng góp kết quả', 'Tướng'].includes(b.label)
    )
    const currentLevel = levelBadge?.label || ''

    if (currentLevel === 'Tập sự') {
      return { label: 'Lên Biết việc', type: 'level' }
    }

    const starBadge = p.badges.find((b) => b.label.includes('sao'))
    const stars = starBadge ? parseInt(starBadge.label, 10) : 0

    if (stars >= 6) {
      let nextLevel = 'cấp mới'
      if (currentLevel === 'Biết việc') nextLevel = 'Được việc'
      else if (currentLevel === 'Được việc') nextLevel = 'Đóng góp kết quả'
      else if (currentLevel === 'Đóng góp kết quả') nextLevel = 'Tướng'
      return { label: `Lên ${nextLevel}`, type: 'level' }
    }

    return { label: 'Thăng sao', type: 'star' }
  }

  return (
    <ManagerScreenLayout hideHubNav hideToolbar>
      <div className="animate-page-entrance flex flex-col gap-4 pb-4">
        {/* Header Section */}
        <div className={cn('')}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="">
              <h1 className="text-2xl font-bold text-foreground mb-3">Quản lý thăng tiến</h1>
              <p className="text-sm text-muted-foreground">
                Phê duyệt thăng cấp bậc và thăng sao cho nhân sự đủ điều kiện. Hệ thống tự động gợi
                ý dựa trên kết quả học tập và KPI.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/hr-admin"
                search={{ page: 1, pageSize: 15 }}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#006C49]/10 bg-[#006C49]/0.2 px-5 py-3 text-sm font-bold text-[#006C49] shadow-sm transition-all hover:bg-[#006C49]/50 active:scale-95"
              >
                <History className="h-4 w-4" />
                Lịch sử duyệt
              </Link>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card/50 p-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Tìm tên nhân sự hoặc team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-[18px] border-none bg-muted/40 pl-11 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-[18px] bg-muted/40 px-3 py-1">
              <ShieldCheck className="h-4 w-4 text-muted-foreground/60" />
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-9 w-[130px] border-none bg-transparent p-0 text-sm font-bold shadow-none focus:ring-0">
                  <SelectValue placeholder="Cấp bậc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cấp</SelectItem>
                  <SelectItem value="Tập sự">Tập sự</SelectItem>
                  <SelectItem value="Biết việc">Biết việc</SelectItem>
                  <SelectItem value="Được việc">Được việc</SelectItem>
                  <SelectItem value="Đóng góp kết quả">Đóng góp kết quả</SelectItem>
                  <SelectItem value="Tướng">Tướng</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-[18px] bg-muted/40 px-3 py-1">
              <Users className="h-4 w-4 text-muted-foreground/60" />
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 w-[150px] border-none bg-transparent p-0 text-sm font-bold shadow-none focus:ring-0">
                  <SelectValue placeholder="Tất cả Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả Team</SelectItem>
                  {uniqueTeams.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || levelFilter !== 'all' || teamFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setLevelFilter('all')
                  setTeamFilter('all')
                }}
                className="h-10 rounded-2xl px-4 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <SkeletonApprovalCardList count={4} />
        ) : (
          <div className="space-y-6">
            {/* Promotion Cards Grid */}
            {hasPromotions && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {visiblePromotions.map((p, pi) => {
                    const action = getPromotionAction(p)
                    const isLevelUp = action.type === 'level'

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          'group relative overflow-hidden rounded-[32px] border border-border bg-card p-6 transition-all duration-300',
                          CARD_ENTRANCE_HOVER,
                          p.state === 'waiting' && 'opacity-70 grayscale-[0.5]',
                          p.highlighted && 'ring-2 ring-primary/20 bg-primary/[0.02]'
                        )}
                        style={staggerStyle(pi, 50)}
                      >
                        {/* Badge Decor */}
                        <div className="absolute -right-4 -top-4 rotate-12 opacity-[0.03] transition-transform group-hover:rotate-0">
                          {isLevelUp ? (
                            <Award className="h-32 w-32" />
                          ) : (
                            <Star className="h-32 w-32" />
                          )}
                        </div>

                        <div className="relative flex flex-col gap-6">
                          {/* Top: Profile & Level Path */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-lg font-black shadow-lg ring-4 ring-background transition-transform group-hover:scale-105',
                                  p.avatarClass ??
                                    'bg-gradient-to-br from-primary to-primary-600 text-white'
                                )}
                              >
                                {p.initials ?? initialsFromName(p.name)}
                              </div>
                              <div>
                                <h3 className="text-base font-black tracking-tight text-foreground">
                                  {p.name}
                                </h3>
                                <p className="mt-0.5 text-xs font-bold text-muted-foreground/70">
                                  {p.description}
                                </p>
                              </div>
                            </div>

                            <div className="hidden flex-col items-end gap-1 sm:flex">
                              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5">
                                {isLevelUp ? (
                                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                )}
                                <span className="text-[11px] font-black uppercase tracking-wider">
                                  {isLevelUp ? 'Thăng cấp bậc' : 'Thăng sao'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Middle: Path Visualization */}
                          <div className="flex items-center justify-center rounded-2xl bg-muted/30 py-4 px-6 border border-border/40">
                            <div className="flex flex-1 flex-col items-center gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                Hiện tại
                              </span>
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {p.badges.map((b, i) => (
                                  <span
                                    key={i}
                                    className={cn(
                                      'rounded-lg px-2 py-1 text-[11px] font-black ring-1 ring-inset',
                                      b.tone === 'info' &&
                                        'bg-blue-50 text-blue-700 ring-blue-700/10',
                                      b.tone === 'warning' &&
                                        'bg-amber-50 text-amber-700 ring-amber-700/10',
                                      b.tone === 'success' &&
                                        'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
                                      (!b.tone || b.tone === 'neutral') &&
                                        'bg-gray-100 text-gray-600 ring-gray-400/10'
                                    )}
                                  >
                                    {b.label}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="mx-4 flex flex-col items-center">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card shadow-sm border border-border transition-transform group-hover:translate-x-1">
                                <ArrowRight className="h-4 w-4 text-primary" />
                              </div>
                            </div>

                            <div className="flex flex-1 flex-col items-center gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                                Mục tiêu
                              </span>
                              <span className="rounded-lg bg-primary/10 px-3 py-1 text-[11px] font-black text-primary ring-1 ring-primary/20">
                                {action.label.replace('Lên ', '')}
                              </span>
                            </div>
                          </div>

                          {/* Bottom: Actions */}
                          <div className="flex items-center gap-3">
                            {p.state === 'actionable' ? (
                              <>
                                <Button
                                  onClick={() => onApprove?.(p.id)}
                                  disabled={isApproving === p.id}
                                  className="h-12 flex-1 rounded-2xl bg-emerald-600 font-black text-white shadow-[0_8px_16px_-4px_rgba(5,150,105,0.25)] transition-all hover:bg-emerald-700 hover:shadow-lg active:scale-95"
                                >
                                  {isApproving === p.id ? (
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <span className="inline-flex items-center gap-2">
                                      <UserCheck className="h-5 w-5" />
                                      {action.label}
                                    </span>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => onReject?.(p.id)}
                                  className="h-12 rounded-2xl border-rose-200 bg-rose-50 px-6 font-bold text-rose-700 shadow-sm hover:bg-rose-100 hover:text-rose-800"
                                >
                                  Từ chối
                                </Button>
                              </>
                            ) : (
                              <div className="flex h-12 w-full items-center justify-center rounded-2xl bg-muted/50 text-[13px] font-black text-muted-foreground italic border border-border/60">
                                {p.stateLabel ?? 'Đang chờ xử lý'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Progressive Load More button for optimal DOM performance */}
                {visibleCount < filteredPromotions.length && (
                  <div className="flex justify-center pt-4 pb-8">
                    <Button
                      onClick={() => setVisibleCount((prev) => prev + 40)}
                      className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-black px-10 py-7 h-auto shadow-none border border-primary/5 tracking-wide text-sm transition-all active:scale-95"
                    >
                      <ChevronDown className="mr-2.5 h-5 w-5 animate-bounce" />
                      Xem thêm nhân sự ({filteredPromotions.length - visibleCount} người còn lại)
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {(showQueueEmpty || !page) && (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-border/60 bg-muted/20 p-12 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-primary/5 blur-3xl" />
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-[40px] bg-card shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)]">
                    <UserCheck className="h-16 w-16 text-primary/20" strokeWidth={1} />
                    <Sparkles className="absolute -right-2 -top-2 h-10 w-10 text-amber-400" />
                  </div>
                </div>
                <h3 className="text-xl font-black text-foreground">Hàng chờ trống</h3>
                <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-muted-foreground">
                  Hiện tại không có yêu cầu thăng tiến nào cần phê duyệt. Bạn đã hoàn thành xuất sắc
                  công việc quản trị hôm nay!
                </p>
                <Button
                  variant="ghost"
                  onClick={() => window.location.reload()}
                  className="mt-8 rounded-2xl font-bold text-primary hover:bg-primary/5"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Làm mới dữ liệu
                </Button>
              </div>
            )}

            {/* Grader Reviews Section */}
            {hasGrader && (
              <div className="mt-12 rounded-[32px] border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-8 py-5">
                  <Medal className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    Phê duyệt kết quả chấm bài
                  </h3>
                </div>
                <div className="divide-y divide-border px-4">
                  {page!.graderReviews.map((row) => (
                    <div
                      key={row.id}
                      className="group flex flex-col gap-4 p-5 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary text-xs font-black">
                          {initialsFromName(row.employeeName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-foreground">
                              {row.employeeName}
                            </span>
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-tighter',
                                row.graderVerdict === 'pass'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              )}
                            >
                              {row.graderVerdict === 'pass' ? 'Đạt' : 'Trượt'}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground/80 mt-0.5">
                            {row.detail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => onGraderConfirm(row.id)}
                          className="h-9 rounded-xl bg-primary px-4 text-xs font-black text-white hover:bg-primary-600 active:scale-95 shadow-sm"
                        >
                          Xác nhận
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => onGraderRedo(row.id)}
                          className="h-9 rounded-xl px-4 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Chấm lại
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ManagerScreenLayout>
  )
}
