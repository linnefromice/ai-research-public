interface StatItem {
  label: string;
  value: number;
  color: string;
}

export function StatsGrid({ stats }: { stats: StatItem[] }) {
  return (
    <div className="flex gap-lg mb-lg flex-wrap stats-grid">
      {stats.map(s => (
        <div key={s.label} className="card" style={{ minWidth: 0, flex: '1 1 100px' }}>
          <div className="font-bold" style={{ fontSize: '1.5rem', color: s.color }}>{s.value}</div>
          <div className="text-xxs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
