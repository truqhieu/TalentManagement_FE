import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyDashboard } from '@/features/dashboard/hooks'
import { useHrOrgTree } from '@/features/hr-admin/useHrOrgTree'
import { useDebounce } from '@/hooks/useDebounce'
import { CARD_ENTRANCE_HOVER, staggerStyle } from '@/lib/cardMotion'
import { STARS_PER_LEVEL, type LevelCode } from '@/lib/constants'
import { isManagerLikeRole } from '@/lib/managerLikeRole'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import type { Role, StaffLevel } from '@/types/auth'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  Calendar,
  CheckCircle2,
  Flag,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  EvalBreakdownDonut,
  GradeDonut,
  KpiGauge,
  MemberKpiPanel,
  PerPersonBar,
  TrendLine,
} from './kpiCharts'
import { useKpiDashboardData } from './useKpiDashboardData'

export type KpiOkrPaths = { kpiOkr: string }

const quartOut = '[transition-timing-function:cubic-bezier(0.25,1,0.5,1)]'

function monthRangeLabel(year: number, startMonth: number, endMonth: number): string {
  if (startMonth === endMonth) return `Tháng ${startMonth}/${year}`
  return `Từ tháng ${startMonth} đến tháng ${endMonth}/${year}`
}

function parseLevelFromStaff(staffLevel: StaffLevel | undefined): LevelCode | null {
  if (staffLevel === 'PROBATION') return 'tap_su'
  if (staffLevel === 'PROFICIENT') return 'biet_viec'
  if (staffLevel === 'GENERAL') return 'tuong'
  return null
}

type SummaryCardProps = {
  title: string
  percent: number
  color: string
  icon: ReactNode
  footer: ReactNode
  delay: number
  loading?: boolean
}

