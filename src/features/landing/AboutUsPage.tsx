import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Award,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Images,
  LayoutDashboard,
  LogIn,
  Quote,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { defaultEntryPathFromSession } from '@/lib/routeGuards'
import { useAuthStore } from '@/stores/auth.store'
import { usePermission } from '@/hooks/usePermission'
import { fetchCompanyLandingPublic } from '@/features/landing/companyLandingApi'
import { DEFAULT_COMPANY_LANDING_CONTENT } from '@/features/landing/landingContent.defaults'
import { landingLucide } from '@/features/landing/landingContent.icons'
import { mergeCompanyLandingContent } from '@/features/landing/landingContent.merge'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'

const appName = import.meta.env.VITE_APP_NAME ?? 'VCB HRM'

/** Ảnh landing: `/uploads/...` qua API, còn `/Image_VCB/...` giữ nguyên host FE. */
function landingPublicImgSrc(ref: string): string {
  const t = ref.trim()
  if (!t) return ref
  return resolvePublicAssetUrl(t) ?? ref
}

/* ────────────────────────────────────────────────────────────────────────
 *  Motion helpers
 * ────────────────────────────────────────────────────────────────────── */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = () => setReduced(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return reduced
}

function useReveal(reduced: boolean, threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(reduced)

  useEffect(() => {
    if (reduced) {
      queueMicrotask(() => setVisible(true))
      return
    }
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          queueMicrotask(() => setVisible(true))
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -5% 0px', threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [reduced, threshold])

  return { ref, visible }
}

function Reveal({
  reduced,
  children,
  className,
  delayMs = 0,
}: {
  reduced: boolean
  children: ReactNode
  className?: string
  delayMs?: number
}) {
  const { ref, visible } = useReveal(reduced)
  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className
      )}
      style={{ transitionDelay: visible && !reduced ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 *  Image placeholder – khung trắng để user add ảnh sau
 * ────────────────────────────────────────────────────────────────────── */

function ImageFrame({
  aspect = 'aspect-[4/3]',
  label = 'Thêm ảnh',
  className,
  shape = 'rounded-2xl',
}: {
  aspect?: string
  label?: string
  className?: string
  shape?: string
}) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-sm',
        shape,
        aspect,
        className
      )}
    >
      {/* Pattern lưới nhẹ */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.25) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center text-slate-400">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
          <Images className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 *  Trang chính
 * ────────────────────────────────────────────────────────────────────── */

export function AboutUsPage() {
  const reduced = usePrefersReducedMotion()
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthed = Boolean(user || accessToken)
  const dashboardPath = defaultEntryPathFromSession(user ?? undefined)
  const { canId } = usePermission()
  const canEditLanding = canId('company.landing.edit')

  const { data: landingPatch } = useQuery({
    queryKey: ['company-landing', 'public'],
    queryFn: fetchCompanyLandingPublic,
    staleTime: 5 * 60_000,
  })
  const c = useMemo(
    () => mergeCompanyLandingContent(DEFAULT_COMPANY_LANDING_CONTENT, landingPatch ?? undefined),
    [landingPatch]
  )

  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    window.scrollTo(0, 0)
  }, [])

  return (
    <div
      ref={scrollRef}
      // html/body trong dự án đặt overflow:hidden (AppShell HRM quản lý scroll nội bộ),
      // nên landing page phải tự làm scroll container với h-screen + overflow-y-auto.
      className="relative h-screen overflow-x-hidden overflow-y-auto bg-white text-slate-900 scroll-smooth"
    >
      {/* Trang trí nền */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl motion-reduce:animate-none animate-[guest-landing-float-soft_14s_ease-in-out_infinite]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 top-48 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl motion-reduce:animate-none animate-[guest-landing-float-soft_18s_ease-in-out_infinite_2s]"
        aria-hidden
      />

      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-md',
          reduced
            ? 'opacity-100'
            : 'motion-reduce:animate-none animate-[guest-landing-fade-in_0.45s_ease-out_both]'
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Award className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg sm:text-[1.125rem]">{c.header.brandName}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
            <a href="#vision-mission" className="transition-colors hover:text-primary">
              {c.header.navVisionMission}
            </a>
            <a href="#ecosystem" className="transition-colors hover:text-primary">
              {c.header.navEcosystem}
            </a>
            <a href="#introduction" className="transition-colors hover:text-primary">
              {c.header.navIntroduction}
            </a>
            <a href="#strategy" className="transition-colors hover:text-primary">
              {c.header.navStrategy}
            </a>
            <a href="#leadership" className="transition-colors hover:text-primary">
              {c.header.navLeadership}
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {isAuthed && canEditLanding ? (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 bg-white/90 shadow-sm"
                asChild
              >
                <Link to="/hr-admin/settings/company-landing">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Sửa trang giới thiệu
                </Link>
              </Button>
            ) : null}
            {isAuthed ? (
              <Button
                size="sm"
                className="shadow-sm bg-primary text-white hover:bg-primary/90"
                asChild
              >
                <Link
                  to={dashboardPath}
                  {...(dashboardPath === '/hr-admin' ? { search: { page: 1, pageSize: 15 } } : {})}
                >
                  <LayoutDashboard className="h-4 w-4" aria-hidden />
                  Vào hệ thống
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="shadow-sm bg-primary text-white hover:bg-primary/90"
                asChild
              >
                <Link to="/login" preload={false}>
                  <LogIn className="h-4 w-4" aria-hidden />
                  Đăng nhập {appName}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ─────────── HERO: full viewport, tagline + ảnh tập thể ─────────── */}
        <section
          id="hero"
          className="relative z-10 flex min-h-[calc(100vh-64px)] flex-col justify-center overflow-hidden"
        >
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
            <div
              className={cn(
                'flex flex-col items-center text-center',
                reduced
                  ? 'opacity-100'
                  : 'motion-reduce:animate-none animate-[guest-landing-hero-in_0.8s_ease-out_both]'
              )}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-amber-800 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {c.hero.badge}
              </span>
              <h1 className="mt-5 flex flex-col items-center gap-2 text-balance text-center text-4xl font-extrabold tracking-tight text-slate-900 sm:gap-3 sm:text-6xl lg:text-7xl">
                <span className="block max-w-[22ch] leading-[1.22] sm:leading-[1.18]">
                  {c.hero.titleLine1Before}
                  <span className="text-primary">{c.hero.titleLine1Highlight}</span>
                </span>
                <span className="block max-w-[20ch] leading-[1.22] sm:leading-[1.18]">
                  {c.hero.titleLine2Before}
                  <span className="inline-block rounded-md bg-amber-200/75 px-2 py-0.5 text-orange-600 shadow-none">
                    {c.hero.titleLine2Highlight}
                  </span>
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg lg:text-xl">
                {c.hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="shadow-md bg-primary text-white hover:bg-primary/90"
                  asChild
                >
                  <a href="#vision-mission">
                    {c.hero.exploreCta}
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </a>
                </Button>
                {isAuthed ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-white/80 backdrop-blur-sm"
                    asChild
                  >
                    <Link
                      to={dashboardPath}
                      {...(dashboardPath === '/hr-admin'
                        ? { search: { page: 1, pageSize: 15 } }
                        : {})}
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden />
                      Vào hệ thống
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-white/80 backdrop-blur-sm"
                    asChild
                  >
                    <Link to="/login" preload={false}>
                      <LogIn className="h-4 w-4" aria-hidden />
                      Đăng nhập {appName}
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Team photo — hiển thị nguyên khung ảnh (không crop) */}
            <Reveal reduced={reduced} className="mt-12 sm:mt-16">
              <div className="relative">
                <div
                  className="pointer-events-none absolute -inset-2 -z-10 rounded-[28px] bg-gradient-to-br from-primary/20 via-amber-200/30 to-indigo-200/20 blur-xl"
                  aria-hidden
                />
                <img
                  src={landingPublicImgSrc(c.hero.teamImageSrc)}
                  alt={c.hero.teamImageAlt}
                  className="relative z-0 mx-auto block h-auto w-full max-w-full rounded-3xl shadow-xl ring-1 ring-slate-200"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </Reveal>
          </div>

          {/* Mũi tên cuộn xuống */}
          <a
            href="#vision-mission"
            className={cn(
              'absolute bottom-5 left-1/2 -translate-x-1/2 text-slate-400 transition-colors hover:text-primary',
              reduced
                ? 'opacity-100'
                : 'motion-reduce:animate-none animate-[about-scroll-bounce_1.8s_ease-in-out_infinite]'
            )}
            aria-label="Cuộn xuống"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 shadow-sm backdrop-blur-sm">
              <ChevronDown className="h-5 w-5" aria-hidden />
            </span>
          </a>
        </section>

        {/* ─────────── SECTION 1: TẦM NHÌN & SỨ MỆNH (ảnh 1) ─────────── */}
        <section
          id="vision-mission"
          className="relative z-10 scroll-mt-20 border-t border-slate-100 bg-gradient-to-b from-slate-50/70 to-white py-20 sm:py-28 lg:py-32"
        >
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
            <Reveal reduced={reduced}>
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  {(() => {
                    const KickerIcon = landingLucide(c.visionMissionSection.kickerIcon)
                    return <KickerIcon className="h-3.5 w-3.5" aria-hidden />
                  })()}
                  {c.visionMissionSection.kicker}
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                  {c.visionMissionSection.title}
                </h2>
                <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
                  {c.visionMissionSection.subtitle}
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <Reveal reduced={reduced}>
                <article className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-10">
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-primary/80 to-primary/20" />
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20">
                    {(() => {
                      const VisionIcon = landingLucide(c.vision.icon)
                      return <VisionIcon className="h-8 w-8" aria-hidden />
                    })()}
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {c.vision.title}
                  </h3>
                  <p className="mt-5 text-base leading-relaxed text-slate-700 sm:text-lg">
                    {c.vision.lead}
                  </p>
                  <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-primary">
                    {c.vision.subHeading}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {c.vision.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-700"
                      >
                        <span
                          className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>

              <Reveal reduced={reduced} delayMs={150}>
                <article className="relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:p-10">
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300/40" />
                  <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-600 ring-1 ring-amber-500/20">
                    {(() => {
                      const MissionIcon = landingLucide(c.mission.icon)
                      return <MissionIcon className="h-8 w-8" aria-hidden />
                    })()}
                  </div>
                  <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {c.mission.title}
                  </h3>
                  <ul className="mt-5 space-y-3">
                    {c.mission.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-700"
                      >
                        <span
                          className="mt-2 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
                          aria-hidden
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 rounded-2xl border-l-4 border-amber-400 bg-amber-50/60 px-5 py-4">
                    <p className="text-[15px] italic leading-relaxed text-slate-700">
                      {c.mission.closing}
                    </p>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─────────── SECTION 2: HỆ SINH THÁI NGHỆ NHÂN (ảnh 2) ─────────── */}
        <section id="ecosystem" className="relative z-10 scroll-mt-20 bg-white">
          {/* Không dùng margin âm kéo ảnh lên — tránh đè tiêu đề; navy chỉ phủ nửa dưới */}
          <div className="relative isolate overflow-hidden pb-20 sm:pb-28">
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 top-[46%] min-h-[260px] bg-[#1b3568] sm:min-h-[300px]"
              aria-hidden
            />

            <div className="relative z-10 mx-auto max-w-[1400px] px-4 pt-24 sm:px-6 sm:pt-28">
              <Reveal reduced={reduced}>
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {c.ecosystem.sectionTitle}
                  </h2>
                  <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-primary" />
                </div>
              </Reveal>

              <ul className="mt-14 grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
                {c.ecosystem.items.map((item, i) => (
                  <Reveal key={item.label} reduced={reduced} delayMs={i * 120}>
                    <li className="group mx-auto flex w-full max-w-[320px] flex-col items-center">
                      {i === 0 ? (
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1">
                          <div className="grid h-full w-full grid-rows-2 gap-px bg-white/90">
                            <img
                              src={landingPublicImgSrc(c.ecosystem.artisanBanner.precision)}
                              alt={c.ecosystem.artisanAltPrecision}
                              className="h-full w-full object-cover object-center"
                              loading="lazy"
                              decoding="async"
                            />
                            <img
                              src={landingPublicImgSrc(c.ecosystem.artisanBanner.leather)}
                              alt={c.ecosystem.artisanAltLeather}
                              className="h-full w-full object-cover object-center"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        </div>
                      ) : (item.imageSrc ??
                        DEFAULT_COMPANY_LANDING_CONTENT.ecosystem.items[i]?.imageSrc) ? (
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1">
                          <img
                            src={landingPublicImgSrc(
                              (item.imageSrc ??
                                DEFAULT_COMPANY_LANDING_CONTENT.ecosystem.items[i]?.imageSrc)!
                            )}
                            alt={
                              item.imageAlt ??
                              DEFAULT_COMPANY_LANDING_CONTENT.ecosystem.items[i]?.imageAlt ??
                              item.label
                            }
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <ImageFrame
                          aspect="aspect-[3/4]"
                          label={item.label}
                          shape="rounded-2xl"
                          className="w-full shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1"
                        />
                      )}
                      {/* Đường nối đứng */}
                      <div className="relative flex h-10 w-10 flex-col items-center">
                        <span className="block h-full w-px bg-white/60" aria-hidden />
                        <span
                          className="absolute bottom-0 block h-3 w-3 rounded-full bg-white ring-4 ring-white/30"
                          aria-hidden
                        />
                      </div>
                      <h3 className="mt-3 text-center text-base font-extrabold tracking-[0.12em] text-white sm:text-lg">
                        {item.label}
                      </h3>
                      <p className="mt-1.5 max-w-[280px] text-center text-sm text-white/80">
                        {item.desc}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─────────── SECTION 3: GIỚI THIỆU VIỄN CHÍ BẢO (ảnh 3) ─────────── */}
        <section
          id="introduction"
          className="relative z-10 scroll-mt-20 bg-gradient-to-b from-white to-slate-50/60 py-20 sm:py-28 lg:py-32"
        >
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
            <Reveal reduced={reduced}>
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
                <div
                  className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -right-16 -bottom-16 h-40 w-40 rounded-full bg-amber-200/30 blur-3xl"
                  aria-hidden
                />

                <div className="relative">
                  <div className="text-center">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                      {c.introduction.sectionTitle}
                    </h2>
                    <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-primary" />
                  </div>

                  <div className="mx-auto mt-8 max-w-[900px] space-y-5 text-[15px] leading-[1.85] text-slate-700 sm:text-[16px]">
                    {c.introduction.paragraphs.map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─────────── SECTION 4: ĐỊNH VỊ CHIẾN LƯỢC (ảnh 4) ─────────── */}
        <section id="strategy" className="relative z-10 scroll-mt-20 bg-white">
          <div className="relative isolate overflow-hidden pb-20 sm:pb-28">
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 top-[46%] min-h-[260px] bg-[#1b3568] sm:min-h-[300px]"
              aria-hidden
            />

            <div className="relative z-10 mx-auto max-w-[1400px] px-4 pt-24 sm:px-6 sm:pt-28">
              <Reveal reduced={reduced}>
                <div className="text-center">
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {c.strategy.sectionTitle}
                  </h2>
                  <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-primary" />
                </div>
              </Reveal>

              <Reveal reduced={reduced} delayMs={100}>
                <div className="relative z-20 mx-auto mt-10 max-w-3xl">
                  <div className="relative rounded-xl border-2 border-primary/60 bg-white px-6 py-6 pt-12 text-center text-[15px] leading-relaxed text-slate-700 shadow-sm sm:px-8 sm:py-7 sm:pt-10 sm:text-base">
                    <Quote
                      className="absolute left-4 top-4 h-6 w-6 text-primary sm:left-5 sm:top-5"
                      aria-hidden
                    />
                    {c.strategy.bannerQuote}
                  </div>
                </div>
              </Reveal>

              <ul className="relative z-10 mt-14 grid items-start gap-8 sm:grid-cols-3 lg:gap-10">
                {c.strategy.pillars.map((p, i) => (
                  <Reveal key={p.label} reduced={reduced} delayMs={i * 120}>
                    <li className="group mx-auto flex w-full max-w-[320px] flex-col items-center">
                      {i === 0 ? (
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1">
                          <img
                            src={landingPublicImgSrc(c.strategy.traditionalImageSrc)}
                            alt={c.strategy.traditionalImageAlt}
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (p.imageSrc ??
                        DEFAULT_COMPANY_LANDING_CONTENT.strategy.pillars[i]?.imageSrc) ? (
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1">
                          <img
                            src={landingPublicImgSrc(
                              (p.imageSrc ??
                                DEFAULT_COMPANY_LANDING_CONTENT.strategy.pillars[i]?.imageSrc)!
                            )}
                            alt={
                              p.imageAlt ??
                              DEFAULT_COMPANY_LANDING_CONTENT.strategy.pillars[i]?.imageAlt ??
                              p.label
                            }
                            className="h-full w-full object-cover object-center"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      ) : (
                        <ImageFrame
                          aspect="aspect-[3/4]"
                          label={p.label}
                          shape="rounded-2xl"
                          className="w-full shadow-lg ring-4 ring-white transition-transform duration-500 group-hover:-translate-y-1"
                        />
                      )}
                      <div className="relative flex h-10 w-10 flex-col items-center">
                        <span className="block h-full w-px bg-white/60" aria-hidden />
                        <span
                          className="absolute bottom-0 block h-3 w-3 rounded-full bg-white ring-4 ring-white/30"
                          aria-hidden
                        />
                      </div>
                      <h3 className="mt-3 text-center text-base font-extrabold tracking-[0.12em] text-white sm:text-lg">
                        {p.label}
                      </h3>
                      <p className="mt-1.5 max-w-[280px] text-center text-sm text-white/80">
                        {p.desc}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ─────────── SECTION 5: BAN ĐIỀU HÀNH CÔNG TY (ảnh 5) ─────────── */}
        <section
          id="leadership"
          className="relative z-10 scroll-mt-20 bg-[#1b3568] py-20 sm:py-28 lg:py-32"
        >
          {/* Pattern trang trí */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.6) 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6">
            <Reveal reduced={reduced}>
              <div className="text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
                  {(() => {
                    const BadgeIcon = landingLucide(c.leadership.badgeIcon)
                    return <BadgeIcon className="h-3.5 w-3.5" aria-hidden />
                  })()}
                  {c.leadership.badge}
                </span>
                <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {c.leadership.sectionTitle}
                </h2>
                <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-white/70" />
              </div>
            </Reveal>

            <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              {c.leadership.leaders.map((person, i) => (
                <Reveal key={person.name} reduced={reduced} delayMs={i * 90}>
                  <li className="flex h-full flex-col items-center">
                    {/* Avatar tròn */}
                    <div className="relative shrink-0">
                      <div
                        className="absolute inset-0 rounded-full bg-white/10 blur-xl"
                        aria-hidden
                      />
                      <div className="relative h-40 w-40 overflow-hidden rounded-full ring-4 ring-white/30 sm:h-44 sm:w-44">
                        <img
                          src={landingPublicImgSrc(person.photo)}
                          alt={`Chân dung ${person.name} — ${person.role}`}
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <h3 className="text-lg font-extrabold text-white">{person.name}</h3>
                      <p className="mt-0.5 text-sm italic text-white/70">{person.role}</p>
                    </div>
                    <ul className="mt-4 w-full space-y-2">
                      {person.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2 text-left text-sm leading-relaxed text-white/85"
                        >
                          <span
                            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"
                            aria-hidden
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ─────────── SECTION 6: TỔNG QUAN CÔNG TY (ảnh 6) ─────────── */}
        <section id="overview" className="relative z-10 scroll-mt-20 py-20 sm:py-28 lg:py-32">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
            <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
              {/* Cột trái: ảnh grid + stat */}
              <div className="space-y-6">
                <Reveal reduced={reduced}>
                  <div className="relative">
                    {/* Khung đỏ decor ôm khối ảnh – gợi lại style Canva */}
                    <div
                      className="absolute -inset-3 rounded-2xl border-[3px] border-red-500/80"
                      aria-hidden
                    />
                    <div className="relative overflow-hidden rounded-xl bg-white p-2 shadow-md ring-1 ring-slate-200/90">
                      <img
                        src={landingPublicImgSrc(c.overview.socialBannerSrc)}
                        alt={c.overview.socialBannerAlt}
                        className="block h-auto w-full rounded-lg"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                </Reveal>

                <Reveal reduced={reduced} delayMs={120}>
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="text-6xl font-black leading-none text-red-600 sm:text-7xl">
                      {c.overview.videoStatValue}
                    </span>
                    <div className="mb-1 flex flex-col text-sm font-extrabold uppercase tracking-[0.15em] text-slate-700">
                      <span className="text-red-600">{c.overview.videoStatLine1}</span>
                      <span>{c.overview.videoStatLine2}</span>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      {c.overview.sectionKicker}
                    </p>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                      {c.overview.sectionTitle}
                    </h2>
                    <div className="h-1 w-16 rounded-full bg-red-500" />
                  </div>
                  <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-600">
                    {c.overview.leadParagraph}
                  </p>
                </Reveal>
              </div>

              {/* Cột phải: 3 nguyên tắc thương hiệu */}
              <div className="space-y-5">
                <Reveal reduced={reduced}>
                  <p className="text-[15px] leading-relaxed text-slate-600">
                    {c.overview.brandIntro}
                  </p>
                </Reveal>

                <ul className="space-y-4">
                  {c.overview.brandPillars.map((p, i) => (
                    <Reveal key={p.text} reduced={reduced} delayMs={i * 110}>
                      <li
                        className={cn(
                          'group flex items-start gap-4 rounded-2xl border border-slate-200 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
                          i === 0 && 'bg-[#1b3568] text-white',
                          i === 1 && 'bg-slate-100',
                          i === 2 && 'bg-[#1b3568] text-white'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                            i === 1
                              ? 'bg-white text-slate-700 ring-1 ring-slate-200'
                              : 'bg-white/15 text-white ring-1 ring-white/30'
                          )}
                        >
                          {(() => {
                            const PillarIcon = landingLucide(p.icon)
                            return <PillarIcon className="h-5 w-5" aria-hidden />
                          })()}
                        </span>
                        <p
                          className={cn(
                            'text-[14.5px] font-semibold leading-relaxed',
                            i === 1 ? 'text-slate-800' : 'text-white'
                          )}
                        >
                          {p.text}
                        </p>
                      </li>
                    </Reveal>
                  ))}
                </ul>

                <Reveal reduced={reduced} delayMs={400}>
                  <p className="text-[15px] leading-relaxed text-slate-600">
                    {c.overview.closingParagraph}
                  </p>
                </Reveal>
              </div>
            </div>

            {/* Stats row */}
            <Reveal reduced={reduced} delayMs={200}>
              <div className="mt-14 grid gap-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 sm:grid-cols-4 sm:p-8">
                {c.overview.stats.map((s, i) => {
                  const StatIcon = landingLucide(s.icon)
                  return (
                    <div
                      key={s.desc}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
                        i !== 3 && 'sm:border-r sm:border-slate-200/80'
                      )}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <StatIcon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <p className="text-xl font-extrabold tracking-tight text-slate-900">
                          {s.label}
                        </p>
                        <p className="text-xs font-medium text-slate-500">{s.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA cuối */}
        <section className="relative z-10 pb-16 sm:pb-20">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
            <Reveal reduced={reduced}>
              <div className="overflow-hidden rounded-3xl vcb-banner-gradient px-6 py-10 text-white shadow-lg sm:px-10 sm:py-12">
                <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
                  <div className="max-w-2xl space-y-3">
                    <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {c.cta.title}
                    </h2>
                    <p className="text-[15px] leading-relaxed text-white/90 sm:text-base">
                      {c.cta.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {isAuthed ? (
                      <Button
                        size="lg"
                        className="border-0 bg-white font-semibold text-primary shadow-md hover:bg-slate-50"
                        asChild
                      >
                        <Link
                          to={dashboardPath}
                          {...(dashboardPath === '/hr-admin'
                            ? { search: { page: 1, pageSize: 15 } }
                            : {})}
                        >
                          <LayoutDashboard className="h-4 w-4" aria-hidden />
                          Vào hệ thống {appName}
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="border-0 bg-white font-semibold text-primary shadow-md hover:bg-slate-50"
                        asChild
                      >
                        <Link to="/login" preload={false}>
                          Truy cập {appName}
                          <ChevronRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/40 bg-white/10 font-semibold text-white backdrop-blur-sm hover:bg-white/20"
                      asChild
                    >
                      <a href="#vision-mission">
                        <BarChart3 className="h-4 w-4" aria-hidden />
                        {c.cta.secondaryButton}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 text-center text-xs leading-relaxed text-slate-500 sm:flex-row sm:px-6 sm:text-left">
          <p>
            © {new Date().getFullYear()} {c.footer.copyrightRest}
          </p>
          <div className="flex items-center gap-5">
            <a href="#introduction" className="font-medium text-primary hover:underline">
              {c.footer.linkIntro}
            </a>
            <a href="#leadership" className="font-medium text-primary hover:underline">
              {c.footer.linkLeadership}
            </a>
            <Link to="/" className="font-medium text-primary hover:underline">
              {c.footer.linkHomePrefix}
              {appName}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
