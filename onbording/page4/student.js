(function () {
  var CATALOG = window.CampusSyncStudentCatalog;
  if (!CATALOG) throw new Error('Student specialization catalog was not loaded.');

  var form = document.getElementById('student-form');
  var reg = document.getElementById('reg');
  var school = document.getElementById('school');
  var dept = document.getElementById('dept');
  var programme = document.getElementById('programme');
  var spec = document.getElementById('spec');
  var admission = document.getElementById('admission');
  var acyear = document.getElementById('acyear');
  var section = document.getElementById('section');

  // ----- helpers -----
  function fill(select, placeholder, values, enable) {
    select.innerHTML = '';
    var first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    first.selected = true;
    select.appendChild(first);
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    select.disabled = !enable;
    select.classList.add('is-placeholder');
  }
  function syncPlaceholder(select) {
    select.classList.toggle('is-placeholder', select.value === '');
  }
  function setError(input, message) {
    var box = document.getElementById(input.id + '-error');
    if (box) box.textContent = message;
    input.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  function keys(obj) { return obj ? Object.keys(obj) : []; }

  // ----- initial state -----
  fill(school, 'Select your school', keys(CATALOG), true);
  fill(dept, 'Select school first', [], false);
  fill(programme, 'Select department first', [], false);
  fill(spec, 'Select programme first', [], false);

  var thisYear = new Date().getFullYear();
  var years = [];
  for (var y = thisYear; y >= thisYear - 6; y--) years.push(String(y));
  fill(admission, 'Select year', years, true);

  // ----- dependent dropdowns -----
  school.addEventListener('change', function () {
    var depts = keys(CATALOG[school.value]);
    fill(dept, depts.length ? 'Select department' : 'Select school first', depts, depts.length > 0);
    fill(programme, 'Select department first', [], false);
    fill(spec, 'Select programme first', [], false);
    setError(spec, '');
    syncPlaceholder(school);
    setError(school, '');
  });

  dept.addEventListener('change', function () {
    var progs = keys((CATALOG[school.value] || {})[dept.value]);
    fill(programme, progs.length ? 'Select programme' : 'Select department first', progs, progs.length > 0);
    fill(spec, 'Select programme first', [], false);
    setError(spec, '');
    syncPlaceholder(dept);
    setError(dept, '');
  });

  programme.addEventListener('change', function () {
    var branch = (CATALOG[school.value] || {})[dept.value] || {};
    var specs = branch[programme.value] || [];
    fill(spec, specs.length ? 'Select specialization' : 'Select programme first', specs, specs.length > 0);
    var roleSpec = savedRole.specialization;
    if (roleSpec && specs.indexOf(roleSpec) !== -1) {
      spec.value = roleSpec;
      spec.disabled = true;
    } else if (saved.spec && specs.indexOf(saved.spec) !== -1) {
      spec.value = saved.spec;
    }
    syncPlaceholder(spec);
    syncPlaceholder(programme);
    setError(programme, '');
    setError(spec, '');
  });

  [spec, admission, acyear].forEach(function (select) {
    select.addEventListener('change', function () {
      syncPlaceholder(select);
      setError(select, '');
    });
  });
  reg.addEventListener('input', function () { setError(reg, ''); });

  // ----- restore saved values -----
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('onboarding.student') || '{}'); } catch (e) {}
  var savedRole = {};
  try { savedRole = JSON.parse(localStorage.getItem('onboarding.role') || '{}'); } catch (e) {}
  if (saved.reg) reg.value = saved.reg;
  if (saved.section) section.value = saved.section;
  if (saved.school && CATALOG[saved.school]) {
    school.value = saved.school; school.dispatchEvent(new Event('change'));
    if (saved.dept) { dept.value = saved.dept; dept.dispatchEvent(new Event('change')); }
    if (saved.programme) { programme.value = saved.programme; programme.dispatchEvent(new Event('change')); }
  }
  if (saved.admission) { admission.value = saved.admission; syncPlaceholder(admission); }
  if (saved.acyear) { acyear.value = saved.acyear; syncPlaceholder(acyear); }

  // ----- submit -----
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var ok = true;

    if (!reg.value.trim()) { setError(reg, 'Please enter your registration / roll number.'); ok = false; }
    if (!school.value) { setError(school, 'Please choose your school.'); ok = false; }
    if (!dept.value) { setError(dept, 'Please choose your department.'); ok = false; }
    if (!programme.value) { setError(programme, 'Please choose your programme.'); ok = false; }
    if (!spec.value) { setError(spec, 'Please choose a specialization.'); ok = false; }
    if (!admission.value) { setError(admission, 'Please choose your admission year.'); ok = false; }

    if (!ok) {
      var firstBad = document.querySelector('.is-invalid');
      if (firstBad) firstBad.focus();
      return;
    }

    try {
      var student = {
        reg: reg.value.trim(),
        school: school.value,
        dept: dept.value,
        programme: programme.value,
        spec: spec.value,
        admission: admission.value,
        acyear: acyear.value,
        section: section.value.trim()
      };
      localStorage.setItem('onboarding.student', JSON.stringify(student));
      await window.CampusSyncAPI.saveOnboardingStep('student', student);
    } catch (error) {
      console.error('Unable to save student details:', error);
      alert('Could not save your student details to the CampusSync server: ' + error.message);
      return;
    }

    window.location.href = '../../dashboard/dashboard/dashboard.html';
  });

  // Mouse tilt interaction on the showcase side panel
  var showcase = document.querySelector('.showcase');
  if (showcase) {
    showcase.addEventListener('mousemove', function (e) {
      var rect = showcase.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      var moveX = (x / rect.width) * 12;
      var moveY = (y / rect.height) * 12;
      showcase.style.transform = 'perspective(1000px) rotateY(' + moveX + 'deg) rotateX(' + (-moveY) + 'deg)';
      showcase.style.transition = 'transform 0.1s ease-out';
    });

    showcase.addEventListener('mouseleave', function () {
      showcase.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
      showcase.style.transition = 'transform 0.5s ease';
    });
  }
})();