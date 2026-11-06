// Counts completed tasks and keeps the progress pill in sync.
// Mark a task as finished by setting data-done="true" on its <a class="task"> element.
(function () {
  var tasks = Array.prototype.slice.call(document.querySelectorAll('.task'));
  var total = tasks.length;
  var role = {};

  try {
    role = JSON.parse(localStorage.getItem('onboarding.role') || '{}');
  } catch (error) {
    console.error('Unable to read the saved onboarding role:', error);
  }

  if (tasks[0]) tasks[0].dataset.done = localStorage.getItem('onboarding.step1') === 'done';
  if (tasks[1]) tasks[1].dataset.done = localStorage.getItem('onboarding.step2') === 'done';
  if (tasks[2]) {
    tasks[2].dataset.done = localStorage.getItem('onboarding.step3') === 'done';

    if (role.category && role.category !== 'student') {
      tasks[2].href = '../page3/staff.html';
      tasks[2].querySelector('.task__title').textContent = 'Employment details';
      tasks[2].querySelector('.task__desc').textContent = 'Your employee ID and workplace details.';
    }
  }

  var done = tasks.filter(function (t) { return t.dataset.done === 'true'; }).length;
  var remaining = total - done;
  var percent = Math.round((done / total) * 100);

  tasks.forEach(function (t) {
    if (t.dataset.done === 'true') t.classList.add('is-done');
  });

  document.getElementById('tasks-remaining').textContent =
    remaining + (remaining === 1 ? ' task' : ' tasks') + ' remaining';
  document.getElementById('percent-complete').textContent = percent + '% complete';
  document.getElementById('progress-fill').style.width = percent + '%';
  var dashboardLink = document.getElementById('dashboard-link');
  if (dashboardLink) dashboardLink.hidden = remaining !== 0;

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