import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ImapFlow } from 'imapflow';
import ical from 'node-ical';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve dashboard.html as root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Serve static files (CSS, JS, etc. but not index.html)
app.use((req, res, next) => {
  if (req.path === '/') return; // Skip root, already handled
  express.static(path.join(__dirname))(req, res, next);
});

// ============================================================================
// HELPERS
// ============================================================================

// Resolve to `fallback` if `promise` doesn't settle within `ms`, so a single
// slow/stuck source can never freeze the whole /api/dashboard response.
function withTimeout(promise, ms, fallback) {
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((v) => { clearTimeout(timer); return v; }),
    guard,
  ]);
}

// Get Apple Reminders for a given list using osascript (macOS only)
async function getAppleReminders(listName) {
  try {
    // Use osascript with -e flag to get all reminders
    const escapedList = listName.replace(/"/g, '\\"');
    const script = `tell application "Reminders"
  set remindersList to reminders in list "${escapedList}" whose completed is false
  set output to ""
  repeat with aReminder in remindersList
    set output to output & (name of aReminder) & linefeed
  end repeat
  return output
end tell`;

    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

    // Parse osascript output (each reminder on a new line)
    const reminderTitles = stdout
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(title => ({ title: title.trim() }));

    return reminderTitles;
  } catch (error) {
    console.error(`Error fetching ${listName} reminders:`, error.message);
    return [];
  }
}

// Get weather for Parsippany, NJ (Open-Meteo - no API key needed)
async function getWeather() {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=40.8351&longitude=-74.1745&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature'
    );
    const data = await res.json();
    const current = data.current;

    // Map WMO weather codes to conditions
    const conditions = {
      0: 'Clear', 1: 'Partly Cloudy', 2: 'Cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Foggy',
      51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
      71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
      85: 'Light Snow Showers', 86: 'Snow Showers',
      95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Thunderstorm + Hail'
    };

    return {
      temp: Math.round(current.temperature_2m * 9 / 5 + 32), // Convert C to F
      condition: conditions[current.weather_code] || 'Unknown',
      description: conditions[current.weather_code] || 'Unknown',
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m * 0.621371), // Convert km/h to mph
      feelsLike: Math.round(current.apparent_temperature * 9 / 5 + 32),
    };
  } catch (error) {
    console.error('Weather fetch error:', error.message);
    return { error: 'Failed to fetch weather' };
  }
}

// Get random motivational quote
async function getQuote() {
  try {
    const res = await fetch('https://zenquotes.io/api/random');
    const data = await res.json();
    if (data && data[0]) {
      return {
        text: data[0].q,
        author: data[0].a.replace(/\n/g, ''),
      };
    }
    return { text: 'Every morning brings new possibilities.', author: 'Anon' };
  } catch (error) {
    console.error('Quote fetch error:', error.message);
    return { text: 'Every morning brings new possibilities.', author: 'Anon' };
  }
}

// Get Hermes cron job status
async function getCronStatus() {
  try {
    // Read cron jobs from Hermes config
    const cronDir = path.join(process.env.HOME || '/root', '.hermes/cron');
    const jobsFile = path.join(cronDir, 'jobs.json');

    if (!fs.existsSync(jobsFile)) {
      return { jobs: [], status: 'active' };
    }

    const jobsData = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
    const jobs = (jobsData.jobs || [])
      .filter(job => job.enabled)
      .map(job => ({
        name: job.name,
        schedule: job.schedule,
        nextRun: job.next_run_at,
        lastRun: job.last_run_at,
        status: job.state === 'scheduled' ? 'active' : job.state,
      }))
      .slice(0, 10); // Show top 10

    return { jobs, status: 'active' };
  } catch (error) {
    console.error('Cron status error:', error.message);
    return { jobs: [], status: 'error' };
  }
}

// Get CMY Order Watcher state
async function getCMYWatcherStatus() {
  try {
    const stateFile = path.join(process.env.HOME || '/root', '.cmy-watcher/state.json');
    if (!fs.existsSync(stateFile)) return { error: 'CMY watcher state not found' };

    const content = fs.readFileSync(stateFile, 'utf8');
    const state = JSON.parse(content);

    return {
      lastCheck: state.lastCheck,
      lastOrder: state.lastOrder,
      status: state.status || 'active',
      ordersToday: state.ordersToday || 0,
      acceptedToday: state.acceptedToday || 0,
      daily: state.daily || 0,
      weekly: state.weekly || 0,
      weeklyTotal: state.weekly_total || 0,
      monthly: state.monthly || 0,
      monthlyTotal: state.monthly_total || 0,
    };
  } catch (error) {
    console.error('CMY watcher error:', error.message);
    return { error: 'Failed to fetch CMY watcher status' };
  }
}

