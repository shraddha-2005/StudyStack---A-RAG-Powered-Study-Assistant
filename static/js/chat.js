// State Management
let currentSessionId = null;
let isProcessing = false;
let currentKBData = null;

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const emptyState = document.getElementById('emptyState');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const kbStatus = {
    files: document.getElementById('totalFiles'),
    chunks: document.getElementById('totalChunks')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    loadKnowledgeBaseStatus();
    setupEventListeners();
});

function setupEventListeners() {
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    newChatBtn.addEventListener('click', createNewSession);

    // Upload zone
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
}

async function createNewSession() {
    try {
        const response = await fetch('/api/sessions/create/', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            currentSessionId = data.session_id;
            clearChat();
            loadSessions();

            // Disable export buttons for new chat
            document.getElementById('exportPdfBtn').disabled = true;
            document.getElementById('exportWordBtn').disabled = true;
        }
    } catch (error) {
        console.error('Error creating session:', error);
        showToast('❌ Failed to create new session');
    }
}

async function loadSessions() {
    try {
        const response = await fetch('/api/sessions/');
        const data = await response.json();

        if (!data.success) {
            console.error('Failed to load sessions:', data.error);
            return;
        }

        chatHistory.innerHTML = '';
        data.sessions.forEach(session => {
            const item = createChatItem(session);
            chatHistory.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function createChatItem(session) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    if (session.id === currentSessionId) {
        div.classList.add('active');
    }

    div.innerHTML = `
        <div class="chat-item-title">${session.title}</div>
        <button class="chat-item-delete" onclick="deleteSession('${session.id}', event)">
            <i class="bi bi-trash"></i>
        </button>
    `;

    div.addEventListener('click', () => loadSession(session.id));
    return div;
}

async function loadSession(sessionId) {
    try {
        currentSessionId = sessionId;
        const response = await fetch(`/api/sessions/${sessionId}/messages/`);
        const data = await response.json();

        if (!data.success) {
            console.error('Failed to load messages:', data.error);
            return;
        }

        clearChat();
        data.messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.sources);
        });

        loadSessions();

        // Enable export if there are messages
        if (data.messages.length > 0) {
            document.getElementById('exportPdfBtn').disabled = false;
            document.getElementById('exportWordBtn').disabled = false;
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

async function deleteSession(sessionId, event) {
    event.stopPropagation();

    if (!confirm('Delete this conversation?')) return;

    try {
        const response = await fetch(`/api/sessions/${sessionId}/delete/`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            if (sessionId === currentSessionId) {
                createNewSession();
            }
            loadSessions();
            showToast('✅ Session deleted');
        }
    } catch (error) {
        console.error('Error deleting session:', error);
        showToast('❌ Failed to delete session');
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;

    if (!currentSessionId) {
        await createNewSession();
    }

    isProcessing = true;
    sendBtn.disabled = true;

    // Add user message
    addMessage('user', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Add thinking indicator
    const thinkingMsg = addThinkingMessage();

    try {
        const response = await fetch('/api/message/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                message: message
            })
        });

        const data = await response.json();

        // Remove thinking message
        thinkingMsg.remove();

        if (data.success) {
            // Add assistant response with typing animation
            addMessageWithTyping('assistant', data.answer, data.sources);

            // Reload sessions to update titles
            loadSessions();

            // Enable export buttons
            document.getElementById('exportPdfBtn').disabled = false;
            document.getElementById('exportWordBtn').disabled = false;
        } else {
            addMessage('assistant', '❌ Error: ' + (data.error || 'Unknown error'));
        }

    } catch (error) {
        thinkingMsg.remove();
        addMessage('assistant', '❌ Error: ' + error.message);
        showToast('❌ Failed to send message');
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
    }
}

function addThinkingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <span class="thinking">Thinking<span class="dots"></span></span>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

function addMessage(role, content, sources = null) {
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';

    let html = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content" style="position: relative;">
            <div class="message-text">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
    `;

    // ✅ FIX: Add copy button WITHOUT inline onclick
    if (role === 'assistant') {
        html += `
            <button class="copy-btn" data-copy-content="true">
                <i class="bi bi-clipboard"></i> Copy
            </button>
        `;
    }

    // Add sources
    if (sources && sources.length > 0) {
        html += `<div class="message-sources">
            <strong>📚 Sources:</strong><br>`;

        sources.forEach(s => {
            if (s.source_type === 'generated') {
                html += `<span class="source-item source-generated">
                    <i class="bi bi-stars"></i> ${escapeHtml(s.title)}
                 </span>`;
            } else {
                html += `<span class="source-item source-link" data-source-title="${escapeHtml(s.title)}" data-source-chunk="${escapeHtml(s.chunk)}">
                    <i class="bi bi-book"></i> ${escapeHtml(s.title)} — ${escapeHtml(s.chunk)}
                 </span>`;
            }
        });

        html += `</div>`;
    }

    html += `</div>`;
    messageDiv.innerHTML = html;

    // ✅ FIX: Attach event listener to copy button AFTER adding to DOM
    chatContainer.appendChild(messageDiv);

    // Store the original content (not HTML) for copying
    messageDiv.dataset.originalContent = content;

    // Attach copy button event
    const copyBtn = messageDiv.querySelector('.copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const contentToCopy = messageDiv.dataset.originalContent;
            copyToClipboard(contentToCopy);
        });
    }

    // Attach source link events
    const sourceLinks = messageDiv.querySelectorAll('.source-link');
    sourceLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const title = this.dataset.sourceTitle;
            const chunk = this.dataset.sourceChunk;
            showSourceInKB(title, chunk);
        });
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv;
}

function addMessageWithTyping(role, content, sources = null) {
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content" style="position: relative;">
            <div class="message-text"></div>
        </div>
    `;

    chatContainer.appendChild(messageDiv);
    const textDiv = messageDiv.querySelector('.message-text');

    // Store original content for copying
    messageDiv.dataset.originalContent = content;

    // Typing animation
    typeMessage(textDiv, content, () => {
        // Add copy button after typing
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
        copyBtn.addEventListener('click', function (e) {
            e.preventDefault();
            copyToClipboard(messageDiv.dataset.originalContent);
        });
        messageDiv.querySelector('.message-content').appendChild(copyBtn);

        // Add sources
        if (sources && sources.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'message-sources';
            sourcesDiv.innerHTML = `<strong>📚 Sources:</strong><br>`;

            sources.forEach(s => {
                const sourceSpan = document.createElement('span');

                if (s.source_type === 'generated') {
                    sourceSpan.className = 'source-item source-generated';
                    sourceSpan.innerHTML = `<i class="bi bi-stars"></i> ${escapeHtml(s.title)}`;
                } else {
                    sourceSpan.className = 'source-item source-link';
                    sourceSpan.innerHTML = `<i class="bi bi-book"></i> ${escapeHtml(s.title)} — ${escapeHtml(s.chunk)}`;
                    sourceSpan.addEventListener('click', () => {
                        showSourceInKB(s.title, s.chunk);
                    });
                }

                sourcesDiv.appendChild(sourceSpan);
            });

            messageDiv.querySelector('.message-content').appendChild(sourcesDiv);
        }
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

// ✅ Test the copy functionality
console.log('✅ Copy functionality loaded!');

function typeMessage(element, text, callback, speed = 5) {
    let i = 0;
    element.innerHTML = '';

    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    cursor.textContent = '▊';
    element.appendChild(cursor);

    function type() {
        if (i < text.length) {
            const char = text.charAt(i);
            if (char === '\n') {
                element.insertBefore(document.createElement('br'), cursor);
            } else {
                const textNode = document.createTextNode(char);
                element.insertBefore(textNode, cursor);
            }
            i++;
            chatContainer.scrollTop = chatContainer.scrollHeight;
            setTimeout(type, speed);
        } else {
            cursor.remove();
            if (callback) callback();
        }
    }

    type();
}

function clearChat() {
    chatContainer.innerHTML = '';
}

async function handleFiles(files) {
    for (const file of files) {
        await uploadFileWithProgress(file);
    }
}

async function uploadFileWithProgress(file) {
    const safeId = file.name.replace(/[^a-zA-Z0-9]/g, '_');

    const fileItemDiv = document.createElement('div');
    fileItemDiv.style.cssText = 'padding:12px; background:#1e2d3d; border-radius:10px; margin-bottom:10px;';

    fileItemDiv.innerHTML = `
        <div style="font-weight:700; color:#ffffff; margin-bottom:8px;">${file.name}</div>
        <div style="margin-bottom:8px;">
            <div id="stage-upload-${safeId}"   style="color:#64748b; padding:2px 0; font-size:0.88rem;"><span>⏸️</span> Uploading</div>
            <div id="stage-extract-${safeId}"  style="color:#64748b; padding:2px 0; font-size:0.88rem;"><span>⏸️</span> Extracting Content</div>
            <div id="stage-chunk-${safeId}"    style="color:#64748b; padding:2px 0; font-size:0.88rem;"><span>⏸️</span> Creating Chunks</div>
            <div id="stage-embed-${safeId}"    style="color:#64748b; padding:2px 0; font-size:0.88rem;"><span>⏸️</span> Generating Embeddings</div>
        </div>
        <div style="background:#2a4a6b; border-radius:10px; height:8px; overflow:hidden; margin-bottom:6px;">
            <div id="progress-${safeId}" style="height:100%; width:0%; background:#0ea5e9; border-radius:10px; transition:width 0.3s;"></div>
        </div>
        <div id="status-${safeId}" style="color:#94a3b8; font-size:0.85rem;">Starting...</div>
    `;

    fileList.appendChild(fileItemDiv);

    const formData = new FormData();
    formData.append('file', file);

    try {
        updateStage(`stage-upload-${safeId}`, 'processing');
        updateProgress(safeId, 10, 'Uploading file...');

        const uploadResponse = await fetch('/api/upload/', { method: 'POST', body: formData });
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) throw new Error(uploadData.error || 'Upload failed');

        updateStage(`stage-upload-${safeId}`, 'complete');
        updateProgress(safeId, 25, 'Upload complete');

        updateStage(`stage-extract-${safeId}`, 'processing');
        updateProgress(safeId, 40, 'Extracting content...');

        const processResponse = await fetch(`/api/process/${uploadData.file_id}/`, { method: 'POST' });
        const processData = await processResponse.json();
        if (!processData.success) throw new Error(processData.error || 'Processing failed');

        updateStage(`stage-extract-${safeId}`, 'complete');
        updateStage(`stage-chunk-${safeId}`, 'processing');
        updateProgress(safeId, 60, 'Creating chunks...');

        await new Promise(resolve => setTimeout(resolve, 1000));
        updateStage(`stage-chunk-${safeId}`, 'complete');

        updateStage(`stage-embed-${safeId}`, 'processing');
        updateProgress(safeId, 80, 'Generating embeddings...');
        updateStage(`stage-embed-${safeId}`, 'complete');

        updateProgress(safeId, 100, `✅ Processed (${processData.chunks} chunks)`);
        await loadKnowledgeBaseStatus();
        showToast(`✅ ${file.name} added to knowledge base!`);

    } catch (error) {
        console.error('❌ Upload error:', error);
        ['upload', 'extract', 'chunk', 'embed'].forEach(s => {
            const el = document.getElementById(`stage-${s}-${safeId}`);
            if (el && el.dataset.status === 'processing') {
                updateStage(`stage-${s}-${safeId}`, 'error');
            }
        });
        updateProgress(safeId, 0, '❌ Error: ' + error.message);
        showToast('❌ Upload failed: ' + error.message);
    }
}

function updateStage(stageId, status) {
    const el = document.getElementById(stageId);
    if (!el) return;

    el.dataset.status = status;

    // Get the text label (last text node) - works in all browsers
    const textMap = {
        'upload': 'Uploading',
        'extract': 'Extracting Content',
        'chunk': 'Creating Chunks',
        'embed': 'Generating Embeddings'
    };

    // Find which stage this is by id
    const stageKey = Object.keys(textMap).find(k => stageId.includes(`stage-${k}-`));
    const label = stageKey ? textMap[stageKey] : '';

    let icon = '⏸️';
    if (status === 'processing') icon = '⏳';
    else if (status === 'complete') icon = '✓';
    else if (status === 'error') icon = '✗';

    // Rebuild innerHTML completely - no regex, no browser differences
    el.innerHTML = `<span>${icon}</span> ${label}`;

    if (status === 'processing' || status === 'complete') {
        el.style.color = '#0ea5e9';
        el.style.fontWeight = '600';
    } else if (status === 'error') {
        el.style.color = '#f87171';
        el.style.fontWeight = '600';
    } else {
        el.style.color = '#64748b';
        el.style.fontWeight = 'normal';
    }
}

function updateProgress(safeId, percent, message) {
    const bar = document.getElementById(`progress-${safeId}`);
    const status = document.getElementById(`status-${safeId}`);

    if (bar) bar.style.width = percent + '%';

    if (status) {
        status.textContent = message;
        if (message.startsWith('❌')) {
            status.style.color = '#f87171';
            status.style.fontWeight = '600';
        } else if (message.startsWith('✅') || percent === 100) {
            status.style.color = '#0ea5e9';
            status.style.fontWeight = '600';
        } else {
            status.style.color = '#94a3b8';
            status.style.fontWeight = 'normal';
        }
    }
}

async function loadKnowledgeBaseStatus() {
    try {
        const response = await fetch('/api/knowledge-base/');
        const data = await response.json();

        console.log('📊 Knowledge Base Status:', data);

        if (data.success) {
            kbStatus.files.textContent = data.total_files;
            kbStatus.chunks.textContent = data.total_chunks;
        }
    } catch (error) {
        console.error('Error loading KB status:', error);
    }
}

async function loadKnowledgeBaseModal() {
    try {
        const response = await fetch('/api/knowledge-base/details/');
        const data = await response.json();

        console.log('📚 Knowledge Base Details:', data);

        if (!data.success) {
            console.error('Failed to load KB details:', data.error);
            return;
        }

        currentKBData = data;

        const fileList = document.getElementById('kbFileList');
        fileList.innerHTML = '';

        if (data.files && data.files.length > 0) {
            data.files.forEach((file, index) => {
                const fileItem = document.createElement('a');
                fileItem.className = 'list-group-item list-group-item-action kb-file-item';

                // Determine icon based on type
                let icon = 'file-earmark-text';
                if (file.type === 'pdf') icon = 'file-pdf';
                else if (file.type === 'video') icon = 'camera-video';
                else if (file.type === 'docx') icon = 'file-word';
                else if (file.type === 'txt') icon = 'file-text';

                fileItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div>
                            <i class="bi bi-${icon}"></i>
                            <strong class="ms-2">${file.title}</strong>
                        </div>
                        <span class="badge bg-secondary">${file.total_chunks} chunks</span>
                    </div>
                `;

                fileItem.addEventListener('click', () => {
                    document.querySelectorAll('.kb-file-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    fileItem.classList.add('active');
                    displayChunks(file);
                });

                fileList.appendChild(fileItem);
            });
        } else {
            fileList.innerHTML = '<div class="text-center text-muted p-3">No files uploaded yet</div>';
        }

    } catch (error) {
        console.error('Error loading KB:', error);
        showToast('❌ Failed to load knowledge base');
    }
}

function displayChunks(file) {
    const chunksList = document.getElementById('kbChunksList');
    chunksList.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'mb-3';
    header.innerHTML = `
        <h6>${file.title}</h6>
        <small class="text-muted">${file.type.toUpperCase()} • ${file.total_chunks} chunks</small>
    `;
    chunksList.appendChild(header);

    file.chunks.forEach(chunk => {
        const chunkCard = document.createElement('div');
        chunkCard.className = 'chunk-card';
        chunkCard.innerHTML = `
            <div class="chunk-header">
                <span class="chunk-number">Chunk ${chunk.number}</span>
                ${chunk.start && chunk.start !== 'N/A' ? `<small class="text-muted">${formatTime(chunk.start)} - ${formatTime(chunk.end)}</small>` : ''}
            </div>
            <div class="chunk-preview">${chunk.text}</div>
        `;

        chunkCard.addEventListener('click', () => {
            showChunkDetail(chunk);
        });

        chunksList.appendChild(chunkCard);
    });
}

function showChunkDetail(chunk) {
    const detailContent = document.getElementById('chunkDetailContent');
    detailContent.innerHTML = `
        <div class="mb-3">
            <h6>Chunk ${chunk.number}</h6>
            ${chunk.start && chunk.start !== 'N/A' ? `<small class="text-muted">Time: ${formatTime(chunk.start)} - ${formatTime(chunk.end)}</small>` : ''}
        </div>
        <div class="card bg-dark border-secondary p-3">
            <pre style="white-space: pre-wrap; margin: 0; color: #ececf1; font-family: inherit;">${chunk.full_text}</pre>
        </div>
    `;

    const chunkModal = new bootstrap.Modal(document.getElementById('chunkDetailModal'));
    chunkModal.show();
}

function formatTime(seconds) {
    if (!seconds || seconds === 'N/A') return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function showSourceInKB(title, chunkNumber) {
    try {
        await loadKnowledgeBaseModal();

        const file = currentKBData.files.find(f => f.title === title);
        if (!file) {
            showToast('⚠️ File not found in knowledge base');
            return;
        }

        const kbModal = new bootstrap.Modal(document.getElementById('knowledgeBaseModal'));
        kbModal.show();

        setTimeout(() => {
            const fileItems = document.querySelectorAll('.kb-file-item');
            const fileIndex = currentKBData.files.findIndex(f => f.title === title);
            if (fileIndex >= 0 && fileItems[fileIndex]) {
                fileItems[fileIndex].click();

                setTimeout(() => {
                    const chunks = document.querySelectorAll('.chunk-card');
                    const chunkIndex = file.chunks.findIndex(c => c.number === chunkNumber);
                    if (chunkIndex >= 0 && chunks[chunkIndex]) {
                        chunks[chunkIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        chunks[chunkIndex].style.border = '2px solid var(--primary-color)';
                        setTimeout(() => {
                            chunks[chunkIndex].style.border = '1px solid var(--border-color)';
                        }, 2000);
                    }
                }, 300);
            }
        }, 300);

    } catch (error) {
        console.error('Error showing source:', error);
        showToast('❌ Could not load source details');
    }
}

function copyToClipboard(text) {
    // Method 1: Modern Clipboard API (preferred)
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast('✅ Copied to clipboard!');
                // Optional: Visual feedback on button
                const btn = event?.target?.closest('.copy-btn');
                if (btn) {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-check"></i> Copied!';
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                    }, 2000);
                }
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopy(text);
            });
    } else {
        // Method 2: Fallback for older browsers or non-HTTPS
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    try {
        // Create temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);

        // Select and copy
        textarea.focus();
        textarea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
            showToast('✅ Copied to clipboard!');
        } else {
            throw new Error('Copy command failed');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showToast('❌ Copy failed - please copy manually');
        // Show text in alert as last resort
        prompt('Copy this text manually:', text);
    }
}

// ✅ Helper: Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function exportChat(format) {
    if (!currentSessionId) {
        showToast('⚠️ No chat session selected');
        return;
    }

    // Show loading toast
    showToast(`📥 Exporting as ${format.toUpperCase()}...`);

    try {
        // Determine endpoint
        const endpoint = format === 'pdf'
            ? `/api/export/pdf/${currentSessionId}/`
            : `/api/export/word/${currentSessionId}/`;

        // Make POST request
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.status} ${response.statusText}`);
        }

        // Get the blob
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_export_${currentSessionId}.${format === 'pdf' ? 'pdf' : 'docx'}`;

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast(`✅ Exported as ${format.toUpperCase()}!`);

    } catch (error) {
        console.error('Export error:', error);
        showToast(`❌ Export failed: ${error.message}`);
    }
}

async function loadFileManagement() {
    try {
        const response = await fetch('/api/knowledge-base/details/');
        const data = await response.json();

        console.log('📁 File Management Data:', data);

        if (!data.success) {
            console.error('Failed to load file management:', data.error);
            showToast('❌ Failed to load files');
            return;
        }

        const container = document.getElementById('filesContainer');
        container.innerHTML = '';

        if (data.files && data.files.length > 0) {
            data.files.forEach((file, index) => {
                const fileCard = createFileCard(file, index);
                container.appendChild(fileCard);
            });
        } else {
            container.innerHTML = '<div class="text-center text-muted p-5">No files uploaded yet</div>';
        }
    } catch (error) {
        console.error('Error loading file management:', error);
        showToast('❌ Error loading files');
    }
}

function createFileCard(file, index) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.filename = file.title.toLowerCase();

    // Determine icon
    let icon = '📄';
    if (file.type === 'video') icon = '🎬';
    else if (file.type === 'docx') icon = '📝';
    else if (file.type === 'txt') icon = '📝';
    else if (file.type === 'pptx') icon = '📊';

    // Handle missing file ID
    const fileId = file.id;
    const hasId = fileId !== null && fileId !== undefined;

    console.log(`File: ${file.title}, ID: ${fileId}, hasId: ${hasId}`);

    card.innerHTML = `
        <div class="file-icon">${icon}</div>
        <div class="file-title">${file.title}</div>
        <div class="file-meta">
            ${file.total_chunks} chunks • ${file.type.toUpperCase()}
        </div>
        <div class="file-actions">
            ${hasId
            ? `<button class="file-delete-btn" onclick="deleteUploadedFileFromKB(${fileId}, '${file.title.replace(/'/g, "\\'")}')">
                    <i class="bi bi-trash"></i> Delete
                   </button>`
            : `<button class="file-delete-btn" onclick="deleteByTitle('${file.title.replace(/'/g, "\\'")}')">
                    <i class="bi bi-trash"></i> Delete (Legacy)
                   </button>`
        }
        </div>
    `;
    return card;
}

async function deleteByTitle(title) {
    if (!confirm(`⚠️ Delete "${title}" (Legacy File)?\n\nThis file doesn't have an ID. Deletion will:\n• Remove all chunks matching this title\n• May take longer than normal\n\nContinue?`)) {
        return;
    }

    try {
        showToast('🗑️ Deleting legacy file...');

        const response = await fetch('/api/files/delete-by-title/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: title })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`✅ ${data.message}`);
            await loadFileManagement();
            await loadKnowledgeBaseStatus();
        } else {
            showToast(`❌ Delete failed: ${data.error}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('❌ Network error while deleting file');
    }
}

async function deleteUploadedFileFromKB(fileId, fileName) {
    if (!confirm(`⚠️ Delete "${fileName}"?\n\nThis will permanently remove:\n• The file from knowledge base\n• All embeddings and chunks\n• The physical file\n\nThis cannot be undone!`)) {
        return;
    }

    try {
        showToast('🗑️ Deleting file...');

        const response = await fetch(`/api/files/${fileId}/`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast(`✅ ${data.message || 'File deleted successfully'}`);

            // Reload file management and KB status
            await loadFileManagement();
            await loadKnowledgeBaseStatus();
        } else {
            showToast(`❌ Delete failed: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        showToast('❌ Network error while deleting file');
    }
}

function toggleView(view) {
    const container = document.getElementById('filesContainer');
    const buttons = document.querySelectorAll('.view-btn');

    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.closest('.view-btn').classList.add('active');

    if (view === 'grid') {
        container.className = 'files-grid';
    } else {
        container.className = 'files-list';
    }
}

function filterFiles(searchTerm) {
    const cards = document.querySelectorAll('.file-card');
    searchTerm = searchTerm.toLowerCase();

    cards.forEach(card => {
        const filename = card.dataset.filename;
        card.style.display = filename.includes(searchTerm) ? '' : 'none';
    });
}

async function generateAndShowMCQs() {
    const topic = document.getElementById('mcqTopic').value;
    const count = document.getElementById('mcqCount')?.value || 5;

    if (!topic) {
        showToast('⚠️ Please enter a topic');
        return;
    }

    const output = document.getElementById('toolOutput');
    output.innerHTML = '<div class="text-center p-4"><div class="loading-dots"><span></span><span></span><span></span></div><p class="mt-2">Generating MCQs...</p></div>';

    try {
        const response = await fetch('/api/generate/mcqs/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                num_questions: parseInt(count)
            })
        });

        const data = await response.json();

        if (data.success && data.mcqs) {
            output.innerHTML = `
                <div class="mcq-display">
                    <h6 class="mb-3">📝 Generated MCQs: ${topic}</h6>
                    <pre style="white-space: pre-wrap; font-family: inherit;">${data.mcqs}</pre>
                </div>
            `;
            showToast('✅ MCQs generated successfully!');
        } else {
            throw new Error(data.error || 'Failed to generate MCQs');
        }
    } catch (error) {
        console.error('MCQ generation error:', error);
        output.innerHTML = '<div class="alert alert-danger">❌ Failed to generate MCQs: ' + error.message + '</div>';
        showToast('❌ MCQ generation failed');
    }
}

async function generateAndShowConceptMap() {
    const topic = document.getElementById('conceptTopic').value;

    if (!topic) {
        showToast('⚠️ Please enter a topic');
        return;
    }

    const output = document.getElementById('toolOutput');
    output.innerHTML = '<div class="text-center p-4"><div class="loading-dots"><span></span><span></span><span></span></div><p class="mt-2">Generating concept map...</p></div>';

    try {
        const response = await fetch('/api/generate/concept-map/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topic })
        });

        const data = await response.json();

        if (data.success && data.diagram) {
            // Extract mermaid code
            const mermaidMatch = data.diagram.match(/```mermaid([\s\S]*?)```/);
            if (mermaidMatch) {
                output.innerHTML = `
                    <div class="diagram-container">
                        <h6 class="mb-3">🗺️ Concept Map: ${topic}</h6>
                        <div class="mermaid">${mermaidMatch[1].trim()}</div>
                    </div>
                `;

                // Reinitialize mermaid
                if (typeof mermaid !== 'undefined') {
                    mermaid.init(undefined, '.mermaid');
                }
                showToast('✅ Concept map generated!');
            } else {
                throw new Error('Could not parse diagram');
            }
        } else {
            throw new Error(data.error || 'Failed to generate concept map');
        }
    } catch (error) {
        console.error('Concept map error:', error);
        output.innerHTML = '<div class="alert alert-danger">❌ Failed to generate concept map: ' + error.message + '</div>';
        showToast('❌ Concept map generation failed');
    }
}

(function () {
    // Wait for DOM to be ready
    function attachCleanupHandler() {
        const cleanupBtn = document.getElementById('cleanupBtn');

        if (!cleanupBtn) {
            console.warn('⚠️ Cleanup button not found');
            return;
        }

        // Remove any existing onclick
        cleanupBtn.onclick = null;
        cleanupBtn.removeAttribute('onclick');

        // Attach new handler
        cleanupBtn.addEventListener('click', async function () {
            console.log('🧹 Cleanup button clicked!');

            const confirmMsg = '🧹 COMPLETE CLEANUP\n\n' +
                'Remove:\n' +
                '✓ Orphaned chunks from embeddings\n' +
                '✓ Failed uploads from database\n' +
                '✓ Orphaned files from media/uploads\n\n' +
                'Continue?';

            if (!confirm(confirmMsg)) {
                return;
            }

            try {
                this.disabled = true;
                this.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cleaning...';

                let dbDeleted = 0;
                let chunksRemoved = 0;
                let mediaDeleted = 0;

                // Step 1: Clean database
                try {
                    const dbResponse = await fetch('/api/cleanup-database/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const dbResult = await dbResponse.json();
                    if (dbResult.success) {
                        dbDeleted = dbResult.deleted;
                    }
                } catch (error) {
                    console.warn('Database cleanup error:', error);
                }

                // Step 2: Clean embeddings
                try {
                    const embedResponse = await fetch('/api/cleanup-embeddings/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const embedResult = await embedResponse.json();
                    if (embedResult.success) {
                        chunksRemoved = embedResult.chunks_removed;
                    }
                } catch (error) {
                    console.warn('Embeddings cleanup error:', error);
                }

                // Step 3: Clean media files (NEW!)
                try {
                    const mediaResponse = await fetch('/api/cleanup-media/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const mediaResult = await mediaResponse.json();
                    if (mediaResult.success) {
                        mediaDeleted = mediaResult.deleted;
                    }
                } catch (error) {
                    console.warn('Media cleanup error:', error);
                }

                // Show results
                const message = `✅ CLEANUP COMPLETE!\n\n` +
                    `Database: ${dbDeleted} failed uploads deleted\n` +
                    `Embeddings: ${chunksRemoved} orphaned chunks removed\n` +
                    `Media Files: ${mediaDeleted} orphaned files deleted`;

                alert(message);

                // Refresh UI
                if (typeof loadFileManagement === 'function') {
                    await loadFileManagement();
                }
                if (typeof loadKnowledgeBaseStatus === 'function') {
                    await loadKnowledgeBaseStatus();
                }

            } catch (error) {
                console.error('❌ Cleanup failed:', error);
                alert('❌ Cleanup failed: ' + error.message);
            } finally {
                this.disabled = false;
                this.innerHTML = '<i class="bi bi-eraser"></i> Cleanup';
            }
        });

        console.log('✅ Cleanup button handler attached!');
    }

    // Try to attach immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachCleanupHandler);
    } else {
        attachCleanupHandler();
    }

    // Also try after a short delay (fallback)
    setTimeout(attachCleanupHandler, 1000);
})();

function showCleanupAlert(type, message, alertEl, contentEl) {
    alertEl.className = `alert alert-${type} alert-dismissible fade show`;
    contentEl.innerHTML = message;
    alertEl.style.display = 'block';
}

async function deleteFile(fileId, fileName) {
    if (!confirm(`Are you sure you want to delete "${fileName}"?\n\nThis will remove:\n• The file from database\n• All associated chunks\n• The physical file`)) {
        return;
    }

    try {
        // Show deleting state in UI
        const fileCard = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileCard) {
            fileCard.style.opacity = '0.5';
            fileCard.style.pointerEvents = 'none';
        }

        const response = await fetch(`/api/files/${fileId}/delete/`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            // Show success notification
            showNotification('success', `✅ Deleted "${fileName}" (${result.chunks_removed} chunks removed)`);

            // Remove from UI
            if (fileCard) {
                fileCard.style.transition = 'all 0.3s ease';
                fileCard.style.transform = 'scale(0)';
                setTimeout(() => fileCard.remove(), 300);
            }

            // Refresh knowledge base status
            setTimeout(() => {
                loadKnowledgeBaseStatus();
                loadFileManagement();
            }, 500);

        } else {
            throw new Error(result.error || 'Deletion failed');
        }

    } catch (error) {
        console.error('Delete error:', error);
        showNotification('error', `❌ Failed to delete: ${error.message}`);

        // Restore UI
        const fileCard = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileCard) {
            fileCard.style.opacity = '1';
            fileCard.style.pointerEvents = 'auto';
        }
    }
}

function showNotification(type, message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
    notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
  `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s ease';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}