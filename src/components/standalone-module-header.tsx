import Link from 'next/link';
import BrandLogo from '@/components/brand-logo';

/** Real, accessible module title next to the logo on routes without AppShell. */
export default function StandaloneModuleHeader({
  title, homeHref = '/mon-compte', surface = 'light'
}: { title: string; homeHref?: string; surface?: 'light' | 'dark' }) {
  return <header className="zaray-standalone-module-header">
    <Link href={homeHref} className="zaray-standalone-module-brand" aria-label="ZARAY · Accueil">
      <BrandLogo priority surface={surface} />
    </Link>
    <h1 title={title}>{title}</h1>
  </header>;
}
