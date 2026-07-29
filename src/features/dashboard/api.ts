import { z } from 'zod'
import { apiClient } from '@/lib/axios'
import { safeParse } from '@/lib/utils'

const levelCodeSchema = z.enum(['tap_su', 'biet_viec', 'duoc_viec', 'dong_gop_ket_qua', 'tuong'])

const dashboardUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  fullNameLegal: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  teamGroup: z.string().nullable().optional(),
  departmentName: z.string().nullable().optional(),
  portraitRef: z.string().nullable().optional(),
  phonePrimary: z.string().nullable().optional(),
  employeeCodePrimary: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  startDateWork: z.string().nullable().optional(),
  learningClassName: z.string().nullable().optional(),
  teamPosition: z.string().nullable().optional(),
})

const careerSchema = z
  .object({
    careerLevel: levelCodeSchema,
    currentStars: z.number().int().nonnegative(),
    eligiblePromote: z.boolean().optional(),
  })
  .nullable()
  .optional()

const promotionSchema = z.object({
  promotedAt: z.string(),
  fromLevel: levelCodeSchema.nullable().optional(),
  toLevel: levelCodeSchema,
  note: z.string().nullable().optional(),
})

const levelSourceSchema = z
  .object({
    source: z.string().nullable().optional(),
    starCount: z.number().int().nullable().optional(),
    levelExercises: z.unknown().nullable().optional(),
    snapshotAt: z.string().datetime().nullable().optional(),
  })
  .optional()

const highlightAchievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  badge: z.string().nullable().optional(),
  score: z.number().int().nullable().optional(),
  levelScope: z.string().nullable().optional(),
  achievedAt: z.string(),
})

export const myDashboardSchema = z.object({
  staffLevel: z.enum(['PROBATION', 'PROFICIENT', 'GENERAL', 'UNKNOWN']).optional(),
  levelSource: levelSourceSchema,
  user: dashboardUserSchema,
  career: careerSchema,
  promotionHistory: z.array(promotionSchema).default([]),
  highlightAchievements: z.array(highlightAchievementSchema).default([]),
  nextStarTopics: z
    .array(
      z.object({
        topic: z.string(),
        objectives: z.array(z.string()),
      })
    )
    .optional(),
})

export type MyDashboardResponse = z.infer<typeof myDashboardSchema>

const learningOpsExamRepeatFailUserSchema = z.object({
  userId: z.string().uuid(),
  /** Cặp cấp của kỳ thi (vd. tap_su -> biet_viec) trong kỳ. */
  levelFrom: z.string(),
  levelTo: z.string(),
  fullName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  employeeCode: z.string().nullable().optional(),
  failCount: z.number().int().min(1),
})

export const learningOpsSummarySchema = z.object({
  period: z.object({
    year: z.number().int(),
    startMonth: z.number().int().min(1).max(12),
    endMonth: z.number().int().min(1).max(12),
  }),
  peopleByCareerLevel: z.record(z.string(), z.number().int().nonnegative()),
  levelUpCount: z.number().int().nonnegative(),
  examNotPassedCount: z.number().int().nonnegative(),
  classesCreatedInPeriod: z.number().int().nonnegative(),
  /** Trong kỳ: học viên trượt thi (Chờ học lại / Chia tay), mỗi buổi/kỳ thi tính một lần. */
  usersWithAtLeastTwoExamFails: z.array(learningOpsExamRepeatFailUserSchema).default([]),
  /** Tổng toàn bộ hồ sơ nhân sự (mọi trạng thái) — khớp "Tổng nhân sự" của trang Danh sách nhân sự. */
  totalHeadcount: z.number().int().nonnegative(),
  /** Đúng trạng thái ACTIVE (loại inactive lẫn probation/reserved/transferred). */
  activeHeadcount: z.number().int().nonnegative(),
  /** Ngày vào làm (`startDateWork`) nằm trong kỳ lọc. */
  newHiresInPeriod: z.number().int().nonnegative(),
  /** Nghỉ / off: ưu tiên ngày trong dữ liệu Lark (`Ngày nghỉ việc`); không có thì fallback `updatedAt` khi đã inactive. */
  offboardedInPeriod: z.number().int().nonnegative(),
})

export type LearningOpsSummaryResponse = z.infer<typeof learningOpsSummarySchema>

export const dashboardApi = {
  me: async () => {
    const res = await apiClient.get<unknown>('/me/dashboard')
    return safeParse(myDashboardSchema, res.data, 'GET /me/dashboard')
  },

  learningOpsSummary: async (year: number, startMonth: number, endMonth: number) => {
    const res = await apiClient.get<unknown>('/me/learning-ops-summary', {
      params: { year, startMonth, endMonth },
    })
    return safeParse(learningOpsSummarySchema, res.data, 'GET /me/learning-ops-summary')
  },
}
