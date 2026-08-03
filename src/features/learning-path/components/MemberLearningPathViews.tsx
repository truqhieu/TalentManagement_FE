import { DialogCustom } from '@/components/shared/DialogCustom/DialogCustom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { DateController } from '@/components/ui/form-controllers'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSubmitExam, useWithdrawExam } from '@/features/exam/hooks'
import {
  useAvailableLearningClasses,
  useMyEnrolledClass,
  useRegisterLearningClass,
  useRegisterMakeupSchedule,
  useSendFeedback,
  useSubmitEvidence,
  useWithdrawEvidence,
} from '@/features/learning-path/hooks'
import type { MeEnrolledClass, MeEnrolledClassSchedule } from '@/features/learning-path/schemas'
import { SessionEvaluationModal } from '@/features/teacher/components/SessionEvaluationModal'
import { apiClient, getApiErrorMessage } from '@/lib/axios'
import { cn, getFileViewerUrl } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  Edit3,
  Eye,
  FileText,
  Loader2,
  School,
  Send,
  Sparkles,
  Star,
  Upload,
  X,
} from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  contentWidth = 'default',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  contentWidth?: 'default' | 'wide'
}) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="presentation"
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-0 h-full w-full rounded-none border-0 bg-black/45 p-0 backdrop-blur-[2px] hover:bg-black/50"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative z-[1] flex max-h-[min(92vh,860px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-[var(--shadow-card)] sm:rounded-2xl',
          contentWidth === 'wide' ? 'sm:max-w-2xl' : 'sm:max-w-xl'
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg font-bold text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 hover:bg-muted"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
          >
            <X className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function formatDateIsoVi(dateIso: string): string {
  const parts = dateIso.split('-').map((x) => Number.parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dateIso
  const y = parts[0]!
  const mo = parts[1]!
  const d = parts[2]!
  const dt = new Date(y, mo - 1, d)
  return dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function classStatusUi(status: MeEnrolledClass['status']): { label: string; badgeClass: string } {
  if (status === 'closed')
    return { label: 'Đã ngừng', badgeClass: 'bg-muted text-muted-foreground' }
  return { label: 'Đang hoạt động', badgeClass: 'bg-emerald-100 text-emerald-900' }
}

function MemberScheduleTableSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-[2rem]" />
      <Skeleton className="h-96 w-full rounded-[2rem]" />
    </div>
  )
}

