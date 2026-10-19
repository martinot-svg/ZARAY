import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zaray | Plateforme de gestion Wi-Fi',
  description: 'Zaray V1.0 — plateforme SaaS de gestion des entreprises, des réseaux Wi-Fi et des services clients.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
