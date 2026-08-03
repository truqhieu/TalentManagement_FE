import type { LucideIcon } from 'lucide-react'
import type { Role, UserSession } from '@/types/auth'
import {
  BarChart3,
  Calendar,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Headphones,
  Home,
  LayoutDashboard,
  KeyRound,
  LayoutGrid,
  LineChart,
  ListOrdered,
  Network,
  Sparkles,
  School,
  ShieldCheck,
  Target,
  Users,
  Building2,
  Award,
  MessageSquare,
  UserCheck,
  Megaphone,
  ShoppingBag,
  Coins,
  FileText,
  Settings,
} from 'lucide-react'
import { createElement } from 'react'

const Facebook = (props: any) =>
  createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ...props,
    },
    createElement('path', {
      d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
    })
  ) as any

export type NavMatchMode = 'exact' | 'prefix' | 'custom'

export type AppNavItem = {
  to: string
  label: string
  icon: LucideIcon
  match: NavMatchMode
  search?: Record<string, unknown>
  customMatch?: (normalizedPath: string) => boolean
  /** Nếu có — chỉ hiển thị khi user có quyền catalog id này */
  permissionId?: string
  /** Nếu có — hiển thị khi user có ít nhất một trong các quyền (ưu tiên hơn `permissionId` nếu cả hai đều có). */
  permissionIdsAny?: string[]
  /** Nếu có — ẩn mục khỏi nav nếu user đang ở một trong các role này (ưu tiên cao hơn mọi check quyền). */
  hiddenForRoles?: Role[]
  /** Các mục con hiển thị dưới dạng dropdown/hover */
  children?: AppNavItem[]
  /** Mở trong tab mới, không điều hướng khỏi app hiện tại */
  openNewTab?: boolean
  isDevelopment?: boolean
}

/** Trang giới thiệu Viễn Chí Bảo (`/about-us`) — mở tab mới. */
export const COMPANY_LANDING_NAV_ITEM: AppNavItem = {
  to: '/about-us',
  label: 'Viễn Chí Bảo',
  icon: Home,
  match: 'exact',
  openNewTab: true,
}

/** Member: dashboard, lộ trình, thi, KPI, báo cáo — quyền bám route + catalog (tránh link tới màn không vào được). */
export const MEMBER_SELF_ITEMS: AppNavItem[] = [
  {
    to: '/dashboard',
    label: 'Tổng quan cá nhân',
    icon: LayoutGrid,
    match: 'exact',
    permissionIdsAny: ['dashboard.view', 'home.view'],
  },
  {
    to: '/learning-path',
    label: 'Lộ trình học',
    icon: ListOrdered,
    match: 'prefix',
    permissionId: 'learning.view',
  },
  {
    to: '/monthly-report',
    label: 'Báo cáo hàng tháng',
    icon: BarChart3,
    match: 'prefix',
    permissionId: 'report.view',
    hiddenForRoles: ['MANAGER', 'BOD'],
  },
  {
    to: '/exam',
    label: 'Kết quả & lịch thi',
    icon: Calendar,
    match: 'prefix',
    permissionId: 'learning.view',
  },
  {
    to: '/learning-classes',
    label: 'Lớp học của tôi',
    icon: School,
    match: 'prefix',
    permissionId: 'learning.view',
  },
  {
    to: '/other-classes',
    label: 'Lớp học khác',
    icon: School,
    match: 'prefix',
    permissionId: 'learning.view',
  },
  {
    to: '/rewards',
    label: 'Khen thưởng/Phạt',
    icon: Award,
    match: 'prefix',
  },
]

/** Phòng họp — phân loại nhãn theo quyền hạn */
export const ROOM_BOOKING_ITEMS: AppNavItem[] = [
  {
    to: '/room-booking',
    label: 'Duyệt lịch phòng họp',
    icon: DoorOpen,
    match: 'prefix',
    permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
  },
  {
    to: '/room-booking',
    label: 'Duyệt yêu cầu đổi lịch',
    icon: ClipboardList,
    match: 'prefix',
    search: { tab: 'requests' },
    permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
  },
  {
    to: '/room-booking',
    label: 'Đặt phòng họp',
    icon: DoorOpen,
    match: 'prefix',
    hiddenForRoles: ['MANAGER', 'HR', 'BOD'],
  },
]

