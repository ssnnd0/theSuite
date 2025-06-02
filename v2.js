javascript:(function() {
    const BOOKMARKLET_ID = 'theSuite';
    const MINIMIZED_ID = 'theSuite-minimized';

    if (document.getElementById(BOOKMARKLET_ID)) {
        const existing = document.getElementById(BOOKMARKLET_ID);
        if (existing.style.display === 'none') {
            const minimized = document.getElementById(MINIMIZED_ID);
            if (minimized) minimized.click(); // Restore if minimized
        } else {
            existing.querySelector('.gas-close-btn').click(); // Close if open
            const minimized = document.getElementById(MINIMIZED_ID); // also remove minimized if somehow present
            if (minimized) minimized.remove();
        }
        return;
    }

    let settings = {
        apiKey: '',
        model: 'gemini-2.5-flash-preview-05-20', // Fixed model name
        useGoogleSearchGrounding: false,
        theme: 'dark', // 'light' or 'dark'
    };

    let currentChatHistory = [];
    let attachedFiles = []; // To hold { mimeType, data (base64) }

    // --- UI Elements ---
    const suiteContainer = document.createElement('div');
    suiteContainer.id = BOOKMARKLET_ID;

    const minimizedIcon = document.createElement('div');
    minimizedIcon.id = MINIMIZED_ID;
    minimizedIcon.textContent = '★';

    // Declare these at the top level
    let chatMessagesDiv, chatInput, fileInput, filePreviewArea;

    function saveSettings() {
        try {
            localStorage.setItem('SuiteSettings', JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem('SuiteSettings');
            if (saved) {
                settings = { ...settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    function getPageChatKey() {
        // Sanitize URL to create a valid localStorage key
        let pageKey = window.location.href.replace(/[^a-zA-Z0-9_-]/g, '_');
        if (pageKey.length > 50) pageKey = pageKey.substring(0, 50); // Limit key length
        return `SuiteChat_${pageKey}`;
    }

    function saveChatHistory() {
        try {
            localStorage.setItem(getPageChatKey(), JSON.stringify(currentChatHistory));
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }

    function loadChatHistory() {
        try {
            const savedChat = localStorage.getItem(getPageChatKey());
            if (savedChat) {
                currentChatHistory = JSON.parse(savedChat);
            } else {
                currentChatHistory = [];
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
            currentChatHistory = [];
        }
    }

    function applyTheme() {
        const isDark = settings.theme === 'dark';
        const isLight = settings.theme === 'light';
        const isTransparent = settings.theme === 'transparent';
    
        suiteContainer.style.backgroundColor = isTransparent ? 'rgba(128,128,128,0.3)' : isDark ? '#2c2c2c' : '#f0f0f0';
        suiteContainer.style.color = isTransparent ? '#ffffff' : isDark ? '#e0e0e0' : '#111';
    
        const textInputs = suiteContainer.querySelectorAll('input[type="text"], input[type="password"], textarea, select');
        textInputs.forEach(input => {
            input.style.backgroundColor = isTransparent ? 'rgba(50,50,50,0.1)' : isDark ? '#333' : '#fff';
            input.style.color = isTransparent ? '#ffffff' : isDark ? '#e0e0e0' : '#111';
            input.style.borderColor = isTransparent ? 'rgba(200,200,200,0.2)' : isDark ? '#555' : '#ccc';
        });
    
        const buttons = suiteContainer.querySelectorAll('button, .gas-tab');
        buttons.forEach(btn => {
            btn.style.backgroundColor = isTransparent ? 'rgba(80,80,80,0.3)' : isDark ? '#444' : '#ddd';
            btn.style.color = isTransparent ? '#ffffff' : isDark ? '#e0e0e0' : '#111';
            btn.style.borderColor = isTransparent ? 'rgba(255,255,255,0.1)' : isDark ? '#555' : '#ccc';
        });
    
        if (chatMessagesDiv) {
            chatMessagesDiv.style.backgroundColor = isTransparent ? 'rgba(20,20,20,0.3)' : isDark ? '#222' : '#fff';
            chatMessagesDiv.style.borderColor = isTransparent ? 'rgba(255,255,255,0.3)' : isDark ? '#444' : '#ccc';
            chatMessagesDiv.querySelectorAll('.user-message, .ai-message').forEach(msgDiv => {
                msgDiv.style.backgroundColor = msgDiv.classList.contains('user-message')
                    ? isTransparent ? 'rgba(90,140,180,0.5)' : isDark ? '#3a5a78' : '#d1e7ff'
                    : isTransparent ? 'rgba(255,255,255,0.1)' : isDark ? '#4a4a4a' : '#e9e9e9';
            });
        }
    }

    // --- HTML Structure and Styling ---
    function initUI() {
        loadSettings();
        loadChatHistory();

        suiteContainer.innerHTML = `
            <div class="gas-header">
                <span class="gas-title">theSuite</span>
                <div class="gas-header-buttons">
                    <button class="gas-minimize-btn" title="Minimize">-</button>
                    <button class="gas-close-btn" title="Close">×</button>
                </div>
            </div>
            <div class="gas-tabs">
                <button class="gas-tab active" data-tab="chat">Chat</button>
                <button class="gas-tab" data-tab="settings">Settings</button>
            </div>
            <div class="gas-tab-content gas-chat-content">
                <div class="gas-chat-messages"></div>
                <div class="gas-chat-input-area">
                    <div class="gas-file-preview-area"></div>
                    <textarea class="gas-chat-input" placeholder="Type your message or drop an image..."></textarea>
                    <div class="gas-chat-buttons">
                        <button class="gas-send-btn">Send</button>
                        <input type="file" class="gas-file-input" accept="image/*,application/pdf,text/plain" style="display:none;" multiple>
                        <button class="gas-attach-btn" title="Attach File (Image, PDF, TXT)">📎</button>
                        <button class="gas-paste-btn" title="Paste from Clipboard">📋</button>
                    </div>
                </div>
            </div>
            <div class="gas-tab-content gas-settings-content" style="display:none;">
                <label>API Key: <input type="password" class="gas-api-key" value="${settings.apiKey}"></label>
                <label>Model:
                    <select class="gas-model-select">
                        <option value="gemini-2.5-flash-preview-05-20" ${settings.model === 'gemini-2.5-flash-preview-05-20' ? 'selected' : ''}>Gemini 2.5 Flash Preview 5:20</option>
                        <option value="gemini-2.5-pro-preview-05-06" ${settings.model === 'gemini-2.5-pro-preview-05-06' ? 'selected' : ''}>Gemini 2.5 Pro Preview 05-06 ***DOESNT WORK***</option>
                    </select>
                </label>
                <label>
                    <input type="checkbox" class="gas-grounding-cb" ${settings.useGoogleSearchGrounding ? 'checked' : ''}>
                    Use Google Search Grounding
                </label>
                <label>Theme:
                    <select class="gas-theme-select">
                        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                        <option value="transparent" ${settings.theme === 'transparent' ? 'selected' : ''}>Transparent</option>
                    </select>
                </label>
                <button class="gas-save-settings-btn">Save Settings</button>
                <p style="font-size:0.8em; margin-top:15px;">API Key is stored in LocalStorage. Be cautious on shared computers.</p>
                <p style="font-size:0.8em;">Chat history is stored per-page in LocalStorage.</p>
            </div>
            <div class="gas-resize-handle"></div>
        `;
        
        document.body.appendChild(suiteContainer);
        document.body.appendChild(minimizedIcon);
        minimizedIcon.style.display = 'none';

        // Get references to elements after they're created
        chatMessagesDiv = suiteContainer.querySelector('.gas-chat-messages');
        chatInput = suiteContainer.querySelector('.gas-chat-input');
        fileInput = suiteContainer.querySelector('.gas-file-input');
        filePreviewArea = suiteContainer.querySelector('.gas-file-preview-area');

        applyStyles();
        applyTheme(); // Apply initial theme
        addEventListeners();
        renderChatHistory();
        updateFilePreview();

        // Make draggable
        const header = suiteContainer.querySelector('.gas-header');
        let isDragging = false;
        let dragOffsetX, dragOffsetY;

        header.onmousedown = function(e) {
            if (e.target.classList.contains('gas-minimize-btn') || e.target.classList.contains('gas-close-btn')) {
                return;
            }
            isDragging = true;
            dragOffsetX = e.clientX - suiteContainer.offsetLeft;
            dragOffsetY = e.clientY - suiteContainer.offsetTop;
            suiteContainer.style.cursor = 'grabbing';
            e.preventDefault();
        };

        document.onmousemove = function(e) {
            if (isDragging) {
                suiteContainer.style.left = (e.clientX - dragOffsetX) + 'px';
                suiteContainer.style.top = (e.clientY - dragOffsetY) + 'px';
            }
        };

        document.onmouseup = function() {
            if (isDragging) {
                isDragging = false;
                suiteContainer.style.cursor = 'default';
            }
        };

        // Make resizable
        const resizeHandle = suiteContainer.querySelector('.gas-resize-handle');
        let isResizing = false;
        resizeHandle.onmousedown = function(e) {
            isResizing = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(document.defaultView.getComputedStyle(suiteContainer).width, 10);
            const startHeight = parseInt(document.defaultView.getComputedStyle(suiteContainer).height, 10);

            function doResize(e) {
                if (isResizing) {
                    suiteContainer.style.width = (startWidth + e.clientX - startX) + 'px';
                    suiteContainer.style.height = (startHeight + e.clientY - startY) + 'px';
                }
            }

            function stopResize() {
                if (isResizing) {
                    isResizing = false;
                    document.removeEventListener('mousemove', doResize);
                    document.removeEventListener('mouseup', stopResize);
                }
            }

            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        };
    }

    function applyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #${BOOKMARKLET_ID} {
                position: fixed;
                top: 50px;
                left: 50px;
                width: 450px;
                height: 600px;
                min-width: 300px;
                min-height: 200px;
                background-color: #1e1e1e;
                color: #f0f0f0;
                border: 1px solid #444;
                border-radius: 10px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.5);
                z-index: 99999;
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                overflow: hidden;
                transition: all 0.3s ease;
            }
            
            .gas-header {
                background-color: #2a2a2a;
                padding: 10px 14px;
                cursor: grab;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top-left-radius: 10px;
                border-top-right-radius: 10px;
            }
            
            .gas-title {
                font-weight: 600;
                font-size: 1.05em;
            }
            
            .gas-header-buttons button {
                background: none;
                border: none;
                color: #aaa;
                font-size: 16px;
                cursor: pointer;
                margin-left: 5px;
                padding: 2px 6px;
                transition: color 0.2s ease;
            }
            
            .gas-header-buttons button:hover {
                color: #fff;
            }
            
            .gas-tabs {
                display: flex;
                background-color: #262626;
                border-bottom: 1px solid #333;
            }
            
            .gas-tab {
                padding: 10px 15px;
                cursor: pointer;
                background-color: #333;
                color: #ccc;
                flex-grow: 1;
                text-align: center;
                transition: background 0.2s ease, color 0.2s ease;
                border: none;
            }
            
            .gas-tab.active {
                background-color: #444;
                color: #fff;
                font-weight: bold;
            }
            
            .gas-tab:not(.active):hover {
                background-color: #3a3a3a;
            }
            
            .gas-tab-content {
                padding: 16px;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            
            .gas-settings-content {
                overflow-y: auto;
            }
            
            .gas-settings-content label {
                display: block;
                margin-bottom: 10px;
                font-weight: 500;
                color: #d0d0d0;
            }
            
            .gas-settings-content input[type="text"],
            .gas-settings-content input[type="password"],
            .gas-settings-content select {
                width: 100%;
                padding: 8px;
                border-radius: 5px;
                background-color: #2e2e2e;
                color: #f0f0f0;
                border: 1px solid #555;
                transition: border 0.2s ease;
                box-sizing: border-box;
            }
            
            .gas-settings-content input:focus,
            .gas-settings-content select:focus {
                border-color: #007bff;
                outline: none;
            }
            
            .gas-save-settings-btn {
                padding: 10px 15px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 10px;
                transition: background-color 0.2s ease;
            }
            
            .gas-save-settings-btn:hover {
                background-color: #0056b3;
            }
            
            .gas-chat-messages {
                flex-grow: 1;
                overflow-y: auto;
                margin-bottom: 10px;
                border: 1px solid #444;
                padding: 10px;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                background-color: #222;
            }
            
            .user-message, .ai-message {
                padding: 10px 14px;
                border-radius: 18px;
                margin-bottom: 8px;
                max-width: 80%;
                font-size: 0.95em;
                line-height: 1.4;
                word-wrap: break-word;
                transition: background-color 0.2s ease;
            }
            
            .user-message {
                background-color: #2d6ea7;
                align-self: flex-end;
                color: #fff;
                border-bottom-right-radius: 4px;
            }
            
            .ai-message {
                background-color: #3a3a3a;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
            }
            
            .ai-message pre {
                white-space: pre-wrap;
                background-color: rgba(255, 255, 255, 0.05);
                padding: 8px;
                border-radius: 5px;
                font-family: monospace;
                overflow-x: auto;
            }
            
            .ai-message code:not(pre code) {
                background-color: rgba(255, 255, 255, 0.08);
                padding: 2px 4px;
                border-radius: 4px;
                font-family: monospace;
            }
            
            .gas-chat-input-area {
                display: flex;
                flex-direction: column;
            }
            
            .gas-file-preview-area {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 6px;
                max-height: 60px;
                overflow-y: auto;
            }
            
            .gas-file-preview-item {
                background-color: #555;
                padding: 3px 6px;
                border-radius: 4px;
                font-size: 0.8em;
                display: flex;
                align-items: center;
            }
            
            .gas-file-preview-item button {
                background: transparent;
                border: none;
                color: #ff4444;
                cursor: pointer;
                margin-left: 6px;
                padding: 0;
            }
            
            .gas-chat-input {
                width: 100%;
                padding: 10px;
                border-radius: 5px;
                border: 1px solid #555;
                margin-bottom: 6px;
                min-height: 50px;
                resize: vertical;
                background-color: #2b2b2b;
                color: #f0f0f0;
                transition: border 0.2s ease;
                box-sizing: border-box;
                font-family: inherit;
            }
            
            .gas-chat-input:focus {
                border-color: #28a745;
                outline: none;
            }
            
            .gas-chat-buttons {
                display: flex;
                justify-content: space-between;
                gap: 6px;
            }
            
            .gas-chat-buttons button {
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                border: 1px solid #555;
                background-color: #393939;
                color: #e0e0e0;
                transition: background-color 0.2s ease;
            }
            
            .gas-send-btn {
                flex-grow: 1;
                background-color: #28a745 !important;
            }
            
            .gas-send-btn:hover {
                background-color: #1e7e34 !important;
            }
            
            .gas-attach-btn,
            .gas-paste-btn {
                min-width: 40px;
                text-align: center;
            }
            
            .gas-resize-handle {
                width: 15px;
                height: 15px;
                position: absolute;
                bottom: 0;
                right: 0;
                cursor: nwse-resize;
                background: repeating-linear-gradient(
                    -45deg,
                    rgba(255,255,255,0.2),
                    rgba(255,255,255,0.2) 1px,
                    transparent 1px,
                    transparent 3px
                );
            }
            
            #${MINIMIZED_ID} {
                position: fixed;
                bottom: 10px;
                right: 10px;
                width: 30px;
                height: 30px;
                color: rgba(200, 200, 200, 0.8);
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                font-size: 16px;
                cursor: pointer;
                z-index: 99998;
                background-color: #333;
                transition: background-color 0.2s ease, color 0.2s ease;
                border: 1px solid #555;
            }
            
            #${MINIMIZED_ID}:hover {
                background-color: #444;
                color: rgba(255, 255, 255, 0.9);
            }
        `;
        
        document.head.appendChild(style);
        window.geminiSuiteStyleCleanup = () => style.remove(); // For cleanup if needed
    }

    function addEventListeners() {
        suiteContainer.querySelector('.gas-close-btn').onclick = () => {
            suiteContainer.remove();
            minimizedIcon.remove();
            if (window.geminiSuiteStyleCleanup) window.geminiSuiteStyleCleanup();
        };

        suiteContainer.querySelector('.gas-minimize-btn').onclick = () => {
            suiteContainer.style.display = 'none';
            minimizedIcon.style.display = 'flex';
        };

        minimizedIcon.onclick = () => {
            suiteContainer.style.display = 'flex';
            minimizedIcon.style.display = 'none';
        };

        suiteContainer.querySelectorAll('.gas-tab').forEach(tab => {
            tab.onclick = (e) => {
                suiteContainer.querySelectorAll('.gas-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                suiteContainer.querySelectorAll('.gas-tab-content').forEach(c => c.style.display = 'none');
                const targetContent = suiteContainer.querySelector(`.gas-${e.target.dataset.tab}-content`);
                if (targetContent) {
                    targetContent.style.display = e.target.dataset.tab === 'settings' ? 'block' : 'flex';
                }
            };
        });

        suiteContainer.querySelector('.gas-save-settings-btn').onclick = () => {
            settings.apiKey = suiteContainer.querySelector('.gas-api-key').value;
            settings.model = suiteContainer.querySelector('.gas-model-select').value;
            settings.useGoogleSearchGrounding = suiteContainer.querySelector('.gas-grounding-cb').checked;
            settings.theme = suiteContainer.querySelector('.gas-theme-select').value;
            saveSettings();
            applyTheme();
            alert('Settings saved!');
        };

        suiteContainer.querySelector('.gas-send-btn').onclick = sendChatMessage;
        chatInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        };

        suiteContainer.querySelector('.gas-attach-btn').onclick = () => fileInput.click();
        fileInput.onchange = handleFileUpload;

        chatInput.addEventListener('paste', handlePaste);

        suiteContainer.querySelector('.gas-paste-btn').onclick = async () => {
            try {
                const text = await navigator.clipboard.readText();
                chatInput.value += text;
                chatInput.focus();
            } catch (err) {
                console.error('Failed to read clipboard contents: ', err);
                addMessageToChat('system', 'Failed to read clipboard. Permission might be denied or clipboard is empty/not text.');
            }
        };

        // Drag and drop files onto textarea
        chatInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.style.borderColor = '#007bff';
        });
        
        chatInput.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.style.borderColor = settings.theme === 'dark' ? '#555' : '#ccc';
        });
        
        chatInput.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatInput.style.borderColor = settings.theme === 'dark' ? '#555' : '#ccc';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
        });
    }

    function handleFileUpload(event) {
        processFiles(event.target.files);
        event.target.value = null;
    }

    function handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        let filesToProcess = [];
        for (let item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain') {
                    filesToProcess.push(file);
                }
            }
        }
        if (filesToProcess.length > 0) {
            event.preventDefault();
            processFiles(filesToProcess);
        }
    }

    function processFiles(fileList) {
        for (let file of fileList) {
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && file.type !== 'text/plain') {
                addMessageToChat('system', `Unsupported file type: ${file.name} (${file.type}). Only images, PDFs, and TXT files are supported.`);
                continue;
            }
            if (file.size > 20 * 1024 * 1024) { // 20MB limit
                addMessageToChat('system', `File too large: ${file.name}. Max 20MB.`);
                continue;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                attachedFiles.push({
                    name: file.name,
                    mimeType: file.type,
                    data: e.target.result.split(',')[1] // Base64 data
                });
                updateFilePreview();
            };
            reader.readAsDataURL(file);
        }
    }
    
    function updateFilePreview() {
        if (!filePreviewArea) return;
        
        filePreviewArea.innerHTML = '';
        attachedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'gas-file-preview-item';
            item.textContent = file.name.length > 15 ? file.name.substring(0,12) + '...' : file.name;
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.title = `Remove ${file.name}`;
            removeBtn.onclick = () => {
                attachedFiles.splice(index, 1);
                updateFilePreview();
            };
            item.appendChild(removeBtn);
            filePreviewArea.appendChild(item);
        });
    }

    function renderChatHistory() {
        if (!chatMessagesDiv) return;
        
        chatMessagesDiv.innerHTML = '';
        currentChatHistory.forEach(msg => addMessageToChat(msg.role, msg.parts, false));
    }

    function addMessageToChat(role, parts, save = true) {
        if (!chatMessagesDiv) return;
        
        const msgWrapper = document.createElement('div');
        const msgDiv = document.createElement('div');
        msgDiv.classList.add(role === 'user' ? 'user-message' : 'ai-message');

        let content = '';
        if (typeof parts === 'string') {
            content = escapeHtml(parts);
        } else if (Array.isArray(parts)) {
            parts.forEach(part => {
                if (part.text) {
                    let htmlText = escapeHtml(part.text)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${escapeHtml(code.trim())}</code></pre>`)
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                        .replace(/\n/g, '<br>');
                    content += htmlText;
                } else if (part.inlineData) {
                    content += `[Attached ${part.inlineData.mimeType.split('/')[0]}] `;
                }
            });
        }
        
        msgDiv.innerHTML = content;

        if (role === 'system') {
            msgDiv.style.backgroundColor = settings.theme === 'dark' ? '#6c757d' : '#f8f9fa';
            msgDiv.style.color = settings.theme === 'dark' ? '#lightgray' : 'gray';
            msgDiv.style.fontStyle = 'italic';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
        }

        msgWrapper.appendChild(msgDiv);
        chatMessagesDiv.appendChild(msgWrapper);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

        if (save && (role === 'user' || role === 'model')) { // 'model' is Gemini's role for AI
             const historyEntryParts = [];
             if (typeof parts === 'string') { // For user messages that are just text
                 historyEntryParts.push({ text: parts });
             } else { // For AI responses or user messages with files
                 parts.forEach(part => {
                     if(part.text) historyEntryParts.push({ text: part.text });
                     if(part.inlineData) historyEntryParts.push({ inlineData: { mimeType: part.inlineData.mimeType, data: "preview_only" }}); // Don't save full base64 in history for brevity
                 });
             }
            currentChatHistory.push({ role, parts: historyEntryParts });
            saveChatHistory();
        }
    }
    
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "\"")
             .replace(/'/g, "'");
    }


    async function sendChatMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText && attachedFiles.length === 0) return;
        if (!settings.apiKey) {
            addMessageToChat('system', 'API Key is not set. Please set it in the Settings tab.');
            // Switch to settings tab
            suiteContainer.querySelector('.gas-tab[data-tab="settings"]').click();
            return;
        }

        const userMessageParts = [];
        if (messageText) {
            userMessageParts.push({ text: messageText });
        }
        attachedFiles.forEach(file => {
            userMessageParts.push({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.data
                }
            });
        });
        
        addMessageToChat('user', userMessageParts);
        chatInput.value = '';
        attachedFiles = [];
        updateFilePreview();
        chatInput.disabled = true;
        suiteContainer.querySelector('.gas-send-btn').disabled = true;
        suiteContainer.querySelector('.gas-send-btn').textContent = 'Thinking...';


        const VEXTEX_AI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`;
        // For Vertex AI (projects/PROJECT_ID/locations/LOCATION/endpoints/ENDPOINT_ID:predict)
        // The generativelanguage.googleapis.com endpoint is simpler for direct Gemini API access.

        // Construct history for the API call
        const apiHistory = currentChatHistory
            .filter(msg => msg.role === 'user' || msg.role === 'model') // Filter out system messages for API history
            .map(msg => ({
                role: msg.role,
                parts: msg.parts.map(p => {
                    if (p.text) return { text: p.text };
                    // For API, we don't send back inlineData from previous turns unless it's part of the *current* user message
                    // This part is tricky: Gemini doesn't maintain file state across turns unless you re-send or use its File API.
                    // For simplicity, we're only sending files with the *current* user message.
                    return null;
                }).filter(p => p !== null)
            }));
            
        // Remove last entry from apiHistory as it's the one we just added to display
        // and will be the 'current' message parts.
        if (apiHistory.length > 0) apiHistory.pop();


        const requestBody = {
            contents: [
                ...apiHistory, // Previous valid turns
                {
                    role: 'user',
                    parts: userMessageParts
                }
            ],
            generationConfig: {
                // "temperature": 0.7,
                // "topK": 1,
                // "topP": 1,
                // "maxOutputTokens": 2048,
                // "stopSequences": []
            },
            ...(settings.useGoogleSearchGrounding && (settings.model.includes('2.5-pro') || settings.model.includes('1.5-flash'))  // Grounding more relevant for Pro
                ? {
                    tools: [{
                        googleSearchRetrieval: {}, // Empty object enables it
                        urlContext: {}
                    }]
                  }
                : {}
            )
            // safetySettings can be added here if needed
        };

        try {
            const response = await fetch(VEXTEX_AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                addMessageToChat('system', `Error: ${errorData.error?.message || response.statusText}`);
                if (errorData.error?.details) {
                     errorData.error.details.forEach(detail => {
                        addMessageToChat('system', `Detail: ${detail.message || JSON.stringify(detail)}`);
                     });
                }
                return;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                const aiResponseParts = data.candidates[0].content.parts;
                addMessageToChat('model', aiResponseParts); // 'model' is the role from Gemini API
            } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                 addMessageToChat('system', `Blocked: ${data.promptFeedback.blockReason}. ${data.promptFeedback.blockReasonMessage || ''}`);
                 if (data.promptFeedback.safetyRatings) {
                    data.promptFeedback.safetyRatings.forEach(rating => {
                        if (rating.blocked) {
                             addMessageToChat('system', `Safety concern: ${rating.category} - ${rating.probability}`);
                        }
                    });
                 }
            } else {
                addMessageToChat('system', 'Received an empty or unexpected response from AI.');
                console.log("Unexpected AI response:", data);
            }

        } catch (error) {
            console.error('Fetch Error:', error);
            addMessageToChat('system', `Network or other error: ${error.message}`);
        } finally {
            chatInput.disabled = false;
            suiteContainer.querySelector('.gas-send-btn').disabled = false;
            suiteContainer.querySelector('.gas-send-btn').textContent = 'Send';
            chatInput.focus();
        }
    }

    // --- Initialization ---
    initUI();

})();
