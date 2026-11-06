(function () {
  'use strict';

  /* =====================================================
     Configuration (replace with backend / policy data later)
  ===================================================== */
  var STORE_KEY = 'campussync_rooms_v1';
  var EVENTS_KEY = 'campussync_events_v1';   // read-only: confirmed events block their venue
  var HOUR_START = 8, HOUR_END = 20;         // calendar rows: 8 AM - 8 PM
  var DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var ALLOW_STUDENT_REQUESTS = true;         // booking policy: set false to block students
  var APPROVER_ROLES = ['hod', 'dean', 'admin', 'administrator', 'facilities', 'room manager'];
  // Approval authority is configurable, not hard-coded in the workflow
  var APPROVAL_POLICY = {
    'Auditorium': 'Dean',
    'Seminar Hall': 'HOD / Department approver',
    'default': 'HOD / Department approver'
  };

  var DEPTS = window.CAMPUS_DEPARTMENTS.all;
  var PURPOSES = ['Meeting', 'Lecture', 'Workshop', 'Seminar', 'Examination', 'Other'];
  var TYPES = ['Classroom', 'Laboratory', 'Meeting Room', 'Seminar Hall', 'Auditorium', 'Facility'];
  var FACILITIES = [];
  var STATUS_FILTERS = ['All', 'Pending Approval', 'Confirmed', 'Changes Requested', 'Rejected', 'Completed', 'Cancelled', 'Draft'];

  var STATUS_BADGE = {
    'Draft': 'badge-time',
    'Pending Approval': 'badge-orange',
    'Changes Requested': 'badge-orange',
    'Confirmed': 'badge-mint',
    'Completed': 'badge-time',
    'Rejected': 'badge-red',
    'Cancelled': 'badge-red'
  };

  function roomType(facility) {
    if (/auditorium|theatre/i.test(facility)) return 'Auditorium';
    if (/seminar|lecture|event venue|workshop venue|conference hall/i.test(facility)) return 'Seminar Hall';
    if (/classroom|workshop/i.test(facility)) return 'Classroom';
    if (/laboratory|lab\b/i.test(facility)) return 'Laboratory';
    if (/meeting|conference|board room/i.test(facility)) return 'Meeting Room';
    return 'Facility';
  }
  var ROOMS = window.CAMPUS_ROOM_DIRECTORY.map(function (entry, index) {
    return {
      id: 1001 + index,
      code: entry.code,
      name: entry.code + ' — ' + entry.facility,
      facility: entry.facility,
      building: entry.building,
      floor: entry.floor,
      type: roomType(entry.facility),
      cap: null,
      fac: [],
      acc: null,
      status: 'Active',
      approval: false,
      verification: entry.verification
    };
  });
  var BUILDINGS = [];
  ROOMS.forEach(function (r) { if (BUILDINGS.indexOf(r.building) === -1) BUILDINGS.push(r.building); });

  /* =====================================================
     Helpers
  ===================================================== */
  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function localDT(d) { return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function toDate(s) { return new Date(s); }
  function sameDay(a, b) { return ymd(a) === ymd(b); }
  function overlaps(aS, aE, bS, bE) { return aS < bE && aE > bS; }
  function weekStart(d) { return addDays(startOfDay(d), -((d.getDay() + 6) % 7)); }
  function fmtTime(d) {
    var h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + pad(m) + ' ' + ap;
  }
  function fmtRange(s, e) { return fmtTime(s) + ' – ' + fmtTime(e); }
  function fmtDay(d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function fmtStamp(iso) {
    return iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  }
  function hourLabel(h) { return (h % 12 || 12) + (h >= 12 ? ' PM' : ' AM'); }
  function roomById(id) {
    for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i];
    return null;
  }
  function approverFor(room) { return APPROVAL_POLICY[room.type] || APPROVAL_POLICY['default']; }
  function emptyBox(icon, text) { return '<div class="empty-box"><div class="big">' + icon + '</div>' + esc(text) + '</div>'; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3000);
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
    role: String(roleData.category || 'student').toLowerCase(),
    designation: String(roleData.designation || '').toLowerCase()
  };
  function isApproverRole() {
    return APPROVER_ROLES.indexOf(user.role) !== -1 || /hod|head|dean|facilit/.test(user.designation);
  }

  /* =====================================================
     Data
  ===================================================== */
  function bk(o) {
    var b = {
      ref: '', ownerId: 'other', purpose: 'Meeting', title: '', roomId: 0, start: '', end: '',
      setup: 0, cleanup: 0, attendance: 0, dept: '', organizer: '', contact: '', facilities: [],
      relatedEvent: '', notes: '', status: 'Draft', submittedAt: '', cancellationRequested: false, history: []
    };
    for (var k in o) b[k] = o[k];
    return b;
  }
  function makeRef(id) { return 'RB-' + new Date().getFullYear() + '-' + ('000' + id).slice(-4); }

  function emptyData() {
    return { bookings: [], blocks: [], attention: [] };
  }

  var data;
  var cache = { ev: null, map: {} };
  function invalidate() { cache.ev = null; cache.map = {}; }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && Array.isArray(p.bookings)) {
          p.bookings = p.bookings.filter(function (booking) { return roomById(Number(booking.roomId)); });
          p.blocks = (p.blocks || []).filter(function (block) { return roomById(Number(block.roomId)); });
          var bookingIds = p.bookings.map(function (booking) { return booking.id; });
          p.attention = (p.attention || []).filter(function (item) { return bookingIds.indexOf(item.bookingId) !== -1; });
          return p;
        }
      }
    } catch (e) {}
    return emptyData();
  }
  function saveData() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
    window.CampusSyncAPI.saveWorkspace('rooms', data);
    invalidate();
  }
  function autoComplete() {
    var now = new Date();
    data.bookings.forEach(function (b) {
      if (b.status === 'Confirmed' && toDate(b.end) < now) { b.status = 'Completed'; b.cancellationRequested = false; }
    });
  }
  function reloadData() { data = loadData(); autoComplete(); invalidate(); }

  data = loadData();
  autoComplete();
  saveData();

  function nextId() { return data.bookings.reduce(function (m, b) { return Math.max(m, b.id); }, 0) + 1; }
  function findBooking(id) { return data.bookings.filter(function (b) { return b.id === id; })[0]; }
  function isMine(b) { return b.ownerId === 'me'; }
  function addHistory(b, text) { b.history.push({ ts: new Date().toISOString(), text: text }); }
  function addAttention(b, text) {
    var id = data.attention.reduce(function (m, a) { return Math.max(m, a.id); }, 0) + 1;
    data.attention.push({ id: id, bookingId: b.id, text: text });
  }

  /* =====================================================
     State
  ===================================================== */
  var state = {
    tab: 'calendar',
    cal: {
      mode: 'day',
      cursor: new Date(),
      room: String((ROOMS.filter(function (room) { return room.type === 'Classroom'; })[0] || ROOMS[0]).id),
      type: 'all'
    },
    bookFilter: 'All',
    search: '',
    editingId: null,
    detailsId: null,
    roomId: null,
    roomDate: ''
  };
  var pageParams = new URLSearchParams(window.location.search);
  if (pageParams.get('tab') === 'requests') state.tab = 'requests';
  if (pageParams.get('search')) {
    state.search = pageParams.get('search').trim().toLowerCase();
    $('roomSearchInput').value = pageParams.get('search');
  }
  function canApprove() { return isApproverRole(); }
  function canSee(b) { return !b || isMine(b) || canApprove(); }

  /* =====================================================
     Availability engine
  ===================================================== */
  function win(b) {
    var s = toDate(b.start), e = toDate(b.end);
    return { s: new Date(s.getTime() - (b.setup || 0) * 60000), e: new Date(e.getTime() + (b.cleanup || 0) * 60000) };
  }
  function getEvents() {
    if (!cache.ev) {
      try {
        var p = JSON.parse(localStorage.getItem(EVENTS_KEY) || 'null');
        cache.ev = p && p.events ? p.events : [];
      } catch (e) { cache.ev = []; }
    }
    return cache.ev;
  }

  // All intervals touching a room. 'booked', 'event' and 'closed' block it; 'pending' does not.
  function intervals(room) {
    if (cache.map[room.id]) return cache.map[room.id];
    var out = [];
    data.bookings.forEach(function (b) {
      if (b.roomId !== room.id) return;
      var w = win(b);
      if (b.status === 'Confirmed' || b.status === 'Completed') out.push({ kind: 'booked', s: w.s, e: w.e, b: b });
      else if (b.status === 'Pending Approval') out.push({ kind: 'pending', s: w.s, e: w.e, b: b });
    });
    data.blocks.forEach(function (bl) {
      if (bl.roomId === room.id) out.push({ kind: 'closed', s: toDate(bl.start), e: toDate(bl.end), title: bl.title });
    });
    // Only events whose room booking is confirmed occupy a venue (approval alone does not reserve it)
    getEvents().forEach(function (ev) {
      if (ev.venue !== room.name && ev.venue !== room.code && ev.venue !== room.facility) return;
      if (ev.bookingStatus !== 'Confirmed' || (ev.status !== 'Confirmed' && ev.status !== 'Completed')) return;
      var linked = data.bookings.some(function (b) {
        return String(b.relatedEvent) === String(ev.id) && b.roomId === room.id && (b.status === 'Confirmed' || b.status === 'Completed');
      });
      if (linked) return;
      out.push({ kind: 'event', s: toDate(ev.start), e: toDate(ev.end), title: ev.title });
    });
    cache.map[room.id] = out;
    return out;
  }

  function blockers(room, s, e, excludeId) {
    if (room.status !== 'Active') return [{ kind: 'closed', s: s, e: e, title: 'Room is under maintenance' }];
    return intervals(room).filter(function (it) {
      if (it.kind === 'pending') return false;
      if (excludeId && it.b && it.b.id === excludeId) return false;
      return overlaps(s, e, it.s, it.e);
    });
  }
  function pendingOverlaps(room, s, e, excludeId) {
    return intervals(room).filter(function (it) {
      return it.kind === 'pending' && !(excludeId && it.b.id === excludeId) && overlaps(s, e, it.s, it.e);
    });
  }
  function isFree(room, s, e, excludeId) { return blockers(room, s, e, excludeId).length === 0; }

  function slotState(room, s, e) {
    if (room.status !== 'Active') return { state: 'closed' };
    var list = intervals(room), pend = null;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!overlaps(s, e, it.s, it.e)) continue;
      if (it.kind === 'pending') { pend = pend || it; continue; }
      return { state: it.kind, item: it };
    }
    return pend ? { state: 'pending', item: pend } : { state: 'free' };
  }

  function describeItem(it) {
    var t;
    if (it.kind === 'booked') {
      t = fmtRange(toDate(it.b.start), toDate(it.b.end));
      return (canSee(it.b) ? '"' + it.b.title + '"' : 'another reservation') + ' (' + t + ')';
    }
    t = fmtRange(it.s, it.e);
    if (it.kind === 'event') return 'event "' + it.title + '" (' + t + ')';
    return (it.title || 'a closure') + ' (' + t + ')';
  }

  /* =====================================================
     Select / checkbox builders
  ===================================================== */
  function fillSelect(id, options, placeholder, placeholderValue) {
    var html = placeholder != null ? '<option value="' + (placeholderValue == null ? '' : placeholderValue) + '">' + esc(placeholder) + '</option>' : '';
    options.forEach(function (o) {
      var value = typeof o === 'string' ? o : o.value;
      var label = typeof o === 'string' ? o : o.label;
      html += '<option value="' + esc(value) + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(label) + '</option>';
    });
    $(id).innerHTML = html;
  }
  function renderChecks(id, selected) {
    if (!FACILITIES.length) {
      $(id).innerHTML = '<span class="directory-note">Facility and equipment details have not been provided.</span>';
      return;
    }
    $(id).innerHTML = FACILITIES.map(function (f) {
      return '<label class="chk"><input type="checkbox" value="' + esc(f) + '"' + (selected && selected.indexOf(f) !== -1 ? ' checked' : '') + '> ' + esc(f) + '</label>';
    }).join('');
  }
  function readChecks(id) {
    var out = [];
    $(id).querySelectorAll('input:checked').forEach(function (i) { out.push(i.value); });
    return out;
  }

  fillSelect('sType', TYPES, 'Any type', 'all');
  fillSelect('sBuilding', BUILDINGS, 'Any building', 'all');
  renderChecks('sFacilities', []);
  fillSelect('cType', TYPES, 'All room types', 'all');
  fillSelect('bPurpose', PURPOSES);
  fillSelect('bDept', DEPTS, 'Select department');
  fillSelect('bRoom', ROOMS.map(function (r) {
    return { value: r.id, label: r.name + ' — ' + r.building + ' (capacity not listed)' + (r.status !== 'Active' ? ' — under maintenance' : '') };
  }), 'Select a room');
  renderChecks('bFacilities', []);

  function rebuildCalRooms() {
    var c = state.cal;
    var list = ROOMS.filter(function (r) { return c.type === 'all' || r.type === c.type; });
    fillSelect('cRoom', list.map(function (r) { return { value: r.id, label: r.name }; }), 'All rooms', 'all');
    if (c.room !== 'all' && !list.some(function (r) { return String(r.id) === c.room; })) {
      c.room = list.length ? String(list[0].id) : 'all';
    }
    $('cRoom').value = c.room;
  }
  rebuildCalRooms();

  // Default search: tomorrow 10:00 - 12:00
  var tomorrow = addDays(new Date(), 1);
  $('sDate').value = ymd(tomorrow);
  $('sDate').min = ymd(new Date());
  $('sStart').value = '10:00';
  $('sEnd').value = '12:00';

  /* =====================================================
     Find a Room
  ===================================================== */
  function searchWindow() {
    var d = $('sDate').value, st = $('sStart').value, en = $('sEnd').value;
    if (!d || !st || !en) return null;
    var s = new Date(d + 'T' + st), e = new Date(d + 'T' + en);
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    return { s: s, e: e };
  }
  function criteria() {
    return {
      type: $('sType').value,
      cap: parseInt($('sCap').value, 10) || 0,
      building: $('sBuilding').value,
      fac: readChecks('sFacilities')
    };
  }
  function matchesCriteria(r, c) {
    if (c.type !== 'all' && r.type !== c.type) return false;
    if (c.cap && (r.cap == null || r.cap < c.cap)) return false;
    if (c.building !== 'all' && r.building !== c.building) return false;
    for (var i = 0; i < c.fac.length; i++) if (r.fac.indexOf(c.fac[i]) === -1) return false;
    if (state.search) {
      var hay = [r.name, r.building, r.type, r.floor, r.fac.join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(state.search) === -1) return false;
    }
    return true;
  }

  function alternatives(w, matching) {
    var cap = parseInt($('sCap').value, 10) || 0;
    var dur = w.e - w.s, now = new Date();
    var res = { rooms: [], slots: [], dates: [] };

    ROOMS.forEach(function (r) {
      if (matching.indexOf(r) === -1 && (!cap || (r.cap != null && r.cap >= cap)) && isFree(r, w.s, w.e)) res.rooms.push(r);
    });
    res.rooms = res.rooms.slice(0, 3);

    if (matching.length) {
      var offs = [-120, -90, -60, -30, 30, 60, 90, 120, 150, 180];
      offs.sort(function (a, b) { return Math.abs(a) - Math.abs(b); });
      offs.forEach(function (o) {
        if (res.slots.length >= 4) return;
        var cs = new Date(w.s.getTime() + o * 60000), ce = new Date(cs.getTime() + dur);
        var dayStart = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate(), HOUR_START);
        var dayEnd = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate(), HOUR_END);
        if (cs <= now || cs < dayStart || ce > dayEnd) return;
        for (var i = 0; i < matching.length; i++) {
          if (isFree(matching[i], cs, ce)) { res.slots.push({ room: matching[i], s: cs, e: ce }); break; }
        }
      });
      for (var d = 1; d <= 7 && res.dates.length < 3; d++) {
        var ds = new Date(w.s.getFullYear(), w.s.getMonth(), w.s.getDate() + d, w.s.getHours(), w.s.getMinutes());
        var de = new Date(ds.getTime() + dur);
        if (ds <= now) continue;
        for (var j = 0; j < matching.length; j++) {
          if (isFree(matching[j], ds, de)) { res.dates.push({ room: matching[j], s: ds, e: de }); break; }
        }
      }
    }
    return res;
  }

  function altBtn(label, roomId, s, e) {
    return '<button class="alt-btn" data-req-room="' + roomId + '" data-req-start="' + localDT(s) + '" data-req-end="' + localDT(e) + '">' + esc(label) + '</button>';
  }
  function altHtml(alt) {
    if (!alt.rooms.length && !alt.slots.length && !alt.dates.length) return '';
    var h = '<div class="alt-box"><b style="font-size:12px;color:var(--strong);">Suggestions based on real availability — you choose; nothing changes automatically.</b>';
    if (alt.rooms.length) {
      h += '<h4>Other rooms free at this time</h4>' + alt.rooms.map(function (r) {
        var w = searchWindow();
        return altBtn(r.name + ' (' + (r.cap == null ? 'capacity not listed' : r.cap) + ', ' + r.building + ')', r.id, w.s, w.e);
      }).join('');
    }
    if (alt.slots.length) {
      h += '<h4>Nearby times on the same day</h4>' + alt.slots.map(function (x) {
        return altBtn(x.room.name + ' · ' + fmtRange(x.s, x.e), x.room.id, x.s, x.e);
      }).join('');
    }
    if (alt.dates.length) {
      h += '<h4>Same time on another day</h4>' + alt.dates.map(function (x) {
        return altBtn(x.room.name + ' · ' + x.s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), x.room.id, x.s, x.e);
      }).join('');
    }
    return h + '</div>';
  }

  function roomCard(r) {
    return '<div class="room-card"><div class="rc-head"><div><div class="rc-name">' + esc(r.name) + '</div>' +
      '<div class="rc-meta">' + esc(r.building) + ' · ' + esc(r.floor) + ' · ' + esc(r.type) + ' · Capacity: ' + (r.cap == null ? 'not listed' : r.cap) + '</div></div>' +
      '<span class="badge badge-mint">No conflict recorded</span></div>' +
      '<div class="chips">' + r.fac.map(function (f) { return '<span class="chip">' + esc(f) + '</span>'; }).join('') +
      '<span class="chip warn">' + esc(r.verification) + '</span>' +
      (r.approval ? '<span class="chip warn">Approval required</span>' : '') + '</div>' +
      '<div class="rc-actions"><button class="btn btn-outline btn-sm-x" data-rdetail="' + r.id + '">View Details</button>' +
      '<button class="btn btn-primary btn-sm-x" data-rreq="' + r.id + '">Request This Room</button></div></div>';
  }

  function runSearch() {
    var box = $('searchResults');
    var w = searchWindow();
    if (!w) {
      box.innerHTML = emptyBox('⚠️', 'Choose a date and a valid start and end time (end must be after start).');
      updateStats();
      return;
    }
    var c = criteria();
    var matching = ROOMS.filter(function (r) { return matchesCriteria(r, c); });
    var avail = [], unavail = [];
    matching.forEach(function (r) {
      var bl = blockers(r, w.s, w.e);
      if (bl.length) unavail.push({ room: r, why: bl }); else avail.push(r);
    });

    var html = '<div class="res-head"><b>' + avail.length + ' room' + (avail.length === 1 ? '' : 's') + ' with no recorded booking conflict</b> on ' +
      esc(fmtDay(w.s)) + ', ' + esc(fmtRange(w.s, w.e)) + (unavail.length ? ' · ' + unavail.length + ' not available' : '') + '</div>';
    if (w.s <= new Date()) html += '<div class="res-warn">⚠ This time is in the past. Requests must start in the future.</div>';

    if (avail.length) {
      html += '<div class="room-grid">' + avail.map(roomCard).join('') + '</div>';
    } else if (!matching.length) {
      html += emptyBox('🔎', 'No rooms match your filters.');
      html += altHtml(alternatives(w, matching));
    } else {
      html += emptyBox('🚫', 'No matching room is free for the whole requested time.');
      html += altHtml(alternatives(w, matching));
    }

    if (unavail.length) {
      html += '<details class="unavail"><summary>Not available for this time (' + unavail.length + ')</summary><ul>' +
        unavail.map(function (u) {
          return '<li><b>' + esc(u.room.name) + '</b> <span>— ' + esc(u.why.map(describeItem).join('; ')) + '</span></li>';
        }).join('') + '</ul></details>';
    }
    box.innerHTML = html;
    updateStats();
  }

  /* =====================================================
     Stats + attention
  ===================================================== */
  function updateStats() {
    var now = new Date();
    var mine = data.bookings.filter(isMine);
    $('stUpcoming').textContent = mine.filter(function (b) { return b.status === 'Confirmed' && toDate(b.end) >= now; }).length;
    $('stPending').textContent = mine.filter(function (b) { return b.status === 'Pending Approval'; }).length;
    var w = searchWindow();
    $('stAvailable').textContent = w ? ROOMS.filter(function (r) { return isFree(r, w.s, w.e); }).length : '–';
    $('stAttention').textContent = data.attention.length;
  }

  function renderAttention() {
    var box = $('attentionPanel');
    if (!data.attention.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    var html = '<h3>🔔 Needs Attention</h3>';
    data.attention.forEach(function (a) {
      html += '<div class="att-item"><span>' + esc(a.text) + '</span><span class="att-actions">' +
        '<button class="btn btn-outline btn-sm-x" data-att-view="' + a.bookingId + '">View</button>' +
        '<button class="btn btn-outline btn-sm-x" data-att-dismiss="' + a.id + '">Dismiss</button></span></div>';
    });
    box.innerHTML = html;
    box.style.display = '';
  }

  /* =====================================================
     Calendar
  ===================================================== */
  function slotCell(room, day, h) {
    var s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
    var e = new Date(s.getTime() + 3600000);
    var past = e <= new Date();
    var st = slotState(room, s, e);
    if (st.state === 'free') {
      if (past) return '<td><span class="slot past">—</span></td>';
      return '<td><button class="slot free" data-slot-room="' + room.id + '" data-slot-start="' + localDT(s) + '" data-slot-end="' + localDT(e) + '">No conflict</button></td>';
    }
    if (st.state === 'closed') return '<td><span class="slot closed" title="Closed">Closed</span></td>';
    var it = st.item;
    if (st.state === 'event') {
      return '<td><button class="slot occ" data-ev-info="' + esc(it.title) + '" title="' + esc(it.title) + '">Event: ' + esc(it.title) + '</button></td>';
    }
    if (st.state === 'pending') {
      var lp = canSee(it.b) ? 'Pending: ' + it.b.title : 'Pending';
      return '<td><button class="slot pend" data-bk="' + it.b.id + '" title="Pending request (not confirmed)">' + esc(lp) + '</button></td>';
    }
    // booked
    var mine = isMine(it.b);
    var lb = canSee(it.b) ? it.b.title : 'Occupied';
    return '<td><button class="slot ' + (mine ? 'mine' : 'occ') + '" data-bk="' + it.b.id + '">' + esc(lb) + '</button></td>';
  }

  function renderDayGrid(day, rooms) {
    if (!rooms.length) return emptyBox('🏫', 'No rooms to show.');
    var html = '<div class="grid-wrap"><table class="slot-table"><thead><tr><th class="time-col">Time</th>' +
      rooms.map(function (r) { return '<th>' + esc(r.name) + '<small>capacity ' + (r.cap == null ? 'not listed' : r.cap) + '</small></th>'; }).join('') + '</tr></thead><tbody>';
    for (var h = HOUR_START; h < HOUR_END; h++) {
      html += '<tr><th class="time-col">' + hourLabel(h) + '</th>' + rooms.map(function (r) { return slotCell(r, day, h); }).join('') + '</tr>';
    }
    return html + '</tbody></table></div>';
  }

  function renderWeekGrid(room) {
    var ws = weekStart(state.cal.cursor), today = new Date();
    var html = '<div class="grid-wrap"><table class="slot-table"><thead><tr><th class="time-col">Time</th>';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i);
      html += '<th' + (sameDay(d, today) ? ' style="color:var(--mint)"' : '') + '>' + DAYS_SHORT[i] + '<small>' + d.getDate() + ' ' + d.toLocaleDateString('en-US', { month: 'short' }) + '</small></th>';
    }
    html += '</tr></thead><tbody>';
    for (var h = HOUR_START; h < HOUR_END; h++) {
      html += '<tr><th class="time-col">' + hourLabel(h) + '</th>';
      for (var j = 0; j < 7; j++) html += slotCell(room, addDays(ws, j), h);
      html += '</tr>';
    }
    return html + '</tbody></table></div>';
  }

  function renderMonthGrid(room) {
    var c = state.cal.cursor;
    var first = new Date(c.getFullYear(), c.getMonth(), 1);
    var gridStart = addDays(first, -((first.getDay() + 6) % 7));
    var today = new Date();
    var html = '<div class="cal-weekdays">' + DAYS_SHORT.map(function (d) { return '<div>' + d + '</div>'; }).join('') + '</div><div class="cal-grid">';
    for (var i = 0; i < 42; i++) {
      var day = addDays(gridStart, i), de = addDays(day, 1);
      var items = intervals(room).filter(function (it) { return overlaps(day, de, it.s, it.e); });
      var booked = items.filter(function (it) { return it.kind !== 'pending'; }).length;
      var pend = items.length - booked;
      var cls = 'cal-cell' + (day.getMonth() !== c.getMonth() ? ' muted' : '') + (sameDay(day, today) ? ' today' : '');
      var chips = '';
      if (room.status !== 'Active') chips = '<span class="mchip closed">Closed</span>';
      else {
        if (booked) chips += '<span class="mchip occ">' + booked + ' booked</span>';
        if (pend) chips += '<span class="mchip pend">' + pend + ' pending</span>';
        if (!booked && !pend && de > today) chips = '<span class="mchip free">No conflict</span>';
      }
      html += '<button class="' + cls + '" data-goday="' + ymd(day) + '"><span class="cal-daynum">' + day.getDate() + '</span>' + chips + '</button>';
    }
    return html + '</div>';
  }

  function renderCalendar() {
    var c = state.cal;
    var rooms = ROOMS.filter(function (r) { return c.type === 'all' || r.type === c.type; });
    if (c.mode !== 'day' && c.room === 'all' && rooms.length) { c.room = String(rooms[0].id); $('cRoom').value = c.room; }
    var shown = c.room === 'all' ? rooms : rooms.filter(function (r) { return String(r.id) === c.room; });

    document.querySelectorAll('#calModes button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === c.mode); });

    var title, body;
    if (c.mode === 'day') {
      title = fmtDay(c.cursor);
      body = renderDayGrid(startOfDay(c.cursor), shown);
    } else if (c.mode === 'week') {
      var ws = weekStart(c.cursor), we = addDays(ws, 6), o = { month: 'short', day: 'numeric' };
      title = ws.toLocaleDateString('en-US', o) + ' – ' + we.toLocaleDateString('en-US', o) + ', ' + we.getFullYear();
      body = shown.length ? renderWeekGrid(shown[0]) : emptyBox('🏫', 'No rooms to show.');
    } else {
      title = c.cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      body = shown.length ? renderMonthGrid(shown[0]) : emptyBox('🏫', 'No rooms to show.');
    }
    if (c.mode !== 'day' && shown.length) title += ' · ' + shown[0].name;
    $('calTitle').textContent = title;
    $('calBody').innerHTML = body;
  }

  function shiftCal(dir) {
    var c = state.cal;
    if (c.mode === 'month') c.cursor = new Date(c.cursor.getFullYear(), c.cursor.getMonth() + dir, 1);
    else if (c.mode === 'week') c.cursor = addDays(c.cursor, 7 * dir);
    else c.cursor = addDays(c.cursor, dir);
    renderCalendar();
  }
  $('calPrev').addEventListener('click', function () { shiftCal(-1); });
  $('calNext').addEventListener('click', function () { shiftCal(1); });
  $('calToday').addEventListener('click', function () { state.cal.cursor = new Date(); renderCalendar(); });
  document.querySelectorAll('#calModes button').forEach(function (b) {
    b.addEventListener('click', function () { state.cal.mode = b.dataset.mode; renderCalendar(); });
  });
  $('cType').addEventListener('change', function (e) { state.cal.type = e.target.value; rebuildCalRooms(); renderCalendar(); });
  $('cRoom').addEventListener('change', function (e) { state.cal.room = e.target.value; renderCalendar(); });

  $('calBody').addEventListener('click', function (e) {
    var free = e.target.closest('[data-slot-room]');
    if (free) {
      openBooking({ roomId: parseInt(free.dataset.slotRoom, 10), start: free.dataset.slotStart, end: free.dataset.slotEnd });
      return;
    }
    var bkBtn = e.target.closest('[data-bk]');
    if (bkBtn) {
      var b = findBooking(parseInt(bkBtn.dataset.bk, 10));
      if (!b) return;
      if (canSee(b)) openDetails(b.id);
      else toast('Reserved ' + fmtRange(toDate(b.start), toDate(b.end)) + '. Details are visible only to the requester and approvers.');
      return;
    }
    var evb = e.target.closest('[data-ev-info]');
    if (evb) { toast('University event: ' + evb.dataset.evInfo); return; }
    var go = e.target.closest('[data-goday]');
    if (go) {
      state.cal.cursor = parseYmd(go.dataset.goday);
      state.cal.mode = 'day';
      var m = $('cRoom').value;
      state.cal.room = m;
      renderCalendar();
    }
  });

  /* =====================================================
     My Bookings + Booking Requests
  ===================================================== */
  function matchesSearchBooking(b) {
    if (!state.search) return true;
    var r = roomById(b.roomId);
    var hay = [b.ref, b.title, b.purpose, r ? r.name : '', r ? r.building : '', b.status].join(' ').toLowerCase();
    return hay.indexOf(state.search) !== -1;
  }

  function renderFilters() {
    var mine = data.bookings.filter(isMine);
    $('bookFilters').innerHTML = STATUS_FILTERS.map(function (f) {
      var n = f === 'All' ? mine.length : mine.filter(function (b) { return b.status === f; }).length;
      return '<button data-bf="' + esc(f) + '" class="' + (state.bookFilter === f ? 'on' : '') + '">' + esc(f) + ' (' + n + ')</button>';
    }).join('');
  }

  function lastNote(b) {
    if ((b.status === 'Changes Requested' || b.status === 'Rejected') && b.history.length) return b.history[b.history.length - 1].text;
    return '';
  }

  function bookingActions(b) {
    var a = '';
    function btn(act, label, cls) { return '<button class="btn ' + (cls || 'btn-outline') + ' btn-sm-x" data-bact="' + act + '" data-id="' + b.id + '">' + label + '</button>'; }
    if (b.status === 'Draft') a = btn('edit', 'Edit') + btn('submit', 'Submit', 'btn-primary') + btn('delete', 'Delete Draft', 'btn-danger');
    else if (b.status === 'Pending Approval') a = btn('view', 'View Details') + btn('withdraw', 'Withdraw Request', 'btn-danger');
    else if (b.status === 'Changes Requested') a = btn('edit', 'Edit') + btn('resubmit', 'Resubmit', 'btn-primary');
    else if (b.status === 'Confirmed') a = btn('view', 'View Details') + (b.cancellationRequested ? '' : btn('reqcancel', 'Request Cancellation', 'btn-danger'));
    else if (b.status === 'Rejected') a = btn('view', 'View Reason') + btn('newfrom', 'Create New Request', 'btn-primary');
    else if (b.status === 'Completed') a = btn('view', 'View Details');
    else if (b.status === 'Cancelled') a = btn('view', 'View Cancellation History');
    return a;
  }

  function renderBookings() {
    renderFilters();
    var list = data.bookings.filter(isMine).filter(function (b) {
      return (state.bookFilter === 'All' || b.status === state.bookFilter) && matchesSearchBooking(b);
    }).sort(function (a, b) { return toDate(a.start) - toDate(b.start); });

    if (!list.length) { $('bookList').innerHTML = emptyBox('📋', 'No bookings found for this filter.'); return; }
    $('bookList').innerHTML = list.map(function (b) {
      var r = roomById(b.roomId), s = toDate(b.start), e = toDate(b.end), note = lastNote(b);
      return '<div class="bk-row" data-id="' + b.id + '"><div class="bk-main">' +
        '<div class="bk-ref">' + esc(b.ref) + '</div><div class="bk-title">' + esc(b.title) + '</div>' +
        '<div class="bk-meta">' + esc(r ? r.name + ' · ' + r.building : '—') + ' · ' + esc(fmtDay(s)) + ' · ' + esc(fmtRange(s, e)) + '</div>' +
        '<div class="bk-meta">Submitted: ' + esc(b.submittedAt ? fmtStamp(b.submittedAt) : 'not submitted') + '</div>' +
        (note ? '<div class="bk-note">' + esc(note) + '</div>' : '') +
        '<div class="bk-actions">' + bookingActions(b) + '</div></div>' +
        '<div class="bk-badges"><span class="badge ' + STATUS_BADGE[b.status] + '">' + esc(b.status) + '</span>' +
        (b.cancellationRequested ? '<span class="badge badge-orange">Cancellation requested</span>' : '') + '</div></div>';
    }).join('');
  }

  function requestQueue() {
    return data.bookings.filter(function (b) {
      return !isMine(b) && (b.status === 'Pending Approval' || (b.status === 'Confirmed' && b.cancellationRequested));
    }).filter(matchesSearchBooking).sort(function (a, b) { return toDate(a.start) - toDate(b.start); });
  }

  function renderRequests() {
    var list = requestQueue();
    if (!list.length) { $('reqList').innerHTML = emptyBox('🛡', 'No requests waiting for a decision.'); return; }
    $('reqList').innerHTML = list.map(function (b) {
      var r = roomById(b.roomId), s = toDate(b.start), e = toDate(b.end);
      var w = win(b), conf = blockers(r, w.s, w.e, b.id).length;
      return '<div class="bk-row" data-id="' + b.id + '"><div class="bk-main">' +
        '<div class="bk-ref">' + esc(b.ref) + '</div><div class="bk-title">' + esc(b.title) + '</div>' +
        '<div class="bk-meta">' + esc(r.name + ' · ' + r.building) + ' · ' + esc(fmtDay(s)) + ' · ' + esc(fmtRange(s, e)) + '</div>' +
        '<div class="bk-meta">' + esc(b.organizer) + ' · ' + esc(b.dept) + ' · ' + b.attendance + ' attendees · Approver: ' + esc(approverFor(r)) + '</div>' +
        (conf ? '<div class="bk-note">⚠ ' + conf + ' conflicting reservation' + (conf > 1 ? 's' : '') + '</div>' : '') +
        '<div class="bk-actions"><button class="btn btn-primary btn-sm-x" data-bact="view" data-id="' + b.id + '">Review</button></div></div>' +
        '<div class="bk-badges">' + (b.cancellationRequested
          ? '<span class="badge badge-orange">Cancellation requested</span>'
          : '<span class="badge badge-orange">Pending Approval</span>') + '</div></div>';
    }).join('');
  }

  /* =====================================================
     Tabs / render all
  ===================================================== */
  function renderTabs() {
    var showReq = canApprove();
    $('tabRequests').style.display = showReq ? '' : 'none';
    if (showReq) $('tabRequests').textContent = '🛡 Booking Requests (' + requestQueue().length + ')';
    if (!showReq && state.tab === 'requests') state.tab = 'calendar';
    document.querySelectorAll('#mainTabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === state.tab); });
    $('calPane').style.display = state.tab === 'calendar' ? '' : 'none';
    $('bookPane').style.display = state.tab === 'bookings' ? '' : 'none';
    $('reqPane').style.display = state.tab === 'requests' ? '' : 'none';
  }

  function renderAll() {
    updateStats();
    renderAttention();
    renderTabs();
    runSearch();
    renderCalendar();
    renderBookings();
    if (canApprove()) renderRequests();
  }

  document.querySelectorAll('#mainTabs button').forEach(function (b) {
    b.addEventListener('click', function () { state.tab = b.dataset.tab; renderAll(); });
  });
  $('bookFilters').addEventListener('click', function (e) {
    var f = e.target.closest('[data-bf]');
    if (f) { state.bookFilter = f.dataset.bf; renderBookings(); }
  });
  $('roomSearchInput').addEventListener('input', function (e) {
    state.search = e.target.value.trim().toLowerCase();
    runSearch(); renderBookings(); if (canApprove()) renderRequests();
  });

  $('checkBtn').addEventListener('click', runSearch);
  ['sDate', 'sStart', 'sEnd', 'sType', 'sBuilding'].forEach(function (id) { $(id).addEventListener('change', runSearch); });
  $('sCap').addEventListener('input', runSearch);
  $('sFacilities').addEventListener('change', runSearch);
  $('resetSearchBtn').addEventListener('click', function () {
    $('sDate').value = ymd(addDays(new Date(), 1));
    $('sStart').value = '10:00'; $('sEnd').value = '12:00';
    $('sType').value = 'all'; $('sBuilding').value = 'all'; $('sCap').value = '';
    renderChecks('sFacilities', []);
    state.search = ''; $('roomSearchInput').value = '';
    runSearch();
  });

  $('searchResults').addEventListener('click', function (e) {
    var det = e.target.closest('[data-rdetail]');
    var req = e.target.closest('[data-rreq]');
    var alt = e.target.closest('[data-req-room]');
    if (det) openRoom(parseInt(det.dataset.rdetail, 10));
    else if (req) {
      var w = searchWindow();
      openBooking({ roomId: parseInt(req.dataset.rreq, 10), start: w ? localDT(w.s) : '', end: w ? localDT(w.e) : '', attendance: $('sCap').value, facilities: readChecks('sFacilities') });
    } else if (alt) {
      openBooking({ roomId: parseInt(alt.dataset.reqRoom, 10), start: alt.dataset.reqStart, end: alt.dataset.reqEnd, attendance: $('sCap').value, facilities: readChecks('sFacilities') });
    }
  });

  document.querySelectorAll('.stats-grid-rb .stat-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var s = card.dataset.stat;
      if (s === 'upcoming') { state.tab = 'bookings'; state.bookFilter = 'Confirmed'; renderAll(); }
      else if (s === 'pending') { state.tab = 'bookings'; state.bookFilter = 'Pending Approval'; renderAll(); }
      else if (s === 'available') { $('findCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else if (s === 'attention') {
        if (!data.attention.length) toast('Nothing needs your attention right now.');
        else $('attentionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
  $('notifBell').addEventListener('click', function () {
    if (data.attention.length) $('attentionPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    else toast('No new updates.');
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

  function rowClick(e) {
    var act = e.target.closest('[data-bact]');
    if (act) { e.stopPropagation(); bookingAction(act.dataset.bact, parseInt(act.dataset.id, 10)); return; }
    var row = e.target.closest('[data-id]');
    if (row) openDetails(parseInt(row.dataset.id, 10));
  }
  $('bookList').addEventListener('click', rowClick);
  $('reqList').addEventListener('click', rowClick);

  /* =====================================================
     Modals (generic)
  ===================================================== */
  var bookingModal = $('bookingModal'), detailsModal = $('detailsModal'), roomModal = $('roomModal');
  function closeBooking() { bookingModal.classList.remove('show'); state.editingId = null; }
  function closeDetails() { detailsModal.classList.remove('show'); state.detailsId = null; }
  function closeRoom() { roomModal.classList.remove('show'); state.roomId = null; }
  $('closeBookingBtn').addEventListener('click', closeBooking);
  $('bCancelBtn').addEventListener('click', closeBooking);
  $('closeDetailsBtn').addEventListener('click', closeDetails);
  $('closeRoomBtn').addEventListener('click', closeRoom);
  bookingModal.addEventListener('click', function (e) { if (e.target === bookingModal) closeBooking(); });
  detailsModal.addEventListener('click', function (e) { if (e.target === detailsModal) closeDetails(); });
  roomModal.addEventListener('click', function (e) { if (e.target === roomModal) closeRoom(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (bookingModal.classList.contains('show')) closeBooking();
    else if (detailsModal.classList.contains('show')) closeDetails();
    else if (roomModal.classList.contains('show')) closeRoom();
  });

  /* =====================================================
     Room details
  ===================================================== */
  function openRoom(id) {
    var w = searchWindow();
    state.roomId = id;
    state.roomDate = w ? ymd(w.s) : ymd(new Date());
    renderRoom();
    roomModal.classList.add('show');
  }

  function renderRoom() {
    var r = roomById(state.roomId);
    if (!r) return;
    $('roomTitle').textContent = r.name;
    var w = searchWindow(), availHtml = '';
    if (r.status !== 'Active') availHtml = '<span class="badge badge-red">Under maintenance — cannot be booked</span>';
    else if (w) {
      var bl = blockers(r, w.s, w.e);
      availHtml = (bl.length
        ? '<span class="badge badge-red">Not available</span> ' + esc(bl.map(describeItem).join('; '))
        : '<span class="badge badge-mint">No conflict recorded</span>') +
        '<br><small style="color:var(--muted)">' + esc(fmtDay(w.s) + ', ' + fmtRange(w.s, w.e)) + '</small>';
    } else availHtml = 'Choose a date and time in Find a Room to see availability.';

    var d = parseYmd(state.roomDate), de = addDays(d, 1);
    var items = intervals(r).filter(function (it) { return overlaps(d, de, it.s, it.e); }).sort(function (a, b) { return a.s - b.s; });
    var dayHtml = items.length ? '<ul class="day-list">' + items.map(function (it) {
      var label;
      if (it.kind === 'booked') label = canSee(it.b) ? it.b.title : 'Reserved';
      else if (it.kind === 'pending') label = canSee(it.b) ? 'Pending: ' + it.b.title : 'Pending request';
      else if (it.kind === 'event') label = 'Event: ' + it.title;
      else label = it.title || 'Closed';
      return '<li><b>' + esc(label) + '</b><span>' + esc(fmtRange(it.s, it.e)) + '</span></li>';
    }).join('') + '</ul>' : '<div style="font-size:12px;color:var(--muted)">No reservations on this date.</div>';

    $('roomBody').innerHTML =
      '<div class="detail-badges"><span class="tag tag-mint">' + esc(r.type) + '</span>' +
      '<span class="badge ' + (r.status === 'Active' ? 'badge-mint' : 'badge-red') + '">' + esc(r.status) + '</span></div>' +
      '<div class="detail-grid">' +
      detailItem('Building', r.building) + detailItem('Floor / location', r.floor) +
      detailItem('Seating capacity', r.cap == null ? 'Not provided' : r.cap) + detailItem('Accessibility', r.acc ? 'Step-free access' : 'Not provided') +
      detailItem('Directory status', r.verification, true) +
      '<div class="detail-item wide"><small>Facility / equipment details</small><span>Not provided</span></div>' +
      detailItem('Booking policy', r.approval ? 'Approval required (' + approverFor(r) + ')' : 'Direct booking for faculty/staff; students need approval', true) +
      '<div class="detail-item wide"><small>Availability for selected time</small><span>' + availHtml + '</span></div></div>' +
      '<div class="field"><label for="rdDate">Reservations on</label><input type="date" id="rdDate" class="input" value="' + esc(state.roomDate) + '"></div>' + dayHtml;

    $('roomFooter').innerHTML = '<div class="action-row"><button class="btn btn-primary" data-rd-request ' + (r.status !== 'Active' ? 'disabled' : '') + '>Request This Room</button></div>';
  }
  $('roomBody').addEventListener('change', function (e) {
    if (e.target.id === 'rdDate' && e.target.value) { state.roomDate = e.target.value; renderRoom(); }
  });
  $('roomFooter').addEventListener('click', function (e) {
    if (!e.target.closest('[data-rd-request]')) return;
    var id = state.roomId, w = searchWindow();
    closeRoom();
    var start, end;
    if (w) { start = localDT(w.s); end = localDT(w.e); }
    else { start = state.roomDate + 'T09:00'; end = state.roomDate + 'T10:00'; }
    openBooking({ roomId: id, start: start, end: end });
  });

  /* =====================================================
     Booking form: read / check / validate
  ===================================================== */
  function readForm() {
    var d = $('bDate').value, st = $('bStart').value, en = $('bEnd').value;
    return {
      title: $('bTitle').value.trim(),
      purpose: $('bPurpose').value,
      roomId: parseInt($('bRoom').value, 10) || 0,
      start: d && st ? d + 'T' + st : '',
      end: d && en ? d + 'T' + en : '',
      date: d,
      setup: Math.max(0, parseInt($('bSetup').value, 10) || 0),
      cleanup: Math.max(0, parseInt($('bCleanup').value, 10) || 0),
      attendance: parseInt($('bAttendance').value, 10) || 0,
      dept: $('bDept').value,
      organizer: $('bOrganizer').value.trim(),
      contact: $('bContact').value.trim(),
      facilities: readChecks('bFacilities'),
      relatedEvent: $('bEvent').value,
      notes: $('bNotes').value.trim()
    };
  }
  function formFromBooking(b) {
    return {
      title: b.title, purpose: b.purpose, roomId: b.roomId, start: b.start, end: b.end, date: b.start.slice(0, 10),
      setup: b.setup, cleanup: b.cleanup, attendance: b.attendance, dept: b.dept, organizer: b.organizer,
      contact: b.contact, facilities: b.facilities, relatedEvent: b.relatedEvent, notes: b.notes
    };
  }
  function formWindow(f) {
    var s = toDate(f.start), e = toDate(f.end);
    return { s: new Date(s.getTime() - f.setup * 60000), e: new Date(e.getTime() + f.cleanup * 60000), rs: s, re: e };
  }

  function checkForm(f, excludeId) {
    var res = { errors: [], warnings: [], rooms: [], slots: [], ready: false };
    var room = roomById(f.roomId);
    if (!room || !f.start || !f.end) return res;
    var s = toDate(f.start), e = toDate(f.end);
    if (isNaN(s) || isNaN(e) || e <= s) return res;
    res.ready = true;
    var w = formWindow(f);

    if (room.status !== 'Active') res.errors.push(room.name + ' is under maintenance and cannot be booked.');
    if (f.attendance && room.cap != null && f.attendance > room.cap) res.errors.push(room.name + ' holds ' + room.cap + ' people, but ' + f.attendance + ' are expected.');
    if (f.attendance && room.cap == null) res.warnings.push('Capacity is not listed; confirm it with the building before submitting.');
    if (room.verification.indexOf('Proposed placeholder') !== -1) res.warnings.push('This room ID is a proposed placeholder and has not been confirmed.');
    blockers(room, w.s, w.e, excludeId).forEach(function (it) {
      if (room.status === 'Active') res.errors.push(room.name + ' is already reserved: ' + describeItem(it) + '.');
    });
    var pend = pendingOverlaps(room, w.s, w.e, excludeId);
    if (pend.length) res.warnings.push(pend.length + ' other pending request' + (pend.length > 1 ? 's' : '') + ' overlap this time. Whoever is approved first gets the room.');
    var missing = f.facilities.filter(function (x) { return room.fac.indexOf(x) === -1; });
    if (missing.length) res.warnings.push('Equipment details have not been provided for this room.');

    if (res.errors.length) {
      ROOMS.forEach(function (r) {
        if (r.id !== room.id && r.cap != null && r.cap >= f.attendance && isFree(r, w.s, w.e, excludeId)) res.rooms.push(r);
      });
      res.rooms = res.rooms.slice(0, 3);

      var dur = e - s, now = new Date(), cands = [];
      for (var m = HOUR_START * 60; m <= (HOUR_END * 60); m += 30) {
        var cs = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, m);
        var ce = new Date(cs.getTime() + dur);
        if (cs <= now || ce > new Date(s.getFullYear(), s.getMonth(), s.getDate(), HOUR_END)) continue;
        if (cs.getTime() === s.getTime()) continue;
        var cw = { s: new Date(cs.getTime() - f.setup * 60000), e: new Date(ce.getTime() + f.cleanup * 60000) };
        if ((room.cap == null || room.cap >= f.attendance) && isFree(room, cw.s, cw.e, excludeId)) cands.push(cs);
      }
      cands.sort(function (a, b) { return Math.abs(a - s) - Math.abs(b - s); });
      res.slots = cands.slice(0, 3);
    }
    return res;
  }

  function renderAvail(res) {
    var box = $('availabilityBox');
    if (!res.ready) { box.className = 'availability-box'; box.innerHTML = ''; return; }
    var cls = 'ok', html = '';
    if (res.errors.length) {
      cls = 'bad';
      html += '<b>❌ Not available</b><ul>' + res.errors.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    } else html += '✅ No conflicting reservation is recorded for the requested time (including setup and cleanup).';
    if (res.warnings.length) {
      if (cls === 'ok') cls = 'warn';
      html += '<div style="margin-top:6px;">⚠ ' + res.warnings.map(esc).join('<br>⚠ ') + '</div>';
    }
    if (res.rooms.length) {
      html += '<div class="sg-title">Other rooms free at this time:</div>' + res.rooms.map(function (r) {
        return '<button type="button" class="alt-btn" data-sg-room="' + r.id + '">' + esc(r.name) + ' (' + (r.cap == null ? 'capacity not listed' : r.cap) + ')</button>';
      }).join('');
    }
    if (res.slots.length) {
      html += '<div class="sg-title">Same room, other times:</div>' + res.slots.map(function (d) {
        return '<button type="button" class="alt-btn" data-sg-slot="' + localDT(d) + '">' + esc(fmtTime(d)) + '</button>';
      }).join('');
    }
    box.className = 'availability-box show ' + cls;
    box.innerHTML = html;
  }

  function refreshAvail() { renderAvail(checkForm(readForm(), state.editingId)); }
  ['bRoom', 'bDate', 'bStart', 'bEnd', 'bSetup', 'bCleanup', 'bAttendance'].forEach(function (id) {
    $(id).addEventListener('change', refreshAvail);
    $(id).addEventListener('input', refreshAvail);
  });
  $('bFacilities').addEventListener('change', refreshAvail);

  $('availabilityBox').addEventListener('click', function (e) {
    var r = e.target.closest('[data-sg-room]');
    var s = e.target.closest('[data-sg-slot]');
    if (r) $('bRoom').value = r.dataset.sgRoom;
    if (s) {
      var f = readForm(), dur = toDate(f.end) - toDate(f.start);
      var ns = new Date(s.dataset.sgSlot), ne = new Date(ns.getTime() + dur);
      $('bDate').value = ymd(ns);
      $('bStart').value = pad(ns.getHours()) + ':' + pad(ns.getMinutes());
      $('bEnd').value = pad(ne.getHours()) + ':' + pad(ne.getMinutes());
    }
    refreshAvail();
  });

  function validateForm(f, mode, excludeId) {
    var errs = [];
    if (!f.title) errs.push('Event / title is required.');
    if (mode === 'draft') return errs;

    if (user.role === 'student' && !ALLOW_STUDENT_REQUESTS) errs.push('Booking policy: students cannot request rooms directly. Ask a faculty member or department to book for you.');
    if (!f.purpose) errs.push('Select a purpose.');
    if (!f.roomId) errs.push('Select a room.');
    if (!f.start || !f.end) errs.push('Date, start time and end time are required.');
    else {
      var s = toDate(f.start), e = toDate(f.end);
      if (e <= s) errs.push('End time must be after the start time.');
      else if (s <= new Date()) errs.push('The booking must start in the future.');
    }
    if (!f.attendance || f.attendance < 1) errs.push('Expected attendance must be greater than 0.');
    if (!f.dept) errs.push('Select the organizing department.');
    if (!f.organizer) errs.push('Organizer is required.');
    if (!f.contact) errs.push('Contact details are required.');
    if (f.setup > 240 || f.cleanup > 240) errs.push('Setup and cleanup are limited to 240 minutes each.');

    if (!errs.length) {
      var res = checkForm(f, excludeId);
      errs = errs.concat(res.errors);
      renderAvail(res);
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
     Booking form: open / save / submit
  ===================================================== */
  function eventOptions() {
    var list = getEvents().filter(function (e) {
      return ['Cancelled', 'Completed', 'Rejected', 'Draft'].indexOf(e.status) === -1 && (e.ownerId === 'me' || e.status === 'Approved' || e.status === 'Confirmed');
    });
    return list.map(function (e) {
      return { value: String(e.id), label: e.title + ' (' + e.start.slice(0, 10) + ')' };
    });
  }

  function openBooking(pre, existing) {
    state.editingId = existing ? existing.id : null;
    showFormErrors([]);
    var b = existing || pre || {};
    $('bHeading').textContent = existing ? 'Edit Booking Request' : 'Request a Room';

    fillSelect('bEvent', eventOptions(), 'None', '');
    var sd = b.start ? b.start.slice(0, 10) : '', st = b.start ? b.start.slice(11, 16) : '', et = b.end ? b.end.slice(11, 16) : '';
    $('bTitle').value = b.title || '';
    $('bPurpose').value = b.purpose || 'Meeting';
    $('bRoom').value = b.roomId ? String(b.roomId) : '';
    $('bDate').value = sd; $('bStart').value = st; $('bEnd').value = et;
    $('bSetup').value = b.setup || 0; $('bCleanup').value = b.cleanup || 0;
    $('bAttendance').value = b.attendance || '';
    $('bDept').value = b.dept || (DEPTS.indexOf(user.dept) !== -1 ? user.dept : '');
    $('bOrganizer').value = b.organizer || user.name;
    $('bContact').value = b.contact || '';
    renderChecks('bFacilities', b.facilities || []);
    $('bEvent').value = b.relatedEvent || '';
    $('bNotes').value = b.notes || '';
    $('bDate').min = ymd(new Date());

    refreshAvail();
    bookingModal.classList.add('show');
  }
  $('newRequestBtn').addEventListener('click', function () { openBooking({}); });

  function applyForm(b, f) {
    b.title = f.title; b.purpose = f.purpose; b.roomId = f.roomId; b.start = f.start; b.end = f.end;
    b.setup = f.setup; b.cleanup = f.cleanup; b.attendance = f.attendance; b.dept = f.dept;
    b.organizer = f.organizer; b.contact = f.contact; b.facilities = f.facilities;
    b.relatedEvent = f.relatedEvent; b.notes = f.notes;
  }

  $('bDraftBtn').addEventListener('click', function () {
    var f = readForm();
    var errs = validateForm(f, 'draft');
    if (errs.length) { showFormErrors(errs); return; }
    var existing = state.editingId ? findBooking(state.editingId) : null;
    if (existing) {
      applyForm(existing, f);
      if (existing.status !== 'Changes Requested') existing.status = 'Draft';
      addHistory(existing, 'Draft saved.');
    } else {
      var b = bk({ id: nextId(), ownerId: 'me', status: 'Draft' });
      b.ref = makeRef(b.id);
      applyForm(b, f);
      addHistory(b, 'Draft created.');
      data.bookings.push(b);
    }
    saveData(); closeBooking();
    state.tab = 'bookings'; state.bookFilter = 'All';
    renderAll();
    toast('Draft saved.');
  });

  // Final server-style recheck + save. Returns the resulting booking or null.
  function submitBooking(f, existingId) {
    reloadData();                                 // simulate a fresh server read to avoid stale conflicts
    var room = roomById(f.roomId);
    var res = checkForm(f, existingId);
    if (res.errors.length) {
      showFormErrors(res.errors.concat(['The room became unavailable. Please choose an alternative.']));
      renderAvail(res);
      return null;
    }
    var b = existingId ? findBooking(existingId) : null;
    if (!b) {
      b = bk({ id: nextId(), ownerId: 'me' });
      b.ref = makeRef(b.id);
      data.bookings.push(b);
    }
    applyForm(b, f);
    b.submittedAt = new Date().toISOString();
    b.cancellationRequested = false;
    if (!room.approval && user.role !== 'student') {
      b.status = 'Confirmed';
      addHistory(b, 'Auto-confirmed: direct booking is permitted for your role and the final availability check passed.');
    } else {
      b.status = 'Pending Approval';
      addHistory(b, 'Request submitted for approval (' + approverFor(room) + ').');
    }
    data.attention = data.attention.filter(function (a) { return a.bookingId !== b.id; });
    saveData();
    return b;
  }

  function afterSubmitToast(b) {
    if (b.status === 'Confirmed') toast('Room booked and confirmed.');
    else toast('Request submitted. ' + approverFor(roomById(b.roomId)) + ' has been notified. The room is not booked until approved.');
  }

  $('bSubmitBtn').addEventListener('click', function () {
    var f = readForm();
    var errs = validateForm(f, 'submit', state.editingId);
    if (errs.length) { showFormErrors(errs); return; }
    var b = submitBooking(f, state.editingId);
    if (!b) return;
    closeBooking();
    state.tab = 'bookings'; state.bookFilter = 'All';
    renderAll();
    afterSubmitToast(b);
  });

  /* =====================================================
     Booking row / detail actions
  ===================================================== */
  function bookingAction(act, id) {
    var b = findBooking(id);
    if (!b) return;
    if (act === 'view') openDetails(id);
    else if (act === 'edit') openBooking(null, b);
    else if (act === 'delete') deleteDraft(b);
    else if (act === 'withdraw') withdraw(b);
    else if (act === 'reqcancel') requestCancellation(b);
    else if (act === 'newfrom') {
      openBooking({ title: b.title, purpose: b.purpose, roomId: b.roomId, start: '', end: '', attendance: b.attendance, dept: b.dept, organizer: b.organizer, contact: b.contact, facilities: b.facilities, notes: b.notes });
    } else if (act === 'submit' || act === 'resubmit') {
      var f = formFromBooking(b);
      var errs = validateForm(f, 'submit', b.id);
      if (errs.length) { openBooking(null, b); showFormErrors(errs); toast('Complete the form before submitting.'); return; }
      var nb = submitBooking(f, b.id);
      if (!nb) { openBooking(null, b); return; }
      renderAll(); afterSubmitToast(nb);
    }
  }

  function deleteDraft(b) {
    if (b.status !== 'Draft') return;
    if (!confirm('Delete draft "' + b.title + '"?')) return;
    data.bookings = data.bookings.filter(function (x) { return x.id !== b.id; });
    data.attention = data.attention.filter(function (a) { return a.bookingId !== b.id; });
    saveData(); closeDetails(); renderAll();
    toast('Draft deleted.');
  }
  function withdraw(b) {
    if (b.status !== 'Pending Approval') return;
    if (!confirm('Withdraw request "' + b.title + '"?')) return;
    b.status = 'Cancelled';
    addHistory(b, 'Withdrawn by requester.');
    saveData(); renderAll();
    if (state.detailsId === b.id) renderDetails(b);
    toast('Request withdrawn.');
  }
  function requestCancellation(b) {
    if (b.status !== 'Confirmed' || toDate(b.end) < new Date()) return;
    var reason = prompt('Request cancellation of "' + b.title + '". Reason (sent to the approver):', '');
    if (reason === null) return;
    b.cancellationRequested = true;
    addHistory(b, 'Cancellation requested' + (reason ? ': ' + reason : '.'));
    saveData(); renderAll();
    if (state.detailsId === b.id) renderDetails(b);
    toast('Cancellation requested. The booking stays confirmed until it is approved.');
  }

  // Approver decisions (re-read data and recheck conflicts before confirming)
  function decide(id, kind, by, note) {
    reloadData();
    var b = findBooking(id);
    if (!b) return false;
    var room = roomById(b.roomId);
    if (kind === 'approve') {
      var w = win(b), bl = blockers(room, w.s, w.e, b.id);
      if (bl.length) { toast('Cannot approve: room no longer available — ' + describeItem(bl[0])); return false; }
      b.status = 'Confirmed';
      addHistory(b, 'Approved by ' + by + (note ? ': ' + note : '.') + ' Booking confirmed.');
      if (isMine(b)) addAttention(b, '"' + b.title + '" was approved and confirmed');
    } else if (kind === 'reject') {
      b.status = 'Rejected';
      addHistory(b, 'Rejected by ' + by + ': ' + note);
      if (isMine(b)) addAttention(b, 'Request rejected: "' + b.title + '"');
    } else if (kind === 'changes') {
      b.status = 'Changes Requested';
      addHistory(b, 'Changes requested by ' + by + ': ' + note);
      if (isMine(b)) addAttention(b, 'Changes requested on "' + b.title + '"');
    } else if (kind === 'cancel-ok') {
      b.status = 'Cancelled'; b.cancellationRequested = false;
      addHistory(b, 'Cancellation approved by ' + by + (note ? ': ' + note : '.') + ' Requester and affected parties notified.');
    } else if (kind === 'cancel-no') {
      b.cancellationRequested = false;
      addHistory(b, 'Cancellation request declined by ' + by + (note ? ': ' + note : '.') + ' Booking remains confirmed.');
    }
    saveData();
    return true;
  }

  /* =====================================================
     Booking details
  ===================================================== */
  function detailItem(label, value, wide) {
    return '<div class="detail-item' + (wide ? ' wide' : '') + '"><small>' + esc(label) + '</small><span>' + esc(value == null || value === '' ? '—' : value) + '</span></div>';
  }

  function openDetails(id) {
    var b = findBooking(id);
    if (!b) return;
    state.detailsId = id;
    renderDetails(b);
    detailsModal.classList.add('show');
  }

  function renderDetails(b) {
    var r = roomById(b.roomId), s = toDate(b.start), e = toDate(b.end);
    $('detailsTitle').textContent = b.title + ' · ' + b.ref;

    var relEv = '';
    if (b.relatedEvent) {
      var ev = getEvents().filter(function (x) { return String(x.id) === String(b.relatedEvent); })[0];
      relEv = ev ? ev.title : 'Event #' + b.relatedEvent;
    }
    var extra = '';
    if (b.setup || b.cleanup) extra = ' (setup ' + b.setup + ' min, cleanup ' + b.cleanup + ' min)';

    var body = '<div class="detail-badges"><span class="badge ' + STATUS_BADGE[b.status] + '">' + esc(b.status) + '</span>' +
      '<span class="tag tag-mint">' + esc(b.purpose) + '</span>' +
      (b.cancellationRequested ? '<span class="badge badge-orange">Cancellation requested</span>' : '') +
      (b.status === 'Pending Approval' ? '<span class="badge badge-time">Not booked until approved</span>' : '') + '</div>';

    body += '<div class="detail-grid">' +
      detailItem('Room', r ? r.name : '—') + detailItem('Building / floor', r ? r.building + ' · ' + r.floor : '—') +
      detailItem('Date & time', fmtDay(s) + ' · ' + fmtRange(s, e) + extra, true) +
      detailItem('Expected attendance', b.attendance) + detailItem('Capacity', r && r.cap != null ? r.cap : 'Not provided') +
      detailItem('Organizer', b.organizer) + detailItem('Department', b.dept) +
      detailItem('Contact', b.contact) + detailItem('Approval authority', r ? approverFor(r) : '—') +
      detailItem('Required facilities', b.facilities.length ? b.facilities.join(', ') : 'None', true) +
      detailItem('Related event', relEv || 'None') + detailItem('Submitted', b.submittedAt ? fmtStamp(b.submittedAt) : 'Not submitted') +
      detailItem('Additional notes', b.notes || 'None', true) + '</div>';

    if (b.history.length) {
      body += '<div><div class="detail-item"><small>Status history</small></div><ul class="history-list">' +
        b.history.slice().reverse().map(function (h) { return '<li>' + esc(h.text) + '<small>' + esc(fmtStamp(h.ts)) + '</small></li>'; }).join('') + '</ul></div>';
    }
    $('detailsBody').innerHTML = body;

    // ---- Footer
    var f = '';
    function btn(act, label, cls) { return '<button class="btn ' + (cls || 'btn-outline') + '" data-dact="' + act + '">' + label + '</button>'; }

    // Approver panel (real approvers; never for your own request)
    var needsDecision = !isMine(b) && (b.status === 'Pending Approval' || (b.status === 'Confirmed' && b.cancellationRequested));
    if (canApprove() && needsDecision && r) {
      var w = win(b), bl = blockers(r, w.s, w.e, b.id), pend = pendingOverlaps(r, w.s, w.e, b.id);
      var conf = bl.length
        ? '<div class="conf">❌ Conflicts: ' + esc(bl.map(describeItem).join('; ')) + '</div>'
        : '<div class="conf">✅ No conflicting reservations. ' + (r.cap != null && b.attendance > r.cap ? '⚠ Attendance exceeds capacity. ' : '') + (r.cap == null ? '⚠ Capacity has not been provided. ' : '') + (pend.length ? '⚠ ' + pend.length + ' other pending request(s) overlap.' : '') + '</div>';
      f += '<div class="approver-box"><small>Approver review · ' + esc(approverFor(r)) + '</small>' + conf +
        '<textarea id="decisionNote" class="input" placeholder="Decision note (required to reject or request changes)"></textarea><div class="action-row">';
      if (b.cancellationRequested) f += btn('a-cancel-ok', 'Approve Cancellation', 'btn-primary') + btn('a-cancel-no', 'Keep Booking');
      else f += btn('a-approve', 'Approve', 'btn-primary') + btn('a-changes', 'Request Changes') + btn('a-reject', 'Reject', 'btn-danger');
      f += '</div></div>';
    }

    f += '<div class="action-row">';
    if (isMine(b)) {
      if (b.status === 'Draft') f += btn('edit', '✏️ Edit') + btn('submit', 'Submit', 'btn-primary') + btn('delete', '🗑 Delete Draft', 'btn-danger');
      if (b.status === 'Changes Requested') f += btn('edit', '✏️ Edit') + btn('submit', 'Resubmit', 'btn-primary');
      if (b.status === 'Pending Approval') f += btn('withdraw', 'Withdraw Request', 'btn-danger');
      if (b.status === 'Confirmed' && !b.cancellationRequested) f += btn('reqcancel', 'Request Cancellation', 'btn-danger');
      if (b.status === 'Rejected') f += btn('newfrom', 'Create New Request', 'btn-primary');
    }
    if (r) f += btn('room', '🏫 View Room');
    if (b.relatedEvent) f += btn('event', '🗓 View Event');
    f += '</div>';

    $('detailsFooter').innerHTML = f;
  }

  $('detailsFooter').addEventListener('click', function (evt) {
    var btn = evt.target.closest('[data-dact]');
    if (!btn) return;
    var b = findBooking(state.detailsId);
    if (!b) return;
    var act = btn.dataset.dact, id = b.id, ok = false;
    var noteEl = $('decisionNote'), note = noteEl ? noteEl.value.trim() : '';

    if (act === 'edit') { closeDetails(); openBooking(null, b); return; }
    if (act === 'submit') { closeDetails(); bookingAction('submit', id); return; }
    if (act === 'delete') { deleteDraft(b); return; }
    if (act === 'withdraw') { withdraw(b); return; }
    if (act === 'reqcancel') { requestCancellation(b); return; }
    if (act === 'newfrom') { closeDetails(); bookingAction('newfrom', id); return; }
    if (act === 'room') { closeDetails(); openRoom(b.roomId); return; }
    if (act === 'event') { window.location.href = '../events/events.html'; return; }

    if (act === 'a-approve') ok = decide(id, 'approve', user.name + ' (approver)', note);
    else if (act === 'a-reject' || act === 'a-changes') {
      if (!note) { toast('Please add a decision note first.'); return; }
      ok = decide(id, act === 'a-reject' ? 'reject' : 'changes', user.name + ' (approver)', note);
    }
    else if (act === 'a-cancel-ok') ok = decide(id, 'cancel-ok', user.name + ' (approver)', note);
    else if (act === 'a-cancel-no') ok = decide(id, 'cancel-no', user.name + ' (approver)', note);
    if (ok) toast('Decision recorded.');
    renderAll();
    var fresh = findBooking(id);
    if (fresh) renderDetails(fresh);
  });

  /* =====================================================
     Refresh when returning to this tab (picks up Events page changes)
  ===================================================== */
  window.addEventListener('focus', function () {
    if (bookingModal.classList.contains('show') || detailsModal.classList.contains('show') || roomModal.classList.contains('show')) return;
    reloadData();
    renderAll();
  });

  /* =====================================================
     Init
  ===================================================== */
  renderAll();
  if (pageParams.get('action') === 'request') openBooking({});
  var reviewBookingId = Number(pageParams.get('booking'));
  if (Number.isInteger(reviewBookingId) && reviewBookingId > 0) openDetails(reviewBookingId);
})();