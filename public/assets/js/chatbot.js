// =============================================================================
// ARCIO — Rule-Based Help Chatbot & User Manual Assistant UI
// Lightweight, responsive, theme-aware floating navigation assistant
// =============================================================================

import { CHATBOT_SUGGESTED_PROMPTS, queryChatbot, resetChatbotContext } from './chatbot-knowledge.js';
import { FEEDBACK_FORM_URL } from './arcio-config.js';

let isChatbotInitialized = false;

export function initChatbot() {
  if (isChatbotInitialized) return;
  if (typeof document === 'undefined') return;

  // Check if container already exists
  if (document.getElementById('arcioChatbotRoot')) return;

  isChatbotInitialized = true;

  // 1. Inject Styles
  const style = document.createElement('style');
  style.id = 'arcioChatbotStyles';
  style.textContent = `
    /* ── ARCIO HELP CHATBOT STYLES ── */
    #arcioChatbotRoot {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    /* Floating Launcher Button */
    .arcio-chat-launcher {
      display: flex;
      align-items: center;
      gap: 9px;
      background: rgba(10, 17, 32, 0.92);
      border: 1px solid rgba(94, 234, 212, 0.28);
      color: var(--ink, #EAF1FF);
      padding: 10px 16px;
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 16px rgba(94, 234, 212, 0.15);
      backdrop-filter: blur(14px);
      transition: all 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
      user-select: none;
    }

    .arcio-chat-launcher:hover {
      transform: translateY(-3px) scale(1.02);
      border-color: var(--cyan, #5EEAD4);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 24px rgba(94, 234, 212, 0.28);
    }

    .arcio-chat-launcher-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cyan, #5EEAD4);
      box-shadow: 0 0 8px var(--cyan, #5EEAD4);
      animation: arcioDotPulse 2s infinite ease-in-out;
    }

    @keyframes arcioDotPulse {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.25); }
    }

    .arcio-chat-launcher-text {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--cyan, #5EEAD4);
    }

    /* Chat Panel Window */
    .arcio-chat-panel {
      position: absolute;
      bottom: calc(100% + 14px);
      right: 0;
      width: 370px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: rgba(10, 17, 32, 0.96);
      border: 1px solid rgba(94, 234, 212, 0.22);
      border-radius: 18px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(94, 234, 212, 0.08);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1);
      z-index: 9001;
    }

    .arcio-chat-panel.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0) scale(1);
    }

    /* Light mode adjustments */
    body.light .arcio-chat-launcher {
      background: rgba(240, 244, 255, 0.95);
      border-color: rgba(8, 145, 178, 0.35);
      color: #0F172A;
      box-shadow: 0 8px 28px rgba(14, 40, 60, 0.15);
    }

    body.light .arcio-chat-launcher-text {
      color: #0891B2;
    }

    body.light .arcio-chat-panel {
      background: rgba(244, 248, 255, 0.98);
      border-color: rgba(8, 145, 178, 0.25);
      box-shadow: 0 24px 60px rgba(14, 40, 60, 0.2);
    }

    /* Chat Header */
    .arcio-chat-header {
      padding: 14px 18px;
      background: rgba(6, 10, 19, 0.6);
      border-bottom: 1px solid rgba(94, 234, 212, 0.14);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    body.light .arcio-chat-header {
      background: rgba(230, 238, 250, 0.85);
      border-bottom-color: rgba(8, 145, 178, 0.18);
    }

    .arcio-chat-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .arcio-chat-icon-badge {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(94, 234, 212, 0.2));
      border: 1px solid rgba(94, 234, 212, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cyan, #5EEAD4);
    }

    body.light .arcio-chat-icon-badge {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(8, 145, 178, 0.15));
      border-color: rgba(8, 145, 178, 0.3);
      color: #0891B2;
    }

    .arcio-chat-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: var(--ink, #EAF1FF);
      line-height: 1.2;
    }

    body.light .arcio-chat-title {
      color: #0F172A;
    }

    .arcio-chat-sub {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      color: var(--cyan2, #38BDF8);
      letter-spacing: 0.04em;
    }

    .arcio-chat-close-btn {
      background: none;
      border: none;
      color: var(--muted, #6B7DA0);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.18s, background 0.18s;
    }

    .arcio-chat-close-btn:hover {
      color: var(--cyan, #5EEAD4);
      background: rgba(94, 234, 212, 0.08);
    }

    /* Messages Area */
    .arcio-chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .arcio-chat-body::-webkit-scrollbar {
      width: 4px;
    }

    .arcio-chat-body::-webkit-scrollbar-thumb {
      background: rgba(94, 234, 212, 0.15);
      border-radius: 4px;
    }

    /* Message Bubbles */
    .arcio-msg {
      max-width: 88%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.5;
      animation: arcioMsgIn 0.2s ease-out;
      word-break: break-word;
    }

    @keyframes arcioMsgIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .arcio-msg-bot {
      align-self: flex-start;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(94, 234, 212, 0.16);
      color: var(--ink, #EAF1FF);
      border-bottom-left-radius: 4px;
    }

    body.light .arcio-msg-bot {
      background: #FFFFFF;
      border-color: rgba(8, 145, 178, 0.18);
      color: #0F172A;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .arcio-msg-user {
      align-self: flex-end;
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.35), rgba(56, 189, 248, 0.28));
      border: 1px solid rgba(56, 189, 248, 0.38);
      color: #EAF1FF;
      border-bottom-right-radius: 4px;
    }

    body.light .arcio-msg-user {
      background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(8, 145, 178, 0.18));
      border-color: rgba(8, 145, 178, 0.35);
      color: #0F172A;
    }

    .arcio-msg-bot strong {
      color: var(--cyan, #5EEAD4);
    }

    body.light .arcio-msg-bot strong {
      color: #0891B2;
    }

    .arcio-msg-bot code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10.5px;
      padding: 1px 4px;
      background: rgba(94, 234, 212, 0.1);
      border-radius: 4px;
      color: var(--cyan2, #38BDF8);
    }

    /* Suggested Chips */
    .arcio-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .arcio-chip {
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 100px;
      padding: 4px 10px;
      font-size: 10.5px;
      font-weight: 500;
      color: var(--cyan2, #38BDF8);
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: left;
    }

    .arcio-chip:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: var(--cyan, #5EEAD4);
      color: var(--cyan, #5EEAD4);
      transform: translateY(-1px);
    }

    body.light .arcio-chip {
      background: rgba(8, 145, 178, 0.08);
      border-color: rgba(8, 145, 178, 0.22);
      color: #0284C7;
    }

    body.light .arcio-chip:hover {
      background: rgba(8, 145, 178, 0.18);
      color: #0891B2;
    }

    /* Footer / Input Bar */
    .arcio-chat-footer {
      padding: 12px 14px;
      background: rgba(6, 10, 19, 0.7);
      border-top: 1px solid rgba(94, 234, 212, 0.12);
      display: flex;
      gap: 8px;
    }

    body.light .arcio-chat-footer {
      background: rgba(235, 242, 252, 0.9);
      border-top-color: rgba(8, 145, 178, 0.16);
    }

    .arcio-chat-input {
      flex: 1;
      padding: 9px 12px;
      background: rgba(10, 17, 32, 0.8);
      border: 1px solid rgba(94, 234, 212, 0.18);
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: var(--ink, #EAF1FF);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    body.light .arcio-chat-input {
      background: #FFFFFF;
      border-color: rgba(8, 145, 178, 0.25);
      color: #0F172A;
    }

    .arcio-chat-input:focus {
      border-color: var(--cyan, #5EEAD4);
      box-shadow: 0 0 0 2px rgba(94, 234, 212, 0.15);
    }

    .arcio-chat-send-btn {
      background: linear-gradient(135deg, rgba(94, 234, 212, 0.22), rgba(56, 189, 248, 0.25));
      border: 1px solid rgba(94, 234, 212, 0.4);
      color: var(--cyan, #5EEAD4);
      padding: 0 14px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .arcio-chat-send-btn:hover {
      background: linear-gradient(135deg, rgba(94, 234, 212, 0.35), rgba(56, 189, 248, 0.38));
      transform: scale(1.04);
    }

    body.light .arcio-chat-send-btn {
      background: linear-gradient(135deg, rgba(8, 145, 178, 0.15), rgba(37, 99, 235, 0.18));
      border-color: rgba(8, 145, 178, 0.4);
      color: #0891B2;
    }

    /* Header button group */
    .arcio-chat-header-actions { display: flex; align-items: center; gap: 2px; }

    /* Typing indicator */
    .arcio-typing { display: inline-flex; gap: 4px; padding: 12px 14px; }
    .arcio-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--cyan, #5EEAD4); opacity: 0.4;
      animation: arcioTyping 1s infinite ease-in-out;
    }
    .arcio-typing span:nth-child(2) { animation-delay: 0.15s; }
    .arcio-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes arcioTyping {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    /* Follow-up chips + action link under a bot answer */
    .arcio-followups { align-self: flex-start; max-width: 92%; margin-top: -4px; }
    .arcio-action-link {
      display: inline-block; margin-top: 8px; padding: 5px 12px; border-radius: 100px;
      font-size: 11px; font-weight: 600; text-decoration: none;
      background: rgba(94, 234, 212, 0.14); border: 1px solid rgba(94, 234, 212, 0.4);
      color: var(--cyan, #5EEAD4);
    }
    body.light .arcio-action-link { color: #0891B2; border-color: rgba(8, 145, 178, 0.4); background: rgba(8, 145, 178, 0.1); }
    .arcio-msg-bot em { font-style: italic; opacity: 0.9; }
  `;
  document.head.appendChild(style);

  // 2. Create DOM elements
  const root = document.createElement('div');
  root.id = 'arcioChatbotRoot';
  root.innerHTML = `
    <!-- Floating Launcher -->
    <button class="arcio-chat-launcher" id="arcioChatLauncher" aria-label="Open ARCIO Help Assistant">
      <div class="arcio-chat-launcher-dot"></div>
      <span class="arcio-chat-launcher-text">ARCIO Help</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- Chat Panel -->
    <div class="arcio-chat-panel" id="arcioChatPanel" role="dialog" aria-label="ARCIO Help Chatbot">
      <!-- Header -->
      <div class="arcio-chat-header">
        <div class="arcio-chat-title-group">
          <div class="arcio-chat-icon-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div>
            <div class="arcio-chat-title">ARCIO Help</div>
            <div class="arcio-chat-sub">Virtual Manual &amp; Navigator</div>
          </div>
        </div>
        <div class="arcio-chat-header-actions">
          <button class="arcio-chat-close-btn" id="arcioChatClearBtn" aria-label="Clear chat" title="Clear chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 .49-4"></path>
            </svg>
          </button>
          <button class="arcio-chat-close-btn" id="arcioChatCloseBtn" aria-label="Close Help Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages Body -->
      <div class="arcio-chat-body" id="arcioChatBody" role="log" aria-live="polite"></div>

      <!-- Input Footer -->
      <div class="arcio-chat-footer">
        <input type="text" class="arcio-chat-input" id="arcioChatInput" placeholder="Ask about labs, wiring, XP, certificate..." autocomplete="off" maxlength="200" />
        <button class="arcio-chat-send-btn" id="arcioChatSendBtn" aria-label="Send message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // 3. Element refs
  const launcher = document.getElementById('arcioChatLauncher');
  const panel = document.getElementById('arcioChatPanel');
  const closeBtn = document.getElementById('arcioChatCloseBtn');
  const clearBtn = document.getElementById('arcioChatClearBtn');
  const chatInput = document.getElementById('arcioChatInput');
  const sendBtn = document.getElementById('arcioChatSendBtn');
  const body = document.getElementById('arcioChatBody');

  // 4. Message helpers
  function formatResponseText(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,]|$)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  }

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function makeChips(prompts) {
    const wrap = document.createElement('div');
    wrap.className = 'arcio-chips-wrap';
    prompts.forEach(prompt => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'arcio-chip';
      chip.textContent = prompt;
      chip.addEventListener('click', () => sendUserMessage(prompt));
      wrap.appendChild(chip);
    });
    return wrap;
  }

  function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = `arcio-msg arcio-msg-${sender}`;
    if (sender === 'bot') msg.innerHTML = formatResponseText(text);
    else msg.textContent = text;
    body.appendChild(msg);
    scrollDown();
    return msg;
  }

  function appendBotResponse(res) {
    const msg = appendMessage('bot', res.text);
    if (res.action === 'feedback' && typeof FEEDBACK_FORM_URL === 'string' && /^https?:\/\//.test(FEEDBACK_FORM_URL)) {
      const a = document.createElement('a');
      a.className = 'arcio-action-link';
      a.href = FEEDBACK_FORM_URL;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open feedback form ↗';
      msg.appendChild(document.createElement('br'));
      msg.appendChild(a);
    }
    if (res.followups && res.followups.length) {
      const holder = document.createElement('div');
      holder.className = 'arcio-followups';
      holder.appendChild(makeChips(res.followups));
      body.appendChild(holder);
    }
    scrollDown();
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'arcio-msg arcio-msg-bot arcio-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(el);
    scrollDown();
    return el;
  }

  function renderWelcome() {
    body.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'arcio-msg arcio-msg-bot';
    msg.innerHTML = 'Hello! 👋 I am your <strong>ARCIO Virtual Assistant</strong>. Ask me about the labs, wiring, XP, your certificate, the Playground or your account. If something is outside ARCIO, I\'ll tell you I don\'t know:';
    msg.appendChild(makeChips(CHATBOT_SUGGESTED_PROMPTS));
    body.appendChild(msg);
  }

  // 5. Panel toggle
  function openChat() { panel.classList.add('open'); chatInput.focus(); }
  function closeChat() { panel.classList.remove('open'); }

  launcher.addEventListener('click', () => (panel.classList.contains('open') ? closeChat() : openChat()));
  closeBtn.addEventListener('click', closeChat);
  clearBtn.addEventListener('click', () => { resetChatbotContext(); renderWelcome(); chatInput.focus(); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

  // 6. Sending
  let busy = false;
  function sendUserMessage(text) {
    const userText = (text || chatInput.value || '').trim();
    if (!userText || busy) return;

    // remove old follow-up chips so only the latest ones stay clickable
    body.querySelectorAll('.arcio-followups').forEach(el => el.remove());

    appendMessage('user', userText);
    chatInput.value = '';
    busy = true;

    const typing = showTyping();
    setTimeout(() => {
      let res;
      try {
        res = queryChatbot(userText);
      } catch (err) {
        console.error('[ARCIO chatbot]', err);
        res = { text: "Sorry, I don't know — something went wrong on my side. Please try again.", followups: [] };
      }
      typing.remove();
      appendBotResponse(res);
      busy = false;
    }, 320);
  }

  renderWelcome();
  sendBtn.addEventListener('click', () => sendUserMessage());

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendUserMessage();
    }
  });
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
}
