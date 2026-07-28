import { KpiOkrWorkspace } from '@/features/kpi-okr/components/KpiOkrWorkspace'
import { SalesKpiCatalogScreen } from '@/features/kpi-okr/components/SalesKpiCatalogScreen'
import { cn } from '@/lib/utils'
import { Settings2, Target } from 'lucide-react'
import { useState } from 'react'

type ManagerKpiTab = 'workspace' | 'sales-config'

const MANAGER_KPI_TABS: Array<{
  value: ManagerKpiTab
  label: string
  description: string
  icon: typeof Target
}> = [
  {
    value: 'workspace',
    label: 'Set KPI/OKR cho team',
    description: 'Theo dõi KPI/OKR theo từng team kinh doanh',
    icon: Target,
  },
  {
    value: 'sales-config',
    label: 'Cấu hình KPI Kinh doanh',
    description: 'Quản lý chỉ số KPI để auto-seed kỳ tiếp theo',
    icon: Settings2,
  },
]

/** Manager: cau hinh KPI/OKR theo team, tach route khoi man Leader. */
export function ManagerSetKpiOkrScreen() {
  const [activeTab, setActiveTab] = useState<ManagerKpiTab>('workspace')

  return (
    <div className="space-y-2">
      <div className="">
        <div
          role="tablist"
          aria-label="Màn KPI/OKR manager"
          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"
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
                  'flex min-h-14 items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors',
                  selected
                    ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    selected
                      ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'bg-white/70 text-slate-500 dark:bg-slate-950/40 dark:text-slate-400'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{tab.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                    {tab.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
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
            description="Manager cấu hình và theo dõi toàn bộ KPI/OKR theo từng team kinh doanh, theo tháng đã chọn."
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
