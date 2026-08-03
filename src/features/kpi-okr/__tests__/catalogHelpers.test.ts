/**
 * catalogHelpers — unit tests.
 * Kiểm tra isMandatoryMetric (theo templateCode), isTrafficTeam.
 */
import { describe, it, expect } from 'vitest'
import {
  isMandatoryMetric,
  isCatalogSeedExcludedTeam,
  isLivestreamCatalogTeam,
  isTrafficTeam,
  requiresKpiApproval,
  catalogSeedEnabledForTeam,
  isKinhDoanhDepartment,
  MANDATORY_METRICS_BY_TEMPLATE,
  TRAFFIC_TEAM_IDS_FALLBACK,
  shouldShowAssignmentForMember,
  memberRequiresKpiOkr,
  filterKpiEligibleMembers,
  kpiEligibleUserIdSet,
} from '../catalogHelpers'
import type { PerformanceAssignment } from '../api'

function row(partial: Partial<PerformanceAssignment>): PerformanceAssignment {
  return {
    id: '1',
    teamId: 't',
    year: 2026,
    month: 6,
    assigneeUserId: 'u',
    kind: 'KPI',
    content: 'x',
    priority: 1,
    createdAt: '',
    updatedAt: '',
    ...partial,
  } as PerformanceAssignment
}

describe('shouldShowAssignmentForMember', () => {
  it('ẩn P3 và BENEFIT', () => {
    expect(shouldShowAssignmentForMember(row({ priority: 3 }))).toBe(false)
    expect(shouldShowAssignmentForMember(row({ category: 'BENEFIT' }))).toBe(false)
    expect(shouldShowAssignmentForMember(row({ priority: 2, category: 'KPI_BONUS' }))).toBe(true)
  })
})

describe('catalog seed team helpers', () => {
  it('Livestream 1/2 không còn tự dùng template LIVESTREAM_NV', () => {
    expect(isLivestreamCatalogTeam({ name: 'Livestream 1' })).toBe(true)
    expect(isLivestreamCatalogTeam({ name: 'Livestream 2' })).toBe(true)
  })

  it('team Cua Hang khong dung catalog auto-seed', () => {
    expect(isCatalogSeedExcludedTeam({ name: 'Cửa Hàng' })).toBe(true)
    expect(isCatalogSeedExcludedTeam({ name: 'Cua Hang Kim Hoan' })).toBe(true)
    expect(isCatalogSeedExcludedTeam({ name: 'Kinh Doanh 1' })).toBe(false)
  })
})

describe('isMandatoryMetric', () => {
  it('SALES_NV: "Doanh thu lên đơn" là bắt buộc', () => {
    expect(isMandatoryMetric('Doanh thu lên đơn', 'SALES_NV')).toBe(true)
  })

  it('SALES_NV: "Số đơn hàng chốt được (có cọc, XN ĐT)" là bắt buộc', () => {
    expect(isMandatoryMetric('Số đơn hàng chốt được (có cọc, XN ĐT)', 'SALES_NV')).toBe(true)
  })

  it('SALES_NV: "Giá trị đơn hàng lớn nhất trong tháng" KHÔNG bắt buộc', () => {
    expect(isMandatoryMetric('Giá trị đơn hàng lớn nhất trong tháng', 'SALES_NV')).toBe(false)
  })

  it('TRAFFIC_TEAM_NV: "Traffic cá nhân tháng" là bắt buộc', () => {
    expect(isMandatoryMetric('Traffic cá nhân tháng', 'TRAFFIC_TEAM_NV')).toBe(true)
  })

  it('TRAFFIC_TEAM_NV: "Doanh thu cá nhân tháng" là bắt buộc', () => {
    expect(isMandatoryMetric('Doanh thu cá nhân tháng', 'TRAFFIC_TEAM_NV')).toBe(true)
  })

  it('TRAFFIC_TEAM_NV: "Số content win mới (>50k views)" KHÔNG bắt buộc', () => {
    expect(isMandatoryMetric('Số content win mới (>50k views)', 'TRAFFIC_TEAM_NV')).toBe(false)
  })

  it('không có templateCode → fallback SALES_NV mandatory list', () => {
    expect(isMandatoryMetric('Doanh thu lên đơn')).toBe(true)
    expect(isMandatoryMetric('Tổng view traffic team')).toBe(false)
  })

  it('content null/undefined → false', () => {
    expect(isMandatoryMetric(null, 'SALES_NV')).toBe(false)
    expect(isMandatoryMetric(undefined)).toBe(false)
  })

  it('MANDATORY_METRICS_BY_TEMPLATE.SALES_NV có 2 phần tử', () => {
    expect(MANDATORY_METRICS_BY_TEMPLATE['SALES_NV']).toHaveLength(2)
  })

  it('MANDATORY_METRICS_BY_TEMPLATE.TRAFFIC_TEAM_NV có 2 phần tử', () => {
    expect(MANDATORY_METRICS_BY_TEMPLATE['TRAFFIC_TEAM_NV']).toHaveLength(2)
  })
})

