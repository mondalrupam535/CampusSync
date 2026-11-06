(function () {
  // Safe helpers so this script works on every page, even if an element is missing
  function byId(id) { return document.getElementById(id); }
  function setText(id, value) {
    var el = byId(id);
    if (el) el.textContent = value;
  }

  // Theme Toggle Functionality
  var themeToggleBtn = byId('themeToggleBtn');
  var themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('.theme-icon') : null;
  var themeText = themeToggleBtn ? themeToggleBtn.querySelector('.theme-text') : null;

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeText) themeText.textContent = 'Light Mode';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeText) themeText.textContent = 'Dark Mode';
    }
    try { localStorage.setItem('campussync_theme', theme); } catch (e) {}
  }

  // Load saved theme or default to light
  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('campussync_theme') || 'light'; } catch (e) {}
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      var currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // Load Onboarding User Data from localStorage
  var personal = {};
  var role = {};
  var student = {};

  try {
    personal = JSON.parse(localStorage.getItem('onboarding.personal') || '{}');
    role = JSON.parse(localStorage.getItem('onboarding.role') || '{}');
    student = JSON.parse(localStorage.getItem('onboarding.student') || '{}');
  } catch (e) {}

  // Populate User Information Across Header
  var fullName = [personal.first, personal.last].filter(Boolean).join(' ') || 'CampusSync User';
  var userRoleCategory = role.category || 'student';
  var userDesignation = role.designation || (userRoleCategory === 'student' ? 'Student' : 'Faculty');
  var userDepartment = role.dept || student.dept || '';

  setText('welcomeName', personal.first || 'User');
  setText('userName', fullName);
  setText('dropdownName', fullName);
  setText('userRole', userRoleCategory);
  setText('welcomeDesignation', userDesignation);
  setText('welcomeDept', userDepartment);
  setText('dropdownDept', userDepartment);

  // Set User Initials Avatar
  var initials = ((personal.first ? personal.first[0] : 'U') + (personal.last ? personal.last[0] : '')).toUpperCase();
  setText('userInitials', initials);

  // Set Today's Date (only on pages that have the element)
  var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  setText('currentDate', new Date().toLocaleDateString('en-US', options));

  // Toggle Profile Dropdown Menu
  var userMenuBtn = byId('userMenuBtn');
  var profileDropdown = byId('profileDropdown');

  if (userMenuBtn && profileDropdown) {
    userMenuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', function () {
      profileDropdown.classList.remove('show');
    });
  }

  // Handle Logout (keeps the saved theme)
  var logoutBtn = byId('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      var theme = null;
      try { theme = localStorage.getItem('campussync_theme'); } catch (e) {}
      try {
        localStorage.clear();
        if (theme) localStorage.setItem('campussync_theme', theme);
      } catch (e) {}
      window.location.href = 'index.html';
    });
  }

  // Navigation Button Selector Switching
  var navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navButtons.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
    });
  });

})();