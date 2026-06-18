/* ==========================================================================
   VEXEL AI CLIENT INTERACTION JS
   ========================================================================== */

// DOM Elements
const consoleOverlay = document.getElementById('consoleOverlay');
const chatInput = document.getElementById('chatInput');
const chatContainer = document.getElementById('chatContainer');
const btnSend = document.getElementById('btnSend');
const sessionList = document.getElementById('sessionList');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const mobileMenu = document.getElementById('mobileMenu');

// Application State
let activeSessionId = null;
let chatHistory = {}; // Format: { sessionId: { name: string, messages: Array } }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadSessionsFromStorage();
  setupEventListeners();
});

// Setup Events
function setupEventListeners() {
  // Mobile Nav Toggle
  mobileNavToggle.addEventListener('click', toggleMobileMenu);

  // Send message on Enter key (without shift)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-grow textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  });
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const isVisible = mobileMenu.style.display === 'flex';
  mobileMenu.style.display = isVisible ? 'none' : 'flex';
  mobileNavToggle.innerHTML = isVisible ? '<i class="fa-solid fa-bars"></i>' : '<i class="fa-solid fa-xmark"></i>';
}

// Scroll Helper
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

// Launch Console Dialog
function openConsole() {
  consoleOverlay.classList.add('show');
  document.body.style.overflow = 'hidden'; // Stop page scrolling
  
  // Create first session if none exists
  if (Object.keys(chatHistory).length === 0) {
    startNewChat();
  } else if (!activeSessionId) {
    selectSession(Object.keys(chatHistory)[0]);
  }
}

// Close Console Dialog
function closeConsole() {
  consoleOverlay.classList.remove('show');
  document.body.style.overflow = 'auto';
}

// Quick Try links from Landing Page Cards
function tryToolQuery(queryText) {
  openConsole();
  chatInput.value = queryText;
  chatInput.style.height = 'auto';
  chatInput.style.height = (chatInput.scrollHeight) + 'px';
  chatInput.focus();
}

/* ==========================================================================
   SESSION HISTORY MANAGEMENT (localStorage)
   ========================================================================== */

function loadSessionsFromStorage() {
  const stored = localStorage.getItem('vexel_chat_history');
  if (stored) {
    try {
      chatHistory = JSON.parse(stored);
      renderSessionList();
    } catch (e) {
      console.error("Error loading chat history:", e);
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
    messages: [
      {
        role: 'agent',
        text: "Hello! I am your agentic research assistant. I have access to 9 tools (Web Search, Wikipedia, Math, Weather, Currency, Units, News, Date math, and Random Facts). Ask me any multi-step problem, and I'll solve it!"
      }
    ]
  };
  activeSessionId = sessionId;
  saveSessionsToStorage();
  selectSession(sessionId);
}

function selectSession(sessionId) {
  activeSessionId = sessionId;
  
  // Highlight active session item
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === sessionId);
  });

  // Render chat messages
  renderMessages();
}

