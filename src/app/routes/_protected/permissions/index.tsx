import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PaginationPrevNext } from '@/components/ui/pagination'
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
import type { EmployeeEntity } from '@/features/hr-admin/api'
import {
  avatarClassForRole,
  employeeDeptDisplay,
  employeeTeamsDisplay,
  initialsFromName,
  statusDotClass,
  statusLabelVi,
} from '@/features/hr-admin/components/HrEmployeeList/employeeListUtils'
import { requireBodOrManager } from '@/features/hr-admin/requireBodOrManager'
import { ManagerScreenLayout } from '@/features/manager/components/ManagerHub/ManagerScreenLayout'
import { usePermissionsEmployeeList } from '@/features/permissions/employeeDirectoryHooks'
import { getApiErrorMessage } from '@/lib/axios'
import { requirePermissionPrefix } from '@/lib/permissionGuards'
import { ROLE_LABEL_VI } from '@/lib/roleLabels'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/auth'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Màn phân quyền: cố định 10 nhân viên mỗi trang. */
const PERMISSIONS_PAGE_SIZE = 10

const PERMISSIONS_ROLE_FILTER_OPTIONS: Role[] = [
  'MEMBER',
  'LEADER',
  'MANAGER',
  'HR',
  'TEACHER',
  'BOD',
]

export const Route = createFileRoute('/_protected/permissions/')({
  beforeLoad: () => {
    requireBodOrManager()
    requirePermissionPrefix('admin.')
  },
  component: PermissionsIndexPage,
})

