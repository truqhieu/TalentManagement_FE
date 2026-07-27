import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { InputFieldController } from '@/components/ui/form-controllers'
import { PaginationCardStepper, PaginationPrevNext } from '@/components/ui/pagination'
import { useTeacherClasses } from '@/features/teacher/hooks'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import { ClipboardCheck, Filter, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { TeacherClassCard } from './TeacherClassCard'
import type { TeacherClassRow, TeacherClassTrack } from './teacherClassTypes'

const FILTERS: { key: 'all' | TeacherClassTrack; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'tap_su', label: 'Tập sự' },
  { key: 'biet_viec', label: 'Biết việc' },
  { key: 'duoc_viec', label: 'Được việc' },
  { key: 'dong_gop_ket_qua', label: 'Đóng góp' },
  { key: 'tuong', label: 'Tướng' },
]

const ACCENT_MAP: Record<string, TeacherClassRow['accent']> = {
  tap_su: 'primary',
  biet_viec: 'amber',
  duoc_viec: 'emerald',
  dong_gop_ket_qua: 'violet',
  tuong: 'rose',
}

const ICON_MAP: Record<string, TeacherClassRow['metaIcon']> = {
  tap_su: 'trending',
  biet_viec: 'school',
  duoc_viec: 'target',
  dong_gop_ket_qua: 'star',
  tuong: 'crown',
}

const LEVEL_LABEL: Record<string, string> = {
  tap_su: 'Tập sự',
  biet_viec: 'Biết việc',
  duoc_viec: 'Được việc',
  dong_gop_ket_qua: 'Đóng góp',
  tuong: 'Tướng',
}

