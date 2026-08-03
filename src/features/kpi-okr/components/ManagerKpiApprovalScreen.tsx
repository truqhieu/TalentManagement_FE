import { ConfirmDialog } from '@/components/shared/ConfirmDialog/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  performanceApi,
  type ApprovalRequest,
  type ApprovalRequestType,
  type PerformanceAssignment,
  type PerformanceKind,
  type PerformanceSummaryRow,
} from '@/features/kpi-okr/api'
import {
  EvalStatusBadge,
  GoalReviewStatusBadge,
  GoalReviewSummary,
  formatViNumber,
  resolveParentKpiDisplay,
} from '@/features/kpi-okr/components/kpiAssignmentTableShared'
import {
  EvidenceImagePreviews,
  evidenceImageUrlsFromText,
  evidenceTextWithoutUploadPaths,
} from '@/features/kpi-okr/components/KpiEvidenceInput'
import { EvalToggleGroup, KpiProgressBar } from '@/features/kpi-okr/components/KpiProgressBar'
import {
  AssignmentSubItemsInline,
  SubItemsDraftEditor,
  mapSubItemsToPayload,
  subItemsFromAssignment,
} from '@/features/kpi-okr/components/kpiSubItemsShared'
import { MemberEvaluationSummaryCard } from '@/features/kpi-okr/components/MemberEvaluationSummaryCard'
import { MemberKpiDetailDrawer } from '@/features/kpi-okr/components/MemberKpiDetailDrawer'
import { useKpiOkrStream } from '@/features/kpi-okr/useKpiOkrStream'
import type { SubItemDraft } from '@/features/kpi-okr/utils/kpiProgressUtils'
import {
  computeRowProgress,
  computeSubItemProgress,
} from '@/features/kpi-okr/utils/kpiProgressUtils'
import { getApiErrorMessage } from '@/lib/axios'
import { CARD_ENTRANCE } from '@/lib/cardMotion'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { cn } from '@/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

function nowYm() {
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() + 1 }
}

function ApprovalStatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  if (status === 'pending')
    return (
      <Badge className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
        <Clock className="h-3 w-3" />
        Chờ duyệt
      </Badge>
    )
  if (status === 'approved')
    return (
      <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
        <CheckCircle2 className="h-3 w-3" />
        Đã duyệt
      </Badge>
    )
  return (
    <Badge className="gap-1 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
      <X className="h-3 w-3" />
      Từ chối
    </Badge>
  )
}

// ── Inline KPI viewer (expandable inside team card, no modal) ──

function formatKpiSetAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

function PriorityText({ priority }: { priority: number }) {
  if (priority === 1) return <span className="font-semibold text-rose-600 text-xs">P1 - Cao</span>
  if (priority === 2) return <span className="font-semibold text-amber-600 text-xs">P2 - TB</span>
  if (priority === 3) return <span className="font-semibold text-slate-500 text-xs">P3 - Thấp</span>
  return <span className="text-xs text-slate-400">—</span>
}

