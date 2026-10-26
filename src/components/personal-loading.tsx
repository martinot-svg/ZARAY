import BrandLogo from '@/components/brand-logo';

export default function PersonalLoading({ label }: { label: string }) {
  return <main className="personal-shell" aria-busy="true">
    <header className="personal-topbar"><div className="personal-logo"><BrandLogo /></div><span className="personal-topbar-label">Espace personnel</span></header>
    <div className="personal-content" role="status" aria-live="polite">
      <p className="eyebrow">{label}</p><h1 className="app-title">Chargement…</h1>
      <div className="panel skeleton-list" style={{ marginTop: 20 }}>
        <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      </div>
    </div>
  </main>;
}
