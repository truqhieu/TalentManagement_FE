import { InfoHint } from '@/components/shared/InfoHint'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLearningOpsSummary } from '@/features/dashboard/hooks'
import { CARD_ENTRANCE_HOVER, staggerStyle } from '@/lib/cardMotion'
import { LEVEL_LABELS, LEVELS, type LevelCode } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AlertTriangle, GraduationCap } from 'lucide-react'
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const quartOut = '[transition-timing-function:cubic-bezier(0.25,1,0.48,1)]'

const LEVEL_PIE_COLORS: Record<LevelCode, string> = {
  tap_su: 'hsl(262 83% 55%)',
  biet_viec: 'hsl(199 85% 50%)',
  duoc_viec: 'hsl(160 55% 42%)',
  dong_gop_ket_qua: 'hsl(32 90% 52%)',
  tuong: 'hsl(350 70% 52%)',
}

const LEVELS_HINT = 'Số người theo cấp bậc nghề nghiệp hiện lưu trên hồ sơ (snapshot).'

const FAIL_TABLE_HINT =
  'Trong kỳ đã chọn: học viên có kết quả thi Chờ học lại hoặc Chia tay. Mỗi buổi/kỳ thi chỉ tính một lần (không cộng trùng khi chấm lại). Hàng có ≥ 2 lần trượt cùng cặp cấp được tô nổi bật.'

/* ──────────── Bar chart ──────────── */

