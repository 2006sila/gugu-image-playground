import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ModelCapabilityDiagnostic } from '../../lib/modelCapabilities'

interface CapabilityDiagnosticCardProps {
  diagnostic: ModelCapabilityDiagnostic
  compact?: boolean
}

const tone = {
  ready: {
    box: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]',
    title: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  warning: {
    box: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/[0.06]',
    title: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
  },
  error: {
    box: 'border-red-200/80 bg-red-50/70 dark:border-red-500/20 dark:bg-red-500/[0.06]',
    title: 'text-red-700 dark:text-red-300',
    icon: XCircle,
  },
} as const

const checkTone = {
  pass: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-sky-600 dark:text-sky-400',
  fail: 'text-red-600 dark:text-red-400',
} as const

export default function CapabilityDiagnosticCard({ diagnostic, compact = false }: CapabilityDiagnosticCardProps) {
  const currentTone = tone[diagnostic.level]
  const StatusIcon = currentTone.icon

  return (
    <section className={`rounded-2xl border ${compact ? 'p-3' : 'p-4'} ${currentTone.box}`}>
      <div className="flex items-start gap-2.5">
        <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${currentTone.title}`} />
        <div className="min-w-0 flex-1">
          <h4 className={`text-sm font-semibold ${currentTone.title}`}>{diagnostic.title}</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{diagnostic.summary}</p>
        </div>
      </div>
      <div className={`${compact ? 'mt-2.5' : 'mt-3'} space-y-2`}>
        {diagnostic.checks.map((check) => {
          const CheckIcon = check.state === 'pass' ? CheckCircle2 : check.state === 'fail' ? XCircle : Info
          return (
            <div key={`${check.label}-${check.detail}`} className="flex items-start gap-2 text-xs">
              <CheckIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${checkTone[check.state]}`} />
              <div className="min-w-0">
                <span className="font-medium text-gray-700 dark:text-gray-300">{check.label}：</span>
                <span className="leading-relaxed text-gray-500 dark:text-gray-500">{check.detail}</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400 dark:text-gray-600">
        静态诊断仅检查本地配置和协议能力，不发送请求、不消耗额度；上游模型权限需通过实际调用确认。
      </p>
    </section>
  )
}
