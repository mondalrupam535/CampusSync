(function () {
  var form = document.getElementById('profile-form');
  var nameInput = document.getElementById('name');
  var emailInput = document.getElementById('email');
  var uploadBtn = document.getElementById('upload-btn');
  var photoInput = document.getElementById('photo');
  var avatar = document.getElementById('avatar');
  var photoData = '';

  // Restore anything saved earlier in this browser
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('onboarding.profile') || '{}'); } catch (e) {}
  ['name', 'email', 'username', 'phone'].forEach(function (key) {
    var el = document.getElementById(key);
    if (el && saved[key]) el.value = saved[key];
  });
  if (saved.photo) { photoData = saved.photo; showPhoto(photoData); }

  // Photo upload + preview
  uploadBtn.addEventListener('click', function () { photoInput.click(); });
  photoInput.addEventListener('change', function () {
    var file = photoInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { photoData = reader.result; showPhoto(photoData); };
    reader.readAsDataURL(file);
  });
  function showPhoto(src) {
    avatar.innerHTML = '';
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    avatar.appendChild(img);
  }

  // Validation helpers
  function setError(input, message) {
    var box = document.getElementById(input.id + '-error');
    box.textContent = message;
    input.classList.toggle('is-invalid', !!message);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  nameInput.addEventListener('input', function () { setError(nameInput, ''); });
  emailInput.addEventListener('input', function () { setError(emailInput, ''); });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var ok = true;

    if (!nameInput.value.trim()) {
      setError(nameInput, 'Please enter your full name.');
      ok = false;
    }
    if (!validEmail(emailInput.value.trim())) {
      setError(emailInput, 'Please enter a valid college email.');
      ok = false;
    }
    if (!ok) {
      (document.querySelector('.is-invalid') || nameInput).focus();
      return;
    }

    var profile = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      username: document.getElementById('username').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      photo: photoData
    };
    try {
      localStorage.setItem('onboarding.profile', JSON.stringify(profile));
      await window.CampusSyncAPI.saveOnboardingStep('profile', profile);
    } catch (error) {
      console.error('Unable to save personal profile:', error);
      alert('Could not save your profile to the CampusSync server: ' + error.message);
      return;
    }

    window.location.href = '../page3/index.html';
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