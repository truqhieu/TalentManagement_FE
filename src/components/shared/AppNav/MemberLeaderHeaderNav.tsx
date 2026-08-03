import { useMemo } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  isNavItemActive,
  mergeCompactHeaderNavItems,
  type AppNavItem,
} from '@/components/shared/AppNav/navItems'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

type HeaderNavGroup = {
  id: string
  label: string
  items: AppNavItem[]
}

function routeGroup(item: AppNavItem): string {
  if (item.to === '/about-us') return 'company'
  if (item.to.startsWith('/room-booking')) return 'room-booking'
  // if (item.to.startsWith('/manager')) return 'manager'
  if (item.to.startsWith('/hr-admin') || item.to.startsWith('/permissions')) return 'hr'
  if (item.to.startsWith('/teacher') || item.to.startsWith('/exam/grader')) return 'teacher'
  if (item.to.startsWith('/bod')) return 'bod'
  if (
    item.to.startsWith('/leader/kpi-okr') ||
    item.to.startsWith('/kpi-okr') ||
    item.to.startsWith('/monthly-report')
  ) {
    return 'kpi'
  }
  if (
    item.to.startsWith('/learning-path') ||
    item.to.startsWith('/learning-classes') ||
    item.to.startsWith('/other-classes') ||
    item.to.startsWith('/exam')
  ) {
    return 'learning'
  }
  if (item.to.startsWith('/dashboard')) return 'dashboard'
  if (item.to.startsWith('/rewards')) return 'rewards'
  return 'other'
}

function buildHeaderGroups(items: AppNavItem[], labels: Record<string, string>): HeaderNavGroup[] {
  const order = [
    'dashboard',
    'learning',
    'room-booking',
    'rewards',
    'kpi',
    // 'manager',
    'hr',
    'teacher',
    'bod',
    'other',
    'company',
  ] //§

  const bucket = new Map<string, AppNavItem[]>()
  for (const item of items) {
    const key = routeGroup(item)
    const list = bucket.get(key) ?? []
    list.push(item)
    bucket.set(key, list)
  }

  return order
    .map((id) => ({ id, label: labels[id] ?? id, items: bucket.get(id) ?? [] }))
    .filter((group) => group.items.length > 0)
}

