import { useState } from 'react'
import { Eye, EyeOff, FileText, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ManagerScreenLayout } from '@/features/manager/components/ManagerHub/ManagerScreenLayout'
import { ExamManagementTabs } from '@/features/manager/components/ManagerHub/ExamManagementTabs'
import { BRAND_BTN_SOLID, BRAND_TEXT } from '@/components/shared/brandButtonStyles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { SkeletonSubmissionCardList } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/axios'
import {
  useCreateExamPaper,
  useDeleteExamPaper,
  useExamPapers,
  useUpdateExamPaper,
} from '@/features/exam-papers/hooks'
import type { ExamPaperInput, ExamPaperQuestionInput } from '@/features/exam-papers/api'
import { examPapersApi } from '@/features/exam-papers/api'
import {
  DEFAULT_ESSAY_CRITERIA_WEIGHTS,
  ESSAY_CRITERIA,
  sumCriteriaWeights,
  type EssayCriteriaWeights,
} from '@/features/exam-papers/criteria'

const OPTIONS_PER_MCQ = 4

type McqDraft = { stem: string; options: string[]; correctIndex: number }
type EssayDraft = { stem: string; criteriaWeights: EssayCriteriaWeights }

function emptyMcq(): McqDraft {
  return { stem: '', options: Array.from({ length: OPTIONS_PER_MCQ }, () => ''), correctIndex: 0 }
}

function emptyEssay(): EssayDraft {
  return { stem: '', criteriaWeights: { ...DEFAULT_ESSAY_CRITERIA_WEIGHTS } }
}

function toDraft(questions: ExamPaperQuestionInput[]): { mcq: McqDraft[]; essay: EssayDraft[] } {
  const mcq = questions
    .filter((q) => q.type === 'mcq')
    .map((q) => ({
      stem: q.stem,
      options:
        q.options && q.options.length > 0
          ? [...q.options]
          : Array.from({ length: OPTIONS_PER_MCQ }, () => ''),
      correctIndex: q.correctIndex ?? 0,
    }))
  const essay = questions
    .filter((q) => q.type === 'essay')
    .map((q) => ({
      stem: q.stem,
      criteriaWeights: { ...DEFAULT_ESSAY_CRITERIA_WEIGHTS, ...(q.criteriaWeights ?? {}) },
    }))
  // Không ép sẵn câu trống — đề có thể chỉ gồm trắc nghiệm hoặc chỉ tự luận
  return { mcq, essay }
}

function toQuestions(mcq: McqDraft[], essay: EssayDraft[]): ExamPaperQuestionInput[] {
  return [
    ...mcq.map((q, idx) => ({
      type: 'mcq' as const,
      stem: q.stem,
      options: q.options,
      correctIndex: q.correctIndex,
      points: 1,
      sortOrder: idx,
    })),
    ...essay.map((q, idx) => ({
      type: 'essay' as const,
      stem: q.stem,
      options: null,
      correctIndex: null,
      // Điểm câu tự luận không nhập tay nữa — chấm thuần theo % thang tiêu chí
      points: 1,
      criteriaWeights: q.criteriaWeights,
      sortOrder: mcq.length + idx,
    })),
  ]
}