function LevelBarChart({
  levelData,
}: {
  levelData: { code: string; name: string; value: number }[]
}) {
  const total = levelData.reduce((s, d) => s + d.value, 0)

  const chartData = useMemo(
    () =>
      levelData.map((entry) => ({
        name: entry.name,
        code: entry.code,
        value: entry.value,
        pct: total > 0 ? Math.round((entry.value / total) * 100) : 0,
        fill: LEVEL_PIE_COLORS[entry.code as LevelCode] ?? 'hsl(var(--primary))',
      })),
    [levelData, total]
  )

  const yAxisMax = Math.max(1, ...chartData.map((d) => d.value))

  return (
    <div className="space-y-4">
      <div className="h-40 w-full sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, yAxisMax]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted)/0.3)', rx: 8 }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                fontSize: 13,
              }}
              formatter={(value: number) => [`${value} người`, 'Số lượng']}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            >
              {chartData.map((entry) => (
                <Cell key={entry.code} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-end border-t border-border/40 pt-2.5">
        <span className="text-xs text-muted-foreground">Tổng cộng</span>
        <span className="ml-2 text-sm font-black tabular-nums text-foreground">{total}</span>
        <span className="ml-0.5 text-xs text-muted-foreground">người</span>
      </div>
    </div>
  )
}

function monthRangeLabelVi(year: number, startMonth: number, endMonth: number): string {
  if (startMonth === endMonth) return `T${startMonth} · ${year}`
  return `T${startMonth} – T${endMonth} · ${year}`
}

export type ManagerLearningOpsProps = {
  reportYear: number
  rangeStartMonth: number
  rangeEndMonth: number
}

export function ManagerLearningOpsZone({
  reportYear,
  rangeStartMonth,
  rangeEndMonth,
}: ManagerLearningOpsProps) {
  const { data, isLoading, isError, refetch, isFetching } = useLearningOpsSummary(
    reportYear,
    rangeStartMonth,
    rangeEndMonth,
    { enabled: true }
  )

  const rangeLabel = monthRangeLabelVi(reportYear, rangeStartMonth, rangeEndMonth)

  // Deduplicate: backend query có thể trả duplicate rows cùng (userId, levelFrom, levelTo).
  // Group by key, giữ failCount cao nhất để tránh hiển thị nhân đôi.
  const repeatFails = useMemo(() => {
    const raw = data?.usersWithAtLeastTwoExamFails ?? []
    const map = new Map<string, (typeof raw)[number]>()
    for (const row of raw) {
      const key = `${row.userId}|${row.levelFrom}|${row.levelTo}`
      const existing = map.get(key)
      if (!existing || row.failCount > existing.failCount) map.set(key, row)
    }
    return Array.from(map.values())
  }, [data?.usersWithAtLeastTwoExamFails])

  const levelChart = useMemo(() => {
    const src = data?.peopleByCareerLevel ?? {}
    return LEVELS.map((code) => ({
      code,
      name: LEVEL_LABELS[code],
      value: src[code] ?? 0,
    }))
  }, [data?.peopleByCareerLevel])

  const hasAnyLevel = levelChart.some((d) => d.value > 0)

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between',
          'motion-safe:animate-[dash-fade-up_0.55s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none'
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Vận hành &amp; phân bổ
          </h2>
          <span
            className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary"
            title="Kỳ đang lọc"
          >
            {rangeLabel}
          </span>
        </div>
        {isFetching && !isLoading ? (
          <span className="text-xs font-medium text-muted-foreground">Đang tải…</span>
        ) : null}
      </div>

      {isError ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          Không tải được thống kê.{' '}
          <Button
            type="button"
            variant="ghost"
            className="h-auto p-0 font-semibold text-destructive underline hover:bg-transparent"
            onClick={() => void refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border/80 bg-card/95 p-3 shadow-[var(--shadow-card)] sm:p-4',
          quartOut,
          CARD_ENTRANCE_HOVER,
          'transition-all duration-300 hover:border-primary/20',
          'motion-safe:animate-[dash-fade-up_0.6s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none'
        )}
        style={{ animationDelay: '40ms', ...staggerStyle(0, 50) }}
      >
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/10 text-primary">
            <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Phân bổ nhân sự theo cấp bậc
          </h3>
          <InfoHint text={LEVELS_HINT} label="Cách tính phân bổ cấp độ" />
        </div>
        {isLoading && !data ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : !hasAnyLevel ? (
          <p className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/25 px-4 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu cấp độ trong kỳ này.
          </p>
        ) : (
          <LevelBarChart levelData={levelChart} />
        )}
      </div>

      <section
        className={cn(
          'overflow-hidden rounded-xl border border-amber-500/20 bg-card/95 p-3 shadow-[var(--shadow-card)] sm:p-4',
          quartOut,
          CARD_ENTRANCE_HOVER,
          'transition-all duration-300 hover:border-amber-500/30',
          'motion-safe:animate-[dash-fade-up_0.5s_ease-out_both] motion-reduce:animate-none'
        )}
        style={{ animationDelay: '100ms' }}
        aria-label="Học viên trượt thi trong kỳ"
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Học viên trượt thi trong kỳ
          </h3>
          <InfoHint text={FAIL_TABLE_HINT} label="Cách tính danh sách trượt thi" />
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ) : repeatFails.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-4 py-4 text-center text-sm text-muted-foreground">
            Không có bản ghi nào trong kỳ này.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border/60 rounded-xl border border-border/60 md:hidden">
              {repeatFails.map((row) => {
                const lf = row.levelFrom as LevelCode
                const lt = row.levelTo as LevelCode
                const pairLabel = `${LEVEL_LABELS[lf] ?? row.levelFrom} → ${LEVEL_LABELS[lt] ?? row.levelTo}`
                return (
                  <div
                    key={`${row.userId}-${row.levelFrom}-${row.levelTo}`}
                    className={cn(
                      'space-y-2 p-4 odd:bg-background/40',
                      row.failCount >= 2 && 'bg-amber-500/5'
                    )}
                  >
                    <p className="break-words font-semibold text-foreground">
                      {row.fullName?.trim() || '—'}
                    </p>
                    <p className="text-xs font-medium text-foreground">{pairLabel}</p>
                    <p className="tabular-nums text-sm text-muted-foreground">
                      Mã NV: {row.employeeCode?.trim() || '—'}
                    </p>
                    <p className="break-all text-sm text-muted-foreground">
                      {row.email?.trim() || '—'}
                    </p>
                    <p className="text-right text-lg font-black tabular-nums text-amber-700 dark:text-amber-400">
                      Trượt: {row.failCount} lần
                    </p>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-border/60 md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40">
                    <th className="px-3 py-2.5 font-bold text-foreground sm:px-4">Họ tên</th>
                    <th className="min-w-[10rem] px-3 py-2.5 font-bold text-foreground sm:px-4">
                      Cặp cấp thi
                    </th>
                    <th className="px-3 py-2.5 font-bold text-foreground sm:px-4">Mã NV</th>
                    <th className="px-3 py-2.5 font-bold text-foreground sm:px-4">Email</th>
                    <th className="w-28 px-3 py-2.5 text-right font-bold text-foreground sm:px-4">
                      Lần trượt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {repeatFails.map((row) => {
                    const lf = row.levelFrom as LevelCode
                    const lt = row.levelTo as LevelCode
                    const pairLabel = `${LEVEL_LABELS[lf] ?? row.levelFrom} → ${LEVEL_LABELS[lt] ?? row.levelTo}`
                    return (
                      <tr
                        key={`${row.userId}-${row.levelFrom}-${row.levelTo}`}
                        className={cn(
                          'border-b border-border/50 last:border-0 odd:bg-background/40 transition-colors hover:bg-muted/20',
                          row.failCount >= 2 && 'bg-amber-500/5'
                        )}
                      >
                        <td className="px-3 py-2.5 font-semibold text-foreground sm:px-4">
                          {row.fullName?.trim() || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-medium text-foreground sm:px-4">
                          {pairLabel}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-muted-foreground sm:px-4">
                          {row.employeeCode?.trim() || '—'}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground sm:max-w-xs sm:px-4">
                          {row.email?.trim() || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black tabular-nums text-amber-700 dark:text-amber-400 sm:px-4">
                          {row.failCount}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
