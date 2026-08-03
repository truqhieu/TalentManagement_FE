import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2, ChevronDown, Settings2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/axios'
import {
  performanceApi,
  type PerformanceKind,
  type VinhDanhConfigSummary,
} from '@/features/kpi-okr/api'
import { useHrOrgSelectOptions } from '@/features/hr-admin/useHrOrgTree'

// ─── Types ──────────────────────────────────────────────────────────────────

type TeamInfo = { id: string; name: string; deptId: string; deptName: string }

type MetricEntry = VinhDanhConfigSummary & { teamIds: Set<string> }

type RowDraft = {
  rowId: number
  content: string
  kind: PerformanceKind
  priority: number
  targetMetric: string
  numericUnit: string
}

const PRIORITY_OPTIONS = [
  { value: 1, label: 'P1 — Cao' },
  { value: 2, label: 'P2 — Trung bình' },
  { value: 3, label: 'P3 — Thấp' },
  { value: 4, label: 'P4 — Tùy chọn' },
]

let _rowIdSeq = 0
function makeRow(overrides?: Partial<RowDraft>): RowDraft {
  return {
    rowId: ++_rowIdSeq,
    content: '',
    kind: 'KPI',
    priority: 2,
    targetMetric: '',
    numericUnit: '',
    ...overrides,
  }
}

// ─── Add / Edit dialog ───────────────────────────────────────────────────────

