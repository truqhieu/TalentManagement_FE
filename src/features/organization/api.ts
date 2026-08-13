import { apiClient } from '@/lib/axios'
import { HR_DEPARTMENT_OPTIONS, HR_TEAM_OPTIONS } from '@/features/hr-admin/hrOrgOptions'
import { isMockApiEnabled } from '@/lib/mockEnv'
import type { Role } from '@/types/auth'

export type OrgMasterEntity = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type DivisionEntity = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function assertOrgCrudNotMock(action: string): void {
  if (isMockApiEnabled()) {
    throw new Error(`Đang bật chế độ giả lập — không thể ${action}.`)
  }
}

/**
 * CRUD phòng ban & team (`OrgController`).
 *
 * API `/org/divisions` → bảng `team` (phòng ban).
 * API `/org/teams` → bảng `divisions` (nhóm member — giữ data hiện có).
 * `departments` = chuyên môn (professional position).
 */
export const orgCrudApi = {
  createDivision: async (payload: {
    name: string
    code?: string
    description?: string
    isActive?: boolean
  }): Promise<DivisionEntity> => {
    assertOrgCrudNotMock('tạo phòng ban')
    const res = await apiClient.post<DivisionEntity>('/org/divisions', payload)
    return res.data
  },
  updateDivision: async (
    id: string,
    body: {
      name?: string
      code?: string
      description?: string
      isActive?: boolean
    }
  ): Promise<DivisionEntity> => {
    assertOrgCrudNotMock('sửa phòng ban')
    const res = await apiClient.patch<DivisionEntity>(`/org/divisions/${id}`, body)
    return res.data
  },
  deleteDivision: async (id: string): Promise<DivisionEntity> => {
    assertOrgCrudNotMock('xóa phòng ban')
    const res = await apiClient.delete<DivisionEntity>(`/org/divisions/${id}`)
    return res.data
  },
  createTeam: async (
    name: string,
    divisionId: string,
    options?: { requiresKpiApproval?: boolean; catalogSeedEnabled?: boolean }
  ): Promise<OrgMasterEntity> => {
    assertOrgCrudNotMock('tạo team')
    const res = await apiClient.post<OrgMasterEntity>('/org/teams', {
      name,
      divisionId,
      requiresKpiApproval: options?.requiresKpiApproval,
      catalogSeedEnabled: options?.catalogSeedEnabled,
    })
    return res.data
  },
  updateTeam: async (
    id: string,
    body: {
      name?: string
      divisionId?: string
      isTrafficTeam?: boolean
      requiresKpiApproval?: boolean
      catalogSeedEnabled?: boolean
    }
  ): Promise<OrgMasterEntity> => {
    assertOrgCrudNotMock('sửa team')
    const res = await apiClient.patch<OrgMasterEntity>(`/org/teams/${id}`, body)
    return res.data
  },
  deleteTeam: async (id: string): Promise<OrgMasterEntity> => {
    assertOrgCrudNotMock('xóa team')
    const res = await apiClient.delete<OrgMasterEntity>(`/org/teams/${id}`)
    return res.data
  },
}

export type OrgTreeTeam = {
  id: string
  name: string
  departmentId: string
  requiresKpiApproval?: boolean
  catalogSeedEnabled?: boolean
}

export type OrgTreeDepartment = {
  id: string
  name: string
  isActive: boolean
  teams: OrgTreeTeam[]
}

export type OrgTreeResponse = {
  departments: OrgTreeDepartment[]
}

/** Row từ GET /organization/divisions-with-teams (mỗi row là 1 phòng ban + teams). */
export type OrgAdminTeamRow = {
  id: string
  name: string
  /** Giữ tên `departmentId` (BC FE): id phòng ban cha (`team_groups`). */
  departmentId: string
  isActive: boolean
  isTrafficTeam: boolean
  requiresKpiApproval: boolean
  catalogSeedEnabled: boolean
  _count: { users: number }
}

export type OrgAdminDivisionRow = {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  teams: OrgAdminTeamRow[]
}

/** @deprecated Dùng `OrgAdminDivisionRow` — giữ alias để khỏi phá import cũ. */
export type OrgAdminDepartmentRow = OrgAdminDivisionRow

export type TeamMemberRow = {
  userId: string
  email: string | null
  displayName: string | null
  employeeCodePrimary: string | null
  /** Số thứ tự trong team (2 số cuối của mã nhân viên). */
  teamOrderNumber?: string | null
  joinedAt: string
  role: Role
  status: 'ACTIVE' | 'INACTIVE' | 'PROBATION' | 'RESERVED' | 'TRANSFERRED'
  avatarUrl: string | null
  portraitRef: string | null
  membership?: 'primary' | 'extra' | 'secondary'
  /** Vị trí trong team (Partime, Fulltime -Thử việc, Trưởng nhóm…). */
  teamPosition?: string | null
  /** false = Part-time ở team không Traffic — miễn KPI/OKR. */
  requiresKpiOkr?: boolean
}