function AvailableClassesSection({
  currentClassIds = [],
  isOther = false,
}: {
  currentClassIds?: string[]
  isOther?: boolean
}) {
  const { data: classes = [], isLoading } = useAvailableLearningClasses()
  const registerClass = useRegisterLearningClass()

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-[2rem]" />
  }

  const rows = classes.filter((c) => {
    return (
      !currentClassIds.includes(c.id) &&
      (isOther ? c.isKnowledgeWork === false : c.isKnowledgeWork !== false)
    )
  })
  if (!rows.length) return null
  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.04)]">
      <div className="border-b border-slate-50 px-8 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
          Đăng ký lớp
        </p>
        <h3 className="text-lg font-black text-slate-900">Lớp đang mở</h3>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <div
            key={c.id}
            className={cn(
              'rounded-2xl border border-slate-100 bg-slate-50/50 p-4',
              c.isNew && 'border-primary/30 bg-primary/5 ring-1 ring-primary/10'
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{c.name}</p>
                <p className="text-xs font-semibold text-slate-500">
                  {c.memberCount}/{c.capacity} học viên · còn {c.seatsLeft} chỗ
                </p>
              </div>
              {c.isNew ? (
                <Badge className="shrink-0 border-0 bg-primary/10 text-primary">
                  <Sparkles className="mr-1 h-3 w-3" /> Mới
                </Badge>
              ) : null}
            </div>
            <p className="mb-3 text-xs font-medium text-slate-500">
              Giáo viên: {c.teacher?.name ?? 'Chưa gán'}
            </p>
            {c.rejectionReason ? (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                Từ chối: {c.rejectionReason}
              </p>
            ) : null}
            <Button
              type="button"
              className="h-10 w-full rounded-xl text-xs font-bold"
              disabled={!c.canRegister || registerClass.isPending}
              onClick={() => registerClass.mutate(c.id)}
            >
              <Send className="mr-2 h-3.5 w-3.5" />
              {c.registrationStatus === 'PENDING'
                ? 'Đang chờ duyệt'
                : c.registrationStatus === 'APPROVED'
                  ? 'Đã tham gia'
                  : c.canRegister
                    ? 'Đăng ký lớp'
                    : 'Không thể đăng ký'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MemberClassesPanel({ isOther = false }: { isOther?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const filterForm = useForm<{ startDate: string; endDate: string }>({
    defaultValues: { startDate: '', endDate: '' },
  })
  const startDate = useWatch({ control: filterForm.control, name: 'startDate' }) ?? ''
  const endDate = useWatch({ control: filterForm.control, name: 'endDate' }) ?? ''
  const deferredStartDate = useDeferredValue(startDate)
  const deferredEndDate = useDeferredValue(endDate)
  const scheduleRange = useMemo(() => {
    const s = deferredStartDate.trim() || undefined
    const e = deferredEndDate.trim() || undefined
    return { startDate: s, endDate: e }
  }, [deferredStartDate, deferredEndDate])
  const hasDateFilter = Boolean(scheduleRange.startDate || scheduleRange.endDate)

  const { data, isLoading, isError } = useMyEnrolledClass(scheduleRange)
  const { data: availableClasses = [], isLoading: isLoadingAvailable } =
    useAvailableLearningClasses()
  const registerMakeup = useRegisterMakeupSchedule()
  const [evalModalOpen, setEvalModalOpen] = useState(false)
  const [evalTarget, setEvalTarget] = useState<{
    classId: string
    scheduleId: string
    topic: string
  } | null>(null)

  const enrolledClasses = (data?.enrolledClasses ?? []).filter((c) =>
    isOther ? c.isKnowledgeWork === false : c.isKnowledgeWork !== false
  )

  const isDeadlineOnly = useCallback((s: any) => {
    return s.location === 'Nộp bài trực tuyến' || s.topic?.includes('Hạn nộp')
  }, [])
  const getReflectionTasks = (classItem: any) => {
    if (!classItem?.schedules) return []
    const tasks: any[] = []
    classItem.schedules.forEach((s: any) => {
      const isExam = s.isExam || s.location === 'Nộp bài trực tuyến' || s.topic?.includes('Hạn nộp')
      const isDeadlineSlot = s.location === 'Nộp bài trực tuyến' || s.topic?.includes('Hạn nộp')

      if ((s.roadmapItems || []).length > 0) {
        s.roadmapItems.forEach((ri: any) => {
          const normalizedAssessment = (ri.assessment || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .trim()

          const isReflection =
            normalizedAssessment.includes('phan tu') ||
            normalizedAssessment.includes('tu luan') ||
            normalizedAssessment.includes('review')

          const isReflectionTask = isReflection && (isDeadlineSlot || ri.deadline)

          if (isReflectionTask || isExam || isDeadlineSlot) {
            tasks.push({
              ...ri,
              scheduleId: s.id,
              scheduleTopic: s.topic,
              scheduleDateIso: s.dateIso,
              scheduleNote: s.note,
              isExam,
              location: s.location,
              deadline:
                ri.deadline ||
                (s.endTime ? `${s.dateIso}T${s.endTime}:00+07:00` : `${s.dateIso}T23:59:00+07:00`),
            })
          }
        })
      } else {
        if (isExam || isDeadlineSlot) {
          tasks.push({
            id: s.id, // Virtual id: use scheduleId
            objective: s.topic,
            topic: s.topic,
            scheduleId: s.id,
            scheduleTopic: s.topic,
            scheduleDateIso: s.dateIso,
            scheduleNote: s.note,
            isExam: true, // Treat as exam task so it uses submitExam
            deadline: s.endTime
              ? `${s.dateIso}T${s.endTime}:00+07:00`
              : `${s.dateIso}T23:59:00+07:00`,
            submission: s.submission || null,
          })
        }
      }
    })

    const seen = new Set()
    return tasks.filter((t) => {
      const key = `${t.id}_${t.scheduleId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const submitEvidence = useSubmitEvidence()
  const submitExam = useSubmitExam()
  const withdrawExam = useWithdrawExam()
  const withdrawEvidence = useWithdrawEvidence()
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null)
  const [withdrawingTaskId, setWithdrawingTaskId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [feedbackModalOpen, setFeedbackModalOpen] = useState<boolean>(false)
  const sendFeedbackMutation = useSendFeedback()
  const submissionId = useRef<string | null>(null)
  const [feedbackText, setFeedbackText] = useState<string>('')

  const handleWithdraw = useCallback(
    (task: any, classId: string) => {
      const taskUniqueId = `${task.id}_${task.scheduleId}`
      setWithdrawingTaskId(taskUniqueId)
      if (task.isExam) {
        withdrawExam.mutate(
          {
            classId,
            scheduleId: task.scheduleId,
          },
          {
            onSettled: () => {
              setWithdrawingTaskId(null)
            },
          }
        )
      } else {
        withdrawEvidence.mutate(
          {
            itemId: task.id,
          },
          {
            onSettled: () => {
              setWithdrawingTaskId(null)
            },
          }
        )
      }
    },
    [withdrawExam, withdrawEvidence]
  )

  useEffect(() => {
    if (data?.enrolledClass) {
      data.enrolledClass.schedules.forEach((s: MeEnrolledClassSchedule) => {
        s.roadmapItems.forEach((ri: any) => {
          if (ri.submission) {
            submissionId.current = ri.submission.id
          }
        })
      })
    }
  }, [data?.enrolledClass])

  const sendFeedback = useCallback(() => {
    try {
      if (!submissionId.current) return
      sendFeedbackMutation.mutate({
        submissionId: submissionId.current!,
        content: feedbackText,
      })
    } catch (error: unknown) {
      const msg = getApiErrorMessage(error)
      toast.error(`Gửi phản hồi thất bại: ${msg}`)
    } finally {
      setFeedbackModalOpen(false)
      setFeedbackText('')
    }
  }, [sendFeedbackMutation, submissionId, feedbackText])

  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})

  const getStarFromTopic = (topicName: string): string => {
    const match = topicName.match(/Sao\s*(\d+)/i)
    return match && match[1] ? match[1] : '1'
  }

  const handleUploadFile = async (taskUniqueId: string, topic: string, classItem: any) => {
    const file = selectedFiles[taskUniqueId]
    if (!file) {
      toast.error('Vui lòng chọn file trước khi nộp.')
      return
    }

    const classTasks = getReflectionTasks(classItem)
    const task = classTasks.find((t) => `${t.id}_${t.scheduleId}` === taskUniqueId)
    if (!task) return

    setUploadingTaskId(taskUniqueId)

    if (task.isExam) {
      const formData = new FormData()
      formData.append('file', file)

      try {
        const uploadRes = await apiClient.post<{ fileUrl: string; fileName: string }>(
          '/exams/upload-file',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        const { fileUrl, fileName } = uploadRes.data

        submitExam.mutate(
          {
            classId: classItem.id,
            scheduleId: task.scheduleId,
            answers: { fileUrl, fileName },
          },
          {
            onSuccess: () => {
              toast.success('Đã nộp bài thi thành công!')
              setSelectedFiles((prev) => ({ ...prev, [taskUniqueId]: null }))
              if (fileRefs.current[taskUniqueId]) {
                fileRefs.current[taskUniqueId]!.value = ''
              }
              void queryClient.invalidateQueries({ queryKey: ['learning'] })
            },
            onError: (_err) => {
              toast.error('Gửi bài thi thất bại.')
            },
            onSettled: () => {
              setUploadingTaskId(null)
            },
          }
        )
      } catch (err) {
        toast.error('Tải file lên thất bại.')
        setUploadingTaskId(null)
      }
    } else {
      const starId = getStarFromTopic(topic)
      const levelId = classItem.levelTo

      submitEvidence.mutate(
        {
          levelId,
          starId,
          itemId: task.id,
          file,
          submissionType: 'FILE',
        },
        {
          onSuccess: () => {
            setSelectedFiles((prev) => ({ ...prev, [taskUniqueId]: null }))
            if (fileRefs.current[taskUniqueId]) {
              fileRefs.current[taskUniqueId]!.value = ''
            }
            void queryClient.invalidateQueries({ queryKey: ['learning'] })
          },
          onSettled: () => {
            setUploadingTaskId(null)
          },
        }
      )
    }
  }

  const [activeMembersClass, setActiveMembersClass] = useState<any | null>(null)

  if (isLoading) {
    return <MemberScheduleTableSkeleton />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-destructive/20 bg-destructive/5 py-12 text-center">
        <p className="text-sm font-bold text-destructive">Không tải được dữ liệu lớp học</p>
        <p className="mt-1 text-xs text-destructive/60">
          Vui lòng kiểm tra lại kết nối hoặc thử lại sau.
        </p>
      </div>
    )
  }

  if (enrolledClasses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-100">
            <School className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-500">Bạn chưa được xếp vào lớp nào</p>
          <p className="mt-1 text-xs text-slate-400">
            Khi quản lý gán lớp, thông tin sẽ hiển thị tại đây.
          </p>
        </div>
        <AvailableClassesSection isOther={isOther} />
      </div>
    )
  }

  const getMakeupCandidates = (requiredItems: Array<{ id: string }>, currentClassId: string) => {
    if (requiredItems.length === 0) return []
    const requiredIds = requiredItems.map((item) => item.id)
    const makeupCandidateClasses = availableClasses.filter(
      (c) => c.id !== currentClassId && c.seatsLeft > 0
    )
    return makeupCandidateClasses.flatMap((c) =>
      c.schedules
        .filter((s) => {
          const targetIds = new Set((s.roadmapItems ?? []).map((item) => item.id))
          return requiredIds.every((id) => targetIds.has(id))
        })
        .map((s) => ({ ...c, schedules: [s] }))
    )
  }

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white/60 p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_24px_-8px_rgba(var(--primary-rgb),0.5)]">
              <Calendar className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Lịch học & Phản hồi
              </h2>
              <p className="text-sm font-bold text-slate-500/80">
                Theo dõi lịch đào tạo, điểm danh và đánh giá chất lượng buổi học
              </p>
            </div>
          </div>

          <Form {...filterForm}>
            <div className="flex flex-wrap items-center gap-3">
              <DateController
                control={filterForm.control}
                name="startDate"
                label=""
                placeholder="Từ ngày"
                datePickerClassName="h-10 w-[140px] rounded-xl border-slate-200 bg-white text-xs font-bold shadow-sm"
              />
              <DateController
                control={filterForm.control}
                name="endDate"
                label=""
                placeholder="Đến ngày"
                datePickerClassName="h-10 w-[140px] rounded-xl border-slate-200 bg-white text-xs font-bold shadow-sm"
              />
              {hasDateFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                  onClick={() => filterForm.reset({ startDate: '', endDate: '' })}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Form>
        </div>
      </div>

      {enrolledClasses.map((classItem) => {
        const classReflectionTasks = getReflectionTasks(classItem)
        const classRegularSchedules = classItem.schedules.filter((s: any) => !isDeadlineOnly(s))
        const classHasAnyMaterials = isOther
          ? classRegularSchedules.some((s: any) => s.materialRef && s.materialRef.trim() !== '')
          : classRegularSchedules.some((s: any) =>
              s.roadmapItems?.some((ri: any) => ri.materialRef && ri.materialRef.trim() !== '')
            )

        return (
          <div
            key={classItem.id}
            className="space-y-6 rounded-[2.5rem] border border-slate-200/60 bg-white/40 p-8 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-1 bg-primary rounded-full" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
                    Đang tham gia
                  </p>
                  <p className="text-xl font-black text-slate-900">{classItem.name}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-2xl border-slate-200 bg-white px-6 font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-primary"
                  onClick={() => setActiveMembersClass(classItem)}
                >
                  <Eye className="mr-2 h-4 w-4" /> Danh sách lớp
                </Button>
              </div>
            </div>

            {classItem.makeups.length > 0 && (
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                  Buổi cần học lại (Lớp: {classItem.name})
                </p>
                <div className="mt-3 space-y-3">
                  {classItem.makeups.map((m: any) => {
                    const candidates = getMakeupCandidates(
                      m.originalRoadmapItems ?? [],
                      classItem.id
                    )
                    return (
                      <div key={m.id} className="rounded-2xl bg-white p-4 ring-1 ring-amber-100">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-900">{m.originalTopic}</p>
                            {m.originalRoadmapItems?.length ? (
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {m.originalRoadmapItems
                                  .map((item: any) => item.objective)
                                  .join(', ')}
                              </p>
                            ) : null}
                            <p className="text-xs font-semibold text-amber-700">
                              {m.status === 'COMPLETED' && m.makeupSchedule
                                ? `Đã học bù: ${m.makeupClassName} · ${m.makeupSchedule.dateIso} ${m.makeupSchedule.startTime}`
                                : m.status === 'REGISTERED' && m.makeupSchedule
                                  ? `Đã đăng ký học bù: ${m.makeupClassName} · ${m.makeupSchedule.dateIso} ${m.makeupSchedule.startTime}`
                                  : 'Bạn đã vắng buổi này và cần học bù.'}
                            </p>
                          </div>
                          {m.status === 'COMPLETED' && m.makeupClassId && m.makeupScheduleId ? (
                            <Button
                              type="button"
                              size="sm"
                              className={cn(
                                'rounded-xl text-xs font-bold',
                                m.isEvaluated
                                  ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                                  : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                              )}
                              onClick={() => {
                                setEvalTarget({
                                  classId: m.makeupClassId!,
                                  scheduleId: m.makeupScheduleId!,
                                  topic: m.originalTopic,
                                })
                                setEvalModalOpen(true)
                              }}
                            >
                              {m.isEvaluated ? (
                                <>
                                  <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Sửa đánh giá học bù
                                </>
                              ) : (
                                <>
                                  <Star className="mr-1.5 h-3.5 w-3.5" /> Đánh giá buổi học bù
                                </>
                              )}
                            </Button>
                          ) : m.status === 'PENDING' ? (
                            <div className="flex flex-wrap gap-2">
                              {candidates.length ? (
                                candidates.map((c) => {
                                  const s = c.schedules[0]
                                  if (!s) return null
                                  return (
                                    <Button
                                      key={`${c.id}-${s.id}`}
                                      type="button"
                                      size="sm"
                                      className="rounded-xl text-xs font-bold"
                                      disabled={registerMakeup.isPending}
                                      onClick={() => registerMakeup.mutate(s.id)}
                                    >
                                      Học bù {c.name} · {s.dateIso}
                                    </Button>
                                  )
                                })
                              ) : isLoadingAvailable ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Đang tải lớp học bù…
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  Chưa có lớp khác còn chỗ bao phủ đủ học phần cần học bù.
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {classReflectionTasks.length > 0 && (
              <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.04)]">
                <div className="border-b border-slate-50 pb-5 mb-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                    Nhiệm vụ lộ trình (Lớp: {classItem.name})
                  </p>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    Lịch nộp phản tư & Bài thi
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    Danh sách các học phần yêu cầu viết phản tư hoặc nộp bài thi cùng thời hạn do
                    giảng viên thiết lập.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {classReflectionTasks.map((task: any) => {
                    const taskUniqueId = `${task.id}_${task.scheduleId}`
                    const isOverdue = task.deadline ? new Date() > new Date(task.deadline) : false
                    const hasSubmission = !!task.submission
                    const isAccepted = task.submission?.status === 'ACCEPTED'
                    const isRejected = task.submission?.status === 'REJECTED'
                    const isPending = task.submission?.status === 'PENDING'

                    const file = selectedFiles[taskUniqueId]
                    const isUploading = uploadingTaskId === taskUniqueId

                    return (
                      <div
                        key={taskUniqueId}
                        className={cn(
                          'flex flex-col justify-between rounded-3xl border p-5 transition-all bg-slate-50/50 hover:bg-white hover:shadow-lg hover:shadow-slate-100',
                          isAccepted
                            ? 'border-emerald-100 bg-emerald-50/10'
                            : isRejected
                              ? 'border-rose-100 bg-rose-50/10'
                              : isPending
                                ? 'border-amber-100 bg-amber-50/10'
                                : 'border-slate-100'
                        )}
                      >
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md',
                                isAccepted
                                  ? 'bg-emerald-500 shadow-emerald-500/20'
                                  : isRejected
                                    ? 'bg-rose-500 shadow-rose-500/20'
                                    : isPending
                                      ? 'bg-amber-500 shadow-amber-500/20'
                                      : 'bg-primary shadow-primary/20'
                              )}
                            >
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="font-extrabold text-slate-950 text-base leading-snug truncate"
                                title={task.scheduleTopic}
                              >
                                {task.scheduleTopic}
                              </p>
                              {task.id !== task.scheduleId && task.objective && (
                                <p
                                  className="text-xs font-bold text-slate-700 mt-1 truncate"
                                  title={task.objective}
                                >
                                  {task.objective}
                                </p>
                              )}
                              {task.topic && (
                                <p
                                  className="text-xs font-semibold text-slate-400 mt-0.5 truncate"
                                  title={task.topic}
                                >
                                  Chủ đề: {task.topic}
                                </p>
                              )}
                              <p className="text-xs font-semibold text-slate-500 mt-1 truncate">
                                {task.isExam || task.location === 'Nộp bài trực tuyến'
                                  ? `Thời gian mở nộp: ${task.scheduleDateIso}`
                                  : `Ngày học: ${task.scheduleDateIso}`}
                              </p>
                              {task.scheduleNote && (
                                <div className="mt-3 rounded-2xl bg-slate-100/80 p-3 text-xs font-medium text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-200/40 text-left">
                                  <p className="font-extrabold text-slate-700 mb-1">
                                    Ghi chú / Câu hỏi gợi ý:
                                  </p>
                                  {task.scheduleNote}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-100/80 pt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Hạn nộp
                              </span>
                              {task.deadline ? (
                                <span
                                  className={cn(
                                    'text-xs font-black',
                                    isOverdue && !hasSubmission ? 'text-rose-600' : 'text-slate-700'
                                  )}
                                >
                                  {new Date(task.deadline).toLocaleString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 italic">
                                  Chưa thiết lập hạn nộp
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Trạng thái
                              </span>
                              {isAccepted ? (
                                <Badge className="border-0 bg-emerald-500 text-white font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 shadow-sm">
                                  Đạt {task.submission.score ? `(${task.submission.score}đ)` : ''}
                                </Badge>
                              ) : isRejected ? (
                                <Badge className="border-0 bg-rose-500 text-white font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 shadow-sm">
                                  Thi lại{' '}
                                  {task.submission.score ? `(${task.submission.score}đ)` : ''}
                                </Badge>
                              ) : isPending ? (
                                <Badge className="border-0 bg-amber-500 text-white font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5 shadow-sm">
                                  Chờ chấm
                                </Badge>
                              ) : (
                                <Badge className="border-0 bg-slate-200 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] px-2 py-0.5">
                                  Chưa nộp
                                </Badge>
                              )}
                            </div>
                          </div>

                          {hasSubmission && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="rounded-2xl bg-white p-3 border border-slate-100/50 space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span className="font-bold text-slate-700 truncate">
                                    File: {task.submission.fileName}
                                  </span>
                                  {task.submission.fileRef && (
                                    <a
                                      href={getFileViewerUrl(task.submission.fileRef)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 text-primary hover:underline font-bold text-xs"
                                    >
                                      Xem bài
                                    </a>
                                  )}
                                </div>
                                {task.submission.managerComment && (
                                  <p className="text-slate-500 font-medium border-t border-slate-50 pt-2">
                                    <span className="font-extrabold text-slate-700">
                                      GV nhận xét:
                                    </span>{' '}
                                    {task.submission.managerComment}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="rounded-xl text-xs font-bold cursor-pointer"
                                  onClick={() => {
                                    setFeedbackModalOpen(true)
                                  }}
                                >
                                  Phản hồi
                                </Button>
                                {isPending && !isOverdue && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                    onClick={() => handleWithdraw(task, classItem.id)}
                                    disabled={withdrawingTaskId === taskUniqueId}
                                  >
                                    {withdrawingTaskId === taskUniqueId ? 'Đang huỷ...' : 'Huỷ nộp'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!hasSubmission && !isOverdue && (
                          <div className="mt-5 border-t border-slate-100/80 pt-4 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="file"
                                ref={(el) => {
                                  fileRefs.current[taskUniqueId] = el
                                }}
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const fileObj = e.target.files?.[0] || null
                                  setSelectedFiles((prev) => ({ ...prev, [taskUniqueId]: fileObj }))
                                }}
                                className="hidden"
                                id={`file-input-${taskUniqueId}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  document.getElementById(`file-input-${taskUniqueId}`)?.click()
                                }
                                className="h-10 rounded-xl px-4 text-xs font-extrabold flex-1 border-slate-200 hover:bg-slate-50 truncate animate-none"
                              >
                                <Upload className="mr-1.5 h-3.5 w-3.5" />
                                {file ? file.name : 'Chọn tài liệu (pdf, docs...)'}
                              </Button>
                              <Button
                                type="button"
                                className="h-10 rounded-xl px-5 text-xs font-extrabold"
                                disabled={!file || isUploading}
                                onClick={() =>
                                  handleUploadFile(taskUniqueId, task.topic, classItem)
                                }
                              >
                                {isUploading ? 'Đang nộp...' : 'Nộp bài'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.04)]">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50/30">
                      <th className="px-8 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Thời gian
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Giảng viên
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Nội dung
                      </th>
                      {classHasAnyMaterials && (
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Tài liệu
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Địa điểm
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Trạng thái
                      </th>
                      <th className="px-8 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {classRegularSchedules.length === 0 ? (
                      <tr>
                        <td
                          colSpan={classHasAnyMaterials ? 7 : 6}
                          className="px-8 py-20 text-center"
                        >
                          <p className="text-sm font-bold text-slate-400">
                            Không tìm thấy lịch học nào
                          </p>
                        </td>
                      </tr>
                    ) : (
                      classRegularSchedules.map((s) => (
                        <tr key={s.id} className="group transition-colors hover:bg-slate-50/50">
                          <td className="px-8 py-5">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-900">
                                {formatDateIsoVi(s.dateIso)}
                              </p>
                              <p className="text-xs font-bold text-slate-400">
                                {s.startTime} - {s.endTime}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-xs font-bold text-slate-700">
                              {classItem.teacherName}
                            </p>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-xs font-bold text-slate-600">{s.topic}</p>
                          </td>
                          {classHasAnyMaterials && (
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                {isOther
                                  ? s.materialRef && s.materialRef.trim() !== ''
                                    ? (() => {
                                        const isLink =
                                          s.materialRef.startsWith('http://') ||
                                          s.materialRef.startsWith('https://')
                                        return isLink ? (
                                          <a
                                            href={s.materialRef}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline break-all block"
                                            title={s.materialRef}
                                          >
                                            {s.materialRef.split('/').pop() || 'Tài liệu'}
                                          </a>
                                        ) : (
                                          <span className="text-xs font-bold text-slate-500">
                                            {s.materialRef}
                                          </span>
                                        )
                                      })()
                                    : null
                                  : s.roadmapItems
                                      ?.filter(
                                        (ri: any) => ri.materialRef && ri.materialRef.trim() !== ''
                                      )
                                      .map((ri: any) => {
                                        const isLink =
                                          ri.materialRef.startsWith('http://') ||
                                          ri.materialRef.startsWith('https://')
                                        return isLink ? (
                                          <a
                                            key={ri.id}
                                            href={ri.materialRef}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline break-all block"
                                            title={ri.materialRef}
                                          >
                                            {ri.materialRef.split('/').pop() || 'Tài liệu'}
                                          </a>
                                        ) : (
                                          <span
                                            key={ri.id}
                                            className="text-xs font-bold text-slate-500"
                                          >
                                            {ri.materialRef}
                                          </span>
                                        )
                                      })}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-5">
                            <p className="text-xs font-bold text-slate-500">
                              {s.location?.trim() || '—'}
                            </p>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <Badge
                              className={cn(
                                'h-7 rounded-lg border-0 px-3 text-xs font-semibold uppercase tracking-tight shadow-sm',
                                s.makeupStatus === 'COMPLETED'
                                  ? 'bg-sky-500/10 text-sky-600'
                                  : s.attendance === 'PRESENT'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : s.attendance === 'LATE'
                                      ? 'bg-amber-500/10 text-amber-600'
                                      : s.attendance === 'ABSENT'
                                        ? 'bg-rose-500/10 text-rose-600'
                                        : 'bg-slate-100 text-slate-400'
                              )}
                            >
                              {s.makeupStatus === 'COMPLETED'
                                ? 'Đã học bù'
                                : s.attendance === 'PRESENT'
                                  ? 'Tham gia'
                                  : s.attendance === 'LATE'
                                    ? 'Đi muộn'
                                    : s.attendance === 'ABSENT'
                                      ? 'Vắng mặt'
                                      : 'Chưa điểm danh'}
                            </Badge>
                          </td>
                          <td className="px-8 py-5 text-right">
                            {s.attendance === 'PRESENT' ? (
                              <Button
                                className={cn(
                                  'h-9 rounded-xl px-5 text-xs font-semibold uppercase tracking-wide shadow-lg transition-all',
                                  s.isEvaluated
                                    ? 'bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-600'
                                    : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                                )}
                                onClick={() => {
                                  setEvalTarget({
                                    classId: classItem.id,
                                    scheduleId: s.id,
                                    topic: s.topic,
                                  })
                                  setEvalModalOpen(true)
                                }}
                              >
                                {s.isEvaluated ? (
                                  <>
                                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Sửa đánh giá
                                  </>
                                ) : (
                                  <>
                                    <Star className="mr-2 h-3.5 w-3.5" /> Đánh giá buổi học
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs font-bold italic text-slate-300">
                                Không khả dụng
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-50 md:hidden">
                {classRegularSchedules.length === 0 ? (
                  <div className="px-4 py-16 text-center">
                    <p className="text-sm font-bold text-slate-400">Không tìm thấy lịch học nào</p>
                  </div>
                ) : (
                  classRegularSchedules.map((s) => (
                    <div key={s.id} className="space-y-3 p-4">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {formatDateIsoVi(s.dateIso)}
                        </p>
                        <p className="text-xs font-bold text-slate-400">
                          {s.startTime} - {s.endTime}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        <span className="font-semibold text-slate-400">Giảng viên: </span>
                        {classItem.teacherName}
                      </p>
                      <p className="break-words text-xs font-bold text-slate-600">{s.topic}</p>
                      <p className="text-xs font-bold text-slate-500">
                        <span className="font-semibold text-slate-400">Địa điểm: </span>
                        {s.location?.trim() || '—'}
                      </p>
                      {((isOther && s.materialRef && s.materialRef.trim() !== '') ||
                        (!isOther &&
                          s.roadmapItems?.some(
                            (ri: any) => ri.materialRef && ri.materialRef.trim() !== ''
                          ))) && (
                        <div className="text-xs font-bold text-slate-700">
                          <span className="font-semibold text-slate-400">Tài liệu: </span>
                          {isOther
                            ? (() => {
                                const isLink =
                                  s.materialRef.startsWith('http://') ||
                                  s.materialRef.startsWith('https://')
                                return isLink ? (
                                  <a
                                    href={s.materialRef}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline break-all inline-block"
                                  >
                                    {s.materialRef.split('/').pop() || 'Tài liệu'}
                                  </a>
                                ) : (
                                  <span className="text-xs font-bold text-slate-500 inline-block">
                                    {s.materialRef}
                                  </span>
                                )
                              })()
                            : s.roadmapItems
                                ?.filter(
                                  (ri: any) => ri.materialRef && ri.materialRef.trim() !== ''
                                )
                                .map((ri: any) => {
                                  const isLink =
                                    ri.materialRef.startsWith('http://') ||
                                    ri.materialRef.startsWith('https://')
                                  return isLink ? (
                                    <a
                                      key={ri.id}
                                      href={ri.materialRef}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline break-all mr-2 inline-block"
                                    >
                                      {ri.materialRef.split('/').pop() || 'Tài liệu'}
                                    </a>
                                  ) : (
                                    <span
                                      key={ri.id}
                                      className="text-xs font-bold text-slate-500 mr-2 inline-block"
                                    >
                                      {ri.materialRef}
                                    </span>
                                  )
                                })}
                        </div>
                      )}
                      <Badge
                        className={cn(
                          'h-7 rounded-lg px-3 text-xs font-semibold uppercase tracking-tight border-0 shadow-sm',
                          s.makeupStatus === 'COMPLETED'
                            ? 'bg-sky-500/10 text-sky-600'
                            : s.attendance === 'PRESENT'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : s.attendance === 'LATE'
                                ? 'bg-amber-500/10 text-amber-600'
                                : s.attendance === 'ABSENT'
                                  ? 'bg-rose-500/10 text-rose-600'
                                  : 'bg-slate-100 text-slate-400'
                        )}
                      >
                        {s.makeupStatus === 'COMPLETED'
                          ? 'Đã học bù'
                          : s.attendance === 'PRESENT'
                            ? 'Tham gia'
                            : s.attendance === 'LATE'
                              ? 'Đi muộn'
                              : s.attendance === 'ABSENT'
                                ? 'Vắng mặt'
                                : 'Chưa điểm danh'}
                      </Badge>

                      <div className="flex justify-end pt-2 border-t border-slate-50">
                        {s.attendance === 'PRESENT' ? (
                          <Button
                            size="sm"
                            className={cn(
                              'rounded-xl text-xs font-semibold uppercase tracking-wider',
                              s.isEvaluated
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-primary text-white hover:bg-primary/95'
                            )}
                            onClick={() => {
                              setEvalTarget({
                                classId: classItem.id,
                                scheduleId: s.id,
                                topic: s.topic,
                              })
                              setEvalModalOpen(true)
                            }}
                          >
                            {s.isEvaluated ? 'Sửa đánh giá' : 'Đánh giá'}
                          </Button>
                        ) : (
                          <span className="text-xs font-bold italic text-slate-300">
                            Không khả dụng
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      })}

      {evalTarget && (
        <SessionEvaluationModal
          open={evalModalOpen}
          onOpenChange={setEvalModalOpen}
          classId={evalTarget.classId}
          scheduleId={evalTarget.scheduleId}
          userId={user?.id || ''}
          userName={user?.name || ''}
        />
      )}

      {activeMembersClass && (
        <Modal
          open={!!activeMembersClass}
          onClose={() => setActiveMembersClass(null)}
          title="Danh sách thành viên"
          description={activeMembersClass.name}
          contentWidth="wide"
        >
          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="divide-y divide-slate-50 md:hidden">
              {(activeMembersClass.members as any[]).map((m) => (
                <div key={m.userId} className="space-y-1 p-4">
                  <p className="text-xs font-bold text-slate-700">{m.name}</p>
                  <p className="break-all text-xs text-slate-500">{m.email}</p>
                  <p className="text-xs font-medium text-slate-500">
                    Vị trí: {m.jobTitle?.trim() || '—'}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Họ tên
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Email
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Vị trí
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activeMembersClass.members as any[]).map((m) => (
                    <TableRow
                      key={m.userId}
                      className="border-slate-50 transition-colors hover:bg-slate-50/50"
                    >
                      <TableCell className="px-4 py-3 text-xs font-bold text-slate-700">
                        {m.name}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">{m.email}</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-medium text-slate-500">
                        {m.jobTitle?.trim() || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Modal>
      )}

      <AvailableClassesSection
        currentClassIds={enrolledClasses.map((c) => c.id)}
        isOther={isOther}
      />
      <DialogCustom
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        title="Phản hồi"
        description="Phản hồi cho bài tập"
      >
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Nhập phản hồi"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
          />
          <Button
            variant="destructive"
            size="sm"
            className="rounded-xl text-xs font-bold cursor-pointer"
            onClick={() => sendFeedback()}
          >
            <Send className="h-4 w-4" /> Gửi
          </Button>
        </div>
      </DialogCustom>
    </div>
  )
}
