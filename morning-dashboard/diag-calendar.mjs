// Privacy-safe calendar diagnostic.
// Run: node diag-calendar.mjs
// Prints counts and the date/type of events near today — NO event titles —
// so we can see why "today" matching may be off (timezone, all-day, etc.).
import 'dotenv/config';
import ical from 'node-ical';

const url = process.env.CALENDAR_ICS_URL;
if (!url) {
  console.log('No CALENDAR_ICS_URL found in .env');
  process.exit(1);
}

const data = await ical.async.fromURL(url);

const now = new Date();
const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

let vevents = 0;
let recurring = 0;
let matchedToday = 0;
const near = [];

for (const k in data) {
  const e = data[k];
  if (!e || e.type !== 'VEVENT') continue;
  vevents++;
  if (e.rrule) recurring++;

  if (e.start) {
    const s = new Date(e.start);
    // Collect non-recurring events within ~4 days of now (no titles)
    if (!e.rrule && Math.abs(s - now) < 4 * 86400000) {
      near.push({
        datetype: e.datetype,          // 'date' = all-day, 'date-time' = timed
        startLocal: s.toString(),
        startISO: s.toISOString(),
      });
    }
    if (!e.rrule && s >= dayStart && s <= dayEnd) matchedToday++;
  }

  if (e.rrule) {
    try {
      const occ = e.rrule.between(dayStart, dayEnd, true);
      matchedToday += occ.length;
    } catch { /* ignore */ }
  }
}

console.log('now            :', now.toString());
console.log('today window   :', dayStart.toString(), '->', dayEnd.toString());
console.log('total VEVENTs  :', vevents);
console.log('recurring      :', recurring);
console.log('matched today  :', matchedToday);
console.log('non-recurring events near today (NO titles):');
console.log(JSON.stringify(near, null, 2));
