import { CustomSelect } from '@/components/shared/CustomSelect'
import { OrgUserAvatar } from '@/components/shared/EmployeeAvatar'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputController,
  SelectController,
  TextareaController,
} from '@/components/ui/form-controllers'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ORG_TREE_KEY, useHrOrgTree } from '@/features/hr-admin/useHrOrgTree'
import {
  performanceApi,
  type ApprovalRequest,
  type PerformanceAssignment,
  type PerformanceQuestionnaire,
  type PerformanceSummaryRow,
} from '@/features/kpi-okr/api'
import {
  catalogSeedEnabledForTeam,
  filterKpiEligibleMembers,
  isCatalogEnabledDepartment,
  isCatalogSeedExcludedTeam,
  isMandatoryMetric,
  isTrafficTeam,
  kpiEligibleUserIdSet,
  memberRequiresKpiOkr,
  requiresKpiApproval,
  resolveTemplateCodeForTeam,
  shouldShowAssignmentForMember,
} from '@/features/kpi-okr/catalogHelpers'
import { useKpiOkrAutoSeed } from '@/features/kpi-okr/components/hooks/useKpiOkrAutoSeed'
import {
  ASSIGN_TABLE_HEAD,
  AssignmentEpic4ReadCells,
  AssignmentEpic4ReadStack,
  CELL_EVIDENCE,
  CELL_NUMERIC,
  CELL_SELF_EVAL,
  CELL_UNIT,
  ContentCell,
  EVAL_LEADER_CELL,
  EVAL_MANAGER_CELL,
  EvalStatusBadge,
  GoalReviewStatusBadge,
  GoalReviewSummary,
  KindBadge,
  PLANNING_ASSIGN_TABLE_HEAD,
  PriorityBadge,
  TABLE_INLINE_SELECT_TRIGGER,
  XL_BORDER,
  XL_TH,
  formatKpiSetAt,
  formatViNumber,
  periodLabel,
  resolveParentKpiDisplay,
  resultsColumnHeadClass,
  resultsTableMinWidthClass,
  xlTd,
} from '@/features/kpi-okr/components/kpiAssignmentTableShared'
import { KpiEvidenceInput } from '@/features/kpi-okr/components/KpiEvidenceInput'
import { KpiProgressBar } from '@/features/kpi-okr/components/KpiProgressBar'
import {
  AssignmentSubItemsInline,
  SubItemsEditSection,
  SubItemsEditorPanel,
  mapSubItemsToPayload,
  subItemsFromAssignment,
} from '@/features/kpi-okr/components/kpiSubItemsShared'
import {
  SubItemsSelfEditInline,
  isSubItemResultComplete,
} from '@/features/kpi-okr/components/SubItemsSelfEdit'
import {
  parseKpiOkrImportFile,
  type ImportAssignmentItem,
} from '@/features/kpi-okr/kpiOkrSheetImport'
import {
  clampKpiPeriod,
  formatKinhDoanhResultsCloseRange,
  getAssignmentWindowPhase,
  getKinhDoanhResultsCloseWindowPhase,
  getMaxViewableYm,
  isAnswerWindowOpen,
  isAssignmentWindowOpen,
  isKinhDoanhResultsCloseWindowOpen,
  isKpiPeriodSelectable,
  resolveAssignmentWindowForTeam,
  resolveKinhDoanhResultsCloseWindowForTeam,
} from '@/features/kpi-okr/kpiPeriodLimits'
import { parseQuestionnaireImportFile } from '@/features/kpi-okr/questionnaireGridImport'
import { useKpiOkrStream } from '@/features/kpi-okr/useKpiOkrStream'
import type { SubItemDraft } from '@/features/kpi-okr/utils/kpiProgressUtils'
import {
  organizationApi,
  type OrgTreeDepartment,
  type TeamMemberRow,
} from '@/features/organization/api'
import { resolveEffectivePermissionSet } from '@/features/permissions/resolveEffective'
import { getApiErrorMessage } from '@/lib/axios'
import { CARD_ENTRANCE } from '@/lib/cardMotion'
import { isManagerLikeRole } from '@/lib/managerLikeRole'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlignLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileUp,
  ListOrdered,
  ListPlus,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

function nowYm() {
  const n = new Date()
  return { year: n.getFullYear(), month: n.getMonth() + 1 }
}

function formatAnswerWindow(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const mm = String(month).padStart(2, '0')
  const nmm = String(nextMonth).padStart(2, '0')
  return `01/${mm}/${year} → 05/${nmm}/${nextYear}`
}

export type KpiOkrWorkspaceProps = {
  variant: 'leader' | 'member' | 'manager'
  title: string
  description: string
  teamScope?: 'all' | 'business'
}

function normalizeOrgSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isBusinessDepartment(dept: OrgTreeDepartment): boolean {
  const label = normalizeOrgSearchText(dept.name)
  return label.includes('kinh doanh') || label.includes('sales')
}

