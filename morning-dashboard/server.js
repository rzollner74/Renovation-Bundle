import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ImapFlow } from 'imapflow';
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

// Get Google Calendar events for today via the Hermes google-workspace skill.
// Returns { status, events, message } so the dashboard can explain failures.
async function getCalendarEvents() {
  const scriptPath = path.join(
    process.env.HOME || '/root',
    '.hermes/skills/productivity/google-workspace/scripts/google_api.py'
  );

  if (!fs.existsSync(scriptPath)) {
    return {
      status: 'not_configured',
      events: [],
      message: 'Google Workspace script not found on this machine — calendar not set up.',
    };
  }

  try {
    const { stdout } = await execAsync(`python "${scriptPath}" calendar list`);
    const events = JSON.parse(stdout || '[]');
    return { status: 'connected', events: events.slice(0, 5) }; // next 5 events
  } catch (error) {
    console.error('Calendar error:', error.message);
    return { status: 'error', events: [], message: error.message.slice(0, 160) };
  }
}

// Get Gmail unread count via IMAP (imapflow).
// One connection to your aggregate inbox shows everything that lands there —
// no need to configure each forwarding account separately.
// Requires IMAP_USER + IMAP_PASSWORD (a Gmail App Password) in .env.
async function getEmailStatus() {
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const host = process.env.IMAP_HOST || 'imap.gmail.com';

  if (!user || !pass) {
    return {
      status: 'not_configured',
      unread: 0,
      message: 'Add IMAP_USER and IMAP_PASSWORD (Gmail App Password) to your .env file.',
    };
  }

  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    // status() reads counts without opening/locking the mailbox
    const status = await client.status('INBOX', { unseen: true, messages: true });
    await client.logout();
    return {
      status: 'connected',
      unread: status.unseen || 0,
      total: status.messages || 0,
    };
  } catch (error) {
    console.error('Gmail/IMAP error:', error.message);
    try { await client.logout(); } catch { /* already closed */ }
    return { status: 'error', unread: 0, message: error.message.slice(0, 160) };
  }
}

// ============================================================================
// ENDPOINTS
// ============================================================================

app.get('/api/dashboard', async (req, res) => {
  try {
    const [weather, quote, cronStatus, cmyStatus, apollo, calendar, email, reminders] =
      await Promise.all([
        getWeather(),
        getQuote(),
        getCronStatus(),
        getCMYWatcherStatus(),
        getApolloMetrics(),
        getCalendarEvents(),
        getEmailStatus(),
        Promise.all([
          getAppleReminders('Bio-One'),
          getAppleReminders('Card My Yard'),
          getAppleReminders('Ryan\'s Personal'),
        ]),
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