function SummaryCard({ title, percent, color, icon, footer, delay, loading }: SummaryCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4',
        quartOut,
        'transition-all duration-300 hover:-translate-y-0.5',
        CARD_ENTRANCE_HOVER
      )}
      style={staggerStyle(delay)}
    >
      <div className="pointer-events-none absolute right-2 top-2 opacity-[0.08] transition-opacity group-hover:opacity-[0.14]">
        {icon}
      </div>
      <div className="relative z-10 flex items-center gap-3">
        <div className="shrink-0">
          {loading ? (
            <Skeleton className="h-[104px] w-[104px] rounded-full" />
          ) : (
            <KpiGauge percent={percent} color={color} size={104} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {loading ? (
            <Skeleton className="h-4 w-3/4" />
          ) : (
            <div className="text-sm font-medium text-muted-foreground">{footer}</div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Kỳ báo cáo do parent (dashboard quản lý) điều khiển — ẩn bộ lọc trùng trong khối KPI. */
export type ManagerReportPeriodBridge = {
  reportYear: number
  rangeStartMonth: number
  rangeEndMonth: number
  setReportYear: (y: number) => void
  setRangeStartMonth: (m: number) => void
  setRangeEndMonth: (m: number) => void
}

export interface DashboardKpiOkrZoneProps {
  role: Extract<Role, 'LEADER' | 'MANAGER' | 'MEMBER'>
  paths: KpiOkrPaths
  /** Manager: kỳ dùng chung với tab Học tập (bộ lọc ở ngoài). */
  managerReportPeriodFromParent?: ManagerReportPeriodBridge | null
}

type TeamOption = { id: string; name: string; deptName?: string }

/** Khối KPI · OKR · Báo cáo — LEADER/MANAGER: team; MEMBER: báo cáo cá nhân (cùng bộ lọc kỳ). */
export function DashboardKpiOkrZone({
  role,
  paths,
  managerReportPeriodFromParent = null,
}: DashboardKpiOkrZoneProps) {
  const user = useAuthStore((s) => s.user)
  const isLeader = role === 'LEADER'
  const isManager = isManagerLikeRole(role)
  const isMember = role === 'MEMBER'
  const [localReportYear, setLocalReportYear] = useState(() => new Date().getFullYear())
  const [localRangeStartMonth, setLocalRangeStartMonth] = useState(() => new Date().getMonth() + 1)
  const [localRangeEndMonth, setLocalRangeEndMonth] = useState(() => new Date().getMonth() + 1)

  const debouncedYear = useDebounce(localReportYear, 500)
  const debouncedStartMonth = useDebounce(localRangeStartMonth, 500)
  const debouncedEndMonth = useDebounce(localRangeEndMonth, 500)

  const reportYear = managerReportPeriodFromParent?.reportYear ?? debouncedYear
  const rangeStartMonth = managerReportPeriodFromParent?.rangeStartMonth ?? debouncedStartMonth
  const rangeEndMonth = managerReportPeriodFromParent?.rangeEndMonth ?? debouncedEndMonth
  const kpiFilterFromParent = Boolean(isManager && managerReportPeriodFromParent)

  const treeQ = useHrOrgTree()
  const teamIdsStr = user?.teamIds?.join(',')
  const teamOptions: TeamOption[] = useMemo(() => {
    const all = (treeQ.data?.departments ?? []).flatMap((d) =>
      d.teams.map((t) => ({ id: t.id, name: t.name, deptName: d.name }))
    )
    if (isManager) return all
    const myIds = new Set((teamIdsStr ?? '').split(',').filter(Boolean))
    if (!myIds.size) return []
    return all.filter((t) => myIds.has(t.id))
  }, [treeQ.data, isManager, teamIdsStr])

  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  useEffect(() => {
    if (selectedTeamId && teamOptions.some((t) => t.id === selectedTeamId)) return
    const firstId = teamOptions[0]?.id ?? ''
    if (firstId && firstId !== selectedTeamId) setSelectedTeamId(firstId)
  }, [teamOptions, selectedTeamId])

  const selectedTeam = teamOptions.find((t) => t.id === selectedTeamId)
  const isSelectedTeamValid = teamOptions.some((t) => t.id === selectedTeamId)

  const data = useKpiDashboardData({
    teamId: selectedTeamId,
    year: reportYear,
    startMonth: rangeStartMonth,
    endMonth: rangeEndMonth,
    enabled: Boolean(
      selectedTeamId && isSelectedTeamValid && !treeQ.isLoading && (!isMember || Boolean(user?.id))
    ),
    onlyAssigneeUserId: isMember ? user?.id : undefined,
  })

  const setReportYearClamped = (y: number) => {
    if (!Number.isFinite(y)) return
    const v = Math.min(2035, Math.max(2020, y))
    if (managerReportPeriodFromParent) managerReportPeriodFromParent.setReportYear(v)
    else setLocalReportYear(v)
  }

  const setFromMonth = (m: number) => {
    const mm = Math.min(12, Math.max(1, m))
    if (managerReportPeriodFromParent) {
      managerReportPeriodFromParent.setRangeStartMonth(mm)
      if (rangeEndMonth < mm) managerReportPeriodFromParent.setRangeEndMonth(mm)
      return
    }
    setLocalRangeStartMonth(mm)
    setLocalRangeEndMonth((prev) => (prev < mm ? mm : prev))
  }

  const setToMonth = (m: number) => {
    const mm = Math.min(12, Math.max(1, m))
    if (managerReportPeriodFromParent) {
      managerReportPeriodFromParent.setRangeEndMonth(mm)
      if (rangeStartMonth > mm) managerReportPeriodFromParent.setRangeStartMonth(mm)
      return
    }
    setLocalRangeEndMonth(mm)
    setLocalRangeStartMonth((prev) => (prev > mm ? mm : prev))
  }

  const {
    isLoading,
    teamSize,
    monthSpan,
    kpi,
    okr,
    report,
    evalBreakdown,
    kpiGradeDist,
    okrGradeDist,
    perPerson,
    trend,
    members,
  } = data

  /** Tên hiển thị cho user trong team — fallback về 'Thành viên'. */
  const nameFor = (userId: string): string => {
    const m = members.find((x) => x.userId === userId)
    return m?.displayName?.trim() || m?.email?.trim() || 'Thành viên'
  }

  const surveyMonths = report.expectedSurveyMonths ?? monthSpan

  const kpiFooter = (
    <span className="flex items-center gap-1">
      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden />
      {kpi.totalCount === 0
        ? monthSpan > 1
          ? 'Chưa có KPI trong các tháng đã chọn'
          : 'Chưa có KPI trong kỳ'
        : isMember
          ? `${kpi.okCount}/${kpi.totalCount} chỉ tiêu đạt OK (cá nhân)${monthSpan > 1 ? ' · gộp kỳ' : ''}`
          : `${kpi.okCount}/${kpi.totalCount} chỉ tiêu đạt OK · ${isLeader ? 'nhóm' : 'tất cả nhóm'}${monthSpan > 1 ? ' (gộp kỳ)' : ''}`}
    </span>
  )
  const okrFooter = (
    <span className="flex items-center gap-1">
      <RefreshCw className="h-3.5 w-3.5 shrink-0 text-primary-600" strokeWidth={2} aria-hidden />
      {okr.totalCount === 0
        ? monthSpan > 1
          ? 'Chưa có OKR trong các tháng đã chọn'
          : 'Chưa có OKR trong kỳ'
        : `${okr.okCount}/${okr.totalCount} kết quả then chốt đạt OK${monthSpan > 1 ? ' (gộp kỳ)' : ''}`}
    </span>
  )
  const reportFooter = (
    <span className="flex items-center gap-1">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
      {isMember
        ? monthSpan > 1
          ? `Bạn đã nộp khảo sát ${report.respondentsCount}/${surveyMonths} tháng trong kỳ`
          : report.respondentsCount > 0
            ? 'Bạn đã nộp khảo sát tháng này'
            : 'Bạn chưa nộp khảo sát trong kỳ đã chọn'
        : teamSize === 0
          ? 'Không có thành viên trong nhóm'
          : monthSpan > 1
            ? `${report.respondentsCount}/${teamSize} thành viên đã nộp khảo sát (ít nhất một tháng trong kỳ)`
            : `${report.respondentsCount}/${teamSize} thành viên đã nộp khảo sát`}
    </span>
  )

  /* ---------- "Lộ trình học & thăng hạng" — data thật từ /me/dashboard ---------- */
  const meDashQ = useMyDashboard({ enabled: Boolean(user) })
  const apiCareer = meDashQ.data?.career
  const levelFromStaff = parseLevelFromStaff(meDashQ.data?.staffLevel)
  const levelKey: LevelCode = levelFromStaff ?? apiCareer?.careerLevel ?? 'tap_su'
  const maxStars = STARS_PER_LEVEL[levelKey]
  const filledStars = apiCareer?.currentStars ?? meDashQ.data?.levelSource?.starCount ?? 0
  const starPct = maxStars > 0 ? Math.round((filledStars / maxStars) * 100) : 0
  const starsToGo = Math.max(0, maxStars - filledStars)

  const periodSummary = monthRangeLabel(reportYear, rangeStartMonth, rangeEndMonth)

  return (
    <div className="mx-auto space-y-4 text-sm text-foreground">
      {/* 2. Thanh ngữ cảnh: Phạm vi (team) → Kỳ — đúng thứ tự “xem gì, trong lúc nào” */}
      <section
        className={cn(
          'rounded-xl border border-border/80 bg-card/90 p-3 shadow-sm backdrop-blur-sm sm:p-3.5',
          'motion-safe:animate-[dash-fade-up_0.4s_ease-out_both] motion-reduce:animate-none'
        )}
        style={{ animationDelay: '40ms' }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {kpiFilterFromParent ? 'Phạm vi' : 'Phạm vi và kỳ'}
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
            {periodSummary}
          </span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          {/* Team — đặt trước: người dùng chọn “đối tượng” trước khi lọc thời gian */}
          <div
            className={cn(
              'min-w-0 flex-1',
              kpiFilterFromParent ? 'max-w-none' : 'lg:max-w-md xl:max-w-lg'
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" strokeWidth={2} aria-hidden />
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nhóm đang xem
              </Label>
            </div>
            {teamOptions.length > 1 || isManager ? (
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="h-9 w-full rounded-lg border-border bg-background text-left text-sm font-medium">
                  <SelectValue placeholder="Chọn nhóm để tải số liệu" />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.deptName ? (
                        <span className="ml-1 text-xs text-muted-foreground">· {t.deptName}</span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedTeam ? (
              <div className="flex h-9 items-center rounded-lg border border-primary/25 bg-primary/5 px-3 text-sm font-bold text-primary">
                {selectedTeam.name}
                {isMember ? (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    (chỉ số của bạn)
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Chưa có nhóm khả dụng.</p>
            )}
          </div>

          {!kpiFilterFromParent ? (
            <>
              <div
                className="hidden w-px shrink-0 self-stretch min-h-[3.5rem] bg-border lg:block"
                aria-hidden
              />

              {/* Kỳ báo cáo */}
              <div className="w-full lg:flex-1 lg:max-w-xl">
                <div className="mb-1.5 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary" strokeWidth={2} aria-hidden />
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Kỳ báo cáo (cùng năm)
                  </Label>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Năm</span>
                    <Input
                      type="number"
                      min={2020}
                      max={2035}
                      value={reportYear}
                      className="h-9 rounded-lg border-border bg-background text-sm tabular-nums"
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v)) setReportYearClamped(v)
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Từ tháng</span>
                    <Select
                      value={String(rangeStartMonth)}
                      onValueChange={(v) => setFromMonth(Number(v))}
                    >
                      <SelectTrigger className="h-9 rounded-lg border-border bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            Tháng {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground">Đến tháng</span>
                    <Select
                      value={String(rangeEndMonth)}
                      onValueChange={(v) => setToMonth(Number(v))}
                    >
                      <SelectTrigger className="h-9 rounded-lg border-border bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            Tháng {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  Số liệu dưới đây gộp chỉ tiêu và khảo sát trong toàn bộ tháng thuộc kỳ.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {!selectedTeamId ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
          {isManager
            ? 'Chọn nhóm ở phía trên để tải báo cáo KPI/OKR.'
            : 'Bạn chưa được gán vào nhóm nào. Vui lòng liên hệ nhân sự hoặc quản trị.'}
        </div>
      ) : (
        <>
          {/* 3. Tóm tắt nhanh — đọc ngay sau khi đã chọn team & kỳ */}
          <section aria-label="Tóm tắt KPI, OKR và khảo sát">
            <h2 className="sr-only">Chỉ số tóm tắt trong kỳ</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <SummaryCard
                title="Tiến độ KPI"
                percent={kpi.percent}
                color="hsl(var(--primary))"
                icon={
                  <Activity className="h-10 w-10 text-primary" strokeWidth={1.25} aria-hidden />
                }
                footer={kpiFooter}
                delay={0}
                loading={isLoading}
              />
              <SummaryCard
                title="Tiến độ OKR"
                percent={okr.percent}
                color="#10b981"
                icon={
                  <Flag className="h-10 w-10 text-emerald-500" strokeWidth={1.25} aria-hidden />
                }
                footer={okrFooter}
                delay={1}
                loading={isLoading}
              />
              <SummaryCard
                title={
                  isMember
                    ? 'Báo cáo hàng tháng (cá nhân)'
                    : isLeader
                      ? 'Báo cáo hàng tháng (nhóm)'
                      : 'Báo cáo hàng tháng'
                }
                percent={report.percent}
                color="hsl(var(--accent))"
                icon={<Target className="h-10 w-10 text-accent" strokeWidth={1.25} aria-hidden />}
                footer={reportFooter}
                delay={2}
                loading={isLoading}
              />
            </div>
          </section>

          {/* 4. Hành động tiếp theo — ngay dưới số liệu, không chôn ở cuối trang */}
          <section
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            aria-label="Liên kết chi tiết"
          >
            <p className="text-xs text-muted-foreground">
              Cần chỉnh chỉ tiêu hoặc xem biểu mẫu khảo sát chi tiết?
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              {!isMember ? (
                <Link
                  to="/monthly-report"
                  className={cn(
                    'inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-muted',
                    quartOut
                  )}
                >
                  Mở báo cáo hàng tháng
                </Link>
              ) : null}
              {!isManager ? (
                <Link
                  to={paths.kpiOkr}
                  className={cn(
                    'inline-flex min-h-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-600 px-4 py-2 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20',
                    quartOut,
                    'transition-all hover:opacity-95 active:scale-[0.98]'
                  )}
                >
                  {isMember
                    ? 'Nhập tiến độ & KPI của tôi'
                    : isLeader
                      ? 'KPI & OKR trong nhóm'
                      : 'Chi tiết KPI & OKR'}
                </Link>
              ) : null}
            </div>
          </section>

          {/* 5. Một cột chính: xu hướng → chi tiết chỉ tiêu → phân tích theo người */}
          <div className="space-y-4">
            {/* Xu hướng theo thời gian — đặt trước bảng chi tiết để có bối cảnh */}
            <div
              className={cn(
                'rounded-xl border border-border bg-card p-4 shadow-sm',
                CARD_ENTRANCE_HOVER
              )}
              style={staggerStyle(3)}
            >
              <div className="mb-3 border-b border-border/70 pb-2.5">
                <h3 className="text-base font-bold text-foreground sm:text-lg">
                  {monthSpan > 1
                    ? `Xu hướng theo tháng (${monthSpan} tháng)`
                    : 'Xu hướng trong kỳ đã chọn'}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {isMember
                    ? monthSpan > 1
                      ? '% KPI / OKR của bạn theo từng tháng trong kỳ.'
                      : '% KPI / OKR của bạn trong tháng đã chọn.'
                    : monthSpan > 1
                      ? '% đạt KPI / OKR trung bình từng tháng trong kỳ.'
                      : 'Một điểm cho tháng hiện tại; mở rộng kỳ để so sánh nhiều tháng liên tiếp.'}
                </p>
              </div>
              {isLoading ? (
                <Skeleton className="h-[180px] w-full rounded-lg" />
              ) : (
                <TrendLine points={trend} />
              )}
            </div>

            {/* Chỉ tiêu được giao + trạng thái */}
            <div
              className={cn('rounded-xl bg-muted/40 p-4', CARD_ENTRANCE_HOVER)}
              style={staggerStyle(4)}
            >
              <div className="mb-3 border-b border-border/60 pb-2.5">
                <h2 className="text-base font-bold text-foreground sm:text-lg">
                  {isMember ? 'Chi tiết chỉ tiêu của bạn' : 'Chi tiết chỉ tiêu đã giao'}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {monthSpan > 1
                    ? `Gộp ${monthSpan} tháng (${monthRangeLabel(data.year, data.startMonth, data.endMonth)})${isMember ? ' — chỉ chỉ tiêu của bạn.' : ' — cùng nguồn với màn KPI & OKR.'}`
                    : isMember
                      ? 'Mục tiêu và đánh giá quản lý của bạn trong kỳ.'
                      : 'Danh sách mục tiêu và đánh giá quản lý trong kỳ.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                <div className="xl:col-span-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Thành viên trong team
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full rounded-lg" />
                      <Skeleton className="h-12 w-full rounded-lg" />
                      <Skeleton className="h-12 w-full rounded-lg" />
                    </div>
                  ) : (
                    <MemberKpiPanel
                      assignments={data.assignments}
                      members={data.members}
                      nameFor={nameFor}
                    />
                  )}
                </div>
                <div className="rounded-xl border border-border bg-card p-3 shadow-sm xl:col-span-2">
                  <div className="mb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Đánh giá quản lý
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Tổng {kpi.totalCount + okr.totalCount} KPI/OKR
                    {monthSpan > 1 ? ' (gộp kỳ)' : ' trong kỳ'} — biểu đồ theo OK / NOT / chưa chấm
                  </div>
                  {isLoading ? (
                    <Skeleton className="mt-3 h-[160px] w-full rounded-lg" />
                  ) : (
                    <EvalBreakdownDonut breakdown={evalBreakdown} className="mt-2" />
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-md bg-emerald-50 py-1.5 dark:bg-emerald-950/30">
                      <div className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                        {evalBreakdown.ok}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        OK
                      </div>
                    </div>
                    <div className="rounded-md bg-rose-50 py-1.5 dark:bg-rose-950/30">
                      <div className="text-lg font-black tabular-nums text-rose-700 dark:text-rose-300">
                        {evalBreakdown.not}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        NOT
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 py-1.5 dark:bg-slate-900/40">
                      <div className="text-lg font-black tabular-nums text-slate-700 dark:text-slate-200">
                        {evalBreakdown.pending}
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Chưa
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* So sánh theo nhân sự + xếp loại — ẩn với role MEMBER */}
            {!isMember && (
              <div
                className={cn(
                  'rounded-xl border border-border bg-card p-4 shadow-sm',
                  CARD_ENTRANCE_HOVER
                )}
                style={staggerStyle(5)}
              >
                <div className="mb-3 border-b border-border/70 pb-2.5">
                  <h3 className="text-base font-bold text-foreground sm:text-lg">
                    So sánh theo nhân sự
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {monthSpan > 1
                      ? 'Cộng dồn đạt / chưa đạt qua các tháng trong kỳ.'
                      : 'Đạt và chưa đạt theo từng thành viên.'}
                  </p>
                </div>
                {isLoading ? (
                  <Skeleton className="h-[240px] w-full rounded-lg" />
                ) : (
                  <PerPersonBar rows={perPerson} />
                )}
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/60 pt-4 sm:grid-cols-2">
                  <GradeDonut dist={kpiGradeDist} title="Xếp loại KPI" />
                  <GradeDonut dist={okrGradeDist} title="Xếp loại OKR" />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