function AddEditDialog({
  open,
  onClose,
  allTeams,
  initial,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  allTeams: TeamInfo[]
  initial?: MetricEntry | null
  onSaved: () => void
}) {
  const now = new Date()
  const isEdit = Boolean(initial)

  const [rows, setRows] = useState<RowDraft[]>(() =>
    isEdit
      ? [
          makeRow({
            content: initial!.content,
            kind: initial!.kind,
            priority: initial!.priority,
            targetMetric: initial!.targetMetric ?? '',
            numericUnit: initial!.numericUnit ?? '',
          }),
        ]
      : [makeRow()]
  )

  const [effYear, setEffYear] = useState(initial?.effectiveFromYear ?? now.getFullYear())
  const [effMonth, setEffMonth] = useState(initial?.effectiveFromMonth ?? now.getMonth() + 1)
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    () => new Set(initial?.teamIds ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [deptOpen, setDeptOpen] = useState<Set<string>>(
    () => new Set(allTeams.map((t) => t.deptId))
  )

  const teamsByDept = useMemo(() => {
    const map = new Map<string, { deptName: string; teams: TeamInfo[] }>()
    for (const t of allTeams) {
      if (!map.has(t.deptId)) map.set(t.deptId, { deptName: t.deptName, teams: [] })
      map.get(t.deptId)!.teams.push(t)
    }
    return map
  }, [allTeams])

  const filteredTeamsByDept = useMemo(() => {
    const q = teamSearch.trim().toLowerCase()
    if (!q) return teamsByDept
    const filtered = new Map<string, { deptName: string; teams: TeamInfo[] }>()
    for (const [deptId, { deptName, teams }] of teamsByDept.entries()) {
      const matchDept = deptName.toLowerCase().includes(q)
      const matchedTeams = matchDept ? teams : teams.filter((t) => t.name.toLowerCase().includes(q))
      if (matchedTeams.length > 0) filtered.set(deptId, { deptName, teams: matchedTeams })
    }
    return filtered
  }, [teamsByDept, teamSearch])

  const updateRow = (rowId: number, patch: Partial<Omit<RowDraft, 'rowId'>>) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)))

  const addRow = () => setRows((prev) => [...prev, makeRow()])

  const removeRow = (rowId: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev))

  const toggleTeam = (id: string) =>
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleDept = (deptId: string) => {
    const teams = teamsByDept.get(deptId)?.teams ?? []
    const allSel = teams.every((t) => selectedTeamIds.has(t.id))
    setSelectedTeamIds((prev) => {
      const next = new Set(prev)
      teams.forEach((t) => (allSel ? next.delete(t.id) : next.add(t.id)))
      return next
    })
  }

  const toggleDeptOpen = (deptId: string) =>
    setDeptOpen((prev) => {
      const next = new Set(prev)
      next.has(deptId) ? next.delete(deptId) : next.add(deptId)
      return next
    })

  const handleSave = async () => {
    const validRows = rows.filter((r) => r.content.trim())
    if (!validRows.length) {
      toast.error('Vui lòng nhập nội dung cho ít nhất 1 chỉ số')
      return
    }
    if (!selectedTeamIds.size) {
      toast.error('Vui lòng chọn ít nhất 1 team')
      return
    }
    setSaving(true)
    try {
      if (isEdit && initial) {
        const row = rows[0]!
        const prevIds = initial.teamIds
        const addTeamIds = [...selectedTeamIds].filter((id) => !prevIds.has(id))
        const removeTeamIds = [...prevIds].filter((id) => !selectedTeamIds.has(id))
        const keepTeamIds = [...selectedTeamIds].filter((id) => prevIds.has(id))
        await performanceApi.updateVinhDanhConfig({
          oldContent: initial.content,
          newContent: row.content.trim() !== initial.content ? row.content.trim() : undefined,
          kind: row.kind,
          priority: row.priority,
          targetMetric: row.targetMetric || null,
          numericUnit: row.numericUnit || null,
          effectiveFromYear: effYear,
          effectiveFromMonth: effMonth,
          addTeamIds,
          removeTeamIds,
          keepTeamIds,
        })
        toast.success('Đã cập nhật chỉ số vinh danh.')
      } else {
        await Promise.all(
          validRows.map((row) =>
            performanceApi.createVinhDanhConfig({
              content: row.content.trim(),
              kind: row.kind,
              priority: row.priority,
              targetMetric: row.targetMetric || null,
              numericUnit: row.numericUnit || null,
              teamIds: [...selectedTeamIds],
              effectiveFromYear: effYear,
              effectiveFromMonth: effMonth,
            })
          )
        )
        toast.success(
          `Đã thêm ${validRows.length} chỉ số vinh danh cho ${selectedTeamIds.size} team.`
        )
      }
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Sửa chỉ số vinh danh' : 'Thêm chỉ số vinh danh mới'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? 'Cập nhật nội dung và team áp dụng. Áp dụng cho cả trưởng nhóm và thành viên.'
              : 'Chỉ số sẽ được tạo cho trưởng nhóm và tất cả thành viên active trong team đã chọn.'}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Rows */}
          <div className="space-y-2">
            {!isEdit && (
              <div className="flex items-center justify-between">
                <Label>
                  Danh sách chỉ số <span className="text-destructive">*</span>
                </Label>
                <span className="text-xs text-muted-foreground">{rows.length} dòng</span>
              </div>
            )}

            {rows.map((row, idx) => (
              <div
                key={row.rowId}
                className={cn(
                  'rounded-xl border bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2.5',
                  !isEdit && 'relative pr-9'
                )}
              >
                {!isEdit && (
                  <div className="absolute right-2 top-2 flex items-center gap-0.5">
                    <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.rowId)}
                        className="ml-1 rounded p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        title="Xoá dòng này"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                {isEdit && (
                  <Label className="text-xs text-muted-foreground">
                    Nội dung <span className="text-destructive">*</span>
                  </Label>
                )}
                <Input
                  placeholder="Tên chỉ số / mục tiêu"
                  value={row.content}
                  onChange={(e) => updateRow(row.rowId, { content: e.target.value })}
                />

                {/* Kind + Priority */}
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={row.kind}
                    onValueChange={(v) => updateRow(row.rowId, { kind: v as PerformanceKind })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KPI">KPI</SelectItem>
                      <SelectItem value="OKR">OKR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(row.priority)}
                    onValueChange={(v) => updateRow(row.rowId, { priority: parseInt(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target + Unit */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Chỉ tiêu (VD: 100,000,000)"
                    value={row.targetMetric}
                    onChange={(e) => updateRow(row.rowId, { targetMetric: e.target.value })}
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Đơn vị (VD: VND)"
                    value={row.numericUnit}
                    onChange={(e) => updateRow(row.rowId, { numericUnit: e.target.value })}
                  />
                </div>
              </div>
            ))}

            {!isEdit && (
              <button
                type="button"
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors dark:border-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng
              </button>
            )}
          </div>

          {/* Effective from */}
          <div className="space-y-1.5">
            <Label>
              Áp dụng từ tháng <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Select value={String(effMonth)} onValueChange={(v) => setEffMonth(parseInt(v))}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      Tháng {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(effYear)} onValueChange={(v) => setEffYear(parseInt(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-400">
              Chỉ số sẽ hiển thị từ tháng này trở đi trong bảng vinh danh
            </p>
          </div>

          {/* Team multi-select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Áp dụng cho team <span className="text-destructive">*</span>
              </Label>
              {selectedTeamIds.size > 0 && (
                <span className="text-xs font-medium text-primary">
                  {selectedTeamIds.size} team đã chọn
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Áp dụng cho cả trưởng nhóm và thành viên trong team đã chọn
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Tìm phòng / team..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border divide-y bg-white dark:bg-slate-950">
              {filteredTeamsByDept.size === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Không tìm thấy team nào.
                </div>
              ) : (
                [...filteredTeamsByDept.entries()].map(([deptId, { deptName, teams }]) => {
                  const allSel = teams.every((t) => selectedTeamIds.has(t.id))
                  const someSel = !allSel && teams.some((t) => selectedTeamIds.has(t.id))
                  const isOpen = teamSearch.trim() ? true : deptOpen.has(deptId)
                  return (
                    <div key={deptId}>
                      <div className="flex items-center gap-0 bg-slate-50 dark:bg-slate-900">
                        <div
                          className="flex flex-1 items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => toggleDept(deptId)}
                        >
                          <Checkbox
                            checked={allSel ? true : someSel ? 'indeterminate' : false}
                            onCheckedChange={() => toggleDept(deptId)}
                          />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {deptName}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
                            {teams.filter((t) => selectedTeamIds.has(t.id)).length}/{teams.length}
                          </span>
                        </div>
                        {!teamSearch.trim() && (
                          <button
                            className="px-2 py-2.5 text-slate-400 hover:text-slate-600"
                            onClick={() => toggleDeptOpen(deptId)}
                          >
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 transition-transform',
                                isOpen && 'rotate-180'
                              )}
                            />
                          </button>
                        )}
                      </div>
                      {isOpen &&
                        teams.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2.5 px-3 py-2 pl-9 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                            onClick={() => toggleTeam(t.id)}
                          >
                            <Checkbox
                              checked={selectedTeamIds.has(t.id)}
                              onCheckedChange={() => toggleTeam(t.id)}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {t.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? 'Đang lưu...'
              : isEdit
                ? 'Lưu thay đổi'
                : `Thêm ${rows.filter((r) => r.content.trim()).length || ''} chỉ số cho team đã chọn`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function ManagerKpiOkrScreen() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<MetricEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MetricEntry | null>(null)
  const qc = useQueryClient()

  const { departments, teamsByDept: teamsByDeptMap } = useHrOrgSelectOptions()

  const allTeams = useMemo<TeamInfo[]>(
    () =>
      departments.flatMap((d) =>
        (teamsByDeptMap.get(d.value) ?? []).map((t) => ({
          id: t.value,
          name: t.label,
          deptId: d.value,
          deptName: d.label,
        }))
      ),
    [departments, teamsByDeptMap]
  )

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ['vinh-danh-configs', year, month],
    queryFn: () => performanceApi.getVinhDanhConfigs(year, month),
    staleTime: 30_000,
  })

  const metrics = useMemo<MetricEntry[]>(
    () => rawData.map((r) => ({ ...r, teamIds: new Set(r.teamIds) })),
    [rawData]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return metrics
    const q = search.toLowerCase()
    return metrics.filter((m) => m.content.toLowerCase().includes(q))
  }, [metrics, search])

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['vinh-danh-configs', year, month] })

  const handleDelete = (entry: MetricEntry) => {
    setDeleteTarget(entry)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await performanceApi.deleteVinhDanhConfig({
        content: deleteTarget.content,
        teamIds: [...deleteTarget.teamIds],
      })
      toast.success('Đã xóa chỉ số vinh danh.')
      invalidate()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Trophy className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Chỉ số vinh danh và xếp hạng
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quản lý các chỉ số dùng để xếp hạng và vinh danh hàng tháng. Áp dụng cho cả trưởng nhóm
            và thành viên. Thay đổi đồng bộ ngay lập tức.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/manager/kpi-okr">
              <Settings2 className="h-4 w-4" />
              Cấu hình KPI Kinh doanh
            </Link>
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm chỉ số vinh danh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            className="pl-9 h-9"
            placeholder="Tìm chỉ số vinh danh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>
                Tháng {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="h-9 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      {!isLoading && filtered.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
            🏆 {filtered.length} chỉ số vinh danh
          </span>
          <span className="text-slate-400">
            = tính vào bảng xếp hạng &amp; khen thưởng hàng tháng
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-400">Áp dụng cho trưởng nhóm và thành viên</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm dark:bg-slate-950 overflow-hidden">
        <div className="hidden md:grid grid-cols-[2fr_72px_88px_160px_120px_1fr_72px] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900/60">
          <span>Nội dung</span>
          <span>Loại</span>
          <span>Ưu tiên</span>
          <span>Chỉ tiêu</span>
          <span>Từ tháng</span>
          <span>Team áp dụng</span>
          <span className="text-right">Thao tác</span>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy className="mx-auto h-10 w-10 text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-sm text-slate-400">
              {search
                ? 'Không tìm thấy chỉ số vinh danh phù hợp.'
                : 'Chưa có chỉ số vinh danh nào cho kỳ này.'}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm chỉ số vinh danh đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((entry) => (
              <div
                key={entry.content}
                className="group grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-amber-50/30 dark:hover:bg-amber-900/10 md:grid-cols-[2fr_72px_88px_160px_120px_1fr_72px] md:items-center md:gap-4 md:py-3"
              >
                {/* Content */}
                <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {entry.content}
                </span>

                {/* Kind */}
                <div className="flex md:block">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold',
                      entry.kind === 'KPI'
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30'
                    )}
                  >
                    {entry.kind}
                  </Badge>
                </div>

                {/* Priority */}
                <div className="flex md:block">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      entry.priority === 1
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : entry.priority === 2
                          ? 'border-amber-200 bg-amber-50 text-amber-600'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                    )}
                  >
                    P{entry.priority}
                  </Badge>
                </div>

                {/* Target */}
                <span className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {entry.targetMetric ? (
                    `${entry.targetMetric}${entry.numericUnit ? ` ${entry.numericUnit}` : ''}`
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </span>

                {/* Effective from */}
                <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  T{entry.effectiveFromMonth}/{entry.effectiveFromYear}
                </span>

                {/* Teams */}
                <div className="flex flex-wrap items-center gap-1">
                  {[...entry.teamIds].slice(0, 4).map((tid) => {
                    const t = allTeams.find((x) => x.id === tid)
                    return t ? (
                      <span
                        key={tid}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {t.name}
                      </span>
                    ) : null
                  })}
                  {entry.teamIds.size > 4 && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400 dark:bg-slate-800">
                      +{entry.teamIds.size - 4} team
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => setEditEntry(entry)}
                    title="Sửa"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-300 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => void handleDelete(entry)}
                    title="Xóa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <AddEditDialog
          open
          onClose={() => setAddOpen(false)}
          allTeams={allTeams}
          onSaved={invalidate}
        />
      )}
      {editEntry && (
        <AddEditDialog
          open
          onClose={() => setEditEntry(null)}
          allTeams={allTeams}
          initial={editEntry}
          onSaved={() => {
            invalidate()
            setEditEntry(null)
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Xóa chỉ số vinh danh?`}
        description={
          deleteTarget
            ? `Xóa "${deleteTarget.content}" khỏi ${deleteTarget.teamIds.size} team. Thao tác không thể hoàn tác.`
            : undefined
        }
        confirmLabel="Xóa"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