function renderSessionList() {
  sessionList.innerHTML = '';
  const sortedIds = Object.keys(chatHistory).sort((a,b) => b.split('_')[1] - a.split('_')[1]); // Sort newest first

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
   CHAT MESSAGES RENDERING & SENDING
   ========================================================================== */

function renderMessages() {
  chatContainer.innerHTML = '';
  if (!activeSessionId || !chatHistory[activeSessionId]) return;

  const messages = chatHistory[activeSessionId].messages;
  messages.forEach(msg => {
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
        </div>
      `;
    });
  }

  msgDiv.innerHTML = `
    <div class="avatar"><i class="fa-solid ${icon}"></i></div>
    <div class="msg-content-wrapper">
      <div class="msg-sender">${sender}</div>
      <div class="msg-text">${escapeHtml(text)}</div>
      ${toolLogsHtml}
    </div>
  `;

  chatContainer.appendChild(msgDiv);
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// HTML Escaper helper
function escapeHtml(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   BACKEND API COMMUNICATION & TELEMETRY FLOW
   ========================================================================== */

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !activeSessionId) return;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Save User message to history
  chatHistory[activeSessionId].messages.push({ role: 'user', text });
  
  // Dynamically rename session based on first query
  if (chatHistory[activeSessionId].name === "New Research Session") {
    chatHistory[activeSessionId].name = text.length > 22 ? text.substring(0, 22) + '...' : text;
  }
  
  saveSessionsToStorage();
  renderMessages();

  // Create loading element
  const loaderDiv = document.createElement('div');
  loaderDiv.className = 'chat-msg agent';
  loaderDiv.id = 'activeLoader';
  loaderDiv.innerHTML = `
    <div class="avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="msg-content-wrapper">
      <div class="msg-sender">Vexel Assistant</div>
      <div class="chat-loader">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  chatContainer.appendChild(loaderDiv);
  scrollToBottom();

  // Disable input & send button during fetch
  chatInput.disabled = true;
  btnSend.disabled = true;

  // Visual feedback for thinking model state
  triggerTelemetryScanning(true);

  try {
    // Perform API Request to Flask server
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) {
      throw new Error(`Server returned code ${response.status}`);
    }

    const data = await response.json();
    
    // Remove loader
    const loader = document.getElementById('activeLoader');
    if (loader) loader.remove();

    // Visual feedback of tools used (flashing indicators in order)
    triggerTelemetryScanning(false);
    flashTelemetryTools(data.tools || []);

    // Save Agent reply
    const agentReply = data.answer || "I parsed the response but couldn't find a final answer.";
    chatHistory[activeSessionId].messages.push({
      role: 'agent',
      text: agentReply,
      tools: data.tools || []
    });

    saveSessionsToStorage();
    renderMessages();

  } catch (error) {
    console.error("API Call error:", error);
    
    // Remove loader
    const loader = document.getElementById('activeLoader');
    if (loader) loader.remove();
    
    triggerTelemetryScanning(false);

    // Save Error Message
    chatHistory[activeSessionId].messages.push({
      role: 'agent',
      text: `Failed to get a response from Vexel. Make sure the backend Flask app is running at http://localhost:5000.\n\nError details: ${error.message}`
    });
    
    saveSessionsToStorage();
    renderMessages();
  } finally {
    // Re-enable inputs
    chatInput.disabled = false;
    btnSend.disabled = false;
    chatInput.focus();
  }
}

/* ==========================================================================
   TELEMETRY RENDERING LOGIC
   ========================================================================== */

let scanInterval = null;

// While loading, make indicators pulse/glow sequentially to show "scanning"
function triggerTelemetryScanning(start) {
  // Clear any active tool indicators
  document.querySelectorAll('.telemetry-tool').forEach(el => el.classList.remove('active-tool'));
  
  if (!start) {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    return;
  }

  const tools = document.querySelectorAll('.telemetry-tool');
  let currentIdx = 0;
  
  scanInterval = setInterval(() => {
    // Remove active state from last
    tools.forEach(el => el.classList.remove('active-tool'));
    // Set active to current
    tools[currentIdx].classList.add('active-tool');
    currentIdx = (currentIdx + 1) % tools.length;
  }, 300);
}

// Flash the exact tools used by the agent during the response
function flashTelemetryTools(toolsList) {
  // Clear any existing active classes
  document.querySelectorAll('.telemetry-tool').forEach(el => el.classList.remove('active-tool'));

  if (!toolsList || toolsList.length === 0) return;

  toolsList.forEach((toolName, index) => {
    // Highlight match
    setTimeout(() => {
      const el = document.getElementById(`t_${toolName}`);
      if (el) {
        el.classList.add('active-tool');
        
        // Remove after 3 seconds
        setTimeout(() => {
          el.classList.remove('active-tool');
        }, 3000);
      }
    }, index * 800); // 800ms stagger between tools
  });
}
