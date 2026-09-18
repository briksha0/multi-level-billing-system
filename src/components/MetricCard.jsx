export default function MetricCard({ icon: Icon, label, value, subValue, subValueColor = 'text-dark-muted', iconColor = 'text-brand-500', iconBg = 'bg-brand-500/15' }) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
          {Icon && <Icon size={16} />}
        </div>
        <div className="text-xs uppercase tracking-wide font-medium text-dark-muted">{label}</div>
      </div>
      <div className="text-3xl font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {subValue && <div className={`text-xs mt-1 font-medium ${subValueColor}`}>{subValue}</div>}
    </div>
  )
}
