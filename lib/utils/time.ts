export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Data "YYYY-MM-DD" e hora "HH:MM" atuais em um fuso. */
export function nowInTimezone(tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** O par data/hora (locais ao fuso) já passou? */
export function isInPast(date: string, time: string, tz: string = DEFAULT_TIMEZONE, now: Date = new Date()): boolean {
  const cur = nowInTimezone(tz, now);
  return `${date} ${time.slice(0, 5)}` <= `${cur.date} ${cur.time}`;
}