function TeamResultInline({
  teamId,
  year,
  month,
  requestStatus,
  onEvaluationsChange,
  onOpenDetail,
}: {
  teamId: string
  year: number
  month: number
  requestStatus: ApprovalRequest['status']
  onEvaluationsChange?: (
    evals: {
      assignmentId: string
      status: 'OK' | 'NOT'
      managerReviewNote?: string | null
    }[],
    allEvaluated: boolean
  ) => void
  onOpenDetail?: (member: { userId: string; name: string; items: PerformanceAssignment[] }) => void
}) {
  const assignmentsQ = useQuery({
    queryKey: ['kpi-assignments-result', teamId, year, month],
    queryFn: () => performanceApi.listAssignments(teamId, year, month),
    enabled: !isMockApiEnabled(),
  })

  const summariesQ = useQuery({
    queryKey: ['kpi-summaries-result', teamId, year, month],
    queryFn: () => performanceApi.listSummaries(teamId, year, month),
    enabled: !isMockApiEnabled(),
  })

  const [evalMap, setEvalMap] = useState<Record<string, 'OK' | 'NOT'>>({})
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({})

  const assignments = assignmentsQ.data ?? []
  const summaries = summariesQ.data ?? []
  const summaryByUser = useMemo(
    () => new Map<string, PerformanceSummaryRow>(summaries.map((s) => [s.assigneeUserId, s])),
    [summaries]
  )

  useEffect(() => {
    if (assignments.length > 0) {
      const initialMap: Record<string, 'OK' | 'NOT'> = {}
      const initialNotes: Record<string, string> = {}
      for (const a of assignments) {
        if (a.finalEvalStatus === 'OK' || a.finalEvalStatus === 'NOT') {
          initialMap[a.id] = a.finalEvalStatus as 'OK' | 'NOT'
        }
        if (a.managerReviewNote?.trim()) {
          initialNotes[a.id] = a.managerReviewNote.trim()
        }
      }
      setEvalMap(initialMap)
      setNoteMap(initialNotes)
    }
  }, [assignments])

  useEffect(() => {
    if (onEvaluationsChange && assignments.length > 0) {
      const evals = assignments
        .filter((a) => evalMap[a.id] === 'OK' || evalMap[a.id] === 'NOT')
        .map((a) => ({
          assignmentId: a.id,
          status: evalMap[a.id] as 'OK' | 'NOT',
          managerReviewNote: noteMap[a.id]?.trim() || null,
        }))
      const allEvaluated = assignments.every(
        (a) => evalMap[a.id] === 'OK' || evalMap[a.id] === 'NOT'
      )
      onEvaluationsChange(evals, allEvaluated)
    }
  }, [assignments, evalMap, noteMap, onEvaluationsChange])

  const handleStatusChange = (assignmentId: string, status: 'OK' | 'NOT' | undefined) => {
    setEvalMap((prev) => {
      const next = { ...prev }
      if (!status) delete next[assignmentId]
      else next[assignmentId] = status
      return next
    })
  }

  const setAllEvaluations = (status: 'OK' | 'NOT') => {
    const next: Record<string, 'OK' | 'NOT'> = {}
    for (const a of assignments) next[a.id] = status
    setEvalMap(next)
  }

  const evaluatedCount = assignments.filter(
    (a) => evalMap[a.id] === 'OK' || evalMap[a.id] === 'NOT'
  ).length

  if (assignmentsQ.isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (assignments.length === 0) {
    return <p className="p-3 text-center text-xs text-slate-400">Chưa có kết quả KPI/OKR nào.</p>
  }

  const grouped: { userId: string; name: string; items: PerformanceAssignment[] }[] = []
  for (const a of assignments) {
    const last = grouped[grouped.length - 1]
    if (last && last.userId === a.assigneeUserId) {
      last.items.push(a)
    } else {
      grouped.push({
        userId: a.assigneeUserId,
        name: a.assigneeDisplayName ?? a.assigneeUserId,
        items: [a],
      })
    }
  }

  const resultTableHead = [
    'Ngày xét',
    'Hạng mục',
    'Ưu tiên',
    'Nội dung',
    'Chỉ tiêu',
    'Số liệu',
    'Tiến độ',
    'Đơn vị',
    'Minh chứng',
    'Tự đánh giá',
    'Nhận xét NV',
    'Đánh giá Leader',
    'Ghi chú QL',
    'Đánh giá Manager',
  ] as const

  const renderAssignmentRow = (a: PerformanceAssignment, isSub = false, subLabel?: string) => {
    const displayEv = evidenceTextWithoutUploadPaths(a.evidence)
    const hasImagePreviews = evidenceImageUrlsFromText(a.evidence).length > 0
    const parentDisplay = !isSub ? resolveParentKpiDisplay(a) : null
    const progress = isSub
      ? (computeRowProgress(a.numericValue ?? null, a.targetMetric, a.progressPercent) ?? null)
      : (parentDisplay?.progress ?? null)
    const missingEvidence = !a.evidence?.trim() && !hasImagePreviews
    const evalStatus = evalMap[a.id]
    const rowBorder =
      requestStatus === 'pending' && evalStatus === 'OK'
        ? 'border-l-4 border-l-emerald-500'
        : requestStatus === 'pending' && evalStatus === 'NOT'
          ? 'border-l-4 border-l-rose-500'
          : missingEvidence
            ? 'border-l-4 border-l-amber-400'
            : ''

    return (
      <tr
        key={isSub ? `${a.id}-sub-${subLabel}` : a.id}
        className={cn(
          'border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30',
          rowBorder,
          isSub && 'bg-slate-50/40 dark:bg-slate-900/20'
        )}
      >
        <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-slate-500">
          {isSub ? '' : formatKpiSetAt(a.kpiSetAt)}
        </td>
        <td className="px-2.5 py-2">
          {!isSub && (
            <span
              className={cn(
                'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold',
                a.kind === 'KPI'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
              )}
            >
              {a.kind}
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2">
          {!isSub && <PriorityText priority={a.priority} />}
        </td>
        <td
          className={cn(
            'px-2.5 py-2 max-w-[280px] whitespace-pre-wrap text-slate-700 dark:text-slate-200',
            isSub && 'pl-6 text-[11px] text-slate-500'
          )}
        >
          {isSub ? `↳ ${subLabel}` : a.content}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2 tabular-nums font-semibold text-slate-700 dark:text-slate-200">
          {isSub
            ? (a.targetMetric ?? '—')
            : a.targetMetric?.trim()
              ? a.targetMetric.trim()
              : (parentDisplay?.targetMetric ?? '—')}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2 tabular-nums font-semibold text-slate-800 dark:text-slate-100">
          {isSub ? formatViNumber(a.numericValue) : (parentDisplay?.numericLabel ?? '—')}
        </td>
        <td className="min-w-[100px] px-2.5 py-2">
          {progress != null ? (
            <KpiProgressBar value={progress} barClassName="h-1.5" />
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2 text-xs uppercase text-slate-600">
          {isSub ? a.numericUnit?.trim() || '—' : (parentDisplay?.numericUnit ?? '—')}
        </td>
        <td className="max-w-[160px] min-w-[120px] px-2.5 py-2">
          {!isSub && (
            <>
              {displayEv ? (
                <span className="line-clamp-3 whitespace-pre-wrap break-all text-slate-600">
                  {displayEv}
                </span>
              ) : hasImagePreviews ? null : (
                <span className="text-slate-400">—</span>
              )}
              <EvidenceImagePreviews evidence={a.evidence} maxHeightClass="h-12 max-w-[72px]" />
            </>
          )}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2">
          {!isSub && <EvalStatusBadge status={a.selfEvalStatus ?? null} type="self" />}
        </td>
        <td className="max-w-[200px] px-2.5 py-2 text-slate-600 dark:text-slate-300">
          {!isSub &&
            (a.selfReviewNote?.trim() ? (
              <span className="line-clamp-3 whitespace-pre-wrap">{a.selfReviewNote}</span>
            ) : (
              <span className="text-slate-400">—</span>
            ))}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2">
          {!isSub && (
            <div className="flex flex-col gap-1">
              <EvalStatusBadge status={a.managerEvalStatus ?? null} type="leader" />
              {a.managerReviewNote?.trim() && (
                <span
                  className="text-[10px] text-slate-400 block max-w-[120px] truncate"
                  title={a.managerReviewNote}
                >
                  {a.managerReviewNote}
                </span>
              )}
            </div>
          )}
        </td>
        <td className="max-w-[140px] px-2.5 py-2">
          {!isSub &&
            (requestStatus === 'pending' ? (
              <Textarea
                value={noteMap[a.id] ?? ''}
                onChange={(e) => setNoteMap((prev) => ({ ...prev, [a.id]: e.target.value }))}
                rows={1}
                className="min-h-[32px] resize-y text-[11px] rounded-md"
                placeholder="Ghi chú..."
              />
            ) : (
              <span className="text-[11px] text-slate-500 line-clamp-2">
                {a.managerReviewNote?.trim() || '—'}
              </span>
            ))}
        </td>
        <td className="whitespace-nowrap px-2.5 py-2">
          {!isSub &&
            (requestStatus === 'pending' ? (
              <EvalToggleGroup
                value={evalMap[a.id]}
                onChange={(v) => handleStatusChange(a.id, v)}
              />
            ) : (
              <EvalStatusBadge status={a.finalEvalStatus ?? null} type="manager" />
            ))}
        </td>
      </tr>
    )
  }

  return (
    <div className="px-3 pb-3 space-y-4">
      {requestStatus === 'pending' && assignments.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900/40">
          <span className="text-slate-600 dark:text-slate-300">
            Đã đánh giá{' '}
            <strong>
              {evaluatedCount}/{assignments.length}
            </strong>{' '}
            mục
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setAllEvaluations('OK')}
            >
              Tất cả OK
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs text-rose-600"
              onClick={() => setAllEvaluations('NOT')}
            >
              Tất cả NOT
            </Button>
          </div>
        </div>
      )}
      {grouped.map((g) => (
        <div key={g.userId} className="rounded-lg border overflow-hidden">
          <MemberEvaluationSummaryCard
            memberName={g.name}
            summary={summaryByUser.get(g.userId) ?? null}
            assignments={g.items}
            onViewDetail={() => onOpenDetail?.({ userId: g.userId, name: g.name, items: g.items })}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                  {resultTableHead.map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.items.flatMap((a) => {
                  const rows = [renderAssignmentRow(a)]
                  if ((a.subItems?.length ?? 0) > 0 && expandedSubItems[a.id]) {
                    for (const sub of a.subItems ?? []) {
                      rows.push(
                        renderAssignmentRow(
                          {
                            ...a,
                            id: `${a.id}-sub-${sub.id}`,
                            targetMetric: sub.targetMetric,
                            numericValue: sub.numericValue,
                            numericUnit: sub.numericUnit,
                            progressPercent: computeSubItemProgress(sub),
                          },
                          true,
                          sub.label
                        )
                      )
                    }
                  }
                  return rows
                })}
              </tbody>
            </table>
          </div>
          {g.items.some((a) => (a.subItems?.length ?? 0) > 0) && (
            <div className="border-t px-3 py-1.5">
              {g.items
                .filter((a) => (a.subItems?.length ?? 0) > 0)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="mr-3 text-[10px] font-semibold text-indigo-600"
                    onClick={() =>
                      setExpandedSubItems((prev) => ({ ...prev, [a.id]: !prev[a.id] }))
                    }
                  >
                    {(expandedSubItems[a.id] ? '▲' : '▼') + ' '}
                    {a.content.slice(0, 30)} ({a.subItems?.length} mục con)
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

type ApprovalGoalEditDraft = {
  priority: number
  content: string
  targetMetric: string
  subItems: SubItemDraft[]
}

function buildApprovalGoalEditDraft(assignment: PerformanceAssignment): ApprovalGoalEditDraft {
  const review = assignment.goalReview
  const useProposed = review?.status === 'edit_pending_member'
  return {
    priority: useProposed ? (review.proposedPriority ?? assignment.priority) : assignment.priority,
    content: useProposed ? (review.proposedContent ?? assignment.content) : assignment.content,
    targetMetric: useProposed
      ? (review.proposedTargetMetric ?? assignment.targetMetric ?? '')
      : (assignment.targetMetric ?? ''),
    subItems: subItemsFromAssignment(assignment.subItems),
  }
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-xs leading-relaxed">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ApprovalGoalActionCell({
  requestId,
  assignment,
  onChanged,
}: {
  requestId: string
  assignment: PerformanceAssignment
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState<ApprovalGoalEditDraft>(() =>
    buildApprovalGoalEditDraft(assignment)
  )
  const reviewStatus = assignment.goalReview?.status ?? 'pending'
  const isTerminal =
    reviewStatus === 'approved' ||
    reviewStatus === 'edit_confirmed' ||
    reviewStatus === 'manager_created_confirmed' ||
    reviewStatus === 'rejected'
  const isWaitingMember =
    reviewStatus === 'edit_pending_member' || reviewStatus === 'manager_created_pending_member'
  const busy = approving || saving || deleting
  const processedTooltip =
    reviewStatus === 'approved'
      ? 'KPI/OKR này đã được Manager duyệt.'
      : reviewStatus === 'edit_confirmed'
        ? 'Member đã xác nhận nội dung sửa cho KPI/OKR này.'
        : reviewStatus === 'rejected'
          ? 'KPI/OKR này đã bị Manager từ chối.'
          : ''
  const waitingMemberTooltip = 'Đang chờ member xác nhận nội dung sửa trước khi xử lý tiếp.'
  const approveTooltip =
    processedTooltip || (isWaitingMember ? waitingMemberTooltip : 'Duyệt KPI/OKR này.')
  const editTooltip =
    processedTooltip || 'Đề xuất sửa nội dung, chỉ tiêu hoặc ưu tiên. Member cần xác nhận thay đổi.'
  const deleteTooltip = processedTooltip || 'Xóa hẳn KPI/OKR này và thông báo cho Leader/Member.'

  useEffect(() => {
    if (!editOpen) return
    setDraft(buildApprovalGoalEditDraft(assignment))
  }, [assignment, editOpen])

  const handleApproveGoal = useCallback(async () => {
    setApproving(true)
    try {
      await performanceApi.approveGoalReview(requestId, assignment.id)
      toast.success('Đã duyệt KPI/OKR.')
      onChanged()
    } catch (err: unknown) {
      toast.error('Duyệt thất bại: ' + getApiErrorMessage(err))
    } finally {
      setApproving(false)
    }
  }, [assignment.id, onChanged, requestId])

  const handleSave = useCallback(async () => {
    const content = draft.content.trim()
    if (!content) {
      toast.error('Nội dung KPI/OKR không được trống.')
      return
    }
    if (content.length > 500) {
      toast.error('Nội dung KPI/OKR tối đa 500 ký tự.')
      return
    }
    if (!Number.isInteger(draft.priority) || draft.priority < 0 || draft.priority > 99) {
      toast.error('Ưu tiên không hợp lệ.')
      return
    }

    setSaving(true)
    try {
      await performanceApi.proposeGoalReviewEdit(requestId, assignment.id, {
        priority: draft.priority,
        content,
        targetMetric: draft.targetMetric.trim() || null,
        subItems: mapSubItemsToPayload(draft.subItems),
      })
      toast.success('Đã gửi nội dung sửa cho member xác nhận.')
      setEditOpen(false)
      onChanged()
    } catch (err: unknown) {
      toast.error('Sửa thất bại: ' + getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [assignment.id, draft, onChanged, requestId])

  const handleDeleteGoal = useCallback(async () => {
    setDeleting(true)
    try {
      await performanceApi.deleteApprovalAssignment(requestId, assignment.id)
      toast.success('Đã xóa KPI/OKR và gửi thông báo cho Leader/Member.')
      setDeleteOpen(false)
      onChanged()
    } catch (err: unknown) {
      toast.error('Xóa thất bại: ' + getApiErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }, [assignment.id, onChanged, requestId])

  return (
    <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-2.5 py-2 text-right shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.18)] dark:bg-slate-950">
      <div className="flex items-center justify-end gap-1">
        <ActionTooltip label={approveTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
            disabled={busy || isTerminal || isWaitingMember}
            onClick={() => void handleApproveGoal()}
            aria-label="Gửi duyệt KPI/OKR"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label={editTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"
            disabled={busy || isTerminal}
            onClick={() => setEditOpen(true)}
            aria-label="Sửa mục tiêu"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label={deleteTooltip}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            disabled={busy || isTerminal}
            onClick={() => setDeleteOpen(true)}
            aria-label="Xóa KPI/OKR"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </ActionTooltip>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open)
        }}
        title="Xóa hẳn KPI/OKR?"
        description="KPI/OKR này sẽ bị xóa khỏi kỳ hiện tại. Leader và member sẽ nhận thông báo trong hệ thống."
        confirmLabel={deleting ? 'Đang xóa...' : 'Xóa KPI/OKR'}
        cancelLabel="Hủy"
        destructive
        onConfirm={() => {
          if (!deleting) void handleDeleteGoal()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sửa mục tiêu KPI/OKR</DialogTitle>
            <p className="text-xs text-slate-500">
              Thay đổi sẽ gửi cho member xác nhận trước khi áp dụng chính thức.
            </p>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ưu tiên</Label>
              <p className="text-[10px] text-slate-400">
                Mức quan trọng: 1 = cao nhất, 0 = không xếp hạng.
              </p>
              <Select
                value={String(draft.priority)}
                onValueChange={(v) => setDraft((prev) => ({ ...prev, priority: Number(v) }))}
                disabled={saving}
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Không xếp (0)</SelectItem>
                  <SelectItem value="1">Ưu tiên 1</SelectItem>
                  <SelectItem value="2">Ưu tiên 2</SelectItem>
                  <SelectItem value="3">Ưu tiên 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Chỉ tiêu (KPI/OKR cha)</Label>
              <p className="text-[10px] text-slate-400">
                Số hoặc mức tổng cần đạt của mục tiêu chính — VD: 60, 100%.
              </p>
              <Input
                value={draft.targetMetric}
                onChange={(e) => setDraft((prev) => ({ ...prev, targetMetric: e.target.value }))}
                disabled={saving}
                className="h-10 rounded-xl"
                placeholder="VD: 60 hoặc 100%"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">
                Nội dung KPI/OKR <span className="text-rose-500">*</span>
              </Label>
              <p className="text-[10px] text-slate-400">
                Mô tả mục tiêu công việc cần hoàn thành trong tháng (tối đa 500 ký tự).
              </p>
              <Textarea
                value={draft.content}
                onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                disabled={saving}
                maxLength={500}
                rows={4}
                className="rounded-xl"
                placeholder="VD: Hoàn thiện module HRM phục vụ team..."
              />
            </div>
            <SubItemsDraftEditor
              value={draft.subItems}
              onChange={(subItems) => setDraft((prev) => ({ ...prev, subItems }))}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </td>
  )
}

type ApprovalGoalCreateDraft = {
  kind: PerformanceKind
  priority: number
  content: string
  targetMetric: string
  numericUnit: string
  subItems: SubItemDraft[]
}

const EMPTY_CREATE_DRAFT: ApprovalGoalCreateDraft = {
  kind: 'KPI',
  priority: 1,
  content: '',
  targetMetric: '',
  numericUnit: '',
  subItems: [],
}

function AddApprovalGoalDialog({
  requestId,
  userId,
  memberName,
  year,
  month,
  disabled,
  onChanged,
}: {
  requestId: string
  userId: string
  memberName: string
  year: number
  month: number
  disabled: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ApprovalGoalCreateDraft>(EMPTY_CREATE_DRAFT)

  const reset = useCallback(() => {
    setDraft(EMPTY_CREATE_DRAFT)
  }, [])

  const handleCreate = useCallback(async () => {
    const content = draft.content.trim()
    if (!content) {
      toast.error('Nội dung KPI/OKR không được trống.')
      return
    }
    if (content.length > 500) {
      toast.error('Nội dung KPI/OKR tối đa 500 ký tự.')
      return
    }
    if (!Number.isInteger(draft.priority) || draft.priority < 0 || draft.priority > 99) {
      toast.error('Ưu tiên không hợp lệ.')
      return
    }

    setSaving(true)
    try {
      await performanceApi.createApprovalAssignment(requestId, {
        assigneeUserId: userId,
        year,
        month,
        kind: draft.kind,
        priority: draft.priority,
        content,
        targetMetric: draft.targetMetric.trim() || null,
        numericUnit: draft.numericUnit.trim().toUpperCase() || null,
        subItems: mapSubItemsToPayload(draft.subItems),
      })
      toast.success('Đã thêm KPI/OKR vào yêu cầu duyệt.')
      setOpen(false)
      reset()
      onChanged()
    } catch (err: unknown) {
      toast.error('Thêm KPI/OKR thất bại: ' + getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [draft, month, onChanged, requestId, reset, userId, year])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <ActionTooltip
        label={
          disabled
            ? 'Chỉ thêm KPI/OKR khi yêu cầu đang chờ duyệt.'
            : 'Thêm KPI/OKR cho nhân sự này.'
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 rounded-lg px-2 text-[11px] font-semibold text-primary hover:bg-primary/10"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Thêm KPI
        </Button>
      </ActionTooltip>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm KPI/OKR cho nhân sự</DialogTitle>
          <p className="text-sm text-slate-500">
            Nhân sự:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{memberName}</span> ·
            Kỳ T{month}/{year}
          </p>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Hạng mục</Label>
            <Select
              value={draft.kind}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, kind: v as PerformanceKind }))}
              disabled={saving}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KPI">KPI</SelectItem>
                <SelectItem value="OKR">OKR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ưu tiên</Label>
            <Select
              value={String(draft.priority)}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, priority: Number(v) }))}
              disabled={saving}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Không xếp (0)</SelectItem>
                <SelectItem value="1">Ưu tiên 1</SelectItem>
                <SelectItem value="2">Ưu tiên 2</SelectItem>
                <SelectItem value="3">Ưu tiên 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Chỉ tiêu</Label>
            <p className="text-[10px] text-slate-400">Số hoặc mức cần đạt — VD: 60, 100%.</p>
            <Input
              value={draft.targetMetric}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetMetric: e.target.value }))}
              disabled={saving}
              placeholder="VD: 40"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Đơn vị (ĐVT)</Label>
            <p className="text-[10px] text-slate-400">Đơn vị đo lường — VD: %, đơn, buổi.</p>
            <Input
              value={draft.numericUnit}
              onChange={(e) => setDraft((prev) => ({ ...prev, numericUnit: e.target.value }))}
              disabled={saving}
              placeholder="VD: %"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs font-semibold">
              Nội dung KPI/OKR <span className="text-rose-500">*</span>
            </Label>
            <p className="text-[10px] text-slate-400">
              Mô tả mục tiêu công việc cần hoàn thành trong tháng (tối đa 500 ký tự).
            </p>
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
              disabled={saving}
              maxLength={500}
              rows={4}
              placeholder="Nhập nội dung KPI/OKR cần bổ sung..."
              className="rounded-xl"
            />
          </div>
          <SubItemsDraftEditor
            value={draft.subItems}
            onChange={(subItems) => setDraft((prev) => ({ ...prev, subItems }))}
            disabled={saving}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={() => void handleCreate()} disabled={saving}>
            {saving ? 'Đang thêm...' : 'Thêm KPI/OKR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamKpiInline({
  requestId,
  teamId,
  year,
  month,
  requestStatus,
  onChanged,
}: {
  requestId: string
  teamId: string
  year: number
  month: number
  requestStatus: ApprovalRequest['status']
  onChanged: () => void
}) {
  const [expandedSubItems, setExpandedSubItems] = useState<Record<string, boolean>>({})
  const assignmentsQ = useQuery({
    queryKey: ['kpi-assignments', teamId, year, month],
    queryFn: () => performanceApi.listAssignments(teamId, year, month),
    enabled: !isMockApiEnabled(),
  })

  if (assignmentsQ.isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const assignments = assignmentsQ.data ?? []

  if (assignments.length === 0) {
    return <p className="p-3 text-center text-xs text-slate-400">Chưa có KPI/OKR nào.</p>
  }

  // Group by assignee
  const grouped: { userId: string; name: string; items: PerformanceAssignment[] }[] = []
  for (const a of assignments) {
    const last = grouped[grouped.length - 1]
    if (last && last.userId === a.assigneeUserId) {
      last.items.push(a)
    } else {
      grouped.push({
        userId: a.assigneeUserId,
        name: a.assigneeDisplayName ?? a.assigneeUserId,
        items: [a],
      })
    }
  }

  const showActionColumn = requestStatus === 'pending' && !isMockApiEnabled()

  // Đếm tổng số item còn pending để hiển thị cảnh báo
  const totalPending =
    requestStatus === 'pending'
      ? assignments.filter((a) => !a.goalReview || a.goalReview.status === 'pending').length
      : 0

  return (
    <div className="px-3 pb-3 space-y-4">
      {requestStatus === 'pending' && totalPending > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>
            Còn <strong>{totalPending}</strong> mục tiêu chưa được xét duyệt — cần duyệt hết để hoàn
            tất.
          </span>
        </div>
      )}
      {grouped.map((g) => {
        const pendingInGroup = g.items.filter(
          (a) => !a.goalReview || a.goalReview.status === 'pending'
        ).length
        return (
          <div key={g.userId} className="rounded-lg border overflow-hidden">
            {/* Member header */}
            <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{g.name}</span>
              <span className="text-xs text-slate-400">({g.items.length} mục tiêu)</span>
              {requestStatus === 'pending' && pendingInGroup > 0 && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  {pendingInGroup} chờ duyệt
                </span>
              )}
            </div>
            {/* Table — same columns as /monthly-report: Ngày xét, Hạng mục, Ưu tiên, Nội dung, Chỉ tiêu */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                    <th className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500">
                      Ngày xét
                    </th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500">
                      Hạng mục
                    </th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500">
                      Ưu tiên
                    </th>
                    <th className="px-2.5 py-2 text-left font-semibold text-slate-500">Nội dung</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500">
                      Chỉ tiêu
                    </th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-left font-semibold text-slate-500">
                      QL xét duyệt
                    </th>
                    {showActionColumn && (
                      <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-50 px-2.5 py-2 text-right font-semibold text-slate-500 shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.18)] dark:bg-slate-800/50">
                        Thao tác
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {!isMockApiEnabled() ? (
                    <tr className="border-b bg-white/70 dark:bg-slate-900/40">
                      <td colSpan={showActionColumn ? 7 : 6} className="px-2.5 py-2 text-right">
                        <AddApprovalGoalDialog
                          requestId={requestId}
                          userId={g.userId}
                          memberName={g.name}
                          year={year}
                          month={month}
                          disabled={requestStatus !== 'pending'}
                          onChanged={onChanged}
                        />
                      </td>
                    </tr>
                  ) : null}
                  {g.items.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-slate-500">
                        {formatKpiSetAt(a.kpiSetAt)}
                      </td>
                      <td className="px-2.5 py-2">
                        <span
                          className={cn(
                            'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold',
                            a.kind === 'KPI'
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                              : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
                          )}
                        >
                          {a.kind}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2">
                        <PriorityText priority={a.priority} />
                      </td>
                      <td className="px-2.5 py-2 max-w-[400px] whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                        {a.content}
                        {(a.subItems?.length ?? 0) > 0 && (
                          <AssignmentSubItemsInline
                            subItems={a.subItems ?? []}
                            expanded={expandedSubItems[a.id] ?? true}
                            showProgress={false}
                            onToggle={() =>
                              setExpandedSubItems((prev) => ({
                                ...prev,
                                [a.id]: !(prev[a.id] ?? true),
                              }))
                            }
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                        {a.targetMetric?.trim() || '—'}
                      </td>
                      <td className="min-w-[180px] px-2.5 py-2 align-top">
                        <GoalReviewStatusBadge review={a.goalReview} />
                        <GoalReviewSummary review={a.goalReview} />
                      </td>
                      {showActionColumn && (
                        <ApprovalGoalActionCell
                          requestId={requestId}
                          assignment={a}
                          onChanged={onChanged}
                        />
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RejectDialog({
  request,
  onClose,
  onRejected,
}: {
  request: ApprovalRequest
  onClose: () => void
  onRejected: () => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReject = useCallback(async () => {
    setLoading(true)
    try {
      await performanceApi.rejectRequest(request.id, note.trim() || null)
      toast.success('Đã từ chối KPI/OKR')
      onRejected()
      onClose()
    } catch (err: unknown) {
      toast.error('Từ chối thất bại: ' + getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [request.id, note, onRejected, onClose])

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Từ chối KPI/OKR</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Team: <strong>{request.teamName}</strong> — T{request.month}/{request.year}
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Lý do từ chối (tùy chọn)
          </Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập lý do để leader biết cần điều chỉnh gì..."
            rows={3}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Hủy
        </Button>
        <Button variant="destructive" onClick={() => void handleReject()} disabled={loading}>
          {loading ? 'Đang từ chối...' : 'Từ chối'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function ManagerKpiApprovalScreen() {
  const qc = useQueryClient()
  const { year: y0, month: m0 } = nowYm()
  const [year, setYear] = useState(y0)
  const [month, setMonth] = useState(m0)
  const [approvalType, setApprovalType] = useState<ApprovalRequestType>('goal')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [rejectRequest, setRejectRequest] = useState<ApprovalRequest | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [detailMember, setDetailMember] = useState<{
    userId: string
    name: string
    items: PerformanceAssignment[]
    teamId: string
    year: number
    month: number
  } | null>(null)

  const [evaluationsByReqId, setEvaluationsByReqId] = useState<
    Record<
      string,
      { assignmentId: string; status: 'OK' | 'NOT'; managerReviewNote?: string | null }[]
    >
  >({})
  const [allEvaluatedByReqId, setAllEvaluatedByReqId] = useState<Record<string, boolean>>({})

  const handleEvaluationsChange = useCallback(
    (
      reqId: string,
      evals: {
        assignmentId: string
        status: 'OK' | 'NOT'
        managerReviewNote?: string | null
      }[],
      allEvaluated: boolean
    ) => {
      setEvaluationsByReqId((prev) => {
        if (JSON.stringify(prev[reqId]) === JSON.stringify(evals)) return prev
        return { ...prev, [reqId]: evals }
      })
      setAllEvaluatedByReqId((prev) => {
        if (prev[reqId] === allEvaluated) return prev
        return { ...prev, [reqId]: allEvaluated }
      })
    },
    []
  )

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const { connected: sseConnected } = useKpiOkrStream({ year, month })

  const approvalKey = ['kpi-approval-requests', statusFilter, year, month, approvalType] as const
  const requestsQ = useQuery({
    queryKey: approvalKey,
    queryFn: () =>
      performanceApi.listApprovalRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        year,
        month,
        type: approvalType,
      }),
    enabled: !isMockApiEnabled(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: sseConnected ? false : 15_000,
  })

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['kpi-approval-requests'] })
    void qc.invalidateQueries({ queryKey: ['kpi-assignments'] })
    void qc.invalidateQueries({ queryKey: ['kpi-assignments-result'] })
    void qc.invalidateQueries({ queryKey: ['kpi-summaries-result'] })
    void qc.invalidateQueries({ queryKey: ['kpi-summaries'] })
  }, [qc])

  const handleApprove = useCallback(
    async (req: ApprovalRequest) => {
      setApprovingId(req.id)
      try {
        const evaluations = evaluationsByReqId[req.id] ?? []
        await performanceApi.approveRequest(req.id, evaluations)
        toast.success(
          req.type === 'result'
            ? `Đã duyệt kết quả team ${req.teamName ?? ''}`
            : `Đã duyệt mục tiêu KPI/OKR team ${req.teamName ?? ''}`
        )
        refresh()
      } catch (err: unknown) {
        toast.error('Duyệt thất bại: ' + getApiErrorMessage(err))
      } finally {
        setApprovingId(null)
      }
    },
    [refresh, evaluationsByReqId]
  )

  const yearOptions = Array.from({ length: 3 }, (_, i) => y0 - 1 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  const requests = requestsQ.data ?? []

  // Stats summary
  const stats = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === 'pending').length
    const approved = requests.filter((r) => r.status === 'approved').length
    const rejected = requests.filter((r) => r.status === 'rejected').length
    return { total, pending, approved, rejected }
  }, [requests])

  return (
    <div className="relative isolate ">
      <div
        className={cn(
          'mb-4 border-none bg-[#005236] px-4 py-5 text-white  rounded-3xl relative overflow-hidden sm:px-6 sm:py-6 md:p-8'
        )}
      >
        <div className="relative z-10">
          <h1 className="text-2xl font-black tracking-tight mb-2 sm:text-3xl">
            Duyệt KPI/OKR theo team
          </h1>
          <p className="text-indigo-100/80 max-w-2xl text-sm font-medium">
            Duyệt mục tiêu đầu tháng hoặc kết quả cuối tháng do Leader gửi lên.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={approvalType === 'goal' ? 'default' : 'outline'}
          className="rounded-xl"
          onClick={() => setApprovalType('goal')}
        >
          Mục tiêu đầu tháng
        </Button>
        <Button
          type="button"
          size="sm"
          variant={approvalType === 'result' ? 'default' : 'outline'}
          className="rounded-xl"
          onClick={() => setApprovalType('result')}
        >
          Kết quả cuối tháng
        </Button>
      </div>

      {/* Filters */}
      <Card className={cn('mb-6', CARD_ENTRANCE)} style={{ animationDelay: '50ms' }}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tháng
              </Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-10 w-36 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      Tháng {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Năm
              </Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-10 w-28 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Trạng thái
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-40 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      {requests.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{stats.total}</span>{' '}
            team
          </span>
          {stats.pending > 0 && (
            <span className="inline-flex items-center gap-1 text-yellow-600">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-semibold">{stats.pending}</span> chờ duyệt
            </span>
          )}
          {stats.approved > 0 && (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-semibold">{stats.approved}</span> đã duyệt
            </span>
          )}
          {stats.rejected > 0 && (
            <span className="inline-flex items-center gap-1 text-red-600">
              <X className="h-3.5 w-3.5" />
              <span className="font-semibold">{stats.rejected}</span> từ chối
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {requestsQ.isLoading && (
        <Card className={CARD_ENTRANCE}>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!requestsQ.isLoading && requests.length === 0 && (
        <Card className={CARD_ENTRANCE}>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">
              Không có yêu cầu {approvalType === 'result' ? 'kết quả' : 'mục tiêu'} nào trong kỳ
              này.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Team cards — expandable inline KPI */}
      {requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req: ApprovalRequest, idx: number) => {
            const isExpanded = expandedIds.has(req.id)
            return (
              <Card
                key={req.id}
                className={cn(CARD_ENTRANCE, 'overflow-hidden transition-shadow hover:shadow-md')}
                style={{ animationDelay: `${100 + idx * 30}ms` }}
              >
                {/* Card header — always visible */}
                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none',
                    'hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors'
                  )}
                  onClick={() => toggleExpand(req.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleExpand(req.id)
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs',
                        'bg-gradient-to-br from-indigo-500 to-violet-600'
                      )}
                    >
                      {(req.teamName ?? req.teamId).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {req.teamName ?? req.teamId}
                      </p>
                      <p className="text-xs text-slate-400">
                        Gửi {new Date(req.submittedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ApprovalStatusBadge status={req.status} />
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Expanded: inline KPI view + actions */}
                {isExpanded && (
                  <>
                    {/* Divider */}
                    <div className="border-t" />

                    {/* KPI / kết quả */}
                    {req.type === 'result' ? (
                      <TeamResultInline
                        teamId={req.teamId}
                        year={req.year}
                        month={req.month}
                        requestStatus={req.status}
                        onEvaluationsChange={(evals, allEvaluated) =>
                          handleEvaluationsChange(req.id, evals, allEvaluated)
                        }
                        onOpenDetail={(member) =>
                          setDetailMember({
                            ...member,
                            teamId: req.teamId,
                            year: req.year,
                            month: req.month,
                          })
                        }
                      />
                    ) : (
                      <TeamKpiInline
                        requestId={req.id}
                        teamId={req.teamId}
                        year={req.year}
                        month={req.month}
                        requestStatus={req.status}
                        onChanged={refresh}
                      />
                    )}

                    {/* Actions bar */}
                    {req.status === 'pending' && req.type === 'result' && (
                      <>
                        <div className="border-t" />
                        <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/30">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRejectRequest(req)
                            }}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Từ chối
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleApprove(req)
                            }}
                            disabled={
                              approvingId === req.id ||
                              (req.type === 'result' && !allEvaluatedByReqId[req.id])
                            }
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {approvingId === req.id ? (
                              'Đang duyệt...'
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                {req.type === 'result' ? 'Duyệt kết quả' : 'Duyệt mục tiêu'}
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {req.status === 'rejected' && req.note && (
                      <>
                        <div className="border-t" />
                        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10">
                          <strong>Lý do từ chối:</strong> {req.note}
                        </div>
                      </>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject dialog (only modal left) */}
      <Dialog
        open={!!rejectRequest}
        onOpenChange={(o) => {
          if (!o) setRejectRequest(null)
        }}
      >
        {rejectRequest && (
          <RejectDialog
            request={rejectRequest}
            onClose={() => setRejectRequest(null)}
            onRejected={refresh}
          />
        )}
      </Dialog>

      {detailMember && (
        <MemberKpiDetailDrawer
          open
          onClose={() => setDetailMember(null)}
          memberName={detailMember.name}
          teamId={detailMember.teamId}
          year={detailMember.year}
          month={detailMember.month}
          assigneeUserId={detailMember.userId}
          assignments={detailMember.items}
        />
      )}
    </div>
  )
}
