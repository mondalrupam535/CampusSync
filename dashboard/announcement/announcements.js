(function () {
  'use strict';

  /* ---------- Data ---------- */
  // status: Published | Pending Approval | Draft
  // needsAction: true when the current user must acknowledge the notice
  var announcements = [];

  var STORAGE_KEY = 'campussync_announcements_v1';
  try {
    var savedAnnouncements = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(savedAnnouncements)) announcements = savedAnnouncements;
  } catch (e) {}

  function saveAnnouncements() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(announcements)); } catch (e) {}
    window.CampusSyncAPI.saveWorkspace('announcements', announcements);
  }

  var DEPARTMENTS = window.CAMPUS_DEPARTMENTS.all;
  var RECIPIENT_DEPARTMENTS = ['University-wide'].concat(DEPARTMENTS);
  var AI_ASSISTANT_URL = '/assistant-chat';
  var aiDepartments = [];
  var originalDepartments = '';
  var aiOptimized = false;

  var currentActiveId = null;
  var editingId = null;
  var currentFilter = 'all';
  var searchTerm = '';

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentUser() {
    var personal = {};
    var profile = {};
    try { personal = JSON.parse(localStorage.getItem('onboarding.personal') || '{}'); } catch (e) {}
    try { profile = JSON.parse(localStorage.getItem('onboarding.profile') || '{}'); } catch (e) {}
    var name = profile.name || [personal.first, personal.last].filter(Boolean).join(' ') || 'CampusSync User';
    var parts = name.trim().split(/\s+/);
    return {
      name: name,
      initials: ((parts[0] || 'C')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : 'U')).toUpperCase()
    };
  }

  function nextId() {
    return announcements.reduce(function (max, a) { return Math.max(max, a.id); }, 0) + 1;
  }

  function findById(id) {
    return announcements.find(function (a) { return a.id === id; });
  }

  function getStatusBadgeClass(status) {
    if (status === 'Published') return 'badge-mint';
    if (status === 'Pending Approval') return 'badge-orange';
    return 'badge-time';
  }

  function getPriorityBadgeClass(priority) {
    if (priority === 'Urgent') return 'badge-red';
    if (priority === 'Important') return 'badge-orange';
    return 'badge-time';
  }

  function matchesFilter(ann, filter) {
    if (filter === 'published') return ann.status === 'Published';
    if (filter === 'pending') return ann.status === 'Pending Approval';
    if (filter === 'draft') return ann.status === 'Draft';
    if (filter === 'action') return ann.needsAction;
    return true;
  }

  function matchesSearch(ann, term) {
    if (!term) return true;
    var hay = (ann.title + ' ' + ann.issuer + ' ' + ann.dept + ' ' + ann.body + ' ' + ann.category).toLowerCase();
    return hay.indexOf(term) !== -1;
  }

  /* ---------- Stats ---------- */
  function updateCounts() {
    var live = announcements.filter(function (a) { return !a.archived; });
    $('countPublished').textContent = live.filter(function (a) { return a.status === 'Published'; }).length;
    $('countPending').textContent = live.filter(function (a) { return a.status === 'Pending Approval'; }).length;
    $('countDrafts').textContent = live.filter(function (a) { return a.status === 'Draft'; }).length;
    $('countAction').textContent = live.filter(function (a) { return a.needsAction; }).length;
  }

  /* ---------- List ---------- */
  function renderAnnouncementList() {
    var container = $('announcementListContainer');
    container.innerHTML = '';

    var filtered = announcements.filter(function (ann) {
      return !ann.archived && matchesFilter(ann, currentFilter) && matchesSearch(ann, searchTerm);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="list-empty">No announcements found.</div>';
      return;
    }

    filtered.forEach(function (ann) {
      var item = document.createElement('div');
      item.className = 'announcement-item' + (ann.id === currentActiveId ? ' active' : '');
      item.innerHTML =
        '<div class="ann-item-head">' +
          '<span>' + esc(ann.dept) + '</span>' +
          '<span>' + esc(ann.date) + '</span>' +
        '</div>' +
        '<div class="ann-item-title">' + esc(ann.title) + '</div>' +
        '<div class="ann-item-badges">' +
          '<span class="badge ' + getStatusBadgeClass(ann.status) + '">' + esc(ann.status) + '</span>' +
          (ann.needsAction ? '<span class="badge badge-orange">Action Required</span>' : '') +
          '<span class="tag tag-mint">' + esc(ann.category) + '</span>' +
        '</div>';
      item.addEventListener('click', function () { openAnnouncement(ann.id); });
      container.appendChild(item);
    });
  }

  /* ---------- Reader ---------- */
  function showEmptyReader() {
    currentActiveId = null;
    $('announcementEmptyState').style.display = '';
    $('announcementReaderContent').style.display = 'none';
  }

  function openAnnouncement(id) {
    var ann = findById(id);
    if (!ann) return;
    currentActiveId = id;
    renderAnnouncementList();

    $('announcementEmptyState').style.display = 'none';
    $('announcementReaderContent').style.display = 'block';

    $('readerAnnTitle').textContent = ann.title;
    var statusEl = $('readerAnnStatus');
    statusEl.textContent = ann.status;
    statusEl.className = 'badge ' + getStatusBadgeClass(ann.status);

    $('readerAnnAv').textContent = ann.initials;
    $('readerAnnIssuer').textContent = ann.issuer;
    $('readerAnnMeta').textContent = ann.dept + ' • ' + ann.date;
    $('readerAnnBody').textContent = ann.body;

    $('readerAnnBadges').innerHTML =
      '<span class="tag tag-mint">' + esc(ann.category) + '</span>' +
      '<span class="badge ' + getPriorityBadgeClass(ann.priority) + '">Priority: ' + esc(ann.priority) + '</span>' +
      (ann.ackRequired ? '<span class="badge badge-time">Acknowledgement required</span>' : '');

    var attEl = $('readerAnnAttachment');
    if (ann.attachment) {
      attEl.textContent = '📎 ' + ann.attachment;
      attEl.style.display = 'block';
    } else {
      attEl.style.display = 'none';
    }

    $('statTotalRecipients').textContent = 'Not tracked';
    $('statDelivered').textContent = 'Not tracked';
    $('statRead').textContent = 'Not tracked';
    $('statAcknowledged').textContent = 'Not tracked';

    $('announcementActionBox').style.display = (ann.needsAction && ann.ackRequired) ? 'block' : 'none';
  }

  /* ---------- Filters, stat cards, search ---------- */
  var filterTabs = document.querySelectorAll('.filter-tab');

  function setFilter(filter) {
    currentFilter = filter;
    filterTabs.forEach(function (t) { t.classList.toggle('on', t.dataset.filter === filter); });
    renderAnnouncementList();
  }

  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () { setFilter(tab.dataset.filter); });
  });

  document.querySelectorAll('.stat-card').forEach(function (card) {
    card.addEventListener('click', function () { setFilter(card.dataset.statFilter); });
  });

  $('announcementsSearchInput').addEventListener('input', function (e) {
    searchTerm = e.target.value.trim().toLowerCase();
    renderAnnouncementList();
  });

  /* ---------- Acknowledge ---------- */
  $('acknowledgeNoticeBtn').addEventListener('click', function () {
    var ann = findById(currentActiveId);
    if (!ann || !ann.needsAction) return;
    ann.needsAction = false;
    saveAnnouncements();
    updateCounts();
    openAnnouncement(ann.id);
    alert('Notice successfully acknowledged!');
  });

  /* ---------- Toolbar: Edit / Withdraw / Archive ---------- */
  $('editNoticeBtn').addEventListener('click', function () {
    var ann = findById(currentActiveId);
    if (ann) openModal(ann);
  });

  $('withdrawNoticeBtn').addEventListener('click', function () {
    var ann = findById(currentActiveId);
    if (!ann) return;
    if (ann.status === 'Draft') {
      alert('This notice is already a draft.');
      return;
    }
    if (!confirm('Withdraw "' + ann.title + '"? It will move back to Drafts.')) return;
    ann.status = 'Draft';
    ann.needsAction = false;
    saveAnnouncements();
    updateCounts();
    openAnnouncement(ann.id);
  });

  $('archiveNoticeBtn').addEventListener('click', function () {
    var ann = findById(currentActiveId);
    if (!ann) return;
    if (!confirm('Archive "' + ann.title + '"? It will be hidden from this list.')) return;
    ann.archived = true;
    saveAnnouncements();
    updateCounts();
    showEmptyReader();
    renderAnnouncementList();
  });

  /* ---------- Modal ---------- */
  var createModal = $('createAnnouncementModal');

  function setAiStatus(message, isError) {
    var status = $('aiAnnouncementStatus');
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function parseAnnouncementResponse(reply) {
    var normalized = reply.replace(/```[\w-]*\s*/g, '').replace(/```/g, '').trim();
    var sections = normalized.match(
      /Optimized title\s*:\s*([\s\S]*?)\s*(?:\r?\n)+Optimized announcement\s*:\s*([\s\S]*?)\s*(?:\r?\n)+(?:Relevant\s+)?Departments\s*:\s*([\s\S]+)/i
    );
    if (!sections) {
      throw new Error('The assistant returned an unexpected format. Please try again.');
    }

    var title = sections[1].trim();
    var content = sections[2].trim();
    var departments = sections[3].split(/[;|,\r\n]/).map(function (department) {
      return department.replace(/^[\s*•\-\d.]+/, '').trim();
    }).filter(Boolean);

    if (!title || !content || departments.length === 0) {
      throw new Error('The assistant did not provide a complete announcement and department list.');
    }

    var unknownDepartments = departments.filter(function (department) {
      return RECIPIENT_DEPARTMENTS.indexOf(department) === -1;
    });
    if (unknownDepartments.length) {
      throw new Error('The assistant suggested an unsupported department. Please try again.');
    }

    if (departments.indexOf('University-wide') !== -1) departments = ['University-wide'];
    departments = departments.filter(function (department, index) {
      return departments.indexOf(department) === index;
    });
    return { title: title, content: content, departments: departments };
  }

  function renderAiDepartments() {
    var container = $('aiDepartmentResults');
    container.replaceChildren();
    aiDepartments.forEach(function (department) {
      var chip = document.createElement('span');
      chip.className = 'ai-department-chip';
      chip.textContent = department;
      container.appendChild(chip);
    });
    container.hidden = aiDepartments.length === 0;
  }

  function invalidateAiResult() {
    aiOptimized = false;
    aiDepartments = [];
    renderAiDepartments();
    setAiStatus('Your message changed. Run AI again to refresh the optimized text and department selection.', false);
  }

  async function optimizeAnnouncementForForm() {
    var title = $('createTitle').value.trim();
    var content = $('createContent').value.trim();
    if (!content) {
      setAiStatus('Write the announcement content before using AI.', true);
      $('createContent').focus();
      return false;
    }

    var button = $('optimizeAnnouncementBtn');
    button.disabled = true;
    setAiStatus('Gemini is improving your announcement; the router and AI will refine the recipient departments...', false);

    var prompt = 'Title: ' + (title || '(none)') + '\n\nAnnouncement:\n' + content;

    try {
      var data = await window.CampusSyncAPI.request(AI_ASSISTANT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, page: 'announcement-composer' })
      });

      // Prefer structured response fields (returned by updated backend)
      var result;
      if (data && typeof data.subject === 'string' && typeof data.content === 'string' &&
          Array.isArray(data.departments) && data.departments.length > 0) {
        result = {
          title: data.subject.trim(),
          content: data.content.trim(),
          departments: data.departments.filter(function (d) {
            return typeof d === 'string' && RECIPIENT_DEPARTMENTS.indexOf(d) !== -1;
          })
        };
        if (!result.title || !result.content || result.departments.length === 0) {
          throw new Error('The assistant returned incomplete details. Please try again.');
        }
      } else {
        // Legacy fallback: parse the text reply
        if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
          throw new Error('Gemini returned an empty response.');
        }
        result = parseAnnouncementResponse(data.reply);
      }

      $('createTitle').value = result.title;
      $('createContent').value = result.content;
      aiDepartments = result.departments;
      if (aiDepartments.indexOf('University-wide') !== -1) aiDepartments = ['University-wide'];
      originalDepartments = '';
      aiOptimized = true;
      renderAiDepartments();
      setAiStatus('Announcement improved. AI reviewed the router suggestions and selected these departments.', false);
      return true;
    } catch (error) {
      setAiStatus('Could not prepare the announcement. ' + error.message, true);
      return false;
    } finally {
      button.disabled = false;
    }
  }

  $('optimizeAnnouncementBtn').addEventListener('click', optimizeAnnouncementForForm);
  $('createTitle').addEventListener('input', invalidateAiResult);
  $('createContent').addEventListener('input', invalidateAiResult);

  function resetForm() {
    $('createTitle').value = '';
    $('createPriority').value = 'Normal';
    $('createSchedule').value = '';
    $('createContent').value = '';
    $('createAttachment').value = '';
    $('createAckRequired').checked = false;
    aiDepartments = [];
    originalDepartments = '';
    aiOptimized = false;
    renderAiDepartments();
    setAiStatus('Write your announcement, then AI will polish it and refine the router’s department suggestions.', false);
  }

  function openModal(ann) {
    resetForm();
    if (ann) {
      editingId = ann.id;
      $('modalHeading').textContent = 'Edit Announcement';
      $('createTitle').value = ann.title;
      $('createContent').value = ann.body;
      $('createPriority').value = ann.priority;
      $('createAckRequired').checked = ann.ackRequired;
      originalDepartments = ann.dept || '';
      setAiStatus('Existing recipients are saved. Run AI to refresh the message and refine department suggestions.', false);
    } else {
      editingId = null;
      $('modalHeading').textContent = 'Create Official Announcement';
    }
    createModal.classList.add('show');
  }

  function closeModal() {
    createModal.classList.remove('show');
    editingId = null;
  }

  $('openCreateModalBtn').addEventListener('click', function () { openModal(null); });
  $('closeCreateModalBtn').addEventListener('click', closeModal);
  createModal.addEventListener('click', function (e) {
    if (e.target === createModal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && createModal.classList.contains('show')) closeModal();
  });

  function readForm() {
    var recipients = aiDepartments.length ? aiDepartments.join('; ') : (originalDepartments || 'AI selection pending');
    var file = $('createAttachment').files && $('createAttachment').files[0];
    var schedule = $('createSchedule').value;
    var dateLabel = 'Just now';
    if (schedule) {
      var d = new Date(schedule);
      if (!isNaN(d.getTime())) {
        dateLabel = 'Scheduled: ' + d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
    }
    return {
      title: $('createTitle').value.trim(),
      content: $('createContent').value.trim(),
      dept: recipients,
      priority: $('createPriority').value,
      ackRequired: $('createAckRequired').checked,
      attachment: file ? file.name : '',
      dateLabel: dateLabel,
      recipientsCount: null
    };
  }

  function saveFromForm(status) {
    var f = readForm();
    var user = getCurrentUser();
    var ann = editingId ? findById(editingId) : null;

    if (ann) {
      ann.title = f.title;
      ann.body = f.content;
      ann.dept = f.dept;
      ann.priority = f.priority;
      ann.ackRequired = f.ackRequired;
      ann.status = status;
      ann.totalRecipients = f.recipientsCount;
      ann.date = f.dateLabel;
      if (f.attachment) ann.attachment = f.attachment;
    } else {
      ann = {
        id: nextId(),
        title: f.title,
        dept: f.dept,
        issuer: user.name,
        initials: user.initials,
        date: f.dateLabel,
        status: status,
        needsAction: false,
        archived: false,
        category: f.dept === 'University-wide' ? 'University' : 'Department',
        priority: f.priority,
        ackRequired: f.ackRequired,
        attachment: f.attachment,
        body: f.content,
        totalRecipients: f.recipientsCount,
        delivered: null,
        read: null,
        acknowledged: null
      };
      announcements.unshift(ann);
    }
    return ann;
  }

  $('saveAnnouncementDraftBtn').addEventListener('click', function () {
    if (!$('createTitle').value.trim()) {
      alert('Please add a title before saving a draft.');
      return;
    }
    var ann = saveFromForm('Draft');
    saveAnnouncements();
    closeModal();
    updateCounts();
    setFilter('all');
    openAnnouncement(ann.id);
  });

  $('previewAnnouncementBtn').addEventListener('click', function () {
    var f = readForm();
    alert(
      'PREVIEW\n\n' +
      (f.title || 'Untitled Notice') + '\n' +
      'To: ' + f.dept + '  |  Priority: ' + f.priority + '\n\n' +
      (f.content || '(no content yet)')
    );
  });

  $('submitAnnouncementBtn').addEventListener('click', function () {
    var f = readForm();
    if (!aiOptimized) {
      setAiStatus('Optimize the announcement first so AI can improve the message and select its departments.', true);
      $('optimizeAnnouncementBtn').focus();
      return;
    }
    if (!f.title || !f.content || !aiDepartments.length) {
      alert('Please generate a complete announcement and department selection with AI first.');
      return;
    }
    var ann = saveFromForm('Pending Approval');
    saveAnnouncements();
    closeModal();
    updateCounts();
    setFilter('all');
    openAnnouncement(ann.id);
    alert('Announcement submitted successfully for approval!');
  });

  /* ---------- Init ---------- */
  var params = new URLSearchParams(window.location.search);
  if (params.get('search')) {
    $('announcementsSearchInput').value = params.get('search');
    searchTerm = params.get('search').trim().toLowerCase();
  }
  if (params.get('filter') === 'action') setFilter('action');
  $('notifBell').addEventListener('click', function () { setFilter('action'); });
  updateCounts();
  renderAnnouncementList();
  saveAnnouncements();
  if (params.get('action') === 'create') openModal(null);
})();