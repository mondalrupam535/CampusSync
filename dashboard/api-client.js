(function (root) {
  'use strict';

  var STORAGE_KEYS = {
    inbox: 'campussync_inbox_v1',
    announcements: 'campussync_announcements_v1',
    events: 'campussync_events_v1',
    rooms: 'campussync_rooms_v1'
  };
  var onboardingKeys = {
    profile: 'onboarding.profile',
    role: 'onboarding.role',
    student: 'onboarding.student',
    staff: 'onboarding.staff'
  };

  async function request(url, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = new Headers(options.headers || {});
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers.set('X-CampusSync-Request', '1');
      if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
    }

    var response;
    try {
      response = await fetch(url, Object.assign({}, options, {
        method: method,
        headers: headers,
        credentials: 'same-origin'
      }));
    } catch (error) {
      throw new Error('Cannot reach the CampusSync Java backend. Make sure it is running and try again.');
    }
    if (!response.ok) {
      var message = 'Request failed with status ' + response.status + '.';
      try {
        var body = await response.json();
        if (body && typeof body.error === 'string') message = body.error;
      } catch (error) {
        console.error('The backend returned a non-JSON error response:', error);
      }
      var apiError = new Error(message);
      apiError.status = response.status;
      throw apiError;
    }
    if (response.status === 204) return null;
    var contentType = response.headers.get('content-type') || '';
    return contentType.indexOf('application/json') !== -1 ? response.json() : response;
  }

  function reportError(error) {
    console.error('CampusSync backend request failed:', error);
    var message = error && error.message ? error.message : 'The backend request failed.';
    var status = document.getElementById('campusSyncApiStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'campusSyncApiStatus';
      status.setAttribute('role', 'alert');
      status.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:3000;padding:12px 16px;border:1px solid #ef4444;border-radius:12px;background:#fff;color:#7f1d1d;font:500 13px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18)';
      document.body.appendChild(status);
    }
    status.textContent = message;
  }

  function setCachedOnboarding(data, user) {
    var profile = data.profile || { name: user.name, email: user.email };
    profile.email = user.email;
    localStorage.setItem('onboarding.profile', JSON.stringify(profile));
    Object.keys(onboardingKeys).forEach(function (step) {
      if (step === 'profile') return;
      var value = data[step];
      if (value) localStorage.setItem(onboardingKeys[step], JSON.stringify(value));
      else localStorage.removeItem(onboardingKeys[step]);
    });
    var completed = data.completed || {};
    ['step1', 'step2', 'step3'].forEach(function (step) {
      if (completed[step]) localStorage.setItem('onboarding.' + step, 'done');
      else localStorage.removeItem('onboarding.' + step);
    });
    localStorage.setItem('campussync.session', user.email);
    localStorage.setItem('campussync.isAdmin', user.isAdmin === true ? 'true' : 'false');
  }

  async function saveOnboardingStep(step, data) {
    var saved = await request('/api/onboarding/' + encodeURIComponent(step), {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    var me = await request('/api/auth/me');
    setCachedOnboarding(saved, me.user);
    return saved;
  }

  async function saveProfileDetails(data) {
    var saved = await request('/api/onboarding/profile/details', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    var me = await request('/api/auth/me');
    setCachedOnboarding(saved, me.user);
    return saved;
  }

  async function getAdminUsers() {
    return request('/api/admin/users');
  }

  async function updateAdminUserRole(userId, role, department) {
    return request('/api/admin/users/' + encodeURIComponent(userId) + '/role', {
      method: 'PUT',
      body: JSON.stringify({ role: role, department: department })
    });
  }

  async function saveWorkspace(collection, data) {
    try {
      await request('/api/workspace/' + encodeURIComponent(collection), {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch (error) {
      reportError(error);
    }
  }

  async function loadWorkspace(collection) {
    var result = await request('/api/workspace/' + encodeURIComponent(collection));
    var key = STORAGE_KEYS[collection];
    if (!key) return;
    var data = result && result.data !== null ? result.data : null;
    if (collection === 'inbox') {
      var serverMessages = await request('/api/messages');
      if (Array.isArray(serverMessages) && serverMessages.length) {
        var saved = [];
        if (Array.isArray(data)) saved = data;
        var byId = new Map();
        saved.forEach(function (message) { byId.set(String(message.id), message); });
        serverMessages.forEach(function (message) { byId.set(String(message.id), message); });
        data = Array.from(byId.values());
      }
    }

    var changed = false;
    if (collection === 'announcements' && Array.isArray(data)) {
      data.forEach(function (announcement) {
        ['totalRecipients', 'delivered', 'read', 'acknowledged'].forEach(function (field) {
          if (announcement[field] != null) {
            announcement[field] = null;
            changed = true;
          }
        });
      });
    } else if (collection === 'inbox' && Array.isArray(data)) {
      var demoMessages = [
        [1, "Dean's Office", 'Dr. Ramesh Kumar', 'Faculty meeting tomorrow'],
        [2, 'CSE Department', 'Prof. S. Swaminathan', 'Lab schedule update for B.Tech CSE'],
        [3, 'Academic Affairs', 'Registrar Office', 'Semester review notice & guidelines']
      ];
      var retainedMessages = data.filter(function (message) {
        return !demoMessages.some(function (sample) {
          return Number(message.id) === sample[0] &&
            message.sender === sample[1] &&
            message.senderName === sample[2] &&
            message.subject === sample[3];
        });
      });
      changed = retainedMessages.length !== data.length;
      data = retainedMessages;
    }

    if (data !== null) localStorage.setItem(key, JSON.stringify(data));
    else localStorage.removeItem(key);
    if (changed) await saveWorkspace(collection, data);
  }

  function loadScripts(paths) {
    return paths.reduce(function (chain, path) {
      return chain.then(function () {
        return new Promise(function (resolve, reject) {
          var script = document.createElement('script');
          script.src = path;
          script.onload = resolve;
          script.onerror = function () { reject(new Error('Could not load application script: ' + path)); };
          document.body.appendChild(script);
        });
      });
    }, Promise.resolve());
  }

  async function bootstrapPage(scripts, collections) {
    try {
      var auth = await request('/api/auth/me');
      var onboarding = await request('/api/onboarding');
      setCachedOnboarding(onboarding, auth.user);
      var isDashboardPage = document.body.hasAttribute('data-page');
      if (isDashboardPage &&
          !['step1', 'step2', 'step3'].every(function (step) { return onboarding.completed[step]; })) {
        window.location.replace('../../onbording/page1/index.html');
        return;
      }
      await Promise.all((collections || []).map(loadWorkspace));
      await loadScripts(scripts);
    } catch (error) {
      if (error.status === 401) {
        localStorage.removeItem('campussync.session');
        window.location.replace('/login_signup%20page/index.html');
        return;
      }
      reportError(error);
    }
  }

  root.CampusSyncAPI = {
    request: request,
    reportError: reportError,
    saveOnboardingStep: saveOnboardingStep,
    saveProfileDetails: saveProfileDetails,
    getAdminUsers: getAdminUsers,
    updateAdminUserRole: updateAdminUserRole,
    saveWorkspace: saveWorkspace,
    bootstrapPage: bootstrapPage
  };
})(window);
