import { apiClient } from '@/lib/axios'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { useAuthStore } from '@/stores/auth.store'

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected'

export type ApprovalRequestType = 'goal' | 'result'

export type ApprovalRequest = {
  id: string
  teamId: string
  teamName?: string
  year: number
  month: number
  type: ApprovalRequestType
  status: ApprovalRequestStatus
  submittedByUserId: string
  approvedByUserId: string | null
  note: string | null
  submittedAt: string
  resolvedAt: string | null
}

export type PerformanceKind = 'KPI' | 'OKR'
export type PerformanceStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'
export type PerformanceGradeLetter = 'A' | 'B' | 'C'
export type GoalReviewStatus =
  | 'pending'
  | 'approved'
  | 'edit_pending_member'
  | 'edit_confirmed'
  | 'manager_created_pending_member'
  | 'manager_created_confirmed'
  | 'rejected'

export type GoalReviewSubItemSnapshot = {
  label: string
  targetMetric: string | null
  numericUnit: string | null
  weight: number
}

export type AssignmentGoalReview = {
  id: string
  requestId: string
  assignmentId: string
  status: GoalReviewStatus | string
  originalContent: string
  originalTargetMetric: string | null
  originalPriority: number
  proposedContent: string | null
  proposedTargetMetric: string | null
  proposedPriority: number | null
  originalSubItems?: GoalReviewSubItemSnapshot[] | null
  proposedSubItems?: GoalReviewSubItemSnapshot[] | null
  reason: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  confirmedByUserId: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CatalogDivisionAllowlistResponse = {
  envDivisionIds: string[]
  databaseDivisionIds: string[]
  mergedDivisionIds: string[]
  trafficTeamIds: string[]
  kpiApprovalTeamIds: string[]
  catalogSeedTeamIds: string[]
}

export type PerformanceAssignment = {
  id: string
  teamId: string
  assigneeUserId: string
  year: number
  month: number
  kind: PerformanceKind
  priority: number
  content: string
  targetMetric: string | null
  progressPercent: number
  status: PerformanceStatus
  kpiSetAt: string | null
  actualResult?: string | null
  reviewerName?: string | null
  managerEvalStatus?: string | null
  managerReviewNote?: string | null
  assigneeDisplayName?: string | null
  assigneeEmail?: string | null
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
  // Epic 1: Evidence + Số liệu + Tự đánh giá
  evidence?: string | null
  numericValue?: number | null
  numericUnit?: string | null
  selfEvalStatus?: string | null
  selfReviewNote?: string | null
  selfEvaluatedAt?: string | null
  finalEvalStatus?: string | null
  finalEvaluatedAt?: string | null
  // Epic 9: Catalog hooks
  category?: string | null
  tenureStage?: string | null
  dailyTarget?: string | null
  templateItemId?: string | null
  periodTemplateItemId?: string | null
  goalReview?: AssignmentGoalReview | null
  subItems?: PerformanceAssignmentSubItem[]
}

export type PerformanceAssignmentSubItem = {
  id: string
  sortOrder: number
  label: string
  targetMetric: string | null
  numericUnit: string | null
  weight: number
  numericValue: number | null
  selfEvalStatus: string | null
  selfReviewNote: string | null
  selfEvaluatedAt?: string | null
}

export type SubItemInputPayload = {
  id?: string
  label: string
  targetMetric?: string | null
  numericUnit?: string | null
  weight?: number
  numericValue?: number | null
  selfEvalStatus?: string | null
  selfReviewNote?: string | null
}

export type PerformanceSummaryRow = {
  id: string
  teamId: string
  assigneeUserId: string
  assigneeDisplayName?: string | null
  assigneeEmail?: string | null
  assigneeEmployeeCode?: string | null
  year: number
  month: number
  kpiOkCount: number
  kpiNotCount: number
  okrOkCount: number
  okrNotCount: number
  kpiRate: number
  okrRate: number
  kpiGrade: PerformanceGradeLetter | null
  okrGrade: PerformanceGradeLetter | null
  updatedAt: string
}

export type PerformanceQuestionnaire = {
  id: string
  questions: { id: string; prompt: string; sortOrder: number }[]
  /** BE có thể trả thiếu khi chưa có câu trả lời hoặc bản response cũ. */
  answers?: {
    questionId: string
    respondentUserId: string
    answerText: string
    updatedAt?: string
    respondentDisplayName?: string | null
    respondentEmail?: string | null
    respondentEmployeeCode?: string | null
  }[]
}

export type ManagerMetricSummary = {
  content: string
  kind: PerformanceKind
  priority: number
  targetMetric: string | null
  numericUnit: string | null
  teamIds: string[]
  isMandatory: boolean
  isRanking: boolean
  honorType: string | null
}

export type VinhDanhConfigSummary = {
  content: string
  kind: PerformanceKind
  priority: number
  targetMetric: string | null
  numericUnit: string | null
  teamIds: string[]
  effectiveFromYear: number
  effectiveFromMonth: number
}

export type VinhDanhHonorIndividual = {
  user: { id: string; displayName: string | null; email: string | null; avatarUrl: string | null }
  teamName: string
  numericValue: number
  numericUnit: string
}

export type VinhDanhHonorTeam = {
  team: { id: string; name: string }
  totalValue: number
  numericUnit: string
  memberCount: number
}

export type VinhDanhHonorEntry = {
  content: string
  topIndividual: VinhDanhHonorIndividual | null
  topTeam: VinhDanhHonorTeam | null
}

export type VinhDanhHonorBoardResponse = {
  year: number
  month: number
  entries: VinhDanhHonorEntry[]
}

export const performanceApi = {
  listAssignments: async (teamId: string, year: number, month: number) => {
    if (isMockApiEnabled()) return [] as PerformanceAssignment[]
    const res = await apiClient.get<PerformanceAssignment[]>(
      `/performance/teams/${teamId}/assignments`,
      { params: { year, month } }
    )
    return res.data
  },

  listAssignmentsMultiTeam: async (teamIds: string[], year: number, month: number) => {
    if (isMockApiEnabled()) return [] as PerformanceAssignment[]
    const res = await apiClient.get<PerformanceAssignment[]>(
      `/performance/assignments/multi-team`,
      { params: { teamIds: teamIds.join(','), year, month } }
    )
    return res.data
  },

  getManagerAssignmentSummary: async (year: number, month: number) => {
    if (isMockApiEnabled()) return [] as ManagerMetricSummary[]
    const res = await apiClient.get<ManagerMetricSummary[]>(
      `/performance/assignments/manager-summary`,
      { params: { year, month } }
    )
    return res.data
  },

  getVinhDanhConfigs: async (year: number, month: number) => {
    if (isMockApiEnabled()) return [] as VinhDanhConfigSummary[]
    const res = await apiClient.get<VinhDanhConfigSummary[]>(`/performance/vinh-danh-configs`, {
      params: { year, month },
    })
    return res.data
  },

  createVinhDanhConfig: async (body: {
    content: string
    kind: PerformanceKind
    priority?: number
    targetMetric?: string | null
    numericUnit?: string | null
    teamIds: string[]
    effectiveFromYear: number
    effectiveFromMonth: number
  }) => {
    const res = await apiClient.post<{ ok: boolean }>(`/performance/vinh-danh-configs`, body)
    return res.data
  },

  updateVinhDanhConfig: async (body: {
    oldContent: string
    newContent?: string | null
    kind?: PerformanceKind
    priority?: number
    targetMetric?: string | null
    numericUnit?: string | null
    effectiveFromYear?: number
    effectiveFromMonth?: number
    addTeamIds?: string[]
    removeTeamIds?: string[]
    keepTeamIds?: string[]
  }) => {
    const res = await apiClient.put<{ ok: boolean }>(`/performance/vinh-danh-configs`, body)
    return res.data
  },

  deleteVinhDanhConfig: async (body: { content: string; teamIds: string[] }) => {
    const res = await apiClient.delete<{ ok: boolean }>(`/performance/vinh-danh-configs`, {
      data: body,
    })
    return res.data
  },

  getVinhDanhHonorBoard: async (year: number, month: number) => {
    const res = await apiClient.get<VinhDanhHonorBoardResponse>(
      `/performance/vinh-danh-honor-board`,
      { params: { year, month } }
    )
    return res.data
  },

  createAssignment: async (
    teamId: string,
    body: {
      assigneeUserId: string
      year: number
      month: number
      kind: PerformanceKind
      content: string
      priority?: number
      targetMetric?: string | null
      kpiSetAt?: string | null
      reviewerName?: string | null
      actualResult?: string | null
      managerEvalStatus?: string | null
      managerReviewNote?: string | null
      // Epic 1
      evidence?: string | null
      numericValue?: number | null
      numericUnit?: string | null
      selfEvalStatus?: string | null
      selfReviewNote?: string | null
      // Epic 9
      category?: string | null
      tenureStage?: string | null
      dailyTarget?: string | null
      templateItemId?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock: không tạo KPI qua API')
    const res = await apiClient.post<PerformanceAssignment>(
      `/performance/teams/${teamId}/assignments`,
      body
    )
    return res.data
  },

  /** Import nhiều dòng khác nhau (Excel/CSV) — một transaction phía BE. */
  importAssignments: async (
    teamId: string,
    body: {
      year: number
      month: number
      items: Array<{
        assigneeUserId: string
        kind: PerformanceKind
        content: string
        priority?: number
        targetMetric?: string | null
        kpiSetAt?: string | null
        reviewerName?: string | null
        managerEvalStatus?: string | null
        managerReviewNote?: string | null
        actualResult?: string | null
        progressPercent?: number
        status?: PerformanceAssignment['status']
        // Epic 1
        evidence?: string | null
        numericValue?: number | null
        numericUnit?: string | null
        selfEvalStatus?: string | null
        selfReviewNote?: string | null
        // Epic 9
        category?: string | null
        tenureStage?: string | null
        dailyTarget?: string | null
        templateItemId?: string | null
      }>
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock: không tạo KPI qua API')
    const res = await apiClient.post<PerformanceAssignment[]>(
      `/performance/teams/${teamId}/assignments/import`,
      body
    )
    return res.data
  },

  /** Tạo cùng nội dung KPI/OKR cho nhiều nhân sự (một request, transaction phía BE). */
  createAssignmentsBatch: async (
    teamId: string,
    body: {
      assigneeUserIds: string[]
      year: number
      month: number
      kind: PerformanceKind
      content: string
      priority?: number
      targetMetric?: string | null
      kpiSetAt?: string | null
      reviewerName?: string | null
      actualResult?: string | null
      managerEvalStatus?: string | null
      managerReviewNote?: string | null
      // Epic 1
      evidence?: string | null
      numericValue?: number | null
      numericUnit?: string | null
      selfEvalStatus?: string | null
      selfReviewNote?: string | null
      // Epic 9
      category?: string | null
      tenureStage?: string | null
      dailyTarget?: string | null
      templateItemId?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock: không tạo KPI qua API')
    const res = await apiClient.post<PerformanceAssignment[]>(
      `/performance/teams/${teamId}/assignments/batch`,
      body
    )
    return res.data
  },

  /**
   * Nhiều dòng mục tiêu khác nhau × cùng danh sách nhân sự — một transaction (tối đa 300 bản ghi).
   */
  createAssignmentsBatchMulti: async (
    teamId: string,
    body: {
      assigneeUserIds: string[]
      year: number
      month: number
      reviewerName?: string | null
      lines: Array<{
        kind: PerformanceKind
        content: string
        priority?: number
        targetMetric?: string | null
        kpiSetAt?: string | null
        subItems?: SubItemInputPayload[]
      }>
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock: không tạo KPI qua API')
    const res = await apiClient.post<PerformanceAssignment[]>(
      `/performance/teams/${teamId}/assignments/batch-multi`,
      body
    )
    return res.data
  },

  patchAssignment: async (
    id: string,
    body: Partial<
      Pick<
        PerformanceAssignment,
        | 'content'
        | 'targetMetric'
        | 'priority'
        | 'progressPercent'
        | 'status'
        | 'kpiSetAt'
        | 'actualResult'
        | 'reviewerName'
        | 'managerEvalStatus'
        | 'managerReviewNote'
        | 'evidence'
        | 'numericValue'
        | 'numericUnit'
        | 'selfEvalStatus'
        | 'selfReviewNote'
        | 'category'
        | 'tenureStage'
        | 'dailyTarget'
        | 'templateItemId'
      >
    > & { subItems?: SubItemInputPayload[] }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<PerformanceAssignment>(`/performance/assignments/${id}`, body)
    return res.data
  },

  patchApprovalAssignment: async (
    requestId: string,
    assignmentId: string,
    body: Pick<PerformanceAssignment, 'content' | 'priority'> & {
      targetMetric?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<PerformanceAssignment>(
      `/performance/approval-requests/${requestId}/assignments/${assignmentId}`,
      body
    )
    return res.data
  },

  createApprovalAssignment: async (
    requestId: string,
    body: {
      assigneeUserId: string
      year: number
      month: number
      kind: PerformanceKind
      content: string
      priority?: number
      targetMetric?: string | null
      numericUnit?: string | null
      subItems?: {
        label: string
        weight: number
        targetMetric?: string | null
        numericUnit?: string | null
      }[]
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<PerformanceAssignment>(
      `/performance/approval-requests/${requestId}/assignments`,
      body
    )
    return res.data
  },

  deleteApprovalAssignment: async (requestId: string, assignmentId: string) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    await apiClient.delete(
      `/performance/approval-requests/${requestId}/assignments/${assignmentId}`
    )
  },

  approveGoalReview: async (
    requestId: string,
    assignmentId: string
  ): Promise<AssignmentGoalReview> => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<AssignmentGoalReview>(
      `/performance/approval-requests/${requestId}/assignments/${assignmentId}/goal-review/approve`
    )
    return res.data
  },

  proposeGoalReviewEdit: async (
    requestId: string,
    assignmentId: string,
    body: Pick<PerformanceAssignment, 'content' | 'priority'> & {
      targetMetric?: string | null
      subItems?: SubItemInputPayload[]
    }
  ): Promise<AssignmentGoalReview> => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<AssignmentGoalReview>(
      `/performance/approval-requests/${requestId}/assignments/${assignmentId}/goal-review/edit`,
      body
    )
    return res.data
  },

  confirmGoalReview: async (
    requestId: string,
    assignmentId: string
  ): Promise<AssignmentGoalReview> => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<AssignmentGoalReview>(
      `/performance/approval-requests/${requestId}/assignments/${assignmentId}/goal-review/confirm`
    )
    return res.data
  },

  patchAssignmentSelf: async (
    id: string,
    body: {
      progressPercent?: number
      status?: PerformanceAssignment['status']
      kpiSetAt?: string | null
      actualResult?: string | null
      // Epic 1: Evidence + Số liệu + Tự đánh giá
      evidence?: string | null
      numericValue?: number | null
      numericUnit?: string | null
      selfEvalStatus?: string | null
      selfReviewNote?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<PerformanceAssignment>(
      `/performance/assignments/${id}/me`,
      body
    )
    return res.data
  },

  /** Upload ảnh minh chứng KPI → `{ url }` dạng `/uploads/kpi-evidence/...` (ghép vào Evidence). */
  uploadKpiEvidenceImage: async (file: File): Promise<{ url: string }> => {
    if (isMockApiEnabled()) {
      await new Promise((r) => setTimeout(r, 300))
      return { url: '/uploads/kpi-evidence/mock.jpg' }
    }
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''
    const token = useAuthStore.getState().accessToken
    const body = new FormData()
    body.append('file', file)
    const res = await fetch(`${base}/performance/assignments/evidence-image`, {
      method: 'POST',
      body,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Không tải được ảnh minh chứng')
    }
    return res.json() as Promise<{ url: string }>
  },

  deleteAssignment: async (id: string) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    await apiClient.delete(`/performance/assignments/${id}`)
  },

  listSummaries: async (teamId: string, year: number, month: number) => {
    if (isMockApiEnabled()) return [] as PerformanceSummaryRow[]
    const res = await apiClient.get<PerformanceSummaryRow[]>(
      `/performance/teams/${teamId}/summaries`,
      { params: { year, month } }
    )
    return res.data
  },

  recalculateSummaries: async (teamId: string, year: number, month: number) => {
    if (isMockApiEnabled()) return { recalculated: 0 }
    const res = await apiClient.post<{ recalculated: number }>(
      `/performance/teams/${teamId}/summaries/recalculate`,
      {},
      { params: { year, month } }
    )
    return res.data
  },

  getQuestionnaire: async (teamId: string, year: number, month: number) => {
    if (isMockApiEnabled()) return null
    const res = await apiClient.get<PerformanceQuestionnaire | null>(
      `/performance/teams/${teamId}/questionnaires`,
      {
        params: { year, month },
      }
    )
    return res.data
  },

  upsertQuestionnaire: async (
    teamId: string,
    body: { year: number; month: number; questions: { prompt: string; sortOrder?: number }[] }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<PerformanceQuestionnaire>(
      `/performance/teams/${teamId}/questionnaires`,
      body
    )
    return res.data
  },

  putAnswers: async (
    teamId: string,
    year: number,
    month: number,
    body: { answers: { questionId: string; answerText: string }[] }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<PerformanceQuestionnaire>(
      `/performance/teams/${teamId}/questionnaires/answers`,
      body,
      { params: { year, month } }
    )
    return res.data
  },

  // ─── Sprint 2: Window Config ────────────────────────────────────────

  listWindowConfigs: async () => {
    if (isMockApiEnabled()) return [] as PerformanceWindowConfig[]
    const res = await apiClient.get<PerformanceWindowConfig[]>('/performance/window-configs')
    return res.data
  },

  upsertWindowConfig: async (body: {
    teamId?: string | null
    year: number
    month: number
    assignStartDay?: number
    assignEndDay?: number
    answerStartDay?: number
    answerEndDay?: number
  }) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.put<PerformanceWindowConfig>('/performance/window-configs', body)
    return res.data
  },

  // ─── Epic 9: Catalog division allowlist (HR) ──────────────────────────

  getCatalogDivisionAllowlist: async () => {
    if (isMockApiEnabled()) {
      return {
        envDivisionIds: [],
        databaseDivisionIds: [],
        mergedDivisionIds: [],
        trafficTeamIds: [],
        kpiApprovalTeamIds: [],
        catalogSeedTeamIds: [],
      }
    }
    const res = await apiClient.get<CatalogDivisionAllowlistResponse>(
      '/performance/catalog-division-allowlist'
    )
    return res.data
  },

  // ─── Sprint 2 / Epic 9: Auto-seed ───────────────────────────────────

  autoSeedTeam: async (
    teamId: string,
    year: number,
    month: number,
    body?: {
      templateCode?: string
      userIds?: string[]
      dryRun?: boolean
      replaceExisting?: boolean
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<AutoSeedResponse>(
      `/performance/teams/${teamId}/auto-seed`,
      body ?? {},
      { params: { year, month } }
    )
    return res.data
  },

  // ─── Sprint 3 / Epic 7: Báo cáo nâng cấp ───────────────────────────

  listDepartmentSummaries: async (departmentId: string, year: number, month: number) => {
    if (isMockApiEnabled()) return [] as PerformanceSummaryRow[]
    const res = await apiClient.get<PerformanceSummaryRow[]>(
      `/performance/departments/${departmentId}/summaries`,
      { params: { year, month } }
    )
    return res.data
  },

  getMonthlyReport: async (departmentId: string, year: number, month: number) => {
    if (isMockApiEnabled())
      return {
        summaries: [],
        hrCounters: { promoted: 0, notLearned: 0, newJoiners: 0, leavers: 0 },
      }
    const res = await apiClient.get<MonthlyReport>(
      `/performance/departments/${departmentId}/monthly-report`,
      { params: { year, month } }
    )
    return res.data
  },

  getKpiOkrComplianceReport: async (
    year: number,
    month: number,
    opts?: { teamId?: string; departmentId?: string }
  ) => {
    if (isMockApiEnabled())
      return {
        year,
        month,
        summary: {
          totalTeams: 0,
          teamsFullyCompliant: 0,
          teamsWithGaps: 0,
          totalEligible: 0,
          totalMissing: 0,
        },
        teams: [],
      } as KpiOkrComplianceReport
    const res = await apiClient.get<KpiOkrComplianceReport>('/performance/kpi-okr-compliance', {
      params: { year, month, ...opts },
    })
    return res.data
  },

  // ─── Epic 5.5: Sales Honor Board ─────────────────────────────────────

  getSalesHonorBoard: async (year: number, month: number) => {
    if (isMockApiEnabled()) {
      return {
        year,
        month,
        topIndividualRevenue: null,
        topIndividualOrders: null,
        topTeamRevenue: null,
        topTeamOrders: null,
      } as SalesHonorBoardResponse
    }
    const res = await apiClient.get<SalesHonorBoardResponse>('/performance/honor-board/sales', {
      params: { year, month },
    })
    return res.data
  },

  // ─── Epic 10: Traffic Honor Board ────────────────────────────────────

  getTrafficHonorBoard: async (year: number, month: number) => {
    if (isMockApiEnabled()) {
      return {
        year,
        month,
        teamWinners: [],
        individualWinners: [],
        warnings: [],
      } as TrafficHonorBoardResponse
    }
    const res = await apiClient.get<TrafficHonorBoardResponse>('/performance/honor-board/traffic', {
      params: { year, month },
    })
    return res.data
  },

  // ─── Sprint 4: User Snapshot ─────────────────────────────────────────

  getUserSnapshot: async (userId: string, year: number, month: number) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.get<UserSnapshotResponse>(`/performance/users/${userId}/snapshot`, {
      params: { year, month },
    })
    return res.data
  },

  // ─── Sprint 4 / Epic 9 phase 3: Catalog Admin ────────────────────────

  listCatalogs: async () => {
    if (isMockApiEnabled()) return [] as CatalogItem[]
    const res = await apiClient.get<CatalogItem[]>('/performance/catalogs')
    return res.data
  },

  getCatalog: async (code: string, year?: number, month?: number) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.get<CatalogItem>(`/performance/catalogs/${code}`, {
      params: year && month ? { year, month } : undefined,
    })
    return res.data
  },

  createCatalog: async (body: {
    code: string
    name: string
    divisionId?: string
    description?: string
  }) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<CatalogItem>('/performance/catalogs', body)
    return res.data
  },

  patchCatalog: async (
    code: string,
    body: { name?: string; description?: string; active?: boolean }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<CatalogItem>(`/performance/catalogs/${code}`, body)
    return res.data
  },

  createCatalogItem: async (
    code: string,
    body: {
      tenureStage: string
      category: string
      kind?: string
      priority?: number
      sortOrder?: number
      content: string
      dailyTarget?: string
      monthlyTarget?: string
      numericTarget?: number
      numericUnit?: string
      notes?: string
      year?: number
      month?: number
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post(`/performance/catalogs/${code}/items`, body)
    return res.data
  },

  patchCatalogItem: async (
    id: string,
    body: {
      content?: string
      dailyTarget?: string | null
      monthlyTarget?: string | null
      numericTarget?: number | null
      numericUnit?: string | null
      priority?: number
      sortOrder?: number
      notes?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch(`/performance/catalog-items/${id}`, body)
    return res.data
  },

  deleteCatalogItem: async (id: string) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    await apiClient.delete(`/performance/catalog-items/${id}`)
  },

  createRevenueTier: async (
    code: string,
    body: {
      tenureStage: string
      tierLabel: string
      minAmount: number
      maxAmount?: number | null
      bonusPercent?: number | null
      bonusAmount?: number | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post(`/performance/catalogs/${code}/revenue-tiers`, body)
    return res.data
  },

  // ─── Manager cascade operations ────────────────────────────────────────

  cascadeAddAssignment: async (
    teamId: string,
    body: {
      year: number
      month: number
      kind: 'KPI' | 'OKR'
      priority?: number
      content: string
      targetMetric?: string | null
      numericUnit?: string | null
      dailyTarget?: string | null
      category?: string | null
      tenureStage?: string | null
      syncTemplate?: boolean
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.post<{ created: number }>(
      `/performance/teams/${teamId}/assignments/cascade-add`,
      body
    )
    return res.data
  },

  cascadeUpdateByContent: async (
    teamId: string,
    body: {
      year: number
      month: number
      oldContent: string
      newContent?: string | null
      targetMetric?: string | null
      numericUnit?: string | null
      priority?: number | null
      dailyTarget?: string | null
      syncTemplate?: boolean
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.put<{ updated: number }>(
      `/performance/teams/${teamId}/assignments/cascade-by-content`,
      body
    )
    return res.data
  },

  cascadeDeleteByContent: async (
    teamId: string,
    body: {
      year: number
      month: number
      content: string
      allowMandatory?: boolean
      syncTemplate?: boolean
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.delete<{ deleted: number }>(
      `/performance/teams/${teamId}/assignments/cascade-by-content`,
      { data: body }
    )
    return res.data
  },

  listTeamMetricTemplates: async (teamId: string) => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<
      {
        id: string
        content: string
        kind: string
        priority: number
        targetMetric: string | null
        numericUnit: string | null
        category: string | null
      }[]
    >(`/performance/teams/${teamId}/metric-templates`)
    return res.data
  },

  patchRevenueTier: async (
    id: string,
    body: {
      bonusPercent?: number | null
      bonusAmount?: number | null
      minAmount?: number
      maxAmount?: number | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch(`/performance/revenue-tiers/${id}`, body)
    return res.data
  },

  // KPI Approval by team

  getApprovalRequest: async (
    teamId: string,
    year: number,
    month: number,
    type: ApprovalRequestType = 'goal'
  ): Promise<ApprovalRequest | null> => {
    if (isMockApiEnabled()) return null
    const res = await apiClient.get<ApprovalRequest | null>(
      `/performance/teams/${teamId}/approval-request`,
      { params: { year, month, type } }
    )
    return res.data
  },

  submitForApproval: async (
    teamId: string,
    year: number,
    month: number,
    type: ApprovalRequestType = 'goal'
  ): Promise<ApprovalRequest> => {
    if (isMockApiEnabled()) throw new Error('Mock: không gửi duyệt qua API')
    const res = await apiClient.post<ApprovalRequest>(
      `/performance/teams/${teamId}/approval-request`,
      { year, month, type }
    )
    return res.data
  },

  listApprovalRequests: async (params?: {
    status?: string
    year?: number
    month?: number
    type?: ApprovalRequestType
  }): Promise<ApprovalRequest[]> => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<ApprovalRequest[]>(
      '/performance/manager/kpi-approval-requests',
      {
        params,
      }
    )
    return res.data
  },

  approveRequest: async (
    id: string,
    evaluations?: {
      assignmentId: string
      status: 'OK' | 'NOT'
      managerReviewNote?: string | null
    }[]
  ): Promise<ApprovalRequest> => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<ApprovalRequest>(
      `/performance/approval-requests/${id}/approve`,
      { evaluations }
    )
    return res.data
  },

  rejectRequest: async (id: string, note?: string | null): Promise<ApprovalRequest> => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<ApprovalRequest>(
      `/performance/approval-requests/${id}/reject`,
      { note }
    )
    return res.data
  },

  patchSubItemSelf: async (
    assignmentId: string,
    subItemId: string,
    body: {
      numericValue?: number | null
      selfEvalStatus?: string | null
      selfReviewNote?: string | null
    }
  ) => {
    if (isMockApiEnabled()) throw new Error('Mock')
    const res = await apiClient.patch<PerformanceAssignment>(
      `/performance/assignments/${assignmentId}/sub-items/${subItemId}/me`,
      body
    )
    return res.data
  },
}

export type PerformanceWindowConfig = {
  id: string
  teamId: string | null
  year: number
  month: number
  assignStartDay: number
  assignEndDay: number
  answerStartDay: number
  answerEndDay: number
  reportDeadlineDay?: number
}

export type AutoSeedResponse = {
  templateCode: string
  isSingleStage: boolean
  perUser: Array<{
    userId: string
    displayName: string | null
    tenureStage: string
    createdCount: number
    skippedCount: number
  }>
  totalCreated: number
  totalSkipped: number
  totalDeleted?: number
}

export type MonthlyReport = {
  summaries: PerformanceSummaryRow[]
  hrCounters: {
    promoted: number
    notLearned: number
    newJoiners: number
    leavers: number
  }
}

export type KpiOkrComplianceTeamRow = {
  teamId: string
  teamName: string
  divisionId: string | null
  divisionName: string | null
  leaderNames: string[]
  eligibleCount: number
  assignedCount: number
  missingCount: number
  complianceRate: number
  missingMembers: Array<{ id: string; fullNameLegal: string | null; email: string | null }>
}

export type KpiOkrComplianceReport = {
  year: number
  month: number
  summary: {
    totalTeams: number
    teamsFullyCompliant: number
    teamsWithGaps: number
    totalEligible: number
    totalMissing: number
  }
  teams: KpiOkrComplianceTeamRow[]
}

export type SalesHonorWinnerIndividual = {
  user: {
    id: string
    displayName: string | null
    email: string | null
    avatarUrl: string | null
  }
  teamName: string | null
  numericValue: number
  numericUnit: string
  content: 'Doanh thu lên đơn' | 'Số đơn chốt'
}

export type SalesHonorWinnerTeam = {
  team: { id: string; name: string }
  totalValue: number
  numericUnit: string
  memberCount: number
  metric: 'REVENUE' | 'ORDERS'
}

export type SalesHonorBoardResponse = {
  year: number
  month: number
  topIndividualRevenue: SalesHonorWinnerIndividual | null
  topIndividualOrders: SalesHonorWinnerIndividual | null
  topTeamRevenue: SalesHonorWinnerTeam | null
  topTeamOrders: SalesHonorWinnerTeam | null
}

// ─── Epic 10: Traffic Honor Board ────────────────────────────────────────────

export type TrafficHonorTeamWinner = {
  teamId: string
  teamName: string
  metricKey: string
  metricLabel: string
  totalValue: number
  numericUnit: string
  memberCount: number
  amount: number
  ratioPercent: number
}

export type TrafficHonorIndividualWinner = {
  userId: string
  displayName: string
  teamName: string | null
  metricKey: string
  metricLabel: string
  numericValue: number
  numericUnit: string
  amount: number
}

export type TrafficHonorBoardResponse = {
  year: number
  month: number
  teamWinners: TrafficHonorTeamWinner[]
  individualWinners: TrafficHonorIndividualWinner[]
  warnings: string[]
}

export type UserSnapshotResponse = {
  profile: {
    id: string
    displayName: string | null
    email: string | null
    jobTitle: string | null
    employeeCode: string | null
    divisionName: string | null
    teamName: string | null
    avatarUrl?: string | null
  }
  latestOkr: { content: string; kpiSetAt: string | null; status: string } | null
  topKpiP1: {
    content: string
    numericValue: number | null
    numericUnit: string | null
    managerEvalStatus: string | null
  } | null
  summary: {
    kpiOkCount: number
    kpiNotCount: number
    okrOkCount: number
    okrNotCount: number
    kpiGrade: string | null
    okrGrade: string | null
  } | null
  teamHistory: Array<{ year: number; month: number; departmentName: string | null }>
}

export type CatalogItem = {
  id: string
  code: string
  name: string
  description: string | null
  active: boolean
  year?: number
  month?: number
  periodId?: string
  readOnly?: boolean
  items: Array<{
    id: string
    periodId?: string
    sourceTemplateItemId?: string | null
    tenureStage: string
    category: string
    kind: string
    priority: number
    sortOrder: number
    content: string
    dailyTarget: string | null
    monthlyTarget: string | null
    numericTarget: number | null
    numericUnit: string | null
    notes: string | null
  }>
  revenueTiers: Array<{
    id: string
    tenureStage: string
    tierLabel: string
    minAmount: number
    maxAmount: number | null
    bonusPercent: number | null
    bonusAmount: number | null
  }>
}

// ─── WorkReport: Báo cáo tổng kết công việc hàng tháng ───────────────────────

export type WorkReportStatus =
  | 'draft'
  | 'submitted'
  | 'late_pending'
  | 'late_approved'
  | 'late_submitted'
  | 'reviewed'

export type WorkReport = {
  id: string
  userId: string
  user?: {
    id: string
    displayName: string | null
    email: string | null
    employeeCode: string | null
  } | null
  teamId: string
  year: number
  month: number
  status: WorkReportStatus
  isLate: boolean
  part1KpiNarrative: string | null
  part1Situation: string | null
  part1Cause: string | null
  part1Solution: string | null
  part2SelfRating: string | null
  part2SelfComment: string | null
  part2LeaderRating: string | null
  part2LeaderComment: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  part3NextMonthPlan: string | null
  fileUrl: string | null
  fileOriginalName: string | null
  fileMimeType: string | null
  aiSummary: string | null
  aiSummarizedAt: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  questionnairePart4: Array<{
    questionId: string
    prompt: string
    sortOrder: number
    answerText: string
  }>
  // Rich text sections (HTML) — 9 tiêu chí bắt buộc
  partWorkDone: string | null
  partOutputResult: string | null
  partOkr: string | null
  partIssues: string | null
  partEvidence: string | null
}

export type WorkReportLateRequest = {
  id: string
  workReportId: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
  createdAt: string
  workReport: { year: number; month: number; teamId: string }
  requestedBy: {
    id: string
    displayName: string | null
    email: string | null
    employeeCode: string | null
  }
}

export type UpsertWorkReportBody = {
  teamId: string
  year: number
  month: number
  part1KpiNarrative?: string | null
  part1Situation?: string | null
  part1Cause?: string | null
  part1Solution?: string | null
  part2SelfRating?: string | null
  part2SelfComment?: string | null
  part3NextMonthPlan?: string | null
  fileUrl?: string | null
  fileOriginalName?: string | null
  fileMimeType?: string | null
  partWorkDone?: string | null
  partOutputResult?: string | null
  partOkr?: string | null
  partIssues?: string | null
  partEvidence?: string | null
}

export const workReportApi = {
  getMyWorkReport: async (year: number, month: number): Promise<WorkReport | null> => {
    if (isMockApiEnabled()) return null
    const res = await apiClient.get<WorkReport | null>('/performance/work-reports/me', {
      params: { year, month },
    })
    return res.data
  },

  upsertMyWorkReport: async (body: UpsertWorkReportBody): Promise<WorkReport> => {
    const res = await apiClient.put<WorkReport>('/performance/work-reports/me', body)
    return res.data
  },

  submitWorkReport: async (reportId: string): Promise<WorkReport> => {
    const res = await apiClient.post<WorkReport>(`/performance/work-reports/${reportId}/submit`)
    return res.data
  },

  uploadWorkReportFile: async (
    file: File
  ): Promise<{ url: string; originalName: string; mimeType: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiClient.post<{ url: string; originalName: string; mimeType: string }>(
      '/performance/work-reports/file',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data
  },

  requestLateWorkReport: async (reportId: string, reason: string): Promise<WorkReport> => {
    const res = await apiClient.post<WorkReport>(
      `/performance/work-reports/${reportId}/late-request`,
      { reason }
    )
    return res.data
  },

  listPendingLateRequests: async (): Promise<WorkReportLateRequest[]> => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<WorkReportLateRequest[]>(
      '/performance/work-reports/late-requests'
    )
    return res.data
  },

  reviewLateRequest: async (
    requestId: string,
    approved: boolean,
    note?: string
  ): Promise<{ id: string; status: string; approved: boolean }> => {
    const res = await apiClient.patch(`/performance/work-reports/late-requests/${requestId}`, {
      approved,
      note,
    })
    return res.data
  },

  reviewWorkReport: async (
    reportId: string,
    body: { part2LeaderRating?: string | null; part2LeaderComment?: string | null }
  ): Promise<WorkReport> => {
    const res = await apiClient.patch<WorkReport>(
      `/performance/work-reports/${reportId}/review`,
      body
    )
    return res.data
  },

  listTeamWorkReports: async (
    teamId: string,
    year: number,
    month: number
  ): Promise<WorkReport[]> => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<WorkReport[]>(`/performance/teams/${teamId}/work-reports`, {
      params: { year, month },
    })
    return res.data
  },

  listUserWorkReportHistory: async (userId: string): Promise<WorkReport[]> => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<WorkReport[]>(`/performance/users/${userId}/work-reports`)
    return res.data
  },
}
