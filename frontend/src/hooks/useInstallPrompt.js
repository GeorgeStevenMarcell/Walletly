import { useState, useEffect, useCallback } from "react";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

export default function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already installed — nothing to show
    if (isInStandaloneMode()) return;

    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Android/Chrome: native install prompt available
  const canInstall = !!deferredPrompt;

  // iOS: no native prompt, but we can show a guide
  const canShowIOSGuide = isIOS() && !isInStandaloneMode();

  // Already running as installed PWA
  const isInstalled = isInStandaloneMode();

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    canInstall,
    canShowIOSGuide,
    isInstalled,
    promptInstall,
    showIOSGuide,
    setShowIOSGuide,
  };
}