export function KpiOkrWorkspace({
  variant,
  title,
  description,
  teamScope = 'all',
}: KpiOkrWorkspaceProps) {
  const user = useAuthStore((s) => s.user)
  const isMemberView = variant === 'member'
  const isManagerVariant = variant === 'manager'
  const isManagerReadOnly = isManagerLikeRole(user?.role) && !isManagerVariant
  const qc = useQueryClient()
  const treeQ = useHrOrgTree()
  const { year: y0, month: m0 } = nowYm()
  const [year, setYear] = useState(y0)
  const [month, setMonth] = useState(m0)
  const [selectedTeamId, setSelectedTeamId] = useState<string | ''>('')

  const maxViewYm = getMaxViewableYm()

  const eff = useMemo(
    () => (user ? resolveEffectivePermissionSet(user) : new Set<string>()),
    [user]
  )

  const canEditTeam = useMemo(() => {
    if (variant === 'manager') return eff.has('kpi.team_edit')
    if (variant === 'leader') return !isManagerReadOnly && eff.has('kpi.team_edit')
    return false
  }, [variant, eff, isManagerReadOnly])

  const catalogAllowlistQ = useQuery({
    queryKey: ['performance', 'catalog-division-allowlist'],
    queryFn: () => performanceApi.getCatalogDivisionAllowlist(),
    staleTime: 60_000,
    enabled: !isMockApiEnabled(),
  })

  const departments = useMemo(() => {
    const allDepartments = treeQ.data?.departments ?? []
    const scopedDepartments =
      teamScope === 'business'
        ? (() => {
            const businessDepartments = allDepartments.filter(isBusinessDepartment)
            if (businessDepartments.length > 0) return businessDepartments
            return allDepartments.filter((dept) =>
              isCatalogEnabledDepartment(dept, catalogAllowlistQ.data?.mergedDivisionIds ?? null)
            )
          })()
        : allDepartments

    if (!isMemberView) return scopedDepartments
    const memberTeamIds = new Set((user?.teamIds ?? []).filter(Boolean))
    if (!memberTeamIds.size) return []
    return scopedDepartments
      .map((dept) => ({
        ...dept,
        teams: dept.teams.filter((team) => memberTeamIds.has(team.id)),
      }))
      .filter((dept) => dept.teams.length > 0)
  }, [
    treeQ.data,
    isMemberView,
    user?.teamIds,
    teamScope,
    catalogAllowlistQ.data?.mergedDivisionIds,
  ])
  const selectedDept = useMemo(
    () => departments.find((d) => d.teams.some((t) => t.id === selectedTeamId)),
    [departments, selectedTeamId]
  )
  const teamsInDept = selectedDept?.teams ?? departments[0]?.teams ?? []
  const memberTeamIds = useMemo(() => (user?.teamIds ?? []).filter(Boolean), [user?.teamIds])
  const memberMultiTeam = isMemberView && memberTeamIds.length > 1
  /** MANAGER: bộ lọc hiển thị TẤT CẢ team, không gò theo phòng ban. */
  const allTeamsFlat = useMemo(
    () =>
      departments
        .flatMap((d) => d.teams.map((t) => ({ id: t.id, name: t.name, deptName: d.name })))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [departments]
  )
  const memberTeamOptions = useMemo(
    () => allTeamsFlat.filter((t) => memberTeamIds.includes(t.id)),
    [allTeamsFlat, memberTeamIds]
  )
  const selectedTeamInScope = useMemo(
    () =>
      selectedTeamId
        ? departments.some((dept) => dept.teams.some((team) => team.id === selectedTeamId))
        : false,
    [departments, selectedTeamId]
  )

  useEffect(() => {
    if (selectedTeamId && selectedTeamInScope) return
    const ids = memberTeamIds
    const storageKey = user?.id ? `kpi-workspace-team-${user.id}` : null
    const saved = storageKey ? localStorage.getItem(storageKey) : null
    const preferredId =
      saved && ids.includes(saved)
        ? saved
        : ids.find((id) => departments.some((d) => d.teams.some((t) => t.id === id)))
    const fallbackTeamId = departments[0]?.teams[0]?.id
    const id = window.setTimeout(() => {
      if (preferredId) {
        setSelectedTeamId(preferredId)
        return
      }
      if (!isMemberView && fallbackTeamId) {
        setSelectedTeamId(fallbackTeamId)
        return
      }
      if (selectedTeamId && !selectedTeamInScope) {
        setSelectedTeamId('')
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [memberTeamIds, departments, selectedTeamId, selectedTeamInScope, isMemberView, user?.id])

  useEffect(() => {
    if (!isMemberView || !memberMultiTeam || !selectedTeamId || !user?.id) return
    localStorage.setItem(`kpi-workspace-team-${user.id}`, selectedTeamId)
  }, [isMemberView, memberMultiTeam, selectedTeamId, user?.id])

  const assignKey = useMemo(
    () => ['kpi-assignments', selectedTeamId, year, month] as const,
    [selectedTeamId, year, month]
  )
  const sumKey = useMemo(
    () => ['kpi-summaries', selectedTeamId, year, month] as const,
    [selectedTeamId, year, month]
  )
  const membersKpiKey = useMemo(
    () => ['team-members-kpi', selectedTeamId] as const,
    [selectedTeamId]
  )

  const { connected: sseConnected } = useKpiOkrStream({
    teamId: selectedTeamId || undefined,
    year,
    month,
  })

  const membersForTeamQ = useQuery({
    queryKey: membersKpiKey,
    queryFn: () => organizationApi.getTeamMembers(selectedTeamId!),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })

  const visibleMembers = useMemo(() => {
    const allMembers = membersForTeamQ.data?.members ?? []
    if (!isMemberView) return allMembers
    const selfId = user?.id?.trim()
    if (!selfId) return []
    return allMembers.filter((member) => member.userId === selfId)
  }, [membersForTeamQ.data?.members, isMemberView, user?.id])

  const assignmentsQ = useQuery({
    queryKey: assignKey,
    queryFn: () =>
      selectedTeamId
        ? performanceApi.listAssignments(selectedTeamId, year, month)
        : Promise.resolve([] as PerformanceAssignment[]),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })

  const summariesQ = useQuery({
    queryKey: sumKey,
    queryFn: () =>
      selectedTeamId
        ? performanceApi.listSummaries(selectedTeamId, year, month)
        : Promise.resolve([] as PerformanceSummaryRow[]),
    enabled: Boolean(selectedTeamId) && !isMockApiEnabled(),
  })

  const windowConfigsQ = useQuery({
    queryKey: ['performance', 'window-configs'],
    queryFn: () => performanceApi.listWindowConfigs(),
    staleTime: 60_000,
    enabled: !isMockApiEnabled(),
  })

  const assignmentWindowBounds = useMemo(
    () =>
      selectedTeamId
        ? resolveAssignmentWindowForTeam(selectedTeamId, year, month, windowConfigsQ.data ?? [])
        : { startDay: 1, endDay: 2 },
    [selectedTeamId, year, month, windowConfigsQ.data]
  )

  const assignmentWindowPhase = useMemo(() => {
    if (!selectedTeamId) return null
    return getAssignmentWindowPhase(year, month, {
      startDay: assignmentWindowBounds.startDay,
      endDay: assignmentWindowBounds.endDay,
    })
  }, [selectedTeamId, year, month, assignmentWindowBounds])

  const assignmentWindowOpen = useMemo(
    () =>
      Boolean(selectedTeamId) &&
      isAssignmentWindowOpen(year, month, {
        startDay: assignmentWindowBounds.startDay,
        endDay: assignmentWindowBounds.endDay,
      }),
    [selectedTeamId, year, month, assignmentWindowBounds]
  )

  const selectedTeamForSeed = useMemo(() => {
    if (!selectedTeamId) return null
    for (const d of departments) {
      const t = d.teams.find((x) => x.id === selectedTeamId)
      if (t)
        return {
          id: t.id,
          name: t.name,
          requiresKpiApproval: t.requiresKpiApproval,
          catalogSeedEnabled: t.catalogSeedEnabled,
        }
    }
    return null
  }, [departments, selectedTeamId])

  const isTrafficTeamSelected = isTrafficTeam(
    selectedTeamId,
    catalogAllowlistQ.data?.trafficTeamIds ?? null,
    selectedTeamForSeed?.name ?? null
  )
  const requiresKpiApprovalSelected = requiresKpiApproval(
    selectedTeamId,
    catalogAllowlistQ.data?.kpiApprovalTeamIds ?? null,
    selectedTeamForSeed?.requiresKpiApproval ?? null
  )
  const catalogSeedEnabledSelected = catalogSeedEnabledForTeam(
    selectedTeamId,
    catalogAllowlistQ.data?.catalogSeedTeamIds ?? null,
    selectedTeamForSeed?.catalogSeedEnabled ?? null
  )

  const kpiEligibleMembers = useMemo(
    () => filterKpiEligibleMembers(visibleMembers, isTrafficTeamSelected),
    [visibleMembers, isTrafficTeamSelected]
  )

  const kpiEligibleAssigneeIds = useMemo(
    () => kpiEligibleUserIdSet(membersForTeamQ.data?.members ?? [], isTrafficTeamSelected),
    [membersForTeamQ.data?.members, isTrafficTeamSelected]
  )

  const memberSelfKpiExempt = useMemo(() => {
    if (!isMemberView || !user?.id) return false
    const self = (membersForTeamQ.data?.members ?? []).find((m) => m.userId === user.id)
    if (!self) return false
    return !memberRequiresKpiOkr(self, isTrafficTeamSelected)
  }, [isMemberView, user?.id, membersForTeamQ.data?.members, isTrafficTeamSelected])

  const goalApprovalKey = ['kpi-approval-request', selectedTeamId, year, month, 'goal'] as const
  const resultApprovalKey = ['kpi-approval-request', selectedTeamId, year, month, 'result'] as const
  const goalApprovalQ = useQuery({
    queryKey: goalApprovalKey,
    queryFn: () => performanceApi.getApprovalRequest(selectedTeamId!, year, month, 'goal'),
    enabled: Boolean(selectedTeamId) && requiresKpiApprovalSelected && !isMockApiEnabled(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: sseConnected ? false : 15_000,
  })
  const resultApprovalQ = useQuery({
    queryKey: resultApprovalKey,
    queryFn: () => performanceApi.getApprovalRequest(selectedTeamId!, year, month, 'result'),
    enabled: Boolean(selectedTeamId) && requiresKpiApprovalSelected && !isMockApiEnabled(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: sseConnected ? false : 15_000,
  })
  const goalApprovalRequest = goalApprovalQ.data ?? null
  const resultApprovalRequest = resultApprovalQ.data ?? null
  const isGoalApprovalLocked =
    requiresKpiApprovalSelected &&
    variant === 'leader' &&
    (goalApprovalRequest?.status === 'pending' || goalApprovalRequest?.status === 'approved')
  // Lock kết quả - chỉ áp dụng cho Traffic team. Áp dụng CHUNG cho cả Leader và Member:
  // - pending: locked (đang chờ Manager duyệt)
  // - approved: locked (đã duyệt, chốt kết quả)
  // - rejected / chưa gửi (null): mở để nhập/sửa
  const isResultApprovalLocked =
    requiresKpiApprovalSelected &&
    (resultApprovalRequest?.status === 'pending' || resultApprovalRequest?.status === 'approved')

  // Epic 4 — PATCH .../me; nhập kết quả (số liệu / evidence / tự đánh giá) theo kỳ đang chọn
  // Non-Traffic team: luôn được nhập nếu có quyền.
  // Traffic team (cả Leader và Member): chỉ nhập/sửa khi chưa gửi (null) hoặc bị từ chối (rejected);
  // KHOÁ khi đang chờ duyệt (pending) hoặc đã được duyệt (approved).
  const canMemberEditSelfResults = useMemo(() => {
    if (!user?.id || !eff.has('kpi.edit_own') || isMockApiEnabled()) return false
    if (!requiresKpiApprovalSelected) return true
    const st = resultApprovalRequest?.status
    return st !== 'pending' && st !== 'approved'
  }, [user?.id, eff, requiresKpiApprovalSelected, resultApprovalRequest?.status])

  const isKinhDoanhTeam = Boolean(
    selectedDept &&
    isCatalogEnabledDepartment(selectedDept, catalogAllowlistQ.data?.mergedDivisionIds ?? null)
  )

  const kinhDoanhResultsCloseBounds = useMemo(
    () =>
      selectedTeamId && isKinhDoanhTeam
        ? resolveKinhDoanhResultsCloseWindowForTeam(
            selectedTeamId,
            year,
            month,
            (windowConfigsQ.data ?? []).map((c) => ({
              teamId: c.teamId,
              year: c.year,
              month: c.month,
              answerStartDay: c.answerStartDay,
              answerEndDay: c.answerEndDay,
            }))
          )
        : { startDay: 1, endDay: 30 },
    [selectedTeamId, isKinhDoanhTeam, year, month, windowConfigsQ.data]
  )

  const kinhDoanhResultsClosePhase = useMemo(() => {
    if (!isKinhDoanhTeam) return null
    return getKinhDoanhResultsCloseWindowPhase(year, month, {
      startDay: kinhDoanhResultsCloseBounds.startDay,
      endDay: kinhDoanhResultsCloseBounds.endDay,
    })
  }, [isKinhDoanhTeam, year, month, kinhDoanhResultsCloseBounds])

  const kinhDoanhResultsCloseOpen = useMemo(
    () =>
      !isKinhDoanhTeam ||
      isKinhDoanhResultsCloseWindowOpen(year, month, {
        startDay: kinhDoanhResultsCloseBounds.startDay,
        endDay: kinhDoanhResultsCloseBounds.endDay,
      }),
    [isKinhDoanhTeam, year, month, kinhDoanhResultsCloseBounds]
  )

  const selectedTemplateCode = useMemo(() => {
    if (isTrafficTeamSelected) return 'TRAFFIC_TEAM_NV'
    if (!catalogSeedEnabledSelected) return undefined
    if (selectedTeamForSeed && isCatalogSeedExcludedTeam(selectedTeamForSeed)) return undefined
    if (selectedTeamForSeed) return resolveTemplateCodeForTeam(selectedTeamForSeed)
    return 'SALES_NV'
  }, [catalogSeedEnabledSelected, isTrafficTeamSelected, selectedTeamForSeed])

  /** Phòng Kinh doanh: member/leader ẩn P3 + BENEFIT; manager xem đầy đủ để cấu hình. */
  const visibleAssignmentsThisMonth = useMemo(() => {
    const rows = (assignmentsQ.data ?? []).filter((row) =>
      kpiEligibleAssigneeIds.has(row.assigneeUserId)
    )
    const passesKinhDoanhDisplay = (row: PerformanceAssignment) =>
      !isKinhDoanhTeam || shouldShowAssignmentForMember(row)

    if (isMemberView) {
      const selfId = user?.id?.trim()
      if (!selfId) return []
      return rows.filter((row) => row.assigneeUserId === selfId && passesKinhDoanhDisplay(row))
    }
    if (isKinhDoanhTeam) {
      return isManagerVariant ? rows : rows.filter(shouldShowAssignmentForMember)
    }
    return rows
  }, [
    assignmentsQ.data,
    isMemberView,
    isManagerVariant,
    user?.id,
    isKinhDoanhTeam,
    kpiEligibleAssigneeIds,
  ])

  useEffect(() => {
    if (!selectedTeamId) return
    window.localStorage.setItem(
      'assistant.kpiContext',
      JSON.stringify({ teamId: selectedTeamId, year, month })
    )
  }, [selectedTeamId, year, month])

  // Khi Manager vừa duyệt kết quả (status -> approved), backend đã set finalEvalStatus cho từng
  // assignment. Màn Leader/Member chuyển sang read-only nhưng dùng cache assignment cũ (chưa có
  // finalEvalStatus) → cột "Đánh giá Manager" trống. Làm mới assignment + tổng hợp để hiển thị đúng.
  useEffect(() => {
    if (resultApprovalRequest?.status === 'approved') {
      void qc.invalidateQueries({ queryKey: assignKey })
      void qc.invalidateQueries({ queryKey: sumKey })
    }
  }, [resultApprovalRequest?.status, qc, assignKey, sumKey])

  const [submittingGoalApproval, setSubmittingGoalApproval] = useState(false)
  const [submittingResultApproval, setSubmittingResultApproval] = useState(false)
  const handleSubmitForApproval = useCallback(async () => {
    if (!selectedTeamId) return
    setSubmittingGoalApproval(true)
    try {
      await performanceApi.submitForApproval(selectedTeamId, year, month, 'goal')
      void qc.invalidateQueries({ queryKey: goalApprovalKey })
      toast.success('Đã gửi duyệt mục tiêu KPI/OKR thành công')
    } catch (err: unknown) {
      toast.error('Gửi duyệt thất bại: ' + getApiErrorMessage(err))
    } finally {
      setSubmittingGoalApproval(false)
    }
  }, [selectedTeamId, year, month, qc, goalApprovalKey])

  const handleSubmitResultApproval = useCallback(async () => {
    if (!selectedTeamId) return
    setSubmittingResultApproval(true)
    try {
      await performanceApi.submitForApproval(selectedTeamId, year, month, 'result')
      void qc.invalidateQueries({ queryKey: resultApprovalKey })
      toast.success('Đã gửi duyệt kết quả thành công')
    } catch (err: unknown) {
      toast.error('Gửi duyệt kết quả thất bại: ' + getApiErrorMessage(err))
    } finally {
      setSubmittingResultApproval(false)
    }
  }, [selectedTeamId, year, month, qc, resultApprovalKey])

  const assignmentsThisMonth = assignmentsQ.data ?? []
  const loadingThis = assignmentsQ.isLoading

  // Template chỉ số tùy chỉnh do manager cấu hình — dùng để auto-seed tháng mới
  const templateQ = useQuery({
    queryKey: ['team-metric-templates', selectedTeamId],
    queryFn: () => performanceApi.listTeamMetricTemplates(selectedTeamId!),
    enabled: !!selectedTeamId && !isMockApiEnabled() && !!canEditTeam,
    staleTime: 60_000,
  })

  // Auto-seed mandatory + cleanup + template metrics (extracted to custom hook)
  useKpiOkrAutoSeed({
    selectedTeamId,
    year,
    month,
    loadingThis,
    assignmentsThisMonth,
    isKinhDoanhTeam,
    isTrafficTeamSelected,
    canEditTeam,
    selectedTemplateCode,
    assignKey,
    templateQ,
  })

  const autoRecalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recalculateSummariesNow = useCallback(async () => {
    if (!selectedTeamId || isMockApiEnabled()) return
    if (autoRecalcTimerRef.current) {
      clearTimeout(autoRecalcTimerRef.current)
      autoRecalcTimerRef.current = null
    }
    await performanceApi.recalculateSummaries(selectedTeamId, year, month)
    await qc.invalidateQueries({ queryKey: sumKey })
  }, [qc, sumKey, selectedTeamId, year, month])

  const refresh = useCallback(
    (opts?: { skipAutoRecalc?: boolean }) => {
      void qc.invalidateQueries({ queryKey: assignKey })
      void qc.invalidateQueries({ queryKey: sumKey })
      if (opts?.skipAutoRecalc) return
      // Tự động tính lại tổng hợp sau 1.5s debounce — gộp nhiều lần save liên tiếp thành 1 lần gọi.
      if (selectedTeamId && !isMockApiEnabled()) {
        if (autoRecalcTimerRef.current) clearTimeout(autoRecalcTimerRef.current)
        autoRecalcTimerRef.current = setTimeout(() => {
          void performanceApi
            .recalculateSummaries(selectedTeamId, year, month)
            .then(() => void qc.invalidateQueries({ queryKey: sumKey }))
        }, 1500)
      }
    },
    [qc, assignKey, sumKey, selectedTeamId, year, month]
  )

  const mockHint = isMockApiEnabled()

  return (
    <div className="relative isolate p-3">
      {/* ── Ambient background glow ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
      >
        <div className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-primary/22 blur-3xl" />
        <div className="absolute -right-16 top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-8 left-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-500/16 blur-3xl" />
      </div>

      {/* ── Unified toolbar (Linear-style): title + filters + context in one clean bar ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:gap-4">
        {/* Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h1>
            <p className="text-xs text-slate-500 truncate">{description}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

        {/* Filters — compact inline */}
        <div className="flex flex-wrap items-center gap-2">
          {!isManagerReadOnly && !isManagerVariant && (
            <Select
              value={selectedDept?.id ?? '__none'}
              disabled={isMemberView}
              onValueChange={(value) => {
                const d = departments.find((x) => x.id === value)
                setSelectedTeamId(d?.teams[0]?.id ?? '')
              }}
            >
              <SelectTrigger className="h-9 w-[145px] rounded-lg border-0 bg-slate-100 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 [&>span]:truncate [&>span]:whitespace-nowrap">
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
          )}
          <Select
            value={selectedTeamId || '__none'}
            disabled={isMemberView && !memberMultiTeam}
            onValueChange={(value) => setSelectedTeamId(value === '__none' ? '' : value)}
          >
            <SelectTrigger className="h-9 w-[135px] rounded-lg border-0 bg-slate-100 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 [&>span]:truncate [&>span]:whitespace-nowrap">
              <SelectValue placeholder={memberMultiTeam ? 'Nhóm đang xem' : 'Nhóm'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Tất cả</SelectItem>
              {(isManagerReadOnly || isManagerVariant
                ? allTeamsFlat
                : memberMultiTeam
                  ? memberTeamOptions
                  : teamsInDept
              ).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {(isManagerReadOnly || isManagerVariant || memberMultiTeam) &&
                    'deptName' in t &&
                    t.deptName && (
                      <span className="ml-1 text-xs text-slate-400">· {t.deptName}</span>
                    )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(month)}
            onValueChange={(value) => {
              const next = clampKpiPeriod(year, Number(value))
              setYear(next.year)
              setMonth(next.month)
            }}
          >
            <SelectTrigger className="h-9 w-[105px] rounded-lg border-0 bg-slate-100 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
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
          <Input
            type="number"
            value={year}
            min={2020}
            max={maxViewYm.year}
            className="h-9 w-[90px] rounded-lg border-0 bg-slate-100 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v)) return
              const next = clampKpiPeriod(v, month)
              setYear(next.year)
              setMonth(next.month)
            }}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Badge pills + refresh */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 rounded-md border-blue-200 bg-blue-50 text-xs font-semibold text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
          >
            T{month}/{year}
          </Badge>
          {selectedTeamId && (
            <Badge
              variant="outline"
              className="h-6 rounded-md border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800"
            >
              {assignmentsThisMonth.length} mục tiêu
            </Badge>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  void treeQ.refetch()
                  void qc.invalidateQueries({ queryKey: ORG_TREE_KEY })
                  refresh()
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Làm mới dữ liệu
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ── Context: mock hint, window lock, approval status ── */}
      {mockHint && (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Đang bật chế độ giả lập — không tải được dữ liệu KPI từ máy chủ. Tắt giả lập để dùng đầy
          đủ.
        </p>
      )}

      {canEditTeam && selectedTeamId && !assignmentWindowOpen && !mockHint && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {assignmentWindowPhase === 'before'
                ? 'Cửa sổ giao mục tiêu chưa mở'
                : 'Cửa sổ giao mục tiêu đã đóng'}
            </p>
            <p className="mt-1 text-sm opacity-90">
              {assignmentWindowPhase === 'before' ? (
                <>
                  Kỳ{' '}
                  <strong>
                    T{month}/{year}
                  </strong>{' '}
                  cho phép giao KPI/OKR từ ngày {assignmentWindowBounds.startDay} đến ngày{' '}
                  {assignmentWindowBounds.endDay}. Hiện chưa đến khoảng thời gian này. Liên hệ HR để
                  điều chỉnh nếu cần.
                </>
              ) : (
                <>
                  Kỳ{' '}
                  <strong>
                    T{month}/{year}
                  </strong>{' '}
                  chỉ cho phép giao KPI/OKR từ ngày {assignmentWindowBounds.startDay} đến ngày{' '}
                  {assignmentWindowBounds.endDay}. Khoảng thời gian đã kết thúc. Liên hệ HR để điều
                  chỉnh nếu cần.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {requiresKpiApprovalSelected && variant === 'leader' && selectedTeamId && (
        <>
          {/* Status banner — informational only, no action button here */}
          <div className="mb-4">
            {goalApprovalRequest?.status === 'pending' && (
              <div className="flex items-center gap-3 rounded-xl border border-yellow-400/50 bg-yellow-50 px-4 py-3 dark:border-yellow-700/40 dark:bg-yellow-950/30">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
                <div className="flex-1 text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Mục tiêu KPI/OKR tháng {month}/{year} đang chờ Manager duyệt — không thể chỉnh
                  sửa.
                </div>
              </div>
            )}
            {goalApprovalRequest?.status === 'approved' && (
              <div className="flex items-center gap-3 rounded-xl border border-green-400/50 bg-green-50 px-4 py-3 dark:border-green-700/40 dark:bg-green-950/30">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex-1 text-sm font-medium text-green-800 dark:text-green-200">
                  Mục tiêu KPI/OKR tháng {month}/{year} đã được duyệt.
                </div>
              </div>
            )}
            {goalApprovalRequest?.status === 'rejected' && (
              <div className="rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 dark:border-red-700/40 dark:bg-red-950/30">
                <div className="flex items-center gap-3">
                  <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <div className="flex-1 text-sm font-medium text-red-800 dark:text-red-200">
                    Mục tiêu KPI/OKR tháng {month}/{year} bị từ chối — bạn có thể chỉnh sửa và gửi
                    lại.
                  </div>
                </div>
                {goalApprovalRequest.note && (
                  <p className="mt-1.5 pl-7 text-xs text-red-700 dark:text-red-300">
                    Lý do: {goalApprovalRequest.note}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sticky bottom bar — modern SaaS pattern: context + action together */}
          {(!goalApprovalRequest || goalApprovalRequest.status === 'rejected') &&
            assignmentWindowOpen && (
              <div className="sticky bottom-0 z-40 -mx-3 md:-mx-4">
                <div className="mx-3 mb-3 md:mx-4 md:mb-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Left: context */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        <ClipboardList className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          Gửi duyệt KPI/OKR —{' '}
                          {selectedTeamForSeed?.name ?? `Team ${selectedTeamId.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Tháng {month}/{year} · {assignmentsThisMonth.length} mục tiêu · Gửi lên
                          Manager phụ trách
                        </p>
                      </div>
                    </div>

                    {/* Right: action button */}
                    <Button
                      onClick={() => void handleSubmitForApproval()}
                      disabled={submittingGoalApproval || !assignmentsThisMonth.length}
                      size="default"
                      className="shrink-0 gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-500/25 transition-all hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50"
                    >
                      {submittingGoalApproval ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <FileUp className="h-4 w-4" />
                          Gửi duyệt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
        </>
      )}

      <div className="space-y-6">
        {memberSelfKpiExempt && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Bạn là nhân sự Part-time — không cần thiết lập KPI/OKR cho team này.
          </div>
        )}
        <WorkReportPanel
          assignmentsThisMonth={visibleAssignmentsThisMonth}
          loadingThis={assignmentsQ.isLoading}
          members={kpiEligibleMembers}
          membersLoading={membersForTeamQ.isLoading}
          // Bảng "Chốt mục tiêu": khoá khi mục tiêu đang chờ duyệt / đã duyệt (goal lock).
          canEditTeam={canEditTeam && !isGoalApprovalLocked}
          // Bảng "Kết quả & đánh giá": ĐỘC LẬP với goal lock — chỉ khoá khi kết quả
          // đang chờ Manager duyệt (pending). null / rejected / approved → Leader được nhập kết quả.
          canEditResults={canEditTeam && !isResultApprovalLocked}
          isMemberView={isMemberView}
          selectedTeamId={selectedTeamId}
          year={year}
          month={month}
          currentUserId={user?.id}
          onRefresh={refresh}
          assignmentWindowOpen={assignmentWindowOpen && !isGoalApprovalLocked}
          assignmentWindowBounds={assignmentWindowBounds}
          canMemberEditSelfResults={canMemberEditSelfResults}
          planningReadOnly={isGoalApprovalLocked}
          templateCode={selectedTemplateCode}
          isManagerCascade={isManagerVariant}
          isTrafficTeam={isTrafficTeamSelected}
          // Bảng "Kết quả & đánh giá" chỉ hiển thị chỉ số khi mục tiêu đã được duyệt
          // (traffic team). Non-traffic không có luồng duyệt mục tiêu → luôn hiển thị.
          goalApproved={!requiresKpiApprovalSelected || goalApprovalRequest?.status === 'approved'}
          resultApprovalRequest={resultApprovalRequest}
          isResultApprovalLocked={isResultApprovalLocked}
          onSubmitResultApproval={handleSubmitResultApproval}
          submittingResultApproval={submittingResultApproval}
          canSubmitResultApproval={
            requiresKpiApprovalSelected &&
            variant === 'leader' &&
            (!resultApprovalRequest || resultApprovalRequest.status === 'rejected') &&
            visibleAssignmentsThisMonth.length > 0
          }
          isKinhDoanhTeam={isKinhDoanhTeam}
          kinhDoanhResultsCloseOpen={kinhDoanhResultsCloseOpen}
          kinhDoanhResultsCloseBounds={kinhDoanhResultsCloseBounds}
          kinhDoanhResultsClosePhase={kinhDoanhResultsClosePhase}
          onRecalculateSummaries={recalculateSummariesNow}
        />
        <SummaryPanel
          rows={summariesQ.data ?? []}
          loading={summariesQ.isLoading}
          teamId={selectedTeamId}
          year={year}
          month={month}
          canRecalculate={canEditTeam}
          onRecalculated={refresh}
          prioritizeAssigneeUserId={user?.id}
          viewerVariant={variant}
        />
        {!isManagerVariant && (
          <FormPanel
            teamId={selectedTeamId}
            year={year}
            month={month}
            canEditTeam={canEditTeam}
            currentUserId={user?.id ?? ''}
            readOnly={isManagerReadOnly}
          />
        )}
      </div>
    </div>
  )
}

function nameForMember(
  members: TeamMemberRow[],
  userId: string,
  rows?: PerformanceAssignment[]
): string {
  const m = members.find((x) => x.userId === userId)
  const name = m?.displayName?.trim()
  if (name) return name
  const assignmentName = rows
    ?.find((row) => row.assigneeDisplayName?.trim())
    ?.assigneeDisplayName?.trim()
  if (assignmentName) return assignmentName
  const email =
    m?.email?.trim() || rows?.find((row) => row.assigneeEmail?.trim())?.assigneeEmail?.trim()
  if (email) return email
  return 'chưa có tên'
}

function memberMetaForDisplay(
  members: TeamMemberRow[],
  userId: string,
  rows?: PerformanceAssignment[]
): string {
  const m = members.find((x) => x.userId === userId)
  const email =
    m?.email?.trim() || rows?.find((row) => row.assigneeEmail?.trim())?.assigneeEmail?.trim()
  if (email) return email
  return ''
}

function findTeamMember(members: TeamMemberRow[], userId: string): TeamMemberRow | undefined {
  return members.find((x) => x.userId === userId)
}

function teamMemberPortrait(m: TeamMemberRow | undefined): string | null | undefined {
  if (!m) return null
  return m.avatarUrl ?? m.portraitRef
}

const XL_INPUT = cn(
  'box-border h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
  'placeholder:text-slate-400'
)
const XL_TEXTAREA = cn(
  'box-border min-h-[80px] w-full min-w-[200px] max-w-[420px] resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
  'placeholder:text-slate-400'
)
/** Textarea trong ô bảng — không ép min-w 200px để tránh tràn cột. */
const TABLE_TEXTAREA = cn(
  'box-border min-h-[52px] w-full min-w-0 max-w-full resize-y rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10',
  'placeholder:text-slate-400'
)
const TABLE_EVIDENCE_TEXTAREA = 'min-h-[60px] min-w-0 max-w-full resize-y text-xs'

export type MemberSelfEditDraft = {
  evidence: string
  numericRaw: string
  numericUnit: string
  selfEvalStatus: string
  selfReviewNote: string
  managerEvalStatus?: string
  managerReviewNote?: string
}

function memberSelfDraftsEqual(a: MemberSelfEditDraft, b: MemberSelfEditDraft) {
  return (
    a.evidence === b.evidence &&
    a.numericRaw === b.numericRaw &&
    a.numericUnit === b.numericUnit &&
    a.selfEvalStatus === b.selfEvalStatus &&
    a.selfReviewNote === b.selfReviewNote &&
    a.managerEvalStatus === b.managerEvalStatus &&
    a.managerReviewNote === b.managerReviewNote
  )
}

function rowToMemberDraftSnapshot(
  row: PerformanceAssignment,
  overrides: Partial<MemberSelfEditDraft>,
  opts?: { leaderSelfSync?: boolean }
): MemberSelfEditDraft {
  const managerEvalStatus = opts?.leaderSelfSync
    ? (row.selfEvalStatus ?? row.managerEvalStatus ?? '')
    : (row.managerEvalStatus ?? '')
  return {
    evidence: row.evidence ?? '',
    numericRaw: row.numericValue != null ? String(row.numericValue) : '',
    numericUnit: row.numericUnit ?? '',
    selfEvalStatus: row.selfEvalStatus ?? '',
    selfReviewNote: row.selfReviewNote ?? '',
    managerEvalStatus,
    managerReviewNote: row.managerReviewNote ?? '',
    ...overrides,
  }
}

/** Leader tự chấm: Đánh giá Leader đồng bộ từ Tự đánh giá — chuẩn hoá trước so sánh/lưu. */
function normalizeDraftForLeaderSelf(
  draft: MemberSelfEditDraft,
  leaderSelfSync: boolean
): MemberSelfEditDraft {
  if (!leaderSelfSync) return draft
  return {
    ...draft,
    managerEvalStatus: draft.selfEvalStatus || draft.managerEvalStatus || '',
  }
}

function isManagerEvalComplete(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toUpperCase()
  return s === 'OK' || s === 'NOT'
}

/** Trạng thái Đánh giá Leader hiệu lực (gộp server + bản nháp chưa lưu). */
export type RowSubmitValidationHighlight = {
  numeric?: boolean
  numericUnit?: boolean
  evidence?: boolean
  selfEval?: boolean
  leaderEval?: boolean
}

/** Dùng red-500 — `destructive` chưa khai báo trong theme nên viền không hiện đỏ. */
const INVALID_FIELD_RING =
  '!border-2 !border-red-500 !ring-2 !ring-red-500/25 focus:!border-red-500 focus:!ring-red-500/35 focus-visible:!border-red-500 focus-visible:!ring-red-500/35'

function resolveManagerEvalStatusForRow(
  assignment: PerformanceAssignment,
  draft: MemberSelfEditDraft | undefined,
  opts: { currentUserId?: string; canEditResults: boolean }
): string {
  const isLeaderSelfRow = Boolean(
    opts.currentUserId && assignment.assigneeUserId === opts.currentUserId
  )
  const normalizedDraft = draft ? normalizeDraftForLeaderSelf(draft, isLeaderSelfRow) : undefined
  if (isLeaderSelfRow) {
    return (
      normalizedDraft?.managerEvalStatus ||
      normalizedDraft?.selfEvalStatus ||
      assignment.selfEvalStatus ||
      assignment.managerEvalStatus ||
      ''
    )
  }
  if (normalizedDraft?.managerEvalStatus) return normalizedDraft.managerEvalStatus
  if (opts.canEditResults) return assignment.managerEvalStatus ?? ''
  return (
    normalizedDraft?.managerEvalStatus ||
    normalizedDraft?.selfEvalStatus ||
    assignment.managerEvalStatus ||
    assignment.selfEvalStatus ||
    ''
  )
}

function computeRowSubmitValidationHighlights(
  assignment: PerformanceAssignment,
  draft: MemberSelfEditDraft | undefined,
  opts: { currentUserId?: string; canEditResults: boolean; templateCode?: string }
): RowSubmitValidationHighlight {
  const highlight: RowSubmitValidationHighlight = {}
  const isLeaderSelfRow = Boolean(
    opts.currentUserId && assignment.assigneeUserId === opts.currentUserId
  )
  const normalized = draft ? normalizeDraftForLeaderSelf(draft, isLeaderSelfRow) : undefined
  const hasSubItems = (assignment.subItems?.length ?? 0) > 0

  if (normalized && !hasSubItems) {
    const leaderEvalOnly = Boolean(opts.canEditResults && !isLeaderSelfRow)
    if (draftToPatchBody(normalized, { leaderEvalOnly }) === 'invalid') {
      highlight.numeric = true
    }
  }

  const numericRaw =
    normalized?.numericRaw ??
    (assignment.numericValue != null ? String(assignment.numericValue) : '')
  const evidence = (normalized?.evidence ?? assignment.evidence ?? '').trim()
  const selfEval = normalized?.selfEvalStatus ?? assignment.selfEvalStatus ?? ''
  const managerStatus = resolveManagerEvalStatusForRow(assignment, draft, {
    currentUserId: opts.currentUserId,
    canEditResults: opts.canEditResults,
  })

  if (isLeaderSelfRow && opts.currentUserId) {
    if (hasSubItems) {
      for (const sub of assignment.subItems ?? []) {
        if (isSubItemResultComplete(sub)) continue
        if (!isManagerEvalComplete(sub.selfEvalStatus ?? '')) {
          highlight.selfEval = true
        } else {
          highlight.numeric = true
        }
      }
    } else {
      if (!numericRaw.trim()) highlight.numeric = true
      if (!(normalized?.numericUnit ?? assignment.numericUnit ?? '').trim()) {
        highlight.numericUnit = true
      }
      if (!isManagerEvalComplete(selfEval)) highlight.selfEval = true
    }
    if (!evidence) highlight.evidence = true
  } else if (opts.canEditResults && !isLeaderSelfRow) {
    if (!isManagerEvalComplete(managerStatus)) highlight.leaderEval = true
  }

  return highlight
}

function hasValidationHighlight(h: RowSubmitValidationHighlight): boolean {
  return Boolean(h.numeric || h.numericUnit || h.evidence || h.selfEval || h.leaderEval)
}

function draftToPatchBody(draft: MemberSelfEditDraft, opts?: { leaderEvalOnly?: boolean }) {
  if (opts?.leaderEvalOnly) {
    return {
      managerEvalStatus: draft.managerEvalStatus?.trim() ? draft.managerEvalStatus.trim() : null,
      managerReviewNote: draft.managerReviewNote?.trim() ? draft.managerReviewNote.trim() : null,
    }
  }
  const nTrim = draft.numericRaw.trim()
  let numericValue: number | null = null
  if (nTrim.length > 0) {
    const n = Number(nTrim.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(n)) return 'invalid' as const
    numericValue = n
  }
  return {
    evidence: draft.evidence.trim() ? draft.evidence.trim() : null,
    numericValue,
    numericUnit: draft.numericUnit.trim() ? draft.numericUnit.trim().toUpperCase() : null,
    selfEvalStatus: draft.selfEvalStatus.trim() ? draft.selfEvalStatus.trim() : null,
    selfReviewNote: draft.selfReviewNote.trim() ? draft.selfReviewNote.trim() : null,
    managerEvalStatus: draft.managerEvalStatus?.trim() ? draft.managerEvalStatus.trim() : null,
    managerReviewNote: draft.managerReviewNote?.trim() ? draft.managerReviewNote.trim() : null,
  }
}

function useLeaderMemberEvalDraft(
  row: PerformanceAssignment,
  opts?: {
    hideRowSave?: boolean
    disabled?: boolean
    pendingDraft?: MemberSelfEditDraft
    onDraftChange?: (draft: MemberSelfEditDraft) => void
  }
) {
  const onDraftChangeRef = useRef(opts?.onDraftChange)
  onDraftChangeRef.current = opts?.onDraftChange

  const [managerEvalStatus, setManagerEvalStatusState] = useState(() =>
    opts?.pendingDraft ? (opts.pendingDraft.managerEvalStatus ?? '') : (row.managerEvalStatus ?? '')
  )
  const [managerReviewNote, setManagerReviewNoteState] = useState(() =>
    opts?.pendingDraft ? (opts.pendingDraft.managerReviewNote ?? '') : (row.managerReviewNote ?? '')
  )

  const valuesRef = useRef({ managerEvalStatus, managerReviewNote })
  valuesRef.current = { managerEvalStatus, managerReviewNote }

  const pushDraft = useCallback(() => {
    if (!opts?.hideRowSave || !onDraftChangeRef.current) return
    const { managerEvalStatus: s, managerReviewNote: n } = valuesRef.current
    const unchanged = (row.managerEvalStatus ?? '') === s && (row.managerReviewNote ?? '') === n
    if (unchanged) return
    onDraftChangeRef.current(
      rowToMemberDraftSnapshot(row, { managerEvalStatus: s, managerReviewNote: n })
    )
  }, [row, opts?.hideRowSave])

  useEffect(() => {
    if (opts?.pendingDraft) {
      setManagerEvalStatusState(opts.pendingDraft.managerEvalStatus ?? '')
      setManagerReviewNoteState(opts.pendingDraft.managerReviewNote ?? '')
      return
    }
    setManagerEvalStatusState(row.managerEvalStatus ?? '')
    setManagerReviewNoteState(row.managerReviewNote ?? '')
  }, [row.id, opts?.pendingDraft, row.managerEvalStatus, row.managerReviewNote])

  useEffect(() => {
    return () => {
      if (!opts?.hideRowSave || !onDraftChangeRef.current) return
      const { managerEvalStatus: s, managerReviewNote: n } = valuesRef.current
      const unchanged = (row.managerEvalStatus ?? '') === s && (row.managerReviewNote ?? '') === n
      if (unchanged) return
      onDraftChangeRef.current(
        rowToMemberDraftSnapshot(row, { managerEvalStatus: s, managerReviewNote: n })
      )
    }
  }, [row.id, row.managerEvalStatus, row.managerReviewNote, opts?.hideRowSave])

  const setManagerEvalStatus = useCallback(
    (v: string) => {
      setManagerEvalStatusState(v)
      valuesRef.current.managerEvalStatus = v
      pushDraft()
    },
    [pushDraft]
  )

  const setManagerReviewNote = useCallback(
    (v: string) => {
      setManagerReviewNoteState(v)
      valuesRef.current.managerReviewNote = v
      pushDraft()
    },
    [pushDraft]
  )

  return {
    managerEvalStatus,
    setManagerEvalStatus,
    managerReviewNote,
    setManagerReviewNote,
    inputsDisabled: opts?.disabled ?? false,
  }
}

function useMemberSelfAssignmentEdit(
  row: PerformanceAssignment,
  onSaved: () => void,
  opts?: {
    hideRowSave?: boolean
    disabled?: boolean
    pendingDraft?: MemberSelfEditDraft
    onDraftChange?: (draft: MemberSelfEditDraft) => void
    canEditLeaderEval?: boolean
  }
) {
  const disabled = opts?.disabled ?? false
  const [evidence, setEvidence] = useState(() =>
    opts?.pendingDraft ? opts.pendingDraft.evidence : (row.evidence ?? '')
  )
  const [numericRaw, setNumericRaw] = useState(() =>
    opts?.pendingDraft
      ? opts.pendingDraft.numericRaw
      : row.numericValue != null
        ? String(row.numericValue)
        : ''
  )
  const [numericUnit, setNumericUnit] = useState(() =>
    opts?.pendingDraft ? opts.pendingDraft.numericUnit : (row.numericUnit ?? '')
  )
  const [selfEvalStatus, setSelfEvalStatus] = useState(() =>
    opts?.pendingDraft ? opts.pendingDraft.selfEvalStatus : (row.selfEvalStatus ?? '')
  )
  const [selfReviewNote, setSelfReviewNote] = useState(() =>
    opts?.pendingDraft ? opts.pendingDraft.selfReviewNote : (row.selfReviewNote ?? '')
  )
  const [managerEvalStatus, setManagerEvalStatus] = useState(() => {
    if (opts?.pendingDraft) {
      return opts.pendingDraft.managerEvalStatus ?? ''
    }
    if (opts?.canEditLeaderEval) {
      return row.selfEvalStatus ?? row.managerEvalStatus ?? ''
    }
    return row.managerEvalStatus ?? ''
  })
  const [managerReviewNote, setManagerReviewNote] = useState(() =>
    opts?.pendingDraft ? (opts.pendingDraft.managerReviewNote ?? '') : (row.managerReviewNote ?? '')
  )
  const [saving, setSaving] = useState(false)
  const [numericFocused, setNumericFocused] = useState(false)
  const onDraftChangeRef = useRef(opts?.onDraftChange)
  onDraftChangeRef.current = opts?.onDraftChange

  const valuesRef = useRef({
    evidence,
    numericRaw,
    numericUnit,
    selfEvalStatus,
    selfReviewNote,
    managerEvalStatus,
    managerReviewNote,
  })
  valuesRef.current = {
    evidence,
    numericRaw,
    numericUnit,
    selfEvalStatus,
    selfReviewNote,
    managerEvalStatus,
    managerReviewNote,
  }

  const leaderSelfSync = Boolean(opts?.canEditLeaderEval)

  const pushDraft = useCallback(() => {
    if (!opts?.hideRowSave || !onDraftChangeRef.current) return
    const v = valuesRef.current
    const draft = normalizeDraftForLeaderSelf(
      {
        evidence: v.evidence,
        numericRaw: v.numericRaw,
        numericUnit: v.numericUnit,
        selfEvalStatus: v.selfEvalStatus,
        selfReviewNote: v.selfReviewNote,
        managerEvalStatus: v.managerEvalStatus,
        managerReviewNote: v.managerReviewNote,
      },
      leaderSelfSync
    )
    if (memberSelfDraftsEqual(rowToMemberDraftSnapshot(row, {}, { leaderSelfSync }), draft)) {
      return
    }
    onDraftChangeRef.current(draft)
  }, [row, opts?.hideRowSave, leaderSelfSync])

  useEffect(() => {
    if (opts?.pendingDraft) {
      const d = opts.pendingDraft
      setEvidence(d.evidence)
      setNumericRaw(d.numericRaw)
      setNumericUnit(d.numericUnit)
      setSelfEvalStatus(d.selfEvalStatus)
      setSelfReviewNote(d.selfReviewNote)
      setManagerEvalStatus(
        leaderSelfSync ? d.selfEvalStatus || d.managerEvalStatus || '' : (d.managerEvalStatus ?? '')
      )
      setManagerReviewNote(d.managerReviewNote ?? '')
      return
    }
    setEvidence(row.evidence ?? '')
    setNumericRaw(row.numericValue != null ? String(row.numericValue) : '')
    setNumericUnit(row.numericUnit ?? '')
    setSelfEvalStatus(row.selfEvalStatus ?? '')
    setSelfReviewNote(row.selfReviewNote ?? '')
    setManagerEvalStatus(
      leaderSelfSync
        ? (row.selfEvalStatus ?? row.managerEvalStatus ?? '')
        : (row.managerEvalStatus ?? '')
    )
    setManagerReviewNote(row.managerReviewNote ?? '')
  }, [
    row.id,
    opts?.pendingDraft,
    leaderSelfSync,
    row.evidence,
    row.numericValue,
    row.numericUnit,
    row.selfEvalStatus,
    row.selfReviewNote,
    row.managerEvalStatus,
    row.managerReviewNote,
  ])

  useEffect(() => {
    return () => {
      pushDraft()
    }
  }, [row.id, pushDraft])

  const setEvidenceAndDraft = useCallback(
    (v: string) => {
      setEvidence(v)
      valuesRef.current.evidence = v
      pushDraft()
    },
    [pushDraft]
  )
  const setNumericRawAndDraft = useCallback(
    (v: string) => {
      setNumericRaw(v)
      valuesRef.current.numericRaw = v
      pushDraft()
    },
    [pushDraft]
  )
  const setNumericUnitAndDraft = useCallback(
    (v: string) => {
      setNumericUnit(v)
      valuesRef.current.numericUnit = v
      pushDraft()
    },
    [pushDraft]
  )
  const setSelfEvalStatusAndDraft = useCallback(
    (v: string) => {
      setSelfEvalStatus(v)
      valuesRef.current.selfEvalStatus = v
      if (leaderSelfSync) {
        setManagerEvalStatus(v)
        valuesRef.current.managerEvalStatus = v
      }
      pushDraft()
    },
    [pushDraft, leaderSelfSync]
  )
  const setSelfReviewNoteAndDraft = useCallback(
    (v: string) => {
      setSelfReviewNote(v)
      valuesRef.current.selfReviewNote = v
      pushDraft()
    },
    [pushDraft]
  )

  /** Giá trị hiển thị: khi focus → raw digits, khi blur → định dạng dấu chấm ngàn */
  const numericDisplayValue = numericFocused
    ? numericRaw
    : formatViNumber(numericRaw) === '—'
      ? ''
      : formatViNumber(numericRaw)

  const handleNumericChange = (val: string) => {
    // Bỏ dấu chấm ngàn, chấp nhận digit và một dấu thập phân
    const stripped = val.replace(/\./g, '').replace(',', '.')
    setNumericRawAndDraft(stripped)
  }

  const save = async () => {
    const nTrim = numericRaw.trim()
    let numericValue: number | null = null
    if (nTrim.length > 0) {
      // Strip dấu chấm ngàn trước khi parse
      const n = Number(nTrim.replace(/\./g, '').replace(',', '.'))
      if (!Number.isFinite(n)) {
        toast.error('Số liệu không hợp lệ.')
        return
      }
      numericValue = n
    }
    if (isMandatoryMetric(row.content) && numericValue === null) {
      toast.error(`"${row.content}" là chỉ số bắt buộc — vui lòng nhập Số liệu trước khi lưu.`)
      return
    }
    if (row.status === 'done' && !evidence.trim()) {
      toast.warning('Trạng thái Hoàn thành nhưng Evidence đang trống.')
    }
    setSaving(true)
    try {
      const payload = {
        evidence: evidence.trim() ? evidence.trim() : null,
        numericValue,
        numericUnit: numericUnit.trim() ? numericUnit.trim().toUpperCase() : null,
        selfEvalStatus: selfEvalStatus.trim() ? selfEvalStatus.trim() : null,
        selfReviewNote: selfReviewNote.trim() ? selfReviewNote.trim() : null,
        managerEvalStatus: managerEvalStatus.trim() ? managerEvalStatus.trim() : null,
        managerReviewNote: managerReviewNote.trim() ? managerReviewNote.trim() : null,
      }
      if (opts?.canEditLeaderEval) {
        await performanceApi.patchAssignment(row.id, payload)
      } else {
        await performanceApi.patchAssignmentSelf(row.id, payload)
      }
      toast.success('Đã lưu.')
      onSaved()
    } catch {
      toast.error('Không lưu được. Kiểm tra quyền hoặc thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return {
    evidence,
    setEvidence: setEvidenceAndDraft,
    numericRaw,
    numericDisplayValue,
    handleNumericChange,
    numericFocused,
    setNumericFocused,
    numericUnit,
    setNumericUnit: setNumericUnitAndDraft,
    selfEvalStatus,
    setSelfEvalStatus: setSelfEvalStatusAndDraft,
    selfReviewNote,
    setSelfReviewNote: setSelfReviewNoteAndDraft,
    managerEvalStatus,
    setManagerEvalStatus,
    managerReviewNote,
    setManagerReviewNote,
    saving,
    save,
    disabled,
    hideRowSave: opts?.hideRowSave ?? false,
  }
}

function MemberSelfAssignmentRow({
  row,
  rowStripe,
  onSaved,
  hideRowSave,
  disabled,
  onDraftChange,
  canEditLeaderEval,
  pendingDraft,
  submitValidation,
  hideManagerEvalColumn,
}: {
  row: PerformanceAssignment
  rowStripe: boolean
  onSaved: () => void
  hideRowSave?: boolean
  disabled?: boolean
  onDraftChange?: (draft: MemberSelfEditDraft) => void
  canEditLeaderEval?: boolean
  pendingDraft?: MemberSelfEditDraft
  submitValidation?: RowSubmitValidationHighlight
  hideManagerEvalColumn?: boolean
}) {
  const isMandatory = isMandatoryMetric(row.content)
  const hasSubItems = (row.subItems?.length ?? 0) > 0
  const {
    evidence,
    setEvidence,
    numericDisplayValue,
    handleNumericChange,
    numericFocused,
    setNumericFocused,
    numericRaw,
    numericUnit,
    setNumericUnit,
    selfEvalStatus,
    setSelfEvalStatus,
    selfReviewNote,
    setSelfReviewNote,
    managerEvalStatus,
    setManagerEvalStatus,
    saving,
    save,
    hideRowSave: hideSave,
    disabled: inputsDisabled,
  } = useMemberSelfAssignmentEdit(row, onSaved, {
    hideRowSave,
    disabled,
    pendingDraft,
    onDraftChange,
    canEditLeaderEval,
  })

  const parentDisplay = resolveParentKpiDisplay(row)
  const showParentAggregates = hasSubItems && inputsDisabled
  const td = xlTd(rowStripe)

  return (
    <TableRow className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500 font-medium')}>
        {periodLabel(row)}
      </TableCell>
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500')}>
        {formatKpiSetAt(row.kpiSetAt)}
      </TableCell>
      <TableCell className={td}>
        <KindBadge kind={row.kind} />
      </TableCell>
      <TableCell className={td}>
        <PriorityBadge priority={row.priority} />
      </TableCell>
      <TableCell className={cn(td, 'min-w-[195px] max-w-[285px]')}>
        <ContentCell
          content={row.content}
          badge={
            row.category === 'VINH_DANH' ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                🏆 Vinh danh
              </span>
            ) : undefined
          }
        />
        {hasSubItems ? (
          <SubItemsSelfEditInline
            assignmentId={row.id}
            subItems={row.subItems ?? []}
            disabled={inputsDisabled || saving}
            onSaved={onSaved}
            submitValidation={
              submitValidation
                ? { numeric: submitValidation.numeric, selfEval: submitValidation.selfEval }
                : undefined
            }
          />
        ) : null}
      </TableCell>
      <TableCell className={cn(td, 'tabular-nums font-semibold text-primary')}>
        {row.targetMetric?.trim() ? formatViNumber(row.targetMetric) : parentDisplay.targetMetric}
      </TableCell>
      <TableCell className={cn(td, CELL_NUMERIC)}>
        {hasSubItems && !showParentAggregates ? (
          <span
            className={cn(
              'text-xs italic',
              submitValidation?.selfEval || submitValidation?.numeric
                ? 'font-medium text-red-600 dark:text-red-400'
                : 'text-slate-400'
            )}
            title="Nhập số liệu tại từng mục con"
          >
            {submitValidation?.selfEval || submitValidation?.numeric
              ? 'Hoàn thiện mục con ↓'
              : 'Xem mục con ↑'}
          </span>
        ) : hasSubItems && showParentAggregates ? (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm tabular-nums font-semibold">{parentDisplay.numericLabel}</span>
            {parentDisplay.progress != null ? (
              <KpiProgressBar value={parentDisplay.progress} barClassName="h-1.5" />
            ) : null}
          </div>
        ) : (
          <div className="relative min-w-0">
            <Input
              value={numericDisplayValue}
              onChange={(e) => handleNumericChange(e.target.value)}
              onFocus={() => setNumericFocused(true)}
              onBlur={() => setNumericFocused(false)}
              inputMode="numeric"
              className={cn(
                XL_INPUT,
                (submitValidation?.numeric || (isMandatory && !numericRaw.trim())) &&
                  INVALID_FIELD_RING
              )}
              placeholder={isMandatory ? 'Bắt buộc nhập' : '—'}
              aria-required={isMandatory}
              disabled={inputsDisabled || saving}
            />
            {isMandatory && (
              <span
                className="pointer-events-none absolute -right-1 -top-1 text-xs font-bold text-destructive"
                title="Chỉ số bắt buộc nhập"
              >
                *
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className={cn(td, CELL_UNIT)}>
        {hasSubItems && !showParentAggregates ? (
          <span className="text-xs text-slate-400">—</span>
        ) : hasSubItems && showParentAggregates ? (
          <span className="text-xs uppercase">{parentDisplay.numericUnit}</span>
        ) : (
          <Input
            value={numericUnit}
            onChange={(e) => setNumericUnit(e.target.value)}
            className={cn(XL_INPUT, submitValidation?.numericUnit && INVALID_FIELD_RING)}
            placeholder="VND"
            disabled={inputsDisabled || saving}
          />
        )}
      </TableCell>
      <TableCell className={cn(td, CELL_EVIDENCE)}>
        <div className="min-w-0 max-w-full">
          <KpiEvidenceInput
            value={evidence}
            onChange={setEvidence}
            disabled={inputsDisabled || saving}
            compact
            textareaClassName={cn(
              TABLE_EVIDENCE_TEXTAREA,
              submitValidation?.evidence && INVALID_FIELD_RING
            )}
          />
        </div>
      </TableCell>
      <TableCell className={cn(td, CELL_SELF_EVAL)}>
        {hasSubItems ? (
          <span
            className={cn(
              'text-xs italic',
              submitValidation?.selfEval
                ? 'font-medium text-red-600 dark:text-red-400'
                : 'text-slate-400'
            )}
          >
            {submitValidation?.selfEval ? 'Chọn OK/NOT tại mục con ↓' : 'Đánh giá tại mục con'}
          </span>
        ) : (
          <div className="min-w-0 max-w-full space-y-1">
            <CustomSelect
              value={selfEvalStatus || '__none'}
              onValueChange={(v) => {
                const next = v === '__none' ? '' : v
                setSelfEvalStatus(next)
                // Phương án 2: Leader tự chấm dòng của mình → đồng bộ luôn sang Đánh giá Leader
                if (canEditLeaderEval) setManagerEvalStatus(next)
              }}
              disabled={inputsDisabled || saving}
              className="!space-y-0 min-w-0 w-full"
              triggerClassName={cn(
                TABLE_INLINE_SELECT_TRIGGER,
                submitValidation?.selfEval && INVALID_FIELD_RING
              )}
              options={[
                { label: '—', value: '__none' },
                { label: 'OK', value: 'OK' },
                { label: 'NOT', value: 'NOT' },
              ]}
            />
            <textarea
              value={selfReviewNote}
              onChange={(e) => setSelfReviewNote(e.target.value)}
              rows={2}
              className={TABLE_TEXTAREA}
              placeholder="Nhận xét"
              disabled={inputsDisabled || saving}
            />
          </div>
        )}
      </TableCell>
      <TableCell className={cn(td, EVAL_LEADER_CELL)}>
        {canEditLeaderEval ? (
          // Dòng của chính Leader: ẩn ô chỉnh sửa, chỉ hiển thị (đồng bộ tự động từ Tự đánh giá)
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <EvalStatusBadge status={managerEvalStatus || null} type="leader" />
            <span className="text-[10px] italic text-slate-400">Tự đồng bộ từ Tự đánh giá</span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <EvalStatusBadge status={row.managerEvalStatus} type="leader" />
            {row.managerReviewNote && (
              <div
                className="text-xs text-slate-500 italic max-w-[140px] truncate"
                title={row.managerReviewNote}
              >
                {row.managerReviewNote}
              </div>
            )}
          </div>
        )}
      </TableCell>
      {!hideManagerEvalColumn ? (
        <TableCell className={cn(td, EVAL_MANAGER_CELL)}>
          <EvalStatusBadge status={row.finalEvalStatus} type="manager" />
        </TableCell>
      ) : null}
      {!hideSave ? (
        <TableCell
          className={cn(
            td,
            'sticky right-0 z-10 whitespace-nowrap bg-white text-right shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.12)] dark:bg-slate-950'
          )}
        >
          {!isMockApiEnabled() ? (
            <Button
              type="button"
              size="sm"
              className="rounded-lg font-semibold"
              disabled={saving || inputsDisabled}
              onClick={() => void save()}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function GoalReviewPlanningCell({
  row,
  allowConfirm,
  onConfirmed,
}: {
  row: PerformanceAssignment
  allowConfirm?: boolean
  onConfirmed?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const review = row.goalReview
  const canConfirm =
    Boolean(allowConfirm) &&
    !isMockApiEnabled() &&
    (review?.status === 'edit_pending_member' ||
      review?.status === 'manager_created_pending_member') &&
    Boolean(review.requestId)

  const handleConfirm = useCallback(async () => {
    if (!review?.requestId) return
    setConfirming(true)
    try {
      await performanceApi.confirmGoalReview(review.requestId, row.id)
      toast.success('Đã xác nhận và áp dụng nội dung KPI/OKR Manager sửa.')
      onConfirmed?.()
    } catch (err: unknown) {
      toast.error('Xác nhận thất bại: ' + getApiErrorMessage(err))
    } finally {
      setConfirming(false)
    }
  }, [onConfirmed, review?.requestId, row.id])

  return (
    <>
      <GoalReviewStatusBadge review={review} />
      <GoalReviewSummary review={review} />
      {canConfirm ? (
        <Button
          type="button"
          size="sm"
          className="mt-1 h-8 w-fit rounded-lg px-3 text-xs font-semibold"
          disabled={confirming}
          onClick={() => void handleConfirm()}
        >
          {confirming ? 'Đang xác nhận...' : 'Xác nhận'}
        </Button>
      ) : null}
    </>
  )
}

function ReadOnlyAssignmentRow({
  row,
  rowStripe,
  mode = 'results',
  hideManagerEvalColumn,
  showTrailingActionCell,
  allowGoalReviewConfirm,
  onGoalReviewConfirmed,
}: {
  row: PerformanceAssignment
  rowStripe: boolean
  mode?: 'planning' | 'results'
  hideManagerEvalColumn?: boolean
  showTrailingActionCell?: boolean
  allowGoalReviewConfirm?: boolean
  onGoalReviewConfirmed?: () => void
}) {
  const [subItemsExpanded, setSubItemsExpanded] = useState(false)
  const parentDisplay = resolveParentKpiDisplay(row)
  const td = xlTd(rowStripe)
  return (
    <TableRow className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500 font-medium')}>
        {periodLabel(row)}
      </TableCell>
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500')}>
        {formatKpiSetAt(row.kpiSetAt)}
      </TableCell>
      <TableCell className={td}>
        <KindBadge kind={row.kind} />
      </TableCell>
      <TableCell className={td}>
        <PriorityBadge priority={row.priority} />
      </TableCell>
      <TableCell className={cn(td, 'min-w-[195px] max-w-[285px]')}>
        <ContentCell
          content={row.content}
          badge={
            row.category === 'VINH_DANH' ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                🏆 Vinh danh
              </span>
            ) : undefined
          }
        />
        {(row.subItems?.length ?? 0) > 0 ? (
          <AssignmentSubItemsInline
            subItems={row.subItems ?? []}
            expanded={subItemsExpanded}
            onToggle={() => setSubItemsExpanded((v) => !v)}
            showProgress={mode === 'results'}
          />
        ) : null}
      </TableCell>
      <TableCell className={cn(td, 'tabular-nums font-semibold text-primary')}>
        {row.targetMetric?.trim() ? formatViNumber(row.targetMetric) : parentDisplay.targetMetric}
      </TableCell>
      {mode === 'planning' ? (
        <>
          <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-sm')}>
            {parentDisplay.hasSubItems ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span>{parentDisplay.numericLabel}</span>
                {parentDisplay.progress != null ? (
                  <KpiProgressBar value={parentDisplay.progress} barClassName="h-1.5" />
                ) : null}
              </div>
            ) : (
              formatViNumber(row.numericValue)
            )}
          </TableCell>
          <TableCell className={cn(td, 'text-xs uppercase')}>
            <div className="w-[64px] truncate">{parentDisplay.numericUnit}</div>
          </TableCell>
        </>
      ) : (
        <AssignmentEpic4ReadCells row={row} td={td} />
      )}
      <TableCell className={cn(td, EVAL_LEADER_CELL)}>
        <div className="flex min-w-0 flex-col gap-1">
          {mode === 'planning' ? (
            <GoalReviewPlanningCell
              row={row}
              allowConfirm={allowGoalReviewConfirm}
              onConfirmed={onGoalReviewConfirmed}
            />
          ) : (
            <>
              <EvalStatusBadge status={row.managerEvalStatus} type="leader" />
              {row.managerReviewNote && (
                <div
                  className="text-xs text-slate-500 italic max-w-[140px] truncate"
                  title={row.managerReviewNote}
                >
                  {row.managerReviewNote}
                </div>
              )}
            </>
          )}
        </div>
      </TableCell>
      {mode !== 'planning' && !hideManagerEvalColumn ? (
        <TableCell className={cn(td, EVAL_MANAGER_CELL)}>
          <EvalStatusBadge status={row.finalEvalStatus} type="manager" />
        </TableCell>
      ) : null}
      {showTrailingActionCell ? (
        <TableCell
          className={cn(
            td,
            'sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.12)] dark:bg-slate-950'
          )}
        />
      ) : null}
    </TableRow>
  )
}

function ReadOnlyAssignmentMobileCard({
  row,
  rowStripe,
  mode = 'results',
  allowGoalReviewConfirm,
  onGoalReviewConfirmed,
}: {
  row: PerformanceAssignment
  rowStripe: boolean
  mode?: 'planning' | 'results'
  allowGoalReviewConfirm?: boolean
  onGoalReviewConfirmed?: () => void
}) {
  return (
    <div className={cn('space-y-3 p-4', rowStripe ? 'bg-slate-50/30 dark:bg-slate-900/20' : '')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-slate-500">{periodLabel(row)}</span>
        <span className="text-xs tabular-nums text-slate-500">{formatKpiSetAt(row.kpiSetAt)}</span>
        <KindBadge kind={row.kind} />
        <PriorityBadge priority={row.priority} />
      </div>
      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {row.content}
        {row.category === 'VINH_DANH' && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            🏆 Vinh danh
          </span>
        )}
      </p>
      <p className="text-sm font-semibold tabular-nums text-primary">
        Chỉ tiêu: {row.targetMetric || '—'}
      </p>
      {mode === 'planning' ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="font-semibold text-muted-foreground">Số liệu: </span>
            {formatViNumber(row.numericValue)}
          </span>
          <span className="text-xs uppercase text-muted-foreground">
            Đơn vị: {row.numericUnit ?? '—'}
          </span>
        </div>
      ) : (
        <AssignmentEpic4ReadStack row={row} />
      )}
      <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs font-bold uppercase text-muted-foreground">Quản lý xét duyệt</span>
        {mode === 'planning' ? (
          <GoalReviewPlanningCell
            row={row}
            allowConfirm={allowGoalReviewConfirm}
            onConfirmed={onGoalReviewConfirmed}
          />
        ) : (
          <>
            <EvalStatusBadge status={row.managerEvalStatus} type="leader" />
            {row.managerReviewNote ? (
              <p className="break-words text-xs italic text-slate-500">{row.managerReviewNote}</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

function MemberSelfAssignmentMobileCard({
  row,
  rowStripe,
  onSaved,
  hideRowSave,
  disabled,
  onDraftChange,
  pendingDraft,
}: {
  row: PerformanceAssignment
  rowStripe: boolean
  onSaved: () => void
  hideRowSave?: boolean
  disabled?: boolean
  onDraftChange?: (draft: MemberSelfEditDraft) => void
  pendingDraft?: MemberSelfEditDraft
}) {
  const isMandatory = isMandatoryMetric(row.content)
  const {
    evidence,
    setEvidence,
    numericRaw,
    numericDisplayValue,
    handleNumericChange,
    numericFocused,
    setNumericFocused,
    numericUnit,
    setNumericUnit,
    selfEvalStatus,
    setSelfEvalStatus,
    selfReviewNote,
    setSelfReviewNote,
    saving,
    save,
    hideRowSave: hideSave,
    disabled: inputsDisabled,
  } = useMemberSelfAssignmentEdit(row, onSaved, {
    hideRowSave,
    disabled,
    pendingDraft,
    onDraftChange,
  })

  return (
    <div className={cn('space-y-3 p-4', rowStripe ? 'bg-slate-50/30 dark:bg-slate-900/20' : '')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-slate-500">{periodLabel(row)}</span>
        <span className="text-xs tabular-nums text-slate-500">{formatKpiSetAt(row.kpiSetAt)}</span>
        <KindBadge kind={row.kind} />
        <PriorityBadge priority={row.priority} />
        {isMandatory && (
          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">
            Bắt buộc nhập
          </span>
        )}
      </div>
      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {row.content}
        {row.category === 'VINH_DANH' && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            🏆 Vinh danh
          </span>
        )}
      </p>
      <p className="text-sm font-semibold tabular-nums text-primary">
        Chỉ tiêu: {formatViNumber(row.targetMetric) || '—'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <span
            className={cn(
              'text-xs font-bold uppercase',
              isMandatory ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            Số liệu{isMandatory && <span className="ml-0.5">*</span>}
          </span>
          <Input
            value={numericDisplayValue}
            onChange={(e) => handleNumericChange(e.target.value)}
            onFocus={() => setNumericFocused(true)}
            onBlur={() => setNumericFocused(false)}
            inputMode="numeric"
            className={cn(XL_INPUT, isMandatory && !numericRaw.trim() && INVALID_FIELD_RING)}
            placeholder={isMandatory ? 'Bắt buộc nhập' : '—'}
            aria-required={isMandatory}
            disabled={inputsDisabled || saving}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase text-muted-foreground">Đơn vị</span>
          <Input
            value={numericUnit}
            onChange={(e) => setNumericUnit(e.target.value)}
            className={XL_INPUT}
            placeholder="VND"
            disabled={inputsDisabled || saving}
          />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-xs font-bold uppercase text-muted-foreground">Minh chứng</span>
        <KpiEvidenceInput
          value={evidence}
          onChange={setEvidence}
          disabled={inputsDisabled || saving}
        />
      </div>
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase text-muted-foreground">Tự đánh giá</span>
        <CustomSelect
          value={selfEvalStatus || '__none'}
          onValueChange={(v) => setSelfEvalStatus(v === '__none' ? '' : v)}
          disabled={inputsDisabled || saving}
          options={[
            { label: '—', value: '__none' },
            { label: 'OK', value: 'OK' },
            { label: 'NOT', value: 'NOT' },
          ]}
        />
        <textarea
          value={selfReviewNote}
          onChange={(e) => setSelfReviewNote(e.target.value)}
          rows={2}
          className={cn(XL_TEXTAREA, 'mt-1 min-h-[52px] max-w-none')}
          placeholder="Nhận xét"
          disabled={inputsDisabled || saving}
        />
      </div>
      <div className="flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs font-bold uppercase text-muted-foreground">Quản lý xét duyệt</span>
        <EvalStatusBadge status={row.managerEvalStatus} type="leader" />
        {row.managerReviewNote ? (
          <p className="break-words text-xs italic text-slate-500">{row.managerReviewNote}</p>
        ) : null}
      </div>
      {!hideSave && !isMockApiEnabled() ? (
        <Button
          type="button"
          size="sm"
          className="h-10 w-full rounded-lg font-semibold"
          disabled={saving || inputsDisabled}
          onClick={() => void save()}
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
      ) : null}
    </div>
  )
}

type LeaderEditFormValues = {
  priority: number
  content: string
  targetMetric: string
  subItems: SubItemDraft[]
}

function LeaderAssignmentRow({
  row,
  mode,
  onSaved,
  rowStripe,
  canEditTeam,
  isMandatory = false,
  isCascade = false,
  hideRowSave,
  onDraftChange,
  disabled,
  pendingDraft,
  hideManagerEvalColumn,
  submitValidation,
}: {
  row: PerformanceAssignment
  mode: 'planning' | 'results'
  onSaved: () => void
  rowStripe: boolean
  canEditTeam: boolean
  isMandatory?: boolean
  /** Manager cascade mode: edit/delete áp dụng cho toàn team. */
  isCascade?: boolean
  hideRowSave?: boolean
  onDraftChange?: (draft: MemberSelfEditDraft) => void
  disabled?: boolean
  pendingDraft?: MemberSelfEditDraft
  hideManagerEvalColumn?: boolean
  submitValidation?: RowSubmitValidationHighlight
}) {
  const [open, setOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [subItemsExpanded, setSubItemsExpanded] = useState(false)
  const parentDisplay = resolveParentKpiDisplay(row)

  const form = useForm<LeaderEditFormValues>({
    defaultValues: {
      priority: row.priority,
      content: row.content,
      targetMetric: row.targetMetric ?? '',
      subItems: subItemsFromAssignment(row.subItems),
    },
    mode: 'onChange',
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form

  useEffect(() => {
    if (!open) return
    reset({
      priority: row.priority,
      content: row.content,
      targetMetric: row.targetMetric ?? '',
      subItems: subItemsFromAssignment(row.subItems),
    })
  }, [open, reset, row])

  const td = xlTd(rowStripe)
  const editable = canEditTeam && !isMockApiEnabled()
  const canDelete = editable && !isMandatory
  const canEditLeaderInline = mode === 'results' && editable && Boolean(hideRowSave) && !disabled

  const leaderEvalDraft = useLeaderMemberEvalDraft(row, {
    hideRowSave: canEditLeaderInline,
    disabled,
    pendingDraft,
    onDraftChange: canEditLeaderInline ? onDraftChange : undefined,
  })

  const onSubmit = handleSubmit(async (values) => {
    if (!values.content.trim()) {
      toast.error('Nội dung không được trống.')
      return
    }
    if (values.content.trim().length > 500) {
      toast.error('Nội dung tối đa 500 ký tự.')
      return
    }
    if (values.priority < 0 || values.priority > 99) {
      toast.error('Ưu tiên không hợp lệ.')
      return
    }

    const patch = {
      content: values.content.trim(),
      priority: values.priority,
      targetMetric: values.targetMetric.trim() || null,
      subItems: mapSubItemsToPayload(values.subItems),
    }

    try {
      if (isCascade && mode === 'planning') {
        // Manager cascade: update all assignments in team with same content
        await performanceApi.cascadeUpdateByContent(row.teamId, {
          year: row.year,
          month: row.month,
          oldContent: row.content,
          newContent: (patch as { content?: string }).content ?? row.content,
          targetMetric: (patch as { targetMetric?: string | null }).targetMetric,
          priority: (patch as { priority?: number }).priority,
        })
      } else {
        await performanceApi.patchAssignment(row.id, patch)
      }
      toast.success(
        isCascade && mode === 'planning' ? 'Đã cập nhật cho toàn team.' : 'Đã cập nhật.'
      )
      setOpen(false)
      onSaved()
    } catch {
      toast.error('Cập nhật thất bại, vui lòng thử lại.')
    }
  })

  const handleDeleteAssignment = async () => {
    setDeleting(true)
    try {
      if (isCascade) {
        await performanceApi.cascadeDeleteByContent(row.teamId, {
          year: row.year,
          month: row.month,
          content: row.content,
        })
        toast.success('Đã xóa chỉ số cho toàn team.')
      } else {
        await performanceApi.deleteAssignment(row.id)
        toast.success('Đã xóa mục tiêu.')
      }
      setDeleteConfirmOpen(false)
      setOpen(false)
      onSaved()
    } catch {
      toast.error('Không xóa được. Kiểm tra quyền hoặc thử lại.')
    } finally {
      setDeleting(false)
    }
  }

  const showActionColumn = mode === 'planning' && editable

  return (
    <TableRow
      className={cn(
        'group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40',
        mode === 'results' &&
          'bg-amber-50/10 hover:bg-amber-50/20 dark:bg-amber-900/5 dark:hover:bg-amber-900/10'
      )}
    >
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500 font-medium')}>
        {periodLabel(row)}
      </TableCell>
      <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-slate-500')}>
        {formatKpiSetAt(row.kpiSetAt)}
      </TableCell>
      <TableCell className={td}>
        <KindBadge kind={row.kind} />
      </TableCell>
      <TableCell className={td}>
        <PriorityBadge priority={row.priority} />
      </TableCell>
      <TableCell className={cn(td, 'min-w-[195px] max-w-[285px]')}>
        <ContentCell
          content={row.content}
          badge={
            row.category === 'VINH_DANH' ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                🏆 Vinh danh
              </span>
            ) : undefined
          }
        />
        {(row.subItems?.length ?? 0) > 0 && (
          <AssignmentSubItemsInline
            subItems={row.subItems ?? []}
            expanded={subItemsExpanded}
            onToggle={() => setSubItemsExpanded((v) => !v)}
            showProgress={mode === 'results'}
          />
        )}
      </TableCell>
      <TableCell className={cn(td, 'tabular-nums font-semibold text-primary')}>
        {row.targetMetric?.trim() ? formatViNumber(row.targetMetric) : parentDisplay.targetMetric}
      </TableCell>
      {mode === 'planning' ? (
        <>
          <TableCell className={cn(td, 'whitespace-nowrap tabular-nums text-sm')}>
            {parentDisplay.hasSubItems ? (
              <div className="flex min-w-0 flex-col gap-1">
                <span>{parentDisplay.numericLabel}</span>
                {parentDisplay.progress != null ? (
                  <KpiProgressBar value={parentDisplay.progress} barClassName="h-1.5" />
                ) : null}
              </div>
            ) : (
              formatViNumber(row.numericValue)
            )}
          </TableCell>
          <TableCell className={cn(td, 'text-xs uppercase')}>
            <div className="w-[64px] truncate">{parentDisplay.numericUnit}</div>
          </TableCell>
        </>
      ) : (
        <AssignmentEpic4ReadCells row={row} td={td} />
      )}
      <TableCell
        className={cn(
          td,
          EVAL_LEADER_CELL,
          submitValidation?.leaderEval && 'bg-red-50 dark:bg-red-950/20'
        )}
      >
        {mode === 'planning' ? (
          <div className="flex min-w-0 flex-col gap-1">
            <GoalReviewStatusBadge review={row.goalReview} />
            <GoalReviewSummary review={row.goalReview} />
          </div>
        ) : canEditLeaderInline ? (
          <div className="min-w-0 w-full max-w-full space-y-1">
            <CustomSelect
              value={leaderEvalDraft.managerEvalStatus || '__none'}
              onValueChange={(v) => leaderEvalDraft.setManagerEvalStatus(v === '__none' ? '' : v)}
              disabled={leaderEvalDraft.inputsDisabled}
              className="!space-y-0 min-w-0 w-full"
              triggerClassName={cn(
                TABLE_INLINE_SELECT_TRIGGER,
                submitValidation?.leaderEval && INVALID_FIELD_RING
              )}
              options={[
                { label: '—', value: '__none' },
                { label: 'OK', value: 'OK' },
                { label: 'NOT', value: 'NOT' },
              ]}
            />
            <textarea
              value={leaderEvalDraft.managerReviewNote}
              onChange={(e) => leaderEvalDraft.setManagerReviewNote(e.target.value)}
              rows={2}
              className={TABLE_TEXTAREA}
              placeholder="Nhận xét"
              disabled={leaderEvalDraft.inputsDisabled}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-1">
            <EvalStatusBadge status={row.managerEvalStatus} type="leader" />
            {row.managerReviewNote && (
              <div
                className="text-xs text-slate-500 italic max-w-[140px] truncate"
                title={row.managerReviewNote}
              >
                {row.managerReviewNote}
              </div>
            )}
          </div>
        )}
      </TableCell>
      {mode !== 'planning' && !hideManagerEvalColumn ? (
        <TableCell className={cn(td, EVAL_MANAGER_CELL)}>
          <EvalStatusBadge status={row.finalEvalStatus} type="manager" />
        </TableCell>
      ) : null}
      {showActionColumn ? (
        <TableCell
          className={cn(
            td,
            'sticky right-0 z-10 whitespace-nowrap bg-white text-right shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.12)] dark:bg-slate-950'
          )}
        >
          <div className="flex items-center justify-end gap-0.5">
            <Dialog open={open} onOpenChange={setOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={deleting}
                      className="h-8 w-8 rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Sửa</span>
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Sửa mục tiêu
                </TooltipContent>
              </Tooltip>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Sửa mục tiêu KPI/OKR</DialogTitle>
                  <DialogDescription>
                    Cập nhật nội dung, ưu tiên và chỉ tiêu cho kỳ đang chọn.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
                    <SelectController
                      control={control}
                      name="priority"
                      label="Ưu tiên"
                      required
                      rules={{ required: true, min: 0, max: 99 }}
                      className="space-y-1 text-xs font-medium"
                    >
                      <SelectItem value="0">Không xếp (0)</SelectItem>
                      <SelectItem value="1">Ưu tiên 1</SelectItem>
                      <SelectItem value="2">Ưu tiên 2</SelectItem>
                      <SelectItem value="3">Ưu tiên 3</SelectItem>
                    </SelectController>
                    <InputController
                      control={control}
                      name="targetMetric"
                      label="Chỉ tiêu"
                      className="space-y-1 text-xs font-medium"
                      placeholder="VD: 60"
                      inputClassName="h-9 rounded-lg border-slate-200"
                    />
                    <label className="md:col-span-2 flex flex-col gap-1 text-xs font-medium">
                      <TextareaController
                        control={control}
                        name="content"
                        label="Nội dung KPI/OKR"
                        required
                        rules={{ required: true, maxLength: 500 }}
                        className="space-y-1 text-xs font-medium"
                        maxLength={500}
                        textareaClassName="min-h-[96px] rounded-lg border-slate-200"
                        placeholder="Mô tả chỉ tiêu…"
                      />
                    </label>
                    <div className="md:col-span-2">
                      <SubItemsEditSection control={control} />
                    </div>
                    <div className="flex items-end justify-end gap-2 md:col-span-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        className="rounded-lg"
                      >
                        Hủy
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || deleting}
                        className="rounded-lg bg-primary px-6 font-semibold"
                      >
                        {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            {canDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={deleting || isSubmitting}
                    className="h-8 w-8 rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Xóa</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Xóa mục tiêu
                </TooltipContent>
              </Tooltip>
            ) : isMandatory ? (
              <span
                className="flex h-8 w-8 items-center justify-center text-slate-300"
                title="Chỉ số cố định — không thể xóa"
              >
                <Lock className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
          <Dialog
            open={deleteConfirmOpen}
            onOpenChange={(next) => {
              if (next) return
              if (deleting) return
              setDeleteConfirmOpen(false)
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Xóa mục tiêu KPI/OKR?</DialogTitle>
                <DialogDescription>
                  Dữ liệu evidence và đánh giá liên quan sẽ mất. Thao tác không hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void handleDeleteAssignment()}
                >
                  {deleting ? 'Đang xóa…' : 'Xóa'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function groupAssignmentsByUser(assignments: PerformanceAssignment[]) {
  const m = new Map<string, PerformanceAssignment[]>()
  for (const a of assignments) {
    const arr = m.get(a.assigneeUserId) ?? []
    arr.push(a)
    m.set(a.assigneeUserId, arr)
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
  }
  return m
}

/** Đưa user được ưu tiên (vd. chính mình) lên đầu danh sách chọn nhân sự. */
function memberRowsHaveDraft(
  rows: PerformanceAssignment[],
  draftByRowId?: Record<string, MemberSelfEditDraft>
) {
  if (!draftByRowId) return false
  return rows.some((r) => r.id in draftByRowId)
}

function orderUserEntriesFirst(
  entries: [string, PerformanceAssignment[]][],
  userId: string | undefined
): [string, PerformanceAssignment[]][] {
  if (!userId?.trim()) return entries
  const i = entries.findIndex(([id]) => id === userId)
  if (i <= 0) return entries
  const copy = [...entries]
  const [first] = copy.splice(i, 1)
  return first ? [first, ...copy] : entries
}

function AssignmentTableSingleUser({
  userId,
  rows: rawRows,
  members,
  canEditTeam,
  onRefresh,
  leaderMode,
  memberSelfEditableResults,
  planningReadOnly,
  prioritizeUserId,
  templateCode,
  isManagerCascade,
  hideRowSave,
  resultsReadOnly,
  onDraftRowChange,
  draftByRowId,
  hideManagerEvalColumn,
  submitValidationByRowId,
}: {
  userId: string
  rows: PerformanceAssignment[]
  members: TeamMemberRow[]
  canEditTeam: boolean
  onRefresh: () => void
  leaderMode: 'planning' | 'results'
  memberSelfEditableResults: boolean
  planningReadOnly?: boolean
  prioritizeUserId?: string
  templateCode?: string
  isManagerCascade?: boolean
  hideRowSave?: boolean
  resultsReadOnly?: boolean
  onDraftRowChange?: (rowId: string, draft: MemberSelfEditDraft) => void
  draftByRowId?: Record<string, MemberSelfEditDraft>
  /** Phòng Kinh doanh: ẩn cột Đánh giá Manager (chỉ dùng Leader). */
  hideManagerEvalColumn?: boolean
  submitValidationByRowId?: Record<string, RowSubmitValidationHighlight>
}) {
  // Manager variant: dedup rows by content — each metric shown once for team-wide cascade operations
  const rows = useMemo(() => {
    if (!isManagerCascade) return rawRows
    const seen = new Set<string>()
    return rawRows.filter((r) => {
      if (seen.has(r.content)) return false
      seen.add(r.content)
      return true
    })
  }, [rawRows, isManagerCascade])
  const isPlanning = leaderMode === 'planning'
  /** Epic 4: member chỉnh Evidence / số liệu / tự đánh giá cho đúng user của mình (chế độ results). */
  const allowSelfEdit =
    memberSelfEditableResults &&
    !resultsReadOnly &&
    !(leaderMode === 'planning' && planningReadOnly) &&
    Boolean(prioritizeUserId && userId === prioritizeUserId)
  const memberMetaLine = memberMetaForDisplay(members, userId, rows)

  /** Epic 5.5: các row bắt buộc nhập Số liệu chưa có giá trị. */
  const mandatoryUnfilled = allowSelfEdit
    ? rows.filter((r) => isMandatoryMetric(r.content) && r.numericValue == null)
    : []
  const tableHeads = useMemo((): string[] => {
    let base: string[] = isPlanning ? [...PLANNING_ASSIGN_TABLE_HEAD] : [...ASSIGN_TABLE_HEAD]
    if (hideManagerEvalColumn && !isPlanning) {
      base = base.filter((h) => h !== 'Đánh giá Manager')
    }
    if (hideRowSave && !isPlanning) {
      base = base.filter((h) => h !== 'Thao tác')
    }
    return base
  }, [isPlanning, hideRowSave, hideManagerEvalColumn])
  const showTrailingActionCell = tableHeads.includes('Thao tác')
  const resultsTableMinWidth = resultsTableMinWidthClass(Boolean(hideManagerEvalColumn))
  const allowGoalReviewConfirm =
    isPlanning &&
    !canEditTeam &&
    Boolean(prioritizeUserId && members.some((m) => m.userId === prioritizeUserId))

  const tableHeader = (
    <TableHeader>
      <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
        {tableHeads.map((h) => (
          <TableHead
            key={h}
            className={cn(
              XL_TH,
              !isPlanning && resultsColumnHeadClass(h),
              h === 'Thao tác' &&
                'sticky right-0 z-20 bg-slate-50/95 backdrop-blur-md shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.12)] dark:bg-slate-900/95'
            )}
          >
            {h}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )

  const tableBody = (
    <TableBody>
      {rows.length === 0 ? (
        <TableRow>
          <TableCell colSpan={tableHeads.length} className="h-32 text-center text-slate-400">
            Chưa có dữ liệu cho nhân sự này.
          </TableCell>
        </TableRow>
      ) : (
        rows.map((r, idx) => {
          if (resultsReadOnly) {
            return (
              <ReadOnlyAssignmentRow
                key={r.id}
                row={r}
                rowStripe={idx % 2 === 1}
                mode="results"
                hideManagerEvalColumn={hideManagerEvalColumn}
                showTrailingActionCell={showTrailingActionCell}
                allowGoalReviewConfirm={allowGoalReviewConfirm}
                onGoalReviewConfirmed={onRefresh}
              />
            )
          }
          if (allowSelfEdit && leaderMode === 'results') {
            return (
              <MemberSelfAssignmentRow
                key={r.id}
                row={r}
                rowStripe={idx % 2 === 1}
                onSaved={onRefresh}
                hideRowSave={hideRowSave}
                canEditLeaderEval={canEditTeam}
                pendingDraft={draftByRowId?.[r.id]}
                onDraftChange={
                  hideRowSave && onDraftRowChange
                    ? (draft) => onDraftRowChange(r.id, draft)
                    : undefined
                }
                submitValidation={submitValidationByRowId?.[r.id]}
                hideManagerEvalColumn={hideManagerEvalColumn}
              />
            )
          }
          if (canEditTeam) {
            return (
              <LeaderAssignmentRow
                key={r.id}
                row={r}
                mode={leaderMode}
                onSaved={onRefresh}
                rowStripe={idx % 2 === 1}
                canEditTeam={canEditTeam}
                isMandatory={isMandatoryMetric(r.content, templateCode)}
                isCascade={isManagerCascade}
                hideRowSave={hideRowSave}
                disabled={resultsReadOnly}
                pendingDraft={draftByRowId?.[r.id]}
                hideManagerEvalColumn={hideManagerEvalColumn}
                submitValidation={submitValidationByRowId?.[r.id]}
                onDraftChange={
                  hideRowSave && onDraftRowChange
                    ? (draft) => onDraftRowChange(r.id, draft)
                    : undefined
                }
              />
            )
          }
          if (allowSelfEdit) {
            if (leaderMode === 'planning') {
              return (
                <ReadOnlyAssignmentRow
                  key={r.id}
                  row={r}
                  rowStripe={idx % 2 === 1}
                  mode={leaderMode}
                  hideManagerEvalColumn={hideManagerEvalColumn}
                  showTrailingActionCell={showTrailingActionCell}
                  allowGoalReviewConfirm={allowGoalReviewConfirm}
                  onGoalReviewConfirmed={onRefresh}
                />
              )
            }
            return (
              <MemberSelfAssignmentRow
                key={r.id}
                row={r}
                rowStripe={idx % 2 === 1}
                onSaved={onRefresh}
                canEditLeaderEval={canEditTeam}
                submitValidation={submitValidationByRowId?.[r.id]}
                hideManagerEvalColumn={hideManagerEvalColumn}
              />
            )
          }
          return (
            <ReadOnlyAssignmentRow
              key={r.id}
              row={r}
              rowStripe={idx % 2 === 1}
              mode={leaderMode}
              hideManagerEvalColumn={hideManagerEvalColumn}
              showTrailingActionCell={showTrailingActionCell}
              allowGoalReviewConfirm={allowGoalReviewConfirm}
              onGoalReviewConfirmed={onRefresh}
            />
          )
        })
      )}
    </TableBody>
  )

  return (
    <div
      className={cn(
        XL_BORDER,
        'overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-950',
        isPlanning ? 'border-t-4 border-t-blue-500' : 'border-t-4 border-t-emerald-500'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isPlanning
            ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-100/50'
            : 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100/50'
        )}
      >
        <div className="flex items-center gap-3">
          <OrgUserAvatar
            name={nameForMember(members, userId, rows)}
            avatarUrl={teamMemberPortrait(findTeamMember(members, userId))}
            className={cn(
              'h-9 w-9 shrink-0 text-xs',
              isPlanning ? 'ring-blue-200' : 'ring-emerald-200'
            )}
          />
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {nameForMember(members, userId, rows)}
            </div>
            {memberMetaLine ? <div className="text-xs text-slate-500">{memberMetaLine}</div> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="muted"
            className={cn(
              'h-6 rounded-md shadow-none border-none',
              isPlanning ? 'bg-blue-100/50 text-blue-700' : 'bg-emerald-100/50 text-emerald-700'
            )}
          >
            {rows.length} hạng mục
          </Badge>
        </div>
      </div>
      {mandatoryUnfilled.length > 0 && (
        <div className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive dark:bg-destructive/10">
          <span className="mt-0.5 shrink-0 font-bold">!</span>
          <span>
            Chỉ số bắt buộc chưa nhập Số liệu:{' '}
            <strong>{mandatoryUnfilled.map((r) => r.content).join(', ')}</strong> — vui lòng điền
            trước khi kết thúc tháng.
          </span>
        </div>
      )}
      {canEditTeam ? (
        <div className="max-h-[min(70vh,calc(100vh-400px))] min-w-0 overflow-auto [scrollbar-width:thin] md:hidden">
          <Table className={cn('w-full', isPlanning ? 'min-w-[980px]' : resultsTableMinWidth)}>
            {tableHeader}
            {tableBody}
          </Table>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800 md:hidden">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Chưa có dữ liệu cho nhân sự này.
            </div>
          ) : (
            rows.map((r, idx) => {
              if (resultsReadOnly) {
                return (
                  <ReadOnlyAssignmentMobileCard
                    key={r.id}
                    row={r}
                    rowStripe={idx % 2 === 1}
                    mode="results"
                    allowGoalReviewConfirm={allowGoalReviewConfirm}
                    onGoalReviewConfirmed={onRefresh}
                  />
                )
              }
              if (allowSelfEdit && leaderMode === 'results') {
                return (
                  <MemberSelfAssignmentMobileCard
                    key={r.id}
                    row={r}
                    rowStripe={idx % 2 === 1}
                    onSaved={onRefresh}
                    hideRowSave={hideRowSave}
                    pendingDraft={draftByRowId?.[r.id]}
                    onDraftChange={
                      hideRowSave && onDraftRowChange
                        ? (draft) => onDraftRowChange(r.id, draft)
                        : undefined
                    }
                  />
                )
              }
              if (allowSelfEdit) {
                if (leaderMode === 'planning') {
                  return (
                    <ReadOnlyAssignmentMobileCard
                      key={r.id}
                      row={r}
                      rowStripe={idx % 2 === 1}
                      mode={leaderMode}
                      allowGoalReviewConfirm={allowGoalReviewConfirm}
                      onGoalReviewConfirmed={onRefresh}
                    />
                  )
                }
                return (
                  <MemberSelfAssignmentMobileCard
                    key={r.id}
                    row={r}
                    rowStripe={idx % 2 === 1}
                    onSaved={onRefresh}
                  />
                )
              }
              return (
                <ReadOnlyAssignmentMobileCard
                  key={r.id}
                  row={r}
                  rowStripe={idx % 2 === 1}
                  mode={leaderMode}
                  allowGoalReviewConfirm={allowGoalReviewConfirm}
                  onGoalReviewConfirmed={onRefresh}
                />
              )
            })
          )}
        </div>
      )}
      <div className="hidden max-h-[calc(100vh-400px)] min-w-0 overflow-auto [scrollbar-width:thin] md:block">
        <Table className={cn('w-full', isPlanning ? 'min-w-[980px]' : resultsTableMinWidth)}>
          {tableHeader}
          {tableBody}
        </Table>
      </div>
    </div>
  )
}

/** Thanh thao tác cấp team — lưu/ghi đè draft & gửi duyệt cho mọi nhân sự trong kỳ. */
function ResultsBatchActionBar({
  year,
  month,
  memberCount,
  canEditResults,
  memberSelfEditableResults,
  resultsReadOnly,
  isKinhDoanhTeam,
  kinhDoanhResultsCloseOpen,
  kinhDoanhResultsCloseBounds,
  onSaveResultsDraft,
  savingResultsDraft,
  draftRowIds,
  onSubmitResultApproval,
  submittingResultApproval,
  canSubmitResultApproval,
}: {
  year: number
  month: number
  memberCount: number
  canEditResults: boolean
  memberSelfEditableResults: boolean
  resultsReadOnly?: boolean
  isKinhDoanhTeam?: boolean
  kinhDoanhResultsCloseOpen?: boolean
  kinhDoanhResultsCloseBounds?: { startDay: number; endDay: number }
  onSaveResultsDraft?: () => void | Promise<void>
  savingResultsDraft?: boolean
  draftRowIds?: string[]
  onSubmitResultApproval?: () => void | Promise<void>
  submittingResultApproval?: boolean
  canSubmitResultApproval?: boolean
}) {
  const saveDraftLabel = isKinhDoanhTeam ? 'Chốt KPI tháng này' : 'Lưu bản nháp'
  const saveDraftSavingLabel = isKinhDoanhTeam ? 'Đang chốt…' : 'Đang lưu…'
  const kinhDoanhCloseBlocked = Boolean(isKinhDoanhTeam && !kinhDoanhResultsCloseOpen)
  const showSave = !isMockApiEnabled() && (memberSelfEditableResults || canEditResults)
  const showSubmit = Boolean(canSubmitResultApproval && onSubmitResultApproval)

  if (!showSave && !showSubmit) return null

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Thao tác cho toàn team
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Áp dụng cho{' '}
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            tất cả {memberCount} nhân sự
          </strong>{' '}
          trong kỳ T{month}/{year} — gồm mọi thay đổi chưa lưu trên các tab nhân sự bên dưới.
        </p>
        {kinhDoanhCloseBlocked && kinhDoanhResultsCloseBounds ? (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            Chốt KPI T{month}/{year}:{' '}
            {formatKinhDoanhResultsCloseRange(year, month, kinhDoanhResultsCloseBounds)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {showSave ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg font-semibold"
            disabled={
              savingResultsDraft ||
              submittingResultApproval ||
              resultsReadOnly ||
              kinhDoanhCloseBlocked ||
              !draftRowIds?.length
            }
            onClick={() => {
              void onSaveResultsDraft?.()
            }}
          >
            {savingResultsDraft ? saveDraftSavingLabel : saveDraftLabel}
          </Button>
        ) : null}
        {showSubmit ? (
          <Button
            type="button"
            size="sm"
            className="rounded-lg bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submittingResultApproval || savingResultsDraft}
            onClick={() => void onSubmitResultApproval?.()}
          >
            {submittingResultApproval ? 'Đang gửi…' : 'Gửi duyệt kết quả'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function UserAssignmentWorkbench({
  byUser,
  members,
  canEditTeam,
  onRefresh,
  leaderMode,
  emptyText,
  prioritizeUserId,
  showUserList = true,
  memberSelfEditableResults,
  planningReadOnly,
  templateCode,
  isManagerCascade,
  resultsBatchDraft,
  resultsReadOnly,
  onDraftRowChange,
  draftByRowId,
  submitValidationByRowId,
  isTrafficTeam,
  isKinhDoanhTeam,
  year,
  month,
}: {
  byUser: Map<string, PerformanceAssignment[]>
  members: TeamMemberRow[]
  canEditTeam: boolean
  onRefresh: () => void
  leaderMode: 'planning' | 'results'
  year: number
  month: number
  emptyText: string
  /** User hiển thị mặc định & xếp đầu danh sách (thường là user đang đăng nhập). */
  prioritizeUserId?: string
  showUserList?: boolean
  memberSelfEditableResults: boolean
  planningReadOnly?: boolean
  templateCode?: string
  isManagerCascade?: boolean
  resultsBatchDraft?: boolean
  resultsReadOnly?: boolean
  onDraftRowChange?: (rowId: string, draft: MemberSelfEditDraft) => void
  draftByRowId?: Record<string, MemberSelfEditDraft>
  submitValidationByRowId?: Record<string, RowSubmitValidationHighlight>
  isTrafficTeam?: boolean
  isKinhDoanhTeam?: boolean
}) {
  const userEntries = useMemo(
    () => orderUserEntriesFirst(Array.from(byUser.entries()), prioritizeUserId),
    [byUser, prioritizeUserId]
  )
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  if (!userEntries.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <p className="text-sm text-slate-400">{emptyText}</p>
      </div>
    )
  }

  const defaultUserId =
    prioritizeUserId && byUser.has(prioritizeUserId) ? prioritizeUserId : userEntries[0]![0]
  const activeUserId = selectedUserId && byUser.has(selectedUserId) ? selectedUserId : defaultUserId
  const activeRows = byUser.get(activeUserId) ?? []

  const hideManagerEvalColumn = Boolean(isKinhDoanhTeam && !isTrafficTeam)

  if (!showUserList) {
    return (
      <div className="space-y-3">
        <AssignmentTableSingleUser
          userId={activeUserId}
          rows={activeRows}
          members={members}
          canEditTeam={canEditTeam}
          onRefresh={onRefresh}
          leaderMode={leaderMode}
          memberSelfEditableResults={memberSelfEditableResults}
          planningReadOnly={planningReadOnly}
          prioritizeUserId={prioritizeUserId}
          templateCode={templateCode}
          isManagerCascade={isManagerCascade}
          hideRowSave={resultsBatchDraft}
          resultsReadOnly={resultsReadOnly}
          onDraftRowChange={onDraftRowChange}
          draftByRowId={draftByRowId}
          hideManagerEvalColumn={hideManagerEvalColumn}
          submitValidationByRowId={submitValidationByRowId}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1 text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          <Users
            className={cn(
              'h-4 w-4 shrink-0',
              leaderMode === 'planning' ? 'text-blue-500' : 'text-emerald-500'
            )}
          />
          Danh sách nhân sự
        </div>
        <div
          role="tablist"
          aria-label="Chọn nhân sự"
          className={cn(
            'flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]',
            '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full',
            leaderMode === 'planning'
              ? '[&::-webkit-scrollbar-thumb]:bg-blue-200 dark:[&::-webkit-scrollbar-thumb]:bg-blue-900/60'
              : '[&::-webkit-scrollbar-thumb]:bg-emerald-200 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-900/60'
          )}
        >
          {userEntries.map(([uid, rows]) => {
            const active = uid === activeUserId
            const isPlanning = leaderMode === 'planning'
            const tabMeta = memberMetaForDisplay(members, uid, rows)
            const hasUnsavedDraft = memberRowsHaveDraft(rows, draftByRowId)
            return (
              <button
                key={uid}
                type="button"
                role="tab"
                aria-selected={active}
                id={`kpi-tab-${leaderMode}-${uid}`}
                onClick={() => setSelectedUserId(uid)}
                className={cn(
                  'flex min-w-[160px] max-w-[240px] shrink-0 snap-start flex-col gap-1 rounded-xl px-4 py-2.5 text-left transition-all duration-200',
                  active
                    ? isPlanning
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 ring-1 ring-blue-600 dark:shadow-none'
                      : 'bg-emerald-600 text-white shadow-md shadow-emerald-200 ring-1 ring-emerald-600 dark:shadow-none'
                    : 'border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900'
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <OrgUserAvatar
                    name={nameForMember(members, uid, rows)}
                    avatarUrl={teamMemberPortrait(findTeamMember(members, uid))}
                    className={cn(
                      'h-8 w-8 shrink-0 text-[10px]',
                      active ? 'ring-2 ring-white/60' : ''
                    )}
                  />
                  <span
                    className={cn(
                      'min-w-0 truncate text-sm font-bold',
                      active ? 'text-white' : 'text-slate-800 dark:text-slate-100'
                    )}
                    title={nameForMember(members, uid, rows)}
                  >
                    {nameForMember(members, uid, rows)}
                  </span>
                </div>
                {tabMeta ? (
                  <span
                    className={cn(
                      'truncate text-xs',
                      active
                        ? isPlanning
                          ? 'text-blue-100/90'
                          : 'text-emerald-100/90'
                        : 'text-slate-500 dark:text-slate-400'
                    )}
                    title={tabMeta}
                  >
                    {tabMeta}
                  </span>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-flex h-5 items-center rounded-md px-2 text-xs font-bold uppercase tracking-wide',
                      active
                        ? 'bg-white/20 text-white'
                        : isPlanning
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                    )}
                  >
                    {rows.length} hạng mục
                  </span>
                  {prioritizeUserId && uid === prioritizeUserId ? (
                    <span
                      className={cn(
                        'inline-flex h-5 items-center rounded-md px-2 text-xs font-bold uppercase tracking-wide',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      )}
                    >
                      Bạn
                    </span>
                  ) : null}
                  {hasUnsavedDraft ? (
                    <span
                      className={cn(
                        'inline-flex h-5 items-center rounded-md px-2 text-xs font-semibold',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      )}
                      title="Có thay đổi chưa lưu"
                    >
                      Chưa lưu
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`kpi-user-panel-${leaderMode}-${activeUserId}`}
        aria-labelledby={`kpi-tab-${leaderMode}-${activeUserId}`}
        className="min-w-0 space-y-3"
      >
        <AssignmentTableSingleUser
          userId={activeUserId}
          rows={activeRows}
          members={members}
          canEditTeam={canEditTeam}
          onRefresh={onRefresh}
          leaderMode={leaderMode}
          memberSelfEditableResults={memberSelfEditableResults}
          planningReadOnly={planningReadOnly}
          prioritizeUserId={prioritizeUserId}
          templateCode={templateCode}
          isManagerCascade={isManagerCascade}
          hideRowSave={resultsBatchDraft}
          resultsReadOnly={resultsReadOnly}
          onDraftRowChange={onDraftRowChange}
          draftByRowId={draftByRowId}
          hideManagerEvalColumn={hideManagerEvalColumn}
          submitValidationByRowId={submitValidationByRowId}
        />
      </div>
    </div>
  )
}

/**
 * Bảng 1 — "Chốt mục tiêu mới KPI/OKR". Tách riêng khỏi bảng Kết quả để logic
 * (quyền sửa, khoá khi duyệt mục tiêu) không lẫn với bảng Kết quả.
 */
function PlanningSection({
  byUser,
  members,
  canEditTeam,
  onRefresh,
  currentUserId,
  isMemberView,
  selectedTeamId,
  year,
  month,
  assignmentWindowOpen,
  planningReadOnly,
  memberSelfEditableResults,
  templateCode,
  isManagerCascade,
}: {
  byUser: Map<string, PerformanceAssignment[]>
  members: TeamMemberRow[]
  canEditTeam: boolean
  onRefresh: () => void
  currentUserId: string | undefined
  isMemberView: boolean
  selectedTeamId: string
  year: number
  month: number
  assignmentWindowOpen: boolean
  planningReadOnly?: boolean
  memberSelfEditableResults: boolean
  templateCode?: string
  isManagerCascade?: boolean
}) {
  return (
    <section id="planning-section" className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-1 rounded-full bg-blue-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              1. Chốt mục tiêu mới KPI/OKR cho tháng {month}/{year}
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Lập và chốt mục tiêu KPI/OKR mới cho team trong kỳ này.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 overflow-hidden">
            {members.slice(0, 5).map((m) => (
              <OrgUserAvatar
                key={m.userId}
                name={m.displayName?.trim() || m.email?.trim() || '?'}
                avatarUrl={teamMemberPortrait(m)}
                className="h-7 w-7 text-[10px] ring-2 ring-white dark:ring-slate-950"
              />
            ))}
            {members.length > 5 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white dark:bg-slate-800 dark:ring-slate-950 text-xs font-medium text-slate-500">
                +{members.length - 5}
              </div>
            )}
          </div>
          {canEditTeam &&
            selectedTeamId &&
            !isMockApiEnabled() &&
            assignmentWindowOpen &&
            (isManagerCascade ? (
              <ManagerCascadeAddForm
                teamId={selectedTeamId}
                year={year}
                month={month}
                onCreated={onRefresh}
              />
            ) : (
              <MiniCreateForm
                teamId={selectedTeamId}
                year={year}
                month={month}
                members={members}
                defaultAssigneeId={currentUserId ?? ''}
                onCreated={onRefresh}
              />
            ))}
        </div>
      </div>
      <UserAssignmentWorkbench
        byUser={byUser}
        members={members}
        canEditTeam={canEditTeam}
        onRefresh={onRefresh}
        leaderMode="planning"
        year={year}
        month={month}
        emptyText="Chưa có mục tiêu cho tháng này."
        prioritizeUserId={currentUserId}
        showUserList={!isMemberView}
        memberSelfEditableResults={memberSelfEditableResults}
        planningReadOnly={planningReadOnly}
        templateCode={templateCode}
        isManagerCascade={isManagerCascade}
      />
    </section>
  )
}

/**
 * Bảng 2 — "Kết quả & đánh giá". Tách riêng khỏi bảng Mục tiêu.
 * - Sở hữu state bản nháp (draft) riêng.
 * - Traffic team: chỉ hiển thị chỉ số KPI/OKR khi mục tiêu đã được duyệt (`goalApproved`).
 */
function ResultsSection({
  byUser,
  members,
  canEditResults,
  onRefresh,
  currentUserId,
  isMemberView,
  year,
  month,
  memberSelfEditableResults,
  templateCode,
  isManagerCascade,
  isTrafficTeam,
  resultApprovalRequest,
  isResultApprovalLocked,
  goalApproved,
  onSubmitResultApproval,
  submittingResultApproval,
  canSubmitResultApproval,
  isKinhDoanhTeam,
  kinhDoanhResultsCloseOpen,
  kinhDoanhResultsCloseBounds,
  kinhDoanhResultsClosePhase,
  onRecalculateSummaries,
}: {
  byUser: Map<string, PerformanceAssignment[]>
  members: TeamMemberRow[]
  canEditResults: boolean
  onRefresh: (opts?: { skipAutoRecalc?: boolean }) => void
  currentUserId: string | undefined
  isMemberView: boolean
  year: number
  month: number
  memberSelfEditableResults: boolean
  templateCode?: string
  isManagerCascade?: boolean
  isTrafficTeam?: boolean
  resultApprovalRequest?: ApprovalRequest | null
  isResultApprovalLocked?: boolean
  goalApproved: boolean
  onSubmitResultApproval?: () => void | Promise<void>
  submittingResultApproval?: boolean
  canSubmitResultApproval?: boolean
  isKinhDoanhTeam?: boolean
  kinhDoanhResultsCloseOpen?: boolean
  kinhDoanhResultsCloseBounds?: { startDay: number; endDay: number }
  kinhDoanhResultsClosePhase?: 'before' | 'open' | 'after' | null
  onRecalculateSummaries?: () => Promise<void>
}) {
  const [draftByRowId, setDraftByRowId] = useState<Record<string, MemberSelfEditDraft>>({})
  const [submitValidationByRowId, setSubmitValidationByRowId] = useState<
    Record<string, RowSubmitValidationHighlight>
  >({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const draftByRowIdRef = useRef(draftByRowId)
  draftByRowIdRef.current = draftByRowId

  const assignmentById = useMemo(() => {
    const m = new Map<string, PerformanceAssignment>()
    for (const rows of byUser.values()) {
      for (const r of rows) m.set(r.id, r)
    }
    return m
  }, [byUser])

  const handleDraftRowChange = useCallback(
    (rowId: string, draft: MemberSelfEditDraft) => {
      const assignment = assignmentById.get(rowId)
      const leaderSelfSync = Boolean(
        assignment && currentUserId && assignment.assigneeUserId === currentUserId
      )
      const normalized = normalizeDraftForLeaderSelf(draft, leaderSelfSync)
      const serverSnap = assignment
        ? rowToMemberDraftSnapshot(assignment, {}, { leaderSelfSync })
        : null
      setDraftByRowId((prev) => {
        if (serverSnap && memberSelfDraftsEqual(serverSnap, normalized)) {
          if (!(rowId in prev)) return prev
          const { [rowId]: _removed, ...rest } = prev
          void _removed
          return rest
        }
        const existing = prev[rowId]
        if (existing && memberSelfDraftsEqual(existing, normalized)) return prev
        return { ...prev, [rowId]: normalized }
      })
      setSubmitValidationByRowId((prev) => {
        if (!(rowId in prev)) return prev
        const assignment = assignmentById.get(rowId)
        if (!assignment) return prev
        const nextHighlight = computeRowSubmitValidationHighlights(assignment, normalized, {
          currentUserId,
          canEditResults,
          templateCode,
        })
        if (hasValidationHighlight(nextHighlight)) {
          return { ...prev, [rowId]: nextHighlight }
        }
        const { [rowId]: _removed, ...rest } = prev
        void _removed
        return rest
      })
    },
    [assignmentById, currentUserId, canEditResults, templateCode]
  )

  const persistPendingDrafts = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      if (isKinhDoanhTeam && !kinhDoanhResultsCloseOpen) {
        const b = kinhDoanhResultsCloseBounds
        toast.error(
          b
            ? `Đã hết thời gian chốt KPI T${month}/${year} (khung ${formatKinhDoanhResultsCloseRange(year, month, b)}).`
            : `Đã hết thời gian chốt KPI T${month}/${year}.`
        )
        return false
      }
      const drafts = draftByRowIdRef.current
      const rowIds = Object.keys(drafts)
      if (!rowIds.length) {
        if (!opts?.silent) {
          toast.info(isKinhDoanhTeam ? 'Chưa có thay đổi để chốt.' : 'Chưa có thay đổi để lưu.')
        }
        return true
      }
      if (!opts?.silent) setSavingDraft(true)
      try {
        let saved = 0
        for (const rowId of rowIds) {
          let draft = drafts[rowId]
          if (!draft) continue
          const assignment = assignmentById.get(rowId)
          const isLeaderSelfRow = Boolean(
            assignment && currentUserId && assignment.assigneeUserId === currentUserId
          )
          if (isLeaderSelfRow) {
            draft = normalizeDraftForLeaderSelf(draft, true)
          }
          const leaderEvalOnly = Boolean(
            canEditResults &&
            assignment &&
            currentUserId &&
            assignment.assigneeUserId !== currentUserId
          )
          const body = draftToPatchBody(draft, { leaderEvalOnly })
          if (body === 'invalid') {
            toast.error('Số liệu không hợp lệ — kiểm tra lại trước khi lưu.')
            return false
          }
          if (canEditResults) {
            await performanceApi.patchAssignment(rowId, body)
          } else {
            const { managerEvalStatus: _m, managerReviewNote: _n, ...selfBody } = body
            void _m
            void _n
            await performanceApi.patchAssignmentSelf(rowId, selfBody)
          }
          saved += 1
        }
        if (saved > 0) {
          setDraftByRowId({})
          onRefresh({ skipAutoRecalc: isKinhDoanhTeam })
          if (isKinhDoanhTeam && onRecalculateSummaries) {
            try {
              await onRecalculateSummaries()
              if (!opts?.silent) {
                toast.success(
                  `Đã chốt KPI tháng ${month}/${year} (${saved} dòng) và cập nhật bảng hiệu suất.`
                )
              }
            } catch {
              if (!opts?.silent) {
                toast.warning(
                  `Đã chốt KPI (${saved} dòng) nhưng chưa tính được bảng hiệu suất — thử "Tính lại tổng hợp".`
                )
              }
            }
          } else if (!opts?.silent) {
            toast.success(
              isKinhDoanhTeam
                ? `Đã chốt KPI tháng ${month}/${year} (${saved} dòng).`
                : `Đã lưu bản nháp (${saved} dòng).`
            )
          }
        }
        return true
      } catch {
        toast.error(
          isKinhDoanhTeam
            ? 'Không chốt được KPI. Kiểm tra quyền hoặc thử lại.'
            : 'Không lưu được bản nháp. Kiểm tra quyền hoặc thử lại.'
        )
        return false
      } finally {
        if (!opts?.silent) setSavingDraft(false)
      }
    },
    [
      onRefresh,
      canEditResults,
      assignmentById,
      currentUserId,
      isKinhDoanhTeam,
      kinhDoanhResultsCloseOpen,
      kinhDoanhResultsCloseBounds,
      onRecalculateSummaries,
      month,
      year,
    ]
  )

  const handleSaveResultsDraft = useCallback(async () => {
    await persistPendingDrafts()
  }, [persistPendingDrafts])

  const validateBeforeSubmitResultApproval = useCallback((): boolean => {
    const allAssignments = Array.from(byUser.values()).flat()
    if (!allAssignments.length) {
      toast.error('Không có KPI/OKR nào để gửi duyệt.')
      return false
    }
    const drafts = draftByRowIdRef.current
    const highlights: Record<string, RowSubmitValidationHighlight> = {}
    let hasInvalidNumeric = false
    let hasUnitGap = false
    let hasSelfFieldGap = false
    let unevaluatedCount = 0

    let hasSubItemSelfGap = false

    for (const assignment of allAssignments) {
      const rowHighlight = computeRowSubmitValidationHighlights(assignment, drafts[assignment.id], {
        currentUserId,
        canEditResults,
        templateCode,
      })
      if (!hasValidationHighlight(rowHighlight)) continue
      highlights[assignment.id] = rowHighlight
      if (rowHighlight.numeric) hasInvalidNumeric = true
      if (rowHighlight.numericUnit) hasUnitGap = true
      if (rowHighlight.evidence) hasSelfFieldGap = true
      if (rowHighlight.selfEval) {
        hasSelfFieldGap = true
        if ((assignment.subItems?.length ?? 0) > 0) hasSubItemSelfGap = true
      }
      if (rowHighlight.leaderEval) unevaluatedCount += 1
    }

    setSubmitValidationByRowId(highlights)

    const hasAnyHighlight = Object.values(highlights).some(hasValidationHighlight)
    if (!hasAnyHighlight) {
      return true
    }

    if (hasInvalidNumeric) {
      toast.error(
        hasSubItemSelfGap
          ? 'Số liệu mục con không hợp lệ — kiểm tra các ô đỏ trong khối mục con.'
          : 'Số liệu không hợp lệ hoặc chưa nhập — kiểm tra các ô được đánh dấu đỏ.'
      )
    } else if (hasUnitGap) {
      toast.error('Vui lòng nhập đơn vị — kiểm tra các ô được đánh dấu đỏ.')
    } else if (unevaluatedCount > 0) {
      toast.error(
        `Cần đánh giá OK hoặc NOT cho tất cả KPI/OKR của các thành viên (còn ${unevaluatedCount} mục).`
      )
    } else if (hasSubItemSelfGap) {
      toast.error(
        'Vui lòng chọn OK hoặc NOT cho từng mục con — kiểm tra các ô đỏ bên dưới nội dung KPI.'
      )
    } else if (hasSelfFieldGap) {
      toast.error('Vui lòng điền đầy đủ minh chứng và tự đánh giá trước khi gửi duyệt.')
    } else {
      toast.error('Vui lòng hoàn thiện các ô được đánh dấu đỏ trước khi gửi duyệt.')
    }
    return false
  }, [byUser, assignmentById, currentUserId, canEditResults, templateCode])

  const handleSubmitResultApprovalWithDraft = useCallback(async () => {
    if (!onSubmitResultApproval) return
    if (!validateBeforeSubmitResultApproval()) return
    setSubmittingApproval(true)
    try {
      const ok = await persistPendingDrafts({ silent: true })
      if (!ok) return
      await onSubmitResultApproval()
      setSubmitValidationByRowId({})
    } finally {
      setSubmittingApproval(false)
    }
  }, [onSubmitResultApproval, persistPendingDrafts, validateBeforeSubmitResultApproval])

  return (
    <section id="results-section" className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-6 w-1 rounded-full bg-emerald-600" />
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              2. Kết quả & đánh giá — T{month}/{year}
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            Evidence / số liệu / tự đánh giá của nhân viên và đánh giá QL cho kỳ T{month}/{year}{' '}
            (Epic 4).
          </p>
        </div>
      </div>

      {resultApprovalRequest?.status === 'pending' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-400/50 bg-yellow-50 px-4 py-3 dark:border-yellow-700/40 dark:bg-yellow-950/30">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-yellow-400" />
          <div className="flex-1 text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Kết quả T{month}/{year} đang chờ Manager duyệt — không thể chỉnh sửa.
          </div>
        </div>
      )}
      {resultApprovalRequest?.status === 'approved' && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-400/50 bg-green-50 px-4 py-3 dark:border-green-700/40 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="flex-1 text-sm font-medium text-green-800 dark:text-green-200">
            Kết quả T{month}/{year} đã được Manager duyệt.
          </div>
        </div>
      )}
      {resultApprovalRequest?.status === 'rejected' && (
        <div className="mb-4 rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 dark:border-red-700/40 dark:bg-red-950/30">
          <div className="flex items-center gap-3">
            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
            <div className="flex-1 text-sm font-medium text-red-800 dark:text-red-200">
              Kết quả bị từ chối — bạn có thể chỉnh sửa và gửi duyệt lại.
            </div>
          </div>
          {resultApprovalRequest.note ? (
            <p className="mt-1.5 pl-7 text-xs text-red-700 dark:text-red-300">
              Lý do: {resultApprovalRequest.note}
            </p>
          ) : null}
        </div>
      )}

      {!goalApproved ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-6 text-center dark:border-amber-800/50 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Mục tiêu KPI/OKR tháng {month}/{year} chưa được duyệt.
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
            Chỉ số KPI/OKR sẽ hiển thị để nhập kết quả sau khi mục tiêu được Manager duyệt.
          </p>
        </div>
      ) : (
        <>
          {isKinhDoanhTeam && !kinhDoanhResultsCloseOpen && kinhDoanhResultsCloseBounds ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/50 bg-amber-50 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                {kinhDoanhResultsClosePhase === 'before' ? (
                  <>
                    Chưa đến thời gian chốt KPI T{month}/{year}. Khung chốt:{' '}
                    {formatKinhDoanhResultsCloseRange(year, month, kinhDoanhResultsCloseBounds)}.
                  </>
                ) : (
                  <>
                    Đã hết thời gian chốt KPI T{month}/{year}. Khung chốt:{' '}
                    {formatKinhDoanhResultsCloseRange(year, month, kinhDoanhResultsCloseBounds)}.
                  </>
                )}
              </div>
            </div>
          ) : null}
          <ResultsBatchActionBar
            year={year}
            month={month}
            memberCount={byUser.size}
            canEditResults={canEditResults}
            memberSelfEditableResults={
              memberSelfEditableResults &&
              !isResultApprovalLocked &&
              Boolean(kinhDoanhResultsCloseOpen)
            }
            resultsReadOnly={
              isResultApprovalLocked || Boolean(isKinhDoanhTeam && !kinhDoanhResultsCloseOpen)
            }
            isKinhDoanhTeam={isKinhDoanhTeam}
            kinhDoanhResultsCloseOpen={kinhDoanhResultsCloseOpen}
            kinhDoanhResultsCloseBounds={kinhDoanhResultsCloseBounds}
            onSaveResultsDraft={handleSaveResultsDraft}
            savingResultsDraft={savingDraft}
            draftRowIds={Object.keys(draftByRowId)}
            onSubmitResultApproval={handleSubmitResultApprovalWithDraft}
            submittingResultApproval={submittingResultApproval || submittingApproval}
            canSubmitResultApproval={canSubmitResultApproval}
          />
          <UserAssignmentWorkbench
            byUser={byUser}
            members={members}
            canEditTeam={canEditResults}
            onRefresh={onRefresh}
            leaderMode="results"
            year={year}
            month={month}
            emptyText={`Chưa có dữ liệu KPI/OKR cho tháng ${month}/${year}.`}
            prioritizeUserId={currentUserId}
            showUserList={!isMemberView}
            memberSelfEditableResults={
              memberSelfEditableResults &&
              !isResultApprovalLocked &&
              Boolean(kinhDoanhResultsCloseOpen)
            }
            templateCode={templateCode}
            isManagerCascade={isManagerCascade}
            resultsBatchDraft
            resultsReadOnly={
              isResultApprovalLocked || Boolean(isKinhDoanhTeam && !kinhDoanhResultsCloseOpen)
            }
            onDraftRowChange={handleDraftRowChange}
            draftByRowId={draftByRowId}
            submitValidationByRowId={submitValidationByRowId}
            isTrafficTeam={isTrafficTeam}
            isKinhDoanhTeam={isKinhDoanhTeam}
          />
        </>
      )}
    </section>
  )
}

function WorkReportPanel({
  assignmentsThisMonth,
  loadingThis,
  members,
  membersLoading,
  canEditTeam,
  canEditResults,
  isMemberView,
  selectedTeamId,
  year,
  month,
  currentUserId,
  onRefresh,
  assignmentWindowOpen,
  assignmentWindowBounds,
  canMemberEditSelfResults,
  planningReadOnly,
  templateCode,
  isManagerCascade,
  isTrafficTeam,
  goalApproved,
  resultApprovalRequest,
  isResultApprovalLocked,
  onSubmitResultApproval,
  submittingResultApproval,
  canSubmitResultApproval,
  isKinhDoanhTeam,
  kinhDoanhResultsCloseOpen,
  kinhDoanhResultsCloseBounds,
  kinhDoanhResultsClosePhase,
  onRecalculateSummaries,
}: {
  assignmentsThisMonth: PerformanceAssignment[]
  loadingThis: boolean
  members: TeamMemberRow[]
  membersLoading: boolean
  canEditTeam: boolean
  canEditResults: boolean
  isMemberView: boolean
  selectedTeamId: string
  year: number
  month: number
  currentUserId: string | undefined
  onRefresh: () => void
  assignmentWindowOpen: boolean
  assignmentWindowBounds: { startDay: number; endDay: number }
  canMemberEditSelfResults: boolean
  planningReadOnly?: boolean
  templateCode?: string
  isManagerCascade?: boolean
  isTrafficTeam?: boolean
  goalApproved: boolean
  resultApprovalRequest?: ApprovalRequest | null
  isResultApprovalLocked?: boolean
  onSubmitResultApproval?: () => void | Promise<void>
  submittingResultApproval?: boolean
  canSubmitResultApproval?: boolean
  isKinhDoanhTeam?: boolean
  kinhDoanhResultsCloseOpen?: boolean
  kinhDoanhResultsCloseBounds?: { startDay: number; endDay: number }
  kinhDoanhResultsClosePhase?: 'before' | 'open' | 'after' | null
  onRecalculateSummaries?: () => Promise<void>
}) {
  const byUser = useMemo(() => groupAssignmentsByUser(assignmentsThisMonth), [assignmentsThisMonth])

  if (!selectedTeamId) {
    return (
      <Card className="border-dashed border-primary/25 bg-muted/20">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Chọn nhóm để xem báo cáo công việc.
        </CardContent>
      </Card>
    )
  }
  if (loadingThis || membersLoading) {
    return (
      <Card className={cn(CARD_ENTRANCE)}>
        <CardHeader>
          <CardTitle className="text-xl">Đang tải dữ liệu KPI/OKR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-10/12" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-12">
      <PlanningSection
        byUser={byUser}
        members={members}
        canEditTeam={canEditTeam}
        onRefresh={onRefresh}
        currentUserId={currentUserId}
        isMemberView={isMemberView}
        selectedTeamId={selectedTeamId}
        year={year}
        month={month}
        assignmentWindowOpen={assignmentWindowOpen}
        planningReadOnly={planningReadOnly}
        memberSelfEditableResults={canMemberEditSelfResults}
        templateCode={templateCode}
        isManagerCascade={isManagerCascade}
      />

      <ResultsSection
        byUser={byUser}
        members={members}
        canEditResults={canEditResults}
        onRefresh={onRefresh}
        currentUserId={currentUserId}
        isMemberView={isMemberView}
        year={year}
        month={month}
        memberSelfEditableResults={canMemberEditSelfResults}
        templateCode={templateCode}
        isManagerCascade={isManagerCascade}
        isTrafficTeam={isTrafficTeam}
        resultApprovalRequest={resultApprovalRequest}
        isResultApprovalLocked={isResultApprovalLocked}
        goalApproved={goalApproved}
        onSubmitResultApproval={onSubmitResultApproval}
        submittingResultApproval={submittingResultApproval}
        canSubmitResultApproval={canSubmitResultApproval}
        isKinhDoanhTeam={isKinhDoanhTeam}
        kinhDoanhResultsCloseOpen={kinhDoanhResultsCloseOpen}
        kinhDoanhResultsCloseBounds={kinhDoanhResultsCloseBounds}
        kinhDoanhResultsClosePhase={kinhDoanhResultsClosePhase}
        onRecalculateSummaries={onRecalculateSummaries}
      />
    </div>
  )
}

/** Leader KPI/OKR của team — khớp `role === LEADER` từ `GET .../teams/:id/members`. */
function reviewerDefaultFromTeamLeader(members: TeamMemberRow[]): string {
  const leader = members.find((m) => m.role === 'LEADER')
  if (!leader) return ''
  return leader.displayName?.trim() || leader.email?.trim() || ''
}

function miniCreateEmptyLine(): {
  kind: 'KPI' | 'OKR'
  priority: number
  content: string
  targetMetric: string
  subItems: SubItemDraft[]
} {
  return { kind: 'KPI', priority: 1, content: '', targetMetric: '', subItems: [] }
}

/** Dialog đơn giản cho manager thêm chỉ số cho toàn team (cascade). */
function ManagerCascadeAddForm({
  teamId,
  year,
  month,
  onCreated,
}: {
  teamId: string
  year: number
  month: number
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<{
    kind: 'KPI' | 'OKR'
    priority: number
    content: string
    targetMetric: string
  }>({ defaultValues: { kind: 'KPI', priority: 2, content: '', targetMetric: '' } })

  const onSubmit = handleSubmit(async (values) => {
    if (!values.content.trim()) {
      toast.error('Nội dung không được trống.')
      return
    }
    try {
      const result = await performanceApi.cascadeAddAssignment(teamId, {
        year,
        month,
        kind: values.kind,
        priority: values.priority,
        content: values.content.trim(),
        targetMetric: values.targetMetric.trim() || null,
      })
      toast.success(`Đã thêm chỉ số cho ${result.created} thành viên.`)
      reset()
      setOpen(false)
      onCreated()
    } catch {
      toast.error('Không thêm được. Vui lòng thử lại.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="rounded-lg px-4 font-semibold transition-all ">
          Thêm chỉ số cho team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm chỉ số mới cho toàn team</DialogTitle>
          <DialogDescription>
            Chỉ số sẽ được tạo cho tất cả thành viên active trong team.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Loại</Label>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { label: 'KPI', value: 'KPI' },
                      { label: 'OKR', value: 'OKR' },
                    ]}
                  />
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ưu tiên</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    value={String(field.value)}
                    onValueChange={(val) => field.onChange(Number(val))}
                    options={[
                      { label: 'P1 — Cao', value: '1' },
                      { label: 'P2 — Trung bình', value: '2' },
                      { label: 'P3 — Thấp', value: '3' },
                    ]}
                  />
                )}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nội dung *</Label>
            <Input
              {...register('content')}
              placeholder="Tên chỉ số / mục tiêu"
              className="h-9 rounded-lg border-slate-200"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Chỉ tiêu</Label>
            <Input
              {...register('targetMetric')}
              placeholder="VD: 100,000,000 VND / tháng"
              className="h-9 rounded-lg border-slate-200"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Đang thêm…' : 'Thêm cho toàn team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MiniCreateForm({
  teamId,
  year,
  month,
  members,
  defaultAssigneeId,
  onCreated,
}: {
  teamId: string
  year: number
  month: number
  members: TeamMemberRow[]
  defaultAssigneeId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<null | {
    fileLabel: string
    items: ImportAssignmentItem[]
    errors: { row: number; message: string }[]
  }>(null)
  const [importSubmitting, setImportSubmitting] = useState(false)

  type MiniCreateValues = {
    assigneeUserIds: string[]
    reviewerName: string
    lines: Array<{
      kind: 'KPI' | 'OKR'
      priority: number
      content: string
      targetMetric: string
      subItems: SubItemDraft[]
    }>
  }
  const [expandedLineIndexes, setExpandedLineIndexes] = useState<Record<number, boolean>>({})
  const fallbackAssigneeId = useMemo(() => {
    if (defaultAssigneeId && members.some((m) => m.userId === defaultAssigneeId))
      return defaultAssigneeId
    return members[0]?.userId ?? ''
  }, [members, defaultAssigneeId])
  const form = useForm<MiniCreateValues>({
    defaultValues: {
      assigneeUserIds: fallbackAssigneeId ? [fallbackAssigneeId] : [],
      reviewerName: '',
      lines: [miniCreateEmptyLine()],
    },
    mode: 'onChange',
  })
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { isSubmitting },
  } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const assigneeIdsWatched = useWatch({ control, name: 'assigneeUserIds' })
  const selectedAssigneeCount = Array.isArray(assigneeIdsWatched) ? assigneeIdsWatched.length : 0
  const lineCount = fields.length
  const totalCreates = lineCount * selectedAssigneeCount

  useEffect(() => {
    if (!open) return
    const label = reviewerDefaultFromTeamLeader(members)
    if (!label || getValues('reviewerName').trim()) return
    setValue('reviewerName', label, { shouldValidate: false, shouldDirty: false })
  }, [open, members, getValues, setValue])

  useEffect(() => {
    setValue('assigneeUserIds', fallbackAssigneeId ? [fallbackAssigneeId] : [], {
      shouldValidate: true,
    })
  }, [fallbackAssigneeId, setValue])

  useEffect(() => {
    if (!open) setImportPreview(null)
  }, [open])

  const onImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !members.length) return
    try {
      const { items, errors } = await parseKpiOkrImportFile(f, members)
      setImportPreview({ fileLabel: f.name, items, errors })
      if (items.length === 0 && errors.length > 0) {
        toast.error('Không có dòng hợp lệ. Kiểm tra file và tên nhân sự trong team.')
      } else if (errors.length > 0) {
        toast.message(`Đã đọc ${items.length} dòng; bỏ qua ${errors.length} dòng lỗi.`)
      } else if (items.length > 0) {
        toast.success(`Đã đọc ${items.length} dòng từ file.`)
      }
    } catch {
      toast.error('Không đọc được file. Chỉ hỗ trợ .xlsx, .xls, .csv.')
    }
  }

  const submitImportFromFile = async () => {
    if (!importPreview?.items.length || isMockApiEnabled()) return
    setImportSubmitting(true)
    try {
      await performanceApi.importAssignments(teamId, {
        year,
        month,
        items: importPreview.items,
      })
      toast.success(`Đã tạo ${importPreview.items.length} mục từ file.`)
      setImportPreview(null)
      setOpen(false)
      onCreated()
    } catch {
      toast.error('Import thất bại (kiểm tra giới hạn KPI/OKR mỗi người hoặc quyền).')
    } finally {
      setImportSubmitting(false)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!values.lines.length) {
      toast.error('Thêm ít nhất một dòng mục tiêu.')
      return
    }
    for (let i = 0; i < values.lines.length; i++) {
      const line = values.lines[i]!
      if (!line.content.trim()) {
        toast.error(`Dòng ${i + 1}: Nội dung KPI/OKR không được trống.`)
        return
      }
      if (line.content.trim().length > 500) {
        toast.error(`Dòng ${i + 1}: Nội dung tối đa 500 ký tự.`)
        return
      }
    }

    const nAssign = values.assigneeUserIds.length
    const nLines = values.lines.length
    if (nLines * nAssign > 300) {
      toast.error('Tối đa 300 bản ghi mỗi lần (số dòng × số nhân sự).')
      return
    }

    const linesPayload = values.lines.map((line) => ({
      kind: line.kind,
      priority: Number(line.priority),
      content: line.content.trim(),
      targetMetric: line.targetMetric.trim() ? line.targetMetric.trim() : null,
      subItems: mapSubItemsToPayload(line.subItems),
    }))

    try {
      const created = await performanceApi.createAssignmentsBatchMulti(teamId, {
        assigneeUserIds: values.assigneeUserIds,
        year,
        month,
        reviewerName: values.reviewerName.trim() || null,
        lines: linesPayload,
      })
      const n = created.length
      toast.success(
        n === 1 ? 'Đã tạo mục tiêu.' : `Đã tạo ${n} mục tiêu (${nLines} dòng × ${nAssign} nhân sự).`
      )
      reset({
        assigneeUserIds: fallbackAssigneeId ? [fallbackAssigneeId] : [],
        reviewerName: '',
        lines: [miniCreateEmptyLine()],
      })
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(getApiErrorMessage(err) || 'Không tạo được mục tiêu. Vui lòng thử lại.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="rounded-lg bg-primary px-4 font-semibold shadow-sm transition-all hover:bg-primary/90"
        >
          Thêm mục tiêu KPI/OKR
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-[min(960px,95vw)] flex-col gap-0 overflow-hidden rounded-2xl p-0">
        {/* ── Header row 1: title + subtitle (X close button auto-positioned by DialogContent at right-4 top-4) ── */}
        <div className="shrink-0 px-6 pb-0 pt-5 pr-14">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Tạo hạng mục KPI/OKR
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Kỳ T{month}/{year} · Mỗi dòng áp dụng cho tất cả nhân sự đã chọn
          </p>
        </div>

        {/* ── Header row 2: import action bar ── */}
        <div className="shrink-0 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={onImportFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg px-4 text-sm font-medium"
              disabled={!members.length || isMockApiEnabled()}
              onClick={() => importFileRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              Import Excel
            </Button>
            <a
              href={`${import.meta.env.BASE_URL}templates/kpi-okr-import-mau.xlsx`}
              download
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="h-4 w-4" />
              Tải file mẫu
            </a>
            <span className="text-xs text-slate-400">(.xlsx / .csv)</span>
          </div>

          {/* Import preview */}
          {importPreview && (
            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-800 dark:bg-blue-950/30">
              <span>
                <span className="font-semibold">{importPreview.fileLabel}</span>
                {' — '}
                <span className="tabular-nums font-bold text-blue-700 dark:text-blue-400">
                  {importPreview.items.length}
                </span>{' '}
                dòng hợp lệ
                {importPreview.errors.length > 0 && (
                  <span className="text-amber-600"> · {importPreview.errors.length} lỗi</span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 rounded-lg text-xs font-bold"
                disabled={!importPreview.items.length || importSubmitting || isMockApiEnabled()}
                onClick={() => void submitImportFromFile()}
              >
                {importSubmitting ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : null}
                {importSubmitting ? 'Đang import…' : `Tạo ${importPreview.items.length} mục`}
              </Button>
            </div>
          )}
        </div>

        <Form {...form}>
          <form className="flex flex-1 flex-col overflow-hidden" onSubmit={onSubmit}>
            {/* ── Body: scrollable form area ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Assignees — compact horizontal checkboxes */}
              <FormField
                control={control}
                name="assigneeUserIds"
                rules={{
                  validate: (v) => (Array.isArray(v) && v.length > 0) || 'Chọn ít nhất một nhân sự',
                }}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500 m-0">
                        Nhân sự nhận việc <span className="text-destructive">*</span>
                      </FormLabel>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => field.onChange(members.map((m) => m.userId))}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Tất cả
                        </button>
                        <span className="text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => field.onChange([])}
                          className="text-xs font-medium text-slate-500 hover:underline"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>
                    <FormControl>
                      <div className="flex flex-wrap gap-1.5">
                        {members.map((m) => {
                          const checked = field.value.includes(m.userId)
                          return (
                            <button
                              key={m.userId}
                              type="button"
                              onClick={() => {
                                if (checked)
                                  field.onChange(field.value.filter((id) => id !== m.userId))
                                else field.onChange([...field.value, m.userId])
                              }}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                                checked
                                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600'
                              )}
                            >
                              {checked && <CheckCircle2 className="h-3 w-3" />}
                              {(m.displayName ?? m.email ?? '?').slice(0, 32)}
                            </button>
                          )
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reviewer — compact read-only */}
              <InputController
                control={control}
                name="reviewerName"
                label="Người đánh giá"
                className="max-w-sm space-y-1"
                labelClassName="text-xs font-bold uppercase tracking-wider text-slate-500"
                inputClassName="h-9 rounded-lg border-slate-200 bg-slate-50 text-sm cursor-default dark:border-slate-700 dark:bg-slate-800"
                readOnly
              />

              {/* ── Goals table — Airtable-style inline editing ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Danh sách mục tiêu
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 rounded-lg text-xs"
                    onClick={() => append(miniCreateEmptyLine())}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm dòng
                  </Button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 dark:bg-slate-800/50">
                        <th className="w-10 px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          #
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Hạng mục
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Ưu tiên
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Chỉ tiêu
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          Nội dung
                        </th>
                        <th className="w-10 px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((fieldRow, index) => (
                        <Fragment key={fieldRow.id}>
                          <tr
                            key={fieldRow.id}
                            className="border-b last:border-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <td className="px-3 py-2 text-xs font-medium text-slate-400 tabular-nums">
                              {index + 1}
                            </td>
                            <td className="px-2 py-2">
                              <SelectController
                                control={control}
                                name={`lines.${index}.kind`}
                                label=""
                                required
                                rules={{ required: true }}
                              >
                                <SelectItem value="KPI">KPI</SelectItem>
                                <SelectItem value="OKR">OKR</SelectItem>
                              </SelectController>
                            </td>
                            <td className="px-2 py-2">
                              <SelectController
                                control={control}
                                name={`lines.${index}.priority`}
                                label=""
                                required
                                rules={{ required: true, min: 0, max: 99 }}
                              >
                                <SelectItem value="1">P1 - Cao</SelectItem>
                                <SelectItem value="2">P2 - TB</SelectItem>
                                <SelectItem value="3">P3 - Thấp</SelectItem>
                              </SelectController>
                            </td>
                            <td className="px-2 py-2">
                              <InputController
                                control={control}
                                name={`lines.${index}.targetMetric`}
                                label=""
                                inputClassName="h-9 w-[80px] rounded-lg border-slate-200 text-sm tabular-nums dark:border-slate-700"
                                placeholder="60"
                              />
                            </td>
                            <td className="px-2 py-2 min-w-[220px]">
                              <TextareaController
                                control={control}
                                name={`lines.${index}.content`}
                                label=""
                                required
                                rules={{ required: true, maxLength: 500 }}
                                maxLength={500}
                                textareaClassName="min-h-[36px] resize-none rounded-lg border-slate-200 p-2 text-sm dark:border-slate-700 w-full"
                                placeholder="Mô tả mục tiêu..."
                              />
                            </td>
                            <td className="px-1 py-2">
                              {fields.length > 1 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-lg text-slate-400 hover:text-destructive"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Xóa dòng này
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </td>
                          </tr>
                          <tr
                            key={`${fieldRow.id}-sub`}
                            className="border-b bg-slate-50/30 dark:bg-slate-900/20"
                          >
                            <td colSpan={6} className="px-3 py-2">
                              <SubItemsEditorPanel
                                control={control}
                                namePrefix={`lines.${index}.subItems`}
                                expanded={Boolean(expandedLineIndexes[index])}
                                onToggle={() =>
                                  setExpandedLineIndexes((prev) => ({
                                    ...prev,
                                    [index]: !prev[index],
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  {fields.length} dòng × {selectedAssigneeCount} nhân sự ={' '}
                  <strong className="text-slate-600 dark:text-slate-300">{totalCreates}</strong> mục
                  tiêu
                </p>
              </div>
            </div>

            {/* ── Footer: actions ── */}
            <div className="shrink-0 flex items-center justify-between border-t border-slate-200 px-6 py-3 dark:border-slate-800">
              <p className="text-xs text-slate-400">Tối đa 300 bản ghi mỗi lần</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="h-9 rounded-lg text-sm"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !members.length}
                  className="h-9 gap-1.5 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {isSubmitting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {isSubmitting
                    ? 'Đang tạo...'
                    : totalCreates > 1
                      ? `Tạo ${totalCreates} mục tiêu`
                      : 'Tạo mục tiêu'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function SummaryPanel({
  rows,
  loading,
  teamId,
  year,
  month,
  canRecalculate,
  onRecalculated,
  prioritizeAssigneeUserId,
  viewerVariant,
}: {
  rows: PerformanceSummaryRow[]
  loading: boolean
  teamId: string
  year: number
  month: number
  canRecalculate: boolean
  onRecalculated: () => void
  /** Leader: đưa dòng user này lên đầu. Member: chỉ hiển thị dòng của user này. */
  prioritizeAssigneeUserId?: string
  viewerVariant: 'leader' | 'member' | 'manager'
}) {
  const [recalcBusy, setRecalcBusy] = useState(false)
  const displayRows = useMemo(() => {
    const selfId = prioritizeAssigneeUserId?.trim()
    if (viewerVariant === 'member') {
      if (!selfId) return [] as PerformanceSummaryRow[]
      return rows.filter((r) => r.assigneeUserId === selfId)
    }
    if (!selfId) return rows
    const i = rows.findIndex((r) => r.assigneeUserId === selfId)
    if (i <= 0) return rows
    const next = [...rows]
    const [mine] = next.splice(i, 1)
    return mine ? [mine, ...next] : rows
  }, [rows, viewerVariant, prioritizeAssigneeUserId])

  const emptyBlurb = useMemo(() => {
    if (viewerVariant !== 'member') {
      return `Chưa có bản tổng hợp cho kỳ T${month}/${year} — nhập kết quả & đánh giá rồi bấm tính lại (leader).`
    }
    if (!prioritizeAssigneeUserId?.trim()) {
      return 'Không thể hiển thị tổng hợp cá nhân (thiếu thông tin tài khoản).'
    }
    if (rows.length > 0) {
      return `Chưa có bản tổng hợp cho bạn trong kỳ T${month}/${year}. Khi leader đã tính lại tổng hợp, dòng của bạn sẽ hiển thị tại đây.`
    }
    return `Chưa có bản tổng hợp cho kỳ T${month}/${year}.`
  }, [viewerVariant, rows.length, prioritizeAssigneeUserId, month, year])

  const rowName = useCallback(
    (r: PerformanceSummaryRow) =>
      r.assigneeDisplayName?.trim() || r.assigneeEmail?.trim() || 'Thành viên',
    []
  )

  if (loading) {
    return (
      <Card id="summary-section" className={cn('scroll-mt-24', CARD_ENTRANCE)}>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl font-bold text-amber-700">
            Tổng chỉ số hiệu suất — T{month}/{year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (displayRows.length === 0) {
    return (
      <Card
        id="summary-section"
        className={cn(
          'scroll-mt-24 overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800/50 dark:bg-slate-950/50',
          CARD_ENTRANCE
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div>
            <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Tổng chỉ số hiệu suất — T{month}/{year}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Bảng tổng hợp kết quả KPI/OKR của các thành viên.
            </p>
          </div>
          {canRecalculate && teamId && !isMockApiEnabled() && (
            <Button
              type="button"
              disabled={recalcBusy}
              variant="outline"
              className="h-9 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              onClick={() => {
                setRecalcBusy(true)
                void performanceApi
                  .recalculateSummaries(teamId, year, month)
                  .then(() => onRecalculated())
                  .finally(() => setRecalcBusy(false))
              }}
            >
              {recalcBusy ? 'Đang tính...' : 'Tính lại tổng hợp'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
            <p className="text-sm text-slate-400 text-center">{emptyBlurb}</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card
      id="summary-section"
      className={cn(
        'scroll-mt-24 overflow-hidden border-slate-200/60 shadow-sm dark:border-slate-800/50 dark:bg-slate-950/50',
        CARD_ENTRANCE
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div>
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tổng chỉ số hiệu suất — T{month}/{year}
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Bảng tổng hợp kết quả KPI/OKR của các thành viên.
          </p>
        </div>
        {canRecalculate && teamId && !isMockApiEnabled() && (
          <Button
            type="button"
            disabled={recalcBusy}
            variant="outline"
            className="h-9 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            onClick={() => {
              setRecalcBusy(true)
              void performanceApi
                .recalculateSummaries(teamId, year, month)
                .then(() => onRecalculated())
                .finally(() => setRecalcBusy(false))
            }}
          >
            {recalcBusy ? 'Đang tính...' : 'Tính lại tổng hợp'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {displayRows.map((r) => (
            <div key={r.id} className="space-y-3 py-4 first:pt-0">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">{rowName(r)}</div>
                <div className="text-xs text-slate-500">
                  {r.assigneeEmployeeCode?.trim() || r.assigneeEmail?.trim() || '—'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-amber-100/80 bg-amber-50/25 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                <div>
                  <p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                    KPI đạt
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {r.kpiOkCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                    KPI chưa
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {r.kpiNotCount}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">
                    Xếp loại KPI
                  </p>
                  <span className="mt-1 inline-flex h-6 items-center rounded-md bg-amber-100 px-2 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {r.kpiGrade || '—'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-blue-100/80 bg-blue-50/25 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
                <div>
                  <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300">
                    OKR đạt
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {r.okrOkCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300">
                    OKR chưa
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {r.okrNotCount}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300">
                    Xếp loại OKR
                  </p>
                  <span className="mt-1 inline-flex h-6 items-center rounded-md bg-blue-100 px-2 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {r.okrGrade || '—'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                <TableHead className="w-[200px] text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nhân sự
                </TableHead>
                <TableHead
                  className="bg-amber-50/50 text-center text-xs font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/10"
                  colSpan={3}
                >
                  KPI
                </TableHead>
                <TableHead
                  className="bg-blue-50/50 text-center text-xs font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/10"
                  colSpan={3}
                >
                  OKR
                </TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                <TableHead />
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Đạt
                </TableHead>
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Chưa
                </TableHead>
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Xếp loại
                </TableHead>
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Đạt
                </TableHead>
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Chưa
                </TableHead>
                <TableHead className="text-center text-xs font-bold uppercase text-slate-400">
                  Xếp loại
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((r) => (
                <TableRow
                  key={r.id}
                  className="group border-b-slate-50 transition-colors hover:bg-slate-50/50 dark:border-b-slate-900 dark:hover:bg-slate-900/50"
                >
                  <TableCell className="py-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{rowName(r)}</div>
                    <div className="text-xs text-slate-500">
                      {r.assigneeEmployeeCode?.trim() || r.assigneeEmail?.trim() || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="bg-amber-50/20 text-center tabular-nums text-slate-700 dark:bg-amber-900/5 dark:text-slate-300">
                    {r.kpiOkCount}
                  </TableCell>
                  <TableCell className="bg-amber-50/20 text-center tabular-nums text-slate-700 dark:bg-amber-900/5 dark:text-slate-300">
                    {r.kpiNotCount}
                  </TableCell>
                  <TableCell className="bg-amber-50/20 text-center dark:bg-amber-900/5">
                    <span className="inline-flex h-6 items-center rounded-md bg-amber-100 px-2 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {r.kpiGrade || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="bg-blue-50/20 text-center tabular-nums text-slate-700 dark:bg-blue-900/5 dark:text-slate-300">
                    {r.okrOkCount}
                  </TableCell>
                  <TableCell className="bg-blue-50/20 text-center tabular-nums text-slate-700 dark:bg-blue-900/5 dark:text-slate-300">
                    {r.okrNotCount}
                  </TableCell>
                  <TableCell className="bg-blue-50/20 text-center dark:bg-blue-900/5">
                    <span className="inline-flex h-6 items-center rounded-md bg-blue-100 px-2 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {r.okrGrade || '—'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function newSurveyQuestionRow(): { id: string; prompt: string } {
  return { id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, prompt: '' }
}

export function FormPanel({
  teamId,
  year,
  month,
  canEditTeam,
  currentUserId,
  readOnly = false,
  showResponses,
  showQuestionForm,
}: {
  teamId: string
  year: number
  month: number
  canEditTeam: boolean
  currentUserId: string
  readOnly?: boolean
  /** Nếu undefined: theo mặc định (hiện khi `canEditTeam` hoặc chế độ read-only của Leader/Manager).
   *  Nếu `false`: luôn ẩn cột "Phản hồi từ nhân sự" (Manager chỉ xem câu hỏi, không xem trả lời). */
  showResponses?: boolean
  /** Nếu false: ẩn cột câu hỏi/trả lời khảo sát bên trái, chỉ giữ phản hồi nhân sự. */
  showQuestionForm?: boolean
}) {
  const q = useQuery({
    queryKey: ['kpi-form', teamId, year, month],
    queryFn: () =>
      teamId ? performanceApi.getQuestionnaire(teamId, year, month) : Promise.resolve(null),
    enabled: Boolean(teamId) && !isMockApiEnabled(),
  })

  const data = q.data as PerformanceQuestionnaire | null

  const [questionDrafts, setQuestionDrafts] = useState<{ id: string; prompt: string }[]>([
    { id: 'init-a', prompt: 'Câu 1?' },
    { id: 'init-b', prompt: 'Câu 2?' },
  ])
  const [leaderQMode, setLeaderQMode] = useState<'upload' | 'compose'>('compose')
  const [rawBulk, setRawBulk] = useState('')
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({})
  const [busySaveQuestions, setBusySaveQuestions] = useState(false)
  const [busySaveAnswers, setBusySaveAnswers] = useState(false)
  const [isEditingAnswers, setIsEditingAnswers] = useState(false)
  const surveyFileInputRef = useRef<HTMLInputElement>(null)
  const isManagerViewOnly = readOnly
  const shouldShowResponses = showResponses ?? (canEditTeam || isManagerViewOnly)
  const shouldShowQuestionForm = showQuestionForm ?? true
  const windowOpen = useMemo(() => isAnswerWindowOpen(year, month), [year, month])

  const myAnswers = useMemo(
    () => data?.answers?.filter((a) => a.respondentUserId === currentUserId) ?? [],
    [data?.answers, currentUserId]
  )
  const hasExistingAnswer = myAnswers.length > 0
  const lastSubmittedAt = useMemo(() => {
    const iso = myAnswers
      .map((a) => a.updatedAt)
      .filter((x): x is string => Boolean(x))
      .sort()
      .pop()
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('vi-VN')
  }, [myAnswers])
  const answerInputDisabled =
    readOnly || !currentUserId || !windowOpen || (hasExistingAnswer && !isEditingAnswers)

  useEffect(() => {
    if (!data?.questions?.length) return
    const id = window.setTimeout(
      () => setQuestionDrafts(data.questions.map((item) => ({ id: item.id, prompt: item.prompt }))),
      0
    )
    return () => window.clearTimeout(id)
  }, [data?.id, data?.questions])

  useEffect(() => {
    if (!data?.questions?.length) return
    const next: Record<string, string> = {}
    for (const qs of data.questions) {
      const ans = data.answers?.find(
        (a) => a.questionId === qs.id && a.respondentUserId === currentUserId
      )
      next[qs.id] = ans?.answerText ?? ''
    }
    const id = window.setTimeout(() => setAnswerDraft(next), 0)
    return () => window.clearTimeout(id)
  }, [data, currentUserId])

  const answersByRespondent = useMemo(() => {
    const result = new Map<
      string,
      {
        respondentUserId: string
        respondentName: string
        answers: Record<string, string>
      }
    >()
    for (const item of data?.answers ?? []) {
      const name =
        item.respondentDisplayName?.trim() || item.respondentEmail?.trim() || 'Thành viên'
      const row = result.get(item.respondentUserId) ?? {
        respondentUserId: item.respondentUserId,
        respondentName: name,
        answers: {},
      }
      row.answers[item.questionId] = item.answerText ?? ''
      result.set(item.respondentUserId, row)
    }
    return Array.from(result.values()).sort((a, b) =>
      a.respondentName.localeCompare(b.respondentName)
    )
  }, [data?.answers])

  const validDraftCount = useMemo(
    () => questionDrafts.filter((q) => q.prompt.trim().length > 0).length,
    [questionDrafts]
  )

  const onUploadSurveyFile = (file: File) => {
    void (async () => {
      try {
        const lines = await parseQuestionnaireImportFile(file)
        if (lines.length === 0) {
          toast.error(
            'File không có câu hỏi hợp lệ. Với Excel dạng lưới, cần hàng tiêu đề có cột kiểu «TC1 - Câu hỏi 1: …»; hoặc dùng .txt/.md mỗi dòng một câu.'
          )
          return
        }
        setQuestionDrafts(
          lines.map((prompt, i) => ({
            id: `u-${i}-${Date.now()}`,
            prompt,
          }))
        )
        toast.success(`Đã đọc ${lines.length} câu từ file.`)
      } catch {
        toast.error('Không đọc được file. Thử định dạng .xlsx, .csv, .txt hoặc .md.')
      }
    })()
  }

  const parseRawBulk = () => {
    const lines = rawBulk
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    if (lines.length === 0) {
      toast.error('Nhập ít nhất một dòng câu hỏi.')
      return
    }
    setQuestionDrafts(
      lines.map((prompt, i) => ({
        id: `b-${i}-${Date.now()}`,
        prompt,
      }))
    )
    toast.success(`Đã tách ${lines.length} câu hỏi.`)
  }

  const addQuestionDraft = () => {
    setQuestionDrafts((prev) => [...prev, newSurveyQuestionRow()])
  }

  const removeQuestionDraft = (id: string) => {
    setQuestionDrafts((prev) => {
      const next = prev.filter((q) => q.id !== id)
      return next.length > 0 ? next : [newSurveyQuestionRow()]
    })
  }

  if (!teamId) return null
  if (q.isLoading) {
    return (
      <div id="form-section" className="scroll-mt-24 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div id="form-section" className="scroll-mt-24 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Form câu hỏi theo tháng
            </h2>
          </div>
          <p className="text-sm text-slate-500">Khảo sát và ghi nhận ý kiến phản hồi hàng tháng.</p>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-6',
          shouldShowQuestionForm && shouldShowResponses ? 'lg:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {shouldShowQuestionForm ? (
          <Card className="border-slate-200/60 shadow-sm dark:border-slate-800/50">
            <CardHeader className="pb-4">
              {/* <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {isManagerViewOnly ? 'Câu hỏi khảo sát' : 'Trả lời khảo sát'}
              </CardTitle> */}
            </CardHeader>
            <CardContent className="space-y-6">
              {!data && (
                <div className="flex h-32 flex-col items-center justify-center rounded-xl">
                  <p className="text-sm text-slate-400">
                    {isManagerViewOnly
                      ? 'Chưa có form câu hỏi cho kỳ này.'
                      : 'Chưa có form cho kỳ này (Quản lý chưa tạo câu hỏi).'}
                  </p>
                </div>
              )}

              {data?.questions?.length ? (
                <div className="space-y-5">
                  {!readOnly && !windowOpen && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-semibold">
                          Kỳ khảo sát T{month}/{year}{' '}
                          {(() => {
                            const now = new Date()
                            const start = new Date(year, month - 1, 1)
                            return now < start ? 'chưa mở' : 'đã đóng'
                          })()}
                          .
                        </div>
                        <div className="text-xs opacity-80">
                          Thời hạn trả lời: {formatAnswerWindow(year, month)}.
                        </div>
                      </div>
                    </div>
                  )}
                  {!readOnly && windowOpen && hasExistingAnswer && !isEditingAnswers && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-semibold">Bạn đã gửi câu trả lời cho kỳ này.</div>
                        <div className="text-xs opacity-80">
                          {lastSubmittedAt ? <>Lần cập nhật gần nhất: {lastSubmittedAt}. </> : null}
                          Bấm <b>Chỉnh sửa</b> nếu cần cập nhật, trước khi kỳ đóng lúc 05/
                          {String(month === 12 ? 1 : month + 1).padStart(2, '0')}/
                          {month === 12 ? year + 1 : year}.
                        </div>
                      </div>
                    </div>
                  )}
                  {data.questions.map((qs, i) => (
                    <div
                      key={qs.id}
                      className="rounded-xl border border-border bg-background p-4 shadow-sm dark:border-slate-800"
                    >
                      <div className="mb-3 flex gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary"
                          aria-hidden
                        >
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-foreground">Câu {i + 1}</p>
                            <Badge
                              variant="outline"
                              className="rounded-md px-2 py-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              Tự luận
                            </Badge>
                          </div>
                          <p className="text-sm font-medium leading-relaxed text-foreground">
                            {qs.prompt}
                          </p>
                        </div>
                      </div>
                      <textarea
                        className={cn(
                          'min-h-[100px] w-full rounded-lg border border-slate-200 bg-slate-50/30 p-3 text-sm transition-all focus:bg-white focus:ring-2 focus:ring-primary/10 outline-none dark:border-slate-800 dark:bg-slate-900/30 dark:focus:bg-slate-950',
                          answerInputDisabled && 'cursor-not-allowed opacity-70'
                        )}
                        placeholder="Nhập câu trả lời của bạn..."
                        value={answerDraft[qs.id] ?? ''}
                        onChange={(e) =>
                          setAnswerDraft((prev) => ({ ...prev, [qs.id]: e.target.value }))
                        }
                        disabled={answerInputDisabled}
                      />
                    </div>
                  ))}
                  {!isMockApiEnabled() && currentUserId && !readOnly && windowOpen && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {!hasExistingAnswer ? (
                        <Button
                          type="button"
                          disabled={busySaveAnswers}
                          className="w-full rounded-xl bg-primary font-bold shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5"
                          onClick={() => {
                            setBusySaveAnswers(true)
                            void performanceApi
                              .putAnswers(teamId, year, month, {
                                answers: data.questions.map((qs) => ({
                                  questionId: qs.id,
                                  answerText: answerDraft[qs.id] ?? '',
                                })),
                              })
                              .then(() => {
                                toast.success('Đã gửi câu trả lời thành công.')
                                setIsEditingAnswers(false)
                                q.refetch()
                              })
                              .catch((err) => {
                                const msg =
                                  err?.response?.data?.message ||
                                  'Không gửi được câu trả lời. Vui lòng thử lại.'
                                toast.error(msg)
                              })
                              .finally(() => setBusySaveAnswers(false))
                          }}
                        >
                          {busySaveAnswers ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          {busySaveAnswers ? 'Đang gửi...' : 'Gửi câu trả lời'}
                        </Button>
                      ) : !isEditingAnswers ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-xl border-primary/40 font-bold text-primary hover:bg-primary/5"
                          onClick={() => setIsEditingAnswers(true)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Chỉnh sửa câu trả lời
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            disabled={busySaveAnswers}
                            className="w-full rounded-xl bg-primary font-bold shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5"
                            onClick={() => {
                              setBusySaveAnswers(true)
                              void performanceApi
                                .putAnswers(teamId, year, month, {
                                  answers: data.questions.map((qs) => ({
                                    questionId: qs.id,
                                    answerText: answerDraft[qs.id] ?? '',
                                  })),
                                })
                                .then(() => {
                                  toast.success('Đã cập nhật câu trả lời.')
                                  setIsEditingAnswers(false)
                                  q.refetch()
                                })
                                .catch((err) => {
                                  const msg =
                                    err?.response?.data?.message ||
                                    'Không cập nhật được câu trả lời. Vui lòng thử lại.'
                                  toast.error(msg)
                                })
                                .finally(() => setBusySaveAnswers(false))
                            }}
                          >
                            {busySaveAnswers ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {busySaveAnswers ? 'Đang lưu...' : 'Lưu thay đổi'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busySaveAnswers}
                            className="w-full rounded-xl sm:w-auto"
                            onClick={() => {
                              const reset: Record<string, string> = {}
                              for (const qs of data.questions) {
                                const ans = myAnswers.find((a) => a.questionId === qs.id)
                                reset[qs.id] = ans?.answerText ?? ''
                              }
                              setAnswerDraft(reset)
                              setIsEditingAnswers(false)
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Huỷ
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Phần quản lý câu hỏi (dành cho Leader) */}
        {shouldShowResponses && (
          <div className="space-y-6">
            {canEditTeam && !isMockApiEnabled() && (
              <Card className="overflow-hidden border-border shadow-md dark:border-slate-800/50">
                <CardHeader className="space-y-4 border-b border-border/80 bg-gradient-to-br from-muted/40 via-background to-background pb-4 dark:from-slate-900/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                          <ClipboardList className="h-5 w-5 text-primary" strokeWidth={2} />
                        </span>
                        Soạn form khảo sát
                        <Badge
                          variant="outline"
                          className="ml-0 rounded-md font-mono text-xs font-semibold sm:ml-1"
                        >
                          T{month}/{year}
                        </Badge>
                      </CardTitle>
                      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                        Nhân sự sẽ trả lời tự luận giống bài thi ngắn. Chọn cách nhập bên dưới, kiểm
                        tra phần <span className="font-medium text-foreground">Xem trước</span>, rồi
                        lưu cho cả team.
                      </p>
                    </div>
                    <ol className="flex shrink-0 gap-1 rounded-xl border border-border/80 bg-background/80 p-1 text-xs font-semibold text-muted-foreground shadow-sm dark:bg-slate-950/60">
                      {(['Chọn nguồn', 'Xem trước', 'Lưu'] as const).map((label, i) => (
                        <li
                          key={label}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 sm:px-3"
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">
                            {i + 1}
                          </span>
                          <span className="hidden sm:inline">{label}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setLeaderQMode('upload')}
                      className={cn(
                        'flex w-full gap-3 rounded-xl border-2 p-4 text-left transition-all',
                        leaderQMode === 'upload'
                          ? 'border-primary bg-primary/8 shadow-sm ring-2 ring-primary/15 dark:bg-primary/10'
                          : 'border-border bg-card hover:border-primary/35 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                        <FileUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground">Import từ file</div>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          Excel lưới (cột «TC… — Câu hỏi…»), CSV, TXT…
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderQMode('compose')}
                      className={cn(
                        'flex w-full gap-3 rounded-xl border-2 p-4 text-left transition-all',
                        leaderQMode === 'compose'
                          ? 'border-primary bg-primary/8 shadow-sm ring-2 ring-primary/15 dark:bg-primary/10'
                          : 'border-border bg-card hover:border-primary/35 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                        <ListOrdered className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground">Soạn từng câu</div>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          Thêm, sửa, xóa từng ô — phù hợp ít câu hoặc chỉnh tay sau import.
                        </p>
                      </div>
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pt-5">
                  {leaderQMode === 'upload' ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 p-5 dark:border-primary/30 dark:bg-primary/10">
                        <p className="mb-3 text-sm font-bold text-foreground">
                          Bước 1 — Chọn file hoặc dán danh sách
                        </p>
                        <input
                          ref={surveyFileInputRef}
                          type="file"
                          accept=".txt,.md,.csv,.xlsx,.xls,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) onUploadSurveyFile(file)
                            e.target.value = ''
                          }}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Button
                            type="button"
                            variant="default"
                            className="h-11 w-full shrink-0 rounded-xl font-bold sm:w-auto"
                            onClick={() => surveyFileInputRef.current?.click()}
                          >
                            <FileUp className="mr-2 h-4 w-4" />
                            Chọn file (.xlsx, .csv, .txt…)
                          </Button>
                          <ul className="flex-1 space-y-1 text-xs text-muted-foreground">
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>
                                <strong className="text-foreground">Excel lưới:</strong> hàng đầu là
                                tiêu đề cột; hệ thống lấy các cột dạng «TC1 — Câu hỏi 1: …».
                              </span>
                            </li>
                            <li className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span>
                                <strong className="text-foreground">TXT / CSV dọc:</strong> mỗi dòng
                                không trống = một câu hỏi.
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/20 p-4 dark:bg-slate-900/40">
                        <Label
                          htmlFor="survey-bulk-paste"
                          className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground"
                        >
                          <AlignLeft className="h-4 w-4 text-muted-foreground" />
                          Hoặc dán nhanh (mỗi dòng một câu)
                        </Label>
                        <textarea
                          id="survey-bulk-paste"
                          className="min-h-[120px] w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/25"
                          placeholder={'Dòng 1: nội dung câu hỏi\nDòng 2: câu tiếp theo\n…'}
                          value={rawBulk}
                          onChange={(e) => setRawBulk(e.target.value)}
                        />
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg font-bold"
                            onClick={parseRawBulk}
                          >
                            Áp dụng vào danh sách
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-foreground">Danh sách câu hỏi</p>
                      <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/15 p-3 dark:bg-slate-900/35">
                        {questionDrafts.map((row, qIdx) => (
                          <div
                            key={row.id}
                            className="rounded-xl border border-border bg-background p-3 shadow-sm"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                                  {qIdx + 1}
                                </span>
                                <p className="text-sm font-bold text-foreground">Câu {qIdx + 1}</p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto gap-1 rounded-md px-2 py-1 text-xs font-normal normal-case tracking-normal text-muted-foreground"
                                onClick={() => removeQuestionDraft(row.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa
                              </Button>
                            </div>
                            <Input
                              value={row.prompt}
                              onChange={(e) =>
                                setQuestionDrafts((prev) =>
                                  prev.map((x) =>
                                    x.id === row.id ? { ...x, prompt: e.target.value } : x
                                  )
                                )
                              }
                              placeholder="Nhập nội dung câu hỏi…"
                              className="mb-2 w-full rounded-lg text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                            />
                            <p className="text-xs text-muted-foreground">
                              Trả lời dạng văn bản — bắt buộc khi nhân sự gửi khảo sát.
                            </p>
                          </div>
                        ))}
                        <div className="flex justify-end pt-1">
                          <Button type="button" variant="outline" onClick={addQuestionDraft}>
                            <ListPlus className="mr-2 h-4 w-4" />
                            Thêm câu hỏi
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      'rounded-2xl border-2 p-4 transition-colors',
                      validDraftCount > 0
                        ? 'border-emerald-200/90 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/25'
                        : 'border-border bg-muted/15 dark:bg-slate-900/30'
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-bold text-foreground">Xem trước</span>
                        <Badge
                          variant="outline"
                          className="rounded-md font-mono text-xs tabular-nums font-bold"
                        >
                          {validDraftCount} câu
                        </Badge>
                      </div>
                      {validDraftCount > 0 ? (
                        <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          Đúng thứ tự này sẽ hiện cho nhân sự
                        </span>
                      ) : null}
                    </div>
                    <div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-border/60 bg-background/80 p-2 dark:bg-slate-950/50">
                      {validDraftCount === 0 ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                          Chưa có câu hợp lệ. Hãy import file, dán danh sách, hoặc chuyển sang{' '}
                          <strong className="text-foreground">Soạn từng câu</strong>.
                        </p>
                      ) : (
                        questionDrafts
                          .filter((q) => q.prompt.trim().length > 0)
                          .map((q, idx) => (
                            <div
                              key={`${q.id}-prev`}
                              className="rounded-lg border border-border/80 bg-card px-3 py-2.5"
                            >
                              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                Câu {idx + 1}
                              </p>
                              <p
                                className="mt-1 line-clamp-3 text-sm font-medium leading-snug text-foreground"
                                title={q.prompt.trim()}
                              >
                                {q.prompt.trim()}
                              </p>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      disabled={busySaveQuestions}
                      className="h-12 w-full rounded-xl text-base font-bold shadow-md shadow-primary/15"
                      onClick={() => {
                        const lines = questionDrafts
                          .map((s) => s.prompt.trim())
                          .filter(Boolean)
                          .map((prompt, i) => ({ prompt, sortOrder: i + 1 }))
                        if (lines.length === 0) {
                          toast.error('Cần ít nhất một câu hỏi có nội dung.')
                          return
                        }
                        setBusySaveQuestions(true)
                        void performanceApi
                          .upsertQuestionnaire(teamId, { year, month, questions: lines })
                          .then(() => {
                            toast.success('Đã cập nhật bộ câu hỏi.')
                            q.refetch()
                          })
                          .finally(() => setBusySaveQuestions(false))
                      }}
                    >
                      {busySaveQuestions ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Đang lưu…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Lưu bộ câu hỏi cho kỳ T{month}/{year}
                        </>
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Sau khi lưu, nhân sự thấy form cập nhật ở cột «Trả lời khảo sát» bên trái.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200/60 shadow-sm dark:border-slate-800/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Phản hồi từ nhân sự
                </CardTitle>
              </CardHeader>
              <CardContent>
                {answersByRespondent.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                    <p className="text-sm text-slate-400 text-center">
                      Chưa có nhân sự nào trả lời khảo sát.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-auto pr-1">
                    {answersByRespondent.map((entry) => (
                      <div
                        key={entry.respondentUserId}
                        className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {entry.respondentName}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {data?.questions?.map((qs) => (
                            <div
                              key={qs.id}
                              className="rounded-lg bg-slate-50/80 p-3 dark:bg-slate-800/40"
                            >
                              <div className="text-xs font-bold text-slate-400 uppercase">
                                {qs.prompt}
                              </div>
                              <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {entry.answers[qs.id]?.trim() || '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