function HeaderNavLink({ item, active }: { item: AppNavItem; active: boolean }) {
  const Icon = item.icon
  const className = cn(
    'flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-foreground transition-all duration-200 hover:bg-muted active:scale-95',
    active && 'bg-muted font-medium text-foreground'
  )

  const inner = (
    <>
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem] text-muted-foreground',
          active && 'text-foreground'
        )}
        strokeWidth={2.25}
      />
      <span className="whitespace-nowrap">{item.label}</span>
    </>
  )

  if (item.openNewTab) {
    return (
      <a href={item.to} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }

  if (item.search !== undefined) {
    return (
      <Link to={item.to} search={item.search} preload="intent" className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <Link to={item.to} preload="intent" className={className}>
      {inner}
    </Link>
  )
}

/** Điều hướng ngang trên header — gộp theo quyền hiệu lực (RBAC động). */
export function MemberLeaderHeaderNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { canId } = usePermission()
  const role = useAuthStore((s) => s.user?.role)
  const items = useMemo(() => mergeCompactHeaderNavItems(canId, role), [canId, role])

  const isPrivileged = role === 'HR' || role === 'MANAGER' || role === 'BOD'
  const labels: Record<string, string> = useMemo(
    () => ({
      company: 'Công ty',
      dashboard: 'Tổng quan',
      learning: 'Học tập',
      'room-booking': isPrivileged ? 'Duyệt phòng họp' : 'Đặt phòng họp',
      kpi: 'KPI / Báo cáo',
      // manager: 'Quản lý lớp',
      hr: 'Nhân sự',
      rewards: 'Khen thưởng/Phạt',
      teacher: 'Giảng viên',
      bod: 'BOD',
      other: 'Khác',
    }),
    [isPrivileged]
  )

  const groups = useMemo(() => buildHeaderGroups(items, labels), [items, labels])

  return (
    <NavigationMenu
      viewport={false}
      className="rounded-none border-0 bg-transparent px-0 py-0 shadow-none"
      aria-label="Điều hướng chính"
    >
      <NavigationMenuList>
        {groups.map((group) => {
          const active = group.items.some((item) => isNavItemActive(pathname, item))
          const isSingle = group.items.length === 1
          const singleItem = group.items[0]!

          if (isSingle) {
            const linkClass = cn(
              'group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 border border-transparent bg-transparent text-white/90 hover:border-white/25 hover:bg-white/10 hover:text-white focus:text-white',
              active && 'border-white/30 bg-white/15 text-white'
            )
            return (
              <NavigationMenuItem key={group.id}>
                <NavigationMenuLink asChild>
                  {singleItem.openNewTab ? (
                    <a
                      href={singleItem.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {group.label}
                    </a>
                  ) : (
                    <Link
                      to={singleItem.to}
                      search={singleItem.search}
                      preload="intent"
                      className={linkClass}
                    >
                      {group.label}
                    </Link>
                  )}
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          }

          if (group.id === 'learning') {
            const laoDongItems = group.items.filter((item) => item.to !== '/other-classes')
            const otherItems = group.items.filter((item) => item.to === '/other-classes')

            return (
              <NavigationMenuItem key={group.id}>
                <NavigationMenuTrigger
                  className={cn(
                    'h-10 rounded-md px-4 py-2 text-sm font-medium shadow-none',
                    '!border-transparent !bg-transparent !text-white/90',
                    'hover:!border-white/25 hover:!bg-white/10 hover:!text-white',
                    'focus:!bg-white/10 focus:!text-white focus:!shadow-none',
                    'focus-visible:!ring-2 focus-visible:!ring-white/35 focus-visible:!ring-offset-0 focus-visible:!border-white/25 focus-visible:!outline-none',
                    'data-[state=open]:!border-white/30 data-[state=open]:!bg-white/15 data-[state=open]:!text-white',
                    active && '!border-white/30 !bg-white/15 !text-white'
                  )}
                >
                  {group.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent className="z-50 min-w-[16rem] rounded-xl border border-border bg-card p-2.5 shadow-xl">
                  <div className="space-y-3">
                    {laoDongItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="px-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
                          Lao động tri thức
                        </p>
                        <ul className="grid gap-1">
                          {laoDongItems.map((item) => (
                            <li key={item.to + item.label}>
                              <NavigationMenuLink asChild>
                                <HeaderNavLink
                                  item={item}
                                  active={isNavItemActive(pathname, item)}
                                />
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {laoDongItems.length > 0 && otherItems.length > 0 && (
                      <div className="h-px bg-border/60 my-1" />
                    )}
                    {otherItems.length > 0 && (
                      <div className="space-y-1">
                        <p className="px-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">
                          Lớp học khác
                        </p>
                        <ul className="grid gap-1">
                          {otherItems.map((item) => (
                            <li key={item.to + item.label}>
                              <NavigationMenuLink asChild>
                                <HeaderNavLink
                                  item={item}
                                  active={isNavItemActive(pathname, item)}
                                />
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )
          }

          return (
            <NavigationMenuItem key={group.id}>
              <NavigationMenuTrigger
                className={cn(
                  'h-10 rounded-md px-4 py-2 text-sm font-medium shadow-none',
                  '!border-transparent !bg-transparent !text-white/90',
                  'hover:!border-white/25 hover:!bg-white/10 hover:!text-white',
                  'focus:!bg-white/10 focus:!text-white focus:!shadow-none',
                  'focus-visible:!ring-2 focus-visible:!ring-white/35 focus-visible:!ring-offset-0 focus-visible:!border-white/25 focus-visible:!outline-none',
                  'data-[state=open]:!border-white/30 data-[state=open]:!bg-white/15 data-[state=open]:!text-white',
                  active && '!border-white/30 !bg-white/15 !text-white'
                )}
              >
                {group.label}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="z-50 min-w-[16rem] rounded-md border border-border bg-card p-1.5 shadow-md">
                <ul className="grid gap-1">
                  {group.items.map((item) => (
                    <li key={item.to + item.label}>
                      <NavigationMenuLink asChild>
                        <HeaderNavLink item={item} active={isNavItemActive(pathname, item)} />
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
