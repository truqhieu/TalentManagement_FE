import { KpiOkrWorkspace } from '@/features/kpi-okr/components/KpiOkrWorkspace'
import { SalesKpiCatalogScreen } from '@/features/kpi-okr/components/SalesKpiCatalogScreen'
import { cn } from '@/lib/utils'
import { Settings2, Target } from 'lucide-react'
import { useState } from 'react'

type ManagerKpiTab = 'workspace' | 'sales-config'

const MANAGER_KPI_TABS: Array<{
  value: ManagerKpiTab
  label: string
  icon: typeof Target
}> = [
  {
    value: 'workspace',
    label: 'Set KPI/OKR cho team',
    icon: Target,
  },
  {
    value: 'sales-config',
    label: 'Cấu hình KPI Kinh doanh',
    icon: Settings2,
  },
]

/** Manager: cau hinh KPI/OKR theo team, tach route khoi man Leader. */
export function ManagerSetKpiOkrScreen() {
  const [activeTab, setActiveTab] = useState<ManagerKpiTab>('workspace')

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Màn KPI/OKR manager"
        className="inline-flex w-full max-w-xl gap-0.5 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 sm:w-auto"
      >
        {MANAGER_KPI_TABS.map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.value
          return (
            <button
              key={tab.value}
              id={`manager-kpi-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`manager-kpi-panel-${tab.value}`}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors sm:flex-none',
                selected
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'workspace' && (
        <section
          id="manager-kpi-panel-workspace"
          role="tabpanel"
          aria-labelledby="manager-kpi-tab-workspace"
        >
          <KpiOkrWorkspace
            variant="manager"
            title="Set KPI/OKR cho team kinh doanh"
            teamScope="business"
          />
        </section>
      )}

      {activeTab === 'sales-config' && (
        <section
          id="manager-kpi-panel-sales-config"
          role="tabpanel"
          aria-labelledby="manager-kpi-tab-sales-config"
        >
          <SalesKpiCatalogScreen embedded />
        </section>
      )}
    </div>
  )
}
