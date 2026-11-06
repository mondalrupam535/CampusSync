(function () {
  'use strict';

  /* =====================================================
     Constants
  ===================================================== */
  var STORE_KEY = 'campussync_events_v1';
  var HOUR_START = 7, HOUR_END = 21, HOUR_H = 56;
  var DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  var DEPARTMENTS = window.CAMPUS_DEPARTMENTS.all;
  var TYPES = ['Meeting', 'Seminar', 'Workshop', 'Conference', 'Cultural Event', 'Sports', 'Other'];
  var AUDIENCES = ['University-wide', 'Selected departments', 'Faculty only', 'Students only', 'Department only', 'Invite only'];
  var STATUSES = ['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Confirmed', 'Completed', 'Rejected', 'Cancelled'];
  var VENUES = window.CAMPUS_ROOM_DIRECTORY.map(function (entry) {
    return {
      name: entry.code + ' — ' + entry.facility,
      building: entry.building,
      cap: null,
      verification: entry.verification
    };
  });

  // Only these appear as university events on the shared calendar/list
  var PUBLIC_STATUSES = ['Approved', 'Confirmed', 'Completed', 'Cancelled'];
  var LIVE_STATUSES = ['Approved', 'Confirmed'];

  var STATUS_BADGE = {
    'Draft': 'badge-time',
    'Pending Approval': 'badge-orange',
    'Changes Requested': 'badge-orange',
    'Approved': 'badge-blue',
    'Confirmed': 'badge-mint',
    'Completed': 'badge-time',
    'Rejected': 'badge-red',
    'Cancelled': 'badge-red'
  };

  /* =====================================================
     Small helpers
  ===================================================== */
  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function toDate(s) { return new Date(s); }
  function slug(s) { return String(s).toLowerCase().replace(/\s+/g, '-'); }
  function fmtTime(d) {
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + pad(m) + ' ' + ap;
  }
  function fmtDay(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function sameDay(a, b) { return ymd(a) === ymd(b); }
  function byStart(a, b) { return toDate(a.start) - toDate(b.start); }
  function overlaps(aS, aE, bS, bE) { return aS < bE && aE > bS; }
  function timeRange(e) {
    var s = toDate(e.start), en = toDate(e.end);
    if (e.allDay) {
      var lastDay = addDays(en, -1);
      return sameDay(s, lastDay)
        ? fmtDay(s) + ' · All day'
        : fmtDay(s) + ' – ' + fmtDay(lastDay) + ' · All day';
    }
    if (sameDay(s, en)) return fmtDay(s) + ' · ' + fmtTime(s) + ' – ' + fmtTime(en);
    return fmtDay(s) + ' ' + fmtTime(s) + ' → ' + fmtDay(en) + ' ' + fmtTime(en);
  }
  function displayEventTime(e) {
    return e.allDay ? 'All day' : fmtTime(toDate(e.start));
  }
  function venueByName(n) {
    for (var i = 0; i < VENUES.length; i++) if (VENUES[i].name === n) return VENUES[i];
    return null;
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* =====================================================
     Current user
  ===================================================== */
  function readLS(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
  }
  var personal = readLS('onboarding.personal');
  var profile = readLS('onboarding.profile');
  var roleData = readLS('onboarding.role');
  var studentData = readLS('onboarding.student');
  var legacyName = [personal.first, personal.last].filter(Boolean).join(' ');
  var user = {
    name: profile.name || legacyName || 'CampusSync User',
    dept: roleData.dept || studentData.dept || '',
    role: String(roleData.category || 'student').toLowerCase()
  };
  var isAdminRole = ['admin', 'administrator', 'dean'].indexOf(user.role) !== -1;

  /* =====================================================
     Data
  ===================================================== */
  function ev(o) {
    var base = {
      description: '', requirements: '', attachment: '',
      registrationEnabled: false, registered: false, acknowledged: false, registrations: 0,
      hasAnnouncement: false, bookingStatus: 'Not requested',
      ownerId: 'other', organizer: '', contact: '', history: []
    };
    for (var k in o) base[k] = o[k];
    return base;
  }

  function emptyData() {
    return { events: [], attention: [] };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.events)) {
          var existingIds = p.events.map(function (event) { return event.id; });
          p.attention = Array.isArray(p.attention)
            ? p.attention.filter(function (item) { return existingIds.indexOf(item.eventId) !== -1; })
            : [];
          return p;
        }
      }
    } catch (e) {}
    return emptyData();
  }
  function saveData() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
    window.CampusSyncAPI.saveWorkspace('events', data);
  }

  var data = loadData();

  function autoComplete() {
    var now = new Date();
    data.events.forEach(function (e) {
      if (LIVE_STATUSES.indexOf(e.status) !== -1 && toDate(e.end) < now) e.status = 'Completed';
    });
  }
  autoComplete();
  saveData();

  function nextId() { return data.events.reduce(function (m, e) { return Math.max(m, e.id); }, 0) + 1; }
  function findEvent(id) { return data.events.filter(function (e) { return e.id === id; })[0]; }
  function isMine(e) { return e.ownerId === 'me'; }
  function canManage(e) { return !e.calendarImport && (isMine(e) || isAdminRole); }
  function isPublic(e) { return PUBLIC_STATUSES.indexOf(e.status) !== -1; }
  function addHistory(e, text) { e.history.push({ ts: new Date().toISOString(), text: text }); }
  function addAttention(e, text) {
    var id = data.attention.reduce(function (m, a) { return Math.max(m, a.id); }, 0) + 1;
    data.attention.push({ id: id, eventId: e.id, text: text });
  }

  /* =====================================================
     State
  ===================================================== */
  var state = {
    view: 'calendar',
    mode: 'month',
    cursor: new Date(),
    search: '',
    filters: { dept: 'all', type: 'all', audience: 'all', status: 'all' },
    showPending: false,
    editingId: null,
    detailsId: null
  };
  var savedCalendar = null;
  var calendarLoading = true;
  var calendarUploadInProgress = false;
  var pageParams = new URLSearchParams(window.location.search);
  if (pageParams.get('view') === 'list' || pageParams.get('view') === 'proposals') state.view = pageParams.get('view');
  if (pageParams.get('search')) {
    state.search = pageParams.get('search').trim().toLowerCase();
    $('eventsSearchInput').value = pageParams.get('search');
  }

  /* =====================================================
     Populate selects
  ===================================================== */
  function fillSelect(id, options, allLabel) {
    var sel = $(id);
    var html = allLabel ? '<option value="all">' + esc(allLabel) + '</option>' : '<option value="">Select...</option>';
    options.forEach(function (o) {
      var label = typeof o === 'string' ? o : o.label;
      var value = typeof o === 'string' ? o : o.value;
      html += '<option value="' + esc(value) + '">' + esc(label) + '</option>';
    });
    sel.innerHTML = html;
  }
  fillSelect('fDept', DEPARTMENTS, 'All departments');
  fillSelect('fType', TYPES, 'All types');
  fillSelect('fAudience', AUDIENCES, 'All audiences');
  fillSelect('fStatus', STATUSES, 'Any status');
  fillSelect('pType', TYPES);
  fillSelect('pDept', DEPARTMENTS);
  fillSelect('pAudience', AUDIENCES);
  fillSelect('pVenue', VENUES.map(function (v) {
    return {
      value: v.name,
      label: v.name + ' — ' + v.building + ' (capacity not listed; ' + v.verification + ')'
    };
  }));

  /* =====================================================
     Filtering
  ===================================================== */
  function passesFilters(e) {
    var f = state.filters;
    if (f.dept !== 'all' && e.dept !== f.dept) return false;
    if (f.type !== 'all' && e.type !== f.type) return false;
    if (f.audience !== 'all' && e.audience !== f.audience) return false;
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (state.search) {
      var hay = [e.title, e.dept, e.venue, e.type, e.description, e.organizer, e.audience].join(' ').toLowerCase();
      if (hay.indexOf(state.search) === -1) return false;
    }
    return true;
  }

  function publicEvents() { return data.events.filter(isPublic); }
  function myEvents() { return data.events.filter(isMine); }

  function visibleFor(view) {
    var now = new Date();
    var list;
    if (view === 'calendar') {
      list = publicEvents();
      if (state.showPending) {
        list = list.concat(data.events.filter(function (e) { return isMine(e) && e.status === 'Pending Approval'; }));
      }
    } else if (view === 'list') {
      list = publicEvents();
      if (state.filters.status === 'all') {
        list = list.filter(function (e) { return toDate(e.end) >= now; });
      }
    } else {
      list = myEvents();
    }
    return list.filter(passesFilters).sort(byStart);
  }

  function eventsOnDay(list, day) {
    var ds = startOfDay(day), de = addDays(ds, 1);
    return list.filter(function (e) { return toDate(e.start) < de && toDate(e.end) > ds; }).sort(byStart);
  }

  function hasOverlap(e, list) {
    if (e.status === 'Cancelled' || e.calendarImport || e.allDay) return false;
    var s = toDate(e.start), en = toDate(e.end);
    return list.some(function (o) {
      return o !== e && !o.calendarImport && !o.allDay && o.status !== 'Cancelled' &&
        overlaps(s, en, toDate(o.start), toDate(o.end));
    });
  }

  /* =====================================================
     Stats / attention / upcoming
  ===================================================== */
  function updateStats() {
    var now = new Date();
    var upcoming = publicEvents().filter(function (e) { return LIVE_STATUSES.indexOf(e.status) !== -1 && toDate(e.end) >= now; });
    var mine = myEvents().filter(function (e) { return e.status !== 'Cancelled' && e.status !== 'Completed'; });
    var month = publicEvents().filter(function (e) {
      var s = toDate(e.start);
      return e.status !== 'Cancelled' && s.getMonth() === now.getMonth() && s.getFullYear() === now.getFullYear();
    });
    $('statUpcoming').textContent = upcoming.length;
    $('statProposals').textContent = mine.length;
    $('statMonth').textContent = month.length;
    $('statAttention').textContent = data.attention.length;
  }

  function renderAttention() {
    var box = $('attentionPanel');
    if (!data.attention.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var html = '<h3>🔔 Needs Attention</h3>';
    data.attention.forEach(function (a) {
      html += '<div class="att-item"><span>' + esc(a.text) + '</span><span class="att-actions">' +
        '<button class="btn btn-outline btn-sm-x" data-att-view="' + a.eventId + '">View</button>' +
        '<button class="btn btn-outline btn-sm-x" data-att-dismiss="' + a.id + '">Dismiss</button></span></div>';
    });
    box.innerHTML = html;
    box.style.display = '';
  }

  function dateBlock(e) {
    var s = toDate(e.start);
    return '<div class="date-block"><small>' + MONTHS_SHORT[s.getMonth()] + '</small><b>' + pad(s.getDate()) + '</b></div>';
  }

  function renderUpcoming() {
    var now = new Date();
    var list = publicEvents()
      .filter(function (e) { return LIVE_STATUSES.indexOf(e.status) !== -1 && toDate(e.end) >= now; })
      .sort(byStart).slice(0, 5);
    var box = $('upcomingList');
    if (!list.length) { box.innerHTML = '<div class="empty-box">No upcoming events.</div>'; return; }
    box.innerHTML = list.map(function (e) {
      return '<div class="ev-row" data-id="' + e.id + '">' + dateBlock(e) +
        '<div class="ev-info"><div class="ev-title">' + esc(e.title) + '</div>' +
        '<div class="ev-meta">' + esc(e.dept) + ' · ' + displayEventTime(e) + '</div></div>' +
        '<span class="badge ' + STATUS_BADGE[e.status] + '">' + esc(e.status) + '</span></div>';
    }).join('');
  }

  /* =====================================================
     Calendar rendering
  ===================================================== */
  function chip(e, dayList, full) {
    var cls = 'ev-chip st-' + slug(e.status) + (full ? ' full' : '') + (hasOverlap(e, dayList) ? ' overlap' : '');
    var inner = '<span class="t">' + esc(displayEventTime(e)) + '</span>' + esc(e.title);
    if (full) inner += '<span class="sub">' + esc(e.venue) + ' · ' + esc(e.status) + '</span>';
    return '<button class="' + cls + '" data-id="' + e.id + '" title="' + esc(e.title + ' — ' + e.status) + '">' + inner + '</button>';
  }

  function renderMonth(list) {
    var c = state.cursor;
    var first = new Date(c.getFullYear(), c.getMonth(), 1);
    var offset = (first.getDay() + 6) % 7; // Monday first
    var gridStart = addDays(first, -offset);
    var today = new Date();

    var html = '<div class="cal-weekdays">' + DAYS_SHORT.map(function (d) { return '<div>' + d + '</div>'; }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < 42; i++) {
      var day = addDays(gridStart, i);
      var evs = eventsOnDay(list, day);
      var cls = 'cal-cell' + (day.getMonth() !== c.getMonth() ? ' muted' : '') + (sameDay(day, today) ? ' today' : '');
      html += '<div class="' + cls + '"><button class="cal-daynum" data-goday="' + ymd(day) + '">' + day.getDate() + '</button>';
      evs.slice(0, 3).forEach(function (e) { html += chip(e, evs, false); });
      if (evs.length > 3) html += '<button class="cal-more" data-goday="' + ymd(day) + '">+' + (evs.length - 3) + ' more</button>';
      html += '</div>';
    }
    return html + '</div>';
  }

  function weekStart(d) { return addDays(startOfDay(d), -((d.getDay() + 6) % 7)); }

  function renderWeek(list) {
    var ws = weekStart(state.cursor);
    var today = new Date();
    var html = '<div class="cal-week">';
    for (var i = 0; i < 7; i++) {
      var day = addDays(ws, i);
      var evs = eventsOnDay(list, day);
      html += '<div class="wk-col' + (sameDay(day, today) ? ' today' : '') + '">' +
        '<div class="wk-head">' + DAYS_SHORT[i] + '<b>' + day.getDate() + '</b></div>';
      if (!evs.length) html += '<div class="wk-empty">No events</div>';
      evs.forEach(function (e) { html += chip(e, evs, true); });
      html += '</div>';
    }
    return html + '</div>';
  }

  function renderDay(list) {
    var day = startOfDay(state.cursor);
    var dayEnd = addDays(day, 1);
    var evs = eventsOnDay(list, day);
    var allDayEvents = evs.filter(function (event) { return event.allDay; });
    var timedEvents = evs.filter(function (event) { return !event.allDay; });
    var html = '';
    if (!evs.length) html += '<div class="day-note">No events scheduled for this day.</div>';
    else {
      var clashes = timedEvents.filter(function (e) { return hasOverlap(e, timedEvents); }).length;
      html += '<div class="day-note">' + evs.length + ' event' + (evs.length > 1 ? 's' : '') +
        (clashes ? ' · ⚠ ' + clashes + ' overlapping' : '') + '</div>';
    }
    if (allDayEvents.length) {
      html += '<div class="day-all-day"><span class="day-all-day-label">All day</span>';
      allDayEvents.forEach(function (event) { html += chip(event, allDayEvents, true); });
      html += '</div>';
    }

    html += '<div class="timeline" style="height:' + ((HOUR_END - HOUR_START) * HOUR_H) + 'px">';
    for (var h = HOUR_START; h <= HOUR_END; h++) {
      var label = (h % 12 || 12) + ' ' + (h >= 12 ? 'PM' : 'AM');
      html += '<div class="tl-hour" style="top:' + ((h - HOUR_START) * HOUR_H) + 'px"><span>' + label + '</span></div>';
    }

    // Assign lanes so overlapping events sit side by side
    var laneEnds = [], placed = [];
    timedEvents.forEach(function (e) {
      var s = toDate(e.start), lane = -1;
      for (var i = 0; i < laneEnds.length; i++) { if (laneEnds[i] <= s) { lane = i; break; } }
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(null); }
      laneEnds[lane] = toDate(e.end);
      placed.push({ e: e, lane: lane });
    });
    var lanes = Math.max(1, laneEnds.length);

    html += '<div class="tl-events">';
    placed.forEach(function (p) {
      var segS = new Date(Math.max(toDate(p.e.start), day));
      var segE = new Date(Math.min(toDate(p.e.end), dayEnd));
      var top = ((segS - day) / 3600000 - HOUR_START) * HOUR_H;
      var height = (segE - segS) / 3600000 * HOUR_H;
      if (top < 0) { height += top; top = 0; }
      height = Math.max(height, 30);
      html += '<div class="tl-event" style="top:' + top + 'px;height:' + height + 'px;left:' + (p.lane / lanes * 100) +
        '%;width:' + (100 / lanes) + '%">' + chip(p.e, evs, true) + '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function calTitle() {
    var c = state.cursor;
    if (state.mode === 'month') return c.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (state.mode === 'week') {
      var ws = weekStart(c), we = addDays(ws, 6);
      var o = { month: 'short', day: 'numeric' };
      return ws.toLocaleDateString('en-US', o) + ' – ' + we.toLocaleDateString('en-US', o) + ', ' + we.getFullYear();
    }
    return c.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  /* =====================================================
     List + proposals rendering
  ===================================================== */
  function emptyBox(icon, text) {
    return '<div class="empty-box"><div class="big">' + icon + '</div>' + esc(text) + '</div>';
  }

  function renderList(list) {
    if (!list.length) {
      return emptyBox('🗓️', publicEvents().length
        ? 'No events match your search or filters.'
        : 'No university events are available yet. Upload a calendar PDF above to get started.');
    }
    return list.map(function (e) {
      return '<div class="ev-row" data-id="' + e.id + '">' + dateBlock(e) +
        '<div class="ev-info"><div class="ev-title' + (e.status === 'Cancelled' ? ' row-title-cancelled' : '') + '">' + esc(e.title) + '</div>' +
        '<div class="ev-meta">' + esc(e.dept) + ' · ' + esc(e.type) + ' · ' + esc(timeRange(e)) + ' · ' + esc(e.venue) + '</div></div>' +
        '<div class="ev-badges"><span class="badge ' + STATUS_BADGE[e.status] + '">' + esc(e.status) + '</span>' +
        '<span class="tag tag-mint">' + esc(e.audience) + '</span></div></div>';
    }).join('');
  }

  function lastNote(e) {
    if ((e.status === 'Changes Requested' || e.status === 'Rejected') && e.history.length) {
      return e.history[e.history.length - 1].text;
    }
    return '';
  }

  function renderProposals(list) {
    if (!list.length) return emptyBox('📝', 'You have no proposals yet. Click "Propose an Event" to start.');
    return list.map(function (e) {
      var note = lastNote(e);
      var actions = '<button class="btn btn-outline btn-sm-x" data-pact="view" data-id="' + e.id + '">View</button>';
      if (e.status === 'Draft' || e.status === 'Changes Requested') {
        actions += '<button class="btn btn-outline btn-sm-x" data-pact="edit" data-id="' + e.id + '">Edit</button>';
        actions += '<button class="btn btn-primary btn-sm-x" data-pact="submit" data-id="' + e.id + '">Submit</button>';
      }
      if (e.status === 'Draft') {
        actions += '<button class="btn btn-danger btn-sm-x" data-pact="delete" data-id="' + e.id + '">Delete</button>';
      }
      return '<div class="ev-row" data-id="' + e.id + '">' + dateBlock(e) +
        '<div class="ev-info"><div class="ev-title">' + esc(e.title) + '</div>' +
        '<div class="ev-meta">' + esc(e.type) + ' · ' + esc(timeRange(e)) + ' · ' + esc(e.venue) + '</div>' +
        (note ? '<div class="ev-note">' + esc(note) + '</div>' : '') +
        '<div class="ev-actions">' + actions + '</div></div>' +
        '<div class="ev-badges"><span class="badge ' + STATUS_BADGE[e.status] + '">' + esc(e.status) + '</span>' +
        (e.bookingStatus !== 'Not requested' ? '<span class="badge badge-time">Room: ' + esc(e.bookingStatus) + '</span>' : '') +
        '</div></div>';
    }).join('');
  }

  /* =====================================================
     Main render
  ===================================================== */
  function renderMain() {
    document.querySelectorAll('#viewTabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.view === state.view);
    });
    document.querySelectorAll('#calModes button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === state.mode);
    });
    $('calControls').style.display = state.view === 'calendar' ? '' : 'none';

    var body = $('eventsBody');
    var list = visibleFor(state.view);

    if (state.view === 'calendar') {
      $('calTitle').textContent = calTitle();
      if (!list.length && !publicEvents().length) {
        body.innerHTML = emptyBox('📄', 'No university events are available yet. Upload a calendar PDF above to get started.');
      } else if (state.mode === 'month') body.innerHTML = renderMonth(list);
      else if (state.mode === 'week') body.innerHTML = renderWeek(list);
      else body.innerHTML = renderDay(list);
    } else if (state.view === 'list') {
      body.innerHTML = renderList(list);
    } else {
      body.innerHTML = renderProposals(list);
    }
  }

  function renderAll() {
    updateStats();
    renderAttention();
    renderMain();
    renderUpcoming();
  }

  /* =====================================================
     University calendar PDF
  ===================================================== */
  function setCalendarStatus(message, status) {
    var statusElement = $('calendarSourceStatus');
    statusElement.textContent = message;
    statusElement.className = 'calendar-source-status' + (status ? ' ' + status : '');
  }

  function updateCalendarControls() {
    var file = $('calendarPdfInput').files && $('calendarPdfInput').files[0];
    $('calendarSelectedFilename').textContent = file ? file.name : 'No PDF selected';
    $('uploadCalendarBtn').textContent = savedCalendar ? 'Replace calendar' : 'Upload calendar';
    $('uploadCalendarBtn').disabled = calendarLoading || calendarUploadInProgress || !file;
    $('deleteCalendarBtn').hidden = !savedCalendar;
    $('deleteCalendarBtn').disabled = calendarLoading || calendarUploadInProgress || !savedCalendar;
    $('calendarPdfInput').disabled = calendarLoading || calendarUploadInProgress;
  }

  function showSavedCalendar(calendar) {
    savedCalendar = calendar || null;
    data.events = data.events.filter(function (event) { return !event.calendarImport; });

    if (savedCalendar && Array.isArray(savedCalendar.events)) {
      savedCalendar.events.forEach(function (item) {
        if (!item || typeof item.title !== 'string' || typeof item.startDate !== 'string') return;
        var allDay = !item.startTime || !item.endTime;
        var endDate = item.endDate || item.startDate;
        var start = item.startDate + 'T' + (allDay ? '00:00:00' : item.startTime + ':00');
        var end = (allDay ? ymd(addDays(parseYmd(endDate), 1)) : endDate) +
          'T' + (allDay ? '00:00:00' : item.endTime + ':00');
        data.events.push(ev({
          id: nextId(),
          title: item.title,
          type: item.type || 'Other',
          dept: item.department || 'University-wide',
          start: start,
          end: end,
          allDay: allDay,
          venue: item.venue || 'Not specified',
          attendance: '',
          audience: item.audience || 'University-wide',
          status: toDate(end) < new Date() ? 'Completed' : 'Approved',
          bookingStatus: 'Not requested',
          description: item.description || 'Imported from the university calendar.',
          organizer: 'University calendar',
          ownerId: 'university-calendar',
          calendarImport: true
        }));
      });

      var uploadedAt = new Date(savedCalendar.uploadedAt);
      var uploadedText = Number.isNaN(uploadedAt.getTime()) ? '' : ' · Uploaded ' + uploadedAt.toLocaleDateString();
      $('calendarSourceSummary').textContent = savedCalendar.filename + ' · ' +
        savedCalendar.events.length + ' extracted entries' + uploadedText;
      setCalendarStatus('Saved on this workspace. The university calendar events are shown below.', 'success');
    } else {
      $('calendarSourceSummary').textContent = 'Upload your university calendar. Gemini will extract dated events and save them for future visits.';
      setCalendarStatus('No university calendar is saved yet. Upload a PDF to populate the events calendar.', '');
    }

    saveData();
    updateCalendarControls();
    renderAll();
  }

  async function loadSavedCalendar() {
    try {
      // CampusSyncAPI.request already parses and returns the JSON body directly.
      var result = await window.CampusSyncAPI.request('/university-calendar');
      showSavedCalendar(result && result.calendar ? result.calendar : null);
    } catch (error) {
      console.error('Could not load the saved university calendar:', error);
      setCalendarStatus(error.message || 'Could not connect to the calendar service. Start the CampusSync server and reload.', 'error');
      updateCalendarControls();
    }
  }

  $('calendarPdfInput').addEventListener('change', function () {
    var file = $('calendarPdfInput').files && $('calendarPdfInput').files[0];
    updateCalendarControls();
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) {
      setCalendarStatus('Choose a valid PDF file.', 'error');
      $('calendarPdfInput').value = '';
      updateCalendarControls();
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setCalendarStatus('The PDF is larger than 15 MB. Choose a smaller calendar file.', 'error');
      $('calendarPdfInput').value = '';
      updateCalendarControls();
      return;
    }
    setCalendarStatus(savedCalendar
      ? 'The current saved calendar will stay available unless the replacement is processed successfully.'
      : 'Ready to extract dated events from this PDF.', '');
  });

  $('uploadCalendarBtn').addEventListener('click', async function () {
    var file = $('calendarPdfInput').files && $('calendarPdfInput').files[0];
    if (!file || calendarUploadInProgress) return;
    calendarUploadInProgress = true;
    updateCalendarControls();
    setCalendarStatus('Uploading PDF and extracting calendar entries with Gemini…', '');

    try {
      // CampusSyncAPI.request already parses and returns the JSON body directly.
      var result = await window.CampusSyncAPI.request('/university-calendar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'X-Calendar-Filename': encodeURIComponent(file.name)
        },
        body: file
      });
      if (!result || !result.calendar || !Array.isArray(result.calendar.events) || !result.calendar.events.length) {
        throw new Error('The calendar service returned no extracted events. Make sure the PDF contains readable calendar dates.');
      }

      $('calendarPdfInput').value = '';
      showSavedCalendar(result.calendar);
      toast('University calendar saved and events imported.');
    } catch (error) {
      console.error('Could not upload the university calendar:', error);
      setCalendarStatus(error.message || 'Could not process the PDF. The existing calendar has not been changed.', 'error');
    } finally {
      calendarUploadInProgress = false;
      updateCalendarControls();
    }
  });

  $('deleteCalendarBtn').addEventListener('click', async function () {
    if (!savedCalendar || calendarUploadInProgress) return;
    if (!window.confirm('Delete the saved university calendar PDF and remove its imported events?')) return;
    calendarUploadInProgress = true;
    updateCalendarControls();
    setCalendarStatus('Deleting the saved calendar…', '');

    try {
      // CampusSyncAPI.request already parses and returns the JSON body directly.
      var result = await window.CampusSyncAPI.request('/university-calendar', { method: 'DELETE' });
      $('calendarPdfInput').value = '';
      showSavedCalendar(result ? result.calendar : null);
      toast('University calendar deleted.');
    } catch (error) {
      console.error('Could not delete the university calendar:', error);
      setCalendarStatus(error.message || 'Could not delete the saved calendar.', 'error');
    } finally {
      calendarUploadInProgress = false;
      updateCalendarControls();
    }
  });

  /* =====================================================
     Events: toolbar, filters, calendar nav
  ===================================================== */
  document.querySelectorAll('#viewTabs button').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.dataset.view; renderMain(); });
  });
  document.querySelectorAll('#calModes button').forEach(function (b) {
    b.addEventListener('click', function () { state.mode = b.dataset.mode; renderMain(); });
  });

  function shiftCursor(dir) {
    var c = state.cursor;
    if (state.mode === 'month') state.cursor = new Date(c.getFullYear(), c.getMonth() + dir, 1);
    else if (state.mode === 'week') state.cursor = addDays(c, 7 * dir);
    else state.cursor = addDays(c, dir);
    renderMain();
  }
  $('calPrev').addEventListener('click', function () { shiftCursor(-1); });
  $('calNext').addEventListener('click', function () { shiftCursor(1); });
  $('calToday').addEventListener('click', function () { state.cursor = new Date(); renderMain(); });

  $('eventsSearchInput').addEventListener('input', function (e) {
    state.search = e.target.value.trim().toLowerCase();
    renderMain();
  });

  [['fDept', 'dept'], ['fType', 'type'], ['fAudience', 'audience'], ['fStatus', 'status']].forEach(function (pair) {
    $(pair[0]).addEventListener('change', function (e) { state.filters[pair[1]] = e.target.value; renderMain(); });
  });

  $('showPending').addEventListener('change', function (e) { state.showPending = e.target.checked; renderMain(); });

  $('clearFiltersBtn').addEventListener('click', function () {
    state.filters = { dept: 'all', type: 'all', audience: 'all', status: 'all' };
    state.search = '';
    $('eventsSearchInput').value = '';
    ['fDept', 'fType', 'fAudience', 'fStatus'].forEach(function (id) { $(id).value = 'all'; });
    renderMain();
  });

  document.querySelectorAll('.stats-grid-events .stat-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var s = card.dataset.stat;
      if (s === 'upcoming') { state.view = 'list'; state.filters.status = 'all'; $('fStatus').value = 'all'; }
      else if (s === 'proposals') { state.view = 'proposals'; }
      else if (s === 'month') { state.view = 'calendar'; state.mode = 'month'; state.cursor = new Date(); }
      else if (s === 'attention') {
        if (!data.attention.length) { toast('Nothing needs your attention right now.'); return; }
        $('attentionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      renderMain();
    });
  });

  $('notifBell').addEventListener('click', function () {
    if (data.attention.length) $('attentionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    else toast('No new updates.');
  });

  // Delegated clicks inside the main body
  $('eventsBody').addEventListener('click', function (e) {
    var pact = e.target.closest('[data-pact]');
    if (pact) { e.stopPropagation(); handleProposalAction(pact.dataset.pact, parseInt(pact.dataset.id, 10)); return; }
    var go = e.target.closest('[data-goday]');
    if (go) { state.cursor = parseYmd(go.dataset.goday); state.mode = 'day'; renderMain(); return; }
    var item = e.target.closest('[data-id]');
    if (item) openDetails(parseInt(item.dataset.id, 10));
  });

  $('upcomingList').addEventListener('click', function (e) {
    var item = e.target.closest('[data-id]');
    if (item) openDetails(parseInt(item.dataset.id, 10));
  });

  $('attentionPanel').addEventListener('click', function (e) {
    var v = e.target.closest('[data-att-view]');
    var d = e.target.closest('[data-att-dismiss]');
    if (v) openDetails(parseInt(v.dataset.attView, 10));
    if (d) {
      var id = parseInt(d.dataset.attDismiss, 10);
      data.attention = data.attention.filter(function (a) { return a.id !== id; });
      saveData(); renderAll();
    }
  });

  /* =====================================================
     Export / .ics
  ===================================================== */
  function icsEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  }
  function icsDate(s) { return s.replace(/[-:]/g, '') + '00'; }
  function buildIcs(list) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusSync//Events//EN', 'CALSCALE:GREGORIAN'];
    list.forEach(function (e) {
      lines.push('BEGIN:VEVENT');
      lines.push('UID:event-' + e.id + '@campussync');
      lines.push('DTSTAMP:' + stamp);
      if (e.allDay) {
        lines.push('DTSTART;VALUE=DATE:' + ymd(toDate(e.start)).replace(/-/g, ''));
        lines.push('DTEND;VALUE=DATE:' + ymd(toDate(e.end)).replace(/-/g, ''));
      } else {
        lines.push('DTSTART:' + icsDate(e.start));
        lines.push('DTEND:' + icsDate(e.end));
      }
      lines.push('SUMMARY:' + icsEscape(e.title));
      lines.push('LOCATION:' + icsEscape(e.venue));
      lines.push('DESCRIPTION:' + icsEscape(e.description + (e.dept ? '\nOrganised by ' + e.dept : '')));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  $('exportBtn').addEventListener('click', function () {
    var list = publicEvents().filter(function (e) { return e.status !== 'Cancelled' && passesFilters(e); });
    if (!list.length) { toast('No events to export with the current filters.'); return; }
    download('campussync-events.ics', buildIcs(list));
    toast('Calendar exported (' + list.length + ' events).');
  });

  /* =====================================================
     Modals (generic)
  ===================================================== */
  var proposalModal = $('proposalModal');
  var detailsModal = $('detailsModal');

  function closeProposal() { proposalModal.classList.remove('show'); state.editingId = null; }
  function closeDetails() { detailsModal.classList.remove('show'); state.detailsId = null; }

  $('closeProposalBtn').addEventListener('click', closeProposal);
  $('closeDetailsBtn').addEventListener('click', closeDetails);
  proposalModal.addEventListener('click', function (e) { if (e.target === proposalModal) closeProposal(); });
  detailsModal.addEventListener('click', function (e) { if (e.target === detailsModal) closeDetails(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (proposalModal.classList.contains('show')) closeProposal();
    else if (detailsModal.classList.contains('show')) closeDetails();
  });

  /* =====================================================
     Availability + validation
  ===================================================== */
  function isVenueFree(name, s, e, excludeId) {
    return !data.events.some(function (o) {
      return o.id !== excludeId && o.venue === name && LIVE_STATUSES.indexOf(o.status) !== -1 &&
        overlaps(s, e, toDate(o.start), toDate(o.end));
    });
  }

  function checkAvailability(f, excludeId) {
    var res = { errors: [], warnings: [], venues: [], slots: [], ready: false };
    if (!f.venue || !f.start || !f.end) return res;
    var s = toDate(f.start), e = toDate(f.end);
    if (isNaN(s) || isNaN(e) || e <= s) return res;
    res.ready = true;

    var v = venueByName(f.venue);
    var att = parseInt(f.attendance, 10);
    var capacityBad = false;
    if (v && v.cap != null && att > v.cap) {
      capacityBad = true;
      res.errors.push(f.venue + ' holds ' + v.cap + ' people, but ' + att + ' are expected.');
    }
    if (v && v.cap == null) res.warnings.push('Capacity is not listed for this venue; confirm it before submitting.');
    if (v && v.verification.indexOf('Proposed placeholder') !== -1) {
      res.warnings.push('This venue is a proposed placeholder and has not been confirmed.');
    }

    var conflicts = data.events.filter(function (o) {
      return o.id !== excludeId && o.venue === f.venue && LIVE_STATUSES.indexOf(o.status) !== -1 &&
        overlaps(s, e, toDate(o.start), toDate(o.end));
    });
    conflicts.forEach(function (o) {
      res.errors.push(f.venue + ' is already booked for "' + o.title + '" (' + fmtTime(toDate(o.start)) + ' – ' + fmtTime(toDate(o.end)) + ').');
    });

    data.events.filter(function (o) {
      return o.id !== excludeId && o.venue === f.venue && o.status === 'Pending Approval' &&
        overlaps(s, e, toDate(o.start), toDate(o.end));
    }).forEach(function (o) {
      res.warnings.push('Another proposal ("' + o.title + '") is pending for this venue and time.');
    });

    if (res.errors.length) {
      VENUES.forEach(function (x) {
        if (x.name !== f.venue && isVenueFree(x.name, s, e, excludeId)) res.venues.push(x);
      });
      res.venues = res.venues.slice(0, 3);

      var dur = e - s;
      if (conflicts.length && dur <= 12 * 3600000 && !capacityBad) {
        var day = startOfDay(s), now = new Date(), cands = [];
        for (var m = 8 * 60; m <= 20 * 60; m += 30) {
          var cs = new Date(day.getTime() + m * 60000);
          var ce = new Date(cs.getTime() + dur);
          if (cs <= now || ce > new Date(day.getTime() + 22 * 3600000)) continue;
          if (isVenueFree(f.venue, cs, ce, excludeId)) cands.push(cs);
        }
        cands.sort(function (a, b) { return Math.abs(a - s) - Math.abs(b - s); });
        res.slots = cands.slice(0, 3);
      }
    }
    return res;
  }

  function renderAvailability(res) {
    var box = $('availabilityBox');
    if (!res.ready) { box.className = 'availability-box'; box.innerHTML = ''; return; }
    var html = '', cls = 'ok';
    if (res.errors.length) {
      cls = 'bad';
      html += '<b>❌ Venue not available</b><ul style="margin:6px 0 0 18px;">' +
        res.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    } else {
      var v = venueByName($('pVenue').value);
      html += '✅ No conflicting CampusSync event is recorded for this venue and time.' +
        (v && v.cap == null ? ' Capacity is not listed.' : '');
    }
    if (res.warnings.length) {
      if (cls === 'ok') cls = 'warn';
      html += '<div style="margin-top:6px;">⚠ ' + res.warnings.map(esc).join('<br>⚠ ') + '</div>';
    }
    if (res.venues.length) {
      html += '<div class="sg-title">Try another room:</div>' + res.venues.map(function (x) {
        return '<button type="button" class="suggest-btn" data-sg-venue="' + esc(x.name) + '">' + esc(x.name) + ' — ' + esc(x.building) + '</button>';
      }).join('');
    }
    if (res.slots.length) {
      html += '<div class="sg-title">Or another time on the same day:</div>' + res.slots.map(function (d) {
        return '<button type="button" class="suggest-btn" data-sg-slot="' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '">' + fmtTime(d) + '</button>';
      }).join('');
    }
    box.className = 'availability-box show ' + cls;
    box.innerHTML = html;
  }

  function readForm() {
    var sd = $('pStartDate').value, st = $('pStartTime').value;
    var ed = $('pEndDate').value, et = $('pEndTime').value;
    var file = $('pAttachment').files && $('pAttachment').files[0];
    return {
      title: $('pTitle').value.trim(),
      type: $('pType').value,
      dept: $('pDept').value,
      start: sd && st ? sd + 'T' + st : '',
      end: ed && et ? ed + 'T' + et : '',
      sd: sd, st: st, ed: ed, et: et,
      venue: $('pVenue').value,
      attendance: $('pAttendance').value,
      description: $('pDescription').value.trim(),
      audience: $('pAudience').value,
      requirements: $('pRequirements').value.trim(),
      registrationEnabled: $('pRegistration').checked,
      attachment: file ? file.name : ''
    };
  }

  function refreshAvailability() {
    renderAvailability(checkAvailability(readForm(), state.editingId));
  }
  ['pVenue', 'pStartDate', 'pStartTime', 'pEndDate', 'pEndTime', 'pAttendance'].forEach(function (id) {
    $(id).addEventListener('change', refreshAvailability);
    $(id).addEventListener('input', refreshAvailability);
  });
  // Keep end date in step with start date when it is empty
  $('pStartDate').addEventListener('change', function () {
    if (!$('pEndDate').value) { $('pEndDate').value = $('pStartDate').value; refreshAvailability(); }
  });

  $('availabilityBox').addEventListener('click', function (e) {
    var vb = e.target.closest('[data-sg-venue]');
    var sb = e.target.closest('[data-sg-slot]');
    if (vb) { $('pVenue').value = vb.dataset.sgVenue; }
    if (sb) {
      var f = readForm();
      var dur = toDate(f.end) - toDate(f.start);
      var newStart = new Date(f.sd + 'T' + sb.dataset.sgSlot);
      var newEnd = new Date(newStart.getTime() + dur);
      $('pStartDate').value = ymd(newStart);
      $('pStartTime').value = sb.dataset.sgSlot;
      $('pEndDate').value = ymd(newEnd);
      $('pEndTime').value = pad(newEnd.getHours()) + ':' + pad(newEnd.getMinutes());
    }
    refreshAvailability();
  });

  function validateForm(f, mode) {
    var errs = [];
    if (!f.title) errs.push('Event name is required.');
    if (mode === 'draft') return errs;

    if (!f.type) errs.push('Select an event type.');
    if (!f.dept) errs.push('Select the organizing department.');
    if (!f.start) errs.push('Start date and time are required.');
    if (!f.end) errs.push('End date and time are required.');
    if (f.start && f.end) {
      var s = toDate(f.start), e = toDate(f.end);
      if (e <= s) errs.push('End must be after the start.');
      else if (s <= new Date()) errs.push('Start must be in the future.');
    }
    if (!f.venue) errs.push('Select a venue.');
    var att = parseInt(f.attendance, 10);
    if (!f.attendance || isNaN(att) || att < 1) errs.push('Expected attendance must be a number greater than 0.');
    if (f.description.length < 10) errs.push('Add a description (at least 10 characters).');
    if (!f.audience) errs.push('Select the target audience.');

    if (!errs.length) {
      var res = checkAvailability(f, state.editingId);
      errs = errs.concat(res.errors);
      renderAvailability(res);
    }
    return errs;
  }

  function showFormErrors(errs) {
    var box = $('formErrors');
    if (!errs.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = 'Please fix the following:<ul>' + errs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    box.style.display = '';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* =====================================================
     Proposal form
  ===================================================== */
  function splitDT(s) { return s ? [s.slice(0, 10), s.slice(11, 16)] : ['', '']; }

  function openProposal(e) {
    state.editingId = e ? e.id : null;
    showFormErrors([]);
    var published = e && LIVE_STATUSES.indexOf(e.status) !== -1;

    $('proposalHeading').textContent = e ? (published ? 'Edit Event' : 'Edit Proposal') : 'Propose an Event';
    $('saveDraftBtn').style.display = published ? 'none' : '';
    $('submitProposalBtn').textContent = published ? 'Save Changes' : 'Submit Proposal';

    var s = splitDT(e && e.start), en = splitDT(e && e.end);
    $('pTitle').value = e ? e.title : '';
    $('pType').value = e ? e.type : '';
    $('pDept').value = e ? e.dept : (DEPARTMENTS.indexOf(user.dept) !== -1 ? user.dept : '');
    $('pStartDate').value = s[0]; $('pStartTime').value = s[1];
    $('pEndDate').value = en[0]; $('pEndTime').value = en[1];
    $('pVenue').value = e ? e.venue : '';
    $('pAttendance').value = e ? e.attendance : '';
    $('pDescription').value = e ? e.description : '';
    $('pAudience').value = e ? e.audience : '';
    $('pRequirements').value = e ? e.requirements : '';
    $('pRegistration').checked = e ? !!e.registrationEnabled : false;
    $('pAttachment').value = '';

    refreshAvailability();
    proposalModal.classList.add('show');
  }

  $('proposeEventBtn').addEventListener('click', function () { openProposal(null); });

  function applyForm(target, f) {
    target.title = f.title; target.type = f.type; target.dept = f.dept;
    target.start = f.start; target.end = f.end; target.venue = f.venue;
    target.attendance = parseInt(f.attendance, 10) || 0;
    target.description = f.description; target.audience = f.audience;
    target.requirements = f.requirements;
    target.registrationEnabled = f.registrationEnabled;
    if (f.attachment) target.attachment = f.attachment;
  }

  $('saveDraftBtn').addEventListener('click', function () {
    var f = readForm();
    var errs = validateForm(f, 'draft');
    if (errs.length) { showFormErrors(errs); return; }

    var existing = state.editingId ? findEvent(state.editingId) : null;
    if (existing) {
      applyForm(existing, f);
      if (existing.status !== 'Changes Requested') existing.status = 'Draft';
      addHistory(existing, 'Draft saved.');
    } else {
      var e = ev({ id: nextId(), ownerId: 'me', organizer: user.name, status: 'Draft' });
      applyForm(e, f);
      addHistory(e, 'Draft created.');
      data.events.push(e);
    }
    saveData(); closeProposal(); renderAll();
    state.view = 'proposals'; renderMain();
    toast('Draft saved.');
  });

  $('submitProposalBtn').addEventListener('click', function () {
    var f = readForm();
    var errs = validateForm(f, 'submit');
    if (errs.length) { showFormErrors(errs); return; }

    var existing = state.editingId ? findEvent(state.editingId) : null;

    if (existing && LIVE_STATUSES.indexOf(existing.status) !== -1) {
      // Editing an already approved/confirmed event
      var changed = existing.start !== f.start || existing.end !== f.end || existing.venue !== f.venue;
      applyForm(existing, f);
      if (changed) {
        existing.status = 'Approved';
        existing.bookingStatus = 'Pending';
        addHistory(existing, 'Rescheduled / venue changed. Room booking must be confirmed again.');
        if (existing.registered || existing.acknowledged) addAttention(existing, 'Details changed for "' + existing.title + '"');
      } else {
        addHistory(existing, 'Event details updated.');
      }
      saveData(); closeProposal(); renderAll();
      if (state.detailsId === existing.id) renderDetails(existing);
      toast('Event updated.');
      return;
    }

    if (existing) {
      applyForm(existing, f);
      existing.status = 'Pending Approval';
      existing.bookingStatus = 'Not requested';
      addHistory(existing, 'Proposal resubmitted for approval.');
      data.attention = data.attention.filter(function (a) { return a.eventId !== existing.id; });
    } else {
      var e = ev({ id: nextId(), ownerId: 'me', organizer: user.name, status: 'Pending Approval' });
      applyForm(e, f);
      addHistory(e, 'Proposal submitted for approval.');
      data.events.push(e);
    }
    saveData(); closeProposal();
    state.view = 'proposals';
    renderAll();
    toast('Proposal submitted. The approver has been notified.');
  });

  /* =====================================================
     Proposal row actions
  ===================================================== */
  function handleProposalAction(act, id) {
    var e = findEvent(id);
    if (!e) return;
    if (act === 'view') openDetails(id);
    else if (act === 'edit') openProposal(e);
    else if (act === 'delete') deleteDraft(e);
    else if (act === 'submit') {
      var f = {
        title: e.title, type: e.type, dept: e.dept, start: e.start, end: e.end, venue: e.venue,
        attendance: e.attendance, description: e.description, audience: e.audience
      };
      state.editingId = e.id;
      var errs = validateForm(f, 'submit');
      state.editingId = null;
      if (errs.length) {
        openProposal(e);
        showFormErrors(errs);
        toast('Complete the form before submitting.');
        return;
      }
      e.status = 'Pending Approval';
      e.bookingStatus = 'Not requested';
      addHistory(e, 'Proposal submitted for approval.');
      data.attention = data.attention.filter(function (a) { return a.eventId !== e.id; });
      saveData(); renderAll();
      toast('Proposal submitted. The approver has been notified.');
    }
  }

  function deleteDraft(e) {
    if (e.status !== 'Draft') return;
    if (!confirm('Delete draft "' + e.title + '"?')) return;
    data.events = data.events.filter(function (x) { return x.id !== e.id; });
    data.attention = data.attention.filter(function (a) { return a.eventId !== e.id; });
    saveData(); closeDetails(); renderAll();
    toast('Draft deleted.');
  }

  /* =====================================================
     Event details
  ===================================================== */
  function bookingLabel(e) {
    if (e.calendarImport) return 'From university calendar · venue not reserved';
    if (e.bookingStatus === 'Confirmed') return '✅ Room booking confirmed';
    if (e.bookingStatus === 'Pending') return '⏳ Room booking pending — venue not reserved yet';
    return 'Room booking not requested yet';
  }

  function detailItem(label, value, wide) {
    return '<div class="detail-item' + (wide ? ' wide' : '') + '"><small>' + esc(label) + '</small><span>' + esc(value || '—') + '</span></div>';
  }

  function openDetails(id) {
    var e = findEvent(id);
    if (!e) return;
    state.detailsId = id;
    renderDetails(e);
    detailsModal.classList.add('show');
  }

  function renderDetails(e) {
    $('detailTitle').textContent = e.title;

    var body = '<div class="detail-badges">' +
      '<span class="badge ' + STATUS_BADGE[e.status] + '">' + esc(e.status) + '</span>' +
      '<span class="tag tag-mint">' + esc(e.type) + '</span>' +
      '<span class="badge badge-time">' + esc(bookingLabel(e)) + '</span></div>';

    body += '<div class="detail-desc">' + esc(e.description || 'No description provided.') + '</div>';

    body += '<div class="detail-grid">' +
      detailItem('Date & time', timeRange(e), true) +
      detailItem('Venue', e.venue + (venueByName(e.venue)
        ? ' — ' + venueByName(e.venue).building + (venueByName(e.venue).cap == null ? ' (capacity not listed)' : ' (capacity ' + venueByName(e.venue).cap + ')')
        : '')) +
      detailItem('Organizing department', e.dept) +
      detailItem('Organizer / contact', (e.organizer || '—') + (e.contact ? ' · ' + e.contact : '')) +
      detailItem('Target audience', e.audience) +
      detailItem('Expected attendance', e.attendance) +
      detailItem('Registration', e.registrationEnabled ? 'Enabled (' + e.registrations + ' registered' + (e.registered ? ', including you' : '') + ')' : 'Not required') +
      detailItem('Attachments / agenda', e.attachment || 'None') +
      detailItem('Additional requirements', e.requirements || 'None', true) +
      detailItem('Related announcement', e.hasAnnouncement ? 'Available' : 'None') +
      '</div>';

    if (e.history && e.history.length) {
      body += '<div><div class="detail-item"><small>History</small></div><ul class="history-list">' +
        e.history.slice().reverse().map(function (h) {
          return '<li>' + esc(h.text) + '<small>' + esc(new Date(h.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</small></li>';
        }).join('') + '</ul></div>';
    }
    $('detailsBody').innerHTML = body;

    // ---- Footer actions (depend on role and event state)
    var now = new Date();
    var upcoming = toDate(e.end) >= now;
    var live = LIVE_STATUSES.indexOf(e.status) !== -1;
    var acts = '<div class="action-row">';

    if (live || e.status === 'Completed') acts += '<button class="btn btn-outline" data-dact="ics">📅 Add to My Calendar</button>';
    if (e.hasAnnouncement) acts += '<button class="btn btn-outline" data-dact="announcement">📢 View Announcement</button>';

    if (live && upcoming && !isMine(e) && !e.calendarImport) {
      if (e.type === 'Meeting') {
        acts += e.acknowledged
          ? '<button class="btn btn-outline" data-dact="unack">✓ Attendance acknowledged (undo)</button>'
          : '<button class="btn btn-primary" data-dact="ack">✓ Acknowledge Attendance</button>';
      } else if (e.registrationEnabled) {
        acts += e.registered
          ? '<button class="btn btn-outline" data-dact="unregister">Cancel Registration</button>'
          : '<button class="btn btn-primary" data-dact="register">Register / Express Interest</button>';
      }
    }

    acts += '<button class="btn btn-outline" data-dact="venue">📍 View Venue</button>';

    if (canManage(e) && ['Completed', 'Cancelled', 'Rejected'].indexOf(e.status) === -1) {
      acts += '<button class="btn btn-outline" data-dact="edit">✏️ Edit' + (e.status === 'Draft' || e.status === 'Changes Requested' ? ' Proposal' : ' Event') + '</button>';
    }
    if (canManage(e) && live && upcoming) acts += '<button class="btn btn-danger" data-dact="cancel">🚫 Cancel Event</button>';
    if (isMine(e) && e.status === 'Draft') acts += '<button class="btn btn-danger" data-dact="delete">🗑 Delete Draft</button>';
    acts += '</div>';

    $('detailsFooter').innerHTML = acts;
  }

  $('detailsFooter').addEventListener('click', function (evt) {
    var btn = evt.target.closest('[data-dact]');
    if (!btn) return;
    var e = findEvent(state.detailsId);
    if (!e) return;
    var act = btn.dataset.dact;

    if (act === 'ics') {
      download('event-' + e.id + '.ics', buildIcs([e]));
      toast('Added to your calendar file.');
    } else if (act === 'announcement') {
      window.location.href = '../announcement/announcements.html';
    } else if (act === 'venue') {
      window.location.href = '../rooms/room-booking.html';
    } else if (act === 'register') {
      e.registered = true; e.registrations += 1;
      addHistory(e, 'You registered for this event.');
      toast('You are registered.');
    } else if (act === 'unregister') {
      e.registered = false; e.registrations = Math.max(0, e.registrations - 1);
      addHistory(e, 'You cancelled your registration.');
      toast('Registration cancelled.');
    } else if (act === 'ack') {
      e.acknowledged = true;
      addHistory(e, 'You acknowledged attendance.');
      toast('Attendance acknowledged.');
    } else if (act === 'unack') {
      e.acknowledged = false;
      addHistory(e, 'You withdrew your attendance acknowledgement.');
      toast('Acknowledgement removed.');
    } else if (act === 'edit') {
      openProposal(e);
      return;
    } else if (act === 'delete') {
      deleteDraft(e);
      return;
    } else if (act === 'cancel') {
      var reason = prompt('Cancel "' + e.title + '"? Enter a reason (it will be sent to attendees):', '');
      if (reason === null) return;
      e.status = 'Cancelled';
      addHistory(e, 'Event cancelled' + (reason ? ': ' + reason : '.'));
      if (e.registered || e.acknowledged) addAttention(e, '"' + e.title + '" has been cancelled');
      toast('Event cancelled. Attendees will be notified.');
    }

    saveData();
    renderAll();
    var fresh = findEvent(e.id);
    if (fresh) renderDetails(fresh);
  });

  /* =====================================================
     Init
  ===================================================== */
  updateCalendarControls();
  renderAll();
  loadSavedCalendar().finally(function () {
    calendarLoading = false;
    updateCalendarControls();
  });
  if (pageParams.get('action') === 'propose') openProposal(null);
})();