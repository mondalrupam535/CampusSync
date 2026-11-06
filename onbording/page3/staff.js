(function () {
  var form = document.getElementById('staff-form');
  var employeeId = document.getElementById('employee-id');
  var office = document.getElementById('office');

  try {
    var saved = JSON.parse(localStorage.getItem('onboarding.staff') || '{}');
    if (saved.employeeId) employeeId.value = saved.employeeId;
    if (saved.office) office.value = saved.office;
  } catch (error) {
    console.error('Unable to restore saved employment details:', error);
    alert('Saved employment details could not be read from this browser.');
  }

  function setError(message) {
    document.getElementById('employee-id-error').textContent = message;
    employeeId.classList.toggle('is-invalid', !!message);
    employeeId.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  employeeId.addEventListener('input', function () {
    setError('');
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!employeeId.value.trim()) {
      setError('Please enter your employee ID.');
      employeeId.focus();
      return;
    }

    try {
      var staff = {
        employeeId: employeeId.value.trim(),
        office: office.value.trim()
      };
      localStorage.setItem('onboarding.staff', JSON.stringify(staff));
      await window.CampusSyncAPI.saveOnboardingStep('staff', staff);
    } catch (error) {
      console.error('Unable to save employment details:', error);
      alert('Could not save your employment details to the CampusSync server: ' + error.message);
      return;
    }

    window.location.href = '../../dashboard/dashboard/dashboard.html';
  });

  var showcase = document.querySelector('.showcase');
  if (showcase) {
    showcase.addEventListener('mousemove', function (event) {
      var rect = showcase.getBoundingClientRect();
      var x = event.clientX - rect.left - rect.width / 2;
      var y = event.clientY - rect.top - rect.height / 2;
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
