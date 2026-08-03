import { EmployeeAvatar } from '@/components/shared/EmployeeAvatar'
import { performanceApi } from '@/features/kpi-okr/api'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2,
  Building2,
  ChevronRight,
  Crown,
  Diamond,
  Rocket,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function currentYearMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function guessDepartment(teamName: string | null): string | null {
  if (!teamName) return null
  const t = teamName.toLowerCase()
  if (t.includes('kinh doanh') || t.includes('kd') || t.includes('sales')) return 'Phòng Kinh doanh'
  if (t.includes('traffic') || t.includes('huyk') || t.includes('global') || t.includes('đvkd'))
    return 'Marketing Traffic'
  if (t.includes('vận đơn') || t.includes('van don')) return 'Phòng Vận đơn'
  if (t.includes('livestream') || t.includes('live')) return 'Phòng Livestream'
  return null
}

// ─── Types ─────────────────────────────────────────────────────────────────

type HonorSlide =
  | {
      kind: 'individual'
      id: string
      displayName: string
      avatarUrl: string | null
      teamName: string | null
      departmentName: string | null
      kpiLabel: string
      valueFormatted: string
      unit: string
    }
  | {
      kind: 'team'
      id: string
      teamName: string
      departmentName: string | null
      kpiLabel: string
      valueFormatted: string
      unit: string
      memberCount: number
    }

// ─── Constants ─────────────────────────────────────────────────────────────

const SLIDE_INTERVAL = 4500

// ─── CSS Keyframes (injected once) ─────────────────────────────────────────

function SlideKeyframes() {
  return (
    <style>{`
      @keyframes vd-orb-a  { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.18);opacity:.6} }
      @keyframes vd-orb-b  { 0%,100%{transform:scale(1.1);opacity:.45} 50%{transform:scale(.92);opacity:.7} }
      @keyframes vd-orb-c  { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.22);opacity:.65} }
      @keyframes vd-ring-cw  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes vd-ring-ccw { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
      @keyframes vd-twinkle {
        0%,100%{opacity:.12;transform:scale(.55) translateY(0)}
        50%{opacity:1;transform:scale(1.7) translateY(-10px)}
      }
      @keyframes vd-glow {
        0%,100%{transform:scale(1) rotate(0deg);opacity:.9}
        50%{transform:scale(1.18) rotate(12deg);opacity:1}
      }
      @keyframes vd-float {
        0%,100%{transform:translateX(-50%) translateY(0) rotate(-4deg)}
        50%{transform:translateX(-50%) translateY(-5px) rotate(4deg)}
      }
      @keyframes vd-star {
        0%,100%{transform:scale(1) rotate(0deg)}
        50%{transform:scale(1.2) rotate(18deg)}
      }
      @keyframes vd-badge-glow {
        0%,100%{box-shadow:0 0 16px rgba(250,204,21,.35)}
        50%{box-shadow:0 0 38px rgba(250,204,21,.75)}
      }
      @keyframes vd-value-breathe {
        0%,100%{transform:scale(1)}
        50%{transform:scale(1.025)}
      }
      @keyframes vd-trophy {
        0%,100%{transform:translateY(0) rotate(0deg) scale(1)}
        50%{transform:translateY(-8px) rotate(6deg) scale(1.04)}
      }
      @keyframes vd-slide-in {
        from{opacity:0;transform:translateY(18px);filter:blur(8px)}
        to{opacity:1;transform:translateY(0);filter:blur(0)}
      }
      @keyframes vd-avatar-in {
        from{opacity:0;transform:scale(.7) translateX(-24px) rotate(-8deg);filter:blur(10px)}
        to{opacity:1;transform:scale(1) translateX(0) rotate(0deg);filter:blur(0)}
      }
    `}</style>
  )
}

// ─── Animated background orbs ────────────────────────────────────────────────

