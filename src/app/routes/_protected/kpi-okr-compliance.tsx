import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { requireRoleOrPermissionPrefixes } from '@/lib/routeGuards'
import { PageSkeleton } from '@/components/ui/skeleton'

const KpiOkrComplianceScreen = lazy(() =>
  import('@/features/kpi-okr').then((module) => ({
    default: module.KpiOkrComplianceScreen,
  }))
)

export const Route = createFileRoute('/_protected/kpi-okr-compliance')({
  beforeLoad: () => {
    requireRoleOrPermissionPrefixes(['HR', 'BOD', 'MANAGER'], ['hr.dept.'])
  },
  component: KpiOkrCompliancePage,
})

function KpiOkrCompliancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KpiOkrComplianceScreen />
    </Suspense>
  )
}
