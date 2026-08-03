import { CheckCircle2, Clock, Loader2 } from 'lucide-react'
import type { MeetingBooking } from './api'
import { isRescheduleRequest } from './roomBookingStatus'
import { formatDateVi, formatTimeRangeVi, padTime } from './roomBookingTimeUtils'

type PendingProps = {
  items: MeetingBooking[]
  processingId: string | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isLoading?: boolean
}

export function RoomBookingPendingPanel({
  items,
  processingId,
  onApprove,
  onReject,
}: PendingProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-bold text-foreground">Yêu cầu chờ duyệt</h3>
        <p className="mt-2 text-xs text-muted-foreground">Không có yêu cầu nào.</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-3 text-sm font-bold text-foreground">Yêu cầu chờ duyệt ({items.length})</h3>
      <div className="space-y-3">
        {items.slice(0, 5).map((b) => (
          <div key={b.id} className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
            <span
              className={`mb-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isRescheduleRequest(b)
                  ? 'border border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border border-amber-200 bg-amber-100 text-amber-800'
              }`}
            >
              {isRescheduleRequest(b) ? 'Đổi lịch' : 'Đặt mới'}
            </span>
            <p className="text-sm font-semibold text-foreground line-clamp-2">{b.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {b.userName} · {formatDateVi(b.date)} · {padTime(b.timeFrom).replace(/:/g, 'h')}–
              {padTime(b.timeTo).replace(/:/g, 'h')}
            </p>
            <p className="text-xs text-muted-foreground">{b.room}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!!processingId}
                onClick={() => onReject(b.id)}
                className="flex-1 rounded-lg border border-rose-200 bg-white py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Từ chối
              </button>
              <button
                type="button"
                disabled={!!processingId}
                onClick={() => onApprove(b.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {processingId === b.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Duyệt
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type RecentProps = {
  items: MeetingBooking[]
  onItemClick: (booking: MeetingBooking) => void
  isLoading?: boolean
}

export function RoomBookingRecentPanel({ items, onItemClick }: RecentProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <h3 className="mb-3 text-sm font-bold text-foreground">Gần đây</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có hoạt động.</p>
      ) : (
        <div className="space-y-1">
          {items.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onItemClick(b)}
              className="flex w-full gap-2 border-b border-border/40 pb-3 pt-1 text-left last:border-0 last:pb-0 transition-colors hover:bg-muted/40 rounded-lg px-1 -mx-1"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{b.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeRangeVi(b.timeFrom, b.timeTo)} · {b.userName} · {b.room}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
