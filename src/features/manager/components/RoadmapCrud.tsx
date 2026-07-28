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
import { cn } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowUpRight,
  Book,
  BookOpen,
  Check,
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

  const filteredItems = sortedItems?.filter(
    (item) => filterLevel === 'all' || item.levelLabel === filterLevel
  )

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
    { id: crypto.randomUUID(), name: '', link: '' },
  ])
  const [objectives, setObjectives] = useState<{ id: string; text: string }[]>([
    { id: crypto.randomUUID(), text: '' },
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
    setMaterials([...materials, { id: crypto.randomUUID(), name: '', link: '' }])
  }

  const removeMaterial = (id: string) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((m) => m.id !== id))
    } else {
      setMaterials([{ id: crypto.randomUUID(), name: '', link: '' }])
    }
  }

  const addObjective = () => {
    setObjectives([...objectives, { id: crypto.randomUUID(), text: '' }])
  }

  const removeObjective = (id: string) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((o) => o.id !== id))
    } else {
      setObjectives([{ id: crypto.randomUUID(), text: '' }])
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
    setMaterials([{ id: crypto.randomUUID(), name: '', link: '' }])
    setObjectives([{ id: crypto.randomUUID(), text: '' }])
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
        validObjectives.push({ id: crypto.randomUUID(), text: values.objective })
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

    setObjectives([{ id: crypto.randomUUID(), text: item.objective || '' }])
    try {
      const parsedMaterials = JSON.parse(item.materialRef || '[]')
      setMaterials(
        Array.isArray(parsedMaterials) && parsedMaterials.length > 0
          ? parsedMaterials
          : [{ id: crypto.randomUUID(), name: '', link: '' }]
      )
    } catch {
      setMaterials([{ id: crypto.randomUUID(), name: '', link: '' }])
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

      <div className="space-y-6">
        {!isLoading && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-sm font-medium text-gray-700 min-w-[70px]">Lọc cấp độ:</span>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[200px] md:w-[280px]">
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
            <Button
              onClick={() => setIsFormVisible(true)}
              className="w-full sm:w-auto mt-2 sm:mt-0 shadow-md transition-transform hover:scale-[1.02]"
            >
              <Plus className="mr-2 h-4 w-4" /> Thêm đầu mục mới
            </Button>
          </div>
        )}

        <Dialog
          open={isFormVisible}
          onOpenChange={(open) => {
            if (!open) handleCancel()
          }}
        >
          <DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl bg-white">
            {/* Decorative background */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl opacity-60 pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl opacity-60 pointer-events-none" />

            <DialogHeader className="shrink-0 relative border-b border-primary/5 px-8 pt-8 pb-6 bg-white/40 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#006C49] text-white">
                  {editingId ? <Edit className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                    {editingId ? 'Chỉnh sửa lộ trình' : 'Tạo lộ trình học mới'}
                  </DialogTitle>
                  <p className="mt-1 text-sm font-medium text-muted-foreground opacity-70">
                    Thiết lập các tiêu chuẩn đào tạo và tài liệu hỗ trợ
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-8 pt-6 pb-12 custom-scrollbar min-h-0">
              <Form {...form}>
                <form
                  id="roadmap-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  {/* Level Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <ArrowUpRight className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        Tiến trình cấp độ
                      </h4>
                    </div>
                    <div
                      className={safeCn(
                        'grid grid-cols-1 gap-6 rounded-3xl border border-[#006C49]/10 bg-[#006C49]/0.2 p-6 transition-all',
                        levelStart !== 'tuong' ? 'md:grid-cols-2' : 'md:grid-cols-1'
                      )}
                    >
                      <div className="space-y-2">
                        <FormLabel className="text-xs font-bold uppercase text-muted-foreground ml-1">
                          Cấp độ hiện tại
                        </FormLabel>
                        <Select value={levelStart} onValueChange={handleLevelStartChange}>
                          <SelectTrigger className="h-12 rounded-2xl border-[#006C49]/10 bg-white">
                            <SelectValue placeholder="Chọn cấp độ" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-[#006C49]/10">
                            {CAREER_LEVELS.map((k) => (
                              <SelectItem
                                key={k}
                                value={k}
                                className="rounded-xl my-1 focus:bg-primary/10 focus:text-primary"
                              >
                                {CAREER_LEVEL_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {levelStart !== 'tuong' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground ml-1">
                            Cấp độ tiếp theo
                          </FormLabel>
                          <div className="relative group">
                            <Select value={levelEnd} onValueChange={setLevelEnd}>
                              <SelectTrigger className="h-12 rounded-2xl border-[#006C49]/10 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-[#006C49]/10">
                                {CAREER_LEVELS.map((k) => (
                                  <SelectItem
                                    key={k}
                                    value={k}
                                    className="rounded-xl my-1 focus:bg-primary/10 focus:text-primary"
                                  >
                                    {CAREER_LEVEL_LABELS[k]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 hidden md:block border-2 border-white rounded-full">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#006C49] text-white">
                                <ChevronRight className="h-3 w-3" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <BookOpen className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        Nội dung đào tạo
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="topic"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel
                              className={safeCn(
                                'text-xs font-bold uppercase transition-colors ml-1',
                                fieldState.error
                                  ? 'text-red-600 font-black'
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
                                    'h-12 rounded-2xl border-primary/10 bg-white pl-11 shadow-sm transition-all hover:border-primary/30 focus:ring-2 focus:ring-primary/20',
                                    fieldState.error && 'border-red-500 bg-red-50/30'
                                  )}
                                  {...field}
                                  value={field.value || ''}
                                />
                                <Type
                                  className={safeCn(
                                    'absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors',
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
                            <FormLabel className="text-xs font-bold uppercase text-muted-foreground ml-1">
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
                                  <SelectTrigger className="h-12 rounded-2xl border-primary/10 bg-white pl-11 shadow-sm transition-all hover:border-primary/30 focus:ring-2 focus:ring-primary/20">
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
                                  className="h-12 rounded-2xl border-primary/10 bg-white pl-11 shadow-sm transition-all hover:border-primary/30 focus:ring-2 focus:ring-primary/20"
                                  {...field}
                                  value={field.value || ''}
                                />
                                <ClipboardCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Multiple Objectives Section */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs font-bold uppercase text-muted-foreground ml-1">
                            Mục tiêu chi tiết (Objective)
                          </FormLabel>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-full border-[#006C49]/20 bg-[#006C49]/0.2 px-4 text-xs font-bold text-[#006C49]"
                            onClick={addObjective}
                          >
                            <Plus className="h-3.5 w-3.5" /> Thêm mục tiêu
                          </Button>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-dashed border-[#006C49]/20 bg-[#006C49]/0.1 p-4">
                          {objectives.map((obj, idx) => (
                            <div
                              key={obj.id}
                              className="group relative flex gap-3 items-start animate-in zoom-in-95 fade-in duration-200"
                            >
                              <div className="relative flex-1">
                                <Textarea
                                  className={safeCn(
                                    'min-h-[80px] rounded-xl border-primary/10 bg-white pt-8 px-4 shadow-sm hover:border-primary/20 transition-all',
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
                                    'absolute left-3.5 top-3 flex h-5 w-5 items-center justify-center rounded-lg transition-colors',
                                    form.formState.errors.objective && obj.text.trim() === ''
                                      ? 'bg-red-100 text-red-500'
                                      : 'bg-primary/5 text-primary'
                                  )}
                                >
                                  <Target className="h-3 w-3" />
                                </div>
                                {form.formState.errors.objective && obj.text.trim() === '' && (
                                  <p className="mt-1.5 ml-1 text-xs font-bold text-red-500">
                                    Vui lòng nhập mục tiêu này hoặc xóa nếu không cần thiết
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 mt-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                onClick={() => removeObjective(obj.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Materials Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#006C49]">
                        <Files className="h-4 w-4" />
                        <h4 className="text-xs font-bold uppercase tracking-widest">
                          Tài liệu học tập
                        </h4>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-full border-[#006C49]/20 bg-[#006C49]/0.2 px-4 text-xs font-bold text-[#006C49]"
                        onClick={addMaterial}
                      >
                        <Plus className="h-3.5 w-3.5" /> Thêm tài liệu
                      </Button>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-dashed border-primary/20 bg-primary/[0.01] p-5">
                      {materials.map((m, idx) => (
                        <div
                          key={m.id}
                          className="group relative grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-start animate-in zoom-in-95 fade-in duration-200"
                        >
                          <div className="space-y-1.5 pt-px">
                            <Input
                              placeholder="Tên tài liệu..."
                              value={m.name}
                              className="h-11 rounded-xl border-primary/5 bg-white shadow-sm hover:border-primary/20 transition-all font-medium"
                              onChange={(e) => updateMaterial(m.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="relative">
                              <Input
                                placeholder="Link hoặc Ghi chú (Sách, slide...)"
                                value={m.link}
                                className="h-11 rounded-xl border-primary/5 bg-white pl-10 shadow-sm hover:border-primary/20 transition-all"
                                onChange={(e) => updateMaterial(m.id, 'link', e.target.value)}
                              />
                              <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all active:scale-90"
                            onClick={() => removeMaterial(m.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trainer Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#006C49]">
                      <GraduationCap className="h-4 w-4" />
                      <h4 className="text-xs font-bold uppercase tracking-widest">
                        Phụ trách đào tạo
                      </h4>
                    </div>
                    <div className="rounded-3xl border border-[#006C49]/10 bg-[#006C49]/0.2 p-6">
                      <FormField
                        control={form.control}
                        name="trainer"
                        render={({ field, fieldState }) => (
                          <FormItem className="search-dropdown-container relative max-w-md">
                            <FormLabel
                              className={safeCn(
                                'text-xs font-bold uppercase transition-colors ml-1',
                                fieldState.error
                                  ? 'text-red-600 font-black'
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
                                          'h-12 rounded-2xl border-primary/10 bg-white pl-11 shadow-sm transition-all hover:border-primary/30 focus:ring-2 focus:ring-primary/20',
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
                                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-[var(--radix-popover-trigger-width)] rounded-2xl border-primary/10 bg-white p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                                    align="start"
                                    sideOffset={8}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                  >
                                    <div className="max-h-[300px] overflow-y-auto">
                                      {/* Default option: Tự học */}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium hover:bg-primary/5 hover:text-primary"
                                        onClick={() => {
                                          field.onChange('Tự học')
                                          setTrainerSearch('')
                                        }}
                                      >
                                        <span>Tự học</span>
                                        {field.value === 'Tự học' && <Check className="h-4 w-4" />}
                                      </Button>

                                      {/* API results */}
                                      {isFetchingTeachers && teacherOptions.length === 0 ? (
                                        <div className="flex items-center justify-center gap-2 px-3 py-4 text-center text-xs text-muted-foreground">
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
                                              className="flex h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium hover:bg-primary/5 hover:text-primary"
                                              onClick={() => {
                                                field.onChange(t.name)
                                                setTrainerSearch('')
                                              }}
                                            >
                                              <span>{t.name}</span>
                                              {field.value === t.name && (
                                                <Check className="h-4 w-4" />
                                              )}
                                            </Button>
                                          )
                                        )
                                      ) : (
                                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
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

            {/* Sticky Footer Actions */}
            <div className="shrink-0 z-10 relative border-t border-primary/5 bg-white px-8 py-5 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
              <div className="flex flex-col gap-3">
                {Object.keys(form.formState.errors).length > 0 && (
                  <div className="text-right text-xs font-bold text-red-500 animate-pulse">
                    * Vui lòng kiểm tra lại các trường thông tin còn thiếu
                  </div>
                )}
                <div className="flex justify-end items-center gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 rounded-2xl px-10 font-bold text-muted-foreground hover:bg-muted/50"
                    onClick={handleCancel}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    form="roadmap-form"
                    loading={createItem.isPending || updateItem.isPending}
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    {createItem.isPending || updateItem.isPending
                      ? 'Đang xử lý...'
                      : editingId
                        ? 'Cập nhật lộ trình'
                        : 'Kích hoạt lộ trình'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Grouped Card Display Layout */}
        <div className="space-y-8">
          {!isLoading && uniqueLevels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 rounded-[3rem] border border-dashed border-gray-200 bg-white shadow-sm">
              <div className="h-20 w-20 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300 font-black text-3xl mb-4">
                ?
              </div>
              <h3 className="text-xl font-bold text-gray-900">Chưa có dữ liệu lộ trình</h3>
              <p className="text-gray-500 mt-2 text-center max-w-xs text-sm">
                Nhấn 'Thêm đầu mục mới' để bắt đầu
              </p>
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
              const uniqueTopics = Array.from(
                new Set(group.items.map((i) => (i.topic || '').trim().toLowerCase()))
              )

              return (
                <div
                  key={group.label}
                  className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                  {/* Level Header - MORE COMPACT */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <div className="bg-[#006C49] h-10 w-10 rounded-xl flex items-center justify-center text-white">
                      <ArrowUpRight className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                          {group.label}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-black text-primary uppercase tracking-widest mt-0.5">
                          Lộ trình
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-2 grid grid-cols-1 gap-4 border-l border-gray-200 pl-3 sm:ml-4 sm:gap-6 sm:pl-5 md:ml-5 md:pl-6">
                    {uniqueTopics.map((topicKey) => {
                      const topicItems = group.items.filter(
                        (i) => (i.topic || '').trim().toLowerCase() === topicKey
                      )
                      const displayTopic = topicItems[0]?.topic || topicKey

                      return (
                        <div
                          key={topicKey}
                          className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300"
                        >
                          {/* Topic Header - COMPACT */}
                          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-3 py-3 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                                <BookOpen className="h-4 w-4" />
                              </div>
                              <h3 className="text-md font-bold text-gray-800">{displayTopic}</h3>
                            </div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                              {topicItems.length} đầu mục
                            </span>
                          </div>

                          <div className="p-1 space-y-1">
                            {topicItems.map((item, idx) => (
                              <div
                                key={item.id}
                                className={safeCn(
                                  'flex flex-col justify-between gap-4 rounded-xl px-3 py-3 transition-all hover:bg-primary/[0.02] sm:px-5 lg:flex-row lg:items-center',
                                  idx % 2 === 0 ? 'bg-gray-50/30' : 'bg-white'
                                )}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1fr_0.8fr] gap-4 flex-1">
                                  {/* Objective */}
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase font-black text-primary/40 tracking-wider flex items-center gap-1.5">
                                      <Target className="h-3 w-3" /> Mục tiêu
                                    </label>
                                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                                      {item.objective}
                                    </p>
                                  </div>
                                  {/* Materials */}
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase font-black text-gray-400 tracking-wider flex items-center gap-1.5">
                                      <Files className="h-3 w-3" /> Tài liệu
                                    </label>
                                    <div className="text-xs">
                                      {parseAndRenderMaterial(item.materialRef)}
                                    </div>
                                  </div>
                                  {/* Trainer */}
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase font-black text-gray-400 tracking-wider flex items-center gap-1.5">
                                      <GraduationCap className="h-3 w-3" /> Phụ trách
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <div className="h-5 w-5 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xs font-bold">
                                        {item.trainer?.[0] || '?'}
                                      </div>
                                      <p className="text-xs font-medium text-gray-700">
                                        {item.trainer || '-'}
                                      </p>
                                    </div>
                                  </div>
                                  {/* Assessment */}
                                  <div className="space-y-1">
                                    <label className="text-xs uppercase font-black text-gray-400 tracking-wider flex items-center gap-1.5">
                                      <ClipboardCheck className="h-3 w-3" /> Đánh giá
                                    </label>
                                    <p className="text-xs font-medium text-gray-700">
                                      {item.assessment || '-'}
                                    </p>
                                  </div>
                                </div>

                                {/* Actions - COMPACT */}
                                <div className="flex items-center lg:flex-row gap-1 border-t lg:border-t-0 pt-2 lg:pt-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-blue-500 hover:bg-blue-50"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50"
                                    onClick={() => handleDelete(item.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      </div>
    </>
  )
}