export function TeacherClassesScreen() {
  const filtersForm = useForm<{ filterKey: (typeof FILTERS)[number]['key']; searchDraft: string }>({
    defaultValues: { filterKey: 'all', searchDraft: '' },
  })
  const filterKey = useWatch({ control: filtersForm.control, name: 'filterKey' }) ?? 'all'
  const searchDraft = useWatch({ control: filtersForm.control, name: 'searchDraft' }) ?? ''
  const deferredSearchDraft = useDeferredValue(searchDraft)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: teacherClassesRaw = [] } = useTeacherClasses()
  const rows: TeacherClassRow[] = useMemo(
    () =>
      teacherClassesRaw
        .filter((r) => r.isOwnClass !== false)
        .map((r) => ({
          id: r.id,
          title: r.name,
          periodBadge: r.examDate
            ? `Thi: ${new Date(r.examDate).toLocaleDateString('vi-VN')}`
            : 'Chưa có lịch thi',
          examLine: `${LEVEL_LABEL[r.levelFrom] || r.levelFrom} -> ${LEVEL_LABEL[r.levelTo] || r.levelTo}`,
          memberCount: r.memberCount,
          metaIcon: ICON_MAP[r.levelFrom] || 'school',
          accent: ACCENT_MAP[r.levelFrom] || 'primary',
          track: r.levelFrom as TeacherClassTrack,
        })),
    [teacherClassesRaw]
  )

  // Lớp không phải mình chủ nhiệm nhưng được phân công chấm chéo bài thi (lớp Editor).
  const crossGradingRows = useMemo(
    () => teacherClassesRaw.filter((r) => r.isOwnClass === false && r.crossGradingScheduleId),
    [teacherClassesRaw]
  )

  const filtered = useMemo(() => {
    const q = deferredSearchDraft.trim().toLowerCase()
    return rows.filter((c) => {
      if (filterKey !== 'all' && c.track !== filterKey) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.examLine.toLowerCase().includes(q) ||
        c.periodBadge.toLowerCase().includes(q)
      )
    })
  }, [rows, filterKey, deferredSearchDraft])

  const totalPages = 1
  const page = 1

  const scrollToFilters = () => {
    document
      .getElementById('teacher-class-filters')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeFilter = filterKey

  return (
    <div className="flex flex-col bg-app-canvas text-sm text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-full">
          <div className="mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h1 className="text-2xl font-bold">Lớp được phân công</h1>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-lg border-border px-5 py-2.5 text-sm font-semibold shadow-sm"
                  onClick={scrollToFilters}
                >
                  <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  Bộ lọc
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  className={cn(
                    'gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm',
                    viewMode !== 'table' && 'border-border bg-card hover:bg-muted'
                  )}
                  onClick={() => setViewMode((v) => (v === 'cards' ? 'table' : 'cards'))}
                >
                  {viewMode === 'cards' ? 'Dạng bảng' : 'Dạng thẻ'}
                </Button>
                <Button
                  type="button"
                  className="rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm hover:opacity-90"
                  onClick={() => toast.info('Xuất danh sách lớp sẽ nối API sau.')}
                >
                  Xuất dữ liệu
                </Button>
              </div>
            </div>
          </div>

          {crossGradingRows.length > 0 ? (
            <div className="mb-6">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Lớp tôi chấm chéo
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {crossGradingRows.map((r) => (
                  <Card key={`${r.id}-${r.crossGradingScheduleId}`} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.memberCount} thành viên</p>
                      </div>
                      <Badge variant="outline">Chấm chéo</Badge>
                    </div>
                    <Button type="button" size="sm" className="mt-2 w-full" asChild>
                      <Link
                        to="/manager/grade-editor-exam/$scheduleId"
                        params={{ scheduleId: r.crossGradingScheduleId ?? '' }}
                      >
                        Chấm bài thi
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          <div
            id="teacher-class-filters"
            className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch lg:gap-4"
          >
            <div className="scrollbar-hide flex min-w-0 w-full overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
              <div role="tablist" aria-label="Lọc theo lộ trình" className="flex min-w-min gap-0.5">
                {FILTERS.map(({ key, label }) => {
                  const selected = activeFilter === key
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      role="tab"
                      aria-selected={selected}
                      id={`teacher-class-filter-${key}`}
                      className={cn(
                        'h-auto min-h-0 justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold md:text-sm',
                        selected
                          ? 'bg-[#006C49] text-white shadow-sm hover:bg-[#006C49]'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-[#006C49]/90'
                      )}
                      onClick={() => filtersForm.setValue('filterKey', key)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </div>
            <Form {...filtersForm}>
              <div className="relative flex min-h-[42px] w-full min-w-0 items-center rounded-xl border border-border bg-card px-3 shadow-sm ring-1 ring-border/60">
                <InputFieldController
                  control={filtersForm.control}
                  name="searchDraft"
                  type="search"
                  placeholder="Tìm theo tên lớp, kỳ thi, lộ trình…"
                  aria-label="Tìm lớp"
                  className="min-w-0 flex-1"
                  wrapperClassName="min-w-0 flex-1"
                  startSlot={<Search className="size-4 text-muted-foreground" aria-hidden />}
                  inputClassName="h-auto min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-9 pr-3 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
            </Form>
          </div>

          {viewMode === 'table' ? (
            <div className="overflow-hidden rounded-xl border border-primary/15 bg-card shadow-[var(--shadow-card)] ring-1 ring-primary/10">
              <div className="divide-y divide-border md:hidden">
                {filtered.map((c) => (
                  <div key={c.id} className="space-y-3 p-4">
                    <p className="text-base font-semibold text-foreground">{c.title}</p>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
                        c.accent === 'primary'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-amber-100 text-amber-900'
                      )}
                    >
                      {c.periodBadge}
                    </span>
                    <p className="text-sm text-muted-foreground">{c.examLine}</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      Học viên: {c.memberCount}
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 w-full font-semibold "
                      asChild
                    >
                      <Link to="/teacher/classes/$classId" params={{ classId: c.id }}>
                        Xem chi tiết
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-primary/12 via-teal-500/8 to-violet-500/8">
                      <th className="px-4 py-3 font-semibold">Tên lớp</th>
                      <th className="px-4 py-3 font-semibold">Kỳ / nhãn</th>
                      <th className="px-4 py-3 font-semibold">Lộ trình và nội dung</th>
                      <th className="px-4 py-3 font-semibold text-right">Học viên</th>
                      <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-border/80 bg-card transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-semibold text-foreground">{c.title}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
                              c.accent === 'primary'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-amber-100 text-amber-900'
                            )}
                          >
                            {c.periodBadge}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                          {c.examLine}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                          {c.memberCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="default"
                            size="sm"
                            className="min-w-[7.5rem] font-semibold"
                            asChild
                          >
                            <Link to="/teacher/classes/$classId" params={{ classId: c.id }}>
                              Xem chi tiết
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span>
                  Trang {page} — {filtered.length} lớp hiển thị
                </span>
                <PaginationPrevNext page={page} totalPages={totalPages} onPageChange={() => {}} />
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'grid gap-8 gap-y-4',
                  selectedId
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                )}
              >
                {filtered.map((c, idx) => (
                  <TeacherClassCard
                    key={c.id}
                    classRow={c}
                    cardIndex={idx}
                    selected={selectedId === c.id}
                    onSelect={() => setSelectedId((id) => (id === c.id ? null : c.id))}
                  />
                ))}
              </div>
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Không có lớp phù hợp.
                </p>
              ) : null}
            </>
          )}

          {viewMode === 'cards' && filtered.length > 0 ? (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Hiển thị {filtered.length} / {rows.length} lớp
              </span>
              <PaginationCardStepper page={page} totalPages={totalPages} onPageChange={() => {}} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
