import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { PromotionCelebrationModal } from '@/components/shared/PromotionCelebrationModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyDashboard } from '@/features/dashboard/hooks'
import { DashboardKpiOkrZone } from '@/features/employee-dashboard/components/DashboardKpiOkrZone'
import { DashboardLearningZone } from '@/features/employee-dashboard/components/DashboardLearningZone'
import { ManagerHrSnapshotCards } from '@/features/employee-dashboard/components/ManagerHrSnapshotCards'
import { ManagerLearningOpsZone } from '@/features/employee-dashboard/components/ManagerLearningOpsZone'
import {
  ManagerSharedReportPeriodFilter,
  type ManagerReportPeriod,
} from '@/features/employee-dashboard/components/ManagerSharedReportPeriodFilter'
import { VinhDanhSlide } from '@/features/employee-dashboard/components/VinhDanhSlide'
import { LEVEL_LABELS, STARS_PER_LEVEL, type LevelCode } from '@/lib/constants'
import { isManagerLikeRole } from '@/lib/managerLikeRole'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import type { Role, StaffLevel } from '@/types/auth'
import { BarChart3, GraduationCap, Medal, Target, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

function kpiOkrPaths(role: Role | undefined): { kpiOkr: string } {
  if (role === 'LEADER') return { kpiOkr: '/leader/kpi-okr' }
  if (isManagerLikeRole(role)) return { kpiOkr: '/monthly-report' }
  return { kpiOkr: '/kpi-okr' }
}

type DashboardTab = 'learning' | 'kpi'

const quartOut = '[transition-timing-function:cubic-bezier(0.25,1,0.48,1)]'

function parseLevelFromStaff(staffLevel: StaffLevel | undefined): LevelCode | null {
  if (staffLevel === 'PROBATION') return 'tap_su'
  if (staffLevel === 'PROFICIENT') return 'biet_viec'
  if (staffLevel === 'GENERAL') return 'tuong'
  return null
}

function formatDateVi(raw: string | null | undefined): string {
  const text = raw?.trim()
  if (!text) return '—'
  const numCheck = /^\d+$/.test(text) ? parseInt(text, 10) : text
  const asDate = new Date(numCheck)
  if (!Number.isNaN(asDate.getTime())) return asDate.toLocaleDateString('vi-VN')
  return text
}

const achievementCardStyles = [
  {
    icon: Trophy,
    panel:
      'border-amber-500/25 bg-gradient-to-br from-primary/12 via-card to-amber-50/90 shadow-[0_12px_40px_-12px_rgb(217_119_6/0.22)]',
    iconWrap:
      'bg-gradient-to-br from-amber-400 to-tier-gold text-white shadow-lg shadow-amber-500/35',
  },
  {
    icon: Target,
    panel:
      'border-primary/30 bg-gradient-to-br from-primary/[0.14] via-card to-accent/15 shadow-[var(--shadow-game-float)]',
    iconWrap:
      'bg-gradient-to-br from-primary to-primary-600 text-primary-foreground shadow-lg shadow-primary/40',
  },
  {
    icon: GraduationCap,
    panel:
      'border-accent/30 bg-gradient-to-br from-accent/12 via-card to-info-muted/50 shadow-[0_12px_36px_-14px_rgb(13_148_136/0.25)]',
    iconWrap:
      'bg-gradient-to-br from-accent to-[#0f766e] text-accent-foreground shadow-lg shadow-accent/30',
  },
  {
    icon: BarChart3,
    panel:
      'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-card to-primary/[0.06] shadow-[0_12px_36px_-12px_rgb(5_150_105/0.2)]',
    iconWrap:
      'bg-gradient-to-br from-emerald-500 to-[#047857] text-white shadow-lg shadow-emerald-600/30',
  },
] as const

export function EmployeeLearningDashboard() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const showKpiZone = role === 'MEMBER' || role === 'LEADER' || isManagerLikeRole(role)
  const isManagerLearningDash = isManagerLikeRole(role)
  const paths = kpiOkrPaths(role)
  const [tab, setTab] = useState<DashboardTab>('learning')
  const [isPending, startTransition] = useTransition()
  const handleTabChange = (t: DashboardTab) => {
    startTransition(() => setTab(t))
  }

  const [managerReportPeriod, setManagerReportPeriod] = useState<ManagerReportPeriod>(() => {
    const d = new Date()
    return {
      reportYear: d.getFullYear(),
      rangeStartMonth: d.getMonth() + 1,
      rangeEndMonth: d.getMonth() + 1,
    }
  })

  const managerKpiPeriodBridge = useMemo(
    () => ({
      reportYear: managerReportPeriod.reportYear,
      rangeStartMonth: managerReportPeriod.rangeStartMonth,
      rangeEndMonth: managerReportPeriod.rangeEndMonth,
      setReportYear: (y: number) =>
        setManagerReportPeriod((p) => ({
          ...p,
          reportYear: Math.min(2035, Math.max(2020, y)),
        })),
      setRangeStartMonth: (m: number) => {
        const mm = Math.min(12, Math.max(1, m))
        setManagerReportPeriod((p) => ({
          ...p,
          rangeStartMonth: mm,
          rangeEndMonth: p.rangeEndMonth < mm ? mm : p.rangeEndMonth,
        }))
      },
      setRangeEndMonth: (m: number) => {
        const mm = Math.min(12, Math.max(1, m))
        setManagerReportPeriod((p) => ({
          ...p,
          rangeStartMonth: p.rangeStartMonth > mm ? mm : p.rangeStartMonth,
          rangeEndMonth: mm,
        }))
      },
    }),
    [managerReportPeriod]
  )

  const { data: meDashboard, isLoading } = useMyDashboard({ enabled: Boolean(user) })
  const apiUser = meDashboard?.user
  const greetingName = apiUser?.displayName?.trim() || user?.name?.trim() || 'bạn'
  const apiCareer = meDashboard?.career
  const levelFromStaff = parseLevelFromStaff(meDashboard?.staffLevel)
  const levelKey: LevelCode = levelFromStaff ?? apiCareer?.careerLevel ?? 'tap_su'
  const levelLabel = LEVEL_LABELS[levelKey]
  const maxStars = STARS_PER_LEVEL[levelKey]
  const filledStars = apiCareer?.currentStars ?? meDashboard?.levelSource?.starCount ?? 0

  const avatarName = apiUser?.fullNameLegal?.trim() || user?.name || 'User'

  const levelLabelValue = isLoading ? 'Loading...' : levelLabel
  const promotionHistory = meDashboard?.promotionHistory ?? []
  const highlightAchievements = meDashboard?.highlightAchievements ?? []

  const starPct = maxStars > 0 ? Math.round((filledStars / maxStars) * 100) : 0

  // ─── Promotion Celebration Detection ───
  const [celebrationPromotion, setCelebrationPromotion] = useState<{
    fromLevel: LevelCode | null
    toLevel: LevelCode
    promotedAt: string
    displayName: string
    nextStarTopics?: Array<{ topic: string; objectives: string[] }>
  } | null>(null)

  useEffect(() => {
    if (isLoading || !meDashboard) return

    const history = meDashboard.promotionHistory ?? []
    if (history.length === 0) {
      console.log('[Celebration] No promotion history found.')
      return
    }

    // Tìm thăng cấp gần nhất trong 7 ngày gần đây
    const now = Date.now()
    const detectWindowMs = 7 * 24 * 60 * 60 * 1000
    const recentPromo = history.find((p: any) => {
      // 1. Level up: toLevel khác fromLevel (hoặc fromLevel null)
      const isLevelUp = p.toLevel && (!p.fromLevel || p.fromLevel !== p.toLevel)

      // 2. Star up: toLevel giống fromLevel nhưng note có chữ "Sao"
      const isStarUp =
        p.fromLevel &&
        p.toLevel &&
        p.fromLevel === p.toLevel &&
        (p.note?.toLowerCase().includes('sao') || p.note?.includes('⭐'))

      if (!isLevelUp && !isStarUp) return false

      const promotedAt = new Date(p.promotedAt).getTime()
      const isRecent = now - promotedAt < detectWindowMs

      return isRecent
    })

    if (!recentPromo) {
      console.log('[Celebration] No recent promotion in the last 7 days.')
      return
    }

    // Kiểm tra xem user đã dismiss chưa (localStorage)
    const dismissKey = `promo_seen_${user?.id}_${new Date(recentPromo.promotedAt).getTime()}`
    if (localStorage.getItem(dismissKey)) {
      console.log('[Celebration] Promotion already seen/dismissed.')
      return
    }

    console.log('[Celebration] Triggering celebration for:', recentPromo)

    setCelebrationPromotion({
      fromLevel: recentPromo.fromLevel as LevelCode,
      toLevel: recentPromo.toLevel as LevelCode,
      promotedAt: recentPromo.promotedAt,
      displayName: recentPromo.note?.includes('Sao')
        ? `${greetingName} — ${recentPromo.note}`
        : greetingName,
      nextStarTopics: (meDashboard as any).nextStarTopics,
    })
  }, [isLoading, meDashboard, user?.id, greetingName])

  const handleDismissCelebration = useCallback(() => {
    if (celebrationPromotion && user?.id) {
      const dismissKey = `promo_seen_${user.id}_${new Date(celebrationPromotion.promotedAt).getTime()}`
      localStorage.setItem(dismissKey, '1')
    }
    setCelebrationPromotion(null)
  }, [celebrationPromotion, user?.id])

  return (
    <div className="relative flex flex-col bg-app-canvas text-sm text-foreground md:-m-2">
      {/* Promotion Celebration Modal */}
      {celebrationPromotion && (
        <PromotionCelebrationModal
          fromLevel={celebrationPromotion.fromLevel}
          toLevel={celebrationPromotion.toLevel}
          displayName={celebrationPromotion.displayName}
          promotedAt={celebrationPromotion.promotedAt}
          nextStarTopics={celebrationPromotion.nextStarTopics}
          onDismiss={handleDismissCelebration}
        />
      )}
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden />

      <div
        className={cn(
          'relative z-[1]',
          isManagerLearningDash ? 'space-y-3 pb-4' : 'space-y-4 pb-8'
        )}
      >
        {isManagerLearningDash ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <section className="min-w-0 shrink-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tổng quan quản lý</h1>
              <p className="text-sm text-muted-foreground">
                Nhân sự, học tập &amp; KPI theo kỳ báo cáo.
              </p>
            </section>
            <ManagerSharedReportPeriodFilter
              value={managerReportPeriod}
              onChange={setManagerReportPeriod}
              className="w-full shrink-0 motion-reduce:animate-none sm:flex-1 sm:min-w-[min(100%,42rem)] lg:max-w-[48rem] !rounded-lg !border-border/80 !bg-card/90 !p-2 !shadow-sm [&>div:first-child]:hidden [&>div:last-child]:grid-cols-3 [&>div:last-child]:gap-2 [&>div>div]:space-y-1 [&>div>div>span]:text-sm [&>div>div>span]:font-semibold [&_input]:h-8 [&_input]:rounded-lg [&_input]:text-xs [&_button]:h-8 [&_button]:min-h-8 [&_button]:rounded-lg [&_button]:text-xs"
            />
          </div>
        ) : null}

        {/* MEMBER: Profile summary card — đặt trên cùng, không để VinhDanh/header rỗng chiếm chỗ */}
        {!isManagerLearningDash && user ? (
          <section
            className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6"
            aria-label="Tổng quan cá nhân"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-10">
              <EmployeeAvatar
                name={avatarName}
                photoUrl={resolvePublicAssetUrl(user.portraitRef || apiUser?.portraitRef)}
                className="h-24 w-24 shrink-0 rounded-xl text-2xl ring-0 shadow-sm sm:h-28 sm:w-28 sm:text-3xl md:h-32 md:w-32"
                showOnlineDot
              />
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-xl font-black leading-tight tracking-tight text-foreground sm:text-2xl">
                  Tổng quan cá nhân
                </h2>
                <p className="text-base leading-snug text-muted-foreground sm:text-lg">
                  Chào <span className="font-semibold text-primary">{greetingName}</span>, hãy cùng
                  thu thập sao và leo hạng nhé.
                </p>
              </div>
            </div>

            <div className="w-full shrink-0 sm:w-auto sm:min-w-[min(100%,380px)]">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Cấp độ hiện tại
              </p>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2 ">
                  <span className="rounded-full px-3.5 py-1 text-sm font-bold text-accent-foreground shadow-sm bg-[#006C49]">
                    {levelLabelValue}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Tháng {new Date().getMonth() + 1} - {new Date().getFullYear()}
                  </span>
                </div>
                <span className="shrink-0 text-lg font-black text-[#006C49] sm:text-xl">
                  XP {starPct}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
                  style={{ width: `${starPct}%` }}
                  role="progressbar"
                  aria-valuenow={starPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Tiến độ XP"
                />
              </div>
            </div>
          </section>
        ) : null}

        {!isManagerLearningDash ? <VinhDanhSlide /> : null}

        {showKpiZone ? (
          <div className={isManagerLearningDash ? 'space-y-3' : 'space-y-5'}>
            {isManagerLearningDash && (
              <ManagerHrSnapshotCards
                reportYear={managerReportPeriod.reportYear}
                rangeStartMonth={managerReportPeriod.rangeStartMonth}
                rangeEndMonth={managerReportPeriod.rangeEndMonth}
              />
            )}
            {/* Tab switcher */}
            <div
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              role="tablist"
              aria-label="Chuyển tab"
            >
              <div className="inline-flex rounded-lg border p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  role="tab"
                  id="dash-tab-learning"
                  aria-selected={tab === 'learning'}
                  aria-controls="dash-panel-learning"
                  tabIndex={tab === 'learning' ? 0 : -1}
                  onClick={() => handleTabChange('learning')}
                  className={cn(
                    'inline-flex h-auto min-h-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-bold transition-all duration-300',
                    tab === 'learning'
                      ? 'bg-[#006C49] text-white hover:bg-[#006C49]/90 hover:text-white'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                    isPending && tab === 'learning' && 'opacity-70'
                  )}
                >
                  <GraduationCap className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Học tập
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  role="tab"
                  id="dash-tab-kpi"
                  aria-selected={tab === 'kpi'}
                  aria-controls="dash-panel-kpi"
                  tabIndex={tab === 'kpi' ? 0 : -1}
                  onClick={() => handleTabChange('kpi')}
                  className={cn(
                    'inline-flex h-auto min-h-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-bold transition-all duration-300',
                    tab === 'kpi'
                      ? 'bg-[#006C49] text-white hover:bg-[#006C49]/90 hover:text-white'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                    isPending && tab === 'kpi' && 'opacity-70'
                  )}
                >
                  <Target className="h-4 w-4 shrink-0" strokeWidth={2} />
                  KPI · OKR
                </Button>
              </div>
            </div>

            <div
              id="dash-panel-learning"
              role="tabpanel"
              aria-labelledby="dash-tab-learning"
              hidden={tab !== 'learning'}
            >
              {tab === 'learning' &&
                (isManagerLearningDash ? (
                  <ManagerLearningOpsZone
                    reportYear={managerReportPeriod.reportYear}
                    rangeStartMonth={managerReportPeriod.rangeStartMonth}
                    rangeEndMonth={managerReportPeriod.rangeEndMonth}
                  />
                ) : (
                  <DashboardLearningZone
                    isLoading={isLoading}
                    currentLevel={levelKey}
                    currentStars={filledStars}
                  />
                ))}
            </div>
            <div
              id="dash-panel-kpi"
              role="tabpanel"
              aria-labelledby="dash-tab-kpi"
              hidden={tab !== 'kpi'}
            >
              {tab === 'kpi' && (
                <>
                  {isManagerLearningDash && <VinhDanhSlide compact className="mb-3" />}
                  <DashboardKpiOkrZone
                    role={role as 'LEADER' | 'MANAGER' | 'MEMBER'}
                    paths={paths}
                    managerReportPeriodFromParent={
                      isManagerLearningDash ? managerKpiPeriodBridge : null
                    }
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <section aria-labelledby="dash-section-learning-only">
            <h2 id="dash-section-learning-only" className="sr-only">
              Học tập
            </h2>
            <DashboardLearningZone
              isLoading={isLoading}
              currentLevel={levelKey}
              currentStars={filledStars}
            />
          </section>
        )}

        {!isManagerLearningDash ? (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <section
              className="flex h-full flex-col rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[var(--shadow-card)]"
              aria-label="Lịch sử thăng cấp"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                Lịch sử thăng cấp
              </div>
              {isLoading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ) : promotionHistory.length === 0 ? (
                <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
                  Chưa có lịch sử.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {promotionHistory.map((p, idx) => (
                    <li
                      key={`${p.promotedAt}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {p.fromLevel ? LEVEL_LABELS[p.fromLevel] : '—'} → {LEVEL_LABELS[p.toLevel]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateVi(p.promotedAt)}
                        {p.note ? ` · ${p.note}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="flex h-full flex-col rounded-2xl border border-border/80 bg-card/95 p-4 shadow-[var(--shadow-card)]"
              aria-labelledby="dash-highlight-achievements"
            >
              <h2
                id="dash-highlight-achievements"
                className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider"
              >
                <Medal className="h-4 w-4 text-amber-500" aria-hidden />
                Thành tựu
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {highlightAchievements.length === 0 ? (
                  <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground sm:col-span-2">
                    Chưa có thành tựu.
                  </div>
                ) : (
                  highlightAchievements.map((achievement, idx) => {
                    const style =
                      achievementCardStyles[idx % achievementCardStyles.length] ??
                      achievementCardStyles[0]!
                    const AchievementIcon = style.icon
                    return (
                      <div
                        key={achievement.id}
                        className={cn(
                          'group relative overflow-hidden rounded-2xl border p-4',
                          style.panel,
                          quartOut,
                          'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0'
                        )}
                      >
                        <div className="relative mb-2 flex items-start justify-between gap-2">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                              style.iconWrap
                            )}
                          >
                            <AchievementIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          </div>
                          <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-black uppercase tracking-tight text-foreground shadow-sm backdrop-blur-sm">
                            {achievement.badge?.trim() ||
                              (achievement.score != null ? `+${achievement.score}` : 'Nổi bật')}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/80">
                          {achievement.title}
                        </h3>
                        <p className="mt-1 text-xs font-semibold leading-snug text-foreground">
                          {achievement.description?.trim() || 'Đã ghi nhận một thành tựu.'}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                          {achievement.levelScope?.trim() || 'Cá nhân'}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
