const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signInButton.addEventListener('click', () => {
  if (pendingGoogleAccessToken) clearGooglePasswordSignup();
  container.classList.remove('right-panel-active');
});

const GOOGLE_CLIENT_ID = '455575635060-g7l4dqmkq5032259511nhvtai5lpnmk3.apps.googleusercontent.com';
const googleButtons = document.querySelectorAll('.btn-google');
const signUpForm = document.querySelector('.sign-up-container form');
const signInForm = document.querySelector('.sign-in-container form');
const createAccountButton = document.getElementById('createAccount');
const signUpNameInput = signUpForm.querySelector('input[type="text"]');
const signUpEmailInput = signUpForm.querySelector('input[type="email"]');
const signUpPasswordInput = signUpForm.querySelector('input[type="password"]');
const signUpHeading = signUpForm.querySelector('h1');
const signUpSubmitButton = signUpForm.querySelector('button[type="submit"]');
const googlePasswordPrompt = document.getElementById('googlePasswordPrompt');
let googleTokenClient;
let googleSdkLoadFailed = false;
let activeGoogleForm;
let pendingGoogleAccessToken = '';

signUpButton.addEventListener('click', showSignUpForm);
createAccountButton.addEventListener('click', showSignUpForm);

function showSignUpForm() {
  const signInEmail = signInForm.querySelector('input[type="email"]').value.trim();
  if (signInEmail && !signUpEmailInput.value) {
    signUpEmailInput.value = signInEmail;
  }
  container.classList.add('right-panel-active');
}

function prepareGooglePasswordSignup(accessToken, message) {
  pendingGoogleAccessToken = accessToken;
  signUpForm.classList.add('google-registration-pending');
  signUpNameInput.disabled = true;
  signUpNameInput.required = false;
  signUpEmailInput.disabled = true;
  signUpEmailInput.required = false;
  signUpPasswordInput.value = '';
  signUpPasswordInput.placeholder = 'Create password';
  signUpHeading.textContent = 'Set your password';
  signUpSubmitButton.textContent = 'Set password & continue';
  googlePasswordPrompt.hidden = false;
  showAuthMessage(signUpForm, message);
  showSignUpForm();
  signUpPasswordInput.focus();
}

function clearGooglePasswordSignup() {
  pendingGoogleAccessToken = '';
  signUpForm.classList.remove('google-registration-pending');
  signUpNameInput.disabled = false;
  signUpNameInput.required = true;
  signUpEmailInput.disabled = false;
  signUpEmailInput.required = true;
  signUpPasswordInput.placeholder = 'Password';
  signUpHeading.textContent = 'Create Account';
  signUpSubmitButton.textContent = 'Sign Up';
  googlePasswordPrompt.hidden = true;
}

function showAuthMessage(form, message) {
  const status = document.getElementById(form.closest('.sign-up-container')
    ? 'signUpStatus'
    : 'signInStatus');
  status.textContent = message;
}

async function continueAfterAuthentication(form) {
  const onboarding = await window.CampusSyncAPI.request('/api/onboarding');
  const complete = ['step1', 'step2', 'step3']
    .every((step) => onboarding.completed && onboarding.completed[step]);
  window.location.href = complete
    ? '../dashboard/dashboard/dashboard.html'
    : '../onbording/page1/index.html';
  return true;
}

async function completeSignIn(form) {
  showAuthMessage(form, '');
  const email = form.querySelector('input[type="email"]').value.trim();
  const password = form.querySelector('input[type="password"]').value;
  try {
    await window.CampusSyncAPI.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    await continueAfterAuthentication(form);
    return true;
  } catch (error) {
    const message = error.status === 401
      ? `${error.message} New to CampusSync? Use “Create an account” below.`
      : error.message;
    showAuthMessage(form, message);
    return false;
  }
}

async function registerAccount() {
  showAuthMessage(signUpForm, '');
  const password = signUpPasswordInput.value;
  try {
    if (pendingGoogleAccessToken) {
      await window.CampusSyncAPI.request('/api/auth/google/register', {
        method: 'POST',
        body: JSON.stringify({ accessToken: pendingGoogleAccessToken, password })
      });
      clearGooglePasswordSignup();
      await continueAfterAuthentication(signUpForm);
      return;
    }

    const name = signUpNameInput.value.trim();
    const email = signUpEmailInput.value.trim();
    await window.CampusSyncAPI.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    window.location.href = '../onbording/page1/index.html';
  } catch (error) {
    showAuthMessage(signUpForm, error.message);
  }
}

async function handleGoogleToken(response) {
  if (response.error) {
    showAuthMessage(activeGoogleForm || signInForm, `Google sign-in failed: ${response.error}`);
    return;
  }

  const form = activeGoogleForm || signInForm;
  try {
    await window.CampusSyncAPI.request('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ accessToken: response.access_token })
    });
    await continueAfterAuthentication(form);
  } catch (error) {
    if (error.status === 404) {
      prepareGooglePasswordSignup(response.access_token, error.message);
      return;
    }
    showAuthMessage(form, error.message);
  }
}

function initializeGoogleSignIn() {
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'openid email profile',
    callback: handleGoogleToken,
    error_callback: (error) => {
      if (error.type === 'popup_failed_to_open') {
        showAuthMessage(activeGoogleForm || signInForm,
          'The Google sign-in popup could not open. Allow popups for this page and try again.');
      } else if (error.type !== 'popup_closed') {
        showAuthMessage(activeGoogleForm || signInForm, 'Google sign-in could not be completed. Please try again.');
      }
    }
  });
}

googleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeGoogleForm = button.closest('form');

    if (googleSdkLoadFailed) {
      showAuthMessage(activeGoogleForm, 'Could not load Google sign-in. Check your internet connection and reload the page.');
      return;
    }
    if (!googleTokenClient) {
      showAuthMessage(activeGoogleForm, 'Google sign-in is still loading. Please try again in a moment.');
      return;
    }
    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
  });
});

signUpForm.addEventListener('submit', (event) => {
  event.preventDefault();
  registerAccount();
});

signInForm.addEventListener('submit', (event) => {
  event.preventDefault();
  completeSignIn(signInForm);
});

const googleIdentityScript = document.createElement('script');
googleIdentityScript.src = 'https://accounts.google.com/gsi/client';
googleIdentityScript.async = true;
googleIdentityScript.onload = initializeGoogleSignIn;
googleIdentityScript.onerror = () => {
  googleSdkLoadFailed = true;
  console.error('Could not load Google Identity Services.');
};
document.head.appendChild(googleIdentityScript);
