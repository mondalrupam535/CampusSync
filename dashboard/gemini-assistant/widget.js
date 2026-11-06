(function () {
  'use strict';

  var conversation = [];
  var page = document.body.getAttribute('data-page') || 'dashboard';
  var assetUrl = new URL('ai-orbit.png', document.currentScript.src).href;
  var widget = document.createElement('div');
  widget.innerHTML = [
    '<button class="campus-assistant-launcher" type="button" aria-label="Open CampusSync AI assistant" aria-expanded="false"><img src="' + assetUrl + '" alt=""></button>',
    '<section class="campus-assistant-panel" aria-label="CampusSync AI assistant" hidden>',
    '  <header class="campus-assistant-header">',
    '    <div class="campus-assistant-identity">',
    '      <span class="campus-assistant-mark" aria-hidden="true"><img src="' + assetUrl + '" alt=""></span>',
    '      <div><strong class="campus-assistant-title">CampusSync Assistant</strong><span class="campus-assistant-presence">AI assistant</span></div>',
    '    </div>',
    '    <button class="campus-assistant-close" type="button" aria-label="Close assistant">&times;</button>',
    '  </header>',
    '  <div class="campus-assistant-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>',
    '  <div class="campus-assistant-prompts" aria-label="Suggested questions">',
    '    <button type="button" data-prompt="How do I create an announcement?">Create an announcement</button>',
    '    <button type="button" data-prompt="How do I submit an announcement for approval?">Approval process</button>',
    '  </div>',
    '  <form class="campus-assistant-form">',
    '    <label class="campus-assistant-sr-only" for="campusAssistantInput">Message the CampusSync assistant</label>',
    '    <textarea id="campusAssistantInput" rows="1" maxlength="3000" placeholder="Ask a question..." required></textarea>',
    '    <button class="campus-assistant-send" type="submit" aria-label="Send message">&#8593;</button>',
    '  </form>',
    '  <p class="campus-assistant-note">AI responses can be inaccurate. Verify important information.</p>',
    '</section>'
  ].join('');
  document.body.appendChild(widget);

  var launcher = widget.querySelector('.campus-assistant-launcher');
  var panel = widget.querySelector('.campus-assistant-panel');
  var closeButton = widget.querySelector('.campus-assistant-close');
  var messages = widget.querySelector('.campus-assistant-messages');
  var form = widget.querySelector('.campus-assistant-form');
  var input = widget.querySelector('#campusAssistantInput');
  var sendButton = widget.querySelector('.campus-assistant-send');
  var promptButtons = widget.querySelectorAll('[data-prompt]');

  function addMessage(text, kind) {
    var message = document.createElement('div');
    message.className = 'campus-assistant-message';
    if (kind) message.classList.add('is-' + kind);
    if (kind !== 'user' && kind !== 'loading' && kind !== 'error') {
      var avatar = document.createElement('img');
      avatar.className = 'campus-assistant-message-icon';
      avatar.src = assetUrl;
      avatar.alt = '';
      avatar.setAttribute('aria-hidden', 'true');
      message.appendChild(avatar);
    }
    var textNode = document.createElement('span');
    textNode.className = 'campus-assistant-message-text';
    textNode.textContent = text;
    message.appendChild(textNode);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    launcher.setAttribute('aria-expanded', String(isOpen));
    launcher.setAttribute('aria-label', isOpen ? 'Close CampusSync AI assistant' : 'Open CampusSync AI assistant');
    if (isOpen) input.focus();
  }

  function showWelcome() {
    if (!messages.childElementCount) {
      addMessage('Hi! I can help you navigate CampusSync and prepare announcements.', '');
    }
  }

  async function sendMessage(text) {
    var message = text.trim();
    if (!message || sendButton.disabled) return;

    conversation.push({ role: 'user', content: message });
    addMessage(message, 'user');
    input.value = '';
    input.style.height = '';
    sendButton.disabled = true;
    var loading = addMessage('Thinking...', 'loading');

    try {
      var data = await window.CampusSyncAPI.request('/assistant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation.slice(-8), page: page })
      });
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The assistant returned an empty response.');
      }

      loading.remove();
      addMessage(data.reply, '');
      conversation.push({ role: 'assistant', content: data.reply });
    } catch (error) {
      loading.remove();
      addMessage(error.message, 'error');
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener('click', function () {
    var isOpen = !panel.hidden;
    if (!isOpen) showWelcome();
    setOpen(!isOpen);
  });
  closeButton.addEventListener('click', function () { setOpen(false); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendMessage(input.value);
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  promptButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      sendMessage(button.getAttribute('data-prompt'));
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
})();