// Apollo sequence metrics via the Apollo REST API.
// Requires APOLLO_API_KEY in .env (Apollo > Settings > Integrations > API).
async function getApolloMetrics() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return {
      status: 'not_configured',
      message: 'Add APOLLO_API_KEY to your .env file to load sequences.',
    };
  }

  try {
    const res = await fetch('https://api.apollo.io/v1/emailer_campaigns/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ page: 1, per_page: 100 }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { status: 'error', message: `Apollo API ${res.status}: ${text.slice(0, 120)}` };
    }

    const data = await res.json();
    const campaigns = data.emailer_campaigns || [];
    const active = campaigns.filter(c => c.active && !c.archived);

    const sum = (key) => active.reduce((acc, c) => acc + (c[key] || 0), 0);

    // Top 5 active sequences, most recently used first
    const sequences = active
      .slice()
      .sort((a, b) => new Date(b.last_used_at || 0) - new Date(a.last_used_at || 0))
      .slice(0, 5)
      .map(c => ({
        name: c.name,
        steps: c.num_steps || 0,
        delivered: c.unique_delivered || 0,
        opened: c.unique_opened || 0,
        replied: c.unique_replied || 0,
        openRate: Math.round((c.open_rate || 0) * 100),
        poorly: !!c.is_performing_poorly,
      }));

    return {
      status: 'connected',
      activeCount: active.length,
      totalCount: data.pagination ? data.pagination.total_entries : campaigns.length,
      totalDelivered: sum('unique_delivered'),
      totalOpened: sum('unique_opened'),
      totalReplied: sum('unique_replied'),
      sequences,
    };
  } catch (error) {
    console.error('Apollo error:', error.message);
    return { status: 'error', message: error.message };
  }
}

// Today's calendar events.
// Default: read the Mac Calendar app (all accounts at once) via icalBuddy.
// Fallback: if CALENDAR_ICS_URL is set, read those secret iCal feeds instead.
async function getCalendarEvents() {
  const raw = process.env.CALENDAR_ICS_URL || '';
  const urls = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (urls.length > 0) {
    return getCalendarFromICS(urls);
  }
  return getCalendarFromMac();
}

// Read today's events from the Mac Calendar app via icalBuddy (uses EventKit,
// so it sees every account already configured in Calendar.app).
// Install once: brew install ical-buddy
async function getCalendarFromMac() {
  const bin = process.env.ICALBUDDY_BIN || 'icalBuddy';
  try {
    // -nc no calendar names, -b "" no bullet, -sd sort by date,
    // -nrd absolute (not "today at"), -tf 24h time. One event's title is a
    // non-indented line; its time appears on the following indented line(s).
    const { stdout } = await execAsync(
      `${bin} -nc -sd -nrd -b "" -tf "%H:%M" eventsToday`,
      { timeout: 10000 }
    );

    const events = [];
    let current = null;
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      if (/^\s/.test(line)) {
        // indented property line (datetime / location) for the current event
        if (current && !current.start) {
          const t = line.trim();
          if (/all[- ]?day/i.test(t)) current.start = 'All day';
          else {
            const m = t.match(/\b(\d{1,2}:\d{2})\b/);
            if (m) current.start = m[1];
          }
        }
      } else {
        current = { summary: line.trim(), start: '' };
        events.push(current);
      }
    }

    const cleaned = events.map(e => ({ summary: e.summary, start: e.start || 'All day' }));
    return { status: 'connected', events: cleaned.slice(0, 12) };
  } catch (error) {
    const msg = error.message || '';
    if (/not found|No such file|ENOENT/i.test(msg)) {
      return {
        status: 'not_configured',
        events: [],
        message: 'icalBuddy not installed. Run: brew install ical-buddy',
      };
    }
    console.error('Calendar error:', msg);
    return { status: 'error', events: [], message: msg.slice(0, 160) };
  }
}

// Read today's events from one or more secret iCal (.ics) feed URLs.
async function getCalendarFromICS(urls) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todays = [];
  const addEvent = (ev, startDate) => {
    const allDay = ev.datetype === 'date';
    todays.push({
      summary: ev.summary || '(no title)',
      start: allDay
        ? 'All day'
        : startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      _sort: startDate.getTime(),
    });
  };

  const collectFromFeed = (data) => {
    for (const key of Object.keys(data)) {
      const ev = data[key];
      if (!ev || ev.type !== 'VEVENT') continue;

      if (ev.rrule) {
        const occurrences = ev.rrule.between(dayStart, dayEnd, true);
        for (const occ of occurrences) {
          const exKey = occ.toISOString().slice(0, 10);
          if (ev.exdate && ev.exdate[exKey]) continue;
          addEvent(ev, occ);
        }
      } else if (ev.start) {
        const s = new Date(ev.start);
        if (s >= dayStart && s <= dayEnd) addEvent(ev, s);
      }
    }
  };

  const errors = [];
  for (const url of urls) {
    try {
      const data = await ical.async.fromURL(url);
      collectFromFeed(data);
    } catch (error) {
      console.error('Calendar error:', error.message);
      errors.push(error.message.slice(0, 80));
    }
  }

  // All feeds failed to load
  if (errors.length === urls.length) {
    return { status: 'error', events: [], message: errors[0] || 'Failed to load calendar.' };
  }

  todays.sort((a, b) => a._sort - b._sort);
  const events = todays.slice(0, 12).map(({ summary, start }) => ({ summary, start }));
  return { status: 'connected', events };
}

