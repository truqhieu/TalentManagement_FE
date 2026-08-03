import { CustomSelect } from '@/components/shared/CustomSelect'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { ORG_TREE_KEY, useHrOrgTree } from '@/features/hr-admin/useHrOrgTree'
import { performanceApi, type PerformanceAssignment } from '@/features/kpi-okr/api'
import {
  isCatalogEnabledDepartment,
  isTrafficTeam,
  kpiEligibleUserIdSet,
  requiresKpiApproval,
  shouldShowAssignmentForMember,
} from '@/features/kpi-okr/catalogHelpers'
import { useMonthlyReportSelfEdit } from '@/features/kpi-okr/components/hooks/useMonthlyReportSelfEdit'
import {
  GoalReviewStatusBadge,
  GoalReviewSummary,
} from '@/features/kpi-okr/components/kpiAssignmentTableShared'
import {
  EvidenceImagePreviews,
  KpiEvidenceInput,
} from '@/features/kpi-okr/components/KpiEvidenceInput'
import { FormPanel } from '@/features/kpi-okr/components/KpiOkrWorkspace'
import {
  SubItemsReadOnlyList,
  SubItemsSelfEditPanel,
  useSubItemsSelfEdit,
  validateSubItemsSelfDrafts,
} from '@/features/kpi-okr/components/SubItemsSelfEdit'
import {
  clampKpiPeriod,
  getMaxViewableYm,
  isKpiPeriodSelectable,
} from '@/features/kpi-okr/kpiPeriodLimits'
import { useKpiOkrStream } from '@/features/kpi-okr/useKpiOkrStream'
import { organizationApi } from '@/features/organization/api'
import { resolveEffectivePermissionSet } from '@/features/permissions/resolveEffective'
import { getApiErrorMessage } from '@/lib/axios'
import { isManagerLikeRole } from '@/lib/managerLikeRole'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { WorkReportTab } from './WorkReportTab'

function nowYm() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function formatKpiSetAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN')
}

function PriorityText({ priority }: { priority: number }) {
  if (priority === 1) return <span className="font-semibold text-rose-600">P1 - Cao</span>
  if (priority === 2) return <span className="font-semibold text-amber-600">P2 - TB</span>
  if (priority === 3) return <span className="font-semibold text-slate-600">P3 - Thấp</span>
  return <span className="text-slate-400">—</span>
}

