import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateManagerRoadmapItem,
  useDeleteManagerRoadmapItem,
  useManagerRoadmapItems,
  useTeacherOptions,
  useUpdateManagerRoadmapItem,
} from '@/features/manager/hooks'
import { cn, randomId } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowUpRight,
  Book,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Edit,
  ExternalLink,
  Files,
  FileText,
  GraduationCap,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  Target,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// Local utility to ensure 'cn' is always available even if module import fails
const cnLocal = (...classes: any[]) => classes.filter(Boolean).join(' ')
const safeCn = typeof cn !== 'undefined' ? cn : cnLocal

const formSchema = z.object({
  id: z.string().optional(),
  levelLabel: z.string().optional(),
  topic: z.string().min(1, 'Vui lòng nhập chủ đề bài học'),
  objective: z.string().min(1, 'Vui lòng nhập ít nhất một mục tiêu'),
  materialRef: z.string().nullable().optional(),
  trainer: z.string().min(1, 'Vui lòng chọn người đào tạo'),
  assessment: z.string().nullable().optional(),
  rowOrder: z.coerce.number().optional(),
})
type FormValues = z.infer<typeof formSchema>

const CAREER_LEVEL_LABELS: Record<string, string> = {
  tap_su: 'Tập sự',
  biet_viec: 'Biết việc',
  duoc_viec: 'Được việc',
  dong_gop_ket_qua: 'Đóng góp kết quả',
  tuong: 'Tướng',
}
const CAREER_LEVELS = Object.keys(CAREER_LEVEL_LABELS)
const LEVEL_ORDER_MAP: Record<string, number> = CAREER_LEVELS.reduce(
  (acc, k, i) => ({ ...acc, [k]: i }),
  {}
)
const NO_ASSESSMENT_VALUE = '__none__'
const ALLOW_REFLECTION_VALUE = 'allow_reflection'
const REFLECTION_ASSESSMENT_VALUE = 'Phản tư'

function normalizeAssessmentValue(value?: string | null) {
  const trimmed = String(value || '').trim()
  if (!trimmed || trimmed === NO_ASSESSMENT_VALUE) return null
  if (trimmed === ALLOW_REFLECTION_VALUE) return REFLECTION_ASSESSMENT_VALUE
  return trimmed
}

function isReflectionAllowed(value?: string | null) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
  return (
    normalized.includes('phan tu') ||
    normalized.includes('tu luan') ||
    normalized.includes('review')
  )
}

