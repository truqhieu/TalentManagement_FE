import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Award, Eye, EyeOff, KeyRound, Loader2, Lock, Trophy, User } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { InputController } from '@/components/ui/form-controllers'
import { useAuthStore } from '@/stores/auth.store'
import { authApi } from '@/features/auth/api'
import { loginRequestSchema } from '@/features/auth/schemas'
import { useLogin } from '@/features/auth/hooks'
import { defaultEntryPathFromSession } from '@/lib/routeGuards'
import { MOCK_ACCOUNT_LIST, MOCK_PASSWORD } from '@/features/auth/mock/mockAccounts'
import { ensureSessionFromCookie } from '@/features/auth/sessionBootstrap'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { ROLE_LABEL_VI } from '@/lib/roleLabels'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  oauth: z.enum(['success', 'error']).optional(),
  token: z.string().optional(),
  /** BE redirect kèm lý do (OAuth / JWT / cookie). */
  msg: z.string().optional(),
})

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (raw) => loginSearchSchema.parse(raw),
  beforeLoad: async ({ search }) => {
    if (search.oauth === 'success' || search.oauth === 'error') return
    await ensureSessionFromCookie()
    const { user } = useAuthStore.getState()
    if (user) {
      const target = defaultEntryPathFromSession(user ?? undefined)
      if (target === '/hr-admin')
        throw redirect({ to: '/hr-admin', search: { page: 1, pageSize: 15 } })
      throw redirect({ to: target })
    }
  },
  component: LoginPage,
})

type LoginForm = z.infer<typeof loginRequestSchema>

/** Tránh open redirect; chỉ cho path nội bộ (pathname bắt đầu bằng `/`, không phải `//...`). */
function isSafeInternalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

