import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = { themeColor: '#0a0d0b' };

export const metadata: Metadata = {
  title: 'ZARAY',
  applicationName: 'ZARAY',
  description: 'ZARAY — plateforme SaaS de gestion des entreprises, des réseaux Wi-Fi et des services clients.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon.ico', type: 'image/x-icon', sizes: '16x16 32x32 48x48' },
    ],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
