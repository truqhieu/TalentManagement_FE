/**
 * Helpers cho Epic 9 — KPI Catalog trên FE.
 * Đồng bộ với BE sales-scope.ts; tập merge đầy đủ lấy từ GET /performance/catalog-division-allowlist.
 */

import type { PerformanceAssignment } from '@/features/kpi-okr/api'

/** Label hiển thị cho category */
export function categoryLabel(category: string | null | undefined): string {
  switch (category) {
    case 'BASE':
      return 'A. Lương cơ bản'
    case 'KPI_BONUS':
      return 'B. KPI thưởng'
    case 'PERFORMANCE_BONUS':
      return 'D. Thưởng hiệu suất'
    case 'BENEFIT':
      return 'E. Phúc lợi'
    default:
      return category || '—'
  }
}

/** Badge class cho category */
export function categoryBadgeClass(category: string | null | undefined): string {
  switch (category) {
    case 'BASE':
      return 'border-slate-200 bg-slate-50 text-slate-600'
    case 'KPI_BONUS':
      return 'border-indigo-200 bg-indigo-50 text-indigo-600'
    case 'PERFORMANCE_BONUS':
      return 'border-emerald-200 bg-emerald-50 text-emerald-600'
    case 'BENEFIT':
      return 'border-amber-200 bg-amber-50 text-amber-600'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500'
  }
}

/** Chuẩn hoá tên/mã team để so khớp pattern (bỏ dấu, hạ chữ thường). */
function normalizeTemplateKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function isLivestreamCatalogTeam(team: { code?: string | null; name: string }): boolean {
  const keys = [team.code, team.name].map(normalizeTemplateKey)
  return keys.some((key) => key === 'livestream 1' || key === 'livestream 2')
}

export function isCatalogSeedExcludedTeam(team: { code?: string | null; name: string }): boolean {
  const keys = [team.code, team.name].map(normalizeTemplateKey)
  return keys.some((key) => /^cua hang(?:\b|$)/.test(key))
}

