type Props = {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'danger' | 'brand'
  className?: string
}

export function StatCard({ label, value, hint, tone = 'default', className = '' }: Props) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'brand' ? 'text-brand-dark dark:text-brand' : ''
  return (
    <div className={`card p-4 ${className}`}>
      <p className="text-[12.5px] text-subtle">{label}</p>
      <p className={`text-[22px] font-extrabold leading-tight mt-1 ${color}`}>{value}</p>
      {hint && <p className="text-[12px] text-subtle mt-1">{hint}</p>}
    </div>
  )
}
