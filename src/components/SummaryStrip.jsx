import { formatCurrency, formatPercent } from '../lib/calculations'

export default function SummaryStrip({ gpForecast, gpTarget, breakeven, utilisation, monthTurnover }) {
  const variance = (gpForecast || 0) - (gpTarget || 0)
  const variancePositive = variance >= 0

  return (
    <div className="bg-navy text-white rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <SummaryItem label="Month GP Forecast" value={formatCurrency(gpForecast)} highlight />
      <SummaryItem label="Month Turnover" value={formatCurrency(monthTurnover)} />
      <SummaryItem label="Target" value={formatCurrency(gpTarget)} />
      <SummaryItem
        label="Variance"
        value={(variancePositive ? '+' : '') + formatCurrency(Math.abs(variance))}
        className={variancePositive ? 'text-green-400' : 'text-red-400'}
      />
      <SummaryItem label="Breakeven" value={formatCurrency(breakeven)} />
      <SummaryItem label="Utilisation" value={formatPercent(utilisation)} />
    </div>
  )
}

function SummaryItem({ label, value, highlight, className = '' }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-white/60 text-xs">{label}</span>
      <span className={`font-bold tabular-nums ${highlight ? 'text-orange text-base' : ''} ${className}`}>
        {value}
      </span>
    </div>
  )
}
