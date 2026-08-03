import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react'
import { useState } from 'react'
import type { MeetingBooking } from './api'
import { BBH_REQUIRED_FROM_DATE } from './roomBookingConstants'
import { requiresMeetingMinutes } from './roomBookingMinutes'
import { RoomBookingMinutesCell } from './RoomBookingMinutesCell'
import { formatDateVi, formatTimeRangeVi } from './roomBookingTimeUtils'

type Props = {
  items: MeetingBooking[]
  vnTime: { date: string; time: string }
  currentUserId?: string
  showAllUsers?: boolean
  isLoading?: boolean
}

const PAGE_SIZE = 5

export function RoomBookingMinutesTable({ items, vnTime, currentUserId, showAllUsers }: Props) {
  const [currentPage, setCurrentPage] = useState(1)

  const rows = items
    .filter((b) => requiresMeetingMinutes(b, vnTime))
    .filter((b) => showAllUsers || b.userId === currentUserId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.timeFrom.localeCompare(a.timeFrom))

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const effectivePage = currentPage > totalPages ? Math.max(1, totalPages) : currentPage
  const displayRows = rows.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3 bg-muted/10">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-[#006C49]" />
          <h3 className="text-sm font-bold text-foreground">Biên bản họp (BBH)</h3>
          <span className="text-xs text-muted-foreground">
            Áp dụng từ {formatDateVi(BBH_REQUIRED_FROM_DATE)} · Nộp sau khi buổi họp kết thúc
          </span>
        </div>
        <a
          href="/Form_bien_ban_hop_Vien_Chi_Bao.docx"
          download="Bản sao của Form biên bản họp - Viễn Chí Bảo.docx"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#006C49]/10 px-3 py-1.5 text-xs font-bold text-[#006C49] transition hover:bg-[#006C49]/20 hover:text-[#006C49]"
        >
          <Download className="h-3.5 w-3.5" />
          Tải mẫu BBH
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Chưa có buổi họp nào cần nộp biên bản.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Phòng</th>
                  <th className="px-4 py-3">Ngày / Giờ</th>
                  <th className="px-4 py-3">Lý do</th>
                  {showAllUsers ? <th className="px-4 py-3">Người đặt</th> : null}
                  <th className="px-4 py-3 min-w-[180px]">Biên bản</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-semibold">{b.room}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="block font-medium text-foreground">
                        {formatDateVi(b.date)}
                      </span>
                      <span className="text-xs">{formatTimeRangeVi(b.timeFrom, b.timeTo)}</span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3" title={b.reason}>
                      {b.reason}
                    </td>
                    {showAllUsers ? (
                      <td className="px-4 py-3 text-xs text-muted-foreground">{b.userName}</td>
                    ) : null}
                    <td className="px-4 py-3 align-top">
                      <RoomBookingMinutesCell
                        booking={b}
                        vnTime={vnTime}
                        compact
                        isOwner={b.userId === currentUserId}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 px-4 py-3 bg-muted/10">
              <p className="text-xs text-muted-foreground">
                Hiển thị {(effectivePage - 1) * PAGE_SIZE + 1} -{' '}
                {Math.min(effectivePage * PAGE_SIZE, rows.length)} trong tổng số {rows.length} mục
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={effectivePage === 1}
                  onClick={() => setCurrentPage(effectivePage - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted disabled:opacity-50 transition"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-foreground px-2">
                  Trang {effectivePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={effectivePage === totalPages}
                  onClick={() => setCurrentPage(effectivePage + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted disabled:opacity-50 transition"
                  aria-label="Trang sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
