/* ==========================================================================
   VEXEL AI CLIENT INTERACTION JS — Connected to Flask Backend
   ========================================================================== */

const BACKEND_URL = '/chat';

const consoleOverlay = document.getElementById('consoleOverlay');
const chatInput = document.getElementById('chatInput');
const chatContainer = document.getElementById('chatContainer');
const btnSend = document.getElementById('btnSend');
const sessionList = document.getElementById('sessionList');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const mobileMenu = document.getElementById('mobileMenu');

let activeSessionId = null;
let chatHistory = {};

document.addEventListener('DOMContentLoaded', () => {
  loadSessionsFromStorage();
  setupEventListeners();
});

function setupEventListeners() {
  mobileNavToggle.addEventListener('click', toggleMobileMenu);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  });
}

function toggleMobileMenu() {
  const isVisible = mobileMenu.style.display === 'flex';
  mobileMenu.style.display = isVisible ? 'none' : 'flex';
  mobileNavToggle.innerHTML = isVisible ? '<i class="fa-solid fa-bars"></i>' : '<i class="fa-solid fa-xmark"></i>';
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function openConsole() {
  consoleOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  if (Object.keys(chatHistory).length === 0) {
    startNewChat();
  } else if (!activeSessionId) {
    selectSession(Object.keys(chatHistory)[0]);
  }
}

function closeConsole() {
  consoleOverlay.classList.remove('show');
  document.body.style.overflow = 'auto';
}

function tryToolQuery(queryText) {
  openConsole();
  setTimeout(() => {
    chatInput.value = queryText;
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
    chatInput.focus();
  }, 100);
}

/* ==========================================================================
   SESSION HISTORY MANAGEMENT
   ========================================================================== */

function loadSessionsFromStorage() {
  const stored = localStorage.getItem('vexel_chat_history');
  if (stored) {
    try {
      chatHistory = JSON.parse(stored);
      renderSessionList();
    } catch (e) {
      chatHistory = {};
    }
  }
}

function saveSessionsToStorage() {
  localStorage.setItem('vexel_chat_history', JSON.stringify(chatHistory));
  renderSessionList();
}

function startNewChat() {
  const sessionId = 'session_' + Date.now();
  chatHistory[sessionId] = {
    name: "New Research Session",
    messages: [{
      role: 'agent',
      text: "Hello! I am your agentic research assistant powered by Llama-3.3-70b via Groq. I have access to 9 tools: Web Search, Wikipedia, Math, Weather, Currency, Units, News, Date math, and Random Facts. Ask me anything!"
    }]
  };
  activeSessionId = sessionId;
  saveSessionsToStorage();
  selectSession(sessionId);
}

function selectSession(sessionId) {
  activeSessionId = sessionId;
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === sessionId);
  });
  renderMessages();
}

function renderSessionList() {
  sessionList.innerHTML = '';
  const sortedIds = Object.keys(chatHistory).sort((a, b) => b.split('_')[1] - a.split('_')[1]);
  sortedIds.forEach(id => {
    const session = chatHistory[id];
    const div = document.createElement('div');
    div.className = `session-item ${id === activeSessionId ? 'active' : ''}`;
    div.dataset.id = id;
    div.innerHTML = `<i class="fa-regular fa-comments"></i> <span>${escapeHtml(session.name)}</span>`;
    div.addEventListener('click', () => selectSession(id));
    sessionList.appendChild(div);
  });
}

function clearHistory() {
  if (confirm("Are you sure you want to delete all chat history?")) {
    chatHistory = {};
    activeSessionId = null;
    localStorage.removeItem('vexel_chat_history');
    renderSessionList();
    chatContainer.innerHTML = '';
    startNewChat();
  }
}

/* ==========================================================================
   CHAT MESSAGES RENDERING
   ========================================================================== */

function renderMessages() {
  chatContainer.innerHTML = '';
  if (!activeSessionId || !chatHistory[activeSessionId]) return;
  chatHistory[activeSessionId].messages.forEach(msg => {
    appendMessageHTML(msg.role, msg.text, msg.tools);
  });
  scrollToBottom();
}