function PaperBuilderForm({
  initial,
  onCancel,
  onSubmit,
  isSaving,
}: {
  initial: {
    code: string
    title: string
    description: string
    isActive: boolean
    passScore: number
    questions: ExamPaperQuestionInput[]
  }
  onCancel: () => void
  onSubmit: (input: ExamPaperInput) => void
  isSaving: boolean
}) {
  const [code, setCode] = useState(initial.code)
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [isActive, setIsActive] = useState(initial.isActive)
  const [passScore, setPassScore] = useState(initial.passScore)
  const draft = toDraft(initial.questions)
  const [mcq, setMcq] = useState<McqDraft[]>(draft.mcq)
  const [essay, setEssay] = useState<EssayDraft[]>(draft.essay)

  const updateMcq = (index: number, patch: Partial<McqDraft>) => {
    setMcq((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }
  const updateMcqOption = (index: number, optionIndex: number, value: string) => {
    setMcq((prev) =>
      prev.map((q, i) =>
        i === index
          ? { ...q, options: q.options.map((o, oi) => (oi === optionIndex ? value : o)) }
          : q
      )
    )
  }
  const updateEssay = (index: number, patch: Partial<EssayDraft>) => {
    setEssay((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên đề thi')
      return
    }
    if (mcq.length + essay.length === 0) {
      toast.error('Đề thi cần ít nhất 1 câu hỏi (trắc nghiệm hoặc tự luận)')
      return
    }
    if (!Number.isInteger(passScore) || passScore < 0 || passScore > 100) {
      toast.error('Ngưỡng điểm đạt phải là số nguyên từ 0 đến 100')
      return
    }
    for (const [idx, q] of mcq.entries()) {
      if (!q.stem.trim()) {
        toast.error(`Câu trắc nghiệm ${idx + 1}: thiếu nội dung`)
        return
      }
      if (q.options.some((o) => !o.trim())) {
        toast.error(`Câu trắc nghiệm ${idx + 1}: thiếu đáp án`)
        return
      }
    }
    for (const [idx, q] of essay.entries()) {
      if (!q.stem.trim()) {
        toast.error(`Câu tự luận ${idx + 1}: thiếu nội dung`)
        return
      }
      const total = sumCriteriaWeights(q.criteriaWeights)
      if (total !== 100) {
        toast.error(
          `Câu tự luận ${idx + 1}: tổng thang điểm 3 tiêu chí phải bằng 100% (hiện là ${total}%)`
        )
        return
      }
    }
    onSubmit({
      code: code.trim() || undefined,
      title: title.trim(),
      description: description.trim() || null,
      isActive,
      passScore,
      questions: toQuestions(mcq, essay),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-primary/20 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-bold text-foreground">
            {initial.code ? `Chỉnh sửa đề ${initial.code}` : 'Thêm đề thi mới'}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            onClick={onCancel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Mã đề (để trống để tự sinh)
              </label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="VD: DE_01"
                className="text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Tên đề thi <span className="text-danger">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Đề thi Editor tháng 7"
                className="text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mô tả</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú nội bộ về đề thi (không hiển thị cho học viên)"
              className="min-h-[60px] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Kích hoạt (được dùng khi tạo lịch thi)
            </label>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Ngưỡng điểm đạt (%)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passScore}
                onChange={(e) => setPassScore(Number(e.target.value) || 0)}
                className="text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Học viên đạt điểm ≥ ngưỡng này khi chấm xong sẽ tự động được đánh giá "Đạt".
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Câu trắc nghiệm ({mcq.length})</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setMcq((prev) => [...prev, emptyMcq()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm câu
              </Button>
            </div>
            {mcq.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground">
                Chưa có câu trắc nghiệm — có thể bỏ trống nếu đề chỉ gồm tự luận.
              </p>
            ) : null}
            <div className="space-y-3">
              {mcq.map((q, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-2 text-xs font-bold text-muted-foreground">{idx + 1}.</span>
                    <Textarea
                      value={q.stem}
                      onChange={(e) => updateMcq(idx, { stem: e.target.value })}
                      placeholder="Nội dung câu hỏi"
                      className="min-h-[44px] flex-1 text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setMcq((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`mcq-${idx}-correct`}
                          checked={q.correctIndex === oi}
                          onChange={() => updateMcq(idx, { correctIndex: oi })}
                          className="h-4 w-4 shrink-0"
                        />
                        <Input
                          value={opt}
                          onChange={(e) => updateMcqOption(idx, oi, e.target.value)}
                          placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                          className="text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="ml-6 mt-1 text-xs text-muted-foreground">
                    Chọn radio ở đáp án đúng.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Câu tự luận ({essay.length})</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setEssay((prev) => [...prev, emptyEssay()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm câu
              </Button>
            </div>
            {essay.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/10 p-3 text-xs text-muted-foreground">
                Chưa có câu tự luận — có thể bỏ trống nếu đề chỉ gồm trắc nghiệm.
              </p>
            ) : null}
            <div className="space-y-3">
              {essay.map((q, idx) => {
                const weightTotal = sumCriteriaWeights(q.criteriaWeights)
                return (
                  <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 text-xs font-bold text-muted-foreground">
                        {idx + 1}.
                      </span>
                      <Textarea
                        value={q.stem}
                        onChange={(e) => updateEssay(idx, { stem: e.target.value })}
                        placeholder="Nội dung câu hỏi tự luận"
                        className="min-h-[60px] flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => setEssay((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Thang điểm đánh giá — text tiêu chí fix cứng, giáo viên chấm theo % này */}
                    <div className="ml-6 mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          Thang điểm đánh giá
                        </span>
                        <span
                          className={
                            weightTotal === 100
                              ? 'text-xs font-bold text-emerald-600'
                              : 'text-xs font-bold text-rose-600'
                          }
                        >
                          Tổng: {weightTotal}%{weightTotal !== 100 ? ' — phải bằng 100%' : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {ESSAY_CRITERIA.map((c) => (
                          <div key={c.id} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-foreground">
                              {c.label}
                            </label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={q.criteriaWeights[c.id]}
                                onChange={(e) =>
                                  updateEssay(idx, {
                                    criteriaWeights: {
                                      ...q.criteriaWeights,
                                      [c.id]: Math.max(
                                        0,
                                        Math.min(100, Number(e.target.value) || 0)
                                      ),
                                    },
                                  })
                                }
                                className="h-8 w-20 text-sm"
                              />
                              <span className="text-xs font-bold text-primary">%</span>
                            </div>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              {c.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="button"
            className={BRAND_BTN_SOLID}
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Đang lưu...' : 'Lưu đề thi'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ExamPapersManagementScreen() {
  const { data: papers = [], isLoading, isError, error, refetch, isFetching } = useExamPapers()
  const createPaper = useCreateExamPaper()
  const updatePaper = useUpdateExamPaper()
  const deletePaper = useDeleteExamPaper()

  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDetail, setEditingDetail] = useState<{
    code: string
    title: string
    description: string
    isActive: boolean
    passScore: number
    questions: ExamPaperQuestionInput[]
  } | null>(null)

  const startEdit = async (id: string) => {
    try {
      const detail = await examPapersApi.getById(id)
      setEditingDetail({
        code: detail.code,
        title: detail.title,
        description: detail.description ?? '',
        isActive: detail.isActive,
        passScore: detail.passScore,
        questions: detail.questions,
      })
      setEditingId(id)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <ManagerScreenLayout hideHubNav hideToolbar>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Quản lý đề thi</h1>
          <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tạo, sửa, xóa các đề thi — trắc nghiệm, tự luận hoặc kết hợp cả hai — dùng cho lịch thi.
            Khi lịch thi gán nhiều đề, mỗi thành viên sẽ được gán ngẫu nhiên 1 đề khi tham gia thi.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ExamManagementTabs active="/manager/exam-papers" className="mb-0" />
          <Button
            type="button"
            className={cn('h-10 gap-2 rounded-lg px-4 text-sm font-semibold', BRAND_BTN_SOLID)}
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Thêm đề thi
          </Button>
        </div>
      </div>
      <div className="mb-8 flex flex-col gap-6">
        {isError ? (
          <ErrorState
            title="Không tải được danh sách đề thi"
            description={getApiErrorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : isLoading ? (
          <SkeletonSubmissionCardList count={3} />
        ) : papers.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Chưa có đề thi nào"
            description="Tạo đề thi đầu tiên để dùng khi thiết lập lịch thi."
            action={
              <Button
                type="button"
                className={cn('gap-2', BRAND_BTN_SOLID)}
                onClick={() => setIsCreating(true)}
              >
                <Plus className="h-4 w-4" />
                Thêm đề thi
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {papers.map((p) => (
              <Card
                key={p.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-xs font-bold tracking-wider', BRAND_TEXT)}>
                      {p.code}
                    </span>
                    <Badge
                      variant={p.isActive ? 'success' : 'muted'}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    >
                      {p.isActive ? 'Đang dùng' : 'Đã tắt'}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        'h-7 w-7 rounded-md text-muted-foreground hover:bg-[#006C49]/10',
                        BRAND_TEXT
                      )}
                      onClick={() => void startEdit(p.id)}
                      title="Sửa đề"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        updatePaper.mutate({ id: p.id, input: { isActive: !p.isActive } })
                      }
                      title={p.isActive ? 'Tắt kích hoạt' : 'Kích hoạt'}
                    >
                      {p.isActive ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
                          title="Xóa đề"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Xóa đề thi {p.code}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {p.submissionCount > 0
                              ? `Đề này đã có ${p.submissionCount} bài thi — không thể xóa, hãy tắt kích hoạt thay vì xóa.`
                              : 'Hành động này không thể hoàn tác.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={p.submissionCount > 0}
                            onClick={() => deletePaper.mutate(p.id)}
                          >
                            Xóa
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <h3 className="mb-1 truncate text-sm font-bold text-foreground">{p.title}</h3>
                {p.description ? (
                  <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                ) : (
                  <div className="mb-4" />
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>{p.mcqCount} trắc nghiệm</span>
                  <span className="text-border">•</span>
                  <span>{p.essayCount} tự luận</span>
                  <span className="text-border">•</span>
                  <span>{p.submissionCount} bài đã nộp</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {isCreating ? (
        <PaperBuilderForm
          initial={{
            code: '',
            title: '',
            description: '',
            isActive: true,
            passScore: 80,
            questions: [],
          }}
          isSaving={createPaper.isPending}
          onCancel={() => setIsCreating(false)}
          onSubmit={(input) => createPaper.mutate(input, { onSuccess: () => setIsCreating(false) })}
        />
      ) : null}

      {editingId && editingDetail ? (
        <PaperBuilderForm
          initial={editingDetail}
          isSaving={updatePaper.isPending}
          onCancel={() => {
            setEditingId(null)
            setEditingDetail(null)
          }}
          onSubmit={(input) =>
            updatePaper.mutate(
              { id: editingId, input },
              {
                onSuccess: () => {
                  setEditingId(null)
                  setEditingDetail(null)
                },
              }
            )
          }
        />
      ) : null}
    </ManagerScreenLayout>
  )
}