function PermissionsTableSkeleton() {
  return (
    <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 pl-4 text-center">STT</TableHead>
            <TableHead className="w-[72px]">Ảnh</TableHead>
            <TableHead>Họ tên</TableHead>
            <TableHead className="hidden md:table-cell">Email</TableHead>
            <TableHead>Vai trò</TableHead>
            <TableHead className="hidden lg:table-cell">Phòng ban</TableHead>
            <TableHead className="hidden xl:table-cell">Nhóm</TableHead>
            <TableHead className="w-[120px]">Trạng thái</TableHead>
            <TableHead className="w-[120px] text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: PERMISSIONS_PAGE_SIZE }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="pl-4 text-center">
                <Skeleton className="mx-auto h-4 w-6" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-11 w-11 rounded-xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-9 w-24 rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function EmployeeTableRow({ row, stt }: { row: EmployeeEntity; stt: number }) {
  const deptLabel = employeeDeptDisplay(row)
  const teamLabel = employeeTeamsDisplay(row)
  const initials = initialsFromName(row.name)

  return (
    <TableRow>
      <TableCell className="w-12 pl-4 text-center tabular-nums text-muted-foreground">
        {stt}
      </TableCell>
      <TableCell className="w-[72px]">
        <div className="relative inline-flex shrink-0">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl text-xs font-extrabold shadow-sm ring-2 ring-background',
              avatarClassForRole(row.role),
              row.status === 'INACTIVE' && 'opacity-[0.65] grayscale-[0.25]'
            )}
            aria-hidden
          >
            {initials}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card shadow-sm',
              statusDotClass(row.status)
            )}
            title={statusLabelVi(row.status)}
          />
        </div>
      </TableCell>
      <TableCell className="font-semibold text-foreground">
        <Link
          to="/permissions/$employeeId"
          params={{ employeeId: row.id }}
          className="text-primary hover:underline"
        >
          {row.name}
        </Link>
      </TableCell>
      <TableCell className="hidden max-w-[220px] truncate text-muted-foreground md:table-cell">
        {row.email}
      </TableCell>
      <TableCell className="text-muted-foreground">{ROLE_LABEL_VI[row.role as Role]}</TableCell>
      <TableCell className="hidden max-w-[200px] text-sm text-foreground/90 lg:table-cell">
        <span className="line-clamp-2" title={deptLabel}>
          {deptLabel}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-[220px] text-sm text-foreground/90 xl:table-cell">
        <span className="line-clamp-2" title={teamLabel}>
          {teamLabel}
        </span>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-full', statusDotClass(row.status))}
            aria-hidden
          />
          {statusLabelVi(row.status)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <Link to="/permissions/$employeeId" params={{ employeeId: row.id }}>
            Phân quyền
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function PermissionsIndexPage() {
  const [page, setPage] = useState(1)
  const pageSize = PERMISSIONS_PAGE_SIZE
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState<string | undefined>(undefined)
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined)

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim() || undefined
      setSearch((prev) => (prev === next ? prev : next))
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  const { data, isLoading, isError, error, refetch, isFetching } = usePermissionsEmployeeList({
    page,
    pageSize,
    search,
    role: roleFilter,
  })
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const pageSizeEff = Math.max(1, data?.pageSize ?? pageSize)
  const pageEff = data?.page ?? page
  const rangeFrom = total === 0 ? 0 : (pageEff - 1) * pageSizeEff + 1
  const rangeTo = Math.min(pageEff * pageSizeEff, total)

  useEffect(() => {
    if (!data) return
    const tp = Math.max(1, data.totalPages)
    if (page > tp) setPage(tp)
  }, [data, page])

  return (
    <ManagerScreenLayout hideHubNav hideToolbar>
      <div className="animate-page-entrance flex flex-col gap-4 pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Phân quyền nhân viên</h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
          <label className="relative flex min-h-[42px] min-w-0 flex-1 rounded-xl border border-border bg-card shadow-sm ring-1 ring-border/60">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              className="min-h-[42px] w-full rounded-xl border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              placeholder="Tìm theo tên hoặc email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Tìm nhân viên phân quyền"
            />
          </label>
          <div className="flex min-h-[42px] shrink-0 items-center">
            <label htmlFor="permissions-role-filter" className="sr-only">
              Lọc theo vai trò
            </label>
            <Select
              value={roleFilter ?? '__all'}
              onValueChange={(value) =>
                setRoleFilter(value === '__all' ? undefined : (value as Role))
              }
            >
              <SelectTrigger
                id="permissions-role-filter"
                className="h-full min-h-[42px] w-full min-w-[11rem] rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border/60 sm:w-auto"
                aria-label="Lọc theo vai trò"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Tất cả vai trò</SelectItem>
                {PERMISSIONS_ROLE_FILTER_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL_VI[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isError ? (
          <Card className="border-destructive/30 bg-destructive/5 p-6 shadow-[var(--shadow-card)]">
            <p className="text-sm font-medium text-destructive">
              Không tải được danh sách nhân sự. Kiểm tra kết nối API (GET /employees) và quyền
              BOD/Quản lý.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{getApiErrorMessage(error)}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch()}
            >
              Thử lại {isFetching ? '…' : ''}
            </Button>
          </Card>
        ) : isLoading ? (
          <PermissionsTableSkeleton />
        ) : (
          <div className={cn('space-y-4', isFetching && 'opacity-80 transition-opacity')}>
            <Card className="overflow-hidden p-0 shadow-[var(--shadow-card)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-12 pl-4 text-center">STT</TableHead>
                    <TableHead className="w-[72px]">Ảnh</TableHead>
                    <TableHead>Họ tên</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead className="hidden lg:table-cell">Phòng ban</TableHead>
                    <TableHead className="hidden xl:table-cell">Nhóm</TableHead>
                    <TableHead className="w-[130px]">Trạng thái</TableHead>
                    <TableHead className="w-[130px] pr-4 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        {search || roleFilter
                          ? 'Không có nhân viên khớp tìm kiếm hoặc bộ lọc vai trò.'
                          : 'Không có nhân viên.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, index) => (
                      <EmployeeTableRow key={row.id} row={row} stt={rangeFrom + index} />
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            {total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                <span>
                  Hiển thị{' '}
                  <span className="font-medium text-foreground">
                    {rangeFrom}–{rangeTo}
                  </span>{' '}
                  trong <span className="font-medium text-foreground">{total}</span> nhân viên ·
                  Trang{' '}
                  <span className="font-medium text-foreground">
                    {pageEff}/{totalPages}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {PERMISSIONS_PAGE_SIZE} / trang
                  </span>
                  <PaginationPrevNext
                    page={pageEff}
                    totalPages={totalPages}
                    busy={isFetching}
                    onPageChange={(next) => setPage(next)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </ManagerScreenLayout>
  )
}