const HR_ITEMS: AppNavItem[] = [
  {
    to: '/hr-admin',
    label: 'Danh sách nhân sự',
    icon: Users,
    match: 'custom',
    customMatch: (p) => {
      if (p === '/hr-admin/org' || p.startsWith('/hr-admin/org/')) return false
      if (p.startsWith('/hr-admin/kpi-catalog')) return false
      if (p.startsWith('/hr-admin/settings/kpi-windows')) return false
      if (p.startsWith('/hr-admin/settings/company-landing')) return false
      return p === '/hr-admin' || p.startsWith('/hr-admin/')
    },
    search: { page: 1 },
    permissionIdsAny: ['hr.employees.view', 'manager.team.view'],
  },
  {
    to: '/hr-admin/org',
    label: 'Phòng ban & nhóm',
    icon: Network,
    match: 'prefix',
    permissionId: 'hr.org.manage',
  },
  {
    to: '/hr-admin/settings/company-landing',
    label: 'Trang giới thiệu công ty',
    icon: Sparkles,
    match: 'prefix',
    permissionId: 'company.landing.edit',
  },
]

/** Cấu hình hệ thống — route dưới `/hr-admin/settings/` */
export const SETTINGS_ITEMS: AppNavItem[] = [
  {
    to: '/hr-admin/settings/kpi-windows',
    label: 'Cửa sổ KPI/OKR',
    icon: CalendarRange,
    match: 'prefix',
    permissionId: 'kpi.window_override',
  },
]

const BOD_ITEMS: AppNavItem[] = [
  {
    to: '/bod/dashboard',
    label: 'Tổng quan nhân sự',
    icon: LineChart,
    match: 'prefix',
    permissionId: 'bod.dashboard.view',
    hiddenForRoles: ['BOD'],
  },
  {
    to: '/bod/trainee-ranking',
    label: 'Xếp hạng tập sự',
    icon: BarChart3,
    match: 'prefix',
    permissionId: 'bod.ranking.view',
    hiddenForRoles: ['BOD'],
  },
  {
    to: '/bod/team-comparison',
    label: 'So sánh nhóm',
    icon: BarChart3,
    match: 'prefix',
    permissionId: 'bod.comparison.view',
    hiddenForRoles: ['BOD'],
  },
  {
    to: '/permissions',
    label: 'Phân quyền nhân viên',
    icon: KeyRound,
    match: 'prefix',
    permissionId: 'admin.permissions.assign',
  },
]

