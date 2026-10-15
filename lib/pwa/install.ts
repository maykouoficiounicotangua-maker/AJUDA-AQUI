"use client";
/**
 * Estado de instalação do PWA, compartilhado por qualquer componente (convite, botão "Instalar app").
 * O evento `beforeinstallprompt` (Android/Chrome/Edge) é capturado assim que este módulo carrega.
 */
import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "native" | "ios" | "unsupported";
interface InstallState {
  installed: boolean; // já está rodando como app (standalone)
  platform: Platform; // native = dá para instalar com um toque; ios = instruções manuais
}

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = { installed: false, platform: "unsupported" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}
function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

if (typeof window !== "undefined") {
  state = { installed: isStandalone(), platform: isIOS() && !isStandalone() ? "ios" : "unsupported" };
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // nós mostramos o convite no momento certo
    deferred = e as BeforeInstallPromptEvent;
    state = { ...state, platform: "native" };
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    state = { installed: true, platform: "unsupported" };
    emit();
  });
}

const SERVER: InstallState = { installed: false, platform: "unsupported" };

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER,
  );
}

/** Abre o diálogo nativo de instalação. Retorna true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  state = { ...state, platform: outcome === "accepted" ? "unsupported" : state.platform };
  emit();
  return outcome === "accepted";
}

// ---- Coordenação entre os convites (instalar primeiro, depois notificações) ----
const DISMISS_KEY = "aa:install-dismissed-at";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export function installSnoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}
export function snoozeInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch { /* ignorar */ }
}

let installSheetOpen = false;
const sheetListeners = new Set<() => void>();
export function setInstallSheetOpen(open: boolean) {
  installSheetOpen = open;
  sheetListeners.forEach((l) => l());
}
export function useInstallSheetOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      sheetListeners.add(cb);
      return () => sheetListeners.delete(cb);
    },
    () => installSheetOpen,
    () => false,
  );
}