describe('isTrafficTeam', () => {
  const validId = TRAFFIC_TEAM_IDS_FALLBACK[0]

  it('trả true cho ID trong fallback list', () => {
    expect(isTrafficTeam(validId)).toBe(true)
  })

  it('trả false cho ID không nằm trong list', () => {
    expect(isTrafficTeam('00000000-0000-0000-0000-000000000000')).toBe(false)
  })

  it('null/undefined teamId → false', () => {
    expect(isTrafficTeam(null)).toBe(false)
    expect(isTrafficTeam(undefined)).toBe(false)
  })

  it('ưu tiên dùng trafficTeamIdsFromApi khi được cung cấp', () => {
    const customList = ['custom-team-id']
    expect(isTrafficTeam('custom-team-id', customList)).toBe(true)
    // ID trong fallback không nằm trong custom list → false
    expect(isTrafficTeam(validId, customList)).toBe(false)
  })

  it('TRAFFIC_TEAM_IDS_FALLBACK có đúng 8 team', () => {
    expect(TRAFFIC_TEAM_IDS_FALLBACK).toHaveLength(8)
  })
})

describe('isKinhDoanhDepartment', () => {
  it('nhận diện phòng ban Kinh doanh theo tên/code', () => {
    expect(isKinhDoanhDepartment({ name: 'Kinh Doanh Viên Chi Bảo' })).toBe(true)
    expect(isKinhDoanhDepartment({ code: 'KINH_DOANH' })).toBe(true)
    expect(isKinhDoanhDepartment({ name: 'Logistics' })).toBe(false)
    expect(isKinhDoanhDepartment({ name: 'Vận đơn' })).toBe(false)
  })
})

describe('catalogSeedEnabledForTeam', () => {
  it('trả true khi team nằm trong catalogSeedTeamIds từ API', () => {
    expect(catalogSeedEnabledForTeam('seed-team-id', ['seed-team-id'])).toBe(true)
    expect(catalogSeedEnabledForTeam('other-team', ['seed-team-id'])).toBe(false)
  })

  it('ưu tiên flag catalogSeedEnabled từ org tree', () => {
    expect(catalogSeedEnabledForTeam('regular-team-id', [], true)).toBe(true)
  })
})

describe('requiresKpiApproval', () => {
  it('trả true cho team nằm trong allowlist duyệt KPI/OKR từ API', () => {
    expect(requiresKpiApproval('approval-team-id', ['approval-team-id'])).toBe(true)
  })

  it('không dùng fallback Traffic để bật luồng duyệt khi API trả allowlist rỗng', () => {
    expect(requiresKpiApproval(TRAFFIC_TEAM_IDS_FALLBACK[0], [])).toBe(false)
  })

  it('ưu tiên flag requiresKpiApproval từ org tree', () => {
    expect(requiresKpiApproval('regular-team-id', [], true)).toBe(true)
  })
})

describe('memberRequiresKpiOkr / filterKpiEligibleMembers', () => {
  it('Part-time non-Traffic miễn KPI', () => {
    expect(memberRequiresKpiOkr({ teamPosition: 'Partime', requiresKpiOkr: false }, false)).toBe(
      false
    )
    expect(memberRequiresKpiOkr({ teamPosition: 'Partime' }, false)).toBe(false)
  })

  it('Part-time Traffic vẫn cần KPI', () => {
    expect(memberRequiresKpiOkr({ teamPosition: 'Partime' }, true)).toBe(true)
  })

  it('filterKpiEligibleMembers loại Part-time khi không Traffic', () => {
    const members = [
      { userId: 'ft', teamPosition: 'Fulltime Chính thức' },
      { userId: 'pt', teamPosition: 'Partime' },
    ]
    expect(filterKpiEligibleMembers(members, false).map((m) => m.userId)).toEqual(['ft'])
    expect(filterKpiEligibleMembers(members, true).map((m) => m.userId)).toEqual(['ft', 'pt'])
  })

  it('kpiEligibleUserIdSet', () => {
    const members = [
      { userId: 'a', requiresKpiOkr: true },
      { userId: 'b', requiresKpiOkr: false },
    ]
    expect(kpiEligibleUserIdSet(members, false)).toEqual(new Set(['a']))
  })
})
