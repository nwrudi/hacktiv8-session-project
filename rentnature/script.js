const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendButton = form.querySelector('button[type="submit"]');

// Backend API URL
const API_URL = 'http://localhost:3000/api/chat';

// Conversation history stored for context
const conversation = [];

// Helper to escape HTML and format basic markdown including tables
function formatMarkdown(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Parse Markdown Tables to styled HTML Table
  const tableRegex = /((?:\|[^\n\r]+\|\r?\n?)+)/g;
  escaped = escaped.replace(tableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return match;

    let html = '<div style="overflow-x:auto; margin: 8px 0; border-radius: 8px; border: 1px solid #d1e7dd;"><table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; background: #fff;">';
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^\|[-:\s|]+$/.test(line)) {
        isHeader = false;
        continue;
      }

      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (isHeader) {
        html += '<thead style="background: #198754; color: #fff;"><tr>';
        cells.forEach(c => html += `<th style="padding: 6px 10px; border-bottom: 2px solid #146c43; white-space: nowrap;">${c}</th>`);
        html += '</tr></thead><tbody>';
      } else {
        html += '<tr style="border-bottom: 1px solid #e9ecef;">';
        cells.forEach(c => html += `<td style="padding: 6px 10px; color: #212529; white-space: nowrap;">${c}</td>`);
        html += '</tr>';
      }
    }
    html += '</tbody></table></div>';
    return html;
  });

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// Function to append messages to the chat box
function appendMessage(sender, text, isHtml = false) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);

  if (isHtml) {
    msg.innerHTML = text;
  } else {
    msg.innerHTML = formatMarkdown(text);
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

// Show a temporary typing indicator while waiting for Gemini
function showTypingIndicator() {
  const loadingMsg = document.createElement('div');
  loadingMsg.classList.add('message', 'bot', 'loading');
  loadingMsg.innerHTML = '<span class="typing-indicator">Gemini sedang mengetik...</span>';
  chatBox.appendChild(loadingMsg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return loadingMsg;
}

// Display an initial greeting from the assistant
function initGreeting() {
  if (chatBox && chatBox.children.length === 0) {
    appendMessage(
      'bot',
      'Halo Kak! 👋 Ada yang bisa kami bantu seputar unit rental, tarif sewa, atau jasa guide hari ini? Tanya aja, siap bantu rekomendasi terbaik! ✨'
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGreeting);
} else {
  initGreeting();
}

// Handle message submission
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Append user message to UI & history
  appendMessage('user', userMessage);
  conversation.push({ role: 'user', text: userMessage });

  // Clear & disable inputs while processing
  input.value = '';
  input.disabled = true;
  if (sendButton) sendButton.disabled = true;

  // Show typing indicator
  const typingIndicator = showTypingIndicator();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error (Status: ${response.status})`);
    }

    const data = await response.json();
    const botReply = data.result || 'Maaf, tidak ada respon dari bot.';

    // Remove typing indicator
    typingIndicator.remove();

    // Append bot reply to UI & history
    appendMessage('bot', botReply);
    conversation.push({ role: 'bot', text: botReply });
  } catch (error) {
    console.error('Chat API Error:', error);
    typingIndicator.remove();
    appendMessage(
      'bot',
      `⚠️ Terjadi masalah: ${error.message || 'Gagal terhubung ke backend'}. Pastikan server backend berjalan di port 3000.`
    );
  } finally {
    // Re-enable input and button
    input.disabled = false;
    if (sendButton) sendButton.disabled = false;
    input.focus();
  }
});

