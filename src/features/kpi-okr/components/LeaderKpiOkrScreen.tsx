import { KpiOkrWorkspace } from '@/features/kpi-okr/components/KpiOkrWorkspace'
import { VinhDanhSlide } from '@/features/employee-dashboard/components/VinhDanhSlide'

/** Leader: ba bảng KPI / tổng chỉ số / form theo team. */
export function LeaderKpiOkrScreen() {
  return (
    <div className="space-y-3">
      <VinhDanhSlide compact />
      <KpiOkrWorkspace variant="leader" title="KPI & OKR trong team" />
    </div>
  )
}
