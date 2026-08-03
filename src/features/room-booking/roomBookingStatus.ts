import type { MeetingBooking } from './api'
import { padTime } from './roomBookingTimeUtils'

/** ponytail: heuristic updatedAt vs createdAt — BE flag would be cleaner */
export function isRescheduleRequest(b: MeetingBooking): boolean {
  return (
    b.status === 'pending' &&
    !!b.updatedAt &&
    new Date(b.updatedAt).getTime() > new Date(b.createdAt).getTime() + 5000
  )
}

export type BookingDisplayStatus = {
  text: string
  className: string
  pulse?: boolean
}

export function resolveTimeStatus(
  b: MeetingBooking,
  vnTime: { date: string; time: string }
): MeetingBooking['timeStatus'] {
  if (b.timeStatus) return b.timeStatus
  const ct = padTime(vnTime.time)
  const from = padTime(b.timeFrom)
  const to = padTime(b.timeTo)
  if (b.date > vnTime.date) return 'upcoming'
  if (b.date < vnTime.date) return 'done'
  if (from <= ct && to > ct) return 'ongoing'
  if (from > ct) return 'upcoming'
  return 'done'
}

/** Trạng thái hiển thị (ưu tiên đang họp / đã xong theo thời gian thực). */
export function getBookingDisplayStatus(
  b: MeetingBooking,
  vnTime: { date: string; time: string }
): BookingDisplayStatus {
  const { date: td, time: ct } = vnTime
  const isPast = b.date < td || (b.date === td && padTime(b.timeTo) <= padTime(ct))
  const timeStatus = resolveTimeStatus(b, vnTime)

  if (b.status === 'approved' && timeStatus === 'ongoing') {
    return {
      text: 'Đang họp',
      className: 'bg-emerald-500 text-white border-emerald-600',
      pulse: true,
    }
  }

  if (b.status === 'approved' && (isPast || timeStatus === 'done')) {
    return {
      text: 'Đã họp xong',
      className: 'bg-stone-200 text-stone-700 border-stone-400',
    }
  }

  if (b.status === 'pending' && (isPast || timeStatus === 'done')) {
    return {
      text: 'Đã họp xong',
      className: 'bg-stone-200 text-stone-700 border-stone-400',
    }
  }

  if (b.status === 'approved') {
    return { text: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }

  if (b.status === 'rejected') {
    return {
      text: b.isOverridden ? 'Bị ghi đè' : 'Từ chối',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  }

  return { text: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border-amber-200' }
}