function EvalBadge({
  status,
  type = 'leader',
}: {
  status: string | null | undefined
  type?: 'self' | 'leader' | 'manager'
}) {
  const v = status?.trim().toUpperCase()
  if (!v || v === '__NONE') return <span className="text-slate-400">—</span>
  const isOk = v === 'OK'

  const typeLabel = {
    self: 'Tự đánh giá',
    leader: 'Leader đánh giá',
    manager: 'Manager đánh giá',
  }[type]

  const statusLabel = isOk ? 'Đạt' : 'Chưa đạt'
  const tooltipText = `${typeLabel}: ${statusLabel}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'h-6 pl-1.5 pr-2 py-0.5 text-xs font-bold shadow-none rounded-full inline-flex items-center gap-1 cursor-help transition-all select-none',
            isOk
              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300'
          )}
        >
          {isOk ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          )}
          <span>{v}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}

function MonthlyGoalReviewPanel({
  item,
  onConfirmed,
  allowConfirm = false,
}: {
  item: PerformanceAssignment
  onConfirmed?: () => void
  allowConfirm?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const review = item.goalReview
  const canConfirm =
    allowConfirm &&
    !isMockApiEnabled() &&
    (review?.status === 'edit_pending_member' ||
      review?.status === 'manager_created_pending_member') &&
    Boolean(review.requestId)

  const handleConfirm = useCallback(async () => {
    if (!review?.requestId) return
    setConfirming(true)
    try {
      await performanceApi.confirmGoalReview(review.requestId, item.id)
      toast.success('Đã xác nhận và áp dụng nội dung KPI/OKR Manager sửa.')
      onConfirmed?.()
    } catch (err: unknown) {
      toast.error('Xác nhận thất bại: ' + getApiErrorMessage(err))
    } finally {
      setConfirming(false)
    }
  }, [item.id, onConfirmed, review?.requestId])

  return (
    <div className="flex min-w-[170px] flex-col items-start gap-1.5">
      <GoalReviewStatusBadge review={review} />
      <GoalReviewSummary review={review} />
      {canConfirm ? (
        <Button
          type="button"
          size="sm"
          className="h-8 rounded-lg px-3 text-xs font-semibold"
          disabled={confirming}
          onClick={() => void handleConfirm()}
        >
          {confirming ? 'Đang xác nhận...' : 'Xác nhận'}
        </Button>
      ) : null}
    </div>
  )
}

const memberEditInputCls =
  'h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 text-sm transition-all focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-950 dark:focus:border-indigo-500'

const memberReportInvalidRing =
  '!border-2 !border-red-500 !ring-2 !ring-red-500/25 focus:!border-red-500 focus:!ring-red-500/35 focus-visible:!border-red-500 focus-visible:!ring-red-500/35'

const memberReportSelectCls =
  'h-10 px-3.5 py-0 bg-slate-50/30 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-500 focus:bg-white hover:bg-slate-100/50 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-950'

const memberReportTextareaCls =
  'min-h-[88px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/30 p-3.5 text-sm transition-all focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-950 dark:focus:border-indigo-500'

type MemberReportFieldErrors = {
  numeric?: boolean
  numericUnit?: boolean
  selfEval?: boolean
  evidence?: boolean
}

function isSelfEvalComplete(status: string): boolean {
  const s = status.trim().toUpperCase()
  return s === 'OK' || s === 'NOT'
}

function validateMemberReportForm(
  values: {
    numericRaw: string
    numericUnit: string
    selfEvalStatus: string
    evidence: string
  },
  opts?: { skipNumericFields?: boolean }
): { valid: boolean; errors: MemberReportFieldErrors; message?: string } {
  const errors: MemberReportFieldErrors = {}
  const nTrim = values.numericRaw.trim()
  const skipNumeric = opts?.skipNumericFields

  if (!skipNumeric) {
    if (!nTrim) {
      errors.numeric = true
    } else {
      const n = Number(nTrim.replace(/\./g, '').replace(',', '.'))
      if (!Number.isFinite(n)) errors.numeric = true
    }
    if (!values.numericUnit.trim()) errors.numericUnit = true
    if (!isSelfEvalComplete(values.selfEvalStatus)) errors.selfEval = true
  }

  if (!values.evidence.trim()) errors.evidence = true

  const valid = !Object.values(errors).some(Boolean)
  if (!valid) {
    if (errors.numeric && nTrim) {
      return {
        valid: false,
        errors,
        message: 'Số liệu không hợp lệ — kiểm tra các ô được đánh dấu đỏ.',
      }
    }
    if (errors.numeric) {
      return {
        valid: false,
        errors,
        message: 'Vui lòng nhập số liệu — kiểm tra các ô được đánh dấu đỏ.',
      }
    }
    if (errors.numericUnit) {
      return {
        valid: false,
        errors,
        message: 'Vui lòng nhập đơn vị — kiểm tra các ô được đánh dấu đỏ.',
      }
    }
    if (errors.selfEval) {
      return { valid: false, errors, message: 'Vui lòng chọn tự đánh giá OK hoặc NOT.' }
    }
    if (errors.evidence) {
      return { valid: false, errors, message: 'Vui lòng bổ sung minh chứng trước khi gửi báo cáo.' }
    }
  }

  return { valid, errors }
}

function MonthlyReportFormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

function MonthlyReportKpiContextCard({ item }: { item: PerformanceAssignment }) {
  const isKpi = item.kind === 'KPI'
  const hasSubItems = (item.subItems?.length ?? 0) > 0
  return (
    <div
      className={cn(
        'mt-3.5 rounded-xl border border-l-4 p-4 shadow-sm transition-all',
        isKpi
          ? 'border-slate-200 border-l-indigo-500 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:border-slate-800 dark:border-l-indigo-500 dark:from-indigo-950/10'
          : 'border-slate-200 border-l-fuchsia-500 bg-gradient-to-br from-fuchsia-50/40 via-white to-white dark:border-slate-800 dark:border-l-fuchsia-500 dark:from-fuchsia-950/10'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            'rounded-md px-2 py-0.5 text-2xs font-bold tracking-wider shadow-none border-none',
            isKpi
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
              : 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300'
          )}
        >
          {item.kind}
        </Badge>
        <PriorityText priority={item.priority} />
        <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
          Ngày xét: {formatKpiSetAt(item.kpiSetAt)}
        </span>
      </div>
      <p className="mt-2.5 text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100">
        {item.content}
      </p>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
          Chỉ tiêu:
        </span>
        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
          {item.targetMetric?.trim() || '—'}
        </span>
      </div>
      {hasSubItems ? (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Chỉ số con
          </p>
          <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
        </div>
      ) : null}
    </div>
  )
}

function MonthlyReportDetailOpenButton({
  onClick,
  label = 'Chi tiết',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500/20 active:scale-95 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Eye className="h-3.5 w-3.5 text-slate-500" />
      {label}
    </button>
  )
}

function MonthlyReportEditButton({
  onClick,
  label = 'Gửi báo cáo',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100/80 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
    >
      <Pencil className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function MonthlyReportMemberEditPanel({
  item,
  onSaved,
  onClose,
}: {
  item: PerformanceAssignment
  onSaved: () => void
  onClose: () => void
}) {
  const hasSubItems = (item.subItems?.length ?? 0) > 0
  const [fieldErrors, setFieldErrors] = useState<MemberReportFieldErrors>({})
  const subEdit = useSubItemsSelfEdit(item.id, item.subItems ?? [], onSaved)
  const {
    evidence,
    setEvidence,
    numericRaw,
    setNumericRaw,
    numericUnit,
    setNumericUnit,
    selfEvalStatus,
    setSelfEvalStatus,
    selfReviewNote,
    setSelfReviewNote,
    saving,
    save,
  } = useMonthlyReportSelfEdit(item, onSaved)

  const clearFieldError = (key: keyof MemberReportFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const { [key]: _removed, ...rest } = prev
      void _removed
      return rest
    })
  }

  const handleSubmit = async () => {
    if (hasSubItems) {
      const subCheck = validateSubItemsSelfDrafts(item.subItems ?? [], subEdit.drafts)
      if (!subCheck.valid) {
        toast.error(subCheck.message ?? 'Vui lòng hoàn thiện các mục con.')
        return
      }
      const subsSaved = await subEdit.saveAll()
      if (!subsSaved) return
    }

    const { valid, errors, message } = validateMemberReportForm(
      {
        numericRaw,
        numericUnit,
        selfEvalStatus,
        evidence,
      },
      { skipNumericFields: hasSubItems }
    )
    setFieldErrors(errors)
    if (!valid) {
      toast.error(message ?? 'Vui lòng hoàn thiện các ô được đánh dấu đỏ.')
      return
    }
    const ok = await save({ skipNumericFields: hasSubItems })
    if (ok) onClose()
  }

  return (
    <div className="space-y-5">
      {hasSubItems ? (
        <SubItemsSelfEditPanel
          subItems={item.subItems ?? []}
          disabled={saving || subEdit.savingId != null}
          editState={subEdit}
        />
      ) : null}

      <MonthlyReportFormSection
        title="Kết quả thực hiện"
        hint={
          hasSubItems
            ? 'Minh chứng và nhận xét chung cho KPI cha; số liệu nhập tại từng mục con phía trên.'
            : 'Nhập số liệu đạt được, đơn vị và tự đánh giá theo chỉ tiêu phía trên.'
        }
      >
        {!hasSubItems ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="space-y-1.5 sm:col-span-5">
              <label
                htmlFor={`numeric-${item.id}`}
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Số liệu
              </label>
              <Input
                id={`numeric-${item.id}`}
                value={numericRaw}
                onChange={(e) => {
                  setNumericRaw(e.target.value)
                  clearFieldError('numeric')
                }}
                className={cn(memberEditInputCls, fieldErrors.numeric && memberReportInvalidRing)}
                placeholder="VD: 1500000"
                disabled={saving}
                inputMode="decimal"
                aria-invalid={fieldErrors.numeric || undefined}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <label
                htmlFor={`unit-${item.id}`}
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Đơn vị
              </label>
              <Input
                id={`unit-${item.id}`}
                value={numericUnit}
                onChange={(e) => {
                  setNumericUnit(e.target.value)
                  clearFieldError('numericUnit')
                }}
                className={cn(
                  memberEditInputCls,
                  fieldErrors.numericUnit && memberReportInvalidRing
                )}
                placeholder="VND, %, đơn..."
                disabled={saving}
                aria-invalid={fieldErrors.numericUnit || undefined}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Tự đánh giá
              </label>
              <CustomSelect
                value={selfEvalStatus || '__none'}
                onValueChange={(v) => {
                  setSelfEvalStatus(v === '__none' ? '' : v)
                  clearFieldError('selfEval')
                }}
                options={[
                  { label: 'Chưa chọn', value: '__none' },
                  { label: 'OK — đạt', value: 'OK' },
                  { label: 'NOT — chưa đạt', value: 'NOT' },
                ]}
                disabled={saving}
                className="min-w-0 w-full"
                triggerClassName={cn(
                  memberReportSelectCls,
                  fieldErrors.selfEval && memberReportInvalidRing
                )}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Số liệu và tự đánh giá được nhập riêng cho từng chỉ số con ở khối phía trên.
          </p>
        )}
      </MonthlyReportFormSection>

      <MonthlyReportFormSection
        title="Tự nhận xét"
        hint="Mô tả ngắn kết quả, khó khăn hoặc giải trình (nếu có)."
      >
        <Textarea
          value={selfReviewNote}
          onChange={(e) => setSelfReviewNote(e.target.value)}
          rows={3}
          disabled={saving}
          placeholder="Nhận xét về kết quả thực hiện mục tiêu này..."
          className={memberReportTextareaCls}
        />
      </MonthlyReportFormSection>

      <MonthlyReportFormSection
        title="Minh chứng"
        hint="Tải ảnh hoặc dán link — giúp quản lý đối soát kết quả."
      >
        <div
          className={cn(
            'rounded-xl border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/20',
            fieldErrors.evidence && 'border-red-500 ring-2 ring-red-500/20'
          )}
        >
          <KpiEvidenceInput
            value={evidence}
            onChange={(v) => {
              setEvidence(v)
              clearFieldError('evidence')
            }}
            disabled={saving}
            textareaClassName={fieldErrors.evidence ? memberReportInvalidRing : undefined}
          />
        </div>
      </MonthlyReportFormSection>

      {item.managerReviewNote?.trim() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
            Nhận xét từ quản lý
          </p>
          <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-100/90">
            {item.managerReviewNote}
          </p>
        </div>
      ) : null}

      <DialogFooter className="gap-2 border-t border-slate-100 px-0 pt-4 sm:gap-2 dark:border-slate-800">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onClose}
          className="flex-1 sm:flex-none rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-all active:scale-95"
        >
          Hủy
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="flex-1 px-6 sm:flex-none rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-200 dark:shadow-none transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          {saving ? 'Đang gửi…' : 'Gửi báo cáo'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function MonthlyReportMemberEditDialog({
  item,
  onSaved,
  open,
  onOpenChange,
}: {
  item: PerformanceAssignment
  onSaved: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,780px)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl border border-slate-100 p-0 shadow-2xl dark:border-slate-800 sm:max-w-xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-5 dark:border-slate-800 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-lg">Nhập kết quả KPI/OKR</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cập nhật số liệu, tự đánh giá và minh chứng cho mục tiêu đã giao.
            </DialogDescription>
          </DialogHeader>
          <MonthlyReportKpiContextCard item={item} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {open ? (
            <MonthlyReportMemberEditPanel
              item={item}
              onSaved={onSaved}
              onClose={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MonthlyReportReadOnlyDetailPanel({ item }: { item: PerformanceAssignment }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <MonthlyGoalReviewPanel item={item} />
      </div>
      {(item.subItems?.length ?? 0) > 0 ? (
        <div className="lg:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Chỉ số con
          </p>
          <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
        </div>
      ) : null}
      <div className="space-y-3">
        {item.selfReviewNote?.trim() ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tự nhận xét
            </p>
            <p className="text-sm italic text-slate-700 dark:text-slate-300">
              {item.selfReviewNote}
            </p>
          </div>
        ) : null}
        {item.managerReviewNote?.trim() ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              QL nhận xét
            </p>
            <p className="text-sm italic text-slate-600 dark:text-slate-400">
              {item.managerReviewNote}
            </p>
          </div>
        ) : null}
        {!item.selfReviewNote?.trim() && !item.managerReviewNote?.trim() ? (
          <p className="text-sm text-slate-400">Chưa có nhận xét</p>
        ) : null}
      </div>
      <div>
        {item.evidence?.trim() ? (
          <>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Minh chứng
            </p>
            <p className="whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
              {item.evidence}
            </p>
            <EvidenceImagePreviews evidence={item.evidence} maxHeightClass="h-16 max-w-[120px]" />
          </>
        ) : (
          <p className="text-sm text-slate-400">Chưa có minh chứng</p>
        )}
      </div>
    </div>
  )
}

function MonthlyReportMemberTableRow({
  item,
  onSaved,
  hideManagerEvalColumn,
}: {
  item: PerformanceAssignment
  onSaved: () => void
  hideManagerEvalColumn?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr className="border-b transition-colors last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500">
          {formatKpiSetAt(item.kpiSetAt)}
        </td>
        <td className="px-3 py-2.5">
          <Badge
            className={
              item.kind === 'KPI'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
            }
          >
            {item.kind}
          </Badge>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <PriorityText priority={item.priority} />
        </td>
        <td className="max-w-[280px] whitespace-pre-wrap px-3 py-2.5 text-sm">
          {item.content}
          {(item.subItems?.length ?? 0) > 0 ? (
            <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
          ) : null}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-primary">
          {item.targetMetric?.trim() || '—'}
        </td>
        <td className="px-3 py-2.5 align-top">
          <MonthlyGoalReviewPanel item={item} allowConfirm onConfirmed={onSaved} />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">
          {item.numericValue != null
            ? `${item.numericValue}${item.numericUnit ? ' ' + item.numericUnit : ''}`
            : '—'}
        </td>
        <td className="px-3 py-2.5">
          <EvalBadge status={item.selfEvalStatus} type="self" />
        </td>
        <td className="px-3 py-2.5">
          <EvalBadge status={item.managerEvalStatus} type="leader" />
        </td>
        {!hideManagerEvalColumn ? (
          <td className="px-3 py-2.5">
            <EvalBadge status={item.finalEvalStatus} type="manager" />
          </td>
        ) : null}
        <td className="whitespace-nowrap px-2 py-2.5 text-right">
          <MonthlyReportEditButton onClick={() => setOpen(true)} />
        </td>
      </tr>
      <MonthlyReportMemberEditDialog
        item={item}
        onSaved={onSaved}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

function MonthlyReportReadOnlyTableRow({
  item,
  hideManagerEvalColumn,
}: {
  item: PerformanceAssignment
  hideManagerEvalColumn?: boolean
}) {
  const [open, setOpen] = useState(false)
  const num =
    item.numericValue != null
      ? `${item.numericValue}${item.numericUnit ? ' ' + item.numericUnit : ''}`
      : '—'

  return (
    <>
      <tr className="border-b transition-colors last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500">
          {formatKpiSetAt(item.kpiSetAt)}
        </td>
        <td className="px-3 py-2.5">
          <Badge
            className={
              item.kind === 'KPI'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
            }
          >
            {item.kind}
          </Badge>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <PriorityText priority={item.priority} />
        </td>
        <td className="max-w-[280px] whitespace-pre-wrap px-3 py-2.5 text-sm">
          {item.content}
          {(item.subItems?.length ?? 0) > 0 ? (
            <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
          ) : null}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-primary">
          {item.targetMetric?.trim() || '—'}
        </td>
        <td className="px-3 py-2.5 align-top">
          <MonthlyGoalReviewPanel item={item} />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">{num}</td>
        <td className="px-3 py-2.5">
          <EvalBadge status={item.selfEvalStatus} type="self" />
        </td>
        <td className="px-3 py-2.5">
          <EvalBadge status={item.managerEvalStatus} type="leader" />
        </td>
        {!hideManagerEvalColumn ? (
          <td className="px-3 py-2.5">
            <EvalBadge status={item.finalEvalStatus} type="manager" />
          </td>
        ) : null}
        <td className="whitespace-nowrap px-2 py-2.5 text-right">
          <MonthlyReportDetailOpenButton onClick={() => setOpen(true)} />
        </td>
      </tr>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết mục tiêu</DialogTitle>
            <DialogDescription asChild>
              <p className="text-left text-sm text-slate-600 dark:text-slate-400">{item.content}</p>
            </DialogDescription>
          </DialogHeader>
          <MonthlyReportReadOnlyDetailPanel item={item} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MonthlyReportDetailReadOnlyCard({
  item,
  hideManagerEvalColumn,
}: {
  item: PerformanceAssignment
  hideManagerEvalColumn?: boolean
}) {
  return (
    <div className="space-y-3 border-b border-blue-100/50 py-4 first:pt-0 last:border-0 dark:border-blue-900/30">
      <div className="tabular-nums text-xs text-slate-500">{formatKpiSetAt(item.kpiSetAt)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={
            item.kind === 'KPI'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
              : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
          }
        >
          {item.kind}
        </Badge>
        <PriorityText priority={item.priority} />
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
      {(item.subItems?.length ?? 0) > 0 ? (
        <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
      ) : null}
      <p className="text-sm font-semibold tabular-nums text-primary">
        {item.targetMetric?.trim() || '—'}
      </p>
      <MonthlyGoalReviewPanel item={item} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-xs font-bold uppercase text-muted-foreground">Số liệu</span>
          <p className="tabular-nums">
            {item.numericValue !== undefined && item.numericValue !== null
              ? String(item.numericValue)
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-xs font-bold uppercase text-muted-foreground">Đơn vị</span>
          <p className="text-xs uppercase text-slate-600">{item.numericUnit ?? '—'}</p>
        </div>
      </div>
      <div>
        <span className="text-xs font-bold uppercase text-muted-foreground">Minh chứng</span>
        {item.evidence?.trim() ? (
          <p className="break-all text-xs">{item.evidence.trim()}</p>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        <EvidenceImagePreviews evidence={item.evidence} maxHeightClass="h-16 max-w-full" />
      </div>
      <div>
        <span className="text-xs font-bold uppercase text-muted-foreground">Tự đánh giá</span>
        <div className="mt-1">
          <EvalBadge status={item.selfEvalStatus} type="self" />
        </div>
      </div>
      <div>
        <span className="text-xs font-bold uppercase text-muted-foreground">Tự nhận xét</span>
        <p className="text-xs text-slate-600">
          {item.selfReviewNote?.trim() ? (
            <span className="italic">{item.selfReviewNote.trim()}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </p>
      </div>
      <div>
        <span className="text-xs font-bold uppercase text-muted-foreground">Leader đánh giá</span>
        <div className="mt-1">
          <EvalBadge status={item.managerEvalStatus} type="leader" />
        </div>
      </div>
      <div>
        <span className="text-xs font-bold uppercase text-muted-foreground">Leader nhận xét</span>
        <p className="break-words text-xs italic text-slate-500">
          {item.managerReviewNote?.trim() || '—'}
        </p>
      </div>
      {!hideManagerEvalColumn ? (
        <div>
          <span className="text-xs font-bold uppercase text-muted-foreground">
            Manager đánh giá
          </span>
          <div className="mt-1">
            <EvalBadge status={item.finalEvalStatus} type="manager" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MonthlyReportDetailEditableMobileCard({
  item,
  onSaved,
}: {
  item: PerformanceAssignment
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3 border-b border-blue-100/50 py-4 first:pt-0 last:border-0 dark:border-blue-900/30">
      <div className="tabular-nums text-xs text-slate-500">{formatKpiSetAt(item.kpiSetAt)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={
            item.kind === 'KPI'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
              : 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white'
          }
        >
          {item.kind}
        </Badge>
        <PriorityText priority={item.priority} />
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
      {(item.subItems?.length ?? 0) > 0 ? (
        <SubItemsReadOnlyList subItems={item.subItems ?? []} showProgress />
      ) : null}
      <p className="text-sm font-semibold tabular-nums text-primary">
        {item.targetMetric?.trim() || '—'}
      </p>
      <MonthlyGoalReviewPanel item={item} allowConfirm onConfirmed={onSaved} />
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        <span>
          Kết quả:{' '}
          {item.numericValue != null
            ? `${item.numericValue}${item.numericUnit ? ' ' + item.numericUnit : ''}`
            : '—'}
        </span>
        <span>
          Tự ĐG: <EvalBadge status={item.selfEvalStatus} type="self" />
        </span>
      </div>
      <Button type="button" size="sm" className="h-9 w-full" onClick={() => setOpen(true)}>
        Gửi báo cáo
      </Button>
      <MonthlyReportMemberEditDialog
        item={item}
        onSaved={onSaved}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}

/** Báo cáo hàng tháng — member (cá nhân) / leader (team). Nội dung nối API sau. */
export function MonthlyReportScreen() {
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const user = useAuthStore((s) => s.user)
  const userId = user?.id
  const isLeader = role === 'LEADER'
  const isManager = isManagerLikeRole(role)
  const canSeeTeamWide = isLeader || isManager
  const [year, setYear] = useState(() => nowYm().year)
  const [month, setMonth] = useState(() => nowYm().month)
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [activeTab, setActiveTab] = useState<'kpi-okr' | 'work-report'>('kpi-okr')
  /** False until org tree settles and first auto-select attempt finishes — avoids empty flash. */
  const [teamInitDone, setTeamInitDone] = useState(false)
  const maxViewYm = getMaxViewableYm()

  const treeQ = useHrOrgTree()
  const departments = useMemo(() => {
    const all = treeQ.data?.departments ?? []
    if (canSeeTeamWide) return all
    const myIds = new Set((user?.teamIds ?? []).filter(Boolean))
    if (!myIds.size) return []
    return all
      .map((dept) => ({
        ...dept,
        teams: dept.teams.filter((team) => myIds.has(team.id)),
      }))
      .filter((dept) => dept.teams.length > 0)
  }, [treeQ.data, canSeeTeamWide, user?.teamIds])
  const selectedDept = useMemo(
    () => departments.find((d) => d.teams.some((t) => t.id === selectedTeamId)),
    [departments, selectedTeamId]
  )
  const memberTeamIds = useMemo(() => (user?.teamIds ?? []).filter(Boolean), [user?.teamIds])
  const memberMultiTeam = !canSeeTeamWide && memberTeamIds.length > 1
  const memberTeamOptions = useMemo(
    () =>
      departments
        .flatMap((d) => d.teams.map((t) => ({ ...t, deptName: d.name })))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [departments]
  )
  const teamsInDept = useMemo(() => {
    const base = selectedDept?.teams ?? departments[0]?.teams ?? []
    if (canSeeTeamWide) return base
    const myIds = new Set(memberTeamIds)
    return base.filter((t) => myIds.has(t.id))
  }, [selectedDept, departments, canSeeTeamWide, memberTeamIds])

  useEffect(() => {
    if (selectedTeamId) {
      setTeamInitDone(true)
      return
    }
    if (treeQ.isLoading || treeQ.isPending) return
    const storageKey = user?.id ? `monthly-report-team-${user.id}` : null
    const saved = storageKey ? localStorage.getItem(storageKey) : null
    const preferredId =
      saved && memberTeamIds.includes(saved)
        ? saved
        : memberTeamIds.find((id) => departments.some((d) => d.teams.some((t) => t.id === id)))
    const fallback = departments[0]?.teams[0]?.id ?? ''
    const next = preferredId ?? fallback
    if (next) setSelectedTeamId(next)
    setTeamInitDone(true)
  }, [selectedTeamId, memberTeamIds, departments, user?.id, treeQ.isLoading, treeQ.isPending])

  useEffect(() => {
    if (!memberMultiTeam || !selectedTeamId || !user?.id) return
    localStorage.setItem(`monthly-report-team-${user.id}`, selectedTeamId)
  }, [memberMultiTeam, selectedTeamId, user?.id])

  useKpiOkrStream({
    teamId: selectedTeamId || undefined,
    year,
    month,
  })

  const membersQ = useQuery({
    queryKey: ['monthly-report-members', selectedTeamId],
    queryFn: () => organizationApi.getTeamMembers(selectedTeamId),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })

  const summariesQ = useQuery({
    queryKey: ['monthly-report-summaries', selectedTeamId, year, month],
    queryFn: () => performanceApi.listSummaries(selectedTeamId, year, month),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })

  const catalogAllowlistQ = useQuery({
    queryKey: ['performance', 'catalog-division-allowlist'],
    queryFn: () => performanceApi.getCatalogDivisionAllowlist(),
    staleTime: 60_000,
    enabled: !isMockApiEnabled(),
  })

  const assignmentsQ = useQuery({
    queryKey: ['monthly-report-assignments', selectedTeamId, year, month],
    queryFn: () => performanceApi.listAssignments(selectedTeamId, year, month),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })
  const assignmentsDataRaw = assignmentsQ.data ?? []

  const isKinhDoanhDept = Boolean(
    selectedDept &&
    isCatalogEnabledDepartment(selectedDept, catalogAllowlistQ.data?.mergedDivisionIds ?? null)
  )
  const selectedTeam = useMemo(
    () => teamsInDept.find((t) => t.id === selectedTeamId) ?? null,
    [teamsInDept, selectedTeamId]
  )
  const requiresKpiApprovalSelected = requiresKpiApproval(
    selectedTeamId,
    catalogAllowlistQ.data?.kpiApprovalTeamIds ?? null,
    selectedTeam?.requiresKpiApproval ?? null
  )
  const hideManagerEvalColumn = Boolean(isKinhDoanhDept && !requiresKpiApprovalSelected)

  const isTrafficTeamSelected = isTrafficTeam(
    selectedTeamId,
    catalogAllowlistQ.data?.trafficTeamIds ?? null,
    selectedTeam?.name ?? null
  )

  const kpiEligibleAssigneeIds = useMemo(
    () => kpiEligibleUserIdSet(membersQ.data?.members ?? [], isTrafficTeamSelected),
    [membersQ.data?.members, isTrafficTeamSelected]
  )

  const assignmentsData = useMemo(() => {
    let rows = assignmentsDataRaw.filter((r) => kpiEligibleAssigneeIds.has(r.assigneeUserId))
    if (isKinhDoanhDept) {
      rows = rows.filter(shouldShowAssignmentForMember)
    }
    if (!canSeeTeamWide && userId) {
      rows = rows.filter((r) => r.assigneeUserId === userId)
    }
    return rows
  }, [assignmentsDataRaw, isKinhDoanhDept, canSeeTeamWide, userId, kpiEligibleAssigneeIds])

  // Trạng thái duyệt KẾT QUẢ của team theo kỳ (chỉ traffic team mới có request — team khác trả null).
  // Khóa nhập của member khi đang chờ duyệt (pending) hoặc đã được duyệt (approved).
  const resultApprovalQ = useQuery({
    queryKey: ['monthly-report-result-approval', selectedTeamId, year, month],
    queryFn: () => performanceApi.getApprovalRequest(selectedTeamId, year, month, 'result'),
    enabled: Boolean(selectedTeamId) && requiresKpiApprovalSelected && !isMockApiEnabled(),
    staleTime: 30_000,
  })
  const resultApprovalRequest = resultApprovalQ.data ?? null
  const isResultLocked =
    resultApprovalRequest?.status === 'pending' || resultApprovalRequest?.status === 'approved'

  const monthlyReportQ = useQuery({
    queryKey: ['monthly-report', selectedDept?.id, year, month],
    queryFn: () => performanceApi.getMonthlyReport(selectedDept?.id ?? '', year, month),
    enabled: Boolean(selectedDept?.id) && canSeeTeamWide && !isMockApiEnabled(),
  })
  const hrCounters = monthlyReportQ.data?.hrCounters

  const summariesData = summariesQ.data ?? []

  const summaryRows =
    !userId || canSeeTeamWide
      ? summariesData
      : summariesData.filter((x) => x.assigneeUserId === userId)

  const assignmentsByUser = useMemo(() => {
    const m = new Map<string, PerformanceAssignment[]>()
    for (const item of assignmentsData) {
      const rows = m.get(item.assigneeUserId) ?? []
      rows.push(item)
      m.set(item.assigneeUserId, rows)
    }
    return m
  }, [assignmentsData])

  const selectedDetailUserId = useMemo(() => {
    if (!canSeeTeamWide) return userId ?? ''
    if (selectedUserId && assignmentsByUser.has(selectedUserId)) return selectedUserId
    const first = assignmentsByUser.keys().next().value
    return typeof first === 'string' ? first : ''
  }, [selectedUserId, assignmentsByUser, canSeeTeamWide, userId])

  const detailRows = useMemo(
    () => (selectedDetailUserId ? (assignmentsByUser.get(selectedDetailUserId) ?? []) : []),
    [selectedDetailUserId, assignmentsByUser]
  )

  useEffect(() => {
    if (!selectedTeamId) return
    window.localStorage.setItem(
      'assistant.kpiContext',
      JSON.stringify({ teamId: selectedTeamId, year, month })
    )
  }, [selectedTeamId, year, month])

  // Khi Manager vừa duyệt kết quả (status -> approved), backend set finalEvalStatus cho từng item.
  // Cần làm mới assignment + tổng hợp để member thấy cột "Manager ĐG" thay vì cache cũ (trống).
  useEffect(() => {
    if (resultApprovalRequest?.status === 'approved') {
      void qc.invalidateQueries({
        queryKey: ['monthly-report-assignments', selectedTeamId, year, month],
      })
      void qc.invalidateQueries({
        queryKey: ['monthly-report-summaries', selectedTeamId, year, month],
      })
    }
  }, [resultApprovalRequest?.status, qc, selectedTeamId, year, month])

  const eff = useMemo(() => resolveEffectivePermissionSet(user), [user])
  const allowEpic4SelfEdit =
    Boolean(userId) &&
    !canSeeTeamWide &&
    selectedDetailUserId === userId &&
    eff.has('kpi.edit_own') &&
    !isMockApiEnabled() &&
    // Khóa nhập khi kết quả đang chờ duyệt (pending) hoặc đã được duyệt (approved)
    !isResultLocked

  const invalidateMonthlyAssignments = useCallback(() => {
    void qc.invalidateQueries({
      queryKey: ['monthly-report-assignments', selectedTeamId, year, month],
    })
  }, [qc, selectedTeamId, year, month])

  const handleExportExcel = () => {
    import('xlsx')
      .then((XLSX) => {
        const wsData = [
          ['Nhân sự', 'KPI đạt', 'KPI chưa đạt', 'Loại KPI', 'OKR đạt', 'OKR chưa đạt', 'Loại OKR'],
          ...summaryRows.map(function (row) {
            return [
              row.assigneeDisplayName || row.assigneeEmail || 'Thành viên',
              row.kpiOkCount,
              row.kpiNotCount,
              row.kpiGrade ?? '',
              row.okrOkCount,
              row.okrNotCount,
              row.okrGrade ?? '',
            ]
          }),
        ]
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'KPI-OKR')
        const deptName = selectedDept?.name || 'tat-ca'
        XLSX.writeFile(wb, `bao-cao-T${month}-${year}-${deptName}.xlsx`)
      })
      .catch(() => {
        alert('Không tải được thư viện xuất Excel. Kiểm tra kết nối và thử lại.')
      })
  }

  const okCount = assignmentsData.filter((x) => {
    const status = hideManagerEvalColumn
      ? (x.managerEvalStatus ?? '')
      : (x.finalEvalStatus ?? x.managerEvalStatus ?? '')
    return status.trim().toUpperCase() === 'OK'
  }).length

  const teamMemberName = (userId: string) => {
    const row = membersQ.data?.members.find((m) => m.userId === userId)
    return row?.displayName?.trim() || row?.email?.trim() || 'Thành viên'
  }

  return (
    <div className="mx-auto">
      {/* ── Page header: title + actions ── */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
            Báo cáo hàng tháng
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {canSeeTeamWide
              ? `${selectedDept?.name ?? 'Tất cả phòng ban'} · ${assignmentsData.length} mục tiêu · ${summaryRows.length} nhân sự`
              : 'Theo dõi tiến độ KPI/OKR cá nhân'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-lg"
            onClick={() => {
              void treeQ.refetch()
              void qc.invalidateQueries({ queryKey: ORG_TREE_KEY })
              void membersQ.refetch()
              void summariesQ.refetch()
              void assignmentsQ.refetch()
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
          {canSeeTeamWide && summaryRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg"
              onClick={handleExportExcel}
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
          )}
        </div>
      </div>

      {/* ── Control toolbar: filters + view switcher ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
        {/* Phòng ban */}
        <Select
          value={selectedDept?.id ?? '__none'}
          disabled={!canSeeTeamWide}
          onValueChange={(value) => {
            const dept = departments.find((d) => d.id === value)
            const nextTeam =
              dept?.teams.find((t) => memberTeamIds.includes(t.id))?.id ?? dept?.teams[0]?.id ?? ''
            setSelectedTeamId(nextTeam)
          }}
        >
          <SelectTrigger className="h-8 min-w-[12rem] w-auto max-w-[22rem] rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800 [&>span]:whitespace-nowrap">
            <SelectValue placeholder="Phòng ban" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Tất cả</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Nhóm */}
        <Select
          value={selectedTeamId || '__none'}
          disabled={!canSeeTeamWide && !memberMultiTeam}
          onValueChange={(value) => setSelectedTeamId(value === '__none' ? '' : value)}
        >
          <SelectTrigger className="h-8 min-w-[14rem] w-auto max-w-[28rem] rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800 [&>span]:whitespace-nowrap">
            <SelectValue placeholder={memberMultiTeam ? 'Nhóm đang xem' : 'Nhóm'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Tất cả</SelectItem>
            {(memberMultiTeam ? memberTeamOptions : teamsInDept).map((t) => {
              const deptSuffix =
                memberMultiTeam && 'deptName' in t && typeof t.deptName === 'string'
                  ? t.deptName
                  : null
              return (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {deptSuffix ? (
                    <span className="ml-1 text-xs text-slate-400">· {deptSuffix}</span>
                  ) : null}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

        {/* Tháng */}
        <Select
          value={String(month)}
          onValueChange={(value) => {
            const next = clampKpiPeriod(year, Number(value))
            setYear(next.year)
            setMonth(next.month)
          }}
        >
          <SelectTrigger className="h-8 w-[7.5rem] shrink-0 rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)} disabled={!isKpiPeriodSelectable(year, m)}>
                Tháng {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Năm */}
        <Input
          type="number"
          value={year}
          min={2020}
          max={maxViewYm.year}
          className="h-8 w-[5.5rem] shrink-0 rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800"
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            const next = clampKpiPeriod(v, month)
            setYear(next.year)
            setMonth(next.month)
          }}
        />

        {/* Tab switcher — flush right */}
        <div className="ml-auto flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-[#006C49]/80 dark:bg-slate-800 dark:ring-slate-700">
          {(['kpi-okr', 'work-report'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeTab === tab
                  ? 'bg-[#006C49] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              {tab === 'kpi-okr' ? 'KPI/OKR' : 'Tổng kết'}
            </button>
          ))}
        </div>
      </div>

      {/* Work report tab */}
      {activeTab === 'work-report' && (
        <WorkReportTab
          selectedTeamId={selectedTeamId}
          year={year}
          month={month}
          canSeeTeamWide={canSeeTeamWide}
        />
      )}

      {activeTab === 'kpi-okr' && (
        <>
          {/* ── HR snapshot tiles ── */}
          {canSeeTeamWide && selectedDept?.id && hrCounters && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  label: 'Lên cấp',
                  value: hrCounters.promoted,
                  color: 'emerald',
                  Icon: TrendingUp,
                },
                {
                  label: 'Chưa học xong',
                  value: hrCounters.notLearned,
                  color: 'amber',
                  Icon: Calendar,
                },
                { label: 'Mới vào', value: hrCounters.newJoiners, color: 'blue', Icon: Users },
                { label: 'Nghỉ việc', value: hrCounters.leavers, color: 'rose', Icon: UserRound },
              ].map(({ label, value, color, Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      color === 'emerald' &&
                        'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
                      color === 'amber' &&
                        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                      color === 'blue' &&
                        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                      color === 'rose' &&
                        'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {value}
                    </div>
                    <div className="truncate text-xs text-slate-500">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── KPI Summary: collapsible table ── */}
          {!selectedTeamId && !teamInitDone ? (
            <Card>
              <CardContent className="space-y-2 py-5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : !selectedTeamId ? (
            <Card className="border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50">
              <CardContent className="py-6 text-center text-sm text-slate-500">
                Chọn nhóm để xem báo cáo.
              </CardContent>
            </Card>
          ) : membersQ.isLoading || summariesQ.isLoading || assignmentsQ.isLoading ? (
            <Card>
              <CardContent className="space-y-2 py-5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Accordion
                type="multiple"
                defaultValue={['summary']}
                className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2"
              >
                <AccordionItem
                  value="summary"
                  className="overflow-hidden rounded-xl border border-slate-200 bg-card text-card-foreground shadow-sm dark:border-slate-800"
                >
                  <AccordionTrigger className="flex w-full items-center justify-between gap-3 rounded-none px-3 py-2.5 hover:bg-slate-50/50 hover:no-underline dark:hover:bg-slate-800/50 [&[data-state=open]>svg.chevron-accordion]:rotate-180">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        <Target className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Tổng hợp KPI/OKR
                        </h3>
                        <p className="text-xs text-slate-500">
                          {summaryRows.length} nhân sự · {okCount} mục đạt (OK) ·{' '}
                          {assignmentsData.length} mục tiêu
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="chevron-accordion h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" />
                  </AccordionTrigger>
                  <AccordionContent className="border-t pb-0">
                    {summaryRows.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50/80 dark:bg-slate-800/50">
                              <th className="px-4 py-2.5 text-left font-semibold text-slate-500">
                                Nhân sự
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                KPI đạt
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                KPI chưa
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                Loại
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                OKR đạt
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                OKR chưa
                              </th>
                              <th className="px-3 py-2.5 text-center font-semibold text-slate-500">
                                Loại
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryRows.map((row) => (
                              <tr
                                key={row.id}
                                className="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                  {row.assigneeDisplayName?.trim() ||
                                    row.assigneeEmail?.trim() ||
                                    'Thành viên'}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                  {row.kpiOkCount}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                  {row.kpiNotCount}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold">
                                  {row.kpiGrade ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                  {row.okrOkCount}
                                </td>
                                <td className="px-3 py-2.5 text-center tabular-nums">
                                  {row.okrNotCount}
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold">
                                  {row.okrGrade ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">
                        Chưa có dữ liệu tổng hợp. Trưởng nhóm tính lại ở màn KPI & OKR.
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="detail"
                  className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-card text-card-foreground shadow-sm dark:border-slate-800"
                >
                  <AccordionTrigger className="flex w-full items-center justify-between gap-3 rounded-none px-3 py-2.5 hover:bg-slate-50/50 hover:no-underline dark:hover:bg-slate-800/50 [&[data-state=open]>svg.chevron-accordion]:rotate-180">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <Search className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 text-left">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          Chi tiết mục tiêu
                        </h3>
                        {selectedDetailUserId && (
                          <p className="text-xs text-slate-500">
                            {teamMemberName(selectedDetailUserId)} · {detailRows.length} mục tiêu
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="chevron-accordion h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200" />
                  </AccordionTrigger>
                  <AccordionContent className="border-t pb-0">
                    {/* Member selector tabs — clean horizontal tabs, not pills */}
                    {canSeeTeamWide && (
                      <div className="border-t">
                        <div className="flex overflow-x-auto gap-0 border-b border-slate-200 dark:border-slate-800">
                          {Array.from(assignmentsByUser.keys()).map((uid) => (
                            <button
                              key={uid}
                              type="button"
                              onClick={() => setSelectedUserId(uid)}
                              className={cn(
                                'shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                                uid === selectedDetailUserId
                                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
                              )}
                            >
                              {teamMemberName(uid)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!canSeeTeamWide && isResultLocked && (
                      <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          {resultApprovalRequest?.status === 'approved'
                            ? 'Kết quả KPI/OKR kỳ này đã được Manager duyệt — không thể chỉnh sửa.'
                            : 'Kết quả KPI/OKR kỳ này đang chờ Manager duyệt — không thể chỉnh sửa.'}
                        </div>
                      </div>
                    )}

                    {detailRows.length === 0 ? (
                      <div className="border-t px-4 py-6 text-center text-xs text-slate-400">
                        Không có mục tiêu KPI/OKR trong kỳ này.
                      </div>
                    ) : (
                      <div>
                        {/* Mobile: card stack */}
                        <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
                          {detailRows.map((item) =>
                            allowEpic4SelfEdit ? (
                              <MonthlyReportDetailEditableMobileCard
                                key={item.id}
                                item={item}
                                onSaved={invalidateMonthlyAssignments}
                              />
                            ) : (
                              <MonthlyReportDetailReadOnlyCard
                                key={item.id}
                                item={item}
                                hideManagerEvalColumn={hideManagerEvalColumn}
                              />
                            )
                          )}
                        </div>
                        {/* Desktop: bảng + modal nhập liệu */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Ngày xét
                                </th>
                                <th className="px-3 py-3 text-left font-semibold text-slate-500">
                                  Hạng mục
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Ưu tiên
                                </th>
                                <th className="px-3 py-3 text-left font-semibold text-slate-500">
                                  Nội dung
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Chỉ tiêu
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  QL duyệt mục tiêu
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Kết quả
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Tự ĐG
                                </th>
                                <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                  Leader ĐG
                                </th>
                                {!hideManagerEvalColumn ? (
                                  <th className="whitespace-nowrap px-3 py-3 text-left font-semibold text-slate-500">
                                    Manager ĐG
                                  </th>
                                ) : null}
                                <th className="px-3 py-3 text-right font-semibold text-slate-500"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailRows.map((item) =>
                                allowEpic4SelfEdit ? (
                                  <MonthlyReportMemberTableRow
                                    key={item.id}
                                    item={item}
                                    onSaved={invalidateMonthlyAssignments}
                                    hideManagerEvalColumn={hideManagerEvalColumn}
                                  />
                                ) : (
                                  <MonthlyReportReadOnlyTableRow
                                    key={item.id}
                                    item={item}
                                    hideManagerEvalColumn={hideManagerEvalColumn}
                                  />
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-lg">
                    {canSeeTeamWide ? 'Phản hồi từ nhân sự' : 'Form khảo sát tháng này'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <FormPanel
                    teamId={selectedTeamId}
                    year={year}
                    month={month}
                    canEditTeam={false}
                    currentUserId={userId ?? ''}
                    readOnly={canSeeTeamWide}
                    showQuestionForm={!canSeeTeamWide}
                    embedded
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
