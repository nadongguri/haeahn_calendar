export function toDateTimeLocalValue(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function dateTimeLocalToIso(value: string) {
  return new Date(value).toISOString();
}

export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function parseAttendees(value: string) {
  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

export function attendeesToInput(attendees: string[] | null | undefined) {
  return attendees?.join(", ") ?? "";
}
