"use client";

import { useEffect, useState } from "react";
import { Download, X, Share2, Plus, Sparkles, MoreVertical } from "lucide-react";
import styles from "./PWAInstallPrompt.module.css";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check if the current origin is a local dev environment (localhost or local IP)
    const checkIsDev = () => {
      if (typeof window === "undefined") return false;
      const host = window.location.hostname;
      return host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.");
    };

    const isDev = checkIsDev();

    // 1. Check if the app is already running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const isStandaloneMode = checkStandalone();

    // 2. Check if the user is on iOS Safari
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIpadOrIphone = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
      setIsIOS(isIpadOrIphone);
      return isIpadOrIphone;
    };

    const ios = checkIOS();

    // 3. Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      console.log("beforeinstallprompt event fired.");
      e.preventDefault();
      setDeferredPrompt(e);

      const dismissedUntil = localStorage.getItem("assistant_pwa_prompt_dismissed_until");
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      // Ignore dismiss check in dev environment to allow easy testing
      if ((isDev || !isDismissed) && !isStandaloneMode) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. For iOS, if they haven't installed and haven't dismissed, show after 2.5 seconds
    if (ios && !isStandaloneMode) {
      const dismissedUntil = localStorage.getItem("assistant_pwa_prompt_dismissed_until");
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      if (isDev || !isDismissed) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }

    // 5. Fallback for other mobile browsers (like Chrome on Android)
    // If not running standalone, and not iOS, and not dismissed, show prompt after 3.5 seconds
    // to allow manual installation instructions in case secure origin checks fail on HTTP local IPs.
    if (!ios && !isStandaloneMode) {
      const dismissedUntil = localStorage.getItem("assistant_pwa_prompt_dismissed_until");
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      if (isDev || !isDismissed) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      return;
    }

    if (!deferredPrompt) {
      // If we don't have the native prompt event (e.g. on HTTP local network IP),
      // we show the manual browser instructions card instead of failing silently.
      setShowInstructions(true);
      return;
    }

    try {
      // Show the browser's install prompt
      deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
    } catch (err) {
      console.error("Failed to prompt native install:", err);
      setShowInstructions(true);
    }

    // We no longer need the prompt, clear it
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dismiss for 3 days
    const nextShowTime = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem("assistant_pwa_prompt_dismissed_until", String(nextShowTime));
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className={styles.promptOverlay}>
      <div className={styles.promptCard}>
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className={styles.closeBtn}
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <Sparkles size={24} className={styles.appIcon} />
          </div>
          <div className={styles.textInfo}>
            <h3 className={styles.title}>
              Instal Asisten Suara Pintar
            </h3>
            <p className={styles.description}>
              Pasang pintasan asisten suara mandiri di layar utama Anda. Akses cepat instan ke perekaman & perintah suara AI.
            </p>
          </div>
        </div>

        {/* Dynamic section: Android/Chrome vs iOS Safari instructions */}
        {showInstructions ? (
          <div className={styles.iosInstructions}>
            <p className={styles.iosTitle}>Langkah instalasi Chrome/Android:</p>
            <ol className={styles.iosSteps}>
              <li>
                Ketuk tombol menu <span className={styles.iosHighlight}>titik tiga (⋮)</span> atau <MoreVertical size={13} className={styles.iosInlineIcon} /> di kanan atas browser Chrome Anda.
              </li>
              <li>
                Pilih <span className={styles.iosHighlight}>Instal aplikasi</span> atau <span className={styles.iosHighlight}>Tambahkan ke Layar Utama</span> (Add to Home screen).
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className={styles.btnSecondary}
              style={{ marginTop: '8px', width: '100%' }}
            >
              Saya Mengerti
            </button>
          </div>
        ) : isIOS ? (
          <div className={styles.iosInstructions}>
            <p className={styles.iosTitle}>Langkah instalasi iOS Safari:</p>
            <ol className={styles.iosSteps}>
              <li>
                Ketuk tombol Bagikan <Share2 size={13} className={styles.iosInlineIcon} /> (Share) di Safari.
              </li>
              <li>
                Scroll ke bawah dan pilih <span className={styles.iosHighlight}>Tambahkan ke Layar Utama</span> <Plus size={13} className={styles.iosInlineIcon} /> (Add to Home Screen).
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className={styles.btnSecondary}
              style={{ marginTop: '8px', width: '100%' }}
            >
              Saya Mengerti
            </button>
          </div>
        ) : (
          <div className={styles.actionSection}>
            <button
              onClick={handleDismiss}
              className={styles.btnSecondary}
            >
              Nanti Saja
            </button>
            <button
              onClick={handleInstallClick}
              className={styles.btnPrimary}
            >
              <Download size={14} />
              Instal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
