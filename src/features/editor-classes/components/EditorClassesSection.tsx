import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SkeletonSubmissionCardList } from '@/components/ui/skeleton'
import {
  useBulkCreateExamSchedules,
  useEditorClasses,
  useSyncEditorClasses,
} from '@/features/editor-classes/hooks'
import type {
  bulkExamScheduleResultApiSchema,
  editorClassSyncReportApiSchema,
} from '@/features/editor-classes/schemas'
import { useExamPapers } from '@/features/exam-papers/hooks'
import { getApiErrorMessage } from '@/lib/axios'
import { addMinutesToHm } from '@/lib/examScheduleTime'
import { CalendarPlus, Loader2, RefreshCw, School } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'

type SyncReport = z.infer<typeof editorClassSyncReportApiSchema>
type BulkResult = z.infer<typeof bulkExamScheduleResultApiSchema>

function SyncPreviewCard({ report }: { report: SyncReport }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-foreground">
        {report.dryRun ? 'Xem trước đồng bộ' : 'Kết quả đồng bộ'} · {report.totalEditors} editor
      </h3>
      <div className="mt-2 space-y-2">
        {report.teams.map((t) => (
          <div
            key={t.teamId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
          >
            <div>
              <span className="font-semibold text-foreground">{t.className}</span>
              <span className="ml-2 text-muted-foreground">
                GV: {t.teacherName ?? '— (team chưa có leader)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  t.action === 'created' ? 'success' : t.action === 'updated' ? 'warning' : 'muted'
                }
              >
                {t.action === 'created'
                  ? 'Tạo mới'
                  : t.action === 'updated'
                    ? 'Cập nhật'
                    : 'Không đổi'}
              </Badge>
              {t.addedMembers > 0 ? (
                <span className="text-emerald-600">+{t.addedMembers}</span>
              ) : null}
              {t.removedMembers > 0 ? (
                <span className="text-rose-600">-{t.removedMembers}</span>
              ) : null}
              {t.pendingUnderOneMonth.length > 0 ? (
                <span className="text-muted-foreground" title={t.pendingUnderOneMonth.join(', ')}>
                  {t.pendingUnderOneMonth.length} chưa đủ 1 tháng
                </span>
              ) : null}
            </div>
          </div>
        ))}
        {report.closedOrphanClasses.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Đã đóng {report.closedOrphanClasses.length} lớp không còn editor:{' '}
            {report.closedOrphanClasses.map((c) => c.name).join(', ')}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

function BulkScheduleForm({ onResult }: { onResult: (r: BulkResult) => void }) {
  const { data: papers = [], isLoading: loadingPapers } = useExamPapers()
  const bulkCreate = useBulkCreateExamSchedules()
  const [dateIso, setDateIso] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [durationInput, setDurationInput] = useState('90')
  const [topic, setTopic] = useState('Thi định kỳ lớp Editor')
  const activePapers = papers.filter((p) => p.isActive)

  // Mặc định chọn tất cả đề đang kích hoạt (hành vi cũ) — chỉ dùng danh sách tự chọn khi người dùng đã chỉnh
  const [touchedPapers, setTouchedPapers] = useState(false)
  const [pickedPaperIds, setPickedPaperIds] = useState<string[]>([])
  const selectedPaperIds = touchedPapers ? pickedPaperIds : activePapers.map((p) => p.id)

  const togglePaper = (paperId: string) => {
    setTouchedPapers(true)
    setPickedPaperIds(
      selectedPaperIds.includes(paperId)
        ? selectedPaperIds.filter((id) => id !== paperId)
        : [...selectedPaperIds, paperId]
    )
  }

  const submit = (dryRun: boolean) => {
    if (!dateIso) return
    const durationMin = Number.parseInt(durationInput.trim(), 10)
    if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440) {
      toast.error('Thời gian làm bài phải từ 1 đến 1440 phút')
      return
    }
    if (selectedPaperIds.length === 0) {
      toast.error('Chọn ít nhất 1 đề thi')
      return
    }
    bulkCreate.mutate(
      {
        dateIso,
        startTime,
        endTime: addMinutesToHm(startTime, durationMin),
        topic,
        paperIds: selectedPaperIds,
        durationMinutes: durationMin,
        dryRun,
      },
      { onSuccess: onResult }
    )
  }

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <CalendarPlus className="h-4 w-4" />
        Tạo lịch thi cho tất cả lớp Editor
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ngày thi</label>
          <Input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Giờ bắt đầu
          </label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Thời gian làm bài (phút)
          </label>
          <Input
            inputMode="numeric"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value.replace(/\D/g, ''))}
            placeholder="90"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Chủ đề</label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
          Đề thi ({selectedPaperIds.length} đã chọn)
        </label>
        {loadingPapers ? (
          <div className="flex items-center justify-center rounded-lg border border-border bg-muted/20 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : activePapers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            Chưa có đề thi nào đang kích hoạt — tạo đề ở màn Quản lý đề thi trước.
          </p>
        ) : (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/10 p-1.5">
            {activePapers.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-primary/5"
              >
                <input
                  type="checkbox"
                  checked={selectedPaperIds.includes(p.id)}
                  onChange={() => togglePaper(p.id)}
                  className="h-4 w-4 shrink-0 rounded border-border"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-foreground">
                    <span className="font-mono text-primary">{p.code}</span> · {p.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {p.mcqCount} trắc nghiệm · {p.essayCount} tự luận
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Giờ kết thúc = giờ bắt đầu + thời gian làm bài
        {durationInput
          ? ` (kết thúc ${addMinutesToHm(startTime, Number.parseInt(durationInput, 10) || 0)})`
          : ''}
        . Mỗi thành viên sẽ được gán ngẫu nhiên 1 trong các đề đã chọn khi vào thi. Giáo viên chấm
        được phân công chấm chéo (không chấm lớp mình dạy).
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dateIso || bulkCreate.isPending || selectedPaperIds.length === 0}
          onClick={() => submit(true)}
        >
          Xem trước
        </Button>
        <Button
          type="button"
          disabled={!dateIso || bulkCreate.isPending || selectedPaperIds.length === 0}
          onClick={() => submit(false)}
        >
          {bulkCreate.isPending ? 'Đang tạo...' : 'Tạo lịch thi'}
        </Button>
      </div>
    </Card>
  )
}

function BulkResultCard({ result }: { result: BulkResult }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-foreground">
        {result.dryRun ? 'Xem trước lịch thi' : 'Đã tạo lịch thi'} ngày {result.dateIso}
      </h3>
      <div className="mt-2 space-y-2">
        {result.classes.map((c) => (
          <div
            key={c.classId}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-foreground">{c.className}</span>
            {c.skipped ? (
              <Badge variant="muted">{c.skipReason ?? 'Bỏ qua'}</Badge>
            ) : (
              <span className="text-muted-foreground">
                Chấm chéo bởi: {c.graderName ?? '—'} · {c.paperCount} đề
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function EditorClassesSection() {
  const { data: classes = [], isLoading, isError, error, refetch, isFetching } = useEditorClasses()
  const sync = useSyncEditorClasses()
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-4 border-b border-slate-50 px-8 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Lớp Editor</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi team có editor sẽ có 1 lớp riêng — leader team làm giáo viên. Đồng bộ để tự động tạo
            lớp, thêm editor đủ 1 tháng, và tạo lịch thi hàng loạt với chấm chéo.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={sync.isPending}
            onClick={() => sync.mutate(true, { onSuccess: setSyncReport })}
          >
            <RefreshCw className="h-4 w-4" />
            Xem trước
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={sync.isPending}
            onClick={() =>
              sync.mutate(false, {
                onSuccess: (r) => {
                  setSyncReport(r)
                  void refetch()
                },
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            {sync.isPending ? 'Đang đồng bộ...' : 'Đồng bộ lớp Editor'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {syncReport ? <SyncPreviewCard report={syncReport} /> : null}

        {isError ? (
          <ErrorState
            title="Không tải được danh sách lớp Editor"
            description={getApiErrorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        ) : isLoading ? (
          <SkeletonSubmissionCardList count={3} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={<School className="h-8 w-8" />}
            title="Chưa có lớp Editor nào"
            description="Bấm Đồng bộ lớp Editor để tự động tạo lớp theo team đang có editor."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {classes.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Team: {c.teamName ?? '—'} · GV: {c.teacherName ?? '—'} · {c.memberCount} thành
                      viên
                    </p>
                  </div>
                  <Badge variant={c.status === 'closed' ? 'muted' : 'success'}>
                    {c.status === 'closed' ? 'Đã đóng' : 'Đang hoạt động'}
                  </Badge>
                </div>
                {c.latestExamSchedule ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Lịch thi gần nhất: {c.latestExamSchedule.dateIso} (
                    {c.latestExamSchedule.startTime}–{c.latestExamSchedule.endTime}) · Chấm:{' '}
                    {c.latestExamSchedule.examTeacherUser?.fullNameLegal ?? '—'}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        )}

        <BulkScheduleForm onResult={setBulkResult} />
        {bulkResult ? <BulkResultCard result={bulkResult} /> : null}
      </div>
    </div>
  )
}
