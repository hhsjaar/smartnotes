import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Catatan Pintar',
  description: 'Catatan suara cerdas yang diformat otomatis oleh AI (Gemini 3.5 Flash) dan disinkronkan di seluruh perangkat Anda menggunakan Neon PostgreSQL.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Catatan Pintar',
  },
};

export const viewport = {
  themeColor: '#0a0a16',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/apple-icon.png" />
        {process.env.NODE_ENV === 'production' ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(
                      function(reg) {
                        console.log('SW registered with scope:', reg.scope);
                      },
                      function(err) {
                        console.log('SW registration failed:', err);
                      }
                    );
                  });
                }
              `
            }}
          />
        ) : (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (let registration of registrations) {
                      registration.unregister().then(function(success) {
                        if (success) {
                          console.log('[Dev] Service Worker unregistered successfully to prevent HMR loop.');
                          window.location.reload();
                        }
                      });
                    }
                  });
                }
              `
            }}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
