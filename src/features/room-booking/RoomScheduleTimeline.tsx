import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Clock, LayoutGrid } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MeetingBooking } from './api'
import {
  HOUR_COL_PX,
  MEETING_ROOMS,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  type TimelineViewMode,
} from './roomBookingConstants'
import { RoomBookingTimelineBlock } from './RoomBookingTimelineBlock'
import { RoomBookingTimelineMarker } from './RoomBookingTimelineMarker'
import { blockLayoutInWindow } from './roomBookingTimelineUtils'
import {
  hourSlotEnd,
  hourSlotStart,
  padTime,
  timeToMinutes,
  timeToPercent,
  timeToPercentInWindow,
} from './roomBookingTimeUtils'
import { useTimelineDragPan } from './useTimelineDragPan'

const ROW_LABEL_W = 100
const ROW_HEIGHT = 100

type Props = {
  viewDate: string
  bookings: MeetingBooking[]
  vnTime: { date: string; time: string }
  onEmptySlotClick: (room: string, timeFrom: string, timeTo: string) => void
  onBookingClick: (booking: MeetingBooking) => void
}

function bookingOverlapsTimeline(b: MeetingBooking): boolean {
  const from = timeToMinutes(b.timeFrom)
  const to = timeToMinutes(b.timeTo)
  const start = TIMELINE_START_HOUR * 60
  const end = TIMELINE_END_HOUR * 60
  return to > start && from < end
}

function currentHourFromVnTime(vnTime: { date: string; time: string }): number {
  return Math.floor(timeToMinutes(vnTime.time) / 60)
}

