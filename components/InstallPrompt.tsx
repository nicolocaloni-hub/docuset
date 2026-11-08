import React, { useEffect, useState } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { Button } from './ui';

const DISMISS_KEY = 'docuset_install_dismissed';
const DISMISS_DAYS = 14;

// Evento non ancora nei tipi standard: Chrome/Edge su Android e desktop.
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const isMobile = () => isIos() || /Android/i.test(navigator.userAgent);

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch { return false; }
};

/** Avviso per aggiungere DocuSet alla schermata Home; torna dopo 14 giorni se chiuso. */
const InstallPrompt: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => isInstalled() || recentlyDismissed());

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    const onInstalled = () => setDismissed(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* si ripresenta al prossimo avvio */ }
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'accepted') setDismissed(true);
  };

  // Su desktop compare solo se il browser sa installare; su telefono sempre, con le istruzioni.
  if (hidden || dismissed || (!installEvent && !isMobile())) return null;

  const ios = isIos();
  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 lg:bottom-4 lg:left-auto lg:right-4 lg:w-96" role="region" aria-label="Installa DocuSet">
      <div className="animate-enter flex gap-3 rounded-[4px] border border-line bg-card p-4 shadow-[0_8px_28px_rgba(42,37,29,0.2)]">
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Metti DocuSet sulla schermata Home</p>
          {installEvent ? (
            <p className="mt-0.5 text-sm text-ink-soft">Si apre come un'app, a schermo intero, senza cercarla nel browser.</p>
          ) : ios ? (
            <p className="mt-0.5 text-sm text-ink-soft">
              In Safari tocca <Share aria-label="Condividi" className="inline h-4 w-4 align-[-3px]" /> Condividi,
              poi <PlusSquare aria-hidden className="inline h-4 w-4 align-[-3px]" /> «Aggiungi alla schermata Home».
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-soft">Apri il menu del browser (⋮) e scegli «Installa app» o «Aggiungi a schermata Home».</p>
          )}
          {installEvent && (
            <Button className="mt-3 min-h-10" onClick={install} icon={<Download className="h-4 w-4" />}>Installa</Button>
          )}
        </div>
        <button type="button" onClick={close} aria-label="Non ora" className="-mr-2 -mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center text-ink-soft hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
