import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ClipboardCheck, RefreshCw, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { getApiErrorMessage } from '@/lib/axios'
import { performanceApi, type KpiOkrComplianceTeamRow } from '@/features/kpi-okr/api'
import { useHrOrgSelectOptions } from '@/features/hr-admin/useHrOrgTree'
import { clampKpiPeriod, getMaxViewableYm, isKpiPeriodSelectable } from '@/features/kpi-okr/kpiPeriodLimits'
import { isMockApiEnabled } from '@/lib/mockEnv'
import { cn } from '@/lib/utils'

function nowYm() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function complianceTone(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 100) return 'success'
  if (rate >= 50) return 'warning'
  return 'danger'
}

export function KpiOkrComplianceScreen() {
  const [{ year, month }, setPeriod] = useState(nowYm)
  const [departmentId, setDepartmentId] = useState('__all')
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)

  const maxViewYm = getMaxViewableYm()
  const { departments } = useHrOrgSelectOptions()

  const reportQ = useQuery({
    queryKey: ['kpi-okr-compliance', year, month, departmentId],
    queryFn: () =>
      performanceApi.getKpiOkrComplianceReport(year, month, {
        departmentId: departmentId === '__all' ? undefined : departmentId,
      }),
    enabled: !isMockApiEnabled(),
  })

  const teams = useMemo(() => reportQ.data?.teams ?? [], [reportQ.data])
  const summary = reportQ.data?.summary

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 md:px-4">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-[1.75rem]">
            Tuân thủ{' '}
            <span className="text-indigo-600 dark:text-indigo-400">
              KPI/OKR T{month}/{year}
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Theo dõi leader đã tạo KPI/OKR cho nhân sự trong team hay chưa
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-lg"
          onClick={() => void reportQ.refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="h-8 w-[180px] rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800 [&>span]:truncate [&>span]:whitespace-nowrap">
            <SelectValue placeholder="Phòng ban" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Tất cả phòng ban</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

        <Select
          value={String(month)}
          onValueChange={(value) => setPeriod(clampKpiPeriod(year, Number(value)))}
        >
          <SelectTrigger className="h-8 w-[112px] rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)} disabled={!isKpiPeriodSelectable(year, m)}>
                Tháng {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          value={year}
          min={2020}
          max={maxViewYm.year}
          className="h-8 w-[90px] rounded-lg border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800"
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            setPeriod(clampKpiPeriod(v, month))
          }}
        />
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Tổng số team" value={summary.totalTeams} icon={<Users className="h-4 w-4" />} />
          <StatCard
            title="Team đã đủ 100%"
            value={summary.teamsFullyCompliant}
            tone="success"
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
          <StatCard title="Team còn thiếu" value={summary.teamsWithGaps} tone="warning" />
          <StatCard title="Nhân sự còn thiếu KPI/OKR" value={summary.totalMissing} tone="danger" />
        </div>
      )}

      {reportQ.isError ? (
        <ErrorState
          title="Không tải được báo cáo"
          description={getApiErrorMessage(reportQ.error)}
          onRetry={() => void reportQ.refetch()}
        />
      ) : !reportQ.isLoading && teams.length === 0 ? (
        <EmptyState title="Không có team nào trong phạm vi" description="Thử đổi phòng ban hoặc kỳ báo cáo." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Phòng ban</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead className="text-right">Eligible</TableHead>
                <TableHead className="text-right">Đã giao</TableHead>
                <TableHead className="text-right">Còn thiếu</TableHead>
                <TableHead className="text-right">% tuân thủ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>Đang tải…</TableCell>
                </TableRow>
              ) : (
                teams.map((row) => (
                  <ComplianceTeamRows
                    key={row.teamId}
                    row={row}
                    expanded={expandedTeamId === row.teamId}
                    onToggle={() =>
                      setExpandedTeamId((cur) => (cur === row.teamId ? null : row.teamId))
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ComplianceTeamRows({
  row,
  expanded,
  onToggle,
}: {
  row: KpiOkrComplianceTeamRow
  expanded: boolean
  onToggle: () => void
}) {
  const canExpand = row.missingMembers.length > 0

  return (
    <>
      <TableRow
        className={cn(canExpand && 'cursor-pointer')}
        onClick={canExpand ? onToggle : undefined}
      >
        <TableCell>
          {canExpand ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : null}
        </TableCell>
        <TableCell className="text-muted-foreground">{row.divisionName ?? '—'}</TableCell>
        <TableCell className="font-medium">{row.teamName}</TableCell>
        <TableCell className="text-muted-foreground">
          {row.leaderNames.length > 0 ? row.leaderNames.join(', ') : '—'}
        </TableCell>
        <TableCell className="text-right">{row.eligibleCount}</TableCell>
        <TableCell className="text-right">{row.assignedCount}</TableCell>
        <TableCell className="text-right">{row.missingCount}</TableCell>
        <TableCell className="text-right">
          <Badge variant={complianceTone(row.complianceRate)}>{row.complianceRate}%</Badge>
        </TableCell>
      </TableRow>
      {expanded && canExpand && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30">
            <div className="py-1 text-sm">
              <p className="mb-1.5 font-medium text-foreground">
                Nhân sự chưa có KPI/OKR ({row.missingMembers.length})
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {row.missingMembers.map((m) => (
                  <li key={m.id}>
                    {m.fullNameLegal ?? 'Chưa rõ tên'}
                    {m.email ? ` · ${m.email}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
