import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, getFileViewerUrl } from '@/lib/utils'
import { useSubmission } from '@/features/exam/hooks'
import { ESSAY_CRITERIA } from '@/features/exam-papers/criteria'
import { extractCriteriaWeights } from '@/lib/examScheduleTime'

const RUBRIC_CRITERIA = [
  {
    id: 'suy_ngam',
    title: 'Suy ngẫm và nhận thức cá nhân (40đ)',
    options: {
      chua_dat: { score: 10, desc: 'Chủ yếu nhắc lại nội dung sách.' },
      dat: { score: 25, desc: 'Nêu được bài học hoặc nhận thức riêng.' },
      tot: { score: 40, desc: 'Thể hiện sự thay đổi trong tư duy hoặc cách nhìn nhận vấn đề.' },
    },
  },
  {
    id: 'ket_noi',
    title: 'Kết nối với thực tế (30đ)',
    options: {
      chua_dat: { score: 10, desc: 'Ít hoặc chưa liên hệ với thực tế.' },
      dat: { score: 20, desc: 'Có liên hệ với bản thân hoặc công việc.' },
      tot: { score: 30, desc: 'Liên hệ cụ thể và thể hiện khả năng vận dụng.' },
    },
  },
  {
    id: 'phat_trien',
    title: 'Phát triển ý tưởng (30đ)',
    options: {
      chua_dat: { score: 10, desc: 'Chưa có quan điểm riêng.' },
      dat: { score: 20, desc: 'Có quan điểm hoặc câu hỏi riêng.' },
      tot: { score: 30, desc: 'Có phản biện, mở rộng hoặc đề xuất cách áp dụng mới.' },
    },
  },
]

export interface MemberSubmissionResultScreenProps {
  submissionId: string
}