export function RoadmapCrud() {
  const { data: items, isLoading } = useManagerRoadmapItems()
  const createItem = useCreateManagerRoadmapItem()
  const updateItem = useUpdateManagerRoadmapItem()
  const deleteItem = useDeleteManagerRoadmapItem()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set())

  const uniqueLevels = Array.from(new Set(items?.map((i) => i.levelLabel).filter(Boolean)))

  // Sort items: Level Order -> Topic -> rowOrder
  const sortedItems = items
    ? [...items].sort((a, b) => {
        // Helper to get level score for sorting
        const getLevelScore = (label: string): number => {
          if (label === 'Cấp tướng') return 999
          const startPart = label.split('->')[0]?.trim()
          const levelKey = Object.entries(CAREER_LEVEL_LABELS).find(
            ([_, v]) => v === startPart
          )?.[0]
          return (levelKey ? LEVEL_ORDER_MAP[levelKey] : 500) ?? 500
        }

        const scoreA = getLevelScore(a.levelLabel || '')
        const scoreB = getLevelScore(b.levelLabel || '')

        if (scoreA !== scoreB) return scoreA - scoreB
        if (a.levelLabel !== b.levelLabel)
          return (a.levelLabel || '').localeCompare(b.levelLabel || '')
        if (a.topic !== b.topic) return (a.topic || '').localeCompare(b.topic || '')
        return (a.rowOrder || 0) - (b.rowOrder || 0)
      })
    : []

  const searchNorm = searchQuery.trim().toLowerCase()
  const filteredItems = sortedItems?.filter((item) => {
    if (filterLevel !== 'all' && item.levelLabel !== filterLevel) return false
    if (!searchNorm) return true
    const hay =
      `${item.topic ?? ''} ${item.objective ?? ''} ${item.trainer ?? ''} ${item.assessment ?? ''}`.toLowerCase()
    return hay.includes(searchNorm)
  })

  const toggleLevelCollapsed = (key: string) => {
    setCollapsedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const levelSpans: Record<number, number> = {}
  const topicSpans: Record<number, number> = {}

  if (filteredItems) {
    // Calculate rowSpan for levelLabel
    let i = 0
    while (i < filteredItems.length) {
      let span = 1
      while (
        i + span < filteredItems.length &&
        filteredItems[i + span]?.levelLabel === filteredItems[i]?.levelLabel
      ) {
        span++
      }
      levelSpans[i] = span
      i += span
    }

    // Calculate rowSpan for topic
    i = 0
    while (i < filteredItems.length) {
      let span = 1
      while (
        i + span < filteredItems.length &&
        (filteredItems[i + span]?.topic || '').trim() === (filteredItems[i]?.topic || '').trim() &&
        (filteredItems[i + span]?.levelLabel || '').trim() ===
          (filteredItems[i]?.levelLabel || '').trim()
      ) {
        span++
      }
      topicSpans[i] = span
      i += span
    }
  }

  function parseAndRenderMaterial(materialRef: string | null) {
    if (!materialRef) return <span className="text-gray-400 italic">Trống</span>

    // Try parsing as JSON first (new format)
    try {
      if (materialRef.startsWith('[') && materialRef.endsWith(']')) {
        const parsed = JSON.parse(materialRef)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return (
            <div className="flex flex-col gap-1.5">
              {parsed.map((m: any, idx: number) => {
                if (!m.link && !m.name) return null
                const isLink = m.link && (m.link.includes('.') || m.link.startsWith('http'))
                return (
                  <div
                    key={m.id || idx}
                    className="group inline-flex items-center gap-1.5 text-xs font-bold transition-all"
                  >
                    {isLink ? (
                      <a
                        href={m.link.startsWith('http') ? m.link : `https://${m.link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-start gap-0.5 text-primary-600 hover:text-primary-800"
                      >
                        <div className="flex items-center gap-1.5">
                          <LinkIcon className="h-3 w-3 opacity-60" />
                          <span className="underline-offset-2 hover:underline font-bold break-all">
                            {m.link}
                          </span>
                        </div>
                        {m.name && m.name.toLowerCase() !== 'slide' && (
                          <span className="text-xs opacity-80 leading-tight pl-4 font-normal italic">
                            {m.name}
                          </span>
                        )}
                      </a>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground/80">
                        <Book className="h-3 w-3" />
                        <span>
                          {m.name} {m.link ? `(${m.link})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        }
      }
    } catch (err) {
      console.warn('Failed to parse materialRef as JSON', err)
    }

    // Fallback to existing logic for legacy string format
    if (materialRef.includes('http')) {
      const parts = materialRef.split(/(https?:\/\/[^\s]+)/)
      return (
        <span className="space-x-1">
          {parts.map((part, i) => {
            if (part.startsWith('http')) {
              return (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary-600 transition-colors hover:text-primary-800 hover:underline"
                >
                  <span className="underline-offset-4 break-all">{part}</span>
                  <ExternalLink className="mb-[2px] h-3 w-3 flex-shrink-0" />
                </a>
              )
            }
            return (
              <span key={i} className="text-gray-800">
                {part}
              </span>
            )
          })}
        </span>
      )
    }
    return <span className="font-medium text-gray-800">{materialRef}</span>
  }

  const defaultValues: FormValues = {
    levelLabel: '',
    topic: '',
    objective: '',
    materialRef: '',
    trainer: '',
    assessment: '',
    rowOrder: 1,
  }

  const [materials, setMaterials] = useState<{ id: string; name: string; link: string }[]>([
    { id: randomId(), name: '', link: '' },
  ])
  const [objectives, setObjectives] = useState<{ id: string; text: string }[]>([
    { id: randomId(), text: '' },
  ])
  const [trainerSearch, setTrainerSearch] = useState('')
  const [debouncedTrainerSearch, setDebouncedTrainerSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTrainerSearch(trainerSearch)
    }, 500)
    return () => clearTimeout(timer)
  }, [trainerSearch])

  const { data: teacherOptions = [], isFetching: isFetchingTeachers } =
    useTeacherOptions(debouncedTrainerSearch)

  const addMaterial = () => {
    setMaterials([...materials, { id: randomId(), name: '', link: '' }])
  }

  const removeMaterial = (id: string) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((m) => m.id !== id))
    } else {
      setMaterials([{ id: randomId(), name: '', link: '' }])
    }
  }

  const addObjective = () => {
    setObjectives([...objectives, { id: randomId(), text: '' }])
  }

  const removeObjective = (id: string) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((o) => o.id !== id))
    } else {
      setObjectives([{ id: randomId(), text: '' }])
    }
  }

  const updateObjective = (id: string, text: string) => {
    const newObjectives = objectives.map((o) => (o.id === id ? { ...o, text } : o))
    setObjectives(newObjectives)
    // Sync with form for validation
    const firstValid = newObjectives.find((o) => o.text.trim() !== '')?.text || ''
    form.setValue('objective', firstValid, { shouldValidate: true })
  }

  const updateMaterial = (id: string, field: 'name' | 'link', value: string) => {
    setMaterials(materials.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const [levelStart, setLevelStart] = useState<string>('tap_su')
  const [levelEnd, setLevelEnd] = useState<string>('biet_viec')

  const handleLevelStartChange = (val: string) => {
    setLevelStart(val)
    const currentIndex = CAREER_LEVELS.indexOf(val)
    if (currentIndex !== -1 && currentIndex < CAREER_LEVELS.length - 1) {
      const nextLevel = CAREER_LEVELS[currentIndex + 1]
      if (nextLevel) setLevelEnd(nextLevel)
    }
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const handleCancel = () => {
    form.reset(defaultValues)
    setMaterials([{ id: randomId(), name: '', link: '' }])
    setObjectives([{ id: randomId(), text: '' }])
    setEditingId(null)
    setIsFormVisible(false)
  }

  const onSubmit = async (values: FormValues) => {
    const calculatedLevelLabel =
      levelStart === 'tuong'
        ? 'Cấp tướng'
        : `${CAREER_LEVEL_LABELS[levelStart] || levelStart} -> ${CAREER_LEVEL_LABELS[levelEnd] || levelEnd}`

    if (editingId) {
      updateItem.mutate(
        {
          id: editingId,
          input: {
            ...values,
            levelLabel: calculatedLevelLabel,
            materialRef: JSON.stringify(materials),
            objective: objectives[0]?.text || values.objective,
            assessment: normalizeAssessmentValue(values.assessment),
          },
        },
        { onSuccess: handleCancel }
      )
    } else {
      // Bulk creation for multiple objectives
      const validObjectives = objectives.filter((o) => o.text.trim() !== '')
      if (validObjectives.length === 0) {
        validObjectives.push({ id: randomId(), text: values.objective })
      }

      for (const obj of validObjectives) {
        await createItem.mutateAsync({
          ...values,
          levelLabel: calculatedLevelLabel,
          materialRef: JSON.stringify(materials),
          objective: obj.text,
          assessment: normalizeAssessmentValue(values.assessment),
        })
      }
      handleCancel()
    }
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id)

    // Parse levelStart / levelEnd from levelLabel "A -> B"
    const label = item.levelLabel || ''
    if (label.includes('->')) {
      const parts = label.split('->').map((p: string) => p.trim())
      const reverseMap = Object.entries(CAREER_LEVEL_LABELS).reduce(
        (acc, [k, v]) => ({ ...acc, [v]: k }),
        {} as Record<string, string>
      )
      if (parts[0]) setLevelStart(reverseMap[parts[0]] || 'tap_su')
      if (parts[1]) setLevelEnd(reverseMap[parts[1]] || 'biet_viec')
    }

    setObjectives([{ id: randomId(), text: item.objective || '' }])
    try {
      const parsedMaterials = JSON.parse(item.materialRef || '[]')
      setMaterials(
        Array.isArray(parsedMaterials) && parsedMaterials.length > 0
          ? parsedMaterials
          : [{ id: randomId(), name: '', link: '' }]
      )
    } catch {
      setMaterials([{ id: randomId(), name: '', link: '' }])
    }

    form.reset({
      levelLabel: item.levelLabel,
      topic: item.topic,
      objective: item.objective,
      materialRef: item.materialRef || '',
      trainer: item.trainer || '',
      assessment: item.assessment || '',
      rowOrder: item.rowOrder || 1,
    })
    setIsFormVisible(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa mục này?')) {
      deleteItem.mutate(id)
    }
  }

  return (
    <>
      <PageHeader
        title="Quản lý lộ trình học"
        // description="Thêm, sửa, xoá các đầu mục lộ trình tự động hóa cho nhân sự"
      />

      <div className="space-y-3">
        {!isLoading && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm chủ đề, mục tiêu…"
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="h-8 w-full sm:w-[220px] text-sm">
                  <SelectValue placeholder="Tất cả cấp độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cấp độ</SelectItem>
                  {uniqueLevels.map((lvl) => (
                    <SelectItem key={lvl} value={lvl as string}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setIsFormVisible(true)} size="sm" className="h-8 shrink-0">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Thêm đầu mục
            </Button>
          </div>
        )}

        <Dialog
          open={isFormVisible}
          onOpenChange={(open) => {
            if (!open) handleCancel()
          }}
        >
          <DialogContent className="flex h-[90vh] max-w-3xl flex-col overflow-hidden rounded-xl border bg-white p-0 shadow-lg">
            <DialogHeader className="shrink-0 border-b px-5 py-3">
              <DialogTitle className="text-base font-semibold tracking-tight">
                {editingId ? 'Chỉnh sửa lộ trình' : 'Tạo lộ trình học mới'}
              </DialogTitle>
            </DialogHeader>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <Form {...form}>
                <form
                  id="roadmap-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  {/* Level Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide">
                        Tiến trình cấp độ
                      </h4>
                    </div>
                    <div
                      className={safeCn(
                        'grid grid-cols-1 gap-3 rounded-lg border border-[#006C49]/10 bg-[#006C49]/[0.04] p-3 transition-all',
                        levelStart !== 'tuong' ? 'md:grid-cols-2' : 'md:grid-cols-1'
                      )}
                    >
                      <div className="space-y-1.5">
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          Cấp độ hiện tại
                        </FormLabel>
                        <Select value={levelStart} onValueChange={handleLevelStartChange}>
                          <SelectTrigger className="h-9 rounded-md border-[#006C49]/10 bg-white">
                            <SelectValue placeholder="Chọn cấp độ" />
                          </SelectTrigger>
                          <SelectContent className="rounded-md border-[#006C49]/10">
                            {CAREER_LEVELS.map((k) => (
                              <SelectItem
                                key={k}
                                value={k}
                                className="rounded-sm my-0.5 focus:bg-primary/10 focus:text-primary"
                              >
                                {CAREER_LEVEL_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {levelStart !== 'tuong' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-left-4 duration-300">
                          <FormLabel className="text-xs font-medium text-muted-foreground">
                            Cấp độ tiếp theo
                          </FormLabel>
                          <div className="relative group">
                            <Select value={levelEnd} onValueChange={setLevelEnd}>
                              <SelectTrigger className="h-9 rounded-md border-[#006C49]/10 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-md border-[#006C49]/10">
                                {CAREER_LEVELS.map((k) => (
                                  <SelectItem
                                    key={k}
                                    value={k}
                                    className="rounded-sm my-0.5 focus:bg-primary/10 focus:text-primary"
                                  >
                                    {CAREER_LEVEL_LABELS[k]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white md:block">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#006C49] text-white">
                                <ChevronRight className="h-3 w-3" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <BookOpen className="h-3.5 w-3.5" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide">
                        Nội dung đào tạo
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="topic"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel
                              className={safeCn(
                                'text-xs font-medium transition-colors',
                                fieldState.error
                                  ? 'font-semibold text-red-600'
                                  : 'text-muted-foreground'
                              )}
                            >
                              Chủ đề bài học {fieldState.error && '(Bắt buộc)'}
                            </FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Input
                                  placeholder="Tư duy, Kĩ năng, Quy trình..."
                                  className={safeCn(
                                    'h-9 rounded-md border-primary/10 bg-white pl-9 text-sm shadow-none transition-all hover:border-primary/30 focus:ring-1 focus:ring-primary/20',
                                    fieldState.error && 'border-red-500 bg-red-50/30'
                                  )}
                                  {...field}
                                  value={field.value || ''}
                                />
                                <Type
                                  className={safeCn(
                                    'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors',
                                    fieldState.error
                                      ? 'text-red-500'
                                      : 'text-muted-foreground group-focus-within:text-primary'
                                  )}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="assessment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium text-muted-foreground">
                              Hình thức đánh giá
                            </FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Select
                                  value={
                                    isReflectionAllowed(field.value)
                                      ? ALLOW_REFLECTION_VALUE
                                      : NO_ASSESSMENT_VALUE
                                  }
                                  onValueChange={(value) =>
                                    field.onChange(
                                      value === ALLOW_REFLECTION_VALUE
                                        ? REFLECTION_ASSESSMENT_VALUE
                                        : ''
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9 rounded-md border-primary/10 bg-white pl-9 text-sm shadow-none transition-all hover:border-primary/30 focus:ring-1 focus:ring-primary/20">
                                    <SelectValue placeholder="Chọn trạng thái nộp phản tư" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_ASSESSMENT_VALUE}>
                                      Không yêu cầu
                                    </SelectItem>
                                    <SelectItem value={ALLOW_REFLECTION_VALUE}>
                                      Cho phép nộp phản tư
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="hidden"
                                  placeholder="Review, Thi trắc nghiệm..."
                                  className="h-9 rounded-md border-primary/10 bg-white pl-9 shadow-none"
                                  {...field}
                                  value={field.value || ''}
                                />
                                <ClipboardCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Multiple Objectives Section */}
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs font-medium text-muted-foreground">
                            Mục tiêu chi tiết (Objective)
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 rounded-md border-[#006C49]/20 bg-[#006C49]/[0.06] px-2.5 text-xs font-medium text-[#006C49]"
                            onClick={addObjective}
                          >
                            <Plus className="h-3 w-3" /> Thêm mục tiêu
                          </Button>
                        </div>

                        <div className="space-y-2 rounded-lg border border-dashed border-[#006C49]/20 bg-[#006C49]/[0.03] p-2.5">
                          {objectives.map((obj, idx) => (
                            <div
                              key={obj.id}
                              className="group relative flex items-start gap-2 animate-in zoom-in-95 fade-in duration-200"
                            >
                              <div className="relative flex-1">
                                <Textarea
                                  className={safeCn(
                                    'min-h-[64px] rounded-md border-primary/10 bg-white px-3 pt-7 text-sm shadow-none hover:border-primary/20 transition-all',
                                    form.formState.errors.objective &&
                                      obj.text.trim() === '' &&
                                      'border-red-500 bg-red-50/30'
                                  )}
                                  placeholder="Kiến thức hoặc kĩ năng cần đạt được..."
                                  value={obj.text}
                                  onChange={(e) => updateObjective(obj.id, e.target.value)}
                                />
                                <div
                                  className={safeCn(
                                    'absolute left-2.5 top-2 flex h-5 w-5 items-center justify-center rounded transition-colors',
                                    form.formState.errors.objective && obj.text.trim() === ''
                                      ? 'bg-red-100 text-red-500'
                                      : 'bg-primary/5 text-primary'
                                  )}
                                >
                                  <Target className="h-3 w-3" />
                                </div>
                                {form.formState.errors.objective && obj.text.trim() === '' && (
                                  <p className="mt-1 text-xs font-medium text-red-500">
                                    Vui lòng nhập mục tiêu này hoặc xóa nếu không cần thiết
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="mt-1 h-8 w-8 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() => removeObjective(obj.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Materials Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#006C49]">
                        <Files className="h-3.5 w-3.5" />
                        <h4 className="text-xs font-semibold uppercase tracking-wide">
                          Tài liệu học tập
                        </h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 rounded-md border-[#006C49]/20 bg-[#006C49]/[0.06] px-2.5 text-xs font-medium text-[#006C49]"
                        onClick={addMaterial}
                      >
                        <Plus className="h-3 w-3" /> Thêm tài liệu
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-lg border border-dashed border-primary/20 bg-primary/[0.01] p-2.5">
                      {materials.map((m, idx) => (
                        <div
                          key={m.id}
                          className="group relative grid grid-cols-1 items-start gap-2 animate-in zoom-in-95 fade-in duration-200 md:grid-cols-[1fr_1fr_auto]"
                        >
                          <div className="space-y-1 pt-px">
                            <Input
                              placeholder="Tên tài liệu..."
                              value={m.name}
                              className="h-9 rounded-md border-primary/10 bg-white text-sm shadow-none hover:border-primary/20"
                              onChange={(e) => updateMaterial(m.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="relative">
                              <Input
                                placeholder="Link hoặc Ghi chú (Sách, slide...)"
                                value={m.link}
                                className="h-9 rounded-md border-primary/10 bg-white pl-9 text-sm shadow-none hover:border-primary/20"
                                onChange={(e) => updateMaterial(m.id, 'link', e.target.value)}
                              />
                              <FileText className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() => removeMaterial(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trainer Section */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <GraduationCap className="h-3.5 w-3.5" />
                      <h4 className="text-xs font-semibold uppercase tracking-wide">
                        Phụ trách đào tạo
                      </h4>
                    </div>
                    <div className="rounded-lg border border-[#006C49]/10 bg-[#006C49]/[0.04] p-3">
                      <FormField
                        control={form.control}
                        name="trainer"
                        render={({ field, fieldState }) => (
                          <FormItem className="search-dropdown-container relative max-w-md">
                            <FormLabel
                              className={safeCn(
                                'text-xs font-medium transition-colors',
                                fieldState.error
                                  ? 'font-semibold text-red-600'
                                  : 'text-muted-foreground'
                              )}
                            >
                              Người đào tạo (Trainer) {fieldState.error && '(Bắt buộc)'}
                            </FormLabel>
                            <FormControl>
                              <div className="group relative">
                                <Popover open={trainerSearch.trim().length > 0}>
                                  <PopoverTrigger asChild>
                                    <div className="relative">
                                      <Input
                                        placeholder="Gõ tên để tìm người đào tạo..."
                                        className={safeCn(
                                          'h-9 rounded-md border-primary/10 bg-white pl-9 text-sm shadow-none transition-all hover:border-primary/30 focus:ring-1 focus:ring-primary/20',
                                          fieldState.error && 'border-red-500 bg-red-50/30'
                                        )}
                                        value={trainerSearch || field.value || ''}
                                        onChange={(e) => {
                                          setTrainerSearch(e.target.value)
                                          if (e.target.value === '') {
                                            field.onChange('')
                                          }
                                        }}
                                        onFocus={() => {
                                          if (!trainerSearch && field.value) {
                                            setTrainerSearch(field.value)
                                          }
                                        }}
                                      />
                                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] rounded-md border-primary/10 bg-white p-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
                                    align="start"
                                    sideOffset={6}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <div className="max-h-[240px] overflow-y-auto">
                                      {/* Default option: Tự học */}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-sm font-medium hover:bg-primary/5 hover:text-primary"
                                        onClick={() => {
                                          field.onChange('Tự học')
                                          setTrainerSearch('')
                                        }}
                                      >
                                        <span>Tự học</span>
                                        {field.value === 'Tự học' && (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                      </Button>

                                      {/* API results */}
                                      {isFetchingTeachers && teacherOptions.length === 0 ? (
                                        <div className="flex items-center justify-center gap-2 px-3 py-3 text-center text-xs text-muted-foreground">
                                          <Loader2
                                            className="h-3.5 w-3.5 animate-spin"
                                            aria-hidden
                                          />
                                          Đang tìm giáo viên…
                                        </div>
                                      ) : teacherOptions.length > 0 ? (
                                        teacherOptions.map(
                                          (t: { userId: string; name: string }) => (
                                            <Button
                                              key={t.userId}
                                              type="button"
                                              variant="ghost"
                                              className="flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-sm font-medium hover:bg-primary/5 hover:text-primary"
                                              onClick={() => {
                                                field.onChange(t.name)
                                                setTrainerSearch('')
                                              }}
                                            >
                                              <span>{t.name}</span>
                                              {field.value === t.name && (
                                                <Check className="h-3.5 w-3.5" />
                                              )}
                                            </Button>
                                          )
                                        )
                                      ) : (
                                        <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                                          Không tìm thấy giáo viên phù hợp
                                        </div>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form>
            </div>

            <div className="relative z-10 shrink-0 border-t bg-white px-5 py-3">
              <div className="flex flex-col gap-2">
                {Object.keys(form.formState.errors).length > 0 && (
                  <div className="text-right text-xs font-medium text-red-500">
                    * Vui lòng kiểm tra lại các trường thông tin còn thiếu
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-muted-foreground"
                    onClick={handleCancel}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    form="roadmap-form"
                    size="sm"
                    className="h-8"
                    loading={createItem.isPending || updateItem.isPending}
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    {createItem.isPending || updateItem.isPending
                      ? 'Đang xử lý...'
                      : editingId
                        ? 'Cập nhật'
                        : 'Tạo lộ trình'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Flat level accordion list */}
        <div className="space-y-2">
          {!isLoading && uniqueLevels.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white py-12">
              <p className="text-sm font-medium text-gray-900">Chưa có dữ liệu lộ trình</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nhấn &apos;Thêm đầu mục&apos; để bắt đầu
              </p>
            </div>
          )}

          {!isLoading && uniqueLevels.length > 0 && filteredItems?.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
              Không có kết quả phù hợp
            </div>
          )}

          {(() => {
            const levelGroups = new Map<string, { label: string; items: any[] }>()

            filteredItems?.forEach((item) => {
              const normalized = (item.levelLabel || '').trim().toLowerCase()
              if (!normalized) return

              const group = levelGroups.get(normalized)
              if (group) {
                group.items.push(item)
              } else {
                levelGroups.set(normalized, { label: item.levelLabel, items: [item] })
              }
            })

            return Array.from(levelGroups.values()).map((group) => {
              const isOpen = !collapsedLevels.has(group.label)
              let lastTopic = ''

              return (
                <div
                  key={group.label}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleLevelCollapsed(group.label)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-sm font-semibold text-foreground">
                      {group.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{group.items.length} mục</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      {/* Column headers — desktop */}
                      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-3 border-b border-gray-50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground md:grid">
                        <span>Mục tiêu</span>
                        <span>Tài liệu</span>
                        <span>Phụ trách</span>
                        <span>Đánh giá</span>
                        <span className="w-16" />
                      </div>

                      {group.items.map((item) => {
                        const topic = (item.topic || '').trim()
                        const showTopic = topic && topic.toLowerCase() !== lastTopic.toLowerCase()
                        if (topic) lastTopic = topic

                        return (
                          <div key={item.id}>
                            {showTopic && (
                              <div className="flex items-center gap-1.5 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                                <BookOpen className="h-3 w-3" />
                                {topic}
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-2 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-muted/20 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center md:gap-3">
                              <p className="text-sm leading-snug text-foreground">
                                {item.objective}
                              </p>
                              <div className="text-xs text-muted-foreground">
                                {parseAndRenderMaterial(item.materialRef)}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.trainer || '—'}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.assessment || '—'}
                              </p>
                              <div className="flex items-center gap-0.5 md:justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:bg-blue-50"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:bg-red-50"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </>
  )
}
