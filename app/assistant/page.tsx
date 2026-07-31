"use client";

import Home from '../page';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

export default function AssistantPage() {
  return (
    <>
      <title>Asisten Suara Pintar</title>
      <meta name="description" content="Bicara dengan Asisten AI Pintar Anda secara langsung." />
      <link rel="manifest" href="/manifest-assistant.json" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <link rel="apple-touch-icon" href="/icons/apple-icon.png" />
      
      <Home hideManifest={true} />
      <PWAInstallPrompt />
    </>
  );
}