/** CSKH Quality — Audit + Cấu hình (`/cskh-quality?tab=…`). */
export const CSKH_QUALITY_ITEM: AppNavItem = {
  to: '/cskh-quality',
  label: 'Chất lượng CSKH',
  icon: Headphones,
  match: 'prefix',
  permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
  children: [
    {
      to: '/cskh-quality',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      match: 'prefix',
      search: { tab: 'overview' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Chất lượng CSKH',
      icon: MessageSquare,
      match: 'prefix',
      search: { tab: 'audit' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'AI Insight',
      icon: Sparkles,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Hội thoại',
      icon: ShieldCheck,
      match: 'prefix',
      search: { tab: 'chat' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Nhân viên',
      icon: Users,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Khách hàng',
      icon: UserCheck,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Page (Facebook)',
      icon: Facebook,
      match: 'prefix',
      search: { tab: 'fb-page' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Quảng cáo',
      icon: Megaphone,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Sản phẩm',
      icon: ShoppingBag,
      match: 'prefix',
      search: { tab: 'products' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Doanh thu Chat',
      icon: Coins,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Báo cáo',
      icon: FileText,
      match: 'prefix',
      isDevelopment: true,
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
    {
      to: '/cskh-quality',
      label: 'Cài đặt Kênh',
      icon: Settings,
      match: 'prefix',
      search: { tab: 'config' },
      permissionIdsAny: ['manager.approvals', 'hr.employees.view', 'bod.dashboard.view'],
    },
  ],
}

const MANAGER_OPS_ITEMS: AppNavItem[] = [
  {
    to: '/manager/grading',
    label: 'Chấm bài thi',
    icon: ClipboardList,
    match: 'prefix',
    permissionId: 'teacher.grade',
  },
  {
    to: '/manager/classes',
    label: 'Chia lớp',
    icon: School,
    match: 'prefix',
    permissionId: 'manager.classes',
  },
  {
    to: '/manager/exam-schedule',
    label: 'Lịch thi & Đề thi',
    icon: Calendar,
    // Màn gộp 2 tab (/manager/exam-schedule + /manager/exam-papers) — sáng ở cả hai route
    match: 'custom',
    customMatch: (p) =>
      p === '/manager/exam-schedule' ||
      p.startsWith('/manager/exam-schedule/') ||
      p === '/manager/exam-papers' ||
      p.startsWith('/manager/exam-papers/'),
    permissionId: 'manager.exam_schedule',
  },
  {
    to: '/manager/approvals',
    label: 'Duyệt thăng cấp / sao',
    icon: ShieldCheck,
    match: 'prefix',
    permissionId: 'manager.approvals',
  },
  {
    to: '/manager/learning-submissions',
    label: 'Duyệt minh chứng lộ trình',
    icon: ClipboardList,
    match: 'prefix',
    permissionId: 'manager.approvals',
  },
  {
    to: '/permissions',
    label: 'Phân quyền nhân viên',
    icon: KeyRound,
    match: 'prefix',
    permissionId: 'admin.permissions.assign',
  },
  {
    to: '/hr-admin/org',
    label: 'Đơn vị & Nhóm',
    icon: Building2,
    match: 'prefix',
    permissionId: 'hr.org.manage',
  },
]

const TEACHER_CLASS_ITEMS: AppNavItem[] = [
  {
    to: '/teacher/classes',
    label: 'Lớp phụ trách',
    icon: School,
    match: 'prefix',
    permissionId: 'teacher.classes.view',
  },
]

/** Teacher: header ngang (thay sidebar) — lớp + chấm thi */
export const TEACHER_HEADER_ITEMS: AppNavItem[] = [
  ...TEACHER_CLASS_ITEMS,
  {
    to: '/exam/grader',
    label: 'Chấm bài & kỳ thi',
    icon: ClipboardList,
    match: 'custom',
    customMatch: (p) =>
      p === '/exam/grader' ||
      p.startsWith('/exam/grader/') ||
      /^\/exam\/[^/]+\/(grade|result)$/.test(p),
    permissionId: 'teacher.grade',
  },
]

/** Leader / quản lý có quyền team KPI: dashboard, KPI team, báo cáo — khớp `/_protected/leader/kpi-okr` và `monthly-report`. */
export const LEADER_KPI_ITEMS: AppNavItem[] = [
  {
    to: '/dashboard',
    label: 'Tổng quan',
    icon: LayoutGrid,
    match: 'exact',
    permissionIdsAny: ['dashboard.view', 'home.view'],
  },
  {
    to: '/leader/kpi-okr',
    label: 'Set KPI/OKR cho team',
    icon: Target,
    match: 'prefix',
    permissionIdsAny: ['kpi.team_view', 'kpi.team_edit'],
    hiddenForRoles: ['MANAGER', 'BOD'],
  },
  {
    to: '/leader/vinh-danh',
    label: 'Chi số vinh danh',
    icon: Award,
    match: 'prefix',
    hiddenForRoles: ['LEADER', 'MEMBER', 'HR', 'TEACHER'],
  },
  {
    to: '/leader/kpi-approval',
    label: 'Duyệt KPI theo team',
    icon: ClipboardCheck,
    match: 'prefix',
    hiddenForRoles: ['LEADER', 'MEMBER', 'HR', 'TEACHER'],
  },
  {
    to: '/monthly-report',
    label: 'Báo cáo hàng tháng',
    icon: BarChart3,
    match: 'prefix',
    permissionId: 'report.view',
  },
]

export const MANAGER_KPI_ITEMS: AppNavItem[] = [
  {
    to: '/manager/kpi-okr',
    label: 'Set KPI/OKR cho team',
    icon: Target,
    match: 'prefix',
    permissionIdsAny: ['kpi.team_view', 'kpi.team_edit'],
    hiddenForRoles: ['LEADER', 'MEMBER', 'HR', 'TEACHER'],
  },
]

export { HR_ITEMS, BOD_ITEMS, MANAGER_OPS_ITEMS, TEACHER_CLASS_ITEMS }

export function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1)
  return p
}

export function filterNavByPermissions(
  items: AppNavItem[],
  hasPermission: (permissionId: string) => boolean,
  role?: Role
): AppNavItem[] {
  return items.filter((item) => {
    if (role && item.hiddenForRoles?.includes(role)) return false
    if (item.permissionIdsAny?.length) {
      return item.permissionIdsAny.some((id) => hasPermission(id))
    }
    if (!item.permissionId) return true
    return hasPermission(item.permissionId)
  })
}

/**
 * Sidebar: flat route list (permission filter + dedupe by `to` + search).
 * Order ưu tiên luồng sử dụng: Dashboard/KPI → tác vụ manager → nhân sự/org → BOD → teacher.
 */
export function flatSidebarNavItems(
  canId: (permissionId: string) => boolean,
  role?: Role
): AppNavItem[] {
  const sources = [
    LEADER_KPI_ITEMS,
    MANAGER_KPI_ITEMS,
    MEMBER_SELF_ITEMS,
    ROOM_BOOKING_ITEMS,
    MANAGER_OPS_ITEMS,
    HR_ITEMS,
    SETTINGS_ITEMS,
    BOD_ITEMS,
    TEACHER_HEADER_ITEMS,
  ]
  const seen = new Set<string>()
  const out: AppNavItem[] = []
  for (const source of sources) {
    for (const item of filterNavByPermissions(source, canId, role)) {
      const key = item.to + (item.search !== undefined ? JSON.stringify(item.search) : '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

export type AppNavGroup = {
  id: string
  label: string
  items: AppNavItem[]
}

/**
 * Sidebar có nhóm: gom theo luồng sử dụng (Tổng quan → Lớp học và thi cử →
 * Nhân sự → Cài đặt → …) thay vì danh sách phẳng dài. Mỗi item chỉ xuất hiện
 * 1 lần (dedupe theo `to`+`search`); nhóm rỗng (sau filter quyền) sẽ bị ẩn.
 */
export function groupedSidebarNavItems(
  canId: (permissionId: string) => boolean,
  user?: UserSession | null
): AppNavGroup[] {
  const role = user?.role
  const seen = new Set<string>()
  const take = (items: AppNavItem[]): AppNavItem[] => {
    const out: AppNavItem[] = []
    for (const item of filterNavByPermissions(items, canId, role)) {
      const key = item.to + (item.search !== undefined ? JSON.stringify(item.search) : '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }

  const find = (items: AppNavItem[], to: string) => items.filter((i) => i.to === to)

  const groups: AppNavGroup[] = [
    {
      id: 'overview',
      label: 'Tổng quan',
      items: take([
        ...find(LEADER_KPI_ITEMS, '/dashboard'),
        ...find(MEMBER_SELF_ITEMS, '/dashboard'),
        ...find(LEADER_KPI_ITEMS, '/leader/kpi-okr'),
        ...find(MANAGER_KPI_ITEMS, '/manager/kpi-okr'),
        ...find(LEADER_KPI_ITEMS, '/leader/vinh-danh'),
        ...find(LEADER_KPI_ITEMS, '/leader/kpi-approval'),
        ...find(MEMBER_SELF_ITEMS, '/rewards'),
        ...find(LEADER_KPI_ITEMS, '/monthly-report'),
        ...find(MEMBER_SELF_ITEMS, '/monthly-report'),
      ]),
    },
    {
      id: 'classes-exams',
      label: 'Lớp học và thi cử',
      items: take([
        ...find(MEMBER_SELF_ITEMS, '/learning-path'),
        ...find(MEMBER_SELF_ITEMS, '/learning-classes'),
        ...find(MEMBER_SELF_ITEMS, '/other-classes'),
        ...find(MEMBER_SELF_ITEMS, '/exam'),
        ...find(MANAGER_OPS_ITEMS, '/manager/classes'),
        ...find(TEACHER_HEADER_ITEMS, '/teacher/classes'),
        ...find(MANAGER_OPS_ITEMS, '/manager/exam-schedule'),
        ...find(TEACHER_HEADER_ITEMS, '/exam/grader'),
        ...find(MANAGER_OPS_ITEMS, '/manager/approvals'),
        ...find(MANAGER_OPS_ITEMS, '/manager/learning-submissions'),
      ]),
    },
    {
      id: 'room-booking',
      label: 'Phòng họp',
      items: take([...find(ROOM_BOOKING_ITEMS, '/room-booking')]),
    },
    {
      id: 'hr',
      label: 'Quản trị Hành chính',
      items: take([
        ...find(HR_ITEMS, '/hr-admin'),
        ...find(HR_ITEMS, '/hr-admin/org'),
        ...find(HR_ITEMS, '/hr-admin/kpi-catalog/SALES_NV'),
        ...find(MANAGER_OPS_ITEMS, '/manager/kpi-okr/leader-review'),
        ...find(HR_ITEMS, '/hr-admin/settings/company-landing'),
        ...ROOM_BOOKING_ITEMS.filter(
          (i) => i.search?.tab === 'requests' || i.search?.tab === 'approvals'
        ),
        ...find(MANAGER_OPS_ITEMS, '/permissions'),
        ...find(BOD_ITEMS, '/permissions'),
        // CSKH_QUALITY_ITEM,
      ]),
    },
    {
      id: 'settings',
      label: 'Cài đặt',
      items: take([...find(SETTINGS_ITEMS, '/hr-admin/settings/kpi-windows')]),
    },
  ]

  return groups.filter((g) => g.items.length > 0)
}

/**
 * Compact header nav: merge by catalog permissions (not a single role).
 * Order: landing Viễn Chí Bảo (`/`), member self, BOD, HR, leader KPI, manager ops, teacher.
 */
export function mergeCompactHeaderNavItems(
  canId: (permissionId: string) => boolean,
  role?: Role
): AppNavItem[] {
  const seen = new Set<string>()
  const out: AppNavItem[] = []
  const push = (items: AppNavItem[]) => {
    for (const item of filterNavByPermissions(items, canId, role)) {
      const key = item.to + (item.search ? JSON.stringify(item.search) : '')
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  push(MEMBER_SELF_ITEMS)
  push(ROOM_BOOKING_ITEMS)
  push(BOD_ITEMS)
  push(HR_ITEMS)
  push(SETTINGS_ITEMS)
  push(LEADER_KPI_ITEMS)
  push(MANAGER_KPI_ITEMS)
  push(MANAGER_OPS_ITEMS)
  push(TEACHER_HEADER_ITEMS)
  // push([CSKH_QUALITY_ITEM])
  return out
}

export function isNavItemActive(
  pathname: string,
  item: AppNavItem,
  currentSearch?: Record<string, any>
): boolean {
  const p = normalizePath(pathname)

  // 1. Kiểm tra khớp path
  let pathMatches = false
  if (item.match === 'custom' && item.customMatch) {
    pathMatches = item.customMatch(p)
  } else {
    const t = normalizePath(item.to)
    if (item.match === 'exact') pathMatches = p === t
    else pathMatches = p === t || p.startsWith(`${t}/`)
  }

  if (!pathMatches) return false

  if (item.children?.length) {
    return item.children.some((child) => isNavItemActive(pathname, child, currentSearch))
  }

  // 2. Nếu path đã khớp, kiểm tra thêm search params để phân biệt (nếu item có định nghĩa search)
  if (item.search) {
    if (!currentSearch) return false
    // So sánh các key có trong item.search
    return Object.entries(item.search).every(([key, value]) => currentSearch[key] === value)
  }

  // 3. Nếu item không có search param nhưng URL hiện tại có (ví dụ đang ở tab requests),
  // thì mục mặc định (không search) không được highlight.
  if (!item.search && currentSearch && Object.keys(currentSearch).length > 0) {
    return false
  }

  return true
}
