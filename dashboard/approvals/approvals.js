(function () {
  'use strict';

  var STORE_KEY = 'campussync_rooms_v1';
  var ROOMS = Object.create(null);
  window.CAMPUS_ROOM_DIRECTORY.forEach(function (entry, index) {
    ROOMS[1001 + index] = {
      name: entry.code + ' — ' + entry.facility,
      building: entry.building,
      verification: entry.verification
    };
  });
  var queue = document.getElementById('approvalQueue');
  var search = document.getElementById('approvalSearchInput');
  var sort = document.getElementById('approvalSort');
  var filter = 'all';
  var searchTerm = '';
  var bookings = [];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function dateValue(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  function formatDate(value) {
    var date = dateValue(value);
    return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
  }
  function formatTime(value) {
    var date = dateValue(value);
    return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  }
  function formatSubmitted(value) {
    var date = dateValue(value);
    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Submission date unavailable';
  }
  function needsReview(booking) {
    return booking.status === 'Pending Approval' ||
      (booking.status === 'Confirmed' && booking.cancellationRequested === true);
  }
  function loadBookings() {
    var stored;
    try {
      stored = localStorage.getItem(STORE_KEY);
      if (!stored) {
        bookings = [];
        return true;
      }
      var parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.bookings)) throw new Error('Booking data is not in the expected format.');
      bookings = parsed.bookings.filter(needsReview);
      return true;
    } catch (error) {
      queue.innerHTML = '<div class="approval-error">Could not load approval requests: ' + esc(error.message) + '</div>';
      return false;
    }
  }
  function sortBookings(items) {
    var sorted = items.slice();
    sorted.sort(function (a, b) {
      if (sort.value === 'date') return (dateValue(a.start) || 0) - (dateValue(b.start) || 0);
      var aSubmitted = dateValue(a.submittedAt) || 0;
      var bSubmitted = dateValue(b.submittedAt) || 0;
      return sort.value === 'oldest' ? aSubmitted - bSubmitted : bSubmitted - aSubmitted;
    });
    return sorted;
  }
  function renderStats() {
    var pending = bookings.filter(function (booking) { return booking.status === 'Pending Approval'; }).length;
    var cancellations = bookings.filter(function (booking) { return booking.status === 'Confirmed' && booking.cancellationRequested; }).length;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('cancellationCount').textContent = cancellations;
    document.getElementById('totalCount').textContent = bookings.length;
    document.getElementById('allTabCount').textContent = bookings.length;
    document.getElementById('pendingTabCount').textContent = pending;
    document.getElementById('cancellationTabCount').textContent = cancellations;
  }
  function renderQueue() {
    if (!loadBookings()) return;
    renderStats();

    var visible = bookings.filter(function (booking) {
      if (filter === 'pending' && booking.status !== 'Pending Approval') return false;
      if (filter === 'cancellation' && !(booking.status === 'Confirmed' && booking.cancellationRequested)) return false;
      if (!searchTerm) return true;
      var room = ROOMS[booking.roomId] || {};
      return [booking.ref, booking.title, booking.organizer, booking.contact, booking.dept, room.name, room.building]
        .join(' ').toLowerCase().indexOf(searchTerm) !== -1;
    });
    visible = sortBookings(visible);

    if (!visible.length) {
      var noRequests = bookings.length === 0;
      queue.innerHTML = '<div class="approval-empty"><strong>' +
        (noRequests ? 'You’re all caught up' : 'No matching requests') + '</strong>' +
        (noRequests
          ? 'There are no pending room approvals in this browser. Submitted requests will appear here.'
          : 'Try a different filter or search term.') + '</div>';
      return;
    }

    queue.innerHTML = visible.map(function (booking) {
      var room = ROOMS[booking.roomId] || { name: 'Room unavailable', building: '' };
      var cancellation = booking.status === 'Confirmed' && booking.cancellationRequested;
      var from = formatTime(booking.start), to = formatTime(booking.end);
      var time = from && to ? from + ' – ' + to : 'Time unavailable';
      var reviewUrl = '../rooms/room-booking.html?tab=requests&amp;booking=' +
        encodeURIComponent(booking.id);
      return '<article class="approval-item">' +
        '<div class="approval-item-main">' +
          '<div class="approval-item-top">' +
            '<span class="approval-ref">' + esc(booking.ref || 'ROOM REQUEST') + '</span>' +
            '<span class="approval-label' + (cancellation ? ' cancellation' : '') + '">' +
              (cancellation ? 'Cancellation requested' : 'Pending review') + '</span>' +
          '</div>' +
          '<h3 class="approval-title">' + esc(booking.title || 'Untitled booking') + '</h3>' +
          '<div class="approval-meta">' +
            '<span>👤 ' + esc(booking.organizer || 'Requester unavailable') + '</span>' +
            '<span>🏢 ' + esc(booking.dept || 'Department unavailable') + '</span>' +
            '<span>📅 ' + esc(formatDate(booking.start)) + ' · ' + esc(time) + '</span>' +
            '<span>Submitted ' + esc(formatSubmitted(booking.submittedAt)) + '</span>' +
          '</div>' +
          '<div class="approval-room">🏫 ' + esc(room.name) +
            (room.building ? ' · ' + esc(room.building) : '') +
            ' · ' + esc(booking.attendance == null ? '—' : booking.attendance) + ' attendees' +
            (room.verification ? ' · ' + esc(room.verification) : '') + '</div>' +
        '</div>' +
        '<div class="approval-item-action"><a class="btn btn-primary btn-sm-x" href="' + reviewUrl + '">Review request</a></div>' +
      '</article>';
    }).join('');
  }

  document.querySelectorAll('[data-approval-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      filter = button.dataset.approvalFilter;
      document.querySelectorAll('[data-approval-filter]').forEach(function (item) {
        var active = item === button;
        item.classList.toggle('on', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderQueue();
    });
  });
  search.addEventListener('input', function () {
    searchTerm = search.value.trim().toLowerCase();
    renderQueue();
  });
  sort.addEventListener('change', renderQueue);
  document.getElementById('notifBell').addEventListener('click', function () {
    filter = 'pending';
    document.querySelector('[data-approval-filter="pending"]').click();
    document.getElementById('queueTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('focus', renderQueue);
  window.addEventListener('storage', function (event) {
    if (event.key === STORE_KEY) renderQueue();
  });

  renderQueue();
})();