function AnimatedOrbs() {
  return (
    <>
      <div
        className="pointer-events-none absolute -left-32 top-4 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl"
        style={{ animation: 'vd-orb-a 5s ease-in-out infinite' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400/30 blur-3xl"
        style={{ animation: 'vd-orb-b 4.4s ease-in-out infinite' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-0 -right-20 h-64 w-64 rounded-full bg-yellow-300/35 blur-3xl"
        style={{ animation: 'vd-orb-c 4.8s ease-in-out infinite' }}
        aria-hidden
      />
    </>
  )
}

// ─── Rotating rings ───────────────────────────────────────────────────────────

function RotatingRings() {
  return (
    <>
      <div
        className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full border border-white/20"
        style={{ animation: 'vd-ring-cw 22s linear infinite' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-36 left-[42%] h-72 w-72 rounded-full border border-cyan-200/20"
        style={{ animation: 'vd-ring-ccw 26s linear infinite' }}
        aria-hidden
      />
    </>
  )
}

// ─── Particles ────────────────────────────────────────────────────────────────

function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: `${8 + ((i * 17) % 88)}%`,
        top: `${8 + ((i * 23) % 78)}%`,
        delay: (i % 7) * 0.25,
        size: i % 5 === 0 ? 4 : i % 3 === 0 ? 3 : 2,
        color:
          i % 4 === 0
            ? 'rgba(254,240,138,0.9)'
            : i % 4 === 1
              ? 'rgba(165,243,252,0.9)'
              : i % 4 === 2
                ? 'rgba(240,171,252,0.9)'
                : 'rgba(255,255,255,0.9)',
      })),
    []
  )

  return (
    <>
      {dots.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 24px ${p.color}`,
            animation: `vd-twinkle ${2.8 + (p.id % 4) * 0.35}s ease-in-out ${p.delay}s infinite`,
          }}
          aria-hidden
        />
      ))}
    </>
  )
}

// ─── Avatar section ───────────────────────────────────────────────────────────

function AvatarSection({ name, photoUrl }: { name: string; photoUrl?: string }) {
  return (
    <div
      className="relative mx-auto h-32 w-32 shrink-0 sm:h-36 sm:w-36 lg:mx-0"
      style={{ animation: 'vd-avatar-in .7s cubic-bezier(.22,1,.36,1) both' }}
    >
      {/* Glow ring behind avatar */}
      <div
        className="absolute -inset-2 rounded-full bg-gradient-to-br from-cyan-300 via-fuchsia-400 to-yellow-300 opacity-90 blur-xl"
        style={{ animation: 'vd-glow 3.2s ease-in-out infinite' }}
        aria-hidden
      />

      {/* Glass avatar */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-br from-fuchsia-100 via-cyan-100 to-yellow-50 p-[4px] shadow-[0_18px_55px_rgba(250,204,21,0.35)]">
        <div className="grid h-full w-full place-items-center rounded-full border border-white/80 bg-white/55 backdrop-blur-xl">
          <EmployeeAvatar
            name={name}
            photoUrl={photoUrl}
            className="h-full w-full rounded-full text-xl font-black text-slate-950"
          />
        </div>
      </div>

      {/* Sparkle badge below avatar */}
      <div
        className="absolute -bottom-2 left-1/2 grid h-11 w-11 place-items-center rounded-2xl border border-yellow-100/90 bg-gradient-to-b from-yellow-100 via-amber-300 to-pink-400 shadow-[0_10px_30px_rgba(250,204,21,0.55)]"
        style={{ animation: 'vd-float 2.4s ease-in-out infinite' }}
        aria-hidden
      >
        <Sparkles className="h-5 w-5 text-violet-950" />
      </div>

      {/* Dashed rotating ring */}
      <div
        className="absolute -inset-4 rounded-full border-2 border-dashed border-cyan-100/60"
        style={{ animation: 'vd-ring-cw 12s linear infinite' }}
        aria-hidden
      />

      {/* Star badge top-right */}
      <div
        className="absolute -right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-200 to-fuchsia-300 shadow-[0_0_25px_rgba(103,232,249,0.8)]"
        style={{ animation: 'vd-star 1.8s ease-in-out infinite' }}
        aria-hidden
      >
        <Star className="h-4 w-4 fill-white text-white" />
      </div>
    </div>
  )
}

// ─── Trophy decoration ────────────────────────────────────────────────────────

function TrophyBox() {
  return (
    <div className="relative hidden h-32 w-32 place-items-center lg:grid">
      <div
        className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-yellow-100 via-fuchsia-300 to-cyan-300 shadow-[0_0_55px_rgba(250,204,21,0.5)]"
        style={{ animation: 'vd-trophy 2.8s ease-in-out infinite' }}
        aria-hidden
      />
      <div className="absolute inset-4 rounded-[1.4rem] border-4 border-white/35 bg-white/35 backdrop-blur-sm" />
      <Trophy className="relative z-10 h-16 w-16 text-violet-950" />
      <Diamond className="absolute right-3 top-3 h-5 w-5 text-white drop-shadow-lg" />
      {/* Ribbon stripes */}
      <div
        className="absolute -bottom-7 left-6 h-12 w-7 rotate-12 bg-gradient-to-b from-amber-400 to-amber-700"
        style={{ clipPath: 'polygon(0 0,100% 0,78% 100%,50% 72%,20% 100%)' }}
        aria-hidden
      />
      <div
        className="absolute -bottom-7 right-6 h-12 w-7 -rotate-12 bg-gradient-to-b from-yellow-300 to-orange-600"
        style={{ clipPath: 'polygon(0 0,100% 0,78% 100%,50% 72%,20% 100%)' }}
        aria-hidden
      />
    </div>
  )
}

// ─── Individual slide ───────────────────────────────────────────────────────

function IndividualSlide({
  slide,
  month,
  year,
  onNext,
  compact,
}: {
  slide: Extract<HonorSlide, { kind: 'individual' }>
  month: number
  year: number
  onNext: () => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'relative grid items-center',
        compact
          ? 'min-h-[128px] gap-3 px-4 py-3 sm:min-h-[140px] sm:px-6 lg:grid-cols-[96px_1fr_96px_40px] lg:gap-4 lg:px-8'
          : 'min-h-[210px] gap-5 px-5 py-6 sm:min-h-[240px] sm:px-8 lg:grid-cols-[148px_1fr_148px_56px] lg:gap-7 lg:px-12'
      )}
      style={{ animation: 'vd-slide-in .55s cubic-bezier(.22,1,.36,1) both' }}
    >
      {/* Background decorations */}
      <AnimatedOrbs />
      <RotatingRings />
      <Particles />

      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.065]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px)',
          backgroundSize: '42px 42px',
        }}
        aria-hidden
      />
      {/* Shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'linear-gradient(100deg,transparent 0%,rgba(255,255,255,0.22) 42%,transparent 60%)',
        }}
        aria-hidden
      />

      {/* Col 1: Avatar */}
      <AvatarSection
        name={slide.displayName}
        photoUrl={slide.avatarUrl ? resolvePublicAssetUrl(slide.avatarUrl) : undefined}
      />

      {/* Col 2: Info */}
      <div className="relative z-10 min-w-0 text-center lg:text-left">
        {/* Name + rank badge */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 lg:justify-start"
          style={{ animation: 'vd-slide-in .55s .12s cubic-bezier(.22,1,.36,1) both' }}
        >
          <h2 className="truncate bg-gradient-to-r from-white via-cyan-100 to-yellow-100 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-[0_8px_24px_rgba(255,255,255,0.25)] sm:text-3xl lg:text-4xl">
            {slide.displayName}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-yellow-100/80 bg-gradient-to-r from-yellow-200 via-amber-300 to-pink-300 px-3.5 py-1.5 text-xs font-black tracking-wide text-violet-950 shadow-[0_0_28px_rgba(250,204,21,0.55)]"
            style={{ animation: 'vd-badge-glow 2.2s ease-in-out infinite' }}
          >
            <Crown className="h-3.5 w-3.5" />
            VINH DANH · T{month}/{year}
          </span>
        </div>

        {/* Tags */}
        <div
          className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
          style={{ animation: 'vd-slide-in .55s .24s cubic-bezier(.22,1,.36,1) both' }}
        >
          {slide.departmentName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3.5 py-1.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/20 backdrop-blur-md">
              <Rocket className="h-4 w-4 text-yellow-200" />
              {slide.departmentName}
            </span>
          )}
          {slide.teamName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3.5 py-1.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/20 backdrop-blur-md">
              <Zap className="h-4 w-4 text-cyan-200" />
              {slide.teamName}
            </span>
          )}
        </div>

        {/* KPI label */}
        <p
          className="mt-4 text-sm font-semibold text-violet-100/85"
          style={{ animation: 'vd-slide-in .55s .36s cubic-bezier(.22,1,.36,1) both' }}
        >
          <span className="text-yellow-200">✦</span> {slide.kpiLabel}
        </p>

        {/* Value */}
        <div
          className="mt-1 flex flex-wrap items-end justify-center gap-2 lg:justify-start"
          style={{ animation: 'vd-slide-in .55s .48s cubic-bezier(.22,1,.36,1) both' }}
        >
          <span
            className="bg-gradient-to-r from-white via-yellow-200 to-cyan-200 bg-clip-text text-3xl font-black tracking-[0.04em] text-transparent drop-shadow-[0_0_30px_rgba(250,204,21,0.35)] sm:text-4xl lg:text-5xl"
            style={{ animation: 'vd-value-breathe 2.1s ease-in-out infinite' }}
          >
            {slide.valueFormatted}
          </span>
          <span className="pb-1 text-lg font-black tracking-wide text-yellow-200 sm:text-xl">
            {slide.unit}
          </span>
        </div>
      </div>

      {/* Col 3: Trophy */}
      <div className="relative z-10">
        <TrophyBox />
      </div>

      {/* Col 4: Nav button */}
      <div className="relative z-10 hidden lg:block">
        <button
          type="button"
          onClick={onNext}
          aria-label="Slide tiếp theo"
          className="grid h-14 w-14 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-white/30 to-white/10 text-white shadow-[0_0_35px_rgba(103,232,249,0.35)] backdrop-blur-md transition hover:scale-105 hover:bg-white/25 active:scale-95 focus:outline-none focus:ring-2 focus:ring-yellow-200"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

// ─── Team slide ─────────────────────────────────────────────────────────────

const MEMBER_AVATAR_COLORS = [
  'from-cyan-300 to-blue-500',
  'from-fuchsia-300 to-violet-500',
  'from-yellow-200 to-amber-400',
  'from-emerald-300 to-teal-500',
  'from-rose-300 to-pink-500',
  'from-indigo-300 to-purple-500',
]

function MemberAvatarRow({ count }: { count: number }) {
  const MAX_CIRCLES = 5
  const showExtra = count > MAX_CIRCLES
  const circleCount = showExtra ? MAX_CIRCLES - 1 : count
  const extraCount = showExtra ? count - (MAX_CIRCLES - 1) : 0

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-indigo-200/75">
        {count} thành viên
      </span>
      <div className="flex -space-x-3">
        {Array.from({ length: circleCount }, (_, i) => (
          <div
            key={i}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-indigo-950 bg-gradient-to-br text-xs font-black text-white shadow-lg',
              MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length]
            )}
            style={{
              animation: `vd-avatar-in .5s ${0.45 + i * 0.07}s cubic-bezier(.22,1,.36,1) both`,
            }}
            aria-hidden
          >
            {i + 1}
          </div>
        ))}
        {extraCount > 0 && (
          <div
            className="grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-indigo-950 bg-white/20 text-xs font-black text-white shadow-lg backdrop-blur-md"
            style={{
              animation: `vd-avatar-in .5s ${0.45 + circleCount * 0.07}s cubic-bezier(.22,1,.36,1) both`,
            }}
            aria-hidden
          >
            +{extraCount}
          </div>
        )}
      </div>
    </div>
  )
}

function TeamSlide({
  slide,
  month,
  year,
  onNext,
  compact,
}: {
  slide: Extract<HonorSlide, { kind: 'team' }>
  month: number
  year: number
  onNext: () => void
  compact?: boolean
}) {
  const nameParts = slide.teamName.replace(/^team\s*/i, '').trim()

  return (
    <div
      className={cn(
        'relative grid items-center',
        compact
          ? 'min-h-[128px] gap-3 px-4 py-3 sm:min-h-[140px] sm:px-6 lg:grid-cols-[1fr_auto] lg:gap-4 lg:px-8'
          : 'min-h-[210px] gap-5 px-5 py-7 sm:min-h-[240px] sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-8 lg:px-12'
      )}
      style={{ animation: 'vd-slide-in .55s cubic-bezier(.22,1,.36,1) both' }}
    >
      {/* Background decorations */}
      <AnimatedOrbs />
      <Particles />

      {/* Grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.065]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.08) 1px,transparent 1px)',
          backgroundSize: '42px 42px',
        }}
        aria-hidden
      />
      {/* Shimmer */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'linear-gradient(100deg,transparent 0%,rgba(255,255,255,0.15) 42%,transparent 60%)',
        }}
        aria-hidden
      />

      {/* Left: Team info */}
      <div className="relative z-10 min-w-0">
        {/* VINH DANH TEAM badge */}
        <div
          className="mb-3"
          style={{ animation: 'vd-slide-in .55s .08s cubic-bezier(.22,1,.36,1) both' }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-gradient-to-r from-indigo-200 via-violet-300 to-cyan-200 px-3.5 py-1.5 text-xs font-black tracking-wide text-indigo-950 shadow-[0_0_28px_rgba(139,92,246,0.55)]"
            style={{ animation: 'vd-badge-glow 2.2s ease-in-out infinite' }}
          >
            <Trophy className="h-3.5 w-3.5" />
            VINH DANH TEAM · T{month}/{year}
          </span>
        </div>

        {/* Team name */}
        <h2
          className="bg-gradient-to-r from-white via-indigo-100 to-cyan-100 bg-clip-text text-2xl font-black tracking-tight text-transparent drop-shadow-[0_8px_24px_rgba(255,255,255,0.25)] sm:text-3xl lg:text-4xl"
          style={{ animation: 'vd-slide-in .55s .18s cubic-bezier(.22,1,.36,1) both' }}
        >
          Team{' '}
          <span className="bg-gradient-to-r from-yellow-200 to-amber-300 bg-clip-text text-transparent">
            {nameParts || slide.teamName}
          </span>
        </h2>

        {/* Tags */}
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          style={{ animation: 'vd-slide-in .55s .28s cubic-bezier(.22,1,.36,1) both' }}
        >
          {slide.departmentName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/20 backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5 text-cyan-200" />
              {slide.departmentName}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-sm font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur-md">
            <Users className="h-3.5 w-3.5 text-indigo-200" />
            {slide.teamName}
          </span>
        </div>

        {/* KPI label */}
        <p
          className="mt-4 text-sm font-semibold text-indigo-100/85"
          style={{ animation: 'vd-slide-in .55s .36s cubic-bezier(.22,1,.36,1) both' }}
        >
          <BarChart2 className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" />
          {slide.kpiLabel}
        </p>

        {/* Value */}
        <div
          className="mt-1 flex flex-wrap items-end gap-2"
          style={{ animation: 'vd-slide-in .55s .44s cubic-bezier(.22,1,.36,1) both' }}
        >
          <span
            className="bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-3xl font-black tracking-[0.04em] text-transparent drop-shadow-[0_0_30px_rgba(139,92,246,0.4)] sm:text-4xl lg:text-5xl"
            style={{ animation: 'vd-value-breathe 2.1s ease-in-out infinite' }}
          >
            {slide.valueFormatted}
          </span>
          <span className="pb-1 text-lg font-black tracking-wide text-indigo-200 sm:text-xl">
            {slide.unit}
          </span>
        </div>
      </div>

      {/* Right: Trophy + Member avatars + Nav */}
      <div
        className="relative z-10 flex shrink-0 flex-col items-center gap-5"
        style={{ animation: 'vd-slide-in .55s .22s cubic-bezier(.22,1,.36,1) both' }}
      >
        {/* Animated trophy box */}
        <div className="relative hidden h-28 w-28 place-items-center lg:grid">
          <div
            className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-indigo-200 via-violet-300 to-cyan-300 shadow-[0_0_55px_rgba(139,92,246,0.5)]"
            style={{ animation: 'vd-trophy 2.8s ease-in-out infinite' }}
            aria-hidden
          />
          <div className="absolute inset-4 rounded-[1.4rem] border-4 border-white/35 bg-white/35 backdrop-blur-sm" />
          <Trophy className="relative z-10 h-14 w-14 text-indigo-950" />
          <Diamond className="absolute right-3 top-3 h-4 w-4 text-white drop-shadow-lg" />
        </div>

        {/* Member avatar row */}
        <MemberAvatarRow count={slide.memberCount} />

        {/* Nav button (desktop) */}
        <button
          type="button"
          onClick={onNext}
          aria-label="Slide tiếp theo"
          className="hidden h-12 w-12 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-white/30 to-white/10 text-white shadow-[0_0_35px_rgba(139,92,246,0.35)] backdrop-blur-md transition hover:scale-105 hover:bg-white/25 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-200 lg:grid"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function VinhDanhSlide({
  className,
  compact = false,
}: {
  className?: string
  /** Shorter banner for dense dashboards (manager overview). */
  compact?: boolean
}) {
  const { year, month } = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }, [])
  // const [data, setData] = useState<VinhDanhHonorBoardResponse | null>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { data } = useQuery({
    queryKey: ['honor-board', year, month],
    queryFn: () => performanceApi.getVinhDanhHonorBoard(year, month),
    staleTime: 1000 * 60 * 5,
  })
  // useEffect(() => {
  //   performanceApi
  //     .getVinhDanhHonorBoard(year, month)
  //     .then(setData)
  //     .catch(() => setData(null))
  // }, [year, month])

  const slides = useMemo<HonorSlide[]>(() => {
    if (!data?.entries.length) return []
    const result: HonorSlide[] = []

    for (const entry of data.entries) {
      if (entry.topIndividual) {
        const ind = entry.topIndividual
        result.push({
          kind: 'individual',
          id: ind.user.id,
          displayName: ind.user.displayName ?? '—',
          avatarUrl: ind.user.avatarUrl,
          teamName: ind.teamName,
          departmentName: guessDepartment(ind.teamName),
          kpiLabel: entry.content,
          valueFormatted: ind.numericValue.toLocaleString('vi-VN'),
          unit: ind.numericUnit,
        })
      }
      if (entry.topTeam) {
        const team = entry.topTeam
        result.push({
          kind: 'team',
          id: `team-${team.team.id}-${entry.content}`,
          teamName: team.team.name,
          departmentName: guessDepartment(team.team.name),
          kpiLabel: entry.content,
          valueFormatted: team.totalValue.toLocaleString('vi-VN'),
          unit: team.numericUnit,
          memberCount: team.memberCount,
        })
      }
    }

    return result
  }, [data])

  useEffect(() => {
    if (paused || slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setActive((a) => (a + 1) % slides.length)
    }, SLIDE_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [paused, slides.length])

  if (!slides.length) return null

  const slide = slides[active % slides.length]
  if (!slide) return null
  const isTeam = slide.kind === 'team'

  const goNext = () => setActive((a) => (a + 1) % slides.length)

  return (
    <>
      <SlideKeyframes />
      <section
        className={cn(
          'relative overflow-hidden border border-white/15',
          compact
            ? 'rounded-2xl shadow-[0_12px_40px_rgba(192,38,211,0.35)]'
            : 'rounded-[2.25rem] shadow-[0_28px_90px_rgba(192,38,211,0.45)]',
          className
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label="Vinh danh nhân sự xuất sắc"
      >
        {/* Background */}
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            background: isTeam
              ? 'linear-gradient(135deg,#1a0533 0%,#2d1b69 50%,#1e3a8a 100%)'
              : 'radial-gradient(circle at 12% 18%,rgba(34,211,238,.42),transparent 24%),radial-gradient(circle at 48% 5%,rgba(236,72,153,.38),transparent 26%),radial-gradient(circle at 86% 30%,rgba(250,204,21,.34),transparent 22%),linear-gradient(115deg,#220047 0%,#5b21b6 34%,#c026d3 68%,#0e7490 100%)',
          }}
        />

        {/* Content — key forces re-mount animation on slide change */}
        <div key={slide.id} className="relative z-10">
          {slide.kind === 'individual' ? (
            <IndividualSlide
              slide={slide as Extract<HonorSlide, { kind: 'individual' }>}
              month={month}
              year={year}
              onNext={goNext}
              compact={compact}
            />
          ) : (
            <TeamSlide
              slide={slide as Extract<HonorSlide, { kind: 'team' }>}
              month={month}
              year={year}
              onNext={goNext}
              compact={compact}
            />
          )}
        </div>

        {/* Mobile nav button */}
        {slides.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-white/20 p-2 text-white shadow-md backdrop-blur-sm transition hover:bg-white/30 lg:hidden"
            aria-label="Slide tiếp theo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  i === active
                    ? 'w-10 bg-gradient-to-r from-yellow-200 via-fuchsia-200 to-cyan-200 shadow-[0_0_18px_rgba(255,255,255,0.7)]'
                    : 'w-2.5 bg-white/40 hover:bg-white/70'
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
