import { CalendarClock } from 'lucide-react';
import type { Settings } from '../types';

function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00');
  return Math.ceil((target.getTime() - Date.now()) / (24 * 3600 * 1000));
}

export default function CountdownHeader({ settings }: { settings: Settings }) {
  const signDays = daysUntil(settings.signDeadline);
  const moveDays = daysUntil(settings.moveInDate);
  const urgency = signDays <= 7 ? 'bg-red-100 text-red-800' : signDays <= 14 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${urgency}`}>
        <CalendarClock className="h-3.5 w-3.5" />
        {signDays >= 0 ? `${signDays} days to sign (${settings.signDeadline})` : `Sign deadline passed (${settings.signDeadline})`}
      </span>
      <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 sm:block">
        Move-in {settings.moveInDate} ({moveDays}d)
      </span>
    </div>
  );
}
