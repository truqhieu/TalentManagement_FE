import { CustomSelect } from '@/components/shared/CustomSelect'
import { DialogCustom } from '@/components/shared/DialogCustom/DialogCustom'
import { PAGE_HEADER_DESCRIPTION } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { useManagerSubmissions } from '@/features/exam/hooks'
import { useGetFeedback } from '@/features/learning-path/hooks'
import { useManagerClasses } from '@/features/manager/hooks'
import type { managerClassApiSchema } from '@/features/manager/schemas'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { z } from 'zod'
import { ManagerScreenLayout } from './ManagerScreenLayout'

/** BOD/HR/MANAGER chấm chéo toàn hệ thống — không giới hạn theo lớp/lịch được gán. */
const SEES_ALL_GRADING_ROLES = ['BOD', 'HR', 'MANAGER']

type ManagerClassRow = z.infer<typeof managerClassApiSchema>

const PAGE_SIZE = 6

type TemporalStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED'

function getTemporalStatus(
  dateIso?: string,
  startTime?: string,
  endTime?: string
): { label: string; badgeClass: string; status: TemporalStatus } {
  if (!dateIso || !startTime || !endTime) {
    return {
      label: 'Không xác định',
      badgeClass: 'bg-muted text-muted-foreground',
      status: 'UPCOMING',
    }
  }

  const now = new Date().getTime()
  const start = new Date(`${dateIso}T${startTime}:00+07:00`).getTime()
  const end = new Date(`${dateIso}T${endTime}:00+07:00`).getTime()

  if (now < start) {
    return {
      label: 'Sắp diễn ra',
      badgeClass: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
      status: 'UPCOMING',
    }
  }
  if (now <= end) {
    return {
      label: 'Đang diễn ra',
      badgeClass: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 animate-pulse',
      status: 'IN_PROGRESS',
    }
  }
  return {
    label: 'Đã kết thúc',
    badgeClass: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
    status: 'COMPLETED',
  }
}

type FlatRow = {
  key: string
  topic: string
  className: string
  classId: string
  scheduleId?: string
  teacherName: string
  status: ManagerClassRow['status']
  dateIso?: string
  startTime?: string
  endTime?: string
  total: number
  pending: number
  drafts: number
  usesExamPaperSystem: boolean
}