function LoginPage() {
  const navigate = useNavigate()
  const login = useLogin()
  const search = Route.useSearch()
  const setSession = useAuthStore((s) => s.setSession)
  const [showPassword, setShowPassword] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(search.oauth === 'success')
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { username: '', password: '' },
  })
  const mockApi = isMockApiEnabled()

  const apiBase = import.meta.env.VITE_API_URL ?? ''
  const googleOAuthHref = apiBase ? `${apiBase.replace(/\/$/, '')}/auth/google` : ''
  const useRealGoogleOAuth = !mockApi && Boolean(googleOAuthHref)
  const showPasswordForm = mockApi || useRealGoogleOAuth

  const appName = import.meta.env.VITE_APP_NAME ?? 'VCB HRM'

  const onAuthSuccess = useCallback(() => {
    setIsRedirecting(true)
    if (search.redirect && isSafeInternalRedirect(search.redirect)) {
      void navigate({ href: search.redirect })
      return
    }
    const u = useAuthStore.getState().user
    const target = defaultEntryPathFromSession(u ?? undefined)
    if (target === '/hr-admin')
      void navigate({ to: '/hr-admin', search: { page: 1, pageSize: 15 } })
    else void navigate({ to: target })
  }, [navigate, search.redirect])

  useEffect(() => {
    if (search.oauth === 'error') {
      const detail = search.msg?.trim()
      toast.error(
        detail
          ? `Đăng nhập thất bại: ${detail}`
          : 'Đăng nhập Google thất bại hoặc email chưa có trong hệ thống.'
      )
      void navigate({ to: '/login', search: { redirect: search.redirect }, replace: true })
      return
    }
    if (search.oauth !== 'success') return
    setIsRedirecting(true)
    void (async () => {
      try {
        if (search.token) {
          // Gán token tạm thời để authApi.me() có thể sử dụng Authorization header
          setSession(null as any, search.token)
        }
        const d = await authApi.me()
        if (!d.user) {
          throw new Error('Không lấy được phiên sau OAuth')
        }
        setSession(d.user, d.accessToken ?? search.token ?? null)
        onAuthSuccess()
      } catch (err) {
        toast.error(
          'Không lấy được phiên đăng nhập. Kiểm tra cookie tm_session, VITE_API_URL và cấu hình OAuth.'
        )
        console.warn('[login oauth=success] GET /auth/me failed', err)
        void navigate({ to: '/login', search: { redirect: search.redirect }, replace: true })
      }
    })()
  }, [search.oauth, search.msg, search.redirect, navigate, setSession, onAuthSuccess])

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-sm text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={2} />
          <p className="font-medium text-muted-foreground animate-pulse">
            Đang xác thực phiên đăng nhập...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 text-sm leading-relaxed text-foreground transition-all duration-500">
      <div className="relative z-0 flex w-full max-w-[420px] flex-col items-stretch">
        <div
          className={cn(
            'rounded-xl bg-card p-10 shadow-[var(--shadow-card)]',
            'border border-border',
            'animate-in fade-in slide-in-from-bottom-4 duration-700'
          )}
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] bg-primary text-primary-foreground shadow-sm">
              <Award className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[26px]">
              {appName}
            </div>
            <div className="mt-1.5 text-sm font-normal text-muted-foreground">
              Quản trị Hiệu suất Ưu tú
            </div>
          </div>

          {useRealGoogleOAuth ? (
            <div className="mb-2 flex flex-col items-stretch gap-3">
              <a
                href={googleOAuthHref}
                onClick={() => setIsRedirecting(true)}
                className={cn(
                  'group relative flex h-[52px] w-full items-center justify-center gap-3 overflow-hidden rounded-xl',
                  'border-2 border-border bg-card px-4 text-[15px] font-semibold tracking-tight text-foreground',
                  'shadow-[var(--shadow-card)] transition-all duration-200',
                  'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]',
                  'active:translate-y-0 active:shadow-[var(--shadow-card)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card'
                )}
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  aria-hidden
                >
                  <span className="absolute -left-1/4 top-0 h-full w-1/2 skew-x-12 bg-gradient-to-r from-transparent via-blue-400/15 to-transparent blur-sm" />
                </span>
                <svg
                  className="relative z-[1] h-[22px] w-[22px] shrink-0 transition-transform duration-200 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="relative z-[1]">Đăng nhập với Google</span>
              </a>
            </div>
          ) : !mockApi && !googleOAuthHref ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              Cấu hình <code className="font-mono text-xs">VITE_API_URL</code> trỏ tới BE và trên BE
              bật <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code>,{' '}
              <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code>,{' '}
              <code className="font-mono text-xs">FRONTEND_URL</code>. Hoặc bật{' '}
              <code className="font-mono text-xs">VITE_USE_MOCK_API</code> để demo.
            </p>
          ) : null}

          {useRealGoogleOAuth && showPasswordForm ? (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">hoặc</span>
              </div>
            </div>
          ) : null}

          {showPasswordForm ? (
            <Form {...form}>
              <form
                className="space-y-0"
                onSubmit={form.handleSubmit((v) =>
                  login.mutate(v, {
                    onSuccess: onAuthSuccess,
                  })
                )}
              >
                <div className="mb-4">
                  <InputController
                    control={form.control}
                    name="username"
                    label="Username"
                    labelClassName="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    type="text"
                    autoComplete="username"
                    placeholder="Username"
                    inputClassName={cn(
                      'h-12 rounded-lg border border-border bg-background py-3 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground',
                      'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25'
                    )}
                    startSlot={
                      <User
                        className="h-[18px] w-[18px] text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                      />
                    }
                  />
                </div>

                <div className="mb-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mật khẩu
                    </span>
                    {/* <a
                      href="#"
                      className="text-xs font-medium text-primary hover:opacity-90"
                      onClick={(e) => e.preventDefault()}
                    >
                      Chính sách bảo mật
                    </a> */}
                  </div>
                  <InputController
                    control={form.control}
                    name="password"
                    label="Mật khẩu"
                    labelClassName="sr-only"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    inputClassName={cn(
                      'h-12 rounded-lg border border-border bg-background py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground',
                      'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25'
                    )}
                    startSlot={
                      <Lock
                        className="h-[18px] w-[18px] text-muted-foreground"
                        strokeWidth={2}
                        aria-hidden
                      />
                    }
                    endSlot={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        onClick={() => setShowPassword((s) => !s)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-[18px] w-[18px]" />
                        ) : (
                          <Eye className="h-[18px] w-[18px]" />
                        )}
                      </Button>
                    }
                  />
                </div>

                <Button
                  type="submit"
                  disabled={login.isPending || isRedirecting}
                  className="mt-5 h-12 w-full rounded-lg text-base shadow-sm bg-primary text-white hover:bg-primary/90 transition-all hover:opacity-[0.96] active:scale-[0.98]"
                >
                  {login.isPending || isRedirecting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Đăng nhập'
                  )}
                </Button>
              </form>
            </Form>
          ) : null}

          {mockApi ? (
            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Tài khoản demo (mock)
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Mật khẩu chung:{' '}
                <code className="rounded-md bg-primary/5 px-1.5 py-0.5 font-mono text-xs text-primary ring-1 ring-primary/15">
                  {MOCK_PASSWORD}
                </code>
                . Chọn một dòng để điền username và mật khẩu.
              </p>
              <ul
                className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-0.5 [-webkit-overflow-scrolling:touch]"
                aria-label="Danh sách tài khoản thử"
              >
                {MOCK_ACCOUNT_LIST.map((acc) => (
                  <li key={acc.username}>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-auto w-full justify-start rounded-lg border-border bg-muted/50 px-3 py-2.5 text-left text-xs font-normal normal-case tracking-normal',
                        'hover:border-primary/35 hover:bg-primary/[0.06]'
                      )}
                      onClick={() => {
                        form.setValue('username', acc.username, { shouldValidate: true })
                        form.setValue('password', MOCK_PASSWORD, { shouldValidate: true })
                      }}
                    >
                      <span className="font-mono text-xs font-semibold text-foreground sm:text-xs">
                        {acc.username}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground sm:text-xs">
                        <span className="font-medium text-primary/90">
                          {ROLE_LABEL_VI[acc.role]}
                        </span>
                        {' — '}
                        {acc.description}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 text-center text-sm text-muted-foreground">
        <Link to="/" className="font-medium text-primary hover:underline">
          ← Về trang giới thiệu
        </Link>
      </div>

      <div
        className="pointer-events-none fixed bottom-4 right-4 z-10 max-w-[min(calc(100vw-2rem),260px)] rounded-xl border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-card)] sm:bottom-6 sm:right-6 sm:px-4 sm:py-3"
        style={{ borderRadius: 12 }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Trophy className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              THÀNH TÍCH GẦN ĐÂY
            </p>
            <p className="mt-0.5 text-sm font-bold leading-snug text-foreground">
              Top 5 Cụm Hiệu suất
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
