export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export function detectDevice(userAgent: string | null | undefined): { deviceType: DeviceType; browser: string } {
  const ua = userAgent ?? "";
  const deviceType: DeviceType = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : ua ? "desktop" : "unknown";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Outro";
  return { deviceType, browser };
}
