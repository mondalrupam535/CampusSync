'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { answerAssistantQuery, extractUniversityCalendar } = require('./assistant');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const CALENDAR_STORE = path.join(__dirname, 'data', 'university-calendar');
const MAX_CALENDAR_BYTES = 15 * 1024 * 1024;
const CALENDAR_EVENT_TYPES = ['Meeting', 'Seminar', 'Workshop', 'Conference', 'Cultural Event', 'Sports', 'Other'];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function validateCalendarEvents(events) {
  if (events.length > 500) {
    const error = new Error('The calendar contains too many entries to import at once.');
    error.statusCode = 422;
    throw error;
  }

  const cleanedEvents = [];
  const seen = new Set();

  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) continue;
    const title = typeof event.title === 'string' ? event.title.trim().slice(0, 200) : '';
    const startDate = event.startDate;
    const endDate = event.endDate == null || event.endDate === '' ? startDate : event.endDate;
    if (!title || !isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) continue;

    const hasStartTime = isValidTime(event.startTime);
    const hasEndTime = isValidTime(event.endTime);
    const hasTime = hasStartTime && hasEndTime;
    if ((event.startTime != null || event.endTime != null) && !hasTime) continue;
    if (hasTime && endDate === startDate && event.endTime <= event.startTime) continue;

    const dedupeKey = `${title.toLocaleLowerCase()}|${startDate}|${endDate}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    cleanedEvents.push({
      title,
      startDate,
      endDate,
      startTime: hasTime ? event.startTime : null,
      endTime: hasTime ? event.endTime : null,
      department: typeof event.department === 'string' ? event.department.trim().slice(0, 120) : '',
      type: CALENDAR_EVENT_TYPES.includes(event.type) ? event.type : 'Other',
      audience: typeof event.audience === 'string' ? event.audience.trim().slice(0, 100) : '',
      venue: typeof event.venue === 'string' ? event.venue.trim().slice(0, 200) : '',
      description: typeof event.description === 'string' ? event.description.trim().slice(0, 1000) : ''
    });
  }

  return cleanedEvents;
}

async function readSavedCalendar() {
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(CALENDAR_STORE, 'current.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  if (!manifest || typeof manifest.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(manifest.id)) {
    throw new Error('Saved university calendar metadata is invalid.');
  }

  const directory = path.join(CALENDAR_STORE, manifest.id);
  const calendar = JSON.parse(await fs.readFile(path.join(directory, 'calendar.json'), 'utf8'));
  return {
    id: manifest.id,
    filename: calendar.filename,
    uploadedAt: calendar.uploadedAt,
    eventCount: calendar.events.length,
    events: calendar.events
  };
}

app.use(express.json({ limit: '32kb' }));

app.get('/health', (req, res) => {
  res.json({
    service: 'CampusSync Gemini assistant',
    status: 'online',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.post('/assistant-chat', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const page = typeof body.page === 'string' ? body.page : 'dashboard';
    const messages = Array.isArray(body.messages)
      ? body.messages
      : typeof body.message === 'string'
        ? [{ role: 'user', content: body.message }]
        : [];

    if (!messages.length || messages.length > 12) {
      return res.status(400).json({ error: 'Send between 1 and 12 messages.' });
    }

    const validMessages = messages.every((message) =>
      message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string' &&
      message.content.trim() &&
      message.content.length <= 5000
    );
    if (!validMessages) {
      return res.status(400).json({ error: 'Messages must have a user or assistant role and contain at most 5,000 characters.' });
    }

    const recipientType = page === 'inbox-composer' && body.recipientType === 'person'
      ? 'person'
      : 'department';
    const senderContext = (page === 'inbox-composer' && body.senderContext && typeof body.senderContext === 'object' && !Array.isArray(body.senderContext))
      ? body.senderContext
      : null;
    const answer = await answerAssistantQuery(messages, page, recipientType, senderContext);
    res.json(answer);
  } catch (error) {
    console.error('Assistant request failed:', error.message);
    res.status(error.statusCode || 500).json({ error: error.message || 'Assistant request failed.' });
  }
});

app.get('/university-calendar', async (req, res) => {
  try {
    const calendar = await readSavedCalendar();
    res.json({ calendar });
  } catch (error) {
    console.error('Could not read the saved university calendar:', error.message);
    res.status(500).json({ error: 'Could not load the saved university calendar.' });
  }
});

app.put(
  '/university-calendar',
  express.raw({ type: 'application/pdf', limit: MAX_CALENDAR_BYTES }),
  async (req, res) => {
    let calendarId;
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Select a PDF calendar to upload.' });
      }
      if (req.body.length > MAX_CALENDAR_BYTES) {
        return res.status(413).json({ error: 'Calendar PDFs must be 15 MB or smaller.' });
      }
      if (req.body.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' });
      }

      let sourceName = req.get('x-calendar-filename') || 'university-calendar.pdf';
      try {
        sourceName = decodeURIComponent(sourceName);
      } catch (error) {
        return res.status(400).json({ error: 'The calendar filename is invalid.' });
      }
      const filename = path.basename(sourceName).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'university-calendar.pdf';
      if (!filename.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Choose a file with the .pdf extension.' });
      }

      const extracted = await extractUniversityCalendar(req.body);
      const events = validateCalendarEvents(extracted);
      if (!events.length) {
        return res.status(422).json({ error: 'No dated university events could be extracted. Check that the PDF contains a readable calendar and try again.' });
      }

      calendarId = randomUUID();
      const versionDirectory = path.join(CALENDAR_STORE, calendarId);
      await fs.mkdir(versionDirectory, { recursive: true });

      const calendar = {
        id: calendarId,
        filename,
        uploadedAt: new Date().toISOString(),
        events
      };
      await fs.writeFile(path.join(versionDirectory, 'calendar.pdf'), req.body, { flag: 'wx' });
      await fs.writeFile(path.join(versionDirectory, 'calendar.json'), JSON.stringify(calendar, null, 2), { flag: 'wx' });
      await fs.mkdir(CALENDAR_STORE, { recursive: true });
      const temporaryManifest = path.join(CALENDAR_STORE, `${calendarId}.tmp`);
      await fs.writeFile(temporaryManifest, JSON.stringify({ id: calendarId }), { flag: 'wx' });
      await fs.rename(temporaryManifest, path.join(CALENDAR_STORE, 'current.json'));

      try {
        const entries = await fs.readdir(CALENDAR_STORE, { withFileTypes: true });
        await Promise.all(entries
          .filter((entry) => entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name) && entry.name !== calendarId)
          .map((entry) => fs.rm(path.join(CALENDAR_STORE, entry.name), { recursive: true, force: true })));
      } catch (cleanupError) {
        console.error('Could not remove the previous university calendar version:', cleanupError.message);
      }

      res.json({
        calendar: {
          id: calendar.id,
          filename: calendar.filename,
          uploadedAt: calendar.uploadedAt,
          eventCount: events.length,
          events
        }
      });
    } catch (error) {
      if (calendarId) {
        await fs.rm(path.join(CALENDAR_STORE, calendarId), { recursive: true, force: true }).catch((cleanupError) => {
          console.error('Could not remove an incomplete calendar upload:', cleanupError.message);
        });
      }
      console.error('University calendar upload failed:', error.message);
      res.status(error.statusCode || 500).json({ error: error.message || 'Could not process the university calendar.' });
    }
  }
);

app.delete('/university-calendar', async (req, res) => {
  try {
    await fs.rm(CALENDAR_STORE, { recursive: true, force: true });
    res.json({ calendar: null });
  } catch (error) {
    console.error('Could not delete the saved university calendar:', error.message);
    res.status(500).json({ error: 'Could not delete the saved university calendar.' });
  }
});

app.use((error, req, res, next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  console.error('HTTP request failed:', error.message);
  res.status(status).json({
    error: status === 413
      ? 'Calendar PDFs must be 15 MB or smaller.'
      : status === 400
        ? 'Invalid request body.'
        : 'The request could not be processed.'
  });
});

app.use((req, res, next) => {
  const privateDataRoute = `/${path.relative(WORKSPACE_ROOT, path.join(__dirname, 'data')).split(path.sep).join('/')}/`;
  if (req.path.split('/').some((segment) => segment === 'node_modules') || req.path.startsWith(privateDataRoute)) {
    return res.sendStatus(404);
  }
  next();
});

app.use(express.static(WORKSPACE_ROOT, {
  dotfiles: 'ignore',
  index: false
}));

app.get('/', (req, res) => {
  res.redirect('/login_signup%20page/index.html');
});

app.listen(PORT, () => {
  console.log(`CampusSync is available at http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not configured. Add it to gemini-assistant/.env to enable AI.');
  }
});
