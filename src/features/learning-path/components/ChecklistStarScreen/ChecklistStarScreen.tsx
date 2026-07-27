import { StarEmblem } from '@/components/icons/StarEmblem'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { InputController, TextareaController } from '@/components/ui/form-controllers'
import { Input } from '@/components/ui/input'
import { Skeleton, SkeletonApprovalCardRow } from '@/components/ui/skeleton'
import { useChecklistItem } from '@/features/learning-path/components/ChecklistItem/useChecklistItem'
import {
  useLearningChecklist,
  useMyLearningPath,
  useStarSubmissions,
  useSubmitEvidence,
} from '@/features/learning-path/hooks'
import { CARD_ENTRANCE, CARD_ENTRANCE_HOVER, staggerStyle } from '@/lib/cardMotion'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudUpload,
  ExternalLink,
  Eye,
  Info,
  ListChecks,
  Loader2,
  Lock,
  MessageSquareQuote,
  Paperclip,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

const LEVEL_VI: Record<string, string> = {
  tap_su: 'Tập sự',
  biet_viec: 'Biết việc',
  duoc_viec: 'Được việc',
  dong_gop_ket_qua: 'Đóng góp kết quả',
  tuong: 'Tướng',
}

function rowKind(
  items: { id: string; order: number }[],
  itemId: string,
  checklist: ReturnType<typeof useChecklistItem>
): 'done' | 'current' | 'locked' {
  if (!checklist.isUnlocked(itemId)) return 'locked'
  if (checklist.isCompleted(itemId)) return 'done'
  const next = items.find((i) => checklist.isUnlocked(i.id) && !checklist.isCompleted(i.id))
  return next?.id === itemId ? 'current' : 'locked'
}

function normalizeVietnamese(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function allowsReflectionSubmission(assessment?: string | null) {
  const normalized = normalizeVietnamese(assessment)
  return (
    normalized.includes('phan tu') ||
    normalized.includes('tu luan') ||
    normalized.includes('review')
  )
}

export interface ChecklistStarScreenProps {
  levelId: string
  starId: string
  /** Gắn trong `/learning-path` (member): bỏ nút về hub, không full-bleed âm lề. */
  embedInLearningPath?: boolean
  /** If true, filter roadmap topics by star number parsed from topic name */
  filterByStar?: boolean
  currentStars?: number
}

function BannerStars({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <StarEmblem
          key={i}
          variant={i < filled ? 'filled' : 'muted'}
          className={cn('h-4 w-4', i < filled ? 'opacity-100 drop-shadow-sm' : 'opacity-30')}
        />
      ))}
    </div>
  )
}

