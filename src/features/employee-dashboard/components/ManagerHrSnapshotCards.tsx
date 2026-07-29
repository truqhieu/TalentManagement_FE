import { TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useLearningOpsSummary } from '@/features/dashboard/hooks'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoHint } from '@/components/shared/InfoHint'
import { Button } from '@/components/ui/button'

export type ManagerHrSnapshotCardsProps = {
  reportYear: number
  rangeStartMonth: number
  rangeEndMonth: number
}

const HR_HINT =
  'Tổng: toàn bộ hồ sơ nhân sự, mọi trạng thái (khớp "Tổng nhân sự" ở trang Danh sách nhân sự). Đang hoạt động: đúng trạng thái ACTIVE, không tính đã nghỉ / thử việc / bảo lưu / điều chuyển. Off: theo ngày nghỉ trong dữ liệu đồng bộ; thiếu ngày thì ước lượng theo lần cập nhật gần nhất. Mới: ngày vào làm (startDateWork) nằm trong kỳ đã chọn.'

function pct(part: number, total: number): string {
  if (!total) return '—'
  return `${((part / total) * 100).toFixed(1)}%`
}

export function ManagerHrSnapshotCards({
  reportYear,
  rangeStartMonth,
  rangeEndMonth,
}: ManagerHrSnapshotCardsProps) {
  const { data, isLoading, isError, refetch, isFetching } = useLearningOpsSummary(
    reportYear,
    rangeStartMonth,
    rangeEndMonth,
    { enabled: true }
  )

  const inSingleMonth = rangeStartMonth === rangeEndMonth
  const periodSuffix = inSingleMonth ? 'trong tháng' : 'trong kỳ'
  const total = data?.totalHeadcount ?? 0
  const active = data?.activeHeadcount ?? 0
  const off = data?.offboardedInPeriod ?? 0
  const newHires = data?.newHiresInPeriod ?? 0

  return (
    <div className="space-y-3">
      {isError ? (
        <div
          className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Không tải được thống kê nhân sự.{' '}
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

      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-[var(--shadow-game-float)] sm:p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-600/15 text-indigo-700 dark:text-indigo-300">
            <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="min-w-0 flex-1 text-sm font-bold tracking-tight text-foreground">
            Nhân sự
          </h3>
          <InfoHint
            text={HR_HINT}
            label="Cách tính nhân sự Tổng / Đang hoạt động / Off / Mới"
            className="self-start"
          />
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Tổng nhân sự */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-600/5 p-3 ring-1 ring-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-indigo-500/40 sm:p-4">
              <div
                className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-indigo-500/8 blur-xl"
                aria-hidden
              />
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400">
                Tổng nhân sự
              </p>
              <p
                className={cn(
                  'font-black tabular-nums text-foreground',
                  total >= 1000 ? 'text-2xl' : 'text-3xl'
                )}
              >
                {total.toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">toàn bộ hồ sơ nhân sự</p>
            </div>

            {/* Đang hoạt động */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-sky-500/10 to-cyan-600/5 p-3 ring-1 ring-sky-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-sky-500/40 sm:p-4">
              <div
                className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-sky-500/8 blur-xl"
                aria-hidden
              />
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-sky-600/80 dark:text-sky-400">
                Đang hoạt động
              </p>
              <p
                className={cn(
                  'font-black tabular-nums text-foreground',
                  active >= 1000 ? 'text-2xl' : 'text-3xl'
                )}
              >
                {active.toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs font-medium text-sky-600/70 dark:text-sky-400">
                {pct(active, total)} tổng
              </p>
            </div>

            {/* Off */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-500/10 to-red-600/5 p-3 ring-1 ring-rose-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-rose-500/40 sm:p-4">
              <div
                className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-rose-500/8 blur-xl"
                aria-hidden
              />
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600/80 dark:text-rose-400">
                  Nghỉ việc {periodSuffix}
                </p>
                <TrendingDown className="h-3.5 w-3.5 text-rose-500/70" aria-hidden />
              </div>
              <p className="text-3xl font-black tabular-nums text-foreground">
                {off.toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs font-medium text-rose-600/70 dark:text-rose-400">
                {pct(off, active)} đang hoạt động
              </p>
            </div>

            {/* Mới */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/5 p-3 ring-1 ring-emerald-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-500/40 sm:p-4">
              <div
                className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-emerald-500/8 blur-xl"
                aria-hidden
              />
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400">
                  Tuyển mới {periodSuffix}
                </p>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500/70" aria-hidden />
              </div>
              <p className="text-3xl font-black tabular-nums text-foreground">
                {newHires.toLocaleString('vi-VN')}
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-600/70 dark:text-emerald-400">
                {pct(newHires, active)} đang hoạt động
              </p>
            </div>
          </div>
        )}

        {isFetching && data ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Đang cập nhật…</p>
        ) : null}
      </div>
    </div>
  )
}
