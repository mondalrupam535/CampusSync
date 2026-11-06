(function () {
  'use strict';

  var ROUTES = {
    dashboard: '../dashboard/dashboard.html',
    inbox: '../inbox/inbox.html',
    announcements: '../announcement/announcements.html',
    events: '../events/events.html',
    'room-booking': '../rooms/room-booking.html',
    approvals: '../approvals/approvals.html'
  };

  function byId(id) { return document.getElementById(id); }
  function setText(id, value) {
    var element = byId(id);
    if (element) element.textContent = value;
  }
  function setProfileDetail(id, value, visible, fallback) {
    var element = byId(id);
    if (!element) return;
    var row = element.closest('[data-profile-detail]');
    var text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    element.textContent = text || fallback || 'Not provided';
    if (row) row.hidden = visible === false;
  }
  function query() { return new URLSearchParams(window.location.search); }
  function readStoredData(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { return null; }
  }

  var profileForSession = readStoredData('onboarding.profile') || {};
  var sessionEmail = '';
  try { sessionEmail = localStorage.getItem('campussync.session') || ''; } catch (error) {}
  var currentPage = document.body.getAttribute('data-page') || '';
  if (!sessionEmail || !profileForSession.email ||
      sessionEmail.toLowerCase() !== profileForSession.email.toLowerCase()) {
    window.location.replace('../../login_signup%20page/index.html');
    return;
  }
  var setupComplete = false;
  try {
    setupComplete = ['onboarding.step1', 'onboarding.step2', 'onboarding.step3']
      .every(function (key) { return localStorage.getItem(key) === 'done'; });
  } catch (error) {
    console.error('Unable to verify onboarding progress:', error);
  }
  if (!setupComplete) {
    window.location.replace('../../onbording/page1/index.html');
    return;
  }

  function navigate(page, params) {
    var route = ROUTES[page] || ROUTES.dashboard;
    var url = new URL(route, window.location.href);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== '' && params[key] != null) url.searchParams.set(key, params[key]);
    });
    window.location.href = url.href;
  }

  var themeToggleBtn = byId('themeToggleBtn');
  var themeIcon = themeToggleBtn && themeToggleBtn.querySelector('.theme-icon');
  var themeText = themeToggleBtn && themeToggleBtn.querySelector('.theme-text');

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    if (themeIcon) themeIcon.textContent = isDark ? '☀️' : '🌙';
    if (themeText) themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    try { localStorage.setItem('campussync_theme', isDark ? 'dark' : 'light'); } catch (error) {}
  }

  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('campussync_theme') || 'light'; } catch (error) {}
  applyTheme(savedTheme);
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  var profile = profileForSession;
  var legacyPersonal = readStoredData('onboarding.personal') || {};
  var role = readStoredData('onboarding.role') || {};
  var student = readStoredData('onboarding.student') || {};
  var staff = readStoredData('onboarding.staff') || {};
  var fullName = profile.name || [legacyPersonal.first, legacyPersonal.last].filter(Boolean).join(' ') || 'CampusSync User';
  var nameParts = fullName.trim().split(/\s+/);
  var firstName = nameParts[0] || 'User';
  var lastName = nameParts.slice(1).join(' ');
  var roleCategory = role.category || 'student';
  var department = role.dept || student.dept || '';
  var isStudent = roleCategory.toLowerCase() === 'student';
  var schoolNames = {
    SEAS: 'School of Engineering and Sciences (SEAS)',
    ESLA: 'Easwari School of Liberal Arts (ESLA)',
    PSB: 'Paari School of Business (PSB)'
  };
  var initials = ((firstName[0] || 'U') + (lastName[0] || '')).toUpperCase();
  setText('welcomeName', firstName);
  setText('userName', fullName);
  setText('dropdownName', fullName);
  setText('userRole', roleCategory);
  setText('welcomeDesignation', role.designation || (roleCategory === 'student' ? 'Student' : 'Faculty'));
  setText('welcomeDept', department);
  setText('dropdownDept', department);
  setText('profileCardDepartment', department);
  setText('userInitials', initials);
  setText('profileInitials', initials);
  setText('profileRole', roleCategory.charAt(0).toUpperCase() + roleCategory.slice(1));
  setProfileDetail('profileEmail', profile.email, true);
  setProfileDetail('profileUsername', profile.username, true);
  setProfileDetail('profilePhone', profile.phone, true);
  setProfileDetail('profileDepartment', department, true);
  setProfileDetail('profileDesignation', role.designation, !isStudent);
  setProfileDetail('profileJoining', role.joining, true);
  setProfileDetail('profileReg', student.reg, isStudent);
  setProfileDetail('profileSchool', schoolNames[student.school] || student.school, isStudent);
  setProfileDetail('profileProgramme', student.programme, isStudent);
  setProfileDetail('profileSpec', student.spec || role.specialization, isStudent);
  setProfileDetail('profileAdmission', student.admission, isStudent);
  setProfileDetail('profileAcademicYear', student.acyear, isStudent);
  setProfileDetail('profileSection', student.section, isStudent);
  setProfileDetail('profileEmployeeId', staff.employeeId, !isStudent);
  setProfileDetail('profileOffice', staff.office, !isStudent);

  function setProfilePhoto(imageId, initialsId) {
    var image = byId(imageId);
    var fallback = byId(initialsId);
    var photo = typeof profile.photo === 'string' &&
      /^data:image\/(?:avif|bmp|gif|jpeg|png|webp);base64,/i.test(profile.photo)
      ? profile.photo
      : '';
    if (!image || !fallback || !photo) return;
    image.onload = function () {
      image.hidden = false;
      fallback.hidden = true;
    };
    image.onerror = function () {
      image.hidden = true;
      fallback.hidden = false;
      console.error('Could not display the saved profile photo.');
    };
    image.src = photo;
    if (image.complete && image.naturalWidth > 0) {
      image.hidden = false;
      fallback.hidden = true;
    }
  }
  setProfilePhoto('userAvatarImage', 'userInitials');
  setProfilePhoto('profileAvatarImage', 'profileInitials');
  setText('currentDate', new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }));

  var userMenuBtn = byId('userMenuBtn');
  var profileDropdown = byId('profileDropdown');
  if (userMenuBtn && profileDropdown) {
    userMenuBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = profileDropdown.classList.toggle('show');
      userMenuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', function () {
      profileDropdown.classList.remove('show');
      userMenuBtn.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      profileDropdown.classList.remove('show');
      userMenuBtn.setAttribute('aria-expanded', 'false');
      userMenuBtn.focus();
    });
    profileDropdown.addEventListener('click', function (event) { event.stopPropagation(); });
  }

  var profileFooter = profileDropdown && profileDropdown.querySelector('.profile-card__footer');
  if (profileFooter && window.CampusSyncAPI &&
      typeof window.CampusSyncAPI.saveProfileDetails === 'function') {
    profileFooter.insertAdjacentHTML('afterbegin', '<button class="profile-edit-btn" id="editProfileBtn" type="button">Edit profile</button>');
    var profileDialog = document.createElement('dialog');
    profileDialog.className = 'profile-editor';
    profileDialog.setAttribute('aria-labelledby', 'profileEditorTitle');
    profileDialog.innerHTML =
      '<form id="profileEditForm">' +
        '<header class="profile-editor__header"><div><h2 id="profileEditorTitle">Edit profile</h2><p>Update your contact and campus details.</p></div>' +
          '<button class="profile-editor__close" type="button" aria-label="Close profile editor">×</button></header>' +
        '<div class="profile-editor__body">' +
          '<section class="profile-editor__section"><h3>Personal details</h3>' +
            '<label>Full name<input name="name" type="text" maxlength="160" autocomplete="name" required></label>' +
            '<label>Email address<input name="email" type="email" readonly></label>' +
            '<p class="profile-editor__hint">Your email is your sign-in address and cannot be changed here.</p>' +
            '<div class="profile-editor__grid">' +
              '<label>Username<input name="username" type="text" maxlength="80" autocomplete="username"></label>' +
              '<label>Phone<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label>' +
            '</div>' +
            '<label>About me<textarea name="bio" maxlength="500" rows="3"></textarea></label>' +
            '<label>Profile photo<input name="photoFile" type="file" accept="image/avif,image/bmp,image/gif,image/jpeg,image/png,image/webp"></label>' +
            '<label class="profile-editor__check"><input name="removePhoto" type="checkbox"> Remove current profile photo</label>' +
          '</section>' +
          '<section class="profile-editor__section"><h3>Campus details</h3>' +
            '<p class="profile-editor__hint" id="profileRoleNotice"></p>' +
          '</section>' +
          '<fieldset class="profile-editor__section profile-editor__student-fields"><legend>Student details</legend>' +
            '<div class="profile-editor__grid">' +
              '<label>Registration number<input name="reg" type="text" maxlength="80"></label>' +
              '<label>School<input name="school" type="text" maxlength="120" placeholder="e.g. SEAS"></label>' +
              '<label>Programme<input name="programme" type="text" maxlength="120"></label>' +
              '<label>Specialization<input name="spec" type="text" maxlength="180"></label>' +
              '<label>Admission year<input name="admission" type="text" maxlength="4" inputmode="numeric"></label>' +
              '<label>Academic year<input name="acyear" type="text" maxlength="80"></label>' +
              '<label>Section<input name="section" type="text" maxlength="40"></label>' +
            '</div>' +
          '</fieldset>' +
          '<fieldset class="profile-editor__section profile-editor__staff-fields"><legend>Employment details</legend>' +
            '<div class="profile-editor__grid">' +
              '<label>Employee ID<input name="employeeId" type="text" maxlength="80"></label>' +
              '<label>Office / room<input name="office" type="text" maxlength="120"></label>' +
            '</div>' +
          '</fieldset>' +
          '<p class="profile-editor__status" role="alert" aria-live="polite"></p>' +
        '</div>' +
        '<footer class="profile-editor__footer"><button class="profile-editor__cancel" type="button">Cancel</button>' +
          '<button class="profile-editor__save" type="submit">Save changes</button></footer>' +
      '</form>';
    document.body.appendChild(profileDialog);

    var profileForm = profileDialog.querySelector('#profileEditForm');
    var profileStatus = profileDialog.querySelector('.profile-editor__status');
    var studentFields = profileDialog.querySelector('.profile-editor__student-fields');
    var staffFields = profileDialog.querySelector('.profile-editor__staff-fields');
    var profileRoleNotice = profileDialog.querySelector('#profileRoleNotice');

    function setFormField(name, value) {
      profileForm.elements[name].value = value == null ? '' : String(value);
    }

    function populateProfileForm() {
      var savedProfile = readStoredData('onboarding.profile') || {};
      var savedRole = readStoredData('onboarding.role') || {};
      var savedStudent = readStoredData('onboarding.student') || {};
      var savedStaff = readStoredData('onboarding.staff') || {};
      setFormField('name', savedProfile.name || fullName);
      setFormField('email', savedProfile.email || sessionEmail);
      setFormField('username', savedProfile.username);
      setFormField('phone', savedProfile.phone);
      setFormField('bio', savedProfile.bio);
      profileRoleNotice.textContent =
        (savedRole.category || roleCategory) + ' • ' + (savedRole.dept || department) +
        ' — role and department changes require an administrator.';
      setFormField('reg', savedStudent.reg);
      setFormField('school', savedStudent.school);
      setFormField('programme', savedStudent.programme);
      setFormField('spec', savedStudent.spec || savedRole.specialization);
      setFormField('admission', savedStudent.admission);
      setFormField('acyear', savedStudent.acyear);
      setFormField('section', savedStudent.section);
      setFormField('employeeId', savedStaff.employeeId);
      setFormField('office', savedStaff.office);
      studentFields.hidden = !isStudent;
      studentFields.disabled = !isStudent;
      staffFields.hidden = isStudent;
      staffFields.disabled = isStudent;
      profileForm.elements.photoFile.value = '';
      profileForm.elements.removePhoto.checked = false;
      profileStatus.textContent = '';
    }

    function readProfilePhoto(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error('The selected profile photo could not be read.')); };
        reader.readAsDataURL(file);
      });
    }

    profileDialog.querySelector('.profile-editor__close').addEventListener('click', function () {
      profileDialog.close();
    });
    profileDialog.querySelector('.profile-editor__cancel').addEventListener('click', function () {
      profileDialog.close();
    });
    profileForm.elements.photoFile.addEventListener('change', function () {
      if (profileForm.elements.photoFile.files.length) profileForm.elements.removePhoto.checked = false;
    });
    profileForm.elements.removePhoto.addEventListener('change', function () {
      if (profileForm.elements.removePhoto.checked) profileForm.elements.photoFile.value = '';
    });
    byId('editProfileBtn').addEventListener('click', function () {
      populateProfileForm();
      profileDropdown.classList.remove('show');
      userMenuBtn.setAttribute('aria-expanded', 'false');
      profileDialog.showModal();
      profileForm.elements.name.focus();
    });
    profileDialog.addEventListener('click', function (event) {
      if (event.target === profileDialog) profileDialog.close();
    });
    profileForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      var saveButton = profileForm.querySelector('.profile-editor__save');
      saveButton.disabled = true;
      profileStatus.textContent = 'Saving your profile…';
      try {
        var savedProfile = {
          name: profileForm.elements.name.value.trim(),
          email: profileForm.elements.email.value,
          username: profileForm.elements.username.value.trim(),
          phone: profileForm.elements.phone.value.trim(),
          bio: profileForm.elements.bio.value.trim(),
          photo: profileForm.elements.removePhoto.checked ? '' : (profileForSession.photo || '')
        };
        var photoFile = profileForm.elements.photoFile.files[0];
        if (photoFile) {
          if (photoFile.size > 2 * 1024 * 1024) {
            throw new Error('Choose a profile photo smaller than 2 MB.');
          }
          if (!/^image\/(?:avif|bmp|gif|jpeg|png|webp)$/i.test(photoFile.type)) {
            throw new Error('Choose an AVIF, BMP, GIF, JPEG, PNG, or WebP image.');
          }
          savedProfile.photo = await readProfilePhoto(photoFile);
        }

        var payload = { profile: savedProfile };
        if (isStudent) {
          payload.student = {
            reg: profileForm.elements.reg.value.trim(),
            school: profileForm.elements.school.value.trim(),
            programme: profileForm.elements.programme.value.trim(),
            spec: profileForm.elements.spec.value.trim(),
            admission: profileForm.elements.admission.value.trim(),
            acyear: profileForm.elements.acyear.value.trim(),
            section: profileForm.elements.section.value.trim()
          };
        } else {
          payload.staff = {
            employeeId: profileForm.elements.employeeId.value.trim(),
            office: profileForm.elements.office.value.trim()
          }
        }
        await window.CampusSyncAPI.saveProfileDetails(payload);
        profileStatus.textContent = 'Profile saved.';
        window.location.reload();
      } catch (error) {
        console.error('Unable to save profile details:', error);
        profileStatus.textContent = error && error.message
          ? error.message
          : 'Your profile could not be saved. Please try again.';
      } finally {
        saveButton.disabled = false;
      }
    });

    if (!byId('profileBio')) {
      var bioSection = document.createElement('div');
      bioSection.className = 'profile-details__section';
      bioSection.innerHTML = '<h2>About</h2><div><div class="profile-detail profile-detail--wide" data-profile-detail="bio"><span>About me</span><strong id="profileBio"></strong></div></div>';
      var profileDetails = profileDropdown.querySelector('.profile-details');
      if (profileDetails) profileDetails.appendChild(bioSection);
    }
    setProfileDetail('profileBio', profileForSession.bio, true);
  }

  if (profileFooter && window.CampusSyncAPI &&
      typeof window.CampusSyncAPI.getAdminUsers === 'function' &&
      window.localStorage.getItem('campussync.isAdmin') === 'true') {
    profileFooter.insertAdjacentHTML('afterbegin', '<button class="profile-edit-btn" id="manageMembersBtn" type="button">Manage members &amp; roles</button>');
    var memberDialog = document.createElement('dialog');
    memberDialog.className = 'profile-editor member-manager';
    memberDialog.setAttribute('aria-labelledby', 'memberManagerTitle');
    memberDialog.innerHTML =
      '<section class="member-manager__panel">' +
        '<header class="profile-editor__header"><div><h2 id="memberManagerTitle">Manage members &amp; roles</h2><p>Update a member’s campus role and department.</p></div>' +
          '<button class="profile-editor__close" type="button" aria-label="Close member manager">×</button></header>' +
        '<div class="profile-editor__body"><label class="member-manager__search">Search members<input type="search" id="memberSearch" placeholder="Name, email, department, or role"></label>' +
          '<p class="member-manager__status" role="status" aria-live="polite"></p><div class="member-manager__list" id="memberManagerList"></div></div>' +
      '</section>';
    document.body.appendChild(memberDialog);

    var memberSearch = memberDialog.querySelector('#memberSearch');
    var memberList = memberDialog.querySelector('#memberManagerList');
    var memberStatus = memberDialog.querySelector('.member-manager__status');
    var managedUsers = [];
    var allowedRoles = ['student', 'faculty', 'staff'];

    function renderManagedUsers() {
      var term = memberSearch.value.trim().toLowerCase();
      var matches = managedUsers.filter(function (user) {
        return [user.name, user.email, user.department, user.role]
          .join(' ').toLowerCase().indexOf(term) !== -1;
      });
      memberList.textContent = '';
      if (!matches.length) {
        memberList.textContent = 'No members match this search.';
        return;
      }

      matches.slice(0, 100).forEach(function (user) {
        var row = document.createElement('form');
        row.className = 'member-manager__row';
        var identity = document.createElement('div');
        identity.className = 'member-manager__identity';
        var name = document.createElement('strong');
        name.textContent = user.name;
        var email = document.createElement('small');
        email.textContent = user.email;
        identity.appendChild(name);
        identity.appendChild(email);

        var roleLabel = document.createElement('label');
        roleLabel.textContent = 'Campus role';
        var roleSelect = document.createElement('select');
        roleSelect.name = 'role';
        allowedRoles.forEach(function (roleName) {
          var option = document.createElement('option');
          option.value = roleName;
          option.textContent = roleName.charAt(0).toUpperCase() + roleName.slice(1);
          roleSelect.appendChild(option);
        });
        roleSelect.value = allowedRoles.indexOf(user.role.toLowerCase()) === -1
          ? 'student' : user.role.toLowerCase();
        roleLabel.appendChild(roleSelect);

        var departmentLabel = document.createElement('label');
        departmentLabel.textContent = 'Department / unit';
        var departmentInput = document.createElement('input');
        departmentInput.name = 'department';
        departmentInput.type = 'text';
        departmentInput.maxLength = 180;
        departmentInput.required = true;
        departmentInput.value = user.department || '';
        departmentLabel.appendChild(departmentInput);

        var save = document.createElement('button');
        save.className = 'member-manager__save';
        save.type = 'submit';
        save.textContent = 'Save';
        row.appendChild(identity);
        row.appendChild(roleLabel);
        row.appendChild(departmentLabel);
        row.appendChild(save);
        row.addEventListener('submit', async function (event) {
          event.preventDefault();
          save.disabled = true;
          memberStatus.textContent = 'Saving changes for ' + user.name + '…';
          try {
            await window.CampusSyncAPI.updateAdminUserRole(
              user.id, roleSelect.value, departmentInput.value.trim()
            );
            user.role = roleSelect.value;
            user.department = departmentInput.value.trim();
            memberStatus.textContent = 'Updated ' + user.name + '.';
          } catch (error) {
            console.error('Unable to update member role:', error);
            memberStatus.textContent = error && error.message
              ? error.message
              : 'The member role could not be updated.';
          } finally {
            save.disabled = false;
          }
        });
        memberList.appendChild(row);
      });
      if (matches.length > 100) {
        var more = document.createElement('p');
        more.className = 'member-manager__more';
        more.textContent = 'Showing 100 of ' + matches.length + ' matching accounts. Refine your search to see others.';
        memberList.appendChild(more);
      }
    }

    async function openMemberManager() {
      memberDialog.showModal();
      memberList.textContent = 'Loading members…';
      memberStatus.textContent = '';
      try {
        managedUsers = await window.CampusSyncAPI.getAdminUsers();
        renderManagedUsers();
      } catch (error) {
        console.error('Unable to load member list:', error);
        memberList.textContent = error && error.message
          ? error.message
          : 'The member list could not be loaded.';
      }
    }

    byId('manageMembersBtn').addEventListener('click', function () {
      profileDropdown.classList.remove('show');
      userMenuBtn.setAttribute('aria-expanded', 'false');
      openMemberManager();
    });
    memberDialog.querySelector('.profile-editor__close').addEventListener('click', function () {
      memberDialog.close();
    });
    memberDialog.addEventListener('click', function (event) {
      if (event.target === memberDialog) memberDialog.close();
    });
    memberSearch.addEventListener('input', renderManagedUsers);
  }

  var logoutBtn = byId('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      try {
        await window.CampusSyncAPI.request('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Unable to end the server session:', error);
        window.CampusSyncAPI.reportError(error);
        return;
      }
      try { localStorage.removeItem('campussync.session'); } catch (error) {
        console.error('Unable to clear the local session hint:', error);
      }
      window.location.href = '../../login_signup%20page/index.html';
    });
  }

  var page = currentPage;
  var currentNavTarget = page;
  var searchInput = byId('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var term = searchInput.value.trim();
      if (!term) return;
      var value = term.toLowerCase();
      var target = 'events';
      if (/room|booking|venue|space|facility/.test(value)) target = 'room-booking';
      else if (/message|inbox|sender|reply/.test(value)) target = 'inbox';
      else if (/announcement|notice/.test(value)) target = 'announcements';
      navigate(target, { search: term });
    });
  }

  var bell = byId('notifBell');
  if (bell && page === 'dashboard') {
    bell.addEventListener('click', function () { navigate('inbox', { filter: 'unread' }); });
  }

  var periodData = {
    day: { unread: 1, approvals: 0, events: 2, tasks: 1, rate: '76%', offset: '100' },
    week: { unread: 4, approvals: 2, events: 5, tasks: 3, rate: '84%', offset: '80' },
    month: { unread: 12, approvals: 6, events: 18, tasks: 9, rate: '95%', offset: '40' }
  };

  if (page === 'dashboard') {
    var inboxData = readStoredData('campussync_inbox_v1');
    var announcementData = readStoredData('campussync_announcements_v1');
    var eventData = readStoredData('campussync_events_v1');
    var roomData = readStoredData('campussync_rooms_v1');
    var periodDurations = { day: 24, week: 24 * 7, month: 24 * 30 };

    function isWithinPeriod(item, period, now) {
      if (!item || !item.createdAt) return true;
      var createdAt = new Date(item.createdAt).getTime();
      return Number.isFinite(createdAt) &&
        createdAt >= now - periodDurations[period] * 60 * 60 * 1000 &&
        createdAt <= now;
    }

    function renderDashboardList(listId, items, renderItem) {
      var list = byId(listId);
      if (!list || !items.length) return;
      list.textContent = '';
      items.forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'list-item';
        renderItem(row, item);
        list.appendChild(row);
      });
    }

    var visibleAnnouncements = Array.isArray(announcementData)
      ? announcementData.filter(function (announcement) { return !announcement.archived; })
      : [];
    visibleAnnouncements.sort(function (left, right) {
      return (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0);
    });
    renderDashboardList('dashboardRecentAnnouncements', visibleAnnouncements.slice(0, 3), function (row, announcement) {
      var tag = document.createElement('span');
      tag.className = 'tag tag-mint';
      tag.textContent = announcement.category || 'University';
      var content = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = announcement.title || 'Campus announcement';
      var meta = document.createElement('small');
      meta.textContent = 'Posted by ' + (announcement.issuer || 'CampusSync') +
        (announcement.date ? ' • ' + announcement.date : '');
      content.appendChild(title);
      content.appendChild(meta);
      row.appendChild(tag);
      row.appendChild(content);
    });

    var pendingMessages = Array.isArray(inboxData)
      ? inboxData.filter(function (message) {
        return message.folder === 'inbox' && message.actionReq;
      })
      : [];
    pendingMessages.sort(function (left, right) {
      return (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0);
    });
    renderDashboardList('dashboardPendingActions', pendingMessages.slice(0, 3), function (row, message) {
      var badge = document.createElement('span');
      badge.className = message.important ? 'badge badge-orange' : 'badge badge-mint';
      badge.textContent = 'Action Required';
      var content = document.createElement('div');
      var subject = document.createElement('strong');
      subject.textContent = message.subject || 'Review message';
      var meta = document.createElement('small');
      meta.textContent = 'From ' + (message.senderName || message.sender || 'CampusSync') +
        (message.time ? ' • ' + message.time : '');
      content.appendChild(subject);
      content.appendChild(meta);
      row.appendChild(badge);
      row.appendChild(content);
    });

    function getPeriodData(period) {
      var now = Date.now();
      var messages = Array.isArray(inboxData)
        ? inboxData.filter(function (message) {
          return message.folder === 'inbox' && isWithinPeriod(message, period, now);
        })
        : [];
      var bookings = roomData && Array.isArray(roomData.bookings)
        ? roomData.bookings.filter(function (booking) {
          return booking.status === 'Pending Approval' ||
            (booking.status === 'Confirmed' && booking.cancellationRequested);
        })
        : [];
      var events = eventData && Array.isArray(eventData.events)
        ? eventData.events.filter(function (event) {
          if (event.status !== 'Approved' && event.status !== 'Confirmed') return false;
          var start = new Date(event.start || event.date).getTime();
          var end = new Date(event.end || event.start || event.date).getTime();
          var periodEnd = now + periodDurations[period] * 60 * 60 * 1000;
          return Number.isFinite(end) && end >= now &&
            (!Number.isFinite(start) || start <= periodEnd);
        })
        : [];
      var actionableAnnouncements = visibleAnnouncements.filter(function (announcement) {
        return announcement.needsAction;
      });
      var actionMessages = messages.filter(function (message) { return message.actionReq; });
      var readMessages = messages.filter(function (message) { return !message.unread; }).length;
      var rate = messages.length ? Math.round(readMessages / messages.length * 100) : 84;

      return {
        unread: messages.filter(function (message) { return message.unread; }).length,
        approvals: bookings.length,
        events: events.length,
        tasks: actionMessages.length + actionableAnnouncements.length,
        rate: rate + '%',
        offset: String(Math.round((100 - rate) * 3.14))
      };
    }

    if (Array.isArray(inboxData) || Array.isArray(announcementData) ||
        Array.isArray(eventData) || Array.isArray(roomData)) {
      Object.keys(periodData).forEach(function (period) {
        periodData[period] = getPeriodData(period);
      });
    }
  }

  var chart = document.querySelector('.circular-chart-card');
  var completionRate = byId('completionRate');
  var chartVisible = false;
  var countAnimation = 0;
  var countFrame = 0;
  var activeOffset = 40;
  var activePeriod = document.querySelector('.seg button.on[data-p]');
  var initialStats = activePeriod && periodData[activePeriod.dataset.p]
    ? periodData[activePeriod.dataset.p]
    : periodData.month;
  setText('statUnread', initialStats.unread);
  setText('statApprovals', initialStats.approvals);
  setText('statEvents', initialStats.events);
  setText('statTasks', initialStats.tasks);
  var chartRate = activePeriod && periodData[activePeriod.dataset.p]
    ? periodData[activePeriod.dataset.p].rate
    : '84%';
  var chartOffset = activePeriod && periodData[activePeriod.dataset.p]
    ? periodData[activePeriod.dataset.p].offset
    : '80';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateChart(rate, deepOffset) {
    if (!chart || !completionRate) return;
    var offset = Number(deepOffset);
    chartRate = rate;
    activeOffset = offset;
    var offsetDelta = offset - 40;
    chart.style.setProperty('--light-ring-offset', String(Math.max(0, Math.min(314, 140 + offsetDelta))));
    chart.style.setProperty('--mid-ring-offset', String(Math.max(0, Math.min(314, 90 + offsetDelta))));
    chart.style.setProperty('--deep-ring-offset', String(Math.max(0, Math.min(314, offset))));
    if (!chartVisible) return;

    chart.classList.add('chart-visible');
    if (countFrame) cancelAnimationFrame(countFrame);
    var start = countAnimation;
    var target = Number.parseInt(rate, 10);
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      countAnimation = target;
      completionRate.textContent = target + '%';
      return;
    }

    var startTime = 0;
    var duration = 1000;
    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      countAnimation = Math.round(start + (target - start) * eased);
      completionRate.textContent = countAnimation + '%';
      if (progress < 1) countFrame = requestAnimationFrame(tick);
      else countFrame = 0;
    }
    countFrame = requestAnimationFrame(tick);
  }

  if (chart && completionRate) {
    completionRate.textContent = '0%';
    animateChart(chartRate, chartOffset);
    if ('IntersectionObserver' in window) {
      var chartObserver = new IntersectionObserver(function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        chartVisible = true;
        chartObserver.disconnect();
        animateChart(chartRate, activeOffset);
      }, { threshold: 0.35 });
      chartObserver.observe(chart);
    } else {
      chartVisible = true;
      animateChart(chartRate, chartOffset);
    }
  }

  document.querySelectorAll('.seg button[data-p]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('.seg button[data-p]').forEach(function (item) { item.classList.remove('on'); });
      button.classList.add('on');
      var stats = periodData[button.dataset.p];
      if (!stats) return;
      setText('statUnread', stats.unread);
      setText('statApprovals', stats.approvals);
      setText('statEvents', stats.events);
      setText('statTasks', stats.tasks);
      animateChart(stats.rate, stats.offset);
    });
  });

  document.querySelectorAll('.nav a[data-target]').forEach(function (link) {
    var isCurrent = link.dataset.target === currentNavTarget;
    link.classList.toggle('on', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  var quickActions = document.querySelectorAll('[data-quick-action]');
  quickActions.forEach(function (button) {
    button.addEventListener('click', function () {
      var action = button.dataset.quickAction;
      if (action === 'announcement') navigate('announcements', { action: 'create' });
      else if (action === 'message') navigate('inbox', { action: 'compose' });
      else if (action === 'room') navigate('room-booking', { action: 'request' });
      else if (action === 'event') navigate('events', { action: 'propose' });
    });
  });

  document.querySelectorAll('[data-dashboard-route]').forEach(function (element) {
    element.addEventListener('click', function () {
      var params = {};
      if (element.dataset.routeParams) {
        element.dataset.routeParams.split('&').forEach(function (pair) {
          var parts = pair.split('=');
          params[decodeURIComponent(parts[0])] = decodeURIComponent(parts.slice(1).join('=') || '');
        });
      }
      navigate(element.dataset.dashboardRoute, params);
    });
  });

  var alertAction = byId('priorityAlertAction');
  if (alertAction) alertAction.addEventListener('click', function () { navigate('inbox', { message: '1' }); });

})();
