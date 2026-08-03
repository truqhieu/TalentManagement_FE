import { memo, useCallback, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Check, Lock, Star } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChecklistStarScreen } from '@/features/learning-path/components/ChecklistStarScreen'
import { useMyProfilePage } from '@/features/profile/hooks'
import { STARS_PER_LEVEL, type LevelCode } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth.store'
import { RoadmapCrud } from '@/features/manager/components/RoadmapCrud'
import { cn } from '@/lib/utils'

const levelIdSchema = z.enum(['tap_su', 'biet_viec', 'duoc_viec', 'dong_gop_ket_qua', 'tuong'])

const learningSearchSchema = z.object({
  levelId: levelIdSchema.optional(),
  starId: z.coerce.number().int().min(1).max(6).optional().default(1),
})

function clampStarForLevel(levelId: LevelCode, starId: number): number {
  const max = STARS_PER_LEVEL[levelId] || 6
  if (max <= 0) return 1
  return Math.min(Math.max(1, starId), max)
}

export const Route = createFileRoute('/_protected/learning-path/')({
  validateSearch: (raw) => {
    const parsed = learningSearchSchema.parse(raw)
    return {
      ...parsed,
      starId: parsed.levelId
        ? clampStarForLevel(parsed.levelId as LevelCode, parsed.starId)
        : parsed.starId,
    }
  },
  component: LearningPathIndex,
})

function LearningPathIndex() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role

  const isAdminOrManager = role === 'MANAGER' || role === 'HR' || role === 'BOD'

  if (isAdminOrManager) {
    return <RoadmapCrud />
  }

  return <LearningPathMemberPage />
}

// ─── Star Navigation Tabs ───
const StarSelector = memo(
  ({
    currentStars,
    selectedStar,
    onSelectStar,
    totalStars = 6,
  }: {
    currentStars: number
    selectedStar: number
    onSelectStar: (star: number) => void
    totalStars?: number
  }) => {
    return (
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: totalStars }, (_, i) => {
          const starNum = i + 1
          // User can see up to currentStars + 1 (the one they're working on)
          const isUnlocked = starNum <= currentStars + 1
          const isActive = starNum === selectedStar
          const isDone = starNum <= currentStars

          return (
            <button
              key={starNum}
              type="button"
              onClick={() => isUnlocked && onSelectStar(starNum)}
              disabled={!isUnlocked}
              className={cn(
                'group relative flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200',
                isActive &&
                  'border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100 text-primary-700 shadow-md shadow-primary-500/15 ring-2 ring-primary-500/30',
                isDone &&
                  !isActive &&
                  'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:shadow-sm',
                !isUnlocked &&
                  'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60',
                isUnlocked &&
                  !isActive &&
                  !isDone &&
                  'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-sm'
              )}
            >
              {!isUnlocked ? (
                <Lock className="h-3.5 w-3.5" />
              ) : isDone ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Star
                  className={cn(
                    'h-3.5 w-3.5',
                    isActive ? 'fill-primary-500 text-primary-500' : 'text-gray-400'
                  )}
                />
              )}
              Sao {starNum}
              {isDone && (
                <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-600">
                  ✓
                </span>
              )}
              {isActive && !isDone && (
                <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-bold text-primary-600">
                  Đang học
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }
)

function LearningPathMemberPage() {
  const { data: profile, isLoading, isError } = useMyProfilePage()
  const search = Route.useSearch()
  const [selectedStar, setSelectedStar] = useState<number | null>(null)

  const handleSelectStar = useCallback((star: number) => {
    setSelectedStar(star)
  }, [])

  const currentLevelId = useMemo(
    () =>
      (search.levelId as LevelCode) ||
      profile?.placement?.levelId ||
      (profile as any)?.careerLevel ||
      'tap_su',
    [search.levelId, profile?.placement?.levelId, (profile as any)?.careerLevel]
  )

  const currentStars = profile?.placement?.starId ?? 0
  const maxStars = useMemo(
    () => STARS_PER_LEVEL[currentLevelId as LevelCode] ?? 6,
    [currentLevelId]
  )

  // Tập sự không có sao; từ Biết việc trở lên mới có sao.
  const hasStarProgression = useMemo(
    () => currentLevelId !== 'tap_su' && maxStars > 0,
    [currentLevelId, maxStars]
  )

  // Compute effective selected star
  const effectiveStar = useMemo(
    () => selectedStar ?? search.starId ?? Math.min(currentStars + 1, maxStars),
    [selectedStar, search.starId, currentStars, maxStars]
  )
  const starStr = useMemo(() => String(effectiveStar), [effectiveStar])

  if (isLoading) {
    return (
      <div className="space-y-4 py-1">
        <PageHeader title="Lộ trình học" description="Đang tải thông tin lộ trình của bạn…" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <div className="space-y-4 py-1">
        <PageHeader title="Lộ trình học" />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Không tải được hồ sơ. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* <PageHeader
        title="Lộ trình học"
        description={`${profile.currentLevel.progressLine} — Cấp và mốc do quản lý phân công.`}
      /> */}

      {/* Star selector for levels with star progression */}
      {hasStarProgression && (
        <StarSelector
          currentStars={currentStars}
          selectedStar={effectiveStar}
          onSelectStar={handleSelectStar}
          totalStars={maxStars}
        />
      )}

      <div className="min-w-0">
        <ChecklistStarScreen
          levelId={currentLevelId}
          starId={starStr}
          embedInLearningPath
          filterByStar={hasStarProgression}
          currentStars={currentStars}
        />
      </div>
    </div>
  )
}
