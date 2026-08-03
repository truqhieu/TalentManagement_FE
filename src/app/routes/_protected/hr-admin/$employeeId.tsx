import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { HrEmployeeProfile } from '@/features/hr-admin/components/HrEmployeeProfile'
import { useEmployeeById } from '@/features/hr-admin/hooks'
import { requireEmployeeDirectoryAccess } from '@/features/hr-admin/requireHrAdmin'
import { RefreshCw } from 'lucide-react'

const employeeSearchSchema = z.object({
  mode: z.enum(['view', 'edit']).optional(),
})

export const Route = createFileRoute('/_protected/hr-admin/$employeeId')({
  validateSearch: (raw) => employeeSearchSchema.parse(raw),
  beforeLoad: ({ params }) => {
    requireEmployeeDirectoryAccess()
    /** Tránh coi các đường dẫn dự kiến (vd. /hr-admin/settings/…) là UUID và gọi GET /employees/:id */
    const parsed = z.string().uuid().safeParse(params.employeeId)
    if (!parsed.success) throw redirect({ to: '/hr-admin', replace: true })
  },
  component: EmployeeDetailPage,
})

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams()
  const { data, isLoading } = useEmployeeById(employeeId)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
        <span className="font-bold tracking-wide text-xs uppercase">Đang tải hồ sơ…</span>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="p-4 text-sm text-[#991B1B]">
        Không tìm thấy nhân viên hoặc lỗi tải dữ liệu.
      </div>
    )
  }

  return <HrEmployeeProfile employee={data} />
}