export type EligibleUserRow = {
  userId: string
  displayName: string | null
  email: string | null
  employeeCodePrimary: string | null
  avatarUrl: string | null
  currentTeamId: string | null
  currentTeamName: string | null
}

export const DIVISIONS_WITH_TEAMS_QUERY_KEY = ['organization', 'divisions-with-teams'] as const
/** @deprecated Dùng `DIVISIONS_WITH_TEAMS_QUERY_KEY`. */
export const DEPTS_WITH_TEAMS_QUERY_KEY = DIVISIONS_WITH_TEAMS_QUERY_KEY

export function teamMembersQueryKey(teamId: string) {
  return ['organization', 'team-members', teamId] as const
}

function mockOrgTree(): OrgTreeResponse {
  return {
    departments: HR_DEPARTMENT_OPTIONS.map((d) => ({
      id: d.value,
      name: d.label,
      isActive: true,
      teams: HR_TEAM_OPTIONS.filter((t) => t.departmentId === d.value).map((t) => ({
        id: t.value,
        name: t.label,
        departmentId: t.departmentId,
      })),
    })),
  }
}

export const organizationApi = {
  getTree: async (): Promise<OrgTreeResponse> => {
    if (isMockApiEnabled()) return mockOrgTree()
    const res = await apiClient.get<OrgTreeResponse>('/organization/tree')
    return res.data
  },

  getDivisionsList: async (): Promise<Array<{ id: string; name: string }>> => {
    if (isMockApiEnabled()) {
      return HR_DEPARTMENT_OPTIONS.map((d) => ({ id: d.value, name: d.label }))
    }
    const res = await apiClient.get<Array<{ id: string; name: string }>>(
      '/organization/divisions-list'
    )
    return res.data
  },

  getTeamsList: async (): Promise<
    Array<{ id: string; name: string; teamGroupId: string | null }>
  > => {
    if (isMockApiEnabled()) {
      return HR_TEAM_OPTIONS.map((t) => ({
        id: t.value,
        name: t.label,
        teamGroupId: t.departmentId,
      }))
    }
    const res = await apiClient.get<
      Array<{ id: string; name: string; teamGroupId: string | null }>
    >('/organization/teams-list')
    return res.data
  },

  listDepartments: async () => {
    if (isMockApiEnabled()) {
      return HR_DEPARTMENT_OPTIONS.map((d) => ({
        id: d.value,
        name: d.label,
        isActive: true,
        _count: {
          teams: mockOrgTree().departments.find((x) => x.id === d.value)?.teams.length ?? 0,
        },
      }))
    }
    const res = await apiClient.get<
      {
        id: string
        name: string
        isActive: boolean
        _count: { teams: number }
      }[]
    >('/organization/departments')
    return res.data
  },

  listDivisionsWithTeams: async (): Promise<OrgAdminDivisionRow[]> => {
    if (isMockApiEnabled()) {
      const tree = mockOrgTree()
      return tree.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: null,
        description: null,
        isActive: d.isActive,
        teams: d.teams.map((t) => ({
          id: t.id,
          name: t.name,
          departmentId: t.departmentId,
          isActive: true,
          isTrafficTeam: false,
          requiresKpiApproval: false,
          catalogSeedEnabled: false,
          _count: { users: 0 },
        })),
      }))
    }
    const res = await apiClient.get<OrgAdminDivisionRow[]>('/organization/divisions-with-teams')
    return res.data
  },

  getTeamMembers: async (teamId: string): Promise<{ teamId: string; members: TeamMemberRow[] }> => {
    if (isMockApiEnabled()) {
      return { teamId, members: [] }
    }
    const res = await apiClient.get<{ teamId: string; members: TeamMemberRow[] }>(
      `/organization/teams/${teamId}/members`
    )
    return res.data
  },

  searchEligibleUsers: async (
    teamId: string,
    q?: string,
    limit = 20
  ): Promise<EligibleUserRow[]> => {
    if (isMockApiEnabled()) return []
    const res = await apiClient.get<EligibleUserRow[]>(
      `/organization/teams/${teamId}/eligible-users`,
      { params: { q: q?.trim() || undefined, limit } }
    )
    return res.data
  },

  addTeamMember: async (
    teamId: string,
    userId: string
  ): Promise<{
    teamId: string
    userId: string
    movedFromTeamId: string | null
    addedAsExtra?: boolean
    /** @deprecated Dùng addedAsExtra */
    addedAsSecondary?: boolean
  }> => {
    assertOrgCrudNotMock('thêm thành viên')
    const res = await apiClient.post<{
      teamId: string
      userId: string
      movedFromTeamId: string | null
      addedAsExtra?: boolean
      addedAsSecondary?: boolean
    }>(`/organization/teams/${teamId}/members`, { userId })
    return res.data
  },

  removeTeamMember: async (
    teamId: string,
    userId: string
  ): Promise<{ teamId: string; userId: string }> => {
    assertOrgCrudNotMock('xoá thành viên')
    const res = await apiClient.delete<{ teamId: string; userId: string }>(
      `/organization/teams/${teamId}/members/${userId}`
    )
    return res.data
  },
}
