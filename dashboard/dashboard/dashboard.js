(function () {
  // Theme Toggle Functionality
  var themeToggleBtn = document.getElementById('themeToggleBtn');
  var themeIcon = themeToggleBtn.querySelector('.theme-icon');
  var themeText = themeToggleBtn.querySelector('.theme-text');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Light Mode';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Dark Mode';
    }
    localStorage.setItem('campussync_theme', theme);
  }

  // Load saved theme or default to light
  var savedTheme = localStorage.getItem('campussync_theme') || 'light';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', function () {
    var currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Load Onboarding User Data from localStorage
  var personal = {};
  var role = {};
  var student = {};

  try {
    personal = JSON.parse(localStorage.getItem('onboarding.personal') || '{}');
    role = JSON.parse(localStorage.getItem('onboarding.role') || '{}');
    student = JSON.parse(localStorage.getItem('onboarding.student') || '{}');
  } catch (e) {}

  // Populate User Information Across Dashboard Header
  var fullName = [personal.first, personal.last].filter(Boolean).join(' ') || 'CampusSync User';
  var userRoleCategory = role.category || 'student';
  var userDesignation = role.designation || (userRoleCategory === 'student' ? 'Student' : 'Faculty');
  var userDepartment = role.dept || student.dept || '';

  document.getElementById('welcomeName').textContent = personal.first || 'User';
  document.getElementById('userName').textContent = fullName;
  document.getElementById('dropdownName').textContent = fullName;
  document.getElementById('userRole').textContent = userRoleCategory;
  document.getElementById('welcomeDesignation').textContent = userDesignation;
  document.getElementById('welcomeDept').textContent = userDepartment;
  document.getElementById('dropdownDept').textContent = userDepartment;

  // Set User Initials Avatar
  var initials = ((personal.first ? personal.first[0] : 'U') + (personal.last ? personal.last[0] : '')).toUpperCase();
  document.getElementById('userInitials').textContent = initials;

  // Set Today's Date
  var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', options);

  // Toggle Profile Dropdown Menu
  var userMenuBtn = document.getElementById('userMenuBtn');
  var profileDropdown = document.getElementById('profileDropdown');

  userMenuBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    profileDropdown.classList.toggle('show');
  });

  document.addEventListener('click', function () {
    profileDropdown.classList.remove('show');
  });

  // Handle Logout
  document.getElementById('logoutBtn').addEventListener('click', function () {
    localStorage.clear();
    window.location.href = 'index.html';
  });

  // Navigation Button Selector Switching
  var navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      navButtons.forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
    });
  });

})();