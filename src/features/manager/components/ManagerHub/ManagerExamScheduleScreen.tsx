import { BRAND_BTN_SOLID, BRAND_TEXT } from '@/components/shared/brandButtonStyles'
import { OrgUserAvatar } from '@/components/shared/EmployeeAvatar'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { NumberedPaginationBar } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_ESSAY_CRITERIA_WEIGHTS,
  ESSAY_CRITERIA,
  sumCriteriaWeights,
  type EssayCriteriaWeights,
} from '@/features/exam-papers/criteria'
import { useExamPapers } from '@/features/exam-papers/hooks'
import { ClassMembersScoresModal } from '@/features/manager/components/ClassMembersScoresModal'
import {
  useAllExams,
  useCreateClassSchedule,
  useDeleteClassSchedule,
  useManagerClasses,
  useTeacherOptions,
  useUpdateClassSchedule,
} from '@/features/manager/hooks'
import type { managerClassApiSchema } from '@/features/manager/schemas'
import { formatViDate } from '@/lib/date'
import {
  addMinutesToHm,
  examLiveStatus,
  extractCriteriaWeights,
  getExamDurationMinutes,
  mergeScheduleExamQuestions,
} from '@/lib/examScheduleTime'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { BarChart3, Calendar, Loader2, Pencil, Plus, Search, Trash2, UserX, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { ExamManagementTabs } from './ExamManagementTabs'
import { ExamPaperAssignmentFields } from './ExamPaperAssignmentFields'
import { ManagerScreenLayout } from './ManagerScreenLayout'

type ManagerClassRow = z.infer<typeof managerClassApiSchema>

const PAGE_SUBTITLE = 'Quản lý danh sách kỳ thi, người chấm và theo dõi tiến độ thi trực tuyến.'

function toLocalDateInputValue(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function clampTwoDigit(value: string, min: number, max: number): string {
  const onlyDigits = value.replace(/\D/g, '')
  if (!onlyDigits) return pad2(min)
  const parsed = Number.parseInt(onlyDigits, 10)
  if (Number.isNaN(parsed)) return pad2(min)
  return pad2(Math.min(max, Math.max(min, parsed)))
}

function examBadgeForSchedule(e: Parameters<typeof examLiveStatus>[1]) {
  const s = examLiveStatus(Date.now(), e)
  if (s === 'upcoming')
    return {
      label: 'Sắp diễn ra',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      muted: false,
    }
  if (s === 'live')
    return {
      label: 'Đang diễn ra',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      muted: false,
    }
  return {
    label: 'Đã kết thúc',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    muted: true,
  }
}

/** Số dòng mỗi trang của bảng lịch thi (mockup hiển thị "1 - 10 trong N kết quả"). */
const EXAM_PAGE_SIZE = 10

interface ScoresModalTarget {
  classId: string
  scheduleId: string
  className?: string
  topic?: string
}

export function ManagerExamScheduleScreen() {
  const [scoresModal, setScoresModal] = useState<ScoresModalTarget | null>(null)
  const user = useAuthStore((s) => s.user)
  const canManage =
    user?.permissionIds?.includes('manager.classes') || user?.role === 'BOD' || user?.role === 'HR'
  const { data: exams = [], isLoading: loadingExams } = useAllExams()
  const { data: classes = [] } = useManagerClasses()
  const { data: examPapers = [] } = useExamPapers()
  const paperById = useMemo(() => new Map(examPapers.map((p) => [p.id, p])), [examPapers])

  /** `/all-exams` đôi khi không/chậm có examQuestions trong khi GET /classes (schedules nhúng) đã có — gộp để hiển thị đúng duration. */
  const scheduleExamQuestionsFromClasses = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const c of classes as ManagerClassRow[]) {
      for (const s of c.schedules ?? []) {
        if (s?.id && (s as { examQuestions?: unknown }).examQuestions != null) {
          m.set(s.id, (s as { examQuestions: unknown }).examQuestions)
        }
      }
    }
    return m
  }, [classes])

  function toExamTimelineRow(e: (typeof exams)[number]) {
    const cls = (classes as ManagerClassRow[]).find((c) => c.id === e.classId)
    const mergedQs = mergeScheduleExamQuestions(
      mergeScheduleExamQuestions(e.examQuestions, scheduleExamQuestionsFromClasses.get(e.id)),
      cls?.examQuestions ?? null
    )
    return {
      dateIso: e.dateIso,
      startTime: e.startTime,
      endTime: e.endTime,
      examQuestions: mergedQs,
    }
  }
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredExams = useMemo(() => {
    let result = exams

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (e) => e.className.toLowerCase().includes(q) || e.topic.toLowerCase().includes(q)
      )
    }

    if (startDate || endDate) {
      result = result.filter((e) => {
        const examDateStr = e.dateIso.slice(0, 10)
        if (startDate && examDateStr < startDate) return false
        if (endDate && examDateStr > endDate) return false
        return true
      })
    }

    return result
  }, [exams, startDate, endDate, searchQuery])

  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [searchQuery, startDate, endDate])

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / EXAM_PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const rangeFrom = filteredExams.length === 0 ? 0 : (currentPage - 1) * EXAM_PAGE_SIZE + 1
  const rangeTo = Math.min(currentPage * EXAM_PAGE_SIZE, filteredExams.length)
  const pagedExams = useMemo(
    () => filteredExams.slice((currentPage - 1) * EXAM_PAGE_SIZE, currentPage * EXAM_PAGE_SIZE),
    [filteredExams, currentPage]
  )

  const [examModalOpen, setExamModalOpen] = useState(false)
  const [examModalClassId, setExamModalClassId] = useState<string | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([])
  const [durationInput, setDurationInput] = useState('120')
  const [criteriaWeights, setCriteriaWeights] = useState<EssayCriteriaWeights>(
    DEFAULT_ESSAY_CRITERIA_WEIGHTS
  )

  const togglePaper = (paperId: string) => {
    setSelectedPaperIds((prev) =>
      prev.includes(paperId) ? prev.filter((id) => id !== paperId) : [...prev, paperId]
    )
  }

  const examForm = useForm<{
    examDate: string
    examHour: string
    examMinute: string
    examTeacherQuery: string
    topic: string
  }>({
    defaultValues: {
      examDate: '',
      examHour: '08',
      examMinute: '00',
      examTeacherQuery: '',
      topic: 'Kỳ thi năng lực',
    },
  })

  const { setValue: setExamValue, watch: watchExam, reset: resetExamForm } = examForm
  const watchedExamDate = watchExam('examDate')
  const watchedExamHour = watchExam('examHour')
  const watchedExamMinute = watchExam('examMinute')
  const watchedExamTeacherQuery = watchExam('examTeacherQuery')

  const [debouncedExamTeacherQuery, setDebouncedExamTeacherQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedExamTeacherQuery(watchedExamTeacherQuery), 500)
    return () => clearTimeout(t)
  }, [watchedExamTeacherQuery])

  const [examTeacher, setExamTeacher] = useState<{
    userId: string
    name: string
    email: string
  } | null>(null)

  const modalClass = classes.find((c) => c.id === examModalClassId) ?? null
  const isTapSuClass = modalClass?.levelFrom === 'tap_su' && modalClass?.levelTo === 'biet_viec'
  const { data: examTeacherOptions = [], isFetching: fetchingExamTeachers } =
    useTeacherOptions(debouncedExamTeacherQuery)

  const createSchedule = useCreateClassSchedule()
  const updateSchedule = useUpdateClassSchedule()
  const deleteSchedule = useDeleteClassSchedule()

  const openExamModal = (classId?: string, scheduleId?: string) => {
    setExamModalClassId(classId ?? null)
    setEditingScheduleId(scheduleId ?? null)
    setExamModalOpen(true)

    if (scheduleId) {
      const schedule = exams.find((e) => e.id === scheduleId)
      if (schedule) {
        resetExamForm({
          examDate: schedule.dateIso,
          examHour: schedule.startTime.split(':')[0],
          examMinute: schedule.startTime.split(':')[1],
          examTeacherQuery: '', // will set below
          topic: schedule.topic,
        })
        const t = toExamTimelineRow(schedule)
        setDurationInput(String(getExamDurationMinutes(t.examQuestions, t.startTime, t.endTime)))
        setSelectedPaperIds(schedule.examPaperIds ?? [])
        setCriteriaWeights(extractCriteriaWeights(t.examQuestions))
        // Find teacher info if possible
        // (Teacher info might not be in the schedule object, but we have examTeacherUserId)
      }
    } else {
      resetExamForm({
        examDate: '',
        examHour: '08',
        examMinute: '00',
        examTeacherQuery: '',
        topic: 'Kỳ thi năng lực',
      })
      setExamTeacher(null)
      setDurationInput('120')
      setSelectedPaperIds([])
      setCriteriaWeights(DEFAULT_ESSAY_CRITERIA_WEIGHTS)
    }
  }

  const closeExamModal = () => {
    setExamModalOpen(false)
    setExamModalClassId(null)
    setEditingScheduleId(null)
    resetExamForm()
    setExamTeacher(null)
    setDurationInput('120')
    setSelectedPaperIds([])
    setCriteriaWeights(DEFAULT_ESSAY_CRITERIA_WEIGHTS)
  }

  const saveExamSchedule = () => {
    if (!examModalClassId) return
    const { examDate, examHour, examMinute, topic } = examForm.getValues()
    if (!examDate.trim()) {
      toast.error('Vui lòng chọn ngày giờ kỳ thi')
      return
    }

    const finalTeacher = isTapSuClass ? (modalClass?.teacher ?? null) : examTeacher
    if (!finalTeacher && !editingScheduleId) {
      toast.error(
        isTapSuClass
          ? 'Lớp tập sự chưa có giáo viên phụ trách để tự động gán người chấm'
          : 'Vui lòng chọn giáo viên phụ trách (đồng thời là người chấm thi)'
      )
      return
    }

    const durationMin = Number.parseInt(durationInput.trim(), 10)
    if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440) {
      toast.error('Thời gian làm bài phải từ 1 đến 1440 phút')
      return
    }
    const weightTotal = sumCriteriaWeights(criteriaWeights)
    if (weightTotal !== 100) {
      toast.error(`Tổng thang điểm 3 tiêu chí tự luận phải bằng 100% (hiện là ${weightTotal}%)`)
      return
    }
    const startHm = `${examHour}:${examMinute}`

    const payload = {
      dateIso: examDate,
      startTime: startHm,
      endTime: addMinutesToHm(startHm, durationMin),
      topic: topic || 'Kỳ thi năng lực',
      isExam: true,
      examTeacherUserId: finalTeacher?.userId,
      examStatus: 'open',
      durationMinutes: durationMin,
      examPaperIds: selectedPaperIds,
      criteriaWeights,
    }

    if (editingScheduleId) {
      updateSchedule.mutate(
        {
          classId: examModalClassId,
          scheduleId: editingScheduleId,
          input: payload,
        },
        { onSuccess: () => closeExamModal() }
      )
    } else {
      createSchedule.mutate(
        {
          classId: examModalClassId,
          input: payload,
        },
        { onSuccess: () => closeExamModal() }
      )
    }
  }

  return (
    <>
      <ManagerScreenLayout hideHubNav hideToolbar>
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Lịch thi & Người chấm</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ExamManagementTabs active="/manager/exam-schedule" className="mb-0" />
            {canManage && (
              <Button
                type="button"
                className={cn('h-10 gap-2 rounded-lg px-4 text-sm font-semibold', BRAND_BTN_SOLID)}
                onClick={() => openExamModal()}
              >
                <Plus className="h-4 w-4" />
                Tạo lịch thi mới
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              {loadingExams ? (
                <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : (
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tên lớp học hoặc kỳ thi..."
                className="h-12 w-full rounded-lg border-transparent bg-muted/40 pl-10 pr-4 text-sm shadow-none"
              />
            </div>

            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1">
              <span className="shrink-0 text-[11px] font-bold uppercase text-muted-foreground">
                Từ ngày
              </span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                max={endDate || undefined}
                className="h-8 w-full min-w-0 border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0 sm:w-32"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1">
              <span className="shrink-0 text-[11px] font-bold uppercase text-muted-foreground">
                Đến ngày
              </span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                min={startDate || undefined}
                className="h-8 w-full min-w-0 border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0 sm:w-32"
              />
            </div>

            {(startDate || endDate || searchQuery) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Xóa bộ lọc"
                title="Xóa bộ lọc"
                className="h-10 w-10 shrink-0 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                  setSearchQuery('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Mobile: thẻ — đủ nội dung, nút full width */}
          <div className="divide-y divide-border md:hidden">
            {pagedExams.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-muted-foreground">
                <Calendar className="mb-4 h-10 w-10 opacity-20" />
                <p className="font-bold">Không tìm thấy kỳ thi nào</p>
                <p className="mt-1 text-center text-xs">
                  Hãy nhấn &quot;Tạo lịch thi mới&quot; để bắt đầu
                </p>
              </div>
            ) : (
              pagedExams.map((e) => {
                const t = toExamTimelineRow(e)
                const badge = examBadgeForSchedule(t)
                const durMin = getExamDurationMinutes(t.examQuestions, t.startTime, t.endTime)
                const endHm = addMinutesToHm(t.startTime, durMin)
                return (
                  <div key={e.id} className="space-y-3 bg-card p-4">
                    <div className="min-w-0">
                      <p className="text-base font-bold leading-snug text-foreground">
                        {e.className}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{e.topic}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          'text-sm font-black tabular-nums',
                          badge.muted ? 'text-muted-foreground' : 'text-foreground'
                        )}
                      >
                        {formatViDate(e.dateIso)} · {e.startTime} – {endHm}
                        <span className="ml-1 font-bold text-muted-foreground">
                          ({durMin} phút)
                        </span>
                      </p>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Người chấm
                      </p>
                      <p className="mt-0.5 break-words text-sm font-bold text-foreground">
                        {e.examTeacherName || (e.examTeacherUserId ? 'Đã gán' : 'Chưa gán')}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Đề thi
                      </p>
                      {e.examPaperIds?.length ? (
                        <p className={cn('mt-0.5 break-words text-sm font-bold', BRAND_TEXT)}>
                          {e.examPaperIds.length} đề:{' '}
                          {e.examPaperIds.map((id) => paperById.get(id)?.code ?? '—').join(', ')}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm italic text-muted-foreground">Chưa gán đề</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-10 w-full gap-1.5 rounded-lg border-[#006C49]/30 text-xs font-bold hover:bg-[#006C49]/10',
                          BRAND_TEXT
                        )}
                        onClick={() =>
                          setScoresModal({
                            classId: e.classId,
                            scheduleId: e.id,
                            className: e.className,
                            topic: e.topic,
                          })
                        }
                      >
                        <BarChart3 className="h-3.5 w-3.5 shrink-0" />
                        Học viên & Điểm
                      </Button>
                      {canManage ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-10 min-w-0 flex-1 gap-1.5 rounded-lg text-xs font-bold"
                            onClick={() => openExamModal(e.classId, e.id)}
                          >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            Sửa
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label="Xóa lịch thi"
                            className="h-10 shrink-0 rounded-lg px-3 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                            onClick={() => {
                              if (confirm('Bạn có chắc chắn muốn xóa lịch thi này?')) {
                                deleteSchedule.mutate({ classId: e.classId, scheduleId: e.id })
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop: bảng */}
          <div className="hidden md:block md:overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-[30%] max-w-[300px] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tên lớp & Kỳ thi
                  </th>
                  <th className="w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Thời gian
                  </th>
                  <th className="w-[18%] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Người chấm
                  </th>
                  <th className="w-[20%] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Đề thi & Tình trạng
                  </th>
                  <th className="w-[12%] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedExams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Calendar className="mb-4 h-10 w-10 opacity-20" />
                        <p className="font-bold">Không tìm thấy kỳ thi nào</p>
                        <p className="text-xs">Hãy nhấn &quot;Tạo lịch thi mới&quot; để bắt đầu</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedExams.map((e) => {
                    const t = toExamTimelineRow(e)
                    const badge = examBadgeForSchedule(t)
                    const durMin = getExamDurationMinutes(t.examQuestions, t.startTime, t.endTime)
                    const endHm = addMinutesToHm(t.startTime, durMin)
                    const graderName = e.examTeacherName || (e.examTeacherUserId ? 'Đã gán' : null)

                    return (
                      <tr key={e.id} className="transition-colors hover:bg-muted/20">
                        <td className="min-w-0 max-w-[300px] px-4 py-3">
                          <p className="truncate text-sm font-semibold leading-tight text-foreground">
                            {e.className}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.topic}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-medium tabular-nums',
                                badge.muted ? 'text-muted-foreground' : 'text-foreground'
                              )}
                            >
                              {formatViDate(e.dateIso)}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight',
                                badge.className
                              )}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            {e.startTime} – {endHm} ({durMin} phút)
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {graderName ? (
                            <div className="flex items-center gap-2">
                              <OrgUserAvatar
                                name={graderName}
                                className="h-6 w-6 text-[10px] ring-0"
                              />
                              <span className="text-sm font-medium text-foreground">
                                {graderName}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
                              <UserX className="h-4 w-4 shrink-0" />
                              Chưa gán
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {e.examPaperIds?.length ? (
                            <p className={cn('text-sm font-medium', BRAND_TEXT)}>
                              {e.examPaperIds.length} đề:{' '}
                              {e.examPaperIds
                                .map((id) => paperById.get(id)?.code ?? '—')
                                .join(', ')}
                            </p>
                          ) : (
                            <p className="text-sm italic text-muted-foreground">Chưa gán đề</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Học viên & Điểm"
                              title="Học viên & Điểm"
                              className={cn('h-8 w-8 rounded-md hover:bg-[#006C49]/10', BRAND_TEXT)}
                              onClick={() =>
                                setScoresModal({
                                  classId: e.classId,
                                  scheduleId: e.id,
                                  className: e.className,
                                  topic: e.topic,
                                })
                              }
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            {canManage && (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Sửa lịch thi"
                                  title="Sửa"
                                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                                  onClick={() => openExamModal(e.classId, e.id)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Xóa lịch thi"
                                  title="Xóa"
                                  className="h-8 w-8 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                                  onClick={() => {
                                    if (confirm('Bạn có chắc chắn muốn xóa lịch thi này?')) {
                                      deleteSchedule.mutate({
                                        classId: e.classId,
                                        scheduleId: e.id,
                                      })
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredExams.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Hiển thị{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {rangeFrom} - {rangeTo}
                </span>{' '}
                trong{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {filteredExams.length}
                </span>{' '}
                kết quả
              </p>
              <NumberedPaginationBar
                page={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      </ManagerScreenLayout>

      {examModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="max-h-[min(92dvh,900px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {editingScheduleId ? 'Chỉnh sửa lịch thi' : 'Thiết lập kỳ thi mới'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={closeExamModal}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground ml-1">
                    Chọn lớp học
                  </label>
                  <Select
                    value={examModalClassId ?? ''}
                    onValueChange={setExamModalClassId}
                    disabled={!!editingScheduleId}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-border bg-muted/20 font-bold">
                      <SelectValue placeholder="Chọn lớp..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="font-bold">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground ml-1">
                    Tên kỳ thi (Topic)
                  </label>
                  <Input
                    {...examForm.register('topic')}
                    placeholder="Ví dụ: Kỳ thi năng lực đợt 1"
                    className="h-10 w-full rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Ngày thi</label>
                    <DatePicker
                      value={watchedExamDate}
                      onChange={(value) => setExamValue('examDate', value)}
                      min={toLocalDateInputValue(new Date())}
                      className="h-10 w-full rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Giờ thi</label>
                    <div className="flex items-center gap-2 px-3 py-1 bg-muted/20 rounded-xl border border-border h-10">
                      <Input
                        inputMode="numeric"
                        value={watchedExamHour}
                        onChange={(e) =>
                          setExamValue('examHour', clampTwoDigit(e.target.value, 0, 23))
                        }
                        className="h-7 w-8 border-none bg-transparent p-0 text-center font-bold shadow-none focus-visible:ring-0"
                      />
                      <span className="font-bold text-muted-foreground">:</span>
                      <Input
                        inputMode="numeric"
                        value={watchedExamMinute}
                        onChange={(e) =>
                          setExamValue('examMinute', clampTwoDigit(e.target.value, 0, 59))
                        }
                        className="h-7 w-8 border-none bg-transparent p-0 text-center font-bold shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>

                <ExamPaperAssignmentFields
                  durationInput={durationInput}
                  onDurationChange={setDurationInput}
                  selectedPaperIds={selectedPaperIds}
                  onTogglePaper={togglePaper}
                  endTimePreview={
                    watchedExamHour && watchedExamMinute && durationInput
                      ? addMinutesToHm(
                          `${watchedExamHour}:${watchedExamMinute}`,
                          Number.parseInt(durationInput, 10) || 0
                        )
                      : undefined
                  }
                />

                <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-primary">
                      Thang điểm đánh giá tự luận
                    </label>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        sumCriteriaWeights(criteriaWeights) === 100
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      )}
                    >
                      Tổng: {sumCriteriaWeights(criteriaWeights)}%
                      {sumCriteriaWeights(criteriaWeights) !== 100 ? ' — phải bằng 100%' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Áp dụng cho câu tự luận chấm theo tiêu chí (không dùng cho lịch thi đã gán đề
                    ExamPaper — đề đó tự có thang điểm riêng theo từng câu).
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {ESSAY_CRITERIA.map((c) => (
                      <div key={c.id} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-foreground">{c.label}</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={criteriaWeights[c.id]}
                            onChange={(e) =>
                              setCriteriaWeights((prev) => ({
                                ...prev,
                                [c.id]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                              }))
                            }
                            className="h-8 w-20 text-sm"
                          />
                          <span className="text-xs font-bold text-primary">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {!editingScheduleId && (
                  <div
                    className={cn('space-y-1.5', isTapSuClass && 'opacity-50 pointer-events-none')}
                  >
                    <label className="text-xs font-bold text-muted-foreground ml-1">
                      Người chấm thi
                    </label>
                    <div className="search-dropdown-container relative">
                      {isTapSuClass ? (
                        <div className="h-10 w-full rounded-xl bg-amber-50 border border-amber-100 px-3 flex items-center text-xs text-amber-700 font-bold">
                          Tự động gán: {modalClass?.teacher?.name || '—'}
                        </div>
                      ) : (
                        <>
                          <Input
                            value={watchedExamTeacherQuery}
                            onChange={(e) => setExamValue('examTeacherQuery', e.target.value)}
                            placeholder="Tìm kiếm giáo viên..."
                            className="h-10 w-full rounded-xl"
                          />
                          {watchedExamTeacherQuery.trim().length > 0 &&
                            watchedExamTeacherQuery !== examTeacher?.name && (
                              <div className="absolute z-50 mt-2 max-h-48 w-full overflow-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                                {fetchingExamTeachers ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  </div>
                                ) : (
                                  examTeacherOptions.map((opt) => (
                                    <Button
                                      key={opt.userId}
                                      variant="ghost"
                                      className="h-auto w-full flex-col items-start px-3 py-2 text-left hover:bg-primary/5 rounded-lg"
                                      onClick={() => {
                                        setExamTeacher(opt)
                                        setExamValue('examTeacherQuery', opt.name)
                                      }}
                                    >
                                      <span className="font-bold text-xs">{opt.name}</span>
                                      <span className="text-xs opacity-60">{opt.email}</span>
                                    </Button>
                                  ))
                                )}
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-5 border-t">
                <Button variant="ghost" onClick={closeExamModal} className="font-bold text-xs">
                  Hủy
                </Button>
                <Button
                  className={cn('px-6 text-xs font-bold', BRAND_BTN_SOLID)}
                  onClick={saveExamSchedule}
                  disabled={
                    !examModalClassId || createSchedule.isPending || updateSchedule.isPending
                  }
                >
                  {(createSchedule.isPending || updateSchedule.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Xác nhận
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {scoresModal && (
        <ClassMembersScoresModal
          isOpen
          onClose={() => setScoresModal(null)}
          classId={scoresModal.classId}
          scheduleId={scoresModal.scheduleId}
          className={scoresModal.className}
          examTopic={scoresModal.topic}
        />
      )}
    </>
  )
}
