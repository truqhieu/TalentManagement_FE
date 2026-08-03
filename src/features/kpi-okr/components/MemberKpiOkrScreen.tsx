import { KpiOkrWorkspace } from '@/features/kpi-okr/components/KpiOkrWorkspace'
import { VinhDanhSlide } from '@/features/employee-dashboard/components/VinhDanhSlide'

/** Nhân viên: xem KPI/OKR và form theo team (chỉnh tiến độ qua API /me khi có assignment). */
export function MemberKpiOkrScreen() {
  return (
    <div className="space-y-6">
      <VinhDanhSlide />
      <KpiOkrWorkspace variant="member" title="KPI & OKR của tôi" />
    </div>
  )
}
