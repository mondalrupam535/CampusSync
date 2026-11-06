(function () {
  var messages = [];

  var STORAGE_KEY = 'campussync_inbox_v1';
  var savedMessages = null;
  try { savedMessages = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) {}
  if (Array.isArray(savedMessages)) messages = savedMessages;
  messages.forEach(function (msg) {
    if (!msg.folder) msg.folder = 'inbox';
  });

  function saveMessages() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) {}
    window.CampusSyncAPI.saveWorkspace('inbox', messages);
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var currentActiveId = null;
  var currentFilter = 'all';
  var currentFolder = 'inbox';
  var searchTerm = '';

  // Filter tabs handling
  var filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filterTabs.forEach(function (t) { t.classList.remove('on'); });
      tab.classList.add('on');
      currentFilter = tab.dataset.filter;
      renderMessageList();
    });
  });

  function renderMessageList() {
    var container = document.getElementById('messageListContainer');
    container.innerHTML = '';

    var filtered = messages.filter(function (msg) {
      if (msg.folder !== currentFolder) return false;
      if (currentFilter === 'unread' && !msg.unread) return false;
      if (currentFilter === 'important' && !msg.important) return false;
      if (currentFilter === 'action' && !msg.actionReq) return false;
      if (!searchTerm) return true;
      return [msg.sender, msg.senderName, msg.subject, msg.snippet, msg.body]
        .join(' ').toLowerCase().indexOf(searchTerm) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No messages found in this view.</div>';
      return;
    }

    filtered.forEach(function (msg) {
      var item = document.createElement('div');
      item.className = 'message-item' + (msg.unread ? ' unread' : '') + (msg.id === currentActiveId ? ' active' : '');
      item.innerHTML = `
        <div class="msg-item-head">
          <strong>${esc(msg.sender)}</strong>
          <span class="msg-time">${esc(msg.time)}</span>
        </div>
        <div class="msg-item-subject">${esc(msg.subject)}</div>
        <div class="msg-item-snippet">${esc(msg.snippet)}</div>
        <div class="msg-item-badges">
          ${msg.actionReq ? '<span class="badge badge-orange">Action Required</span>' : ''}
          ${msg.unread ? '<span class="badge badge-mint">Unread</span>' : '<span class="badge badge-time">Read</span>'}
          ${msg.hasAttachment ? '<span class="badge badge-file">📎 Attachment</span>' : ''}
        </div>
      `;
      item.addEventListener('click', function () {
        openMessage(msg.id);
      });
      container.appendChild(item);
    });
  }

  function openMessage(id) {
    currentActiveId = id;
    var msg = messages.find(function (m) { return m.id === id; });
    if (!msg) return;

    // Mark as read
    msg.unread = false;
    if (msg.folder === 'inbox' && typeof msg.id === 'string' && msg.id.indexOf('-') !== -1) {
      window.CampusSyncAPI.request('/api/messages/' + encodeURIComponent(msg.id) + '/read', { method: 'PUT' })
        .catch(window.CampusSyncAPI.reportError);
    }
    updateUnreadCount();
    saveMessages();
    renderMessageList();

    // Show reader content
    document.getElementById('readerEmptyState').style.display = 'none';
    document.getElementById('readerContentWrap').style.display = 'block';

    document.getElementById('readerSubject').textContent = msg.subject;
    document.getElementById('readerSenderAv').textContent = msg.initials;
    document.getElementById('readerSenderName').textContent = msg.senderName;
    document.getElementById('readerSenderMeta').textContent = msg.senderMeta;
    document.getElementById('readerTime').textContent = msg.time;
    document.getElementById('readerBodyText').innerHTML = msg.body;
    document.getElementById('starBtn').textContent = msg.important ? '⭐ Starred' : '⭐ Star';
    document.getElementById('markUnreadBtn').textContent = msg.unread ? '✉️ Mark Read' : '✉️ Mark Unread';

    // Attachments
    var attBox = document.getElementById('readerAttachments');
    if (msg.hasAttachment) {
      attBox.style.display = 'block';
      attBox.querySelector('span').textContent = '📄 ' + msg.attachmentName;
    } else {
      attBox.style.display = 'none';
    }

    // Action box
    var actionBox = document.getElementById('readerActionBox');
    if (msg.actionReq) {
      actionBox.style.display = 'block';
    } else {
      actionBox.style.display = 'none';
    }

    // Hide reply box initially
    document.getElementById('replyBoxWrap').style.display = 'none';
  }

  function updateUnreadCount() {
    var unreadCount = messages.filter(function (m) { return m.folder === 'inbox' && m.unread; }).length;
    document.getElementById('unreadCountBadge').textContent = unreadCount + ' unread';
  }

  var searchInput = document.getElementById('inboxSearchInput');
  searchInput.addEventListener('input', function () {
    searchTerm = searchInput.value.trim().toLowerCase();
    renderMessageList();
  });

  document.getElementById('folderSelect').addEventListener('change', function (event) {
    currentFolder = event.target.value;
    renderMessageList();
  });

  document.getElementById('notifBell').addEventListener('click', function () {
    document.getElementById('folderSelect').value = 'inbox';
    currentFolder = 'inbox';
    currentFilter = 'unread';
    filterTabs.forEach(function (tab) { tab.classList.toggle('on', tab.dataset.filter === currentFilter); });
    renderMessageList();
  });

  // Action buttons inside reader
  document.getElementById('acknowledgeBtn').addEventListener('click', function () {
    var msg = messages.find(m => m.id === currentActiveId);
    if (!msg) return;
    msg.actionReq = false;
    saveMessages();
    alert('Attendance successfully acknowledged and confirmed to ' + msg.sender + '!');
    document.getElementById('readerActionBox').style.display = 'none';
    renderMessageList();
  });

  document.getElementById('completeActionBtn').addEventListener('click', function () {
    var msg = messages.find(function (item) { return item.id === currentActiveId; });
    if (msg) msg.actionReq = false;
    saveMessages();
    alert('Task marked as completed.');
    document.getElementById('readerActionBox').style.display = 'none';
    renderMessageList();
  });

  document.getElementById('starBtn').addEventListener('click', function () {
    var msg = messages.find(function (item) { return item.id === currentActiveId; });
    if (!msg) return;
    msg.important = !msg.important;
    saveMessages();
    document.getElementById('starBtn').textContent = msg.important ? '⭐ Starred' : '⭐ Star';
    renderMessageList();
  });

  document.getElementById('archiveBtn').addEventListener('click', function () {
    var msg = messages.find(function (item) { return item.id === currentActiveId; });
    if (!msg) return;
    msg.folder = 'archived';
    saveMessages();
    updateUnreadCount();
    document.getElementById('readerContentWrap').style.display = 'none';
    document.getElementById('readerEmptyState').style.display = '';
    currentActiveId = null;
    renderMessageList();
  });

  document.getElementById('markUnreadBtn').addEventListener('click', function () {
    var msg = messages.find(function (item) { return item.id === currentActiveId; });
    if (!msg) return;
    msg.unread = !msg.unread;
    if (msg.folder === 'inbox' && typeof msg.id === 'string' && msg.id.indexOf('-') !== -1) {
      window.CampusSyncAPI.request('/api/messages/' + encodeURIComponent(msg.id) + (msg.unread ? '/unread' : '/read'), { method: 'PUT' })
        .catch(window.CampusSyncAPI.reportError);
    }
    saveMessages();
    updateUnreadCount();
    document.getElementById('markUnreadBtn').textContent = msg.unread ? '✉️ Mark Read' : '✉️ Mark Unread';
    renderMessageList();
  });

  // Reply toggle
  document.getElementById('replyBtn').addEventListener('click', function () {
    var replyWrap = document.getElementById('replyBoxWrap');
    var msg = messages.find(function (m) { return m.id === currentActiveId; });
    if (msg) {
      document.getElementById('replyRecipientName').textContent = msg.sender;
    }
    replyWrap.style.display = replyWrap.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('cancelReplyBtn').addEventListener('click', function () {
    document.getElementById('replyBoxWrap').style.display = 'none';
  });

  document.getElementById('sendReplyBtn').addEventListener('click', function () {
    var text = document.getElementById('replyTextarea').value.trim();
    if (!text) {
      alert('Please enter a reply message.');
      return;
    }
    var original = messages.find(function (msg) { return msg.id === currentActiveId; });
    if (!original) return;
    messages.unshift({
      id: Date.now(), sender: 'You', senderName: 'You',
      senderMeta: 'Sent to ' + original.sender, initials: 'YO',
      subject: 'Re: ' + original.subject, snippet: text.slice(0, 100),
      time: 'Just now', unread: false, important: false, actionReq: false,
      body: esc(text).replace(/\n/g, '<br>'), hasAttachment: false, folder: 'sent'
    });
    saveMessages();
    alert('Reply sent successfully!');
    document.getElementById('replyTextarea').value = '';
    document.getElementById('replyBoxWrap').style.display = 'none';
  });

  // Compose Modal Handlers
  var composeModal = document.getElementById('composeModal');
  var inboxAiDepartments = [];
  var inboxAiReady = false;
  var inboxRecipientOptions = window.CAMPUS_DEPARTMENTS.all;
  var selectedContact = null;
  var selectedDepartment = null;
  var composeTo = document.getElementById('composeTo');
  var recipientSuggestions = document.getElementById('recipientSuggestions');
  var contactSearchSequence = 0;

  function contactLabel(contact) {
    return contact.name + ' — ' + contact.department;
  }

  function closeRecipientSuggestions() {
    recipientSuggestions.hidden = true;
    composeTo.setAttribute('aria-expanded', 'false');
    composeTo.removeAttribute('aria-activedescendant');
  }

  async function showRecipientSuggestions(query) {
    var normalizedQuery = query.trim().toLocaleLowerCase();
    var requestSequence = ++contactSearchSequence;
    recipientSuggestions.replaceChildren();
    var people = [];
    var contactSearchFailed = false;
    if (normalizedQuery.length >= 2) {
      try {
        people = await window.CampusSyncAPI.request('/api/contacts?q=' + encodeURIComponent(normalizedQuery));
      } catch (error) {
        contactSearchFailed = true;
        window.CampusSyncAPI.reportError(error);
      }
    }
    if (requestSequence !== contactSearchSequence || composeTo.value.trim().toLocaleLowerCase() !== normalizedQuery) return;

    var departments = inboxRecipientOptions.filter(function (department) {
      return !normalizedQuery || department.toLocaleLowerCase().indexOf(normalizedQuery) !== -1;
    }).slice(0, 8);
    if (!people.length && !departments.length) {
      var empty = document.createElement('div');
      empty.className = 'recipient-suggestion-empty';
      empty.textContent = contactSearchFailed ? 'Could not load people. Try again or choose a department.' : 'No matching people or departments.';
      recipientSuggestions.appendChild(empty);
      recipientSuggestions.hidden = false;
      composeTo.setAttribute('aria-expanded', 'true');
      return;
    }

    people.forEach(function (contact) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'recipient-suggestion';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      var name = document.createElement('span');
      name.className = 'recipient-suggestion-name';
      name.textContent = contact.name;
      var department = document.createElement('span');
      department.className = 'recipient-suggestion-department';
      department.textContent = 'Person' + (contact.department ? ' · ' + contact.department : '');
      option.append(name, department);
      option.addEventListener('click', function () {
        selectedContact = contact;
        selectedDepartment = null;
        inboxAiDepartments = [];
        inboxAiReady = false;
        composeTo.value = contactLabel(contact);
        renderInboxAiDepartments();
        setInboxAiStatus('Personal recipient selected. You can send this message directly or use AI to polish it.', false);
        closeRecipientSuggestions();
      });
      recipientSuggestions.appendChild(option);
    });

    departments.forEach(function (departmentName) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'recipient-suggestion';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      var name = document.createElement('span');
      name.className = 'recipient-suggestion-name';
      name.textContent = departmentName;
      var type = document.createElement('span');
      type.className = 'recipient-suggestion-department';
      type.textContent = 'Department';
      option.append(name, type);
      option.addEventListener('click', function () {
        selectedContact = null;
        selectedDepartment = departmentName;
        inboxAiDepartments = [departmentName];
        inboxAiReady = false;
        composeTo.value = departmentName;
        renderInboxAiDepartments();
        setInboxAiStatus('Department selected. Use AI to polish the message for this recipient.', false);
        closeRecipientSuggestions();
      });
      recipientSuggestions.appendChild(option);
    });

    if (!people.length && contactSearchFailed && departments.length) {
      var hint = document.createElement('div');
      hint.className = 'recipient-suggestion-empty';
      hint.textContent = 'People search is unavailable. Department suggestions are still available.';
      recipientSuggestions.appendChild(hint);
    }
    if (!people.length && !departments.length) {
      closeRecipientSuggestions();
      return;
    }
    recipientSuggestions.hidden = false;
    composeTo.setAttribute('aria-expanded', 'true');
  }

  function setInboxAiStatus(message, isError) {
    var status = document.getElementById('inboxAiStatus');
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function renderInboxAiDepartments() {
    var container = document.getElementById('inboxAiDepartments');
    container.replaceChildren();
    inboxAiDepartments.forEach(function (department) {
      var chip = document.createElement('span');
      chip.className = 'ai-department-chip';
      chip.textContent = department;
      container.appendChild(chip);
    });
    container.hidden = inboxAiDepartments.length === 0;
  }

  function clearInboxAiResult(message, preserveRecipientText) {
    inboxAiReady = false;
    inboxAiDepartments = [];
    if (selectedContact) {
      composeTo.value = contactLabel(selectedContact);
    } else if (selectedDepartment) {
      composeTo.value = selectedDepartment;
    } else if (!preserveRecipientText) {
      composeTo.value = '';
    }
    renderInboxAiDepartments();
    setInboxAiStatus(message, false);
  }

  function resetComposeForm() {
    selectedContact = null;
    selectedDepartment = null;
    composeTo.value = '';
    closeRecipientSuggestions();
    document.getElementById('composeSubject').value = '';
    document.getElementById('composeBody').value = '';
    document.getElementById('composePriority').value = 'normal';
    document.getElementById('composeActionReq').checked = false;
    inboxAiReady = false;
    inboxAiDepartments = [];
    renderInboxAiDepartments();
    setInboxAiStatus('Write your message, then AI will polish it and refine the router’s department suggestions. Choose a person above to send it personally instead.', false);
  }

  function parseInboxAiResponse(reply, personalRecipient) {
    var normalized = reply.replace(/```[\w-]*\s*/g, '').replace(/```/g, '').trim();
    var sections = personalRecipient
      ? normalized.match(/Optimized subject\s*:\s*([\s\S]*?)\s*(?:\r?\n)+Optimized message\s*:\s*([\s\S]+)/i)
      : normalized.match(/Optimized subject\s*:\s*([\s\S]*?)\s*(?:\r?\n)+Optimized message\s*:\s*([\s\S]*?)\s*(?:\r?\n)+(?:Relevant\s+)?Departments\s*:\s*([\s\S]+)/i);
    if (!sections) {
      throw new Error('The assistant returned an unexpected format. Please try again.');
    }

    var subject = sections[1].trim();
    var body = sections[2].trim();
    var departments = personalRecipient ? [] : sections[3].split(/[;|,\r\n]/).map(function (department) {
      return department.replace(/^[\s*•\-\d.]+/, '').trim();
    }).filter(Boolean);

    if (!subject || !body || (!personalRecipient && departments.length === 0)) {
      throw new Error('The assistant did not provide a complete message and department list.');
    }

    var unknownDepartments = departments.filter(function (department) {
      return inboxRecipientOptions.indexOf(department) === -1;
    });
    if (unknownDepartments.length) {
      throw new Error('The assistant suggested an unsupported department. Please try again.');
    }

    departments = departments.filter(function (department, index) {
      return departments.indexOf(department) === index;
    });
    return { subject: subject, body: body, departments: departments };
  }

  async function optimizeInboxMessage() {
    var subject = document.getElementById('composeSubject').value.trim();
    var body = document.getElementById('composeBody').value.trim();
    if (composeTo.value.trim() && !selectedContact && !selectedDepartment && !inboxAiDepartments.length) {
      setInboxAiStatus('Choose a person or department from the suggestions, or clear To to let AI select departments.', true);
      composeTo.focus();
      return;
    }
    if (!body) {
      setInboxAiStatus('Write the message body before using AI.', true);
      document.getElementById('composeBody').focus();
      return;
    }

    var button = document.getElementById('optimizeInboxMessageBtn');
    var subjectInput = document.getElementById('composeSubject');
    var bodyInput = document.getElementById('composeBody');
    var isPersonalRecipient = Boolean(selectedContact);
    inboxAiReady = false;
    inboxAiDepartments = selectedDepartment ? [selectedDepartment] : [];
    if (!isPersonalRecipient && !selectedDepartment) composeTo.value = '';
    renderInboxAiDepartments();
    button.disabled = true;
    subjectInput.disabled = true;
    bodyInput.disabled = true;
    setInboxAiStatus(isPersonalRecipient
      ? 'Gemini is polishing your message for ' + selectedContact.name + '...'
      : selectedDepartment
        ? 'Gemini is polishing your message for ' + selectedDepartment + '...'
        : 'Gemini is formatting your message; the router and AI will refine recipient departments...', false);

    var prompt = 'Subject: ' + (subject || '(none)') + '\n\nMessage:\n' + body;

    // Build sender context from the logged-in user's onboarding profile
    var senderContext = (function () {
      try {
        var _profile = JSON.parse(localStorage.getItem('onboarding.profile') || 'null') || {};
        var _role = JSON.parse(localStorage.getItem('onboarding.role') || 'null') || {};
        var _staff = JSON.parse(localStorage.getItem('onboarding.staff') || 'null') || {};
        var _student = JSON.parse(localStorage.getItem('onboarding.student') || 'null') || {};
        var _category = (_role.category || 'student').toLowerCase();
        var _isStudent = _category === 'student';
        return {
          name: _profile.name || '',
          role: _category,
          designation: _role.designation || (_isStudent ? 'Student' : 'Faculty'),
          department: _role.dept || _student.dept || '',
          employeeId: _staff.employeeId || '',
          programme: _student.programme || '',
          specialization: _student.spec || _role.specialization || ''
        };
      } catch (e) { return {}; }
    }());

    try {
      var data = await window.CampusSyncAPI.request('/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          page: 'inbox-composer',
          recipientType: isPersonalRecipient ? 'person' : 'department',
          recipientDepartments: selectedDepartment ? [selectedDepartment] : [],
          recipientName: selectedContact ? selectedContact.name : '',
          senderContext: senderContext
        })
      });
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Gemini returned an empty response.');
      }

      var result;
      if (typeof data.subject === 'string' && typeof data.content === 'string' &&
          Array.isArray(data.departments)) {
        result = {
          subject: data.subject.trim(),
          body: data.content.trim(),
          departments: data.departments
        };
        if (!result.subject || !result.body ||
            (!isPersonalRecipient && result.departments.length === 0) ||
            result.departments.some(function (department) {
              return typeof department !== 'string' || inboxRecipientOptions.indexOf(department) === -1;
            })) {
          throw new Error('The assistant returned incomplete or unsupported message details.');
        }
      } else {
        result = parseInboxAiResponse(data.reply, isPersonalRecipient);
      }
      document.getElementById('composeSubject').value = result.subject;
      document.getElementById('composeBody').value = result.body;
      inboxAiDepartments = result.departments;
      if (!isPersonalRecipient) composeTo.value = result.departments.join('; ');
      inboxAiReady = isPersonalRecipient || result.departments.length > 0;
      renderInboxAiDepartments();
      setInboxAiStatus(isPersonalRecipient
        ? 'Message improved for ' + selectedContact.name + '.'
        : 'Message improved. AI reviewed the router suggestions and selected these departments.', false);
    } catch (error) {
      clearInboxAiResult('Could not prepare the message. ' + error.message);
    } finally {
      button.disabled = false;
      subjectInput.disabled = false;
      bodyInput.disabled = false;
    }
  }

  document.getElementById('optimizeInboxMessageBtn').addEventListener('click', optimizeInboxMessage);
  document.getElementById('composeSubject').addEventListener('input', function () {
    if (inboxAiReady) clearInboxAiResult('Your message changed. Run AI again to refresh the optimized text and department selection.');
  });
  document.getElementById('composeBody').addEventListener('input', function () {
    if (inboxAiReady) clearInboxAiResult('Your message changed. Run AI again to refresh the optimized text and department selection.');
  });
  composeTo.addEventListener('input', function () {
    selectedContact = null;
    selectedDepartment = null;
    clearInboxAiResult('Choose a person or department from the suggestions, or leave this blank and use AI to select departments.', true);
    showRecipientSuggestions(composeTo.value);
  });
  composeTo.addEventListener('focus', function () {
    showRecipientSuggestions(composeTo.value);
  });
  composeTo.addEventListener('keydown', function (event) {
    var options = recipientSuggestions.querySelectorAll('[role="option"]');
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      options[0].focus();
    } else if (event.key === 'Escape') {
      closeRecipientSuggestions();
    } else if (event.key === 'Enter' && !recipientSuggestions.hidden && options.length) {
      event.preventDefault();
      options[0].click();
    }
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.recipient-autocomplete')) closeRecipientSuggestions();
  });

  document.getElementById('openComposeBtn').addEventListener('click', function () {
    resetComposeForm();
    composeModal.classList.add('show');
  });
  document.getElementById('closeComposeBtn').addEventListener('click', function () {
    composeModal.classList.remove('show');
  });
  document.getElementById('saveDraftBtn').addEventListener('click', function () {
    var to = document.getElementById('composeTo').value.trim();
    var subject = document.getElementById('composeSubject').value.trim();
    var body = document.getElementById('composeBody').value.trim();
    if (!subject && !body) {
      alert('Add a subject or message before saving a draft.');
      return;
    }
    messages.unshift({
      id: Date.now(), sender: to || 'Draft', senderName: to || 'Draft',
      senderMeta: 'Saved draft', initials: 'DR', subject: subject || '(No subject)',
      snippet: body.slice(0, 100), time: 'Just now', unread: false, important: false,
      actionReq: false, body: body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'),
      hasAttachment: false, folder: 'drafts'
    });
    saveMessages();
    composeModal.classList.remove('show');
    resetComposeForm();
    document.getElementById('folderSelect').value = 'drafts';
    currentFolder = 'drafts';
    currentFilter = 'all';
    filterTabs.forEach(function (tab) { tab.classList.toggle('on', tab.dataset.filter === 'all'); });
    renderMessageList();
  });
  document.getElementById('sendMsgBtn').addEventListener('click', async function () {
    var to = document.getElementById('composeTo').value.trim();
    var subj = document.getElementById('composeSubject').value.trim();
    var body = document.getElementById('composeBody').value.trim();
    var isPersonalRecipient = Boolean(selectedContact);
    if (!isPersonalRecipient && (!inboxAiReady || !inboxAiDepartments.length)) {
      setInboxAiStatus('Optimize the message first so AI can improve it and select the recipient departments.', true);
      document.getElementById('optimizeInboxMessageBtn').focus();
      return;
    }
    if (!isPersonalRecipient && to && !inboxAiDepartments.length) {
      setInboxAiStatus('Choose a person from the suggestions or clear To and use AI to route to departments.', true);
      composeTo.focus();
      return;
    }
    if (!to || !subj || !body) {
      alert('Add a recipient, subject, and message before sending.');
      return;
    }
    var sentMessage;
    try {
      sentMessage = await window.CampusSyncAPI.request('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          subject: subj,
          content: body,
          recipientEmail: isPersonalRecipient ? selectedContact.email : '',
          recipientDepartments: isPersonalRecipient ? [] : inboxAiDepartments,
          important: document.getElementById('composePriority').value === 'important',
          actionRequired: document.getElementById('composeActionReq').checked
        })
      });
    } catch (error) {
      setInboxAiStatus(error.message, true);
      return;
    }
    messages.unshift(sentMessage);
    saveMessages();
    alert('Message saved and sent to ' + (selectedContact ? selectedContact.name : to) + '.');
    composeModal.classList.remove('show');
    resetComposeForm();
  });

  // Initial render
  var params = new URLSearchParams(window.location.search);
  if (params.get('search')) {
    searchInput.value = params.get('search');
    searchTerm = searchInput.value.trim().toLowerCase();
  }
  if (params.get('filter') === 'action' || params.get('filter') === 'unread') currentFilter = params.get('filter');
  filterTabs.forEach(function (tab) { tab.classList.toggle('on', tab.dataset.filter === currentFilter); });
  if (params.get('message')) {
    var initialMessage = messages.find(function (msg) { return String(msg.id) === params.get('message'); });
    if (initialMessage) openMessage(initialMessage.id);
  }
  renderMessageList();
  updateUnreadCount();
  saveMessages();
  if (params.get('action') === 'compose') composeModal.classList.add('show');
})();