const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LocalTimeParts {
  dayOfWeek: number;
  minutesSinceMidnight: number;
}

// Convierte un instante a día de la semana + minutos desde medianoche en una zona horaria dada,
// usando Intl (no getUTCDay/getHours) para no depender de la hora local del servidor. Compartido
// entre closures.service.ts (validación de cierre) y closures-reminder.service.ts (avisos push).
export function toLocalTimeParts(date: Date, timezone: string): LocalTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  if (hour === 24) hour = 0; // Intl puede devolver "24" para medianoche con hour12:false

  return { dayOfWeek: WEEKDAYS.indexOf(weekday), minutesSinceMidnight: hour * 60 + minute };
}

export function closeTimeToMinutes(closeTime: string): number {
  const [hour, minute] = closeTime.split(':').map(Number);
  return hour * 60 + minute;
}
