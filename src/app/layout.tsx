import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { themeColor: '#0a0d0b' };

export const metadata: Metadata = {
  title: 'ZARAY | Plateforme de gestion Wi-Fi',
  description: 'Zaray V1.0 — plateforme SaaS de gestion des entreprises, des réseaux Wi-Fi et des services clients.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
