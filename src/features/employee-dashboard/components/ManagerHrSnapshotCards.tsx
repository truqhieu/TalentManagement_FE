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
    <div className="space-y-2">
      {isError ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
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

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </div>
          <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-foreground">
            Nhân sự
          </h3>
          <InfoHint
            text={HR_HINT}
            label="Cách tính nhân sự Tổng / Đang hoạt động / Off / Mới"
            className="self-start"
          />
          {isFetching && data ? (
            <span className="text-xs text-muted-foreground">Đang cập nhật…</span>
          ) : null}
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tổng nhân sự
              </p>
              <p
                className={cn(
                  'mt-1 font-bold tabular-nums text-foreground',
                  total >= 1000 ? 'text-xl' : 'text-2xl'
                )}
              >
                {total.toLocaleString('vi-VN')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">toàn bộ hồ sơ</p>
            </div>

            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700/80 dark:text-sky-400">
                Đang hoạt động
              </p>
              <p
                className={cn(
                  'mt-1 font-bold tabular-nums text-foreground',
                  active >= 1000 ? 'text-xl' : 'text-2xl'
                )}
              >
                {active.toLocaleString('vi-VN')}
              </p>
              <p className="mt-0.5 text-xs font-medium text-sky-600/80 dark:text-sky-400">
                {pct(active, total)} tổng
              </p>
            </div>

            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700/80 dark:text-rose-400">
                  Nghỉ việc {periodSuffix}
                </p>
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-rose-500/70" aria-hidden />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {off.toLocaleString('vi-VN')}
              </p>
              <p className="mt-0.5 text-xs font-medium text-rose-600/80 dark:text-rose-400">
                {pct(off, active)} đang hoạt động
              </p>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400">
                  Tuyển mới {periodSuffix}
                </p>
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500/70" aria-hidden />
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {newHires.toLocaleString('vi-VN')}
              </p>
              <p className="mt-0.5 text-xs font-medium text-emerald-600/80 dark:text-emerald-400">
                {pct(newHires, active)} đang hoạt động
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