// Get Gmail unread counts via IMAP (imapflow), with a per-label breakdown.
// One connection to your aggregate inbox shows everything that lands there.
// Requires IMAP_USER + IMAP_PASSWORD (a Gmail App Password) in .env.
// Optional: GMAIL_LABELS="Bio-One,Card My Yard,Personal" pins specific labels;
// otherwise it auto-discovers labels that currently have unread mail.
async function getEmailStatus() {
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const host = process.env.IMAP_HOST || 'imap.gmail.com';

  if (!user || !pass) {
    return {
      status: 'not_configured',
      unread: 0,
      labels: [],
      message: 'Add IMAP_USER and IMAP_PASSWORD (Gmail App Password) to your .env file.',
    };
  }

  const wanted = (process.env.GMAIL_LABELS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    // Bound every IMAP step so the connection can't hang indefinitely
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });

  try {
    await client.connect();

    // Total unread in the inbox
    const inbox = await client.status('INBOX', { unseen: true });
    const totalUnread = inbox.unseen || 0;

    let labels = [];
    if (wanted.length) {
      // Pinned labels from .env — report each (flag any that don't exist)
      for (const name of wanted) {
        try {
          const st = await client.status(name, { unseen: true });
          labels.push({ name, unread: st.unseen || 0 });
        } catch {
          labels.push({ name, unread: 0, missing: true });
        }
      }
    } else {
      // Auto-discover: user labels that currently have unread mail.
      // Cap the number of folders scanned so accounts with many labels
      // can't make this step crawl (one round-trip per folder).
      const boxes = (await client.list())
        .filter(box => {
          const p = box.path;
          if (p === 'INBOX') return false;            // shown as the total
          if (p.startsWith('[Gmail]')) return false;  // system folders
          if (box.flags && box.flags.has('\\Noselect')) return false;
          return true;
        })
        .slice(0, 40);
      for (const box of boxes) {
        try {
          const st = await client.status(box.path, { unseen: true });
          if ((st.unseen || 0) > 0) labels.push({ name: box.path, unread: st.unseen });
        } catch { /* skip unreadable folders */ }
      }
      labels.sort((a, b) => b.unread - a.unread);
      labels = labels.slice(0, 8);
    }

    await client.logout();
    return { status: 'connected', unread: totalUnread, labels };
  } catch (error) {
    console.error('Gmail/IMAP error:', error.message);
    try { await client.logout(); } catch { /* already closed */ }
    return { status: 'error', unread: 0, labels: [], message: error.message.slice(0, 160) };
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/api/dashboard', async (req, res) => {
  try {
    // Each source is time-boxed so one slow/stuck service can't freeze the page.
    const [weather, quote, cronStatus, cmyStatus, apollo, calendar, email, reminders] =
      await Promise.all([
        withTimeout(getWeather(), 8000, { error: 'Weather timed out' }),
        withTimeout(getQuote(), 8000, { text: 'Every morning brings new possibilities.', author: 'Anon' }),
        withTimeout(getCronStatus(), 5000, { jobs: [], status: 'error' }),
        withTimeout(getCMYWatcherStatus(), 5000, { error: 'CMY watcher timed out' }),
        withTimeout(getApolloMetrics(), 12000, { status: 'error', message: 'Apollo timed out' }),
        withTimeout(getCalendarEvents(), 12000, { status: 'error', events: [], message: 'Calendar timed out' }),
        withTimeout(getEmailStatus(), 15000, { status: 'error', unread: 0, labels: [], message: 'Gmail timed out' }),
        withTimeout(Promise.all([
          getAppleReminders('Bio-One'),
          getAppleReminders('Card My Yard'),
          getAppleReminders('Ryan\'s Personal'),
        ]), 8000, [[], [], []]),
      ]);

    res.json({
      timestamp: new Date().toISOString(),
      weather,
      quote,
      cronStatus,
      cmyWatcher: cmyStatus,
      apollo,
      calendar,
      email,
      reminders: {
        bioOne: reminders[0] || [],
        cmy: reminders[1] || [],
        personal: reminders[2] || [],
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cron-status', async (req, res) => {
  const status = await getCronStatus();
  res.json(status);
});

app.get('/api/cmy-watcher', async (req, res) => {
  const status = await getCMYWatcherStatus();
  res.json(status);
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`\n🌅 Morning Dashboard server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/dashboard\n`);
});
