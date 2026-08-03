import {
  type AppNavItem,
  groupedSidebarNavItems,
  isNavItemActive,
} from '@/components/shared/AppNav/navItems'
import { BRAND_TEXT } from '@/components/shared/brandButtonStyles'
import { Button } from '@/components/ui/button'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as UiSidebar,
} from '@/components/ui/sidebar'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
type NavItem = AppNavItem

function navItemDedupeKey(item: NavItem): string {
  return item.to + (item.search !== undefined ? JSON.stringify(item.search) : '')
}

const NavLink = memo(function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const currentSearch = routerState.location.search as Record<string, any>
  const childActive = Boolean(
    item.children?.some((child) => isNavItemActive(pathname, child, currentSearch))
  )
  const [isOpen, setIsOpen] = useState(childActive)

  useEffect(() => {
    if (childActive) setIsOpen(true)
  }, [childActive])

  const inner = (
    <>
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          active || childActive ? BRAND_TEXT : 'text-muted-foreground'
        )}
        strokeWidth={2}
      />
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {item.children && !collapsed ? (
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
    </>
  )

  const title = collapsed ? item.label : undefined

  if (item.children?.length) {
    return (
      <SidebarMenuItem className="flex flex-col gap-0.5">
        <SidebarMenuButton
          type="button"
          collapsed={collapsed}
          active={active || childActive}
          className="w-full"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          <div className="flex w-full items-center gap-2">{inner}</div>
        </SidebarMenuButton>
        {isOpen && !collapsed ? (
          <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l-2 border-[#006C49]/25 pl-2 dark:border-emerald-500/30">
            {item.children.map((child) => {
              const subActive = isNavItemActive(pathname, child, currentSearch)
              const ChildIcon = child.icon

              if (child.isDevelopment) {
                return (
                  <SidebarMenuButton
                    key={navItemDedupeKey(child)}
                    collapsed={false}
                    active={false}
                    className="h-9 cursor-pointer"
                    onClick={() => toast.info('Tính năng đang phát triển')}
                  >
                    <ChildIcon
                      className="h-4 w-4 shrink-0 text-muted-foreground/70"
                      strokeWidth={2}
                    />
                    <span className="truncate text-[13px] font-medium text-slate-500/80">
                      {child.label}
                    </span>
                  </SidebarMenuButton>
                )
              }

              return (
                <SidebarMenuButton
                  key={navItemDedupeKey(child)}
                  asChild
                  collapsed={false}
                  active={subActive}
                  className="h-9"
                >
                  <Link to={child.to} search={child.search} preload="intent" title={child.label}>
                    <ChildIcon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        subActive ? BRAND_TEXT : 'text-muted-foreground'
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate text-[13px] font-medium">{child.label}</span>
                  </Link>
                </SidebarMenuButton>
              )
            })}
          </div>
        ) : null}
      </SidebarMenuItem>
    )
  }

  if (item.openNewTab) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild collapsed={collapsed} active={active}>
          <a href={item.to} target="_blank" rel="noopener noreferrer" title={title}>
            {inner}
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (item.search !== undefined) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild collapsed={collapsed} active={active}>
          <Link to={item.to} search={item.search} preload="intent" title={title}>
            {inner}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild collapsed={collapsed} active={active}>
        <Link to={item.to} preload="intent" title={title}>
          {inner}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

export function Sidebar() {
  // Remove early return to allow MEMBER/LEADER roles with teacher/other permissions to see sidebar items
  return <SidebarInner />
}

function SidebarInner() {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname
  const currentSearch = routerState.location.search as Record<string, any>

  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const { canId } = usePermission()
  const collapsed = !sidebarOpen

  const groups = useMemo(() => groupedSidebarNavItems(canId, user), [canId, user])

  /**
   * Trạng thái mở/đóng từng nhóm — chỉ lưu các nhóm user đã đóng tay.
   * - Mặc định: nhóm mở.
   * - User click → toggle, lưu `false` nếu đóng / xoá khỏi map nếu mở lại.
   * - Nhóm chứa item đang active luôn mở (không cho đóng) để tránh ẩn route hiện tại.
   */
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set())

  const isGroupOpen = (groupId: string, hasActive: boolean) => {
    if (collapsed) return true
    if (hasActive) return true
    return !collapsedGroupIds.has(groupId)
  }

  const toggleGroup = (id: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const displayName = user?.name ?? 'Ng\u01b0\u1eddi d\u00f9ng'

  return (
    <UiSidebar collapsed={collapsed}>
      <SidebarHeader className={cn(collapsed ? 'px-2 pb-3 pt-4' : 'px-3 pb-3 pt-4')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white shadow-sm ring-2 ring-[#006C49]/20 bg-[#006C49]">
              V
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label={'M\u1edf r\u1ed9ng menu'}
              title={'M\u1edf r\u1ed9ng menu'}
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1 pl-1">
              <div className={cn('text-lg font-extrabold tracking-tight', BRAND_TEXT)}>VCB HRM</div>
              <div className="mt-1 text-sm leading-snug text-muted-foreground">{displayName}</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Thu gọn menu"
              title="Thu gọn menu"
              className="mt-0.5 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="min-h-0 flex-1 px-2 py-3">
          <SidebarGroupContent className="h-full overflow-y-auto">
            <nav aria-label="Menu \u0111i\u1ec1u h\u01b0\u1edbng" className="flex flex-col gap-2">
              {groups.map((group, idx) => {
                const groupHasActive = group.items.some((it) =>
                  isNavItemActive(pathname, it, currentSearch)
                )
                const isOpen = isGroupOpen(group.id, groupHasActive)
                return (
                  <div key={group.id} className="flex flex-col">
                    {!collapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
                        aria-controls={`sidebar-group-${group.id}`}
                        className={cn(
                          'group/header mx-1 flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                          groupHasActive
                            ? BRAND_TEXT
                            : 'text-muted-foreground/75 hover:bg-[#006C49]/5 hover:text-foreground dark:hover:bg-emerald-500/10',
                          idx === 0 ? 'mt-0' : 'mt-1'
                        )}
                      >
                        <span className="truncate">{group.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                            isOpen ? 'rotate-0' : '-rotate-90'
                          )}
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      </button>
                    ) : idx > 0 ? (
                      <div
                        aria-hidden
                        className="mx-2 my-1 h-px bg-[#006C49]/20 dark:bg-emerald-800/40"
                      />
                    ) : null}
                    {isOpen ? (
                      <SidebarMenu id={`sidebar-group-${group.id}`} className="mt-1">
                        {group.items.map((item) => (
                          <NavLink
                            key={navItemDedupeKey(item) + item.label}
                            item={item}
                            active={isNavItemActive(pathname, item, currentSearch)}
                            collapsed={collapsed}
                          />
                        ))}
                      </SidebarMenu>
                    ) : null}
                  </div>
                )
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </UiSidebar>
  )
}