export function MemberSubmissionResultScreen({ submissionId }: MemberSubmissionResultScreenProps) {
  const navigate = useNavigate()
  const { data: submission, isLoading } = useSubmission(submissionId)

  // Map question IDs to text from bank
  const questionMap = useMemo<Record<string, { stem: string; options: string[] }>>(() => {
    const map: Record<string, { stem: string; options: string[] }> = {}

    // 1. Try from submission's learningClass
    const bank = submission?.learningClass?.examQuestions || submission?.schedule?.examQuestions
    if (bank?.questions) {
      bank.questions.forEach((q: any) => {
        map[q.id] = { stem: q.stem, options: q.options || [] }
      })
      return map
    }

    // 2. Fallback to localStorage
    try {
      const raw = localStorage.getItem('manager_exam_question_bank_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        Object.values(parsed).forEach((b: any) => {
          b.questions?.forEach((q: any) => {
            if (!map[q.id]) map[q.id] = { stem: q.stem, options: q.options || [] }
          })
        })
      }
    } catch {
      console.error('Error parsing exam question bank from localStorage')
    }

    return map
  }, [submission])

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        Đang tải kết quả bài thi...
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy bài nộp này.</p>
        <Button
          type="button"
          variant="ghost"
          className="h-auto p-0 text-sm font-normal normal-case tracking-normal text-primary underline hover:bg-transparent"
          onClick={() => void navigate({ to: '/exam' })}
        >
          ← Quay lại danh sách
        </Button>
      </div>
    )
  }

  // Parse answers - can be object {questionId: answer}
  const answersObj: Record<string, string> = (() => {
    if (!submission?.answers) return {}
    if (Array.isArray(submission.answers)) return {}
    return submission.answers as Record<string, string>
  })()

  const answeredEntries = Object.entries(answersObj)
  const grades =
    (submission.grades as Record<string, { criteria: string[]; score: number; note?: string }>) ||
    {}

  const isFileSubmission = typeof answersObj === 'object' && 'fileUrl' in answersObj
  const gradingType = (submission?.schedule?.examQuestions as any)?.gradingType || 'direct'
  const criteriaWeights = extractCriteriaWeights(
    submission?.schedule?.examQuestions ?? submission?.learningClass?.examQuestions
  )
  const rubricGradesObj = (submission?.grades as any)?.rubric_reading || {}

  const formattedDate = new Date(submission.createdAt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="-m-5 flex min-h-[calc(100vh-3rem)] flex-col bg-app-canvas text-sm text-foreground md:-m-6 lg:-m-8">
      {/* Sub header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-primary/10 bg-card/50 px-6 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto shrink-0 gap-1 px-0 py-0 text-xs font-semibold normal-case tracking-normal text-muted-foreground hover:bg-transparent hover:text-primary"
            onClick={() => void navigate({ to: '/exam' })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Danh sách kỳ thi
          </Button>
          <div className="hidden h-4 w-px shrink-0 bg-border sm:block" />
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Kết quả thi:{' '}
            <span className="font-bold text-foreground">
              {submission.learningClass?.name ?? submission.fullName ?? 'Kỳ thi nội bộ'}
            </span>
          </p>
        </div>
      </div>

      <div className="page-shell">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Success Message Alert */}
          <div className="lg:col-span-12">
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900 shadow-sm ring-1 ring-emerald-200/50">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Bạn đã nộp bài thành công. Hệ thống đã ghi nhận câu trả lời của bạn.</span>
              </div>
            </div>
          </div>

          {/* Left: Answers & Feedback */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/* 1. Student Submission */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {isFileSubmission
                  ? 'Bài làm của bạn (File đính kèm)'
                  : `Bài làm của bạn (${answeredEntries.length} câu)`}
              </h2>
              {isFileSubmission ? (
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                    <ArrowLeft className="-rotate-90 h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {answersObj.fileName || 'File bài thi'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Bạn đã tải lên file bài thi thành công
                    </p>
                  </div>
                  {answersObj.fileUrl && (
                    <a
                      href={getFileViewerUrl(answersObj.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 rounded-xl px-4 flex items-center bg-primary text-white text-xs font-black uppercase tracking-widest shadow-sm hover:bg-primary/95 transition-all"
                    >
                      Tải về / Xem tệp
                    </a>
                  )}
                </div>
              ) : answeredEntries.length === 0 ? (
                <p className="italic text-muted-foreground">
                  Không có câu trả lời nào được ghi nhận.
                </p>
              ) : (
                <div className="space-y-5">
                  {answeredEntries.map(([qId, answer], idx) => {
                    const questionData = questionMap[qId]
                    const questionText = questionData?.stem || `Câu hỏi ${idx + 1}`
                    const rawGrade = grades[qId] as
                      | { criteria?: string[]; score?: number; note?: string; auto?: boolean }
                      | undefined
                    const questionGrade = {
                      criteria: rawGrade?.criteria ?? [],
                      score: rawGrade?.score ?? 0,
                      note: rawGrade?.note,
                    }
                    const isAutoGraded = rawGrade?.auto === true

                    return (
                      <div
                        key={qId}
                        className="border-b border-border/50 pb-6 last:border-0 last:pb-0"
                      >
                        <p className="mb-2 text-sm font-semibold text-foreground">
                          <span className="mr-1 font-bold text-primary">Câu {idx + 1}:</span>
                          {questionText}
                        </p>
                        <div
                          className={cn(
                            'mb-4 min-h-[44px] whitespace-pre-wrap rounded-lg border border-border p-3 text-sm',
                            answer?.trim()
                              ? 'bg-muted/30 text-foreground'
                              : 'bg-muted/10 italic text-muted-foreground'
                          )}
                        >
                          {answer?.trim()
                            ? answer.replace(/([^\n])\s*(\+)/g, '$1\n$2')
                            : 'Thí sinh không trả lời câu này'}
                        </div>

                        {submission.status === 'done' && gradingType !== 'rubric_reading' && (
                          <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Đánh giá
                              </span>
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-bold text-primary">
                                {questionGrade.score}%
                              </span>
                            </div>
                            {!isAutoGraded && (
                              <div className="flex flex-wrap gap-4">
                                {ESSAY_CRITERIA.map((c) => (
                                  <label
                                    key={c.id}
                                    className="flex cursor-default items-center gap-2 text-sm font-medium opacity-80"
                                  >
                                    <Checkbox
                                      className="shrink-0"
                                      checked={questionGrade.criteria.includes(c.id)}
                                      disabled
                                    />
                                    {c.label} ({criteriaWeights[c.id]}%)
                                  </label>
                                ))}
                              </div>
                            )}

                            {questionGrade.note && (
                              <div className="mt-4 border-t border-primary/10 pt-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-primary/60">
                                  Góp ý từ người chấm
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-relaxed text-foreground">
                                  {questionGrade.note}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 2. Rubric Assessment (if applicable) */}
            {submission.status === 'done' && gradingType === 'rubric_reading' && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-base font-black text-slate-800 uppercase tracking-wide">
                  Kết quả đánh giá theo Rubric Đọc sách
                </h2>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-3 font-bold text-slate-700 w-1/3">Tiêu chí</th>
                        <th className="px-4 py-3 font-bold text-orange-600 text-center w-2/9">
                          Chưa đạt
                        </th>
                        <th className="px-4 py-3 font-bold text-emerald-600 text-center w-2/9">
                          Đạt
                        </th>
                        <th className="px-4 py-3 font-bold text-indigo-600 text-center w-2/9">
                          Tốt
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {RUBRIC_CRITERIA.map((criteria) => {
                        const currentValue = rubricGradesObj[criteria.id] || null
                        return (
                          <tr key={criteria.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-4 font-bold text-slate-800 vertical-align-top">
                              {criteria.title}
                            </td>
                            {Object.entries(criteria.options).map(([optKey, optVal]) => {
                              const isChecked = currentValue === optKey
                              const colorClass =
                                optKey === 'chua_dat'
                                  ? 'data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600'
                                  : optKey === 'dat'
                                    ? 'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600'
                                    : 'data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600'
                              return (
                                <td
                                  key={optKey}
                                  className={cn(
                                    'px-4 py-4 text-center transition-all',
                                    isChecked &&
                                      (optKey === 'chua_dat'
                                        ? 'bg-orange-50/30'
                                        : optKey === 'dat'
                                          ? 'bg-emerald-50/30'
                                          : 'bg-indigo-50/30')
                                  )}
                                >
                                  <div className="flex flex-col items-center gap-2">
                                    <Checkbox
                                      className={cn('h-5 w-5 rounded-full border-2', colorClass)}
                                      checked={isChecked}
                                      disabled
                                    />
                                    <span
                                      className={cn(
                                        'text-xs font-black uppercase',
                                        isChecked
                                          ? optKey === 'chua_dat'
                                            ? 'text-orange-600'
                                            : optKey === 'dat'
                                              ? 'text-emerald-600'
                                              : 'text-indigo-600'
                                          : 'text-slate-400'
                                      )}
                                    >
                                      {optVal.score}đ
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[150px] mx-auto block">
                                      {optVal.desc}
                                    </span>
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grader note */}
            {submission.status === 'done' && (
              <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
                  Nhận xét của người chấm
                </h2>
                <div className="min-h-[100px] w-full whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-sm font-bold text-foreground">
                  {submission.graderNote || (
                    <span className="italic text-muted-foreground">
                      Không có nhận xét chi tiết.
                    </span>
                  )}
                </div>
                {submission.gradedAt && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Đã chấm lúc:{' '}
                    {new Date(submission.gradedAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: Summary sidebar */}
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="sticky top-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tóm tắt kết quả
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ngày làm bài</span>
                  <span className="font-medium text-foreground">{formattedDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {isFileSubmission ? 'Hình thức nộp' : 'Số câu trả lời'}
                  </span>
                  <span className="font-bold text-foreground font-semibold">
                    {isFileSubmission ? 'File đính kèm' : `${answeredEntries.length} câu`}
                  </span>
                </div>
                <div className="my-2 h-px w-full bg-border" />
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Tổng điểm trung bình</span>
                  <span className="text-lg font-bold text-primary">
                    {submission.totalScore != null
                      ? gradingType === 'rubric_reading'
                        ? `${submission.totalScore}đ`
                        : `${submission.totalScore}%`
                      : '—'}
                  </span>
                </div>
                <div className="my-2 h-px w-full bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trạng thái</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold',
                      submission.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : submission.status === 'grading'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                    )}
                  >
                    {submission.status === 'done'
                      ? 'Đã chấm'
                      : submission.status === 'grading'
                        ? 'Đang chấm'
                        : 'Chờ chấm'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
