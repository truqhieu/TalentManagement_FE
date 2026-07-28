import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagerSubmissions } from '@/features/manager/hooks'
import { CARD_ENTRANCE_HOVER, staggerStyle } from '@/lib/cardMotion'
import { resolvePublicAssetUrl } from '@/lib/publicAssetUrl'
import { cn, getFileViewerUrl } from '@/lib/utils'
import { ChevronDown, ChevronUp, ExternalLink, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ManagerScreenLayout } from './ManagerScreenLayout'

export const ManagerLearningSubmissionsScreen = () => {
  const { data: submissions, isLoading } = useManagerSubmissions()
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    if (!submissions) return []
    return submissions.filter((s) => {
      const searchStr = `${s.userName} ${s.team} ${s.topic} ${s.objective}`.toLowerCase()
      return searchStr.includes(searchTerm.toLowerCase())
    })
  }, [submissions, searchTerm])

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filtered.forEach((s) => {
      // Group by user name ONLY to be safe for those who change teams
      const userKey = s.userName.trim().toUpperCase()
      if (!groups[userKey]) groups[userKey] = []
      groups[userKey].push(s)
    })
    return groups
  }, [filtered])

  const onDownload = (url: string) => {
    const fullUrl = resolvePublicAssetUrl(url)
    if (!fullUrl) {
      toast.error('File không còn trên máy chủ')
      return
    }
    window.open(getFileViewerUrl(fullUrl), '_blank')
  }

  return (
    <ManagerScreenLayout hideHubNav hideToolbar>
      <div className="animate-page-entrance flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="">
            <h1 className="text-2xl font-bold text-foreground mb-3">Phản tư lớp Biết việc 1</h1>
            <p className="text-sm text-muted-foreground">
              Quản lý và tổng hợp kết quả phản tư của nhân sự trong kỳ thi lớp Biết việc 1.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-2.5 text-sm font-bold text-foreground shadow-sm ring-1 ring-primary/10">
              <Users className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
              {Object.keys(grouped).length} Nhân sự tham gia
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên học viên..."
              className="rounded-xl border-border bg-card pl-10 focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-[24px]" />
            ))
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-border bg-card/50 py-20 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Không tìm thấy dữ liệu nào</h3>
            </div>
          ) : (
            Object.entries(grouped).map(([userKey, userSubmissions], idx) => (
              <UserGroupCard
                key={userKey}
                submissions={userSubmissions}
                idx={idx}
                onDownload={onDownload}
              />
            ))
          )}
        </div>
      </div>
    </ManagerScreenLayout>
  )
}

const UserGroupCard = ({
  submissions,
  idx,
  onDownload,
}: {
  submissions: any[]
  idx: number
  onDownload: (url: string) => void
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Extract summary if exists
  const summary = useMemo(
    () => submissions.find((s) => s.topic.includes('Tổng kết')),
    [submissions]
  )

  // Filter out summary from the list of items to display in grid
  const detailSubmissions = useMemo(
    () => submissions.filter((s) => !s.topic.includes('Tổng kết')),
    [submissions]
  )

  const first = submissions[0]

  // Extract status from summary comment or calculate from score
  const isPass = summary ? summary.managerComment?.includes('Trạng thái: Đạt') : false
  const totalScore = summary ? summary.score : null

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[32px] border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-xl',
        CARD_ENTRANCE_HOVER
      )}
      style={staggerStyle(idx)}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {/* Avatar/Initial */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-primary/10 text-xl font-black text-primary border-2 border-white shadow-inner">
          {first.userName?.substring(0, 2).toUpperCase() || 'NA'}
        </div>

        {/* User Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="truncate text-xl font-black tracking-tight text-foreground">
              {first.userName}
            </h3>
            {summary && (
              <div
                className={cn(
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm',
                  isPass
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                )}
              >
                {isPass ? 'ĐẠT' : 'THI LẠI'}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
              <span className="text-[9px] uppercase tracking-wider text-gray-400">Team</span>
              <span className="text-foreground font-black">{first.team || 'N/A'}</span>
            </div>
            {totalScore !== null && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                <span className="text-[9px] uppercase tracking-wider text-indigo-400">
                  Điểm tổng kết
                </span>
                <span className="text-indigo-700 font-black">{totalScore}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex shrink-0 flex-col items-end gap-3">
          <Button
            variant="ghost"
            className="h-10 gap-2 rounded-xl font-bold text-primary hover:bg-primary/5"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" /> Thu gọn
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" /> Chi tiết bài nộp ({detailSubmissions.length})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content: Submissions List */}
      <div
        className={cn(
          'grid transition-all duration-500 ease-in-out',
          isExpanded
            ? 'grid-rows-[1fr] opacity-100 mt-6'
            : 'grid-rows-[0fr] opacity-0 overflow-hidden'
        )}
      >
        <div className="overflow-hidden space-y-4">
          {/* Grouped Submissions inside User Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(
              detailSubmissions.reduce((acc: Record<string, any[]>, s) => {
                // Get base topic name by removing "(Lần ...)"
                const baseTopic = s.topic.replace(/\s*\(Lần\s*\d+\)\s*$/i, '').trim()
                if (!acc[baseTopic]) acc[baseTopic] = []
                acc[baseTopic].push(s)
                return acc
              }, {})
            ).map(([topicName, items], sIdx) => (
              <div
                key={topicName}
                className="relative rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md border-t-4 border-t-indigo-500"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <span className="text-sm font-black uppercase tracking-tight text-indigo-700 truncate pr-2">
                      {topicName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">Điểm cao nhất:</span>
                      <div className="text-2xl font-black text-slate-800 tabular-nums">
                        {Math.max(...items.map((i) => i.score || 0))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    {items.map((item, iIdx) => (
                      <div
                        key={item.id}
                        className={cn(
                          'p-3 rounded-2xl border transition-all',
                          iIdx === items.length - 1
                            ? 'bg-indigo-50/30 border-indigo-100'
                            : 'bg-slate-50/50 border-slate-100'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-extrabold text-slate-500 italic">
                            {item.topic.includes('Lần') ? item.topic : 'Kết quả'}
                          </span>
                          <span className="text-xs font-black text-indigo-600">{item.score} đ</span>
                        </div>
                        {item.managerComment && (
                          <div className="text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap pl-2 border-l-2 border-indigo-200 mt-1">
                            {item.managerComment}
                          </div>
                        )}
                        {item.hostComment && (
                          <div className="text-[11px] leading-relaxed text-purple-600 whitespace-pre-wrap pl-2 border-l-2 border-purple-200 mt-2 italic">
                            Host: {item.hostComment}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-auto p-0 text-indigo-600 font-bold text-[10px] gap-1 hover:no-underline"
                          disabled={!item.fileRef}
                          onClick={() =>
                            item.fileRef
                              ? onDownload(item.fileRef)
                              : toast.error('File không còn trên máy chủ')
                          }
                        >
                          <ExternalLink className="h-3 w-3" />
                          Xem minh chứng
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