function HeroProgressRing({ done, total }: { done: number; total: number }) {
  const t = Math.max(total || 1, 1)
  const pct = Math.min(1, Math.max(0, done / t))
  const r = 20
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-12 w-12 -rotate-90"
      viewBox="0 0 48 48"
      aria-hidden
    >
      <circle
        className="text-white/20"
        cx="24"
        cy="24"
        fill="none"
        r={r}
        stroke="currentColor"
        strokeWidth="4"
      />
      <circle
        className="text-white transition-[stroke-dashoffset] duration-500 ease-out"
        cx="24"
        cy="24"
        fill="none"
        r={r}
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChecklistStarScreen({
  levelId,
  starId,
  embedInLearningPath = false,
  filterByStar = false,
  currentStars = 0,
}: ChecklistStarScreenProps) {
  const navigate = useNavigate()
  const hideSubmissionCard = true
  const { data: myPath, isLoading: isPathLoading } = useMyLearningPath()
  const roadmapTopicsByLevel = useMemo(() => {
    if (!embedInLearningPath || !myPath) return []
    let topics = (myPath.roadmapTopics ?? [])
      .filter((t: any) => t.levelId === levelId)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    // Filter by star number when enabled (e.g. biet_viec Sao 1-6)
    // NOTE: The user now wants to see "toàn bộ lộ trình", so we don't strictly filter OUT other stars,
    // but we might still use starId to highlight or scroll.
    // For now, if embedInLearningPath is true, we show all but mark as locked below.
    if (filterByStar && starId && !embedInLearningPath) {
      const starNum = parseInt(starId) || 1
      topics = topics.filter((t: any) => {
        const match = t.topic.match(/^Sao\s*(\d+)/i)
        if (match) return parseInt(match[1]) === starNum
        return true
      })
    }

    return topics
  }, [embedInLearningPath, myPath, levelId, filterByStar, starId])

  const probationMilestones = useMemo(() => {
    if (!embedInLearningPath || !myPath) return []
    return myPath.milestones
      .filter((m) => m.minCareerLevel === levelId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [embedInLearningPath, myPath, levelId])

  /** Nếu có roadmap topics cho level này, ưu tiên dùng. */
  const useProbationFlow =
    embedInLearningPath && (roadmapTopicsByLevel.length > 0 || probationMilestones.length > 0)
  const { data, isLoading } = useLearningChecklist(levelId, starId, !useProbationFlow)
  const sortedItems = useMemo(() => {
    const arr = [...(data?.items ?? [])]
    return arr.sort((a, b) => a.order - b.order)
  }, [data?.items])
  const completed = data?.completedIds ?? []
  const checklist = useChecklistItem(sortedItems, completed)
  const { data: submissions, isLoading: isLoadingSubmissions } = useStarSubmissions(starId)
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null)
  const lastSubmissionRef = useRef<any>(null)
  if (selectedSubmission) {
    lastSubmissionRef.current = selectedSubmission
  }
  const displaySubmission = selectedSubmission || lastSubmissionRef.current
  const submit = useSubmitEvidence()
  const fileRef = useRef<HTMLInputElement>(null)
  const evidenceForm = useForm<{ note: string; linkUrl: string; textContent: string }>({
    defaultValues: { note: '', linkUrl: '', textContent: '' },
  })
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submissionType, setSubmissionType] = useState<'FILE' | 'LINK' | 'TEXT'>('FILE')
  const [_, startTransition] = useTransition()
  const hasStarProgression = levelId !== 'tap_su'

  const handleToggleTask = useCallback((id: string) => {
    startTransition(() => {
      setExpandedTaskId((prev) => (prev === id ? null : id))
    })
  }, [])

  const handleSelectObjective = useCallback((id: string) => {
    startTransition(() => {
      setSelectedObjectiveId(id)
    })
  }, [])

  const levelName = LEVEL_VI[levelId] ?? levelId
  const total = useProbationFlow
    ? roadmapTopicsByLevel.length || probationMilestones.length
    : sortedItems.length
  const doneCount = useProbationFlow
    ? roadmapTopicsByLevel.length > 0
      ? roadmapTopicsByLevel.filter(
          (topic) =>
            topic.objectives.length > 0 && topic.objectives.every((o) => o.isClassCompleted)
        ).length
      : probationMilestones.filter((m) => m.status === 'done').length
    : sortedItems.filter((i) => checklist.isCompleted(i.id)).length

  const tasks = useMemo(() => {
    if (useProbationFlow && roadmapTopicsByLevel.length > 0) {
      return roadmapTopicsByLevel.map((topic) => {
        const titleRaw = topic.topic.trim()
        const match = titleRaw.match(/^Sao\s*(\d+)/i)
        const topicStar = match && match[1] ? parseInt(match[1]) : 1

        const isDone = topicStar <= currentStars
        const isCurrent = topicStar === currentStars + 1
        return {
          id: topic.id,
          title: titleRaw,
          order: topic.sortOrder,
          description: topic.objectives.map((o) => o.objective).join('\n'),
          completedAt: null, // We don't have per-topic completion date in this simplified view yet
          kind:
            topic.objectives.length > 0 && topic.objectives.every((o) => o.isClassCompleted)
              ? ('done' as const)
              : isDone
                ? ('done' as const)
                : isCurrent
                  ? ('current' as const)
                  : ('locked' as const),
          objectives: topic.objectives,
        }
      })
    }

    if (useProbationFlow) {
      return probationMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        order: m.sortOrder,
        description: m.description,
        completedAt: m.completedAt,
        kind:
          m.status === 'done'
            ? ('done' as const)
            : m.status === 'in_progress'
              ? ('current' as const)
              : ('locked' as const),
        objectives: [],
      }))
    }

    return sortedItems.map((it) => ({
      id: it.id,
      title: it.title,
      order: it.order,
      description: null as string | null,
      completedAt: null as string | null,
      kind: rowKind(sortedItems, it.id, checklist),
      objectives: [],
    }))
  }, [
    useProbationFlow,
    roadmapTopicsByLevel,
    probationMilestones,
    sortedItems,
    checklist,
    currentStars,
  ])

  const currentItem = useProbationFlow
    ? tasks.find((t) => t.kind === 'current')
    : sortedItems.find((i) => checklist.isUnlocked(i.id) && !checklist.isCompleted(i.id))

  const activeTaskId = expandedTaskId ?? currentItem?.id ?? tasks[0]?.id ?? null

  useEffect(() => {
    if (activeTaskId) {
      const task = tasks.find((t) => t.id === activeTaskId)
      const currentSelectedBelongsToActive = task?.objectives?.some(
        (o) => o.id === selectedObjectiveId
      )
      const firstObjectiveId = task?.objectives?.[0]?.id
      if (firstObjectiveId && !currentSelectedBelongsToActive) {
        setSelectedObjectiveId(firstObjectiveId)
      }
    }
  }, [activeTaskId, tasks, selectedObjectiveId])

  const selectedObjective = useMemo(() => {
    if (!selectedObjectiveId) return null
    for (const t of tasks) {
      if (t.objectives) {
        const obj = t.objectives.find((o) => o.id === selectedObjectiveId)
        if (obj) return obj
      }
    }
    return null
  }, [tasks, selectedObjectiveId])
  const selectedObjectiveCanSubmitReflection = selectedObjective
    ? allowsReflectionSubmission(selectedObjective.assessment)
    : false

  const onPickFile = () => fileRef.current?.click()

  const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.mp4']

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (selectedObjective && !selectedObjectiveCanSubmitReflection) {
      toast.error('Học phần này không yêu cầu nộp phản tư.')
      e.target.value = ''
      return
    }

    // Validate extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(
        `Định dạng file ${ext} không được hỗ trợ. Vui lòng nộp: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
      e.target.value = ''
      return
    }

    // Validate size
    const targetItemId = selectedObjective ? selectedObjective.id : currentItem?.id
    if (!targetItemId) return

    setSelectedFile(file)
  }

  const handleUpload = () => {
    if (selectedObjective && !selectedObjectiveCanSubmitReflection) {
      toast.error('Học phần này không yêu cầu nộp phản tư.')
      return
    }

    if (submissionType === 'FILE' && !selectedFile) {
      toast.error('Vui lòng chọn file trước khi nộp')
      return
    }

    const targetItemId = selectedObjective ? selectedObjective.id : currentItem?.id
    if (!targetItemId) return
    const values = evidenceForm.getValues()
    if (submissionType === 'LINK' && !/^https?:\/\/\S+$/i.test(values.linkUrl.trim())) {
      toast.error('Vui lòng nhập link phản tư hợp lệ')
      return
    }
    if (submissionType === 'TEXT' && values.textContent.trim().length < 20) {
      toast.error('Nội dung phản tư cần ít nhất 20 ký tự')
      return
    }

    submit.mutate(
      {
        levelId,
        starId,
        itemId: targetItemId,
        file: selectedFile ?? undefined,
        submissionType,
        linkUrl: values.linkUrl.trim(),
        textContent: values.textContent.trim(),
      },
      {
        onSuccess: () => {
          evidenceForm.reset({ note: '', linkUrl: '', textContent: '' })
          setSelectedFile(null)
          if (fileRef.current) fileRef.current.value = ''
        },
      }
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-app-canvas text-base text-foreground',
        embedInLearningPath ? 'min-h-0' : '-m-5 min-h-[calc(100vh-3rem)] md:-m-6 lg:-m-8'
      )}
    >
      {!embedInLearningPath ? (
        <div className="page-toolbar-gradient">
          <div
            className="pointer-events-none absolute inset-0 opacity-30 motion-safe:animate-[dash-shimmer_10s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{
              background:
                'linear-gradient(110deg, transparent 0%, rgb(79 70 229 / 0.08) 50%, transparent 90%)',
              backgroundSize: '200% 100%',
            }}
          />
          <div className="relative flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap rounded-[10px] border-primary-600/20 bg-white px-3.5 py-2 text-sm font-semibold text-primary-600 shadow-sm hover:bg-primary-50 md:text-base"
              onClick={() =>
                void navigate({
                  to: '/learning-path',
                  search: {
                    levelId: levelId as
                      | 'tap_su'
                      | 'biet_viec'
                      | 'duoc_viec'
                      | 'dong_gop_ket_qua'
                      | 'tuong',
                    starId: Number(starId) || 1,
                  },
                })
              }
            >
              ← Học tập
            </Button>
          </div>
          <span className="relative rounded-full border border-primary-600/15 bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-700">
            Đang học
          </span>
        </div>
      ) : null}

      <div className={cn(embedInLearningPath ? 'min-w-0 px-0 py-1 sm:py-2' : 'page-shell')}>
        {isLoading || (embedInLearningPath && isPathLoading) ? (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div>
                <Skeleton className="mb-2 h-5 w-48 rounded-md" />
                <Skeleton className="mb-4 h-40 w-full max-w-3xl rounded-3xl" />
              </div>
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonApprovalCardRow key={i} />
              ))}
            </div>
            <div className="flex flex-col gap-4 lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <Skeleton className="mb-3 h-10 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold uppercase tracking-wide text-gray-500">{levelName}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
              <span className="font-bold uppercase tracking-wide text-primary-600">
                Toàn bộ lộ trình
              </span>
            </nav>

            <div
              className={cn(
                'relative mb-8 overflow-hidden rounded-3xl bg-[#005236] text-white',
                embedInLearningPath ? 'px-4 py-6 sm:px-6 sm:py-8' : 'px-6 py-8 sm:px-8'
              )}
            >
              <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-2">
                  {hasStarProgression ? (
                    <BannerStars filled={Math.min(doneCount, 5)} total={5} />
                  ) : null}
                  <h1 className="text-[22px] font-extrabold leading-tight tracking-tight">
                    Lộ trình học {levelName}
                  </h1>
                  <p className="max-w-xl text-sm font-medium text-white/80">
                    Bắt đầu hành trình chinh phục kỹ năng chuyên môn tại VCB.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/10 px-6 py-4 backdrop-blur-md">
                  <div className="text-right">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                      Tiến độ
                    </span>
                    <span className="text-[36px] font-bold leading-none tabular-nums text-white">
                      {doneCount}/{total || 5}
                    </span>
                  </div>
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white/20">
                    <ListChecks
                      className="relative z-[1] h-5 w-5 text-white"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <HeroProgressRing done={doneCount} total={total || 5} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div
                className={cn('space-y-4', hideSubmissionCard ? 'lg:col-span-12' : 'lg:col-span-7')}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Danh sách nhiệm vụ</h2>
                  <span className="rounded-full bg-[#006C49]/80 px-3 py-1 text-xs font-semibold text-white">
                    Ấn vào để xem chi tiết
                  </span>
                </div>
                <div className="space-y-4">
                  {tasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      Chưa có nhiệm vụ cho mốc này. Thử tải lại trang; nếu vẫn trống, liên hệ quản
                      lý hoặc đơn vị đào tạo.
                    </p>
                  ) : (
                    <div className="space-y-10">
                      {(hasStarProgression ? [1, 2, 3, 4, 5, 6] : [0]).map((starNum) => {
                        const starTasks = hasStarProgression
                          ? tasks.filter((t) => {
                              const match = t.title?.match(/^Sao\s*(\d+)/i)
                              return match && match[1]
                                ? parseInt(match[1]) === starNum
                                : starNum === 1
                            })
                          : tasks
                        if (starTasks.length === 0) return null

                        const isUnlocked = !hasStarProgression || starNum <= currentStars + 1
                        const isDone = hasStarProgression && starNum <= currentStars

                        return (
                          <div key={hasStarProgression ? starNum : 'level'} className="space-y-4">
                            {hasStarProgression ? (
                              <div className="flex items-center gap-3">
                                <h3
                                  className={cn(
                                    'text-sm font-black uppercase tracking-[0.2em]',
                                    isUnlocked ? 'text-primary-600' : 'text-gray-400'
                                  )}
                                >
                                  {isDone ? '✓ ' : !isUnlocked ? '🔒 ' : '⭐ '}
                                  Sao {starNum}
                                </h3>
                                <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                              </div>
                            ) : null}
                            <div className="space-y-4">
                              {starTasks.map((it, idx) => {
                                const doneDate = it.completedAt
                                  ? new Date(it.completedAt).toLocaleDateString('vi-VN')
                                  : undefined
                                const objectiveDoneCount =
                                  it.objectives?.filter((o) => o.isClassCompleted).length ?? 0
                                const objectiveTotal = it.objectives?.length ?? 0
                                const roadmapSubtitle = objectiveTotal
                                  ? `${objectiveDoneCount}/${objectiveTotal} học phần đã học`
                                  : undefined
                                const taskSubmission = (submissions as any[])?.find((s) => {
                                  if (s.itemId === it.id) return true
                                  return it.objectives?.some((obj) => obj.id === s.itemId)
                                })
                                return (
                                  <div
                                    key={it.id}
                                    className={CARD_ENTRANCE}
                                    style={staggerStyle(idx, 60)}
                                  >
                                    <ChecklistTaskCard
                                      id={it.id}
                                      title={it.title}
                                      kind={it.kind}
                                      expanded={activeTaskId === it.id}
                                      onToggle={handleToggleTask}
                                      objective={
                                        it.description?.trim() ||
                                        'Chưa có objective cho đầu mục này.'
                                      }
                                      objectiveList={it.objectives}
                                      subtitle={
                                        roadmapSubtitle ||
                                        (it.kind === 'done'
                                          ? doneDate
                                            ? `Hoàn thành ${doneDate}`
                                            : 'Đã hoàn thành'
                                          : it.kind === 'current'
                                            ? 'Ấn vào để xem chi tiết'
                                            : hasStarProgression
                                              ? `Mở khóa sau khi hoàn thành Sao ${starNum - 1}`
                                              : 'Chưa mở khóa')
                                      }
                                      primaryAction={
                                        !hideSubmissionCard && it.kind === 'done' && taskSubmission
                                          ? {
                                              label: 'Xem bài nộp',
                                              onClick: () => {
                                                setSelectedSubmission(taskSubmission)
                                              },
                                            }
                                          : !hideSubmissionCard && it.kind === 'current'
                                            ? useProbationFlow
                                              ? undefined
                                              : { label: 'Nộp bằng chứng', onClick: onPickFile }
                                            : undefined
                                      }
                                      selectedObjectiveId={selectedObjectiveId}
                                      onSelectObjective={handleSelectObjective}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {!hideSubmissionCard ? (
                <div className="lg:col-span-5">
                  <div className="sticky top-24 flex flex-col gap-6">
                    {!useProbationFlow && !selectedObjective ? (
                      <div
                        className={cn(
                          'rounded-[12px] bg-white p-6 shadow-lg ring-1 ring-gray-100',
                          CARD_ENTRANCE_HOVER
                        )}
                        style={staggerStyle(0)}
                      >
                        <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
                          <Paperclip
                            className="h-5 w-5 shrink-0 text-primary-600"
                            strokeWidth={2}
                            aria-hidden
                          />
                          Nộp bằng chứng
                        </h3>
                        <Form {...evidenceForm}>
                          <div className="space-y-6">
                            <Button
                              type="button"
                              variant="ghost"
                              className="group h-auto w-full cursor-pointer rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/50 p-8 text-center font-normal normal-case tracking-normal transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={onPickFile}
                              disabled={!currentItem || submit.isPending}
                            >
                              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
                                <CloudUpload
                                  className="h-6 w-6 text-primary-600"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                              </div>
                              <p className="text-sm font-bold text-primary-700">
                                {selectedFile ? `Đã chọn: ${selectedFile.name}` : 'Tải tệp lên'}
                              </p>
                              <p className="mt-1 text-sm text-primary-600/80">
                                {selectedFile
                                  ? 'Nhấn để chọn file khác'
                                  : 'Hoặc nhấn để chọn từ máy tính (Tối đa 25MB)'}
                              </p>
                            </Button>
                            <Input
                              ref={fileRef}
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4"
                              onChange={onFileChange}
                            />
                            <div className="grid grid-cols-3 gap-2">
                              {(['FILE', 'LINK', 'TEXT'] as const).map((type) => (
                                <Button
                                  key={type}
                                  type="button"
                                  variant={submissionType === type ? 'default' : 'outline'}
                                  className="h-9 rounded-lg text-xs font-bold"
                                  onClick={() => setSubmissionType(type)}
                                >
                                  {type === 'FILE' ? 'File' : type === 'LINK' ? 'Link' : 'Viết'}
                                </Button>
                              ))}
                            </div>
                            {submissionType === 'LINK' ? (
                              <InputController
                                control={evidenceForm.control}
                                name="linkUrl"
                                label="Link phản tư"
                                placeholder="https://..."
                                inputClassName="rounded-lg"
                              />
                            ) : null}
                            {submissionType === 'TEXT' ? (
                              <TextareaController
                                control={evidenceForm.control}
                                name="textContent"
                                label="Nội dung phản tư"
                                rows={6}
                                placeholder="Viết phản tư trực tiếp tại hệ thống..."
                                textareaClassName="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm"
                              />
                            ) : null}
                            <TextareaController
                              control={evidenceForm.control}
                              name="note"
                              label="Mô tả"
                              labelClassName="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500"
                              id="evidence-note"
                              rows={4}
                              placeholder="Mô tả ngắn gọn về tài liệu bạn nộp…"
                              textareaClassName="w-full resize-y rounded-lg border-0 bg-primary-50/40 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full rounded-lg border-0 bg-gradient-to-br from-primary-600 to-primary-700 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-transparent hover:shadow-primary-600/35 active:scale-[0.98] disabled:opacity-50"
                              disabled={
                                !currentItem ||
                                submit.isPending ||
                                (submissionType === 'FILE' && !selectedFile)
                              }
                              onClick={handleUpload}
                            >
                              {submit.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                              ) : (
                                'Nộp bài'
                              )}
                            </Button>
                          </div>
                        </Form>
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        'rounded-[12px] border border-primary-100/50 bg-primary-50/50 p-6',
                        selectedObjective
                          ? 'text-left bg-white shadow-lg ring-1 ring-gray-100 border-none'
                          : 'text-center',
                        CARD_ENTRANCE_HOVER
                      )}
                      style={staggerStyle(1)}
                    >
                      <h4
                        className={cn(
                          'mb-4 font-bold text-primary-600',
                          selectedObjective
                            ? 'text-base uppercase tracking-normal'
                            : 'text-xs uppercase tracking-wide'
                        )}
                      >
                        {selectedObjective ? selectedObjective.objective : 'Bài đã nộp gần nhất'}
                      </h4>

                      {selectedObjective && selectedObjectiveCanSubmitReflection ? (
                        <div className="mb-6">
                          <Form {...evidenceForm}>
                            <div className="space-y-4">
                              <Button
                                type="button"
                                variant="ghost"
                                className="group h-auto w-full cursor-pointer rounded-lg border-2 border-dashed border-primary-200 bg-primary-50/50 p-6 text-center font-normal normal-case tracking-normal transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={onPickFile}
                                disabled={submit.isPending}
                              >
                                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
                                  <CloudUpload
                                    className="h-5 w-5 text-primary-600"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </div>
                                <p className="text-sm font-bold text-primary-700">
                                  {selectedFile ? `Đã chọn: ${selectedFile.name}` : 'Tải tệp lên'}
                                </p>
                              </Button>
                              <Input
                                ref={fileRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4"
                                onChange={onFileChange}
                              />
                              <div className="grid grid-cols-3 gap-2">
                                {(['FILE', 'LINK', 'TEXT'] as const).map((type) => (
                                  <Button
                                    key={type}
                                    type="button"
                                    variant={submissionType === type ? 'default' : 'outline'}
                                    className="h-9 rounded-lg text-xs font-bold"
                                    onClick={() => setSubmissionType(type)}
                                  >
                                    {type === 'FILE' ? 'File' : type === 'LINK' ? 'Link' : 'Viết'}
                                  </Button>
                                ))}
                              </div>
                              {submissionType === 'LINK' ? (
                                <InputController
                                  control={evidenceForm.control}
                                  name="linkUrl"
                                  label="Link phản tư"
                                  placeholder="https://..."
                                  inputClassName="rounded-lg"
                                />
                              ) : null}
                              {submissionType === 'TEXT' ? (
                                <TextareaController
                                  control={evidenceForm.control}
                                  name="textContent"
                                  label="Nội dung phản tư"
                                  rows={6}
                                  placeholder="Viết phản tư trực tiếp tại hệ thống..."
                                  textareaClassName="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm"
                                />
                              ) : null}
                              <TextareaController
                                control={evidenceForm.control}
                                name="note"
                                label="Mô tả minh chứng"
                                labelClassName="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500"
                                id="evidence-note"
                                rows={3}
                                placeholder="Mô tả..."
                                textareaClassName="w-full resize-y rounded-lg border border-gray-200 p-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-600"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full rounded-lg border-0 bg-gradient-to-br from-primary-600 to-primary-700 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-transparent hover:shadow-primary-600/35 active:scale-[0.98] disabled:opacity-50"
                                disabled={
                                  submit.isPending || (submissionType === 'FILE' && !selectedFile)
                                }
                                onClick={handleUpload}
                              >
                                {submit.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                ) : (
                                  'Nộp bài'
                                )}
                              </Button>
                            </div>
                          </Form>
                        </div>
                      ) : selectedObjective ? (
                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                          Học phần này không yêu cầu nộp phản tư.
                        </div>
                      ) : null}

                      {selectedObjective && (
                        <div className="mt-6 border-t border-gray-100 pt-4">
                          <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                            Lịch sử bài nộp
                          </h5>
                        </div>
                      )}

                      {isLoadingSubmissions && (submissions ?? []).length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-sm font-medium text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Đang tải bài nộp…
                        </div>
                      ) : (submissions ?? []).length > 0 ? (
                        <>
                          <ul className="divide-y divide-primary-100/60 text-left text-sm">
                            {(submissions ?? []).slice(0, 5).map((s) => (
                              <li key={s.id} className="group py-3 first:pt-0 last:pb-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className="truncate font-semibold text-gray-900"
                                      title={s.fileName}
                                    >
                                      {s.fileName}
                                    </div>
                                    <div className="mt-0.5 text-[13px] text-gray-500">
                                      {new Date(s.createdAt).toLocaleDateString('vi-VN')} ·{' '}
                                      <span className="font-medium text-primary-600">
                                        {s.status === 'ACCEPTED' || s.status === 'GRADED'
                                          ? 'Đã duyệt'
                                          : s.status === 'PENDING'
                                            ? 'Chờ duyệt'
                                            : 'Từ chối'}
                                      </span>
                                    </div>
                                  </div>
                                  {s.url ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 rounded-full bg-primary-50 text-primary-600 shadow-sm hover:bg-primary-100 hover:text-primary-700"
                                      title="Xem bài đã nộp"
                                      onClick={() => {
                                        const fullUrl = resolvePublicAssetUrl(s.url!)
                                        if (fullUrl) window.open(fullUrl, '_blank')
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  ) : s.fileMissing ? (
                                    <span
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"
                                      title="File không còn trên máy chủ"
                                    >
                                      <AlertCircle className="h-4 w-4" />
                                    </span>
                                  ) : null}
                                  {s.status === 'GRADED' && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 rounded-full bg-blue-50 text-blue-600 shadow-sm hover:bg-blue-100 hover:text-blue-700 ml-2"
                                      title="Xem kết quả"
                                      onClick={() => setSelectedSubmission(s)}
                                    >
                                      <Info className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>

                          <Dialog
                            open={!!selectedSubmission}
                            onOpenChange={(open) => !open && setSelectedSubmission(null)}
                          >
                            <DialogContent className="sm:max-w-[520px] overflow-hidden">
                              <DialogHeader className="pb-2 border-b border-slate-100">
                                <DialogTitle className="text-xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                                  <Trophy className="h-5 w-5 text-amber-500" />
                                  Thành tích Lộ trình
                                </DialogTitle>
                                <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  Phản hồi chi tiết từ Ban điều hành
                                </DialogDescription>
                              </DialogHeader>
                              {/* Score & Status Summary Card */}
                              <div
                                className={cn(
                                  'relative overflow-hidden rounded-[28px] p-8 text-center border-2 transition-all duration-500',
                                  (displaySubmission?.score || 0) >= 80
                                    ? 'bg-emerald-50/50 border-emerald-100 shadow-emerald-100/20'
                                    : 'bg-rose-50/50 border-rose-100 shadow-rose-100/20'
                                )}
                              >
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                  {(displaySubmission?.score || 0) >= 80 ? (
                                    <Trophy className="h-24 w-24" />
                                  ) : (
                                    <XCircle className="h-24 w-24" />
                                  )}
                                </div>

                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2 block">
                                  Kết quả tổng kết
                                </span>

                                <div className="flex flex-col items-center">
                                  <div
                                    className={cn(
                                      'text-7xl font-black tabular-nums tracking-tighter mb-2',
                                      (displaySubmission?.score || 0) >= 80
                                        ? 'text-emerald-600'
                                        : 'text-rose-600'
                                    )}
                                  >
                                    {displaySubmission?.score ?? '--'}
                                  </div>

                                  <div
                                    className={cn(
                                      'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest border shadow-sm',
                                      (displaySubmission?.score || 0) >= 80
                                        ? 'bg-emerald-500 text-white border-emerald-400'
                                        : 'bg-rose-500 text-white border-rose-400'
                                    )}
                                  >
                                    {(displaySubmission?.score || 0) >= 80 ? (
                                      <>
                                        <CheckCircle2 className="h-4 w-4" /> Đạt yêu cầu
                                      </>
                                    ) : (
                                      <>
                                        <AlertCircle className="h-4 w-4" /> Thi lại
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Feedback Grid */}
                              <div className="space-y-4 pt-4">
                                {/* Manager Feedback */}
                                <div className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                      <UserCheck className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-primary/70">
                                      Nhận xét Quản lý
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium leading-relaxed text-slate-600 whitespace-pre-wrap pl-1 border-l-2 border-primary/20 italic">
                                    {displaySubmission?.managerComment ||
                                      'Quản lý chưa để lại nhận xét chi tiết.'}
                                  </p>
                                </div>

                                {/* Host Feedback */}
                                <div className="group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center">
                                      <MessageSquareQuote className="h-4 w-4 text-purple-700" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-purple-700/70">
                                      Nhận xét Host
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium leading-relaxed text-slate-600 whitespace-pre-wrap pl-1 border-l-2 border-purple-200 italic">
                                    {displaySubmission?.hostComment ||
                                      'Host chưa để lại nhận xét chi tiết.'}
                                  </p>
                                </div>
                              </div>

                              {displaySubmission?.fileName && (
                                <div className="flex flex-col gap-2 border-t border-dashed border-slate-200 pt-4">
                                  <span className="text-sm font-semibold text-slate-800">
                                    File minh chứng đã nộp:
                                  </span>
                                  <div className="flex items-center justify-between bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 gap-3">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <Paperclip className="h-4 w-4 text-indigo-600 shrink-0" />
                                      <span
                                        className="text-sm font-extrabold text-indigo-900 truncate flex-1"
                                        title={displaySubmission.fileName}
                                      >
                                        {displaySubmission.fileName}
                                      </span>
                                    </div>
                                    {displaySubmission.url ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-9 gap-1.5 rounded-xl font-bold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm hover:shadow transition-all shrink-0 flex items-center"
                                        onClick={() => {
                                          const fullUrl = resolvePublicAssetUrl(
                                            displaySubmission.url!
                                          )
                                          if (fullUrl) window.open(fullUrl, '_blank')
                                        }}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>Xem file</span>
                                      </Button>
                                    ) : displaySubmission.fileMissing ? (
                                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        File không còn trên máy chủ
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </>
                      ) : (
                        <div className={cn('py-4', selectedObjective && 'text-center')}>
                          {!selectedObjective && (
                            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/60">
                              <Clock
                                className="h-8 w-8 text-gray-300"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </div>
                          )}
                          <p className="text-sm font-medium text-gray-600">Chưa có bài nộp</p>
                          {!selectedObjective && (
                            <p className="mt-1 text-sm text-gray-500">
                              Các bài nộp của bạn sẽ xuất hiện tại đây sau khi được hệ thống ghi
                              nhận.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <Link
                      to="/dashboard"
                      className="block text-center text-sm font-semibold text-primary-600 hover:underline"
                    >
                      ← Về tổng quan học tập
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const ChecklistTaskCard = memo(function ChecklistTaskCard({
  id,
  title,
  kind,
  objective,
  objectiveList,
  expanded,
  onToggle,
  subtitle,
  primaryAction,
  selectedObjectiveId,
  onSelectObjective,
}: {
  id: string
  title: string
  kind: 'done' | 'current' | 'locked'
  objective: string
  objectiveList?: Array<{
    id: string
    objective: string
    rowOrder: number
    materialRef: string | null
    trainer: string | null
    assessment: string | null
    isClassCompleted?: boolean
    classCompletedAt?: string | null
    classCompletionSource?: 'CLASS_SESSION' | 'MAKEUP_SESSION' | null
  }>
  expanded: boolean
  onToggle: (id: string) => void
  subtitle?: string
  primaryAction?: { label: string; onClick: () => void }
  selectedObjectiveId?: string | null
  onSelectObjective?: (id: string) => void
}) {
  const parseMaterialRef = useCallback((value: string | null) => {
    if (!value)
      return {
        daoTao: null as string | null,
        slide: null as string | null,
        taiLieu: null as string | null,
        raw: null as string | null,
      }

    // Try parsing as JSON first (Lark array format)
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        let daoTao: string | null = null
        let slide: string | null = null
        let taiLieu: string | null = null
        const otherLinks: string[] = []

        parsed.forEach((item) => {
          if (!item.name || !item.link) return
          const n = String(item.name).toLowerCase()
          if (n.includes('đào tạo') || n.includes('dao tao')) {
            daoTao = item.link
          } else if (n.includes('slide')) {
            slide = item.link
          } else if (
            n.includes('tài liệu') ||
            n.includes('tai lieu') ||
            n.includes('sách') ||
            n.includes('sach')
          ) {
            taiLieu = item.link
          } else {
            otherLinks.push(`${item.name}: ${item.link}`)
          }
        })

        return {
          daoTao,
          slide,
          taiLieu,
          raw: otherLinks.length > 0 ? otherLinks.join(' | ') : null,
        }
      }
    } catch (e) {
      // Ignore error and fall back to regex
    }

    const text = value.trim()
    const daoTao =
      text
        .match(/(?:Đào tạo|Dao tao)\s*:?\s*(.+?)(?=(?:\s*(?:Slide|Tài liệu|Tai lieu)\s*:)|$)/i)?.[1]
        ?.trim() ?? null
    const slide =
      text
        .match(/Slide\s*:?\s*(.+?)(?=(?:\s*(?:Đào tạo|Dao tao|Tài liệu|Tai lieu)\s*:)|$)/i)?.[1]
        ?.trim() ?? null
    const taiLieu =
      text
        .match(/(?:Tài liệu|Tai lieu)\s*:?\s*(.+?)(?=(?:\s*(?:Đào tạo|Dao tao|Slide)\s*:)|$)/i)?.[1]
        ?.trim() ?? null
    const raw = text.replace(/^(?:Tài liệu|Tai lieu)\s*:?\s*/i, '').trim()
    return { daoTao, slide, taiLieu, raw: raw.length > 0 ? raw : null }
  }, [])

  const urlRegex = useMemo(() => /(https?:\/\/[^\s]+)/gi, [])

  const renderTextWithLinks = useCallback(
    (value: string) => {
      const parts = value.split(urlRegex)
      return (
        <>
          {parts.map((part, idx) => {
            if (/^https?:\/\//i.test(part)) {
              return (
                <a
                  key={`${part}-${idx}`}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-primary-700 hover:text-primary-800"
                >
                  {part}
                </a>
              )
            }
            return <span key={`${idx}-${part.slice(0, 8)}`}>{part}</span>
          })}
        </>
      )
    },
    [urlRegex]
  )

  const objectiveContent =
    objectiveList && objectiveList.length > 0 ? (
      <div className="space-y-2">
        {objectiveList.map((obj, index) => {
          const isSelected = selectedObjectiveId === obj.id
          const material = parseMaterialRef(obj.materialRef)
          const hasMeta =
            !!material.daoTao ||
            !!material.slide ||
            !!material.taiLieu ||
            !!material.raw ||
            !!obj.trainer ||
            !!obj.assessment

          return (
            <div
              key={obj.id}
              onClick={() => onSelectObjective?.(obj.id)}
              className={cn(
                'group relative flex flex-col rounded-xl border p-3.5 transition-all duration-200',
                onSelectObjective ? 'cursor-pointer hover:shadow-md' : '',
                isSelected
                  ? 'border-[#006C49] bg-white ring-1 ring-[#006C49] shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    isSelected
                      ? 'bg-[#006C49] text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <p
                      className={cn(
                        'text-[14px] mt-0.5 min-w-0 flex-1 font-medium leading-relaxed transition-colors',
                        isSelected ? 'text-primary-900' : 'text-gray-700 group-hover:text-gray-900'
                      )}
                    >
                      {obj.objective}
                    </p>
                    {obj.isClassCompleted ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã học
                      </span>
                    ) : null}
                  </div>

                  {isSelected && hasMeta && (
                    <div className="mt-3 grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 text-sm text-gray-800 sm:grid-cols-2">
                      {material.daoTao && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Đào tạo
                          </span>
                          <span className="line-clamp-2">
                            {renderTextWithLinks(material.daoTao)}
                          </span>
                        </div>
                      )}
                      {material.slide && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Slide
                          </span>
                          <span className="line-clamp-2">
                            {renderTextWithLinks(material.slide)}
                          </span>
                        </div>
                      )}
                      {material.taiLieu && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Tài liệu
                          </span>
                          <span className="line-clamp-2">
                            {renderTextWithLinks(material.taiLieu)}
                          </span>
                        </div>
                      )}
                      {material.raw && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Link khác
                          </span>
                          <span className="line-clamp-2">{renderTextWithLinks(material.raw)}</span>
                        </div>
                      )}
                      {obj.trainer && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Trainer
                          </span>
                          <span className="line-clamp-2 font-medium text-primary-700">
                            {obj.trainer}
                          </span>
                        </div>
                      )}
                      {obj.assessment && (
                        <div className="col-span-full flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                            Đánh giá
                          </span>
                          <span className="line-clamp-3 italic text-gray-600">
                            {obj.assessment}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    ) : (
      <div className="text-sm text-gray-500 italic px-2">{objective}</div>
    )

  if (kind === 'locked') {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-5 opacity-60 grayscale transition-all">
        <div className="flex items-center gap-4">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-100 text-gray-400">
            <Lock className="h-3 w-3" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-base font-bold text-gray-500">{title}</h4>
            <p className="mt-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
              {subtitle || 'Hoàn thành mốc trước để mở'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'done') {
    return (
      <div
        className={cn(
          'rounded-xl p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:shadow-md border-l-4',
          expanded
            ? 'bg-white border-primary-600 ring-primary-100 shadow-md'
            : 'border-success bg-success-muted/40'
        )}
      >
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            className="whitespace-normal h-auto min-w-0 flex-1 justify-start gap-4 p-0 text-left font-normal normal-case tracking-normal hover:bg-transparent"
            onClick={() => onToggle(id)}
            aria-expanded={expanded}
            aria-controls={`objective-${id}`}
          >
            <div
              className={cn(
                'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold transition-colors',
                expanded
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-success bg-success text-white'
              )}
            >
              ✓
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4
                  className={cn(
                    'break-words text-base font-bold transition-colors',
                    expanded ? 'text-primary-600' : 'text-gray-900'
                  )}
                >
                  {title}
                </h4>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-gray-500 transition-transform',
                    expanded && 'rotate-180'
                  )}
                  aria-hidden
                />
              </div>
              {subtitle ? (
                <p className="mt-1 break-words text-sm leading-relaxed text-gray-600">{subtitle}</p>
              ) : null}
            </div>
          </Button>
          {expanded ? (
            <div
              id={`objective-${id}`}
              className="mt-4 rounded-2xl bg-white/60 p-4 shadow-inner ring-1 ring-gray-100/50"
            >
              {objectiveContent}
            </div>
          ) : null}
          {primaryAction ? (
            <Button
              type="button"
              variant="outline"
              className="self-start rounded-lg border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-800 shadow-sm hover:bg-gray-50 active:scale-95"
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border-l-4 p-5 shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:shadow-md',
        expanded ? 'border-[#006C49] bg-white' : 'border-transparent bg-white/50'
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="whitespace-normal h-auto w-full justify-start gap-4 p-0 text-left font-normal normal-case tracking-normal hover:bg-transparent"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        aria-controls={`objective-${id}`}
      >
        <div
          className={cn(
            'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 bg-white transition-colors',
            expanded ? 'border-[#006C49]' : 'border-gray-300'
          )}
        >
          <span
            className="h-2 w-2 rounded-sm bg-[#006C49] opacity-0 transition-opacity group-hover:opacity-20"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h4
              className={cn(
                'break-words text-base font-bold transition-colors',
                expanded ? 'text-[#006C49]' : 'text-gray-700'
              )}
            >
              {title}
            </h4>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'shrink-0 rounded px-2 py-0.5 text-xs font-black uppercase tracking-wide transition-all',
                  expanded
                    ? 'bg-primary-100/80 text-primary-700 opacity-100'
                    : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'
                )}
              >
                {expanded ? 'Active' : 'Xem'}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-primary-600 transition-transform',
                  expanded && 'rotate-180'
                )}
                aria-hidden
              />
            </div>
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-500">{subtitle}</p>
          ) : null}
        </div>
      </Button>
      {expanded ? (
        <div
          id={`objective-${id}`}
          className="mt-4 rounded-2xl bg-slate-50/80 p-4 shadow-inner ring-1 ring-gray-100/50"
        >
          {objectiveContent}
        </div>
      ) : null}
      {primaryAction && expanded ? (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className="rounded-lg border-0 bg-primary-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition-all"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        </div>
      ) : null}
    </div>
  )
})