function appendMessageHTML(role, text, toolsUsed) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${role}`;
  const isAgent = role === 'agent';
  const icon = isAgent ? 'fa-robot' : 'fa-user';
  const sender = isAgent ? 'Vexel Assistant' : 'You';

  let toolLogsHtml = '';
  if (isAgent && toolsUsed && toolsUsed.length > 0) {
    toolsUsed.forEach(t => {
      toolLogsHtml += `
        <div class="msg-tool-log">
          <i class="fa-solid fa-gear fa-spin"></i>
          <span>Executed tool: <strong>${escapeHtml(t)}</strong></span>
        </div>`;
    });
  }

  msgDiv.innerHTML = `
    <div class="avatar"><i class="fa-solid ${icon}"></i></div>
    <div class="msg-content-wrapper">
      <div class="msg-sender">${sender}</div>
      <div class="msg-text">${escapeHtml(text)}</div>
      ${toolLogsHtml}
    </div>`;
  chatContainer.appendChild(msgDiv);
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   BACKEND API COMMUNICATION — Flask at /chat
   ========================================================================== */

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !activeSessionId) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Save user message
  chatHistory[activeSessionId].messages.push({ role: 'user', text });

  // Auto-rename session on first real message
  if (chatHistory[activeSessionId].name === "New Research Session") {
    chatHistory[activeSessionId].name = text.length > 22 ? text.substring(0, 22) + '...' : text;
  }

  saveSessionsToStorage();
  renderMessages();

  // Show loader
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'chat-msg agent';
  loaderDiv.id = 'activeLoader';
  loaderDiv.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="msg-content-wrapper">
      <div class="msg-sender">Vexel Assistant</div>
      <div class="chat-loader"><span></span><span></span><span></span></div>
    </div>`;
  chatContainer.appendChild(loaderDiv);
  scrollToBottom();

  chatInput.disabled = true;
  btnSend.disabled = true;
  triggerTelemetryScanning(true);

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) throw new Error(`Server returned ${response.status}`);

    const data = await response.json();

    document.getElementById('activeLoader')?.remove();
    triggerTelemetryScanning(false);

    // Flash the exact tools used in the telemetry panel
    flashTelemetryTools(data.tools || []);

    const agentReply = data.answer || "I received a response but couldn't extract the final answer.";

    chatHistory[activeSessionId].messages.push({
      role: 'agent',
      text: agentReply,
      tools: data.tools || []
    });

    saveSessionsToStorage();
    renderMessages();

  } catch (error) {
    document.getElementById('activeLoader')?.remove();
    triggerTelemetryScanning(false);

    const errMsg = `Could not reach the Vexel backend. Make sure app.py is running.\n\nError: ${error.message}`;
    chatHistory[activeSessionId].messages.push({ role: 'agent', text: errMsg });
    saveSessionsToStorage();
    renderMessages();
  } finally {
    chatInput.disabled = false;
    btnSend.disabled = false;
    chatInput.focus();
  }
}

/* ==========================================================================
   TELEMETRY PANEL LOGIC
   ========================================================================== */

let scanInterval = null;

function triggerTelemetryScanning(start) {
  document.querySelectorAll('.telemetry-tool').forEach(el => el.classList.remove('active-tool'));

  if (!start) {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    return;
  }

  const tools = document.querySelectorAll('.telemetry-tool');
  let idx = 0;
  scanInterval = setInterval(() => {
    tools.forEach(el => el.classList.remove('active-tool'));
    tools[idx].classList.add('active-tool');
    idx = (idx + 1) % tools.length;
  }, 300);
}

function flashTelemetryTools(toolsList) {
  document.querySelectorAll('.telemetry-tool').forEach(el => el.classList.remove('active-tool'));
  if (!toolsList || toolsList.length === 0) return;

  toolsList.forEach((toolName, index) => {
    setTimeout(() => {
      const el = document.getElementById(`t_${toolName}`);
      if (el) {
        el.classList.add('active-tool');
        setTimeout(() => el.classList.remove('active-tool'), 3000);
      }
    }, index * 800);
  });
}
