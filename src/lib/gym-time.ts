type DateParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function getDateParts(date: Date, timeZone: string): DateParts {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => Number(values.find((item) => item.type === name)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") };
}

function dateKey({ year, month, day }: Pick<DateParts, "year" | "month" | "day">) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function gymDateKey(date = new Date(), timeZone = "Asia/Kolkata") {
  return dateKey(getDateParts(date, timeZone));
}

export function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return dateKey({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() });
}

export function gymDateTimeToUtc(key: string, time: string, timeZone = "Asia/Kolkata") {
  const [year, month, day] = key.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getDateParts(new Date(timestamp), timeZone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    const adjustment = target - observedAsUtc;
    timestamp += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(timestamp);
}

export function gymDateStartUtc(key: string, timeZone = "Asia/Kolkata") {
  return gymDateTimeToUtc(key, "00:00", timeZone);
}

export function formatGymDate(date: Date, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatGymTime(date: Date | string, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(typeof date === "string" ? new Date(date) : date);
}
