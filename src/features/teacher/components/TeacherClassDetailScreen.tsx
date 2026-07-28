import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'
import {
  DateController,
  InputController,
  InputFieldController,
  TextareaController,
} from '@/components/ui/form-controllers'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PaginationCardStepper, PaginationPrevNext } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'

import {
  useApproveClassRegistration,
  useCreateTeacherRoadmapItem,
  useRejectClassRegistration,
  useRemoveTeacherClassMember,
  useTeacherClassDetail,
  useTeacherClassRegistrations,
  useTeacherCreateSchedule,
  useTeacherDeleteSchedule,
  useTeacherRoadmapItems,
  useTeacherSchedules,
  useTeacherUpdateAttendance,
  useTeacherUpdateSchedule,
} from '@/features/teacher/hooks'
import { joinTimeHm, splitTimeToParts } from '@/lib/time24h'
import { cn } from '@/lib/utils'
import { SessionEvaluationModal } from './SessionEvaluationModal'
import { TeacherClassMemberCard } from './TeacherClassMemberCard'
import type { ClassMemberRow } from './teacherClassMemberTypes'
import { ViewEvaluationsModal } from './ViewEvaluationsModal'

const FILTERS = [{ key: 'all', label: 'Tất cả học viên' }] as const

/** YYYY-MM-DD — ngày hôm nay (local), dùng cho min của input date. */
function getTodayIsoLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function findOverlappingSchedule(
  schedules: Array<{
    id: string
    dateIso: string
    startTime: string
    endTime: string
    topic: string
  }>,
  input: { dateIso: string; startTime: string; endTime: string },
  excludeScheduleId?: string | null
) {
  return schedules.find(
    (s) =>
      s.id !== excludeScheduleId &&
      s.dateIso === input.dateIso &&
      s.startTime < input.endTime &&
      s.endTime > input.startTime
  )
}

function getVietnamNowParts() {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const vnIso = vnNow.toISOString()
  return { dateIso: vnIso.slice(0, 10), timeHm: vnIso.slice(11, 16) }
}

function isScheduleStarted(schedule: { dateIso: string; startTime: string }) {
  const now = getVietnamNowParts()
  return (
    schedule.dateIso < now.dateIso ||
    (schedule.dateIso === now.dateIso && schedule.startTime <= now.timeHm)
  )
}

function isScheduleEnded(schedule: { dateIso: string; endTime: string }) {
  const now = getVietnamNowParts()
  return (
    schedule.dateIso < now.dateIso ||
    (schedule.dateIso === now.dateIso && schedule.endTime < now.timeHm)
  )
}

function allowsReflectionSubmission(assessment?: string | null) {
  if (!assessment) return false
  const normalized = assessment
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
  return (
    normalized.includes('phan tu') ||
    normalized.includes('tu luan') ||
    normalized.includes('review')
  )
}

function MemberRemoveButton({
  member,
  onRemove,
}: {
  member: ClassMemberRow
  onRemove: (member: ClassMemberRow) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-xl border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"
      onClick={() => onRemove(member)}
    >
      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
      {member.isMakeup ? 'Xóa học bù' : 'Xóa khỏi lớp'}
    </Button>
  )
}

const NOTE_TEMPLATE = `- Có nội dung nào khiến bạn thay đổi tư duy so với trước đây?
- Có nội dung nào khiến bạn đặc biệt ấn tượng?
- Có nội dung nào bạn chưa đồng ý/ muốn thảo luận thêm/ chưa rõ?
- Bạn sẽ thử nghiệm kiến thức nào vào công việc và cuộc sống?`

/** True khi màn hình dưới breakpoint `md` (768px) — để chỉ render 1 biến thể bảng/thẻ. */
function useIsBelowMd() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(max-width: 767px)')
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(max-width: 767px)').matches,
    () => false
  )
}

