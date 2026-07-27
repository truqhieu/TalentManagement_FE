import { lazy, Suspense, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Bell, BellOff, ChevronDown, LogOut, UserCircle } from 'lucide-react'
import { useLogout } from '@/features/auth/hooks'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MemberLeaderHeaderNav } from '@/components/shared/AppNav/MemberLeaderHeaderNav'
import { MobileHeaderNav } from '@/components/shared/AppNav/MobileHeaderNav'
import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { Sidebar } from '@/components/shared/Sidebar'
import { defaultEntryPathFromSession } from '@/lib/routeGuards'
import { formatRoleLabelsVi } from '@/lib/roleLabels'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'

const AssistantWidget = lazy(() =>
  import('@/components/shared/AssistantWidget').then((m) => ({ default: m.AssistantWidget }))
)

export interface AppShellProps {
  children: ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  const user = useAuthStore((s) => s.user)
  const { mutate: logout, isPending: logoutPending } = useLogout()
  const displayName = user?.name ?? 'Người dùng'
  const roleLabel = user ? formatRoleLabelsVi(user) : '—'
  const brandHomeTo = user ? defaultEntryPathFromSession(user) : '/dashboard'
  const brandHomeSearch = brandHomeTo === '/hr-admin' ? { page: 1, pageSize: 15 } : undefined
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const cskhSearch = useRouterState({
    select: (s) => s.location.search as { tab?: string },
  })
  const cskhTab = pathname.startsWith('/cskh-quality') ? (cskhSearch.tab ?? null) : null
  /** CSKH Audit — full width + khóa scroll ngoài; các tab khác scroll/fit theo nội dung. */
  const cskhAuditLayout = pathname.startsWith('/cskh-quality') && cskhTab === 'audit'
  const wideMain = pathname.startsWith('/cskh-quality') && cskhTab !== 'config'
  /** Không dùng sidebar — điều hướng bằng header ngang. */
  const compactNavNoSidebar =
    user?.role === 'MEMBER' ||
    user?.role === 'LEADER' ||
    user?.role === 'HR' ||
    user?.role === 'TEACHER'

  const toolbar = (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-white/85 hover:bg-white/12 hover:text-white"
            aria-label="Thông báo"
          >
            <Bell className="h-5 w-5" strokeWidth={2} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Thông báo</p>
          </div>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Bạn chưa có thông báo mới</p>
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            title="Nhấn để mở hồ sơ cá nhân"
            className={cn(
              'group ml-0.5 h-auto min-h-0 shrink-0 gap-2 rounded-full border border-accent/30 bg-white/10 py-1 pl-1 pr-2 text-left font-normal normal-case tracking-normal text-white shadow-sm outline-none transition-[box-shadow,background-color] hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-accent/45 sm:pr-2.5 lg:pr-3'
            )}
            aria-label="Mở menu hồ sơ cá nhân"
            aria-haspopup="menu"
          >
            <EmployeeAvatar
              name={displayName}
              photoUrl={user?.portraitRef ? resolvePublicAssetUrl(user.portraitRef) : null}
              showOnlineDot
              className="h-8 w-8 border-2 border-accent/40 bg-gradient-to-br from-primary via-primary/80 to-accent text-xs font-bold text-white sm:h-9 sm:w-9"
            />
            <span className="hidden max-w-[11rem] truncate text-sm font-semibold text-white xl:inline">
              {displayName}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-cyan-100/80 transition-transform duration-200 group-data-[state=open]:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-[min(calc(100vw-2rem),17rem)]">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="text-xs text-muted-foreground">{roleLabel}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to="/profile"
              className="flex cursor-pointer flex-col items-stretch gap-0.5 py-2.5 !no-underline"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCircle className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
                Hồ sơ cá nhân
              </span>
              <span className="pl-6 text-xs leading-snug text-muted-foreground">
                Xem và chỉnh sửa thông tin, số điện thoại, mật khẩu
              </span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={logoutPending}
            className="cursor-pointer gap-2"
            onClick={() => logout(undefined)}
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-app-canvas">
      {!compactNavNoSidebar ? (
        <div className="hidden md:block">
          <Sidebar />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 shrink-0 border-b border-primary-300/40 bg-[#005236] backdrop-blur-sm dark:border-primary/30 dark:from-primary/60 dark:via-primary/45 dark:to-primary/60">
          <div className="flex min-h-12 items-center justify-between gap-2 px-3 py-1.5 md:hidden">
            <div className="flex items-center gap-1.5">
              <MobileHeaderNav />
              <Link
                to={brandHomeTo}
                search={brandHomeSearch}
                className="flex h-9 shrink-0 items-center text-base font-extrabold leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]"
              >
                VCB HRM
              </Link>
            </div>
            <div className="flex shrink-0 items-center">{toolbar}</div>
          </div>
          {compactNavNoSidebar && user ? (
            <div className="hidden w-full min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-1.5 sm:gap-2.5 sm:px-5 md:grid lg:gap-3 lg:px-6">
              <Link
                to={brandHomeTo}
                search={brandHomeSearch}
                className="flex h-9 shrink-0 items-center text-base font-extrabold leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)] sm:text-[17px]"
              >
                VCB HRM
              </Link>
              <div className="relative min-h-9 min-w-0 overflow-visible">
                <div className="inline-flex max-w-full">
                  <MemberLeaderHeaderNav />
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-self-end pl-1.5 sm:pl-2.5 md:pl-3">
                {toolbar}
              </div>
            </div>
          ) : (
            <div className="mx-auto hidden w-full max-w-[1400px] min-h-14 flex-wrap items-center gap-2 px-5 py-2 sm:gap-3 md:flex md:px-6">
              {title ? (
                <span className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)] sm:text-[18px]">
                  {title}
                </span>
              ) : (
                <span className="min-w-0 flex-1" aria-hidden />
              )}
              {toolbar}
            </div>
          )}
        </header>
        <main
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-x-hidden overscroll-y-contain',
            wideMain
              ? cskhAuditLayout
                ? 'h-full overflow-y-hidden p-3 sm:p-4'
                : 'h-full min-h-0 overflow-hidden p-2 sm:p-3'
              : 'overflow-y-auto p-6'
          )}
        >
          <div
            key={pathname}
            className={cn(
              'mx-auto w-full animate-page-entrance',
              wideMain ? 'flex h-full min-h-0 max-w-none flex-col' : 'max-w-full'
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <AssistantWidget />
      </Suspense>
    </div>
  )
}