/** Chỉ env FE — bổ sung cho API; khi có `mergedDivisionIds` từ API thì ưu tiên tham số đó. */
export function getEnvCatalogEnabledDivisionIds(): string[] {
  const raw = import.meta.env.VITE_CATALOG_ENABLED_DIVISION_IDS as string | undefined
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** @deprecated alias */
export const getCatalogEnabledDivisionIds = getEnvCatalogEnabledDivisionIds

/** Các pattern fallback nhận diện division qua tên/code. */
const CATALOG_DIVISION_PATTERNS = [/kinh[_\s]?doanh/i, /vận[_\s]?đơn|van[._\s-]?don|bảo[_\s]?hành/i]

/**
 * `mergedDivisionIdsFromApi`: từ GET catalog-division-allowlist.mergedDivisionIds (env ∪ DB server).
 * Khi chưa có (undefined), fallback env FE + pattern — có thể lệch DB tới khi query xong.
 */
export function isCatalogEnabledDepartment(
  division?: {
    id?: string
    name?: string | null
    code?: string | null
  } | null,
  mergedDivisionIdsFromApi?: string[] | null
): boolean {
  if (!division) return false
  const ids = mergedDivisionIdsFromApi ?? getEnvCatalogEnabledDivisionIds()
  if (division.id && ids.includes(division.id)) return true
  const label = division.code ?? division.name ?? ''
  return CATALOG_DIVISION_PATTERNS.some((p) => p.test(label))
}

/** Chỉ phòng ban Kinh doanh — dùng hiển thị checkbox seed KPI trên HR org. */
export function isKinhDoanhDepartment(
  division?: {
    id?: string
    name?: string | null
    code?: string | null
  } | null
): boolean {
  if (!division) return false
  const label = division.code ?? division.name ?? ''
  return /kinh[_\s]?doanh/i.test(label)
}

/** Team được HR opt-in để nhận seed KPI từ cấu hình SALES_NV. */
export function catalogSeedEnabledForTeam(
  teamId: string | null | undefined,
  catalogSeedTeamIdsFromApi?: readonly string[] | null,
  orgTreeFlag?: boolean | null
): boolean {
  if (orgTreeFlag) return true
  if (!teamId) return false
  return (catalogSeedTeamIdsFromApi ?? []).includes(teamId)
}

/** Danh sách category theo thứ tự hiển thị. */
export const CATEGORY_ORDER = ['BASE', 'KPI_BONUS', 'PERFORMANCE_BONUS', 'BENEFIT'] as const

/**
 * Các KPI item bắt buộc phải nhập Số liệu (numericValue) mỗi tháng — Epic 5.5.
 * Đồng bộ với SALES_HONOR_METRICS ở BE sales-scope.ts.
 */
export const SALES_MANDATORY_METRICS = [
  'Doanh thu lên đơn',
  'Số đơn hàng chốt được (có cọc, XN ĐT)',
] as const
export type SalesMandatoryMetric = (typeof SALES_MANDATORY_METRICS)[number]

/** Epic 10 — Metric bắt buộc (cố định) theo templateCode — không được phép xóa. */
export const MANDATORY_METRICS_BY_TEMPLATE: Record<string, readonly string[]> = {
  SALES_NV: SALES_MANDATORY_METRICS,
  TRAFFIC_TEAM_NV: ['Traffic cá nhân tháng', 'Doanh thu cá nhân tháng'],
  VAN_DON_NV: [],
}

/** Các metric traffic đã bị loại khỏi danh sách cố định — cần cleanup khỏi DB nếu đã tạo. */
export const REMOVED_TRAFFIC_MANDATORY_METRICS = [
  'Tổng view traffic team',
  'Doanh thu team traffic',
  'Số content win mới (>50k views)',
  'Số sản phẩm mới win',
] as const

/** Tất cả chỉ số cố định từ mọi template — dùng để check toàn cục (không cần templateCode). */
export const ALL_MANDATORY_METRICS_FE: readonly string[] = [
  ...new Set(Object.values(MANDATORY_METRICS_BY_TEMPLATE).flat()),
]

/**
 * Member / báo cáo phòng Kinh doanh: ẩn P3 và phúc lợi (BENEFIT) — chỉ hiển thị KPI chính.
 * Đồng bộ KpiOkrWorkspace (member) và MonthlyReportScreen.
 */
export function shouldShowAssignmentForMember(row: PerformanceAssignment): boolean {
  if (
    row.goalReview?.status === 'edit_pending_member' ||
    row.goalReview?.status === 'manager_created_pending_member'
  ) {
    return true
  }
  return row.priority !== 3 && row.category !== 'BENEFIT'
}

/** Trả true nếu row KPI này bắt buộc nhập Số liệu (tính theo templateCode nếu có, fallback SALES_NV). */
export function isMandatoryMetric(
  content: string | null | undefined,
  templateCode?: string | null
): boolean {
  const list = templateCode
    ? (MANDATORY_METRICS_BY_TEMPLATE[templateCode] ?? SALES_MANDATORY_METRICS)
    : SALES_MANDATORY_METRICS
  return list.includes(content as string)
}

/** Trả true nếu content là chỉ số cố định ở BẤT KỲ template nào — dùng cho màn manager. */
export function isAnyMandatoryMetric(content: string | null | undefined): boolean {
  return ALL_MANDATORY_METRICS_FE.includes(content as string)
}

/**
 * Các chỉ số được đưa vào thi đua / xếp hạng / khen thưởng hàng tháng.
 * Đồng bộ với RANKING_METRIC_CONTENTS_SALES + RANKING_METRIC_CONTENTS_TRAFFIC ở BE sales-scope.ts.
 */
export const RANKING_REWARD_METRIC_CONTENTS: readonly string[] = [
  'Doanh thu lên đơn',
  'Số đơn hàng chốt được (có cọc, XN ĐT)',
  'Traffic cá nhân tháng',
  'Doanh thu cá nhân tháng',
]

/** Trả true nếu chỉ số này được tính vào thi đua / xếp hạng / khen thưởng. */
export function isRankingRewardMetric(content: string | null | undefined): boolean {
  return RANKING_REWARD_METRIC_CONTENTS.includes(content as string)
}

/** Allowlist traffic team IDs (FE-side fallback; ưu tiên dùng data từ API nếu có). */
export const TRAFFIC_TEAM_IDS_FALLBACK = [
  '02d0d0d0-0001-4001-8001-000000000101',
  '02d0d0d0-0001-4001-8001-000000000102',
  '02d0d0d0-0001-4001-8001-000000000103',
  '02d0d0d0-0001-4001-8001-000000000104',
  '02d0d0d0-0001-4001-8001-000000000105',
  '02d0d0d0-0001-4001-8001-000000000106',
  '02d0d0d0-0001-4001-8001-000000000107',
  '02d0d0d0-0001-4001-8001-000000000401',
] as const

/**
 * Pattern khớp tên team Traffic (fallback khi UUID không có trong allowlist).
 * Nhánh "đvkd" khớp đúng format team Traffic thật ("ĐVKD1 - Hồng Ngọc": số dính liền
 * "đvkd", có dấu gạch ngang phía sau) — tránh khớp nhầm các team Kinh doanh khác có
 * tên bắt đầu bằng "ĐVKD <số> ..." (vd. "ĐVKD 1 Hồng Ngọc (KD)", team Sales thật).
 */
const TRAFFIC_TEAM_NAME_RE =
  /^(huyk?\s*\d+|đvkd\d+\s*-|global\s+(japan|indo|thai|đài\s*loan|taiwan))/i

/**
 * Kiểm tra team có thuộc nhóm Traffic không.
 * `trafficTeamIdsFromApi`: từ bảng kpi_traffic_team_allowlist (nếu đã load).
 * `teamName`: tên team từ org tree — dùng làm fallback khi UUID không khớp allowlist.
 */
export function isTrafficTeam(
  teamId: string | null | undefined,
  trafficTeamIdsFromApi?: readonly string[] | null,
  teamName?: string | null
): boolean {
  if (teamId) {
    const ids = trafficTeamIdsFromApi ?? TRAFFIC_TEAM_IDS_FALLBACK
    if (ids.includes(teamId as string)) return true
  }
  if (teamName) return TRAFFIC_TEAM_NAME_RE.test(teamName.trim())
  return false
}

export function requiresKpiApproval(
  teamId: string | null | undefined,
  kpiApprovalTeamIdsFromApi?: readonly string[] | null,
  orgTreeFlag?: boolean | null
): boolean {
  if (orgTreeFlag) return true
  if (!teamId) return false
  return (kpiApprovalTeamIdsFromApi ?? []).includes(teamId)
}

/** Regex Part-time — đồng bộ BE employment-type.ts */
const PART_TIME_PATTERN =
  /(part[._\s-]?time|cộng[._\s-]?tác[._\s-]?viên|cong[._\s-]?tac[._\s-]?vien|\bctv\b|partime)/i

export type MemberEmploymentFields = {
  teamPosition?: string | null
  jobTitle?: string | null
  requiresKpiOkr?: boolean | null
}

function fieldIsPartTime(value: string | null | undefined): boolean {
  const s = (value ?? '').trim()
  return s.length > 0 && PART_TIME_PATTERN.test(s)
}

/** Part-time nếu teamPosition hoặc jobTitle khớp regex. */
export function isPartTimeMember(member: MemberEmploymentFields): boolean {
  return fieldIsPartTime(member.teamPosition) || fieldIsPartTime(member.jobTitle)
}

/** Member có cần KPI/OKR không (Part-time miễn trừ team Traffic). */
export function memberRequiresKpiOkr(
  member: MemberEmploymentFields,
  isTrafficTeam: boolean
): boolean {
  if (member.requiresKpiOkr != null) return member.requiresKpiOkr
  if (isTrafficTeam) return true
  return !isPartTimeMember(member)
}

export function filterKpiEligibleMembers<T extends MemberEmploymentFields & { userId?: string }>(
  members: T[],
  isTrafficTeam: boolean
): T[] {
  return members.filter((m) => memberRequiresKpiOkr(m, isTrafficTeam))
}

export function kpiEligibleUserIdSet(
  members: Array<MemberEmploymentFields & { userId: string }>,
  isTrafficTeam: boolean
): Set<string> {
  return new Set(filterKpiEligibleMembers(members, isTrafficTeam).map((m) => m.userId))
}

/**
 * Group assignments theo category và sắp xếp theo thứ tự hiển thị.
 * Trả null nếu không có assignment nào có category (phòng không thuộc catalog).
 */
export function groupByCategory(
  assignments: PerformanceAssignment[]
): Map<string, PerformanceAssignment[]> | null {
  const hasCategory = assignments.some((a) => a.category != null)
  if (!hasCategory) return null

  const map = new Map<string, PerformanceAssignment[]>()
  for (const cat of CATEGORY_ORDER) {
    const items = assignments.filter((a) => a.category === cat)
    if (items.length > 0) map.set(cat, items)
  }
  return map
}
