import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useManagerSubmissions } from '@/features/exam/hooks'
import type { examSubmissionApiSchema } from '@/features/exam/schemas'
import {
  Loader2,
  User,
  Trophy,
  Calendar,
  Search,
  X,
  ChevronDown,
  ExternalLink,
  FileText,
  Download,
} from 'lucide-react'
import { cn, getFileViewerUrl, isOfficeDocumentUrl, resolveFileUrl } from '@/lib/utils'

type ExamSubmission = z.infer<typeof examSubmissionApiSchema>

interface ClassMembersScoresModalProps {
  isOpen: boolean
  onClose: () => void
  classId: string
  scheduleId?: string
  className?: string
  examTopic?: string
}

export function ClassMembersScoresModal({
  isOpen,
  onClose,
  classId,
  scheduleId,
  className,
  examTopic,
}: ClassMembersScoresModalProps) {
  const { data: allSubmissions = [], isLoading } = useManagerSubmissions(
    { classId, scheduleId },
    { enabled: isOpen }
  )
  const [searchTerm, setSearchTerm] = useState('')

  const classSubmissions = useMemo(() => {
    let rows = allSubmissions.filter((s) => s.classId === classId)
    if (scheduleId) {
      const sid = scheduleId.toLowerCase()
      rows = rows.filter((s) => s.scheduleId?.toLowerCase() === sid)
    }
    return rows
  }, [allSubmissions, classId, scheduleId])

  const filteredSubmissions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return classSubmissions
    return classSubmissions.filter((s) => s.fullName.toLowerCase().includes(q))
  }, [classSubmissions, searchTerm])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-gradient-to-br from-primary/10 via-white to-transparent px-8 pt-8 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                Thành viên & Điểm số
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 font-medium line-clamp-2">
                {scheduleId && examTopic
                  ? className
                    ? `Kết quả thi "${examTopic}" — Lớp ${className}`
                    : `Kết quả thi "${examTopic}"`
                  : className
                    ? `Danh sách học viên và kết quả thi — Lớp ${className}`
                    : 'Danh sách học viên và kết quả thi của lớp'}
              </p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <Trophy className="h-6 w-6" />
            </div>
          </div>

          <div className="relative mt-6 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Tìm kiếm theo tên học viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-11 pr-10 rounded-xl border-slate-200 bg-white/50 focus:bg-white transition-all shadow-sm focus:ring-primary/10"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                aria-label="Xóa tìm kiếm"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-2">
          <div className="h-[400px] overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {isLoading ? (
              <div className="flex h-full items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium">
                  {searchTerm
                    ? 'Không tìm thấy học viên phù hợp.'
                    : 'Lớp này chưa có dữ liệu bài nộp.'}
                </p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="grid grid-cols-1 gap-3">
                {filteredSubmissions.map((sub) => (
                  <AccordionItem
                    key={sub.id}
                    value={sub.id}
                    className="rounded-2xl border border-slate-100 bg-white hover:border-primary/20 hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    <AccordionTrigger className="group flex items-center justify-between gap-3 p-4 hover:bg-transparent rounded-none">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 text-left">
                          <h4 className="font-bold text-slate-800 leading-none mb-1.5 truncate">
                            {sub.fullName}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              {sub.createdAt
                                ? new Date(sub.createdAt).toLocaleDateString('vi-VN')
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right mr-1 hidden sm:block">
                          <p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-none mb-1">
                            Điểm số
                          </p>
                          <p
                            className={cn(
                              'text-xl font-black tracking-tighter tabular-nums',
                              sub.totalScore === null || sub.totalScore === undefined
                                ? 'text-slate-400'
                                : sub.totalScore >= 90
                                  ? 'text-emerald-600'
                                  : sub.totalScore >= 40
                                    ? 'text-primary'
                                    : 'text-rose-500'
                            )}
                          >
                            {sub.totalScore !== null && sub.totalScore !== undefined
                              ? `${sub.totalScore}%`
                              : 'N/A'}
                          </p>
                        </div>
                        <Badge
                          variant={sub.status === 'done' ? 'default' : 'muted'}
                          className={cn(
                            'rounded-lg px-2 py-0.5 text-xs font-black uppercase tracking-tighter',
                            sub.status === 'done'
                              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none'
                              : ''
                          )}
                        >
                          {sub.status === 'done' ? 'Đã chấm' : 'Chưa chấm'}
                        </Badge>
                        <ChevronDown className="chevron-accordion h-4 w-4 shrink-0 text-slate-400" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <SubmissionWorkPanel submission={sub} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-end items-center gap-3">
          <p className="mr-auto text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hiển thị: {filteredSubmissions.length} / {classSubmissions.length} học viên
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function parseSubmissionAnswers(submission: ExamSubmission): Record<string, string> {
  if (!submission.answers) return {}
  if (Array.isArray(submission.answers)) return {}
  return submission.answers as Record<string, string>
}

function buildQuestionStemMap(submission: ExamSubmission): Record<string, string> {
  const map: Record<string, string> = {}

  submission.examPaper?.questions?.forEach((q) => {
    map[q.id] = q.stem
  })
  if (Object.keys(map).length > 0) return map

  const bank = submission.learningClass?.examQuestions || submission.schedule?.examQuestions
  const questions = (bank as { questions?: Array<{ id: string; stem: string }> } | null)?.questions
  questions?.forEach((q) => {
    map[q.id] = q.stem
  })
  return map
}

interface SubmissionWorkPanelProps {
  submission: ExamSubmission
}

function SubmissionWorkPanel({ submission }: SubmissionWorkPanelProps) {
  const navigate = useNavigate()
  const answersObj = parseSubmissionAnswers(submission)
  const questionMap = useMemo(() => buildQuestionStemMap(submission), [submission])
  const isFileSubmission = 'fileUrl' in answersObj && Boolean(answersObj.fileUrl)
  const answeredEntries = Object.entries(answersObj).filter(
    ([key]) => key !== 'fileUrl' && key !== 'fileName'
  )

  const fileName = answersObj.fileName || 'File bài thi'
  const fileUrl = resolveFileUrl(answersObj.fileUrl)
  const viewerUrl = getFileViewerUrl(answersObj.fileUrl)
  const isOfficeDoc = isOfficeDocumentUrl(fileUrl, fileName)

  const openGradePage = () => {
    void navigate({ to: '/exam/$examId/grade', params: { examId: submission.id } })
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Bài làm đã nộp
        </p>
        {/* <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs font-bold gap-1.5"
          onClick={openGradePage}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Xem & chấm bài
        </Button> */}
      </div>

      {isFileSubmission ? (
        <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{fileName}</p>
              <p className="text-xs text-slate-400">
                {isOfficeDoc
                  ? 'File Word/Office — xem trực tuyến hoặc tải về'
                  : 'Học viên đã nộp file đính kèm'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={viewerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white hover:bg-primary/95"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isOfficeDoc ? 'Xem online' : 'Xem file'}
            </a>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              download={fileName}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Tải về
            </a>
          </div>

          {isOfficeDoc && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Xem online dùng Microsoft Office Viewer (cần file public). Nếu không mở được, dùng{' '}
              <span className="font-semibold text-slate-500">Tải về</span> để mở bằng Word trên máy.
            </p>
          )}
        </div>
      ) : answeredEntries.length === 0 ? (
        <p className="text-sm italic text-slate-400">Chưa có câu trả lời được ghi nhận.</p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
          {answeredEntries.map(([qId, answer], idx) => {
            const questionText = questionMap[qId] || `Câu hỏi ${idx + 1}`
            return (
              <button
                key={qId}
                type="button"
                onClick={openGradePage}
                className="w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <p className="mb-1 text-xs font-bold text-primary">Câu {idx + 1}</p>
                <p className="mb-1 line-clamp-1 text-xs font-semibold text-slate-700">
                  {questionText}
                </p>
                <p className="line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">
                  {answer?.trim() ? answer : 'Chưa trả lời'}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {submission.schedule?.topic && (
        <p className="text-[11px] text-slate-400">
          Kỳ thi: <span className="font-semibold text-slate-600">{submission.schedule.topic}</span>
        </p>
      )}
    </div>
  )
}
