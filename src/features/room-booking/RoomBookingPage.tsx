import { CustomSelect } from '@/components/shared/CustomSelect'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { getVnNow, useVnTime } from '@/hooks/useVnTime'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RoomBookingDetailModal } from './RoomBookingDetailModal'
import { RoomBookingMinutesTable } from './RoomBookingMinutesTable'
import { RoomBookingPendingPanel, RoomBookingRecentPanel } from './RoomBookingSidebar'
import { RoomScheduleTimeline } from './RoomScheduleTimeline'
import {
  approveBooking,
  createBooking,
  deleteBooking,
  finishBooking,
  getAvailability,
  getBookings,
  rejectBooking,
  updateBooking,
  uploadMeetingDocument,
  type BookedSlot,
  type MeetingBooking,
} from './api'
import {
  LEGEND_ITEMS,
  MEETING_ROOMS,
  STATUS_FILTER_OPTIONS,
  type StatusFilter,
} from './roomBookingConstants'
import { isRescheduleRequest } from './roomBookingStatus'
import { formatDateLongVi, formatDateVi } from './roomBookingTimeUtils'

// Chị Google nói
function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = 'vi-VN'
  msg.rate = 0.9
  window.speechSynthesis.speak(msg)
}

function showNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

function BookingStatusBadge({
  b,
  vnTime,
}: {
  b: MeetingBooking
  vnTime: { date: string; time: string }
}) {
  const { date: td, time: ct } = vnTime
  const isPast = b.date < td || (b.date === td && b.timeTo <= ct)

  if (b.status === 'approved' && b.timeStatus === 'ongoing')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-indigo-700 animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
        Đang họp
      </span>
    )

  if (b.status === 'approved' && (isPast || b.timeStatus === 'done'))
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-tight text-blue-700">
        ✓ Đã họp xong
      </span>
    )

  if (b.status === 'pending' && (isPast || b.timeStatus === 'done'))
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-tight text-blue-700">
        ✓ Đã họp xong
      </span>
    )

  const map = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const label = {
    approved: 'Đã duyệt',
    rejected: b.isOverridden ? 'Bị ghi đè' : 'Từ chối',
    pending: 'Chờ duyệt',
  }
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-tight border ${map[b.status]}`}
      >
        {label[b.status]}
      </span>
      {isRescheduleRequest(b) && (
        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold uppercase text-indigo-700">
          Yêu cầu đổi lịch
        </span>
      )}
    </div>
  )
}

type BookingRowActionsProps = {
  b: MeetingBooking
  user: ReturnType<typeof useAuthStore.getState>['user']
  isPrivileged: boolean
  processingId: string | null
  handleApprove: (id: string) => void
  handleRejectId: (id: string) => void
  handleEdit: (b: MeetingBooking) => void
  handleDelete: (id: string) => void
  handleFinish: (id: string) => void
  variant?: 'table' | 'mobile'
  vnTime: { date: string; time: string }
}

function BookingRowActions({
  b,
  user,
  isPrivileged,
  processingId,
  handleApprove,
  handleRejectId,
  handleEdit,
  handleDelete,
  handleFinish,
  variant = 'table',
  vnTime,
}: BookingRowActionsProps) {
  const mobile = variant === 'mobile'
  const btnWrap = mobile ? 'w-full justify-center' : ''
  const isOwner = b.userId === user?.id

  // 1. TÍNH TOÁN TRẠNG THÁI QUÁ HẠN (GIỐNG BADGE)
  const { date: td, time: ct } = vnTime
  const isPast = b.date < td || (b.date === td && b.timeTo <= ct)
  const isOverdueOrDone = isPast || b.timeStatus === 'done'

  // QUÁ HẠN THÌ TUYỆT ĐỐI KHÔNG HIỂN THỊ NÚT NÀO
  if (isOverdueOrDone) {
    return null
  }

  return (
    <div className={mobile ? 'flex w-full flex-col gap-2' : 'flex items-center justify-end gap-2'}>
      {/* NÚT ĐÃ HỌP XONG: Chỉ hiện khi ĐANG HỌP và là lịch ĐÃ DUYỆT */}
      {b.status === 'approved' && b.timeStatus === 'ongoing' && (isOwner || isPrivileged) && (
        <button
          type="button"
          onClick={() => handleFinish(b.id)}
          disabled={!!processingId}
          className={`flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 ${btnWrap}`}
        >
          {processingId === b.id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          <span>ĐÃ HỌP XONG</span>
        </button>
      )}

      {/* NÚT DUYỆT/TỪ CHỐI DÀNH CHO ADMIN: Chỉ hiện khi CHỜ DUYỆT và CHƯA HỌP */}
      {isPrivileged && b.status === 'pending' && b.timeStatus !== 'ongoing' && (
        <>
          <button
            type="button"
            onClick={() => handleApprove(b.id)}
            disabled={!!processingId}
            className={`group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:shadow-emerald-500/40 active:scale-95 disabled:opacity-50 ${btnWrap}`}
          >
            {processingId === b.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            <span>DUYỆT</span>
          </button>
          <button
            type="button"
            onClick={() => handleRejectId(b.id)}
            disabled={!!processingId}
            className={`group flex items-center gap-2 rounded-xl border-2 border-rose-100 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition-all hover:border-rose-200 hover:bg-rose-50 active:scale-95 disabled:opacity-50 ${btnWrap}`}
          >
            <X className="h-3 w-3" />
            <span>TỪ CHỐI</span>
          </button>
        </>
      )}
      {b.userId === user?.id && (
        <div className={mobile ? 'flex w-full flex-col gap-2' : 'flex gap-2'}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(b)
            }}
            disabled={!!processingId}
            className={`flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-white active:scale-95 disabled:opacity-50 ${btnWrap}`}
          >
            <span>SỬA LỊCH HỌP</span>
          </button>
          <button
            type="button"
            onClick={() => handleDelete(b.id)}
            disabled={!!processingId}
            className={`flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 transition-all hover:bg-rose-600 hover:text-white active:scale-95 disabled:opacity-50 ${btnWrap}`}
          >
            {processingId === b.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
            <span>HỦY</span>
          </button>
        </div>
      )}
    </div>
  )
}

const BookingCardMobile = memo(
  ({
    b,
    user,
    isPrivileged,
    processingId,
    handleApprove,
    handleRejectId,
    handleEdit,
    handleDelete,
    handleFinish,
    vnTime,
  }: {
    b: MeetingBooking
    user: ReturnType<typeof useAuthStore.getState>['user']
    isPrivileged: boolean
    processingId: string | null
    handleApprove: (id: string) => void
    handleRejectId: (id: string) => void
    handleEdit: (b: MeetingBooking) => void
    handleDelete: (id: string) => void
    handleFinish: (id: string) => void
    variant?: 'table' | 'mobile'
    vnTime: { date: string; time: string }
  }) => {
    return (
      <div className="space-y-3 border-b border-border/50 p-4 last:border-b-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Phòng
          </p>
          <p className="font-black text-foreground">{b.room}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Người đặt / Team
          </p>
          <span className="text-xs font-semibold uppercase text-foreground">{b.userName}</span>
          <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{b.team}</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ngày
            </p>
            <p className="text-sm text-muted-foreground">{b.date}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Giờ
            </p>
            <p className="text-sm font-bold text-primary">
              {b.timeFrom} – {b.timeTo}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lý do
          </p>
          <p className="break-words text-sm">{b.reason}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trạng thái
          </p>
          <BookingStatusBadge b={b} vnTime={vnTime} />
        </div>
        <BookingRowActions
          b={b}
          user={user}
          isPrivileged={isPrivileged}
          processingId={processingId}
          handleApprove={handleApprove}
          handleRejectId={handleRejectId}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleFinish={handleFinish}
          variant="mobile"
          vnTime={vnTime}
        />
      </div>
    )
  }
)

const BookingRow = memo(
  ({
    b,
    user,
    isPrivileged,
    processingId,
    handleApprove,
    handleRejectId,
    handleEdit,
    handleDelete,
    handleFinish,
    vnTime,
  }: {
    b: MeetingBooking
    user: ReturnType<typeof useAuthStore.getState>['user']
    isPrivileged: boolean
    processingId: string | null
    handleApprove: (id: string) => void
    handleRejectId: (id: string) => void
    handleEdit: (b: MeetingBooking) => void
    handleDelete: (id: string) => void
    handleFinish: (id: string) => void
    variant?: 'table' | 'mobile'
    vnTime: { date: string; time: string }
  }) => {
    return (
      <tr className="group hover:bg-primary/[0.02]">
        <td className="px-6 py-5 font-black">{b.room}</td>
        <td className="px-6 py-5">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase">{b.userName}</span>
            <span className="text-xs font-medium text-muted-foreground">{b.team}</span>
          </div>
        </td>
        <td className="px-6 py-5 text-muted-foreground">{b.date}</td>
        <td className="px-6 py-5 font-bold text-primary">
          {b.timeFrom} – {b.timeTo}
        </td>
        <td className="max-w-[200px] truncate px-6 py-5">{b.reason}</td>
        <td className="whitespace-nowrap px-6 py-4">
          <BookingStatusBadge b={b} vnTime={vnTime} />
        </td>
        <td className="px-6 py-5 text-right">
          <BookingRowActions
            b={b}
            user={user}
            isPrivileged={isPrivileged}
            processingId={processingId}
            handleApprove={handleApprove}
            handleRejectId={handleRejectId}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            handleFinish={handleFinish}
            variant="table"
            vnTime={vnTime}
          />
        </td>
      </tr>
    )
  }
)

export default function RoomBookingPage() {
  const queryClient = useQueryClient()
  const vnTime = useVnTime()
  const user = useAuthStore((s) => s.user)
  const isPrivileged = user?.role === 'HR' || user?.role === 'MANAGER' || user?.role === 'BOD'

  const isRoomAccount = useMemo(() => {
    if (!user) return false
    const emailLower = (user.email || '').trim().toLowerCase()
    const parts = emailLower.split('@')
    if (parts.length === 2 && parts[1] === 'gmail.com') {
      const p0 = parts[0]
      if (p0) {
        parts[0] = p0.replace(/\./g, '')
      }
    }
    const emailClean = parts.join('@')
    return emailClean === 'vienchibaodev@gmail.com' || emailClean === 'vienibaodev@gmail.com'
  }, [user])

  const [monitoredRoom, setMonitoredRoom] = useState(() => {
    const saved = localStorage.getItem('vcb_selected_room')
    if (saved) return saved
    if (user) {
      const emailLower = (user.email || '').trim().toLowerCase()
      const parts = emailLower.split('@')
      if (parts.length === 2 && parts[1] === 'gmail.com') {
        const p0 = parts[0]
        if (p0) {
          parts[0] = p0.replace(/\./g, '')
        }
      }
      const emailClean = parts.join('@')
      if (emailClean === 'vienchibaodev@gmail.com') return 'Tầng 6'
    }
    return 'Tầng 5'
  })

  const [showModal, setShowModal] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [room, setRoom] = useState('Tầng 5')
  const [date, setDate] = useState(() => getVnNow().date)
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<{ url: string; name: string }[]>([])
  const [uploadQueue, setUploadQueue] = useState<
    { id: string; name: string; status: 'uploading' | 'success' | 'error'; error?: string }[]
  >([])
  const isUploadingDoc = uploadQueue.some((item) => item.status === 'uploading')
  const [docUploadError, setDocUploadError] = useState<string | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const [viewDate, setViewDate] = useState(() => getVnNow().date)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [finishConfirmId, setFinishConfirmId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [detailBooking, setDetailBooking] = useState<MeetingBooking | null>(null)

  const prevBookingsCount = useRef(0)

  // Query Data
  const { data: bookings = [], isLoading: isFetching } = useQuery({
    queryKey: ['room-bookings'],
    queryFn: getBookings,
    staleTime: 30_000,
    refetchInterval: () => (document.visibilityState === 'visible' ? 30_000 : false),
    meta: {
      onSuccess: (data: MeetingBooking[]) => {
        if (data.length > prevBookingsCount.current && prevBookingsCount.current > 0) {
          showNotification('Lịch họp mới', `Có yêu cầu đặt phòng mới vừa được cập nhật.`)
        }
        prevBookingsCount.current = data.length
      },
    },
  })

  // Mutations
  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
      setShowModal(false)
      resetForm()
      const msg = isEmergency
        ? 'Đặt phòng khẩn cấp thành công'
        : 'Đặt phòng thành công, vui lòng chờ duyệt'
      setSuccess(msg)
      speak(msg)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; payload: any }) => updateBooking(vars.id, vars.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
      setShowModal(false)
      resetForm()
      setSuccess('Cập nhật lịch họp thành công')
      speak('Đã cập nhật lịch họp')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteBooking,
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
      speak('Đã hủy lịch họp')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    },
    onSettled: () => setProcessingId(null),
  })

  const approveMut = useMutation({
    mutationFn: approveBooking,
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
      speak('Đã duyệt lịch họp thành công')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    },
    onSettled: () => setProcessingId(null),
  })

  const rejectMut = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => rejectBooking(vars.id, vars.reason),
    onMutate: (vars) => setProcessingId(vars.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
      setRejectId(null)
      speak('Đã từ chối lịch họp')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    },
    onSettled: () => setProcessingId(null),
  })

  const finishMut = useMutation({
    mutationFn: finishBooking,
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi hệ thống'
      setError(msg)
    },
    onSettled: () => setProcessingId(null),
  })

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!showModal || !room || !date) return
    getAvailability(room, date)
      .then((r) => setBookedSlots(r.bookedSlots))
      .catch(() => setBookedSlots([]))
  }, [showModal, room, date])

  useEffect(() => {
    if (!showModal) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showModal])

  // Real-time updates via SSE
  useEffect(() => {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    const baseUrl = import.meta.env.VITE_API_URL || ''
    const url = `${baseUrl.replace(/\/$/, '')}/room-booking/live?token=${token}`
    let eventSource: EventSource | null = null

    try {
      eventSource = new EventSource(url)
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.event === 'changed') {
            queryClient.invalidateQueries({ queryKey: ['room-bookings'] })
          }
        } catch (e) {
          console.error('SSE parse error:', e)
        }
      }
      eventSource.onerror = (e) => {
        console.error('SSE error:', e)
      }
    } catch (err) {
      console.error('Failed to init SSE on RoomBookingPage:', err)
    }

    return () => {
      eventSource?.close()
    }
  }, [queryClient])

  const dayBookings = useMemo(() => {
    let result = bookings.filter((b) => b.date === viewDate && b.status !== 'rejected')
    if (statusFilter === 'ongoing') {
      result = result.filter((b) => b.status === 'approved' && b.timeStatus === 'ongoing')
    } else if (statusFilter === 'approved') {
      result = result.filter((b) => b.status === 'approved')
    } else if (statusFilter === 'pending') {
      result = result.filter((b) => b.status === 'pending')
    }
    return result.sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))
  }, [bookings, viewDate, statusFilter])

  const stats = useMemo(() => {
    const day = bookings.filter((b) => b.date === viewDate && b.status !== 'rejected')
    const ongoing = day.filter((b) => b.status === 'approved' && b.timeStatus === 'ongoing')
    const pending = day.filter((b) => b.status === 'pending')
    const busyRooms = new Set(ongoing.map((b) => b.room)).size
    return {
      total: MEETING_ROOMS.length,
      ongoing: ongoing.length,
      pending: pending.length,
      available: Math.max(0, MEETING_ROOMS.length - busyRooms),
    }
  }, [bookings, viewDate])

  const pendingRequests = useMemo(() => {
    const { date: td, time: ct } = vnTime
    return bookings
      .filter((b) => {
        if (b.status !== 'pending') return false
        const isPast = b.date < td || (b.date === td && b.timeTo <= ct)
        return !isPast
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeFrom.localeCompare(b.timeFrom))
  }, [bookings, vnTime])

  const recentItems = useMemo(
    () =>
      [...bookings]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8),
    [bookings]
  )

  const isTodayView = viewDate === vnTime.date
  const dateLabel = isTodayView ? `Hôm nay, ${formatDateVi(viewDate)}` : formatDateLongVi(viewDate)

  function resetForm() {
    setEditingId(null)
    setRoom('Tầng 5')
    setDate(getVnNow().date)
    setTimeFrom('')
    setTimeTo('')
    setReason('')
    setNote('')
    setIsEmergency(false)
    setUploadedDocuments([])
    setUploadQueue([])
    setDocUploadError(null)
    setError('')
    setLinkUrl('')
    setLinkLabel('')
    setLinkError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validate Frontend
    if (!reason.trim()) {
      const m = 'Vui lòng nhập lý do đặt phòng'
      setError(m)
      speak(m)
      return
    }
    if (timeFrom >= timeTo) {
      const m = 'Giờ kết thúc phải sau giờ bắt đầu'
      setError(m)
      speak(m)
      return
    }
    const { date: vnDate, time: vnTimeStr } = vnTime
    if (date < vnDate) {
      const m = 'Không thể đặt lịch trong quá khứ'
      setError(m)
      speak(m)
      return
    }
    if (date === vnDate && timeFrom < vnTimeStr) {
      const m = 'Thời gian bắt đầu không thể ở quá khứ'
      setError(m)
      speak(m)
      return
    }

    if (isUploadingDoc) {
      setError('Vui lòng đợi tệp tin đang được tải lên...')
      return
    }

    try {
      const payload = {
        room,
        date,
        timeFrom,
        timeTo,
        reason,
        note,
        isEmergency,
        documents: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
      }

      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, payload })
      } else {
        await createMut.mutateAsync(payload)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi lưu lịch họp'
      setError(msg)
      speak(`Lỗi: ${msg}`)
    }
  }

  async function handleApprove(id: string) {
    approveMut.mutate(id)
  }

  async function handleReject() {
    if (!rejectId || !rejectReason.trim()) {
      alert('Vui lòng nhập lý do')
      return
    }
    rejectMut.mutate({ id: rejectId, reason: rejectReason })
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(id)
  }

  async function executeDelete() {
    if (!deleteConfirmId) return
    deleteMut.mutate(deleteConfirmId)
    setDeleteConfirmId(null)
  }

  async function handleFinish(id: string) {
    setFinishConfirmId(id)
  }

  async function executeFinish() {
    if (!finishConfirmId) return
    finishMut.mutate(finishConfirmId)
    setFinishConfirmId(null)
  }

  function handleEdit(b: MeetingBooking) {
    setDetailBooking(null)
    setEditingId(b.id)
    setRoom(b.room)
    setDate(b.date)
    setTimeFrom(b.timeFrom)
    setTimeTo(b.timeTo)
    setReason(b.reason)
    setNote(b.note || '')
    setIsEmergency(b.isEmergency)
    setUploadedDocuments(b.documents || [])
    setUploadQueue([])
    setDocUploadError(null)
    setTimeout(() => {
      setShowModal(true)
    }, 0)
  }

  function canManageBooking(b: MeetingBooking): boolean {
    if (b.userId !== user?.id) return false
    if (b.status === 'rejected') return false
    const { date: td, time: ct } = vnTime
    const isPast = b.date < td || (b.date === td && b.timeTo <= ct)
    return !isPast && b.timeStatus !== 'done'
  }

  function openEmptySlot(roomId: string, timeFrom: string, timeTo: string) {
    resetForm()
    setRoom(roomId)
    setDate(viewDate < vnTime.date ? vnTime.date : viewDate)
    setTimeFrom(timeFrom)
    setTimeTo(timeTo)
    setShowModal(true)
  }

  return (
    <div className="animate-page-entrance bg-background pb-4">
      <div className="">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-8 rounded-full bg-primary" />
              <span className="text-xs font-bold uppercase tracking-wide text-primary">
                VCB Booking
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Phòng họp
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Lịch đặt và quản lý tài nguyên phòng họp tại Lumina.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(createMut.isPending || updateMut.isPending || isFetching) && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-2 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">Đang cập nhật...</span>
              </div>
            )}
            {isRoomAccount && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 border border-border">
                <span className="text-xs font-black uppercase text-muted-foreground whitespace-nowrap">
                  Giám sát:
                </span>
                <CustomSelect
                  value={monitoredRoom}
                  onValueChange={(val) => {
                    setMonitoredRoom(val)
                    localStorage.setItem('vcb_selected_room', val)
                  }}
                  options={MEETING_ROOMS.map((r) => ({
                    label: r.label,
                    value: r.id,
                  }))}
                />
              </div>
            )}
            <button
              onClick={() => speak('Hệ thống đặt phòng Lumina xin chào bạn')}
              className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition shadow-sm"
            >
              <Volume2 className="h-5 w-5 text-[#006C49]" />
            </button>
            <Button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-8 py-4 text-sm font-bold cursor-pointer"
            >
              <Plus className="h-5 w-5" /> Đặt phòng ngay
            </Button>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-700">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold text-primary">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Tổng phòng</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">{stats.ongoing}</p>
                <p className="text-xs text-muted-foreground">Đang họp</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Chờ duyệt</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.available}</p>
                <p className="text-xs text-muted-foreground">Còn trống</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DatePicker
                  value={viewDate}
                  onChange={setViewDate}
                  displayLabel={dateLabel}
                  className="h-9 w-auto min-w-[200px] justify-start rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold shadow-none hover:border-primary/40 hover:bg-muted/50 active:scale-100"
                />
                {!isTodayView && (
                  <button
                    type="button"
                    onClick={() => setViewDate(vnTime.date)}
                    className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                  >
                    Hôm nay
                  </button>
                )}
                <CustomSelect
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  options={STATUS_FILTER_OPTIONS.map((o) => ({
                    label: o.label,
                    value: o.value,
                  }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {LEGEND_ITEMS.map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            {isFetching && bookings.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <RoomScheduleTimeline
                viewDate={viewDate}
                bookings={dayBookings}
                vnTime={vnTime}
                onEmptySlotClick={openEmptySlot}
                onBookingClick={setDetailBooking}
              />
            )}
            <RoomBookingMinutesTable
              items={bookings}
              vnTime={vnTime}
              currentUserId={user?.id}
              showAllUsers={isPrivileged}
              isLoading={isFetching && bookings.length === 0}
            />
          </div>
          <aside className="space-y-4 min-w-0 xl:sticky xl:top-4 xl:self-start">
            {isPrivileged && (
              <RoomBookingPendingPanel
                items={pendingRequests}
                processingId={processingId}
                onApprove={handleApprove}
                onReject={setRejectId}
                isLoading={isFetching && bookings.length === 0}
              />
            )}
            <RoomBookingRecentPanel
              items={recentItems}
              onItemClick={setDetailBooking}
              isLoading={isFetching && bookings.length === 0}
            />
          </aside>
        </div>
      </div>

      {detailBooking &&
        createPortal(
          <RoomBookingDetailModal
            booking={detailBooking}
            vnTime={vnTime}
            onClose={() => setDetailBooking(null)}
            onEdit={handleEdit}
            onDelete={(id) => {
              setDetailBooking(null)
              handleDelete(id)
            }}
            canManage={detailBooking ? canManageBooking(detailBooking) : false}
            currentUserId={user?.id}
          />,
          document.body
        )}

      {/* Form Đặt phòng — portal + căn giữa viewport, cuộn khi form dài */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-booking-form-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
              aria-label="Đóng"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
            />
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <div
                className="relative z-10 my-auto w-full max-w-xl max-h-[min(90vh,720px)] overflow-y-auto rounded-[2.5rem] border border-white/10 bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 h-2 w-full bg-primary" />
                <div className="p-6 sm:p-8">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <h2
                      id="room-booking-form-title"
                      className="text-2xl font-black uppercase sm:text-3xl"
                    >
                      {editingId ? 'Sửa lịch họp' : 'Đặt phòng họp'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowModal(false)
                        resetForm()
                      }}
                      className="p-2 hover:bg-secondary rounded-xl"
                    >
                      <X />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <span className="text-sm leading-snug">{error}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase ml-1">Chọn phòng</label>
                        <CustomSelect
                          value={room}
                          onValueChange={(val) => setRoom(val)}
                          options={MEETING_ROOMS.map((r) => ({
                            label: r.label,
                            value: r.id,
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase ml-1 flex items-center gap-1">
                          Ngày
                        </label>
                        <DatePicker
                          value={date}
                          onChange={setDate}
                          min={vnTime.date}
                          className="h-14 rounded-2xl bg-muted/40 font-semibold text-center"
                        />
                      </div>
                    </div>
                    {/* Hiển thị khung giờ khả dụng */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase ml-1 flex items-center gap-2 text-primary">
                          <Clock className="h-4 w-4" />
                          Khung giờ trống còn lại
                        </label>
                        <span className="text-xs text-muted-foreground">Click để chọn nhanh</span>
                      </div>
                      <div className="flex flex-wrap gap-3 py-2 min-h-[40px]">
                        {(() => {
                          const { date: today, time: nowTime } = getVnNow()
                          let startSearch = '08:00'
                          if (date === today) {
                            startSearch = nowTime > '08:00' ? nowTime : '08:00'
                          }

                          // Hàm chuẩn hóa thời gian về dạng 2 chữ số (VD: 9:30 -> 09:30) để so sánh chuỗi
                          const padTime = (t: string) => {
                            if (!t) return '00:00'
                            const [h, m] = t.split(':')
                            return `${(h || '0').padStart(2, '0')}:${(m || '0').padStart(2, '0')}`
                          }

                          // Tạo danh sách các khoảng trống
                          const filteredSlots = editingId
                            ? bookedSlots.filter((s: any) => s.id !== editingId)
                            : bookedSlots

                          const sorted = [...filteredSlots]
                            .map((s) => ({
                              ...s,
                              timeFrom: padTime(s.timeFrom),
                              timeTo: padTime(s.timeTo),
                            }))
                            .sort((a, b) => a.timeFrom.localeCompare(b.timeFrom))

                          const gaps: string[] = []
                          let lastEnd = padTime(startSearch)

                          for (const slot of sorted) {
                            if (slot.timeFrom > lastEnd) {
                              gaps.push(`${lastEnd} – ${slot.timeFrom}`)
                            }
                            if (slot.timeTo > lastEnd) {
                              lastEnd = slot.timeTo
                            }
                          }
                          if (lastEnd < '22:00') {
                            gaps.push(`${lastEnd} – 22:00`)
                          }

                          if (gaps.length === 0)
                            return (
                              <div className="m-auto flex flex-col items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xs font-black text-muted-foreground uppercase">
                                  Hết lịch trống hôm nay
                                </span>
                              </div>
                            )

                          return gaps.map((g, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const parts = g.split(' – ')
                                const f = parts[0] || ''
                                const t = parts[1] || ''
                                setTimeFrom(f)
                                setTimeTo(t)
                              }}
                              className="px-5 py-3 bg-white border-2 border-primary/20 rounded-2xl text-sm font-black text-primary hover:bg-primary hover:text-white hover:border-primary transition-all shadow-md hover:shadow-primary/20 active:scale-95"
                            >
                              {g.replace(/:/g, 'h')}
                            </button>
                          ))
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase ml-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Từ
                        </label>
                        <div className="flex items-center justify-center w-full p-3.5 bg-muted/40 rounded-2xl border border-border focus-within:border-primary focus-within:bg-white transition-all shadow-sm">
                          <input
                            type="text"
                            placeholder="hh"
                            value={timeFrom ? timeFrom.split(':')[0] : ''}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (parseInt(v) > 23) v = '23'
                              const m = timeFrom ? timeFrom.split(':')[1] || '' : ''
                              if (!v && !m) setTimeFrom('')
                              else setTimeFrom(`${v}:${m}`)
                              if (v.length === 2) {
                                document.getElementById('min-input-from')?.focus()
                              }
                            }}
                            onBlur={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (v && v.length === 1) v = '0' + v
                              const m = timeFrom ? timeFrom.split(':')[1] || '' : ''
                              if (!v && !m) setTimeFrom('')
                              else setTimeFrom(`${v}:${m}`)
                            }}
                            className="w-12 text-right bg-transparent outline-none font-black text-foreground placeholder:text-muted-foreground/30 placeholder:font-bold text-lg"
                          />
                          <span className="font-black text-foreground mx-1 pb-1 text-xl">:</span>
                          <input
                            id="min-input-from"
                            type="text"
                            placeholder="mm"
                            value={timeFrom ? timeFrom.split(':')[1] || '' : ''}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (parseInt(v) > 59) v = '59'
                              const h = timeFrom ? timeFrom.split(':')[0] || '00' : '00'
                              if (!h && !v) setTimeFrom('')
                              else setTimeFrom(`${h}:${v}`)
                            }}
                            onBlur={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (v && v.length === 1) v = '0' + v
                              const h = timeFrom ? timeFrom.split(':')[0] || '00' : '00'
                              if (!h && !v) setTimeFrom('')
                              else setTimeFrom(`${h}:${v}`)
                            }}
                            className="w-12 text-left bg-transparent outline-none font-black text-foreground placeholder:text-muted-foreground/30 placeholder:font-bold text-lg"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase ml-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Đến
                        </label>
                        <div className="flex items-center justify-center w-full p-3.5 bg-muted/40 rounded-2xl border border-border focus-within:border-primary focus-within:bg-white transition-all shadow-sm">
                          <input
                            type="text"
                            placeholder="hh"
                            value={timeTo ? timeTo.split(':')[0] : ''}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (parseInt(v) > 23) v = '23'
                              const m = timeTo ? timeTo.split(':')[1] || '' : ''
                              if (!v && !m) setTimeTo('')
                              else setTimeTo(`${v}:${m}`)
                              if (v.length === 2) {
                                document.getElementById('min-input-to')?.focus()
                              }
                            }}
                            onBlur={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (v && v.length === 1) v = '0' + v
                              const m = timeTo ? timeTo.split(':')[1] || '' : ''
                              if (!v && !m) setTimeTo('')
                              else setTimeTo(`${v}:${m}`)
                            }}
                            className="w-12 text-right bg-transparent outline-none font-black text-foreground placeholder:text-muted-foreground/30 placeholder:font-bold text-lg"
                          />
                          <span className="font-black text-foreground mx-1 pb-1 text-xl">:</span>
                          <input
                            id="min-input-to"
                            type="text"
                            placeholder="mm"
                            value={timeTo ? timeTo.split(':')[1] || '' : ''}
                            onChange={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (parseInt(v) > 59) v = '59'
                              const h = timeTo ? timeTo.split(':')[0] || '00' : '00'
                              if (!h && !v) setTimeTo('')
                              else setTimeTo(`${h}:${v}`)
                            }}
                            onBlur={(e) => {
                              let v = e.target.value.replace(/\D/g, '').slice(0, 2)
                              if (v && v.length === 1) v = '0' + v
                              const h = timeTo ? timeTo.split(':')[0] || '00' : '00'
                              if (!h && !v) setTimeTo('')
                              else setTimeTo(`${h}:${v}`)
                            }}
                            className="w-12 text-left bg-transparent outline-none font-black text-foreground placeholder:text-muted-foreground/30 placeholder:font-bold text-lg"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase ml-1">Lý do</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        rows={2}
                        className="w-full p-4 bg-muted/40 rounded-2xl border border-border font-medium outline-none resize-none focus:border-primary transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase ml-1 flex items-center justify-between">
                        <span>Tài liệu buổi họp</span>
                        <span className="text-[10px] text-muted-foreground font-normal normal-case">
                          Chấp nhận PDF, Word, Excel, Slide, ZIP... (Tối đa 100MB/file)
                        </span>
                      </label>

                      <div className="rounded-2xl border border-border bg-muted/20 p-4 transition-all">
                        {/* File list */}
                        {(uploadedDocuments.length > 0 || uploadQueue.length > 0) && (
                          <div className="space-y-2 mb-4">
                            {/* Previous uploaded files */}
                            {uploadedDocuments.map((doc, idx) => (
                              <div
                                key={`uploaded-${idx}`}
                                className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-border/80"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                                  <span className="text-xs font-semibold truncate text-slate-700">
                                    {doc.name}
                                  </span>
                                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md shrink-0">
                                    Đã tải lên
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUploadedDocuments((prev) => prev.filter((_, i) => i !== idx))
                                  }}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-lg transition-colors text-xs font-bold shrink-0"
                                >
                                  Xoá
                                </button>
                              </div>
                            ))}

                            {/* Queue uploading/error files */}
                            {uploadQueue.map((item) => (
                              <div
                                key={item.id}
                                className={cn(
                                  'flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all',
                                  item.status === 'error'
                                    ? 'bg-rose-50/50 border-rose-100'
                                    : 'bg-white border-border/85'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {item.status === 'uploading' ? (
                                    <Loader2 className="h-4.5 w-4.5 text-primary shrink-0 animate-spin" />
                                  ) : (
                                    <FileText className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                                  )}
                                  <span className="text-xs font-semibold truncate text-slate-700">
                                    {item.name}
                                  </span>
                                  {item.status === 'uploading' ? (
                                    <span className="text-[10px] text-primary font-bold bg-primary/5 px-1.5 py-0.5 rounded-md shrink-0">
                                      Đang tải...
                                    </span>
                                  ) : (
                                    <span
                                      className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded-md shrink-0"
                                      title={item.error}
                                    >
                                      Lỗi tải
                                    </span>
                                  )}
                                </div>
                                {item.status === 'error' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUploadQueue((prev) => prev.filter((q) => q.id !== item.id))
                                    }}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-lg transition-colors text-xs font-bold shrink-0"
                                  >
                                    Xoá
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add file button */}
                        <div className="flex flex-col items-center justify-center py-2 text-center">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip,.rar"
                            className="hidden"
                            id="meeting-doc-upload"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || [])
                              e.target.value = ''
                              if (files.length === 0) return

                              // Validate files
                              const validFiles: File[] = []
                              for (const file of files) {
                                if (file.size > 100 * 1024 * 1024) {
                                  setDocUploadError(`File "${file.name}" vượt quá kích thước 100MB`)
                                  return
                                }
                                validFiles.push(file)
                              }
                              setDocUploadError(null)

                              // Trigger upload
                              validFiles.forEach((file) => {
                                const queueId = `${file.name}-${Date.now()}`
                                setUploadQueue((prev) => [
                                  ...prev,
                                  { id: queueId, name: file.name, status: 'uploading' },
                                ])

                                uploadMeetingDocument(file)
                                  .then((res) => {
                                    setUploadQueue((prev) => prev.filter((q) => q.id !== queueId))
                                    setUploadedDocuments((prev) => [
                                      ...prev,
                                      { url: res.url, name: res.originalName },
                                    ])
                                  })
                                  .catch((err) => {
                                    setUploadQueue((prev) =>
                                      prev.map((q) =>
                                        q.id === queueId
                                          ? {
                                              ...q,
                                              status: 'error',
                                              error: err.message || 'Lỗi tải lên',
                                            }
                                          : q
                                      )
                                    )
                                  })
                              })
                            }}
                          />

                          <label
                            htmlFor="meeting-doc-upload"
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-xs font-black uppercase text-primary hover:bg-primary/20 transition-all active:scale-95"
                          >
                            <Upload className="h-4 w-4" />
                            {uploadedDocuments.length > 0 || uploadQueue.length > 0
                              ? 'Chọn thêm tài liệu'
                              : 'Chọn tài liệu'}
                          </label>
                        </div>

                        {docUploadError && (
                          <p className="text-xs text-rose-600 mt-2 font-bold text-center">
                            ⚠️ {docUploadError}
                          </p>
                        )}

                        <div className="mt-4 border-t border-border/40 pt-4">
                          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                            Hoặc liên kết slide Canva / Tài liệu online
                          </p>
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Đường dẫn (https://...)"
                                value={linkUrl}
                                onChange={(e) => {
                                  setLinkUrl(e.target.value)
                                  setLinkError(null)
                                  if (e.target.value.includes('canva.com/design/') && !linkLabel) {
                                    setLinkLabel('Slide Canva')
                                  }
                                }}
                                className="flex-1 bg-white border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-primary transition-all"
                              />
                              <input
                                type="text"
                                placeholder="Tên hiển thị (Tùy chọn)"
                                value={linkLabel}
                                onChange={(e) => setLinkLabel(e.target.value)}
                                className="w-1/3 bg-white border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-primary transition-all"
                              />
                            </div>
                            {linkError && (
                              <p className="text-[11px] text-rose-500 font-semibold">{linkError}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const urlTrimmed = linkUrl.trim()
                                if (!urlTrimmed) {
                                  setLinkError('Vui lòng nhập đường dẫn liên kết.')
                                  return
                                }
                                if (!/^https?:\/\//i.test(urlTrimmed)) {
                                  setLinkError('Đường dẫn phải bắt đầu bằng http:// hoặc https://')
                                  return
                                }
                                let label = linkLabel.trim()
                                if (!label) {
                                  label = urlTrimmed.includes('canva.com/design/')
                                    ? 'Slide Canva'
                                    : 'Tài liệu online'
                                }
                                setUploadedDocuments((prev) => [
                                  ...prev,
                                  { name: label, url: urlTrimmed },
                                ])
                                setLinkUrl('')
                                setLinkLabel('')
                                setLinkError(null)
                              }}
                              className="w-full py-2 bg-secondary text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold uppercase transition-all"
                            >
                              Thêm liên kết
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(user?.role === 'MANAGER' || user?.role === 'BOD') && (
                      <label className="flex items-center gap-4 bg-amber-50 p-4 rounded-2xl cursor-pointer ring-1 ring-amber-100 hover:bg-amber-100 transition-all">
                        <input
                          type="checkbox"
                          checked={isEmergency}
                          onChange={(e) => setIsEmergency(e.target.checked)}
                          className="accent-amber-600 w-5 h-5"
                        />
                        <span className="text-xs font-semibold text-amber-700 uppercase">
                          🚨 Đặt khẩn cấp (Ghi đè lịch trùng)
                        </span>
                      </label>
                    )}
                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false)
                          resetForm()
                        }}
                        className="flex-1 py-4 font-bold uppercase text-muted-foreground hover:text-foreground transition-all"
                      >
                        Đóng
                      </button>
                      <button
                        type="submit"
                        disabled={createMut.isPending || updateMut.isPending}
                        className="flex-1 py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {createMut.isPending || updateMut.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        ) : editingId ? (
                          'Cập nhật'
                        ) : (
                          'Xác nhận'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {rejectId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setRejectId(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md bg-card p-8 rounded-[2.5rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black uppercase mb-4">Từ chối lịch</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Lý do..."
              className="w-full p-4 bg-muted/40 border border-border rounded-2xl outline-none resize-none mb-6"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 font-bold text-muted-foreground uppercase"
              >
                Quay lại
              </button>
              <button
                onClick={handleReject}
                className="flex-1 py-4 bg-rose-500 text-white font-bold rounded-2xl uppercase"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {finishConfirmId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setFinishConfirmId(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md bg-card p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">
                  Kết thúc họp sớm
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed px-4">
                  Bạn xác nhận đã họp xong và muốn giải phóng phòng cho người khác?
                </p>
              </div>
              <div className="flex w-full gap-4 pt-4">
                <button
                  onClick={() => setFinishConfirmId(null)}
                  className="flex-1 py-4 font-bold text-muted-foreground uppercase hover:bg-muted/50 rounded-2xl transition-all"
                >
                  Quay lại
                </button>
                <button
                  onClick={executeFinish}
                  className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase shadow-lg shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  XÁC NHẬN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <div
            className="relative w-full max-w-md bg-card p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-rose-500" />
              </div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Hủy lịch họp</h3>
                <p className="text-muted-foreground text-sm leading-relaxed px-4">
                  Bạn có chắc chắn muốn hủy lịch họp này không? Hành động này không thể khôi phục.
                </p>
              </div>
              <div className="flex w-full gap-4 pt-4">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-4 font-bold text-muted-foreground uppercase hover:bg-muted/50 rounded-2xl transition-all"
                >
                  Quay lại
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-4 bg-rose-500 text-white font-black rounded-2xl uppercase shadow-lg shadow-rose-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  XÁC NHẬN HỦY
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