export function TeacherClassDetailScreen({ classId }: { classId: string }) {
  const isMobileLayout = useIsBelowMd()
  const routeHash = useRouterState({ select: (s) => s.location.hash })
  const {
    data,
    isLoading: isLoadingDetail,
    isError: isErrorDetail,
  } = useTeacherClassDetail(classId)
  const { data: schedules = [] } = useTeacherSchedules(classId)
  const isDeadlineOnly = useCallback((s: { topic: string; location?: string | null }) => {
    return s.location === 'Nộp bài trực tuyến' || s.topic?.includes('Hạn nộp')
  }, [])
  const regularSchedules = useMemo(
    () => schedules.filter((s) => !isDeadlineOnly(s)),
    [schedules, isDeadlineOnly]
  )
  const deadlineSchedules = useMemo(
    () => schedules.filter((s) => isDeadlineOnly(s)),
    [schedules, isDeadlineOnly]
  )

  const { data: registrations = [] } = useTeacherClassRegistrations(classId)
  const createSchedule = useTeacherCreateSchedule(classId)
  const updateSchedule = useTeacherUpdateSchedule(classId)
  const deleteSchedule = useTeacherDeleteSchedule(classId)
  const createRoadmapItem = useCreateTeacherRoadmapItem(classId)
  const approveRegistration = useApproveClassRegistration(classId)
  const rejectRegistration = useRejectClassRegistration(classId)
  const removeClassMember = useRemoveTeacherClassMember(classId)
  const title = data?.name || `Lớp ${classId}`
  const members: ClassMemberRow[] = useMemo(
    () =>
      (data?.members ?? []).map((m) => ({
        id: m.userId,
        name: m.name,
        email: m.email,
        isMakeup: m.isMakeup,
        makeupScheduleIds: m.makeupScheduleIds,
        examResult:
          m.latestResult?.outcome === 'DAT'
            ? 'Đạt'
            : m.latestResult?.outcome === 'BAO_LUU'
              ? 'Bảo lưu'
              : m.latestResult?.outcome === 'CHO_HOC_LAI'
                ? 'Chờ học lại'
                : m.latestResult?.outcome === 'CHIA_TAY'
                  ? 'Chia tay'
                  : null,
      })),
    [data?.members]
  )

  const filtersForm = useForm<{ filterKey: (typeof FILTERS)[number]['key']; searchDraft: string }>({
    defaultValues: { filterKey: 'all', searchDraft: '' },
  })

  const searchDraft = useWatch({ control: filtersForm.control, name: 'searchDraft' }) ?? ''
  const deferredSearchDraft = useDeferredValue(searchDraft)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [isCreatingDeadlineOnly, setIsCreatingDeadlineOnly] = useState(false)
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false)

  // Roadmap catalog is only needed when creating/editing a schedule or adding a
  // roadmap item, so we lazy-load it to keep the initial class-detail render fast.
  const { data: roadmapItems = [] } = useTeacherRoadmapItems(
    classId,
    scheduleModalOpen || roadmapModalOpen
  )

  const roadmapForm = useForm<{
    topic: string
    objective: string
    materialRef?: string
    assessment?: string
    trainer?: string
  }>({
    defaultValues: {
      topic: '',
      objective: '',
      materialRef: '',
      assessment: '',
      trainer: '',
    },
  })

  // Evaluation modal state
  const [evalModalOpen, setEvalModalOpen] = useState(false)
  const [evalTarget, _setEvalTarget] = useState<{ userId: string; userName: string } | null>(null)
  const [viewEvalModalOpen, setViewEvalModalOpen] = useState(false)
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({})
  const [approvingRegistrationId, setApprovingRegistrationId] = useState<string | null>(null)
  const [rejectingRegistrationId, setRejectingRegistrationId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClassMemberRow | null>(null)
  const [removeReason, setRemoveReason] = useState('')

  const openRemoveDialog = (member: ClassMemberRow) => {
    setRemoveTarget(member)
    setRemoveReason('')
  }

  const updateAttendance = useTeacherUpdateAttendance(classId)

  // Tự động chọn buổi học đầu tiên nếu có dữ liệu và chưa chọn buổi nào
  useEffect(() => {
    if (regularSchedules && regularSchedules.length > 0 && !activeScheduleId) {
      setActiveScheduleId(regularSchedules[0]?.id || null)
    }
  }, [regularSchedules, activeScheduleId])

  const activeSchedule = useMemo(
    () => schedules.find((s) => s.id === activeScheduleId),
    [schedules, activeScheduleId]
  )
  const selectedSchedule = useMemo(
    () => regularSchedules.find((s) => s.id === activeScheduleId),
    [regularSchedules, activeScheduleId]
  )
  const roadmapItemsByTopic = useMemo(() => {
    const groups = new Map<string, typeof roadmapItems>()
    for (const item of roadmapItems) {
      const topic = item.topic || 'Khác'
      groups.set(topic, [...(groups.get(topic) ?? []), item])
    }
    return Array.from(groups.entries())
  }, [roadmapItems])
  const scheduleForm = useForm({
    defaultValues: {
      dateIso: '',
      endDateIso: '',
      startHour: '08',
      startMinute: '00',
      endHour: '10',
      endMinute: '00',
      topic: '',
      location: '',
      roadmapItemIds: [] as string[],
      roadmapItemDeadlines: {} as Record<string, string>,
      gradingType: 'direct',
      materialRef: '',
      note: '',
    },
  })
  const {
    control: scheduleControl,
    getValues: getScheduleValues,
    reset: resetScheduleValues,
    setValue: setScheduleValue,
  } = scheduleForm

  const selectedRoadmapItemIds =
    useWatch({
      control: scheduleControl,
      name: 'roadmapItemIds',
    }) ?? []

  const scheduleInitial = {
    dateIso: '',
    startHour: '08',
    startMinute: '00',
    endHour: '10',
    endMinute: '00',
    topic: '',
    location: '',
    roadmapItemIds: [] as string[],
    roadmapItemDeadlines: {} as Record<string, string>,
    gradingType: 'direct',
    materialRef: '',
    note: '',
  }

  const countRoadmapItemDeadlineSelections = (
    itemId: string,
    excludeScheduleId?: string | null
  ) => {
    return deadlineSchedules.filter((s) => {
      if (excludeScheduleId && s.id === excludeScheduleId) return false
      return s.roadmapItems?.some((item) => item.id === itemId)
    }).length
  }

  const hasExistingDeadlineForRoadmapItem = (itemId: string, excludeScheduleId?: string | null) => {
    return countRoadmapItemDeadlineSelections(itemId, excludeScheduleId) > 0
  }

  const selectedRoadmapDuplicateCounts = useMemo(() => {
    if (!isCreatingDeadlineOnly) return []
    return selectedRoadmapItemIds.flatMap((itemId) => {
      const existingCount = deadlineSchedules.filter((s) => {
        if (editingScheduleId && s.id === editingScheduleId) return false
        return s.roadmapItems?.some((item) => item.id === itemId)
      }).length
      if (existingCount === 0) return []
      const item = roadmapItems.find((roadmapItem) => roadmapItem.id === itemId)
      return [
        {
          itemId,
          objective: item?.objective ?? 'Học phần',
          selectionNumber: existingCount + 1,
        },
      ]
    })
  }, [
    isCreatingDeadlineOnly,
    selectedRoadmapItemIds,
    roadmapItems,
    deadlineSchedules,
    editingScheduleId,
  ])

  const getAutoGradingType = (selectedIds: string[], excludeScheduleId?: string | null) => {
    if (selectedIds.length === 0) return 'direct'
    const hasAnyExisting = selectedIds.some((id) =>
      hasExistingDeadlineForRoadmapItem(id, excludeScheduleId)
    )
    return hasAnyExisting ? 'direct' : 'rubric_reading'
  }

  const toggleRoadmapItem = (itemId: string, checked: boolean) => {
    const current = getScheduleValues('roadmapItemIds') ?? []
    const next = checked
      ? Array.from(new Set([...current, itemId]))
      : current.filter((id) => id !== itemId)
    setScheduleValue('roadmapItemIds', next, { shouldDirty: true, shouldValidate: true })

    if (!editingScheduleId) {
      const autoType = getAutoGradingType(next, null)
      setScheduleValue('gradingType', autoType, { shouldDirty: true, shouldValidate: true })
    }
  }

  const onEditSchedule = (scheduleId: string) => {
    const s = schedules.find((x) => x.id === scheduleId)
    if (!s) return
    setScheduleModalOpen(true)
    setEditingScheduleId(scheduleId)
    setIsCreatingDeadlineOnly(isDeadlineOnly(s))
    const [sh, sm] = splitTimeToParts(s.startTime)
    const [eh, em] = splitTimeToParts(s.endTime)
    const todayMin = getTodayIsoLocal()
    const dateIso = s.dateIso >= todayMin ? s.dateIso : todayMin

    let endDateIso = dateIso
    const firstItem = s.roadmapItems?.[0]
    if (firstItem && firstItem.deadline) {
      const d = new Date(firstItem.deadline)
      const offsetDate = new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000)
      endDateIso = offsetDate.toISOString().slice(0, 10) // YYYY-MM-DD
    }

    const deadlines: Record<string, string> = {}
    s.roadmapItems?.forEach((item) => {
      if (item.deadline) {
        const date = new Date(item.deadline)
        const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
        deadlines[item.id] = offsetDate.toISOString().slice(0, 16)
      }
    })

    resetScheduleValues({
      dateIso,
      endDateIso,
      startHour: sh,
      startMinute: sm,
      endHour: eh,
      endMinute: em,
      topic: s.topic,
      location: s.location ?? '',
      roadmapItemIds: s.roadmapItems?.map((item) => item.id) ?? [],
      roadmapItemDeadlines: deadlines,
      gradingType: (s.examQuestions as any)?.gradingType || 'direct',
      materialRef: (s as any).materialRef ?? '',
      note: (s as any).note ?? '',
    })
  }

  const onDeleteSchedule = (scheduleId: string) => {
    const s = schedules.find((x) => x.id === scheduleId)
    if (!s) return
    const ok = window.confirm(
      `Xóa buổi học "${s.topic}" ngày ${s.dateIso} ${s.startTime} - ${s.endTime}?`
    )
    if (!ok) return
    deleteSchedule.mutate(scheduleId, {
      onSuccess: () => {
        setActiveScheduleId(null)
        if (editingScheduleId === scheduleId) {
          resetScheduleForm()
          setScheduleModalOpen(false)
        }
      },
    })
  }

  const closeScheduleModal = () => {
    setScheduleModalOpen(false)
    resetScheduleForm()
  }

  const resetScheduleForm = () => {
    setEditingScheduleId(null)
    setIsCreatingDeadlineOnly(false)
    resetScheduleValues(scheduleInitial)
  }

  const filtered = useMemo(() => {
    let list = activeScheduleId
      ? members.filter((m) => !m.isMakeup || m.makeupScheduleIds?.includes(activeScheduleId))
      : members.filter((m) => !m.isMakeup)
    if (deferredSearchDraft) {
      const s = deferredSearchDraft.toLowerCase()
      list = list.filter(
        (m) => m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)
      )
    }
    return list
  }, [activeScheduleId, members, deferredSearchDraft])

  const total = activeScheduleId ? filtered.length : members.filter((m) => !m.isMakeup).length
  const page = 1
  const totalPages = 1

  useEffect(() => {
    const h = routeHash?.replace(/^#/, '') ?? ''
    if (h !== 'lich-hoc') return
    const t = window.setTimeout(() => {
      document.getElementById('lich-hoc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setEditingScheduleId(null)
      resetScheduleValues(scheduleInitial)
      setScheduleModalOpen(true)
    }, 100)
    return () => window.clearTimeout(t)
  }, [routeHash, classId, schedules.length])

  useEffect(() => {
    if (!scheduleModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setScheduleModalOpen(false)
        setEditingScheduleId(null)
        resetScheduleValues(scheduleInitial)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scheduleModalOpen, resetScheduleValues])

  return (
    <div className="min-h-screen flex flex-col text-sm text-slate-900">
      <div className="flex-1 overflow-y-auto">
        <div className="">
          <div className="mb-4">
            <div className="flex flex-col justify-between md:flex-row md:items-end">
              <div className="">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-4xl flex items-center gap-3 line-clamp-1">
                  <Link to="/teacher/classes">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:bg-[#006C49] hover:text-white">
                      <ArrowLeft className="h-4 w-4" />
                    </div>
                  </Link>
                  {title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1">
                  <Button
                    size="sm"
                    className={cn(
                      'h-full rounded-xl px-4 text-xs font-black uppercase cursor-pointer',
                      viewMode === 'cards'
                        ? 'bg-[#006C49] text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-50 bg-white'
                    )}
                    onClick={() => setViewMode('cards')}
                  >
                    Dạng thẻ
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      'h-full rounded-xl px-4 text-xs font-black uppercase cursor-pointer',
                      viewMode === 'table'
                        ? 'bg-[#006C49] text-white shadow-lg'
                        : 'text-slate-400 hover:bg-slate-50 bg-white'
                    )}
                    onClick={() => setViewMode('table')}
                  >
                    Dạng bảng
                  </Button>
                </div>
                <Button className="h-11 rounded-2xl px-6 text-xs font-black uppercase cursor-pointer">
                  Xuất báo cáo
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/40">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                  Duyệt đăng ký
                </p>
                <h3 className="text-xl font-black text-slate-900">
                  Học viên chờ vào lớp ({registrations.length})
                </h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {registrations.length === 0 ? (
                <p className="p-6 text-sm font-semibold text-slate-400">
                  Chưa có đăng ký nào đang chờ duyệt.
                </p>
              ) : (
                registrations.map((r) => (
                  <div
                    key={r.id}
                    className="grid gap-4 p-5 lg:grid-cols-[1fr_280px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <EmployeeAvatar
                        name={r.user.name}
                        className="h-11 w-11 rounded-2xl shadow-sm ring-2 ring-background"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{r.user.name}</p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          {r.user.email} · {r.user.jobTitle || 'Chưa có vị trí'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={rejectReasonById[r.id] ?? ''}
                        onChange={(e) =>
                          setRejectReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        placeholder="Lý do nếu từ chối"
                        className="h-9 rounded-xl text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-bold"
                          disabled={approveRegistration.isPending || rejectRegistration.isPending}
                          loading={
                            approvingRegistrationId === r.id && approveRegistration.isPending
                          }
                          onClick={() => {
                            setApprovingRegistrationId(r.id)
                            approveRegistration.mutate(r.id, {
                              onSettled: () => setApprovingRegistrationId(null),
                            })
                          }}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Duyệt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 rounded-xl border-rose-200 text-xs font-bold text-rose-600"
                          disabled={approveRegistration.isPending || rejectRegistration.isPending}
                          loading={rejectingRegistrationId === r.id && rejectRegistration.isPending}
                          onClick={() => {
                            const reason = (rejectReasonById[r.id] ?? '').trim()
                            if (!reason) {
                              toast.error('Vui lòng nhập lý do từ chối')
                              return
                            }
                            setRejectingRegistrationId(r.id)
                            rejectRegistration.mutate(
                              { registrationId: r.id, reason },
                              { onSettled: () => setRejectingRegistrationId(null) }
                            )
                          }}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Từ chối
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Schedule Management Card - LIGHT THEME */}
          <div className="group relative mb-4 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 transition-all hover:shadow-primary/5">
            <div className="flex flex-col justify-between gap-8 p-8 sm:flex-row sm:items-center sm:px-12">
              <div className="flex items-center gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#006C49] text-white transition-transform group-hover:scale-110">
                  <CalendarDays className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tight text-slate-900">
                    Lịch học & Điều phối
                  </h3>
                  <p className="text-sm font-semibold text-slate-400">
                    Điều phối các buổi đào tạo và theo dõi điểm danh
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="h-14 rounded-2xl px-8 text-base font-black cursor-pointer"
                  onClick={() => {
                    resetScheduleForm()
                    setScheduleModalOpen(true)
                  }}
                >
                  <CalendarDays className="mr-2 h-5 w-5" />
                  THÊM BUỔI MỚI
                </Button>
                <Button
                  className="h-14 rounded-2xl px-8 text-base font-black cursor-pointer"
                  onClick={() => {
                    roadmapForm.reset({
                      topic: '',
                      objective: '',
                      materialRef: '',
                      assessment: '',
                      trainer: '',
                    })
                    setRoadmapModalOpen(true)
                  }}
                >
                  <Star className="mr-2 h-5 w-5" />
                  THÊM LỘ TRÌNH
                </Button>
                <Button
                  className="h-14 rounded-2xl px-8 text-base font-black cursor-pointer bg-white border border-slate-200 text-[#006C49] hover:bg-slate-50"
                  onClick={() => {
                    resetScheduleForm()
                    scheduleForm.reset({
                      dateIso: getTodayIsoLocal(),
                      startHour: '00',
                      startMinute: '00',
                      endHour: '23',
                      endMinute: '59',
                      topic: 'Hạn nộp bài phản tư',
                      location: 'Nộp bài trực tuyến',
                      roadmapItemIds: [],
                      roadmapItemDeadlines: {},
                      gradingType: 'direct',
                      note: NOTE_TEMPLATE,
                    })
                    setIsCreatingDeadlineOnly(true)
                    setScheduleModalOpen(true)
                  }}
                >
                  <Clock className="mr-2 h-5 w-5" />
                  TẠO HẠN NỘP
                </Button>
              </div>
            </div>

            {/* Session Navigation inside the card */}
            {regularSchedules.length > 0 && (
              <div className="border-t border-slate-50 bg-slate-50/50 p-4 sm:px-12">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className={cn(
                      'h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest transition-all',
                      !activeScheduleId
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-slate-400 hover:bg-slate-100'
                    )}
                    onClick={() => setActiveScheduleId(null)}
                  >
                    TỔNG QUAN LỚP
                  </Button>
                  {regularSchedules.map((s, idx) => {
                    const isActive = activeScheduleId === s.id
                    return (
                      <Button
                        key={s.id}
                        variant="ghost"
                        className={cn(
                          'h-11 rounded-xl px-6 text-xs font-black uppercase tracking-widest transition-all',
                          isActive
                            ? 'bg-[#006C49] hover:bg-[#006C49]/90 hover:text-white text-white'
                            : 'text-slate-400 hover:bg-slate-100'
                        )}
                        onClick={() => setActiveScheduleId(s.id)}
                      >
                        BUỔI {idx + 1}
                      </Button>
                    )
                  })}
                </div>
                {selectedSchedule ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        {selectedSchedule.topic}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {selectedSchedule.dateIso} · {selectedSchedule.startTime} -{' '}
                        {selectedSchedule.endTime}
                        {selectedSchedule.location ? ` · ${selectedSchedule.location}` : ''}
                      </p>
                      {selectedSchedule.roadmapItems?.length ? (
                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-400">
                          {selectedSchedule.roadmapItems.map((item) => item.objective).join(', ')}
                        </p>
                      ) : null}
                      {(selectedSchedule as any).materialRef ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Tài liệu:{' '}
                          <a
                            href={(selectedSchedule as any).materialRef}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-indigo-600 hover:underline"
                          >
                            {(selectedSchedule as any).materialRef}
                          </a>
                        </p>
                      ) : null}
                      {(selectedSchedule as any).note ? (
                        <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs font-semibold text-slate-600 whitespace-pre-wrap max-w-2xl">
                          <p className="font-bold text-slate-800 mb-1">Ghi chú / Câu hỏi gợi ý:</p>
                          {(selectedSchedule as any).note}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-primary/20 px-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                        disabled={deleteSchedule.isPending}
                        onClick={() => onEditSchedule(selectedSchedule.id)}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Sửa buổi
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-rose-200 px-4 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
                        loading={deleteSchedule.isPending}
                        disabled={deleteSchedule.isPending}
                        onClick={() => onDeleteSchedule(selectedSchedule.id)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Xóa buổi
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Lịch nộp phản tư Card — TEACHER */}
          {deadlineSchedules.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
                <h3 className="text-2xl font-black text-slate-900">
                  Lịch nộp phản tư ({deadlineSchedules.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {deadlineSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="grid gap-4 p-6 lg:grid-cols-[1fr_240px] lg:items-center hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-lg border-0 bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                          Hạn nộp
                        </Badge>
                        <p className="text-base font-black text-slate-950">{s.topic}</p>
                      </div>
                      {(() => {
                        const firstItem = s.roadmapItems?.[0]
                        let deadlineStr = `${s.dateIso} · ${s.startTime} - ${s.endTime}`
                        if (firstItem && firstItem.deadline) {
                          const dlDate = new Date(firstItem.deadline)
                          const offsetDate = new Date(
                            dlDate.getTime() - dlDate.getTimezoneOffset() * 60 * 1000
                          )
                          const endD = offsetDate.toISOString().slice(0, 10)
                          if (endD !== s.dateIso) {
                            const timePart = offsetDate.toISOString().slice(11, 16)
                            deadlineStr = `${s.dateIso} (${s.startTime}) đến ${endD} (${timePart})`
                          }
                        }
                        return (
                          <p className="text-xs font-semibold text-slate-500">
                            Hạn nộp: <span className="font-bold text-slate-700">{deadlineStr}</span>
                          </p>
                        )
                      })()}
                      {s.roadmapItems?.length ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {s.roadmapItems.map((item) => (
                            <Badge
                              key={item.id}
                              variant="outline"
                              className="rounded-lg px-2 py-0.5 text-[10px] font-bold border-slate-200 bg-slate-50 text-slate-600"
                            >
                              {item.objective}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      {(s as any).note ? (
                        <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs font-semibold text-slate-600 whitespace-pre-wrap max-w-2xl">
                          <p className="font-bold text-slate-800 mb-1">Ghi chú / Câu hỏi gợi ý:</p>
                          {(s as any).note}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-primary/20 px-4 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5"
                        onClick={() => onEditSchedule(s.id)}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Sửa
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-rose-200 px-4 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50"
                        onClick={() => onDeleteSchedule(s.id)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Xóa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Search & Filters */}
          <div className="mb-2 flex flex-col gap-4 lg:flex-row lg:items-center">
            <Form {...filtersForm}>
              <div className="flex h-14 flex-1 items-center gap-4 rounded-3xl border border-slate-200 bg-white px-5 shadow-sm transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5">
                <Search className="h-5 w-5 text-slate-400" />
                <InputFieldController
                  control={filtersForm.control}
                  name="searchDraft"
                  placeholder="Tìm kiếm học viên theo tên hoặc email..."
                  className="flex-1"
                  wrapperClassName="flex-1"
                  inputClassName="h-full border-0 bg-transparent text-base font-medium shadow-none focus-visible:ring-0 placeholder:text-slate-300"
                />
              </div>
            </Form>
          </div>
          {isLoadingDetail ? (
            <div
              className="space-y-3 rounded-[32px] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/50 ring-1 ring-slate-200/60"
              role="status"
              aria-busy
              aria-label="Đang tải danh sách thành viên"
            >
              <span className="sr-only">Đang tải thành viên…</span>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="h-7 w-24 shrink-0 rounded-lg" />
                </div>
              ))}
            </div>
          ) : isErrorDetail ? (
            <div className="rounded-[32px] border border-destructive/30 bg-destructive/5 py-10 text-center text-sm text-destructive">
              Không tải được thông tin lớp. Vui lòng thử lại.
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 ring-1 ring-slate-200/60">
              <div className="divide-y divide-border md:hidden">
                {(isMobileLayout ? filtered : []).map((m) => {
                  const currentSchedule = activeSchedule
                  const rawAttendance =
                    currentSchedule?.attendanceData?.[m.id]?.attendance || 'NONE'

                  let displayAttendance = rawAttendance
                  if (currentSchedule && (rawAttendance === 'NONE' || !rawAttendance)) {
                    if (isScheduleEnded(currentSchedule)) {
                      displayAttendance = 'ABSENT'
                    }
                  }
                  const attendanceLocked = currentSchedule
                    ? !isScheduleStarted(currentSchedule)
                    : false

                  const sessionData = {
                    ...(currentSchedule?.attendanceData?.[m.id] || {}),
                    attendance: displayAttendance,
                  }

                  return (
                    <div key={m.id} className="space-y-3 p-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          name={m.name}
                          className="h-10 w-10 shrink-0 rounded-2xl shadow-sm ring-2 ring-background"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-primary">{m.name}</p>
                            {m.isMakeup ? (
                              <Badge className="rounded-lg border-0 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                Học bù
                              </Badge>
                            ) : null}
                          </div>
                          <p className="break-all text-xs font-medium text-muted-foreground/80">
                            {m.email}
                          </p>
                        </div>
                      </div>
                      {!activeScheduleId ? (
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Kết quả cuối khóa
                          </p>
                          {m.examResult ? (
                            <Badge className="rounded-lg border-0 bg-emerald-100/80 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              {m.examResult}
                            </Badge>
                          ) : (
                            <span className="font-bold text-muted-foreground/40">—</span>
                          )}
                          <MemberRemoveButton member={m} onRemove={openRemoveDialog} />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-black text-foreground">
                              {currentSchedule?.dateIso}
                            </p>
                            <p className="text-xs font-bold text-muted-foreground/60">
                              {currentSchedule?.startTime} - {currentSchedule?.endTime}
                            </p>
                          </div>
                          <p className="break-words text-xs font-bold text-muted-foreground">
                            {currentSchedule?.topic}
                          </p>
                          <div className="space-y-1">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                              Điểm danh
                            </p>
                            <Select
                              value={sessionData.attendance || 'NONE'}
                              disabled={attendanceLocked}
                              onValueChange={(v) => {
                                if (attendanceLocked) {
                                  toast.error('Chỉ được điểm danh sau khi buổi học bắt đầu.')
                                  return
                                }
                                updateAttendance.mutate({
                                  scheduleId: activeScheduleId!,
                                  input: { userId: m.id, attendance: v },
                                })
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-10 w-full max-w-full rounded-full border-0 font-black text-xs uppercase tracking-widest shadow-sm',
                                  attendanceLocked && 'cursor-not-allowed opacity-60',
                                  sessionData.attendance === 'PRESENT' &&
                                    'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20',
                                  sessionData.attendance === 'ABSENT' &&
                                    'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20',
                                  sessionData.attendance === 'LATE' &&
                                    'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20',
                                  (!sessionData.attendance || sessionData.attendance === 'NONE') &&
                                    'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                                )}
                              >
                                <SelectValue
                                  placeholder={attendanceLocked ? 'Chưa bắt đầu' : 'Chưa chọn'}
                                />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-slate-200 p-1 shadow-2xl">
                                <SelectItem
                                  value="NONE"
                                  className="rounded-xl py-2 font-bold text-slate-500 focus:bg-slate-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                    Chưa chọn
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="PRESENT"
                                  className="rounded-xl py-2 font-bold text-emerald-600 focus:bg-emerald-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Tham gia
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="ABSENT"
                                  className="rounded-xl py-2 font-bold text-rose-600 focus:bg-rose-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    Vắng mặt
                                  </div>
                                </SelectItem>
                                <SelectItem
                                  value="LATE"
                                  className="rounded-xl py-2 font-bold text-amber-600 focus:bg-amber-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Đến muộn
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <MemberRemoveButton member={m} onRemove={openRemoveDialog} />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-8 py-6 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                        Học viên
                      </th>
                      {!activeScheduleId ? (
                        <>
                          <th className="px-8 py-6 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                            Thông tin Email
                          </th>
                          <th className="px-8 py-6 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                            Kết quả cuối khóa
                          </th>
                          <th className="px-8 py-6 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                            Thao tác
                          </th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-4 text-left">Ngày / Giờ</th>
                          <th className="px-6 py-4 text-left">Nội dung</th>
                          <th className="px-6 py-4 text-center">Điểm danh</th>
                          <th className="px-6 py-4 text-right">Thao tác</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(isMobileLayout ? [] : filtered).map((m) => {
                      const currentSchedule = activeSchedule
                      const rawAttendance =
                        currentSchedule?.attendanceData?.[m.id]?.attendance || 'NONE'

                      // Nếu buổi học đã qua mà vẫn 'NONE', hiển thị là 'ABSENT'
                      let displayAttendance = rawAttendance
                      if (currentSchedule && (rawAttendance === 'NONE' || !rawAttendance)) {
                        if (isScheduleEnded(currentSchedule)) {
                          displayAttendance = 'ABSENT'
                        }
                      }
                      const attendanceLocked = currentSchedule
                        ? !isScheduleStarted(currentSchedule)
                        : false

                      const sessionData = {
                        ...(currentSchedule?.attendanceData?.[m.id] || {}),
                        attendance: displayAttendance,
                      }

                      return (
                        <tr
                          key={m.id}
                          className="group border-b border-border/40 transition-colors hover:bg-muted/20"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar
                                name={m.name}
                                className="h-10 w-10 rounded-2xl shadow-sm ring-2 ring-background transition-transform group-hover:scale-110"
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-black text-primary transition-colors group-hover:text-primary-600">
                                    {m.name}
                                  </p>
                                  {m.isMakeup ? (
                                    <Badge className="rounded-lg border-0 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                      Học bù
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs font-medium text-muted-foreground/80">
                                  {m.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          {!activeScheduleId ? (
                            <>
                              <td className="px-6 py-4 text-muted-foreground font-medium">
                                {m.email}
                              </td>
                              <td className="px-6 py-4">
                                {m.examResult ? (
                                  <Badge className="rounded-lg bg-emerald-100/80 text-emerald-700 border-0 px-2.5 py-1 text-xs font-bold">
                                    {m.examResult}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground/40 font-bold">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <MemberRemoveButton member={m} onRemove={openRemoveDialog} />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <p className="text-xs font-black text-foreground">
                                    {currentSchedule?.dateIso}
                                  </p>
                                  <p className="text-xs font-bold text-muted-foreground/60">
                                    {currentSchedule?.startTime} - {currentSchedule?.endTime}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="max-w-[200px] truncate text-xs font-bold text-muted-foreground">
                                  {currentSchedule?.topic}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex justify-center">
                                  <Select
                                    value={sessionData.attendance || 'NONE'}
                                    disabled={attendanceLocked}
                                    onValueChange={(v) => {
                                      if (attendanceLocked) {
                                        toast.error('Chỉ được điểm danh sau khi buổi học bắt đầu.')
                                        return
                                      }
                                      updateAttendance.mutate({
                                        scheduleId: activeScheduleId!,
                                        input: { userId: m.id, attendance: v },
                                      })
                                    }}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        'h-9 w-[135px] rounded-full border-0 font-black text-xs uppercase tracking-widest transition-all shadow-sm',
                                        attendanceLocked && 'cursor-not-allowed opacity-60',
                                        sessionData.attendance === 'PRESENT' &&
                                          'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20',
                                        sessionData.attendance === 'ABSENT' &&
                                          'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20',
                                        sessionData.attendance === 'LATE' &&
                                          'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20',
                                        (!sessionData.attendance ||
                                          sessionData.attendance === 'NONE') &&
                                          'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                                      )}
                                    >
                                      <SelectValue
                                        placeholder={
                                          attendanceLocked ? 'Chưa bắt đầu' : 'Chưa chọn'
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-slate-200 p-1 shadow-2xl">
                                      <SelectItem
                                        value="NONE"
                                        className="rounded-xl py-2 font-bold text-slate-500 focus:bg-slate-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                          Chưa chọn
                                        </div>
                                      </SelectItem>
                                      <SelectItem
                                        value="PRESENT"
                                        className="rounded-xl py-2 font-bold text-emerald-600 focus:bg-emerald-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                          Tham gia
                                        </div>
                                      </SelectItem>
                                      <SelectItem
                                        value="ABSENT"
                                        className="rounded-xl py-2 font-bold text-rose-600 focus:bg-rose-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                          Vắng mặt
                                        </div>
                                      </SelectItem>
                                      <SelectItem
                                        value="LATE"
                                        className="rounded-xl py-2 font-bold text-amber-600 focus:bg-amber-50"
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                          Đến muộn
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <MemberRemoveButton member={m} onRemove={openRemoveDialog} />
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>
                    Trang {page} — {filtered.length} thành viên hiển thị
                  </span>
                  <Button
                    size="sm"
                    className="uppercase cursor-pointer font-black"
                    onClick={() => {
                      if (activeScheduleId) {
                        if (!selectedSchedule?.evaluatedUserIds?.length) {
                          toast.info('Chưa có đánh giá nào cho buổi học này')
                          return
                        }
                        setViewEvalModalOpen(true)
                      } else {
                        toast.error('Vui lòng chọn một buổi học để xem đánh giá')
                      }
                    }}
                  >
                    <Star className="mr-2 h-3.5 w-3.5 fill-current" /> Xem đánh giá buổi học
                  </Button>
                </div>
                <PaginationPrevNext page={page} totalPages={totalPages} onPageChange={() => {}} />
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'grid gap-8 gap-y-4',
                  selectedId
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                )}
              >
                {filtered.map((m, idx) => (
                  <TeacherClassMemberCard
                    key={m.id}
                    member={m}
                    cardIndex={idx}
                    selected={selectedId === m.id}
                    onSelect={() => setSelectedId((id) => (id === m.id ? null : m.id))}
                    onRemove={() => openRemoveDialog(m)}
                  />
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không có thành viên phù hợp.
                </p>
              ) : null}
            </>
          )}

          {viewMode === 'cards' && filtered.length > 0 ? (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Hiển thị {filtered.length} / {total} thành viên
              </span>
              <PaginationCardStepper page={page} totalPages={totalPages} onPageChange={() => {}} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Management Modal */}
      {scheduleModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 p-4 animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={closeScheduleModal} />
            <div className="relative flex max-h-[calc(100vh-6rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 animate-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
                <div className="min-w-0">
                  <h2 className="text-xl font-black tracking-tight text-slate-950">
                    {isCreatingDeadlineOnly
                      ? editingScheduleId
                        ? 'CẬP NHẬT HẠN NỘP BÀI PHẢN TƯ'
                        : 'TẠO HẠN NỘP BÀI PHẢN TƯ'
                      : editingScheduleId
                        ? 'CẬP NHẬT BUỔI HỌC'
                        : 'THÊM BUỔI HỌC MỚI'}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {isCreatingDeadlineOnly
                      ? 'Thiết lập hạn nộp bài cho học viên theo lộ trình học'
                      : 'Thông tin chi tiết buổi đào tạo trực tiếp; có thể lưu ngay cả khi chưa chọn học phần'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 rounded-xl p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={closeScheduleModal}
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-h-0 overflow-y-auto bg-slate-50/70 px-6 py-5">
                <Form {...scheduleForm}>
                  <form
                    className="space-y-5"
                    onSubmit={scheduleForm.handleSubmit((vals) => {
                      const startTime = joinTimeHm(vals.startHour, vals.startMinute)
                      const endTime = joinTimeHm(vals.endHour, vals.endMinute)
                      const roadmapItemDeadlines: Record<string, string> = {}
                      if (isCreatingDeadlineOnly) {
                        if (vals.endDateIso && vals.endDateIso < vals.dateIso) {
                          toast.error('Ngày kết thúc không được trước ngày bắt đầu.')
                          return
                        }
                        const deadlineDateStr = vals.endDateIso || vals.dateIso
                        const defaultDl = `${deadlineDateStr}T${endTime}:00`
                        const dlIso = new Date(defaultDl).toISOString()
                        for (const itemId of vals.roadmapItemIds) {
                          roadmapItemDeadlines[itemId] = dlIso
                        }
                      }
                      const isKnowledgeWork = data?.isKnowledgeWork !== false
                      const payload = {
                        dateIso: vals.dateIso,
                        startTime,
                        endTime,
                        topic: vals.topic.trim() || 'Buổi học',
                        location: vals.location.trim() || null,
                        roadmapItemIds: isKnowledgeWork ? vals.roadmapItemIds : [],
                        roadmapItemDeadlines: isKnowledgeWork ? roadmapItemDeadlines : {},
                        materialRef: isKnowledgeWork ? null : vals.materialRef?.trim() || null,
                        note: (vals as any).note?.trim() || null,
                        examQuestions: {
                          ...((schedules.find((x) => x.id === editingScheduleId)
                            ?.examQuestions as any) || {}),
                          gradingType: (vals as any).gradingType || 'direct',
                        },
                      }
                      if (startTime >= endTime) {
                        toast.error('Giờ kết thúc phải sau giờ bắt đầu.')
                        return
                      }
                      if (
                        isKnowledgeWork &&
                        vals.roadmapItemIds.length === 0 &&
                        !vals.topic.trim()
                      ) {
                        // để backend tự gán tiêu đề mặc định
                      }
                      if (!isKnowledgeWork && !vals.topic.trim()) {
                        toast.error('Vui lòng nhập bài học ngày hôm đó.')
                        return
                      }
                      const overlap = findOverlappingSchedule(schedules, payload, editingScheduleId)
                      if (overlap) {
                        toast.error(
                          `Buổi học bị trùng với "${overlap.topic}" (${overlap.startTime} - ${overlap.endTime}).`
                        )
                        return
                      }
                      if (editingScheduleId) {
                        updateSchedule.mutate(
                          { scheduleId: editingScheduleId, input: payload },
                          {
                            onSuccess: () => {
                              closeScheduleModal()
                              toast.success('Đã cập nhật buổi học')
                            },
                          }
                        )
                      } else {
                        createSchedule.mutate(payload, {
                          onSuccess: () => {
                            closeScheduleModal()
                            toast.success('Đã thêm buổi học mới')
                          },
                        })
                      }
                    })}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <DateController
                          control={scheduleForm.control}
                          name="dateIso"
                          label={isCreatingDeadlineOnly ? 'Từ ngày' : 'Ngày học'}
                          required
                          datePickerClassName="h-11 rounded-xl border-slate-200 bg-white focus:ring-primary/10"
                        />
                        {isCreatingDeadlineOnly && (
                          <DateController
                            control={scheduleForm.control}
                            name="endDateIso"
                            label="Đến ngày"
                            required
                            datePickerClassName="h-11 rounded-xl border-slate-200 bg-white focus:ring-primary/10"
                          />
                        )}
                        <InputController
                          control={scheduleForm.control}
                          name="location"
                          label="Địa điểm / Phòng"
                          placeholder="VD: Phòng họp A, Zoom..."
                          inputClassName="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-primary/10"
                        />
                        {(!(data?.isKnowledgeWork !== false) ||
                          isCreatingDeadlineOnly ||
                          selectedRoadmapItemIds.length === 0) && (
                          <InputController
                            control={scheduleForm.control}
                            name="topic"
                            label="Bài học ngày hôm đó / Chủ đề"
                            required
                            placeholder="VD: Hạn nộp bài phản tư..."
                            inputClassName="h-11 rounded-xl border-slate-200 bg-white focus-visible:ring-primary/10"
                          />
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="space-y-2 lg:col-span-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Hình thức chấm điểm
                          </label>
                          <Controller
                            control={scheduleForm.control}
                            name="gradingType"
                            render={({ field }) => (
                              <Select
                                value={field.value || 'direct'}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white focus:ring-primary/10 font-bold">
                                  <SelectValue placeholder="Chọn hình thức chấm điểm" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 p-1 shadow-2xl">
                                  <SelectItem
                                    value="direct"
                                    className="rounded-lg py-2 font-bold text-slate-700"
                                  >
                                    Chấm điểm trực tiếp (0-100)
                                  </SelectItem>
                                  <SelectItem
                                    value="rubric_reading"
                                    className="rounded-lg py-2 font-bold text-slate-700"
                                  >
                                    Chấm theo rubric Đọc sách (Chưa đạt, Đạt, Tốt)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      <div className="mt-5 space-y-2">
                        <TextareaController
                          control={scheduleForm.control}
                          name="note"
                          label="Ghi chú"
                          placeholder="Nhập ghi chú cho hạn nộp..."
                          rows={6}
                          textareaClassName="rounded-xl border-slate-200 bg-white focus-visible:ring-primary/10 font-medium"
                        />
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {isCreatingDeadlineOnly ? 'Khung giờ mở nộp' : 'Thời gian bắt đầu'}
                          </label>
                          <div className="flex items-center gap-2">
                            <InputController
                              control={scheduleForm.control}
                              name="startHour"
                              label="Giờ"
                              labelClassName="sr-only"
                              type="number"
                              className="w-20"
                              inputClassName="h-11 rounded-xl border-slate-200 bg-white text-center font-bold"
                            />
                            <span className="font-bold text-slate-300">:</span>
                            <InputController
                              control={scheduleForm.control}
                              name="startMinute"
                              label="Phút"
                              labelClassName="sr-only"
                              type="number"
                              className="w-20"
                              inputClassName="h-11 rounded-xl border-slate-200 bg-white text-center font-bold"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                              {isCreatingDeadlineOnly ? 'Khung giờ đóng nộp' : 'Thời gian kết thúc'}
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <InputController
                              control={scheduleForm.control}
                              name="endHour"
                              label="Giờ"
                              labelClassName="sr-only"
                              type="number"
                              className="w-20"
                              inputClassName="h-11 rounded-xl border-slate-200 bg-white text-center font-bold"
                            />
                            <span className="font-bold text-slate-300">:</span>
                            <InputController
                              control={scheduleForm.control}
                              name="endMinute"
                              label="Phút"
                              labelClassName="sr-only"
                              type="number"
                              className="w-20"
                              inputClassName="h-11 rounded-xl border-slate-200 bg-white text-center font-bold"
                            />
                          </div>
                        </div>
                        {isCreatingDeadlineOnly && selectedRoadmapDuplicateCounts.length > 0
                          ? selectedRoadmapDuplicateCounts.map((entry) => (
                              <Badge
                                key={entry.itemId}
                                variant="outline"
                                className="rounded-lg border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                                title={entry.objective}
                              >
                                {entry.objective}: Lần {entry.selectionNumber}
                              </Badge>
                            ))
                          : null}
                      </div>
                    </div>

                    {data?.isKnowledgeWork !== false && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Học phần trong lộ trình
                          </label>
                          <span className="text-xs font-bold text-primary">
                            Đã chọn {selectedRoadmapItemIds.length} học phần
                          </span>
                        </div>
                        <div className="mt-3 max-h-64 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {roadmapItemsByTopic.length === 0 ? (
                            <p className="text-sm font-semibold text-slate-400">
                              Chưa có học phần phù hợp với cấp của lớp này.
                            </p>
                          ) : (
                            roadmapItemsByTopic.map(([topic, items]) => (
                              <div key={topic} className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                                  {topic}
                                </p>
                                <div className="space-y-2">
                                  {items.map((item) => {
                                    const checked = selectedRoadmapItemIds.includes(item.id)
                                    const requiresReflection = allowsReflectionSubmission(
                                      item.assessment
                                    )
                                    return (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          'flex flex-col gap-3 rounded-xl border bg-white p-3 text-sm transition-colors md:flex-row md:items-center md:justify-between',
                                          checked
                                            ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/10'
                                            : 'border-slate-100 hover:border-primary/20'
                                        )}
                                      >
                                        <label className="flex cursor-pointer items-start gap-3 flex-1 min-w-0">
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(value) =>
                                              toggleRoadmapItem(item.id, value === true)
                                            }
                                            className="mt-0.5"
                                          />
                                          <span className="min-w-0">
                                            <span className="block font-bold text-slate-900">
                                              {item.objective}
                                            </span>
                                            <span className="mt-1 block text-xs font-semibold text-slate-400">
                                              {item.assessment || 'Chưa có hình thức đánh giá'}
                                            </span>
                                          </span>
                                        </label>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100"
                        onClick={closeScheduleModal}
                      >
                        HỦY BỎ
                      </Button>
                      <Button
                        type="submit"
                        className="h-10 rounded-xl px-7 font-bold cursor-pointer"
                        loading={createSchedule.isPending || updateSchedule.isPending}
                      >
                        {isCreatingDeadlineOnly
                          ? 'LƯU HẠN NỘP'
                          : editingScheduleId
                            ? 'CẬP NHẬT'
                            : 'LƯU BUỔI HỌC'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Evaluation Modal */}
      {evalTarget && (
        <SessionEvaluationModal
          open={evalModalOpen}
          onOpenChange={setEvalModalOpen}
          classId={classId}
          scheduleId={activeScheduleId!}
          userId={evalTarget.userId}
          userName={evalTarget.userName}
        />
      )}

      {/* View All Evaluations Modal for Teachers */}
      <ViewEvaluationsModal
        open={viewEvalModalOpen}
        onOpenChange={setViewEvalModalOpen}
        scheduleId={activeScheduleId || ''}
        sessionTitle={selectedSchedule?.topic || 'Buổi học'}
      />

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removeClassMember.isPending) {
            setRemoveTarget(null)
            setRemoveReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removeTarget?.isMakeup ? 'Xóa học viên học bù?' : 'Xóa học viên khỏi lớp?'}
            </DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Học viên "${removeTarget.name}" sẽ bị xóa và nhận email thông báo kèm lý do. Lịch sử điểm danh và chấm bài vẫn được giữ lại.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="remove-reason" className="text-sm font-semibold text-foreground">
              Lý do xóa <span className="text-destructive">*</span>
            </label>
            <Input
              id="remove-reason"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Nhập lý do gửi cho học viên..."
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRemoveTarget(null)
                setRemoveReason('')
              }}
              disabled={removeClassMember.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={removeClassMember.isPending}
              onClick={() => {
                const reason = removeReason.trim()
                if (!reason) {
                  toast.error('Vui lòng nhập lý do xóa')
                  return
                }
                if (!removeTarget) return
                removeClassMember.mutate(
                  {
                    userId: removeTarget.id,
                    reason,
                    isMakeup: removeTarget.isMakeup,
                  },
                  {
                    onSuccess: () => {
                      setRemoveTarget(null)
                      setRemoveReason('')
                    },
                  }
                )
              }}
            >
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Roadmap Modal */}
      <Dialog open={roadmapModalOpen} onOpenChange={setRoadmapModalOpen}>
        <DialogContent className="max-w-2xl border-0 p-0 sm:rounded-[32px] overflow-hidden">
          <Form {...roadmapForm}>
            <form
              onSubmit={roadmapForm.handleSubmit((values) => {
                createRoadmapItem.mutate(values, {
                  onSuccess: () => {
                    setRoadmapModalOpen(false)
                    roadmapForm.reset()
                  },
                })
              })}
            >
              <div className="bg-[#006C49] px-8 py-6 text-white">
                <DialogTitle className="text-2xl text-white">Thêm Lộ Trình Riêng</DialogTitle>
                <DialogDescription className="text-white mt-2 font-medium">
                  Tạo lộ trình học tập và tài liệu dành riêng cho lớp này
                </DialogDescription>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-8">
                <div className="space-y-6">
                  <InputController
                    control={roadmapForm.control}
                    name="topic"
                    label="Chủ đề (Bắt buộc)"
                    placeholder="VD: Sao 1, Sao 2, Kỹ năng mềm..."
                  />
                  <InputController
                    control={roadmapForm.control}
                    name="objective"
                    label="Mục tiêu / Học phần (Bắt buộc)"
                    placeholder="VD: Phản tư sách, Đào tạo hội nhập..."
                  />
                  <InputController
                    control={roadmapForm.control}
                    name="materialRef"
                    label="Tài liệu đính kèm (Link)"
                    placeholder="VD: https://docs.google.com/..."
                  />
                  <InputController
                    control={roadmapForm.control}
                    name="assessment"
                    label="Hình thức đánh giá"
                    placeholder="VD: Trắc nghiệm, Phản tư, Thực hành..."
                  />
                  <InputController
                    control={roadmapForm.control}
                    name="trainer"
                    label="Người phụ trách"
                    placeholder="VD: Nguyễn Văn A..."
                  />
                </div>
              </div>

              <DialogFooter className="bg-slate-50 px-8 py-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRoadmapModalOpen(false)}
                  className="h-12 rounded-xl px-8 font-bold"
                  disabled={createRoadmapItem.isPending}
                >
                  HỦY BỎ
                </Button>
                <Button
                  type="submit"
                  className="h-12 rounded-xl px-8 font-bold cursor-pointer"
                  disabled={createRoadmapItem.isPending}
                >
                  {createRoadmapItem.isPending ? 'ĐANG LƯU...' : 'LƯU LỘ TRÌNH'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