export function ManagerGradingScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: classes = [], isLoading } = useManagerClasses()
  const { data: submissions = [], isLoading: isLoadingSubmissions } = useManagerSubmissions()
  const seesAllGrading = !!user?.role && SEES_ALL_GRADING_ROLES.includes(user.role)
  const [page, setPage] = useState(1)
  const [filterClass, setFilterClass] = useState<string>('all')
  const [filterGrading, setFilterGrading] = useState<string>('all')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const {
    data: feedback,
    isLoading: isLoadingFeedback,
    isError,
  } = useGetFeedback(
    selectedClassId || '',
    selectedScheduleId || undefined,
    !!selectedClassId?.length
  )

  // Total pending across all submissions
  const totalPending = submissions.filter((s) => s.status === 'pending').length
  const totalDone = submissions.filter((s) => s.status === 'done').length

  // Flatten classes + schedules into rows
  const allRows: FlatRow[] = useMemo(() => {
    const result: FlatRow[] = []

    type ClassSchedule = NonNullable<ManagerClassRow['schedules']>[number]
    const isClassTeacher = (c: ManagerClassRow) => c.teacher?.userId === user?.id
    const canGradeSchedule = (c: ManagerClassRow, s: ClassSchedule) =>
      seesAllGrading || isClassTeacher(c) || s.examTeacherUserId === user?.id

    for (const c of classes) {
      const teacherName = c.teacher?.name || '—'
      const examSchedules =
        c.schedules?.filter(
          (s) => s.isExam || s.location === 'Nộp bài trực tuyến' || s.topic?.includes('Hạn nộp')
        ) || []
      const classDurationMin = (c.examQuestions as any)?.duration || 60

      if (examSchedules.length === 0) {
        if (!seesAllGrading && !isClassTeacher(c)) continue

        const classSubmissions = submissions.filter(
          (s) => s.classId?.toLowerCase() === c.id.toLowerCase()
        )
        const dateStr = c.examDate ? c.examDate.split('T')[0] : undefined
        const startStr = c.examDate
          ? new Date(c.examDate).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '08:00'

        // Tính endTime thực tế dựa trên duration
        const startTimeObj = c.examDate ? new Date(c.examDate) : new Date()
        const endTimeObj = new Date(startTimeObj.getTime() + classDurationMin * 60 * 1000)
        const endStr = endTimeObj.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })

        result.push({
          key: c.id,
          topic: 'Kỳ thi (Mặc định lớp)',
          className: c.name,
          classId: c.id,
          teacherName,
          status: c.status,
          dateIso: dateStr,
          startTime: startStr,
          endTime: endStr,
          total: classSubmissions.length,
          pending: classSubmissions.filter((s) => s.status === 'pending').length,
          drafts: classSubmissions.filter((s) => s.status === 'grading').length,
          // Đề chuẩn (ExamPaper) luôn gắn theo schedule cụ thể — lớp không có
          // schedule nào thì chỉ có thể là luồng JSON cũ cấp lớp.
          usesExamPaperSystem: false,
        })
      } else {
        for (const s of examSchedules) {
          if (!canGradeSchedule(c, s)) continue

          const scheduleSubmissions = submissions.filter(
            (sub) => sub.scheduleId?.toLowerCase() === s.id.toLowerCase()
          )

          // Ưu tiên duration từ scheduleQuestions, nếu không có lấy từ classQuestions
          const durationMin = (s.examQuestions as any)?.duration || classDurationMin

          // Tính endTime thực tế: startTime + duration
          const startParts = s.startTime.split(':')
          const startTimeObj = new Date(`${s.dateIso}T${s.startTime}:00+07:00`)
          const endTimeObj = new Date(startTimeObj.getTime() + durationMin * 60 * 1000)
          const endStr = endTimeObj.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Ho_Chi_Minh',
          })

          result.push({
            key: s.id,
            topic: s.topic,
            className: c.name,
            classId: c.id,
            scheduleId: s.id,
            teacherName: s.examTeacherName || teacherName,
            status: c.status,
            dateIso: s.dateIso,
            startTime: s.startTime,
            endTime: endStr,
            total: scheduleSubmissions.length,
            pending: scheduleSubmissions.filter((sub) => sub.status === 'pending').length,
            drafts: scheduleSubmissions.filter((sub) => sub.status === 'grading').length,
            usesExamPaperSystem: (s.examPaperIds?.length ?? 0) > 0,
          })
        }
      }
    }

    // Sắp xếp: ngày muộn nhất lên trước, rồi theo giờ bắt đầu muộn nhất
    result.sort((a, b) => {
      const da = a.dateIso || '0000-00-00'
      const db = b.dateIso || '0000-00-00'
      if (da !== db) return db.localeCompare(da)
      const ta = a.startTime || '00:00'
      const tb = b.startTime || '00:00'
      return tb.localeCompare(ta)
    })

    return result
  }, [classes, submissions, user?.id, seesAllGrading])

  // Danh sách tên lớp (cho filter)
  const classNames = useMemo(() => {
    const names = [...new Set(allRows.map((r) => r.className))].sort()
    return names
  }, [allRows])

  // Apply filters
  const filteredRows = useMemo(() => {
    let rows = allRows

    if (filterClass !== 'all') {
      rows = rows.filter((r) => r.className === filterClass)
    }

    if (filterGrading === 'pending') {
      rows = rows.filter((r) => r.pending > 0)
    } else if (filterGrading === 'done') {
      rows = rows.filter((r) => r.total > 0 && r.pending === 0)
    } else if (filterGrading === 'no_submission') {
      rows = rows.filter((r) => r.total === 0)
    }

    return rows
  }, [allRows, filterClass, filterGrading])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset page when filter changes
  const handleFilterClass = (val: string) => {
    setFilterClass(val)
    setPage(1)
  }
  const handleFilterGrading = (val: string) => {
    setFilterGrading(val)
    setPage(1)
  }

  // Lịch thi có gán đề chuẩn (ExamPaper — tự chấm MCQ, gán ngẫu nhiên) cần màn chấm
  // riêng, khác với màn chấm theo bộ câu hỏi JSON cũ của các lịch thi chưa gán đề chuẩn.
  const gotoGrading = (row: FlatRow) => {
    if (row.usesExamPaperSystem && row.scheduleId) {
      void navigate({
        to: '/manager/grade-editor-exam/$scheduleId',
        params: { scheduleId: row.scheduleId },
      })
      return
    }
    void navigate({
      to: '/manager/grade-class/$classId',
      params: { classId: row.classId },
      search: row.scheduleId ? ({ scheduleId: row.scheduleId } as any) : {},
    })
  }

  return (
    <ManagerScreenLayout hideHubNav hideToolbar>
      <div className="mb-4 flex flex-col gap-4">
        <div className={cn('min-w-0')}>
          <h1 className="text-2xl font-bold">Chấm bài thi</h1>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tổng bài đã nộp
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {isLoadingSubmissions ? '—' : submissions.length}
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Chờ chấm</p>
            <p className="mt-1 text-3xl font-bold text-rose-700">
              {isLoadingSubmissions ? '—' : totalPending}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
              Đã chấm xong
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">
              {isLoadingSubmissions ? '—' : totalDone}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CustomSelect
              value={filterClass}
              onValueChange={handleFilterClass}
              options={[
                { label: 'Tất cả lớp', value: 'all' },
                ...classNames.map((name) => ({ label: name, value: name })),
              ]}
              triggerClassName="border border-slate-500 py-2 w-[150px]"
            />
            <CustomSelect
              value={filterGrading}
              onValueChange={handleFilterGrading}
              options={[
                { label: 'Tất cả', value: 'all' },
                { label: 'Chờ chấm', value: 'pending' },
                { label: 'Đã chấm hết', value: 'done' },
                { label: 'Chưa có bài nộp', value: 'no_submission' },
              ]}
              triggerClassName="border border-slate-500 py-2 w-[120px]"
            />
          </div>
          <span className="text-sm text-primary font-bold">{filteredRows.length} lịch thi</span>
        </div>

        {/* Table (desktop) + thẻ (mobile) */}
        <div>
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-xl border border-primary/15 bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-primary/10">
                Đang tải danh sách bài thi...
              </div>
            ) : paginatedRows.length === 0 ? (
              <div className="rounded-xl border border-primary/15 bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)] ring-1 ring-primary/10">
                {filteredRows.length === 0 && allRows.length > 0
                  ? 'Không có lịch thi nào phù hợp với bộ lọc.'
                  : 'Chưa có bài thi nào cần chấm.'}
              </div>
            ) : (
              paginatedRows.map((row) => {
                const temp = getTemporalStatus(row.dateIso, row.startTime, row.endTime)
                return (
                  <div
                    key={row.key}
                    className="space-y-3 rounded-xl border border-primary/15 bg-card p-4 shadow-[var(--shadow-card)] ring-1 ring-primary/10"
                  >
                    <div>
                      <div className="text-base font-bold uppercase leading-snug text-foreground">
                        {row.topic}
                      </div>
                      <div className="mt-1 text-xs font-medium text-primary">
                        Lớp: {row.className}
                      </div>
                    </div>
                    <p className="text-sm text-foreground">
                      <span className="font-semibold text-muted-foreground">Giáo viên chấm: </span>
                      {row.teacherName}
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Thời gian thi</p>
                      {row.dateIso ? (
                        <div className="mt-1">
                          <p className="text-sm font-bold text-foreground">
                            {new Date(row.dateIso + 'T00:00:00').toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                          {row.startTime && row.endTime ? (
                            <p className="text-xs text-muted-foreground">
                              {row.startTime} — {row.endTime}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                    <div>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-xs font-bold',
                          temp.badgeClass
                        )}
                      >
                        {temp.label}
                      </span>
                    </div>
                    <div className="text-sm">
                      {row.total > 0 ? (
                        <span className="font-medium text-foreground">
                          {row.total} bài (
                          {row.pending > 0 ? (
                            <span className="font-bold text-rose-600">{row.pending} chờ chấm</span>
                          ) : row.drafts > 0 ? (
                            <span className="font-bold text-amber-600">Đã lưu bản nháp</span>
                          ) : (
                            <span className="font-bold text-emerald-600">Đã chấm hết</span>
                          )}
                          )
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Chưa có bài nộp</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        row.total > 0 && row.pending === 0 && row.drafts === 0
                          ? 'outline'
                          : 'default'
                      }
                      className={cn(
                        'h-10 w-full font-bold',
                        row.total > 0 && row.pending === 0 && row.drafts === 0
                          ? 'border-primary text-primary hover:bg-primary/5'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                      onClick={() => gotoGrading(row)}
                    >
                      {row.total > 0 && row.pending === 0 && row.drafts === 0
                        ? 'Xem bài chấm thi'
                        : 'Chấm thi'}
                    </Button>
                  </div>
                )
              })
            )}
          </div>

          <div
            className={cn(
              'hidden overflow-x-auto rounded-xl border border-primary/15 bg-card shadow-[var(--shadow-card)] ring-1 ring-primary/10 md:block'
            )}
          >
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary/12 via-teal-500/8 to-violet-500/8">
                  <th className="px-3 py-3 font-semibold text-primary">Kỳ thi / Lớp</th>
                  <th className="px-3 py-3 font-semibold">Giáo viên chấm</th>
                  <th className="px-3 py-3 font-semibold text-center">Thời gian thi</th>
                  <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">
                    Trạng thái thi
                  </th>
                  <th className="px-3 py-3 font-semibold">Bài thi đã nộp</th>
                  <th className="px-3 py-3 font-semibold">Feedback</th>
                  <th className="px-3 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Đang tải danh sách bài thi...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      {filteredRows.length === 0 && allRows.length > 0
                        ? 'Không có lịch thi nào phù hợp với bộ lọc.'
                        : 'Chưa có bài thi nào cần chấm.'}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const temp = getTemporalStatus(row.dateIso, row.startTime, row.endTime)
                    return (
                      <tr
                        key={row.key}
                        className="border-t border-border/80 bg-card transition-colors hover:bg-muted/25"
                      >
                        <td className="px-3 py-4">
                          <div className="font-bold text-foreground text-base uppercase">
                            {row.topic}
                          </div>
                          <div className="text-xs font-medium text-primary">
                            Lớp: {row.className}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-foreground">{row.teacherName}</td>
                        <td className="px-3 py-4 text-center">
                          {row.dateIso ? (
                            <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-foreground">
                                {new Date(row.dateIso + 'T00:00:00').toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </span>
                              {row.startTime && row.endTime ? (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {row.startTime} — {row.endTime}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap',
                              temp.badgeClass
                            )}
                          >
                            {temp.label}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          {row.total > 0 ? (
                            <span className="text-foreground font-medium whitespace-nowrap">
                              {row.total} bài ({' '}
                              {row.pending > 0 ? (
                                <span className="font-bold text-rose-600">
                                  {row.pending} chờ chấm
                                </span>
                              ) : row.drafts > 0 ? (
                                <span className="text-amber-600 font-bold">Đã lưu bản nháp</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">Đã chấm hết</span>
                              )}{' '}
                              )
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Chưa có bài nộp</span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="font-bold whitespace-nowrap"
                            onClick={() => {
                              setSelectedClassId(row.classId)
                              setSelectedScheduleId(row.scheduleId || null)
                              setShowFeedbackModal(true)
                            }}
                          >
                            Xem feedback
                          </Button>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              row.total > 0 && row.pending === 0 && row.drafts === 0
                                ? 'outline'
                                : 'default'
                            }
                            className={cn(
                              'font-bold whitespace-nowrap',
                              row.total > 0 && row.pending === 0 && row.drafts === 0
                                ? 'border-[#006C49] text-[#006C49] hover:bg-[#006C49]/5'
                                : 'bg-[#006C49] hover:bg-[#006C49]/90 text-white'
                            )}
                            onClick={() => gotoGrading(row)}
                          >
                            {row.total > 0 && row.pending === 0 && row.drafts === 0
                              ? 'Xem bài chấm thi'
                              : 'Chấm thi'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Trang {safePage} / {totalPages} — Hiển thị {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredRows.length)} / {filteredRows.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3"
                >
                  ←
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={p === safePage ? 'default' : 'ghost'}
                    className={cn(
                      'min-w-[32px] px-2',
                      p === safePage && 'bg-primary text-primary-foreground pointer-events-none'
                    )}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3"
                >
                  →
                </Button>
              </div>
            </div>
          )}

          {/* Show unlinked submissions if any */}
          {(() => {
            const unlinked = submissions.filter((s) => s.classId == null)
            if (unlinked.length === 0) return null
            return (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                <span className="font-bold text-amber-800">
                  ⚠️ {unlinked.length} bài nộp chưa gắn với lớp cụ thể
                </span>
                <span className="ml-2 text-amber-700">— thành viên chưa được xếp lớp khi thi.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-3 border-amber-400 text-amber-800 hover:bg-amber-100"
                  onClick={() => void navigate({ to: '/exam/grader' })}
                >
                  Xem bài nộp
                </Button>
              </div>
            )
          })()}
        </div>
      </div>
      {showFeedbackModal && (
        <DialogCustom
          open={showFeedbackModal}
          onOpenChange={setShowFeedbackModal}
          title="Feedback của học viên"
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          children={
            <div className="space-y-4 p-1">
              {isLoadingFeedback ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : isError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <p className="text-sm text-destructive">Không tải được danh sách feedback.</p>
                </div>
              ) : feedback?.feedbacks?.length ? (
                feedback.feedbacks.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="mb-3 flex flex-col gap-2">
                      <h3 className="text-base font-bold uppercase text-foreground">
                        {f.class?.name ?? '—'}
                      </h3>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {f.schedule?.topic ?? 'Không có chủ đề'}
                        </span>

                        <span className="rounded-full bg-muted px-3 py-1 text-xs">
                          {f.schedule?.dateIso ?? '—'}
                        </span>

                        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-600">
                          {f.submission.fullName}
                        </span>
                      </div>
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Điểm số</div>
                        <div className="font-semibold">{f.submission.totalScore ?? '—'}</div>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Kết quả</div>
                        <div className="font-semibold">{f.submission.outcome ?? '—'}</div>
                      </div>

                      <div className="rounded-lg bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Nhận xét GV</div>
                        <div className="font-semibold">{f.submission.graderNote ?? '—'}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border-l-4 border-primary bg-muted/30 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {f.content}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10">
                  <p className="text-sm text-muted-foreground">Chưa có feedback nào.</p>
                </div>
              )}
            </div>
          }
        />
      )}
    </ManagerScreenLayout>
  )
}
