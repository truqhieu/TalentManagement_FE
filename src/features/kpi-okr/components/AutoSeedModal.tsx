import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { kpiQueryKeys } from '../kpiQueryKeys'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { performanceApi, type AutoSeedResponse } from '@/features/kpi-okr/api'
import { getApiErrorMessage } from '@/lib/axios'
import type { TeamMemberRow } from '@/features/organization/api'
import { Sparkles, Users } from 'lucide-react'

interface AutoSeedModalProps {
  teamId: string
  year: number
  month: number
  members: TeamMemberRow[]
  teamName: string
  teamCode?: string | null
  isTrafficTeam?: boolean
  /** false → chỉ xem preview; xác nhận seed chỉ khi cửa sổ giao mục tiêu đang mở */
  assignmentWindowOpen: boolean
  assignStartDay: number
  assignEndDay: number
  onSeeded: () => void
}

export function AutoSeedModal({
  teamId,
  year,
  month,
  members,
  isTrafficTeam = false,
  assignmentWindowOpen,
  assignStartDay,
  assignEndDay,
  onSeeded,
}: AutoSeedModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')
  const [templateCode, setTemplateCode] = useState('SALES_NV')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [preview, setPreview] = useState<AutoSeedResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()

  const memberUsers = useMemo(
    () => members.filter((m) => (m.role === 'MEMBER' || !m.role) && m.requiresKpiOkr !== false),
    [members]
  )

  const resetState = () => {
    setStep('select')
    setPreview(null)
    setSelectedUserIds([])
    setSelectAll(false)
  }

  const handlePreview = async () => {
    const userIds = selectAll ? [] : selectedUserIds
    if (!selectAll && userIds.length === 0) {
      toast.error('Chọn ít nhất 1 nhân sự hoặc chọn "Toàn team"')
      return
    }
    setLoading(true)
    try {
      const result = await performanceApi.autoSeedTeam(teamId, year, month, {
        templateCode,
        userIds: selectAll ? undefined : userIds,
        dryRun: true,
        replaceExisting: true,
      })
      setPreview(result)
      setStep('preview')
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Preview thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!assignmentWindowOpen) {
      toast.error(
        `Chưa trong cửa sổ giao mục tiêu T${month}/${year} (ngày ${assignStartDay}–${assignEndDay}). Chờ đến khi mở cửa hoặc nhờ HR điều chỉnh cấu hình.`
      )
      return
    }
    const userIds = selectAll ? [] : selectedUserIds
    setLoading(true)
    try {
      const result = await performanceApi.autoSeedTeam(teamId, year, month, {
        templateCode,
        userIds: selectAll ? undefined : userIds,
        dryRun: false,
        replaceExisting: true,
      })
      setPreview(result)
      setStep('done')
      toast.success(
        `Đã đồng bộ catalog: xóa ${result.totalDeleted ?? 0}, tạo ${result.totalCreated} mục tiêu`
      )
      queryClient.invalidateQueries({ queryKey: kpiQueryKeys.assignments(teamId, year, month) })
      onSeeded()
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e) || 'Seed thất bại')
    } finally {
      setLoading(false)
    }
  }

  const close = () => {
    setOpen(false)
    resetState()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close()
        setOpen(v)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-indigo-200 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300"
        >
          <Sparkles className="h-4 w-4" />
          Tự seed theo catalog
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            Tự seed KPI/OKR từ catalog
          </DialogTitle>
          <DialogDescription>
            Tự động tạo danh sách KPI/OKR theo vị trí và stage thâm niên cho nhân sự trong team.
            {!assignmentWindowOpen && (
              <>
                {' '}
                Bạn có thể xem preview mọi lúc; chỉ khi cửa sổ giao mục tiêu{' '}
                <strong>
                  T{month}/{year}
                </strong>{' '}
                đang mở (ngày {assignStartDay}–{assignEndDay}) mới xác nhận tạo được trên hệ thống.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium text-slate-600">Template catalog</Label>
              <Select value={templateCode} onValueChange={setTemplateCode}>
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALES_NV">SALES_NV — NV Kinh doanh (4 stage)</SelectItem>
                  <SelectItem value="VAN_DON_NV">
                    VAN_DON_NV — NV Xử lý đơn & bảo hành (1 stage)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-slate-600">Nhân sự áp dụng</Label>
                <Badge variant="muted" className="h-5 text-xs">
                  <Users className="mr-1 h-3 w-3" />
                  {memberUsers.length}
                </Badge>
              </div>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50/50 border border-indigo-100 cursor-pointer">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={(v) => {
                    setSelectAll(v === true)
                    if (v === true) setSelectedUserIds([])
                  }}
                />
                <span className="text-sm font-medium text-indigo-700">
                  Toàn team ({memberUsers.length} người)
                </span>
              </label>
              {!selectAll && (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
                  {memberUsers.map((m) => (
                    <label
                      key={m.userId}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(m.userId)}
                        onCheckedChange={(v) => {
                          if (v === true) setSelectedUserIds((p) => [...p, m.userId])
                          else setSelectedUserIds((p) => p.filter((id) => id !== m.userId))
                        }}
                      />
                      {m.displayName || m.email || m.userId}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Huỷ
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={handlePreview}
                loading={loading}
              >
                {loading ? 'Đang tải preview...' : 'Xem preview'}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="h-5 text-xs font-mono">
                  {preview.templateCode}
                </Badge>
                <span className="text-slate-500">
                  {preview.isSingleStage ? '1 stage (OFFICIAL)' : 'Đa stage (M1→OFFICIAL)'}
                </span>
              </div>
              <div className="text-sm font-medium text-slate-700">
                Dự kiến đồng bộ:{' '}
                <span className="text-red-600 font-bold">{preview.totalDeleted ?? 0}</span> mục seed
                cũ sẽ xóa, <span className="text-indigo-600 font-bold">{preview.totalCreated}</span>{' '}
                mục tiêu
                {preview.totalSkipped > 0 && (
                  <span className="text-slate-400">
                    {' '}
                    (bỏ qua {preview.totalSkipped} đã tồn tại)
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {preview.perUser.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-800">{u.displayName || u.userId}</span>
                    <span className="ml-2 text-xs text-slate-400">Stage: {u.tenureStage}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {u.createdCount > 0 && (
                      <Badge
                        variant="default"
                        className="h-5 bg-indigo-100 text-indigo-700 border-indigo-200"
                      >
                        +{u.createdCount} mới
                      </Badge>
                    )}
                    {u.skippedCount > 0 && (
                      <Badge variant="muted" className="h-5">
                        {u.skippedCount} đã có
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!assignmentWindowOpen && (
              <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
                Cửa sổ giao mục tiêu{' '}
                <strong>
                  T{month}/{year}
                </strong>{' '}
                hiện chưa cho phép ghi dữ liệu (khung ngày {assignStartDay}–{assignEndDay}). Bạn vẫn
                xem preview được; nút xác nhận sẽ hoạt động khi đến đúng cửa sổ.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
                Quay lại
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleConfirm}
                disabled={
                  loading ||
                  (preview.totalCreated === 0 && (preview.totalDeleted ?? 0) === 0) ||
                  !assignmentWindowOpen
                }
              >
                {loading ? 'Đang đồng bộ...' : `Xác nhận đồng bộ ${preview.totalCreated} mục tiêu`}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && preview && (
          <div className="space-y-4 text-center">
            <div className="rounded-full bg-emerald-100 w-12 h-12 flex items-center justify-center mx-auto">
              <svg
                className="h-6 w-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-800">Đã đồng bộ catalog thành công!</p>
              <p className="text-sm text-slate-500">
                Đã xóa {preview.totalDeleted ?? 0} mục seed cũ và tạo {preview.totalCreated} mục
                tiêu cho {preview.perUser.length} nhân sự.
              </p>
            </div>
            <Button size="sm" onClick={close}>
              Đóng
            </Button>
          </div>
        )}

        {loading && step !== 'select' && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-8/12" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