export function RoomScheduleTimeline({
  viewDate,
  bookings,
  vnTime,
  onEmptySlotClick,
  onBookingClick,
}: Props) {
  const isToday = viewDate === vnTime.date
  const [viewMode, setViewMode] = useState<TimelineViewMode>(isToday ? 'live' : 'full')
  const [liveRevealPast, setLiveRevealPast] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViewMode(isToday ? 'live' : 'full')
  }, [isToday, viewDate])

  useEffect(() => {
    setLiveRevealPast(false)
  }, [viewDate, viewMode])

  const showNowLine = isToday
  const currentHour = currentHourFromVnTime(vnTime)

  const byRoom = useMemo(() => {
    const map = new Map<string, MeetingBooking[]>()
    for (const room of MEETING_ROOMS) {
      map.set(
        room.id,
        bookings.filter((b) => b.room === room.id && bookingOverlapsTimeline(b))
      )
    }
    return map
  }, [bookings])

  const spanHours = TIMELINE_END_HOUR - TIMELINE_START_HOUR
  const allHours = useMemo(
    () => Array.from({ length: spanHours }, (_, i) => TIMELINE_START_HOUR + i),
    [spanHours]
  )

  const useScrollLayout = viewMode === 'live' && isToday
  /** Giờ làm tròn xuống — mặc định live chỉ hiển thị từ đây đến hết ngày. */
  const liveStartHour = Math.min(Math.max(TIMELINE_START_HOUR, currentHour), TIMELINE_END_HOUR - 1)
  const gridStartHour = useScrollLayout && !liveRevealPast ? liveStartHour : TIMELINE_START_HOUR

  const displayHours = useMemo(
    () => allHours.filter((h) => h >= gridStartHour),
    [allHours, gridStartHour]
  )
  const displaySpanHours = displayHours.length

  const useFixedHourCols = useScrollLayout && liveRevealPast
  const trackMinWidth = useFixedHourCols ? displaySpanHours * HOUR_COL_PX : undefined
  const hourCols = useFixedHourCols
    ? `repeat(${displaySpanHours}, ${HOUR_COL_PX}px)`
    : `repeat(${displaySpanHours}, minmax(0, 1fr))`

  const revealPastHours = useCallback(() => setLiveRevealPast(true), [])

  useTimelineDragPan(
    scrollRef,
    useScrollLayout && liveRevealPast,
    useScrollLayout && !liveRevealPast ? revealPastHours : undefined
  )

  /** Sau khi mở giờ đã qua: cuộn tới giờ hiện tại. */
  useEffect(() => {
    if (!useScrollLayout || !liveRevealPast || !scrollRef.current) return
    const el = scrollRef.current
    const apply = () => {
      el.scrollLeft = (liveStartHour - TIMELINE_START_HOUR) * HOUR_COL_PX
    }
    apply()
    requestAnimationFrame(apply)
  }, [useScrollLayout, liveRevealPast, liveStartHour, viewDate, viewMode])

  const nowPercent = useMemo(() => {
    if (!showNowLine) return -1
    if (useScrollLayout && !liveRevealPast) {
      return timeToPercentInWindow(vnTime.time, gridStartHour)
    }
    return timeToPercent(vnTime.time)
  }, [showNowLine, useScrollLayout, liveRevealPast, vnTime.time, gridStartHour])

  function isPastHour(h: number): boolean {
    if (!isToday) return false
    return h < currentHour
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#006C49]" />
            <span className="text-sm font-semibold text-foreground">Lịch phòng</span>
          </div>
          <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
            <button
              type="button"
              disabled={!isToday}
              onClick={() => setViewMode('live')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ',
                viewMode === 'live'
                  ? 'bg-[#006C49] text-white'
                  : 'text-muted-foreground hover:bg-background',
                !isToday && 'cursor-not-allowed opacity-40'
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Theo giờ hiện tại
            </button>
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition',
                viewMode === 'full'
                  ? 'bg-[#006C49] text-white'
                  : 'text-muted-foreground hover:bg-background'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cả ngày
            </button>
          </div>
        </div>

        <div className="flex">
          <div
            className="flex shrink-0 flex-col border-r border-border/60 bg-muted/30"
            style={{ width: ROW_LABEL_W }}
          >
            <div className="flex items-end px-2 py-2" style={{ height: 36 }}>
              <span className="text-xs font-semibold text-muted-foreground">Phòng</span>
            </div>
            {MEETING_ROOMS.map((room) => (
              <div
                key={room.id}
                className="flex items-center border-t border-border/40 px-2"
                style={{ height: ROW_HEIGHT }}
              >
                <p className="text-sm font-bold text-foreground">{room.label}</p>
              </div>
            ))}
          </div>

          <div
            ref={scrollRef}
            className={cn(
              'min-w-0 flex-1',
              useScrollLayout &&
                'overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            )}
          >
            <div
              className={cn('relative', useFixedHourCols && 'shrink-0')}
              style={
                useScrollLayout
                  ? {
                      width: useFixedHourCols ? trackMinWidth : '100%',
                      minWidth: displaySpanHours * HOUR_COL_PX,
                    }
                  : { width: '100%' }
              }
            >
              <div
                className="grid gap-1 border-b border-border/60 px-1 py-1"
                style={{ gridTemplateColumns: hourCols }}
              >
                {displayHours.map((h, i) => (
                  <div
                    key={h}
                    className="flex items-center justify-between px-0.5 py-1.5 text-[10px] font-semibold text-muted-foreground"
                  >
                    <span className={cn(isPastHour(h) && useScrollLayout && 'opacity-40')}>
                      {String(h).padStart(2, '0')}:00
                    </span>
                    {i === displayHours.length - 1 ? (
                      <span className="text-muted-foreground/70">
                        {String(TIMELINE_END_HOUR).padStart(2, '0')}:00
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {MEETING_ROOMS.map((room) => {
                const roomBookings = byRoom.get(room.id) ?? []
                return (
                  <div
                    key={room.id}
                    className="relative overflow-visible border-t border-border/40 px-1"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="absolute inset-0 grid gap-1"
                      style={{ gridTemplateColumns: hourCols }}
                    >
                      {displayHours.map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={cn(
                            'h-full min-w-0 rounded-md border border-slate-100/90 hover:bg-primary/5',
                            isPastHour(h) && useScrollLayout
                              ? 'bg-slate-100/60 opacity-60'
                              : 'bg-slate-50/50'
                          )}
                          title={`Đặt phòng ${room.label} lúc ${hourSlotStart(h)}`}
                          onClick={() =>
                            onEmptySlotClick(room.id, hourSlotStart(h), hourSlotEnd(h))
                          }
                        />
                      ))}
                    </div>
                    {viewMode === 'full'
                      ? roomBookings.map((b) => (
                          <RoomBookingTimelineMarker
                            key={b.id}
                            booking={b}
                            vnTime={vnTime}
                            onClick={onBookingClick}
                          />
                        ))
                      : roomBookings.map((b) => {
                          const layoutWindow =
                            useScrollLayout && !liveRevealPast ? gridStartHour : null
                          return (
                            <RoomBookingTimelineBlock
                              key={b.id}
                              booking={b}
                              layout={blockLayoutInWindow(b.timeFrom, b.timeTo, layoutWindow)}
                              layoutWindowStartHour={layoutWindow}
                              vnTime={vnTime}
                              onClick={onBookingClick}
                            />
                          )
                        })}
                  </div>
                )
              })}

              {showNowLine && nowPercent >= 0 && nowPercent <= 100 && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-rose-500"
                  style={{
                    left:
                      useFixedHourCols && trackMinWidth != null
                        ? `${(trackMinWidth * nowPercent) / 100}px`
                        : `${nowPercent}%`,
                  }}
                >
                  <span className="absolute -left-4 -top-5 whitespace-nowrap rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {padTime(vnTime.time).replace(/:/g, 'h')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {!useScrollLayout && (
          <p className="border-t border-border/50 px-4 py-3 text-center text-xs text-muted-foreground">
            {viewMode === 'full'
              ? 'Biểu tượng lịch = đã có người đặt · Nhấp để xem chi tiết'
              : 'Nhấp vào khung giờ trống để đặt phòng nhanh chóng'}
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}
