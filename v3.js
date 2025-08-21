(function(){
javascript:(function() {
    //https://github.com/ssnnd0/theSuite
    
    // Generate randomized IDs to prevent conflicts
    const generateId = () => 'theSuite_' + Math.random().toString(36).substr(2, 9);
    const BOOKMARKLET_ID = generateId();
    const MINIMIZED_ID = generateId();
    const STYLE_ID = generateId();

    // Check if already exists and handle accordingly
    const existingElements = document.querySelectorAll('[data-thesuite="true"]');
    if (existingElements.length > 0) {
        const existing = existingElements[0];
        if (existing.style.display === 'none') {
            const minimized = document.querySelector('[data-thesuite-minimized="true"]');
            if (minimized) minimized.click(); // Restore if minimized
        } else {
            // Clean up existing instance
            existingElements.forEach(el => el.remove());
            const minimized = document.querySelector('[data-thesuite-minimized="true"]');
            if (minimized) minimized.remove();
            const oldStyle = document.querySelector('style[data-thesuite-style="true"]');
            if (oldStyle) oldStyle.remove();
        }
        return;
    }

    // Memory management object to track all event listeners and timers
    const memoryManager = {
        eventListeners: new Map(),
        timers: new Set(),
        observers: new Set(),
        
        addListener(element, event, handler, options = false) {
            const key = `${element}_${event}`;
            if (!this.eventListeners.has(key)) {
                this.eventListeners.set(key, []);
            }
            this.eventListeners.get(key).push({ handler, options });
            element.addEventListener(event, handler, options);
        },
        
        addTimer(id) {
            this.timers.add(id);
        },
        
        addObserver(observer) {
            this.observers.add(observer);
        },
        
        cleanup() {
            // Remove all event listeners
            this.eventListeners.forEach((listeners, key) => {
                const [elementId, event] = key.split('_');
                const element = document.getElementById(elementId) || 
                               document.querySelector(`[data-id="${elementId}"]`);
                if (element) {
                    listeners.forEach(({ handler, options }) => {
                        element.removeEventListener(event, handler, options);
                    });
                }
            });
            this.eventListeners.clear();
            
            // Clear all timers
            this.timers.forEach(id => {
                clearTimeout(id);
                clearInterval(id);
            });
            this.timers.clear();
            
            // Disconnect all observers
            this.observers.forEach(observer => {
                if (observer.disconnect) observer.disconnect();
            });
            this.observers.clear();
        }
    };

    let settings = {
        apiKey: '',
        model: 'gemini-2.5-flash-preview-05-20',
        useGoogleSearchGrounding: false,
        useUrlContext: true,
        theme: 'transparent',
    };

    let currentChatHistory = [];
    let attachedFiles = [];

    // Create shadow DOM for better encapsulation
    const shadowHost = document.createElement('div');
    shadowHost.setAttribute('data-thesuite', 'true');
    shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 999999;';
    
    const shadow = shadowHost.attachShadow({ mode: 'closed' });
    document.body.appendChild(shadowHost);

    // Create minimized icon outside shadow DOM for visibility
    const minimizedIcon = document.createElement('div');
    minimizedIcon.setAttribute('data-thesuite-minimized', 'true');
    minimizedIcon.textContent = '*';
    minimizedIcon.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        color: rgba(200, 200, 200, 0.2);
        display: none;
        justify-content: center;
        align-items: center;
        font-size: 16px;
        cursor: pointer;
        z-index: 999998;
        transition: background-color 0.2s ease, color 0.2s ease;
        font-family: 'Segoe UI', Tahoma, sans-serif;
    `;
    document.body.appendChild(minimizedIcon);

    // UI Elements within shadow DOM
    let suiteContainer, chatMessagesDiv, chatInput, fileInput, filePreviewArea;

    // Settings management with error handling
    function saveSettings() {
        try {
            const sanitized = {
                ...settings,
                apiKey: settings.apiKey // Keep API key but consider encryption in production
            };
            localStorage.setItem('SuiteSettings', JSON.stringify(sanitized));
        } catch (e) {
            console.error('Failed to save settings:', e);
            addMessageToChat('system', 'Failed to save settings to local storage');
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem('SuiteSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate parsed settings
                if (parsed && typeof parsed === 'object') {
                    settings = { ...settings, ...parsed };
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
            addMessageToChat('system', 'Failed to load settings, using defaults');
        }
    }

    function getPageChatKey() {
        // More robust URL sanitization
        const url = new URL(window.location.href);
        const sanitized = `${url.hostname}${url.pathname}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const truncated = sanitized.length > 50 ? sanitized.substring(0, 50) : sanitized;
        return `SuiteChat_${truncated}`;
    }

    function saveChatHistory() {
        try {
            // Limit chat history size to prevent localStorage overflow
            const maxHistoryLength = 100;
            const trimmedHistory = currentChatHistory.slice(-maxHistoryLength);
            localStorage.setItem(getPageChatKey(), JSON.stringify(trimmedHistory));
        } catch (e) {
            console.error('Failed to save chat history:', e);
            // Clear some old history if storage is full
            try {
                const keys = Object.keys(localStorage).filter(key => key.startsWith('SuiteChat_'));
                if (keys.length > 5) {
                    // Remove oldest chat histories
                    keys.slice(0, -5).forEach(key => localStorage.removeItem(key));
                    // Try saving again
                    localStorage.setItem(getPageChatKey(), JSON.stringify(currentChatHistory.slice(-50)));
                }
            } catch (e2) {
                console.error('Failed to cleanup and save chat history:', e2);
            }
        }
    }

    function loadChatHistory() {
        try {
            const savedChat = localStorage.getItem(getPageChatKey());
            if (savedChat) {
                const parsed = JSON.parse(savedChat);
                currentChatHistory = Array.isArray(parsed) ? parsed : [];
            } else {
                currentChatHistory = [];
            }
        } catch (e) {
            console.error('Failed to load chat history:', e);
            currentChatHistory = [];
        }
    }

    function applyTheme() {
        if (!suiteContainer) return;
        
        const isDark = settings.theme === 'dark';
        const isLight = settings.theme === 'light';
        const isTransparent = settings.theme === 'transparent';
    
        // Cache DOM queries for better performance
        const elements = {
            container: suiteContainer,
            header: suiteContainer.querySelector('.gas-header'),
            title: suiteContainer.querySelector('.gas-title'),
            headerButtons: suiteContainer.querySelectorAll('.gas-header-buttons button'),
            tabsContainer: suiteContainer.querySelector('.gas-tabs'),
            tabs: suiteContainer.querySelectorAll('.gas-tab'),
            textInputs: suiteContainer.querySelectorAll('input[type="text"], input[type="password"], textarea, select'),
            buttons: suiteContainer.querySelectorAll('button:not(.gas-tab):not(.gas-header-buttons button)'),
            filePreviewItems: suiteContainer.querySelectorAll('.gas-file-preview-item'),
            resizeHandle: suiteContainer.querySelector('.gas-resize-handle')
        };
    
        // Main container theming
        elements.container.style.backgroundColor = isTransparent ? 'rgba(40,40,40,0.2)' : isDark ? '#1e1e1e' : '#ffffff';
        elements.container.style.color = isTransparent ? '#ffffff' : isDark ? '#e0e0e0' : '#333333';
        elements.container.style.borderColor = isTransparent ? 'rgba(255,255,255,0.2)' : isDark ? '#444' : '#d0d0d0';
        
        // Header theming
        if (elements.header) {
            elements.header.style.backgroundColor = isTransparent ? 'rgba(60,60,60,0.3)' : isDark ? '#2a2a2a' : '#f8f9fa';
            elements.header.style.borderBottomColor = isTransparent ? 'rgba(255,255,255,0.1)' : isDark ? '#333' : '#e0e0e0';
        }
        
        // Apply theming to other elements with performance optimization
        requestAnimationFrame(() => {
            // Title theming
            if (elements.title) {
                elements.title.style.color = isTransparent ? '#ffffff' : isDark ? '#ffffff' : '#2c3e50';
            }
            
            // Header buttons theming with event delegation
            elements.headerButtons.forEach(btn => {
                btn.style.color = isTransparent ? 'rgba(255,255,255,0.6)' : isDark ? '#aaa' : '#666';
                
                // Remove existing hover listeners to prevent memory leaks
                btn.onmouseenter = btn.onmouseleave = null;
                
                btn.onmouseenter = () => {
                    btn.style.color = isTransparent ? '#ffffff' : isDark ? '#fff' : '#333';
                };
                btn.onmouseleave = () => {
                    btn.style.color = isTransparent ? 'rgba(255,255,255,0.5)' : isDark ? '#aaa' : '#666';
                };
            });
            
            // Continue with other theme applications...
            // (Similar pattern for other elements)
        });

        // Chat messages area theming
        if (chatMessagesDiv) {
            chatMessagesDiv.style.backgroundColor = isTransparent ? 'rgba(0,0,0,0.3)' : isDark ? '#222' : '#ffffff';
            chatMessagesDiv.style.borderColor = isTransparent ? 'rgba(255,255,255,0.2)' : isDark ? '#444' : '#dee2e6';
            
            // Re-theme existing messages
            requestAnimationFrame(() => {
                chatMessagesDiv.querySelectorAll('.user-message, .ai-message').forEach(msgDiv => {
                    if (msgDiv.classList.contains('user-message')) {
                        msgDiv.style.backgroundColor = isTransparent ? 'rgba(0,123,255,0.4)' : isDark ? '#2d6ea7' : '#007bff';
                        msgDiv.style.color = '#ffffff';
                    } else {
                        msgDiv.style.backgroundColor = isTransparent ? 'rgba(255,255,255,0.15)' : isDark ? '#3a3a3a' : '#f8f9fa';
                        msgDiv.style.color = isTransparent ? '#ffffff' : isDark ? '#e0e0e0' : '#333';
                    }
                });
            });
        }
    }

    function createStyles() {
        const style = document.createElement('style');
        style.setAttribute('data-thesuite-style', 'true');
        style.textContent = `
            .suite-container {
                position: fixed;
                top: 50px;
                left: 50px;
                width: 450px;
                height: 600px;
                min-width: 300px;
                min-height: 200px;
                color: rgba(128, 128, 128, 0.32);
                border-radius: 10px;
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                overflow: hidden;
                transition: all 0.3s ease;
                box-sizing: border-box;
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
                user-select: none;
            }
            
            .gas-header:active {
                cursor: grabbing;
            }
            
            .gas-title {
                font-weight: 600;
                font-size: 1.05em;
                pointer-events: none;
            }
            
            .gas-header-buttons {
                display: flex;
                gap: 5px;
            }
            
            .gas-header-buttons button {
                background: none;
                border: none;
                color: #aaa;
                font-size: 16px;
                cursor: pointer;
                padding: 2px 6px;
                transition: color 0.2s ease;
                user-select: none;
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
                user-select: none;
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
            
            .gas-settings-section {
                margin-bottom: 20px;
            }
            
            .gas-settings-section h3 {
                margin: 0 0 10px 0;
                color: #e0e0e0;
                font-size: 1.1em;
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
            
            .gas-checkbox-label {
                display: flex !important;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            
            .gas-checkbox-label input[type="checkbox"] {
                width: auto;
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
                scroll-behavior: smooth;
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
                animation: messageSlideIn 0.3s ease-out;
            }
            
            @keyframes messageSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
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
                margin: 5px 0;
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
                animation: fadeIn 0.2s ease-in;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .gas-file-preview-item button {
                background: transparent;
                border: none;
                color: #ff4444;
                cursor: pointer;
                margin-left: 6px;
                padding: 0;
                transition: color 0.2s ease;
            }
            
            .gas-file-preview-item button:hover {
                color: #ff6666;
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
            
            .gas-chat-input.drag-over {
                border-color: #007bff;
                background-color: #2a3a4a;
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
                user-select: none;
            }
            
            .gas-chat-buttons button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .gas-send-btn {
                flex-grow: 1;
                background-color: #28a745 !important;
                border-color: #28a745 !important;
            }
            
            .gas-send-btn:hover:not(:disabled) {
                background-color: #1e7e34 !important;
            }
            
            .gas-attach-btn,
            .gas-paste-btn,
            .gas-clear-btn {
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
            
            /* Scrollbar styling */
            .gas-chat-messages::-webkit-scrollbar,
            .gas-settings-content::-webkit-scrollbar,
            .gas-file-preview-area::-webkit-scrollbar {
                width: 6px;
            }
            
            .gas-chat-messages::-webkit-scrollbar-track,
            .gas-settings-content::-webkit-scrollbar-track,
            .gas-file-preview-area::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05);
            }
            
            .gas-chat-messages::-webkit-scrollbar-thumb,
            .gas-settings-content::-webkit-scrollbar-thumb,
            .gas-file-preview-area::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
            }
        `;
        return style;
    }

    function initUI() {
        loadSettings();
        loadChatHistory();

        // Create and append styles to shadow DOM
        const style = createStyles();
        shadow.appendChild(style);

        // Create main container
        suiteContainer = document.createElement('div');
        suiteContainer.className = 'suite-container';
        suiteContainer.innerHTML = `
            <div class="gas-header">
                <span class="gas-title">theSuite</span>
                <div class="gas-header-buttons">
                    <button class="gas-minimize-btn" title="Minimize">−</button>
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
                    <textarea class="gas-chat-input" placeholder="Type your message or drop files here..."></textarea>
                    <div class="gas-chat-buttons">
                        <button class="gas-send-btn">Send</button>
                        <input type="file" class="gas-file-input" accept="image/*,application/pdf,text/plain" style="display:none;" multiple>
                        <button class="gas-attach-btn" title="Attach File (Image, PDF, TXT)">📎</button>
                        <button class="gas-paste-btn" title="Paste from Clipboard">📋</button>
                        <button class="gas-clear-btn" title="Clear Chat">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="gas-tab-content gas-settings-content" style="display:none;">
                <div class="gas-settings-section">
                    <h3>API Configuration</h3>
                    <label>API Key: <input type="password" class="gas-api-key" value="${settings.apiKey}" placeholder="Enter your Gemini API key"></label>
                    <label>Model:
                        <select class="gas-model-select">
                            <option value="gemini-2.5-flash-preview-05-20" ${settings.model === 'gemini-2.5-flash-preview-05-20' ? 'selected' : ''}>Gemini 2.5 Flash Preview</option>
                            <option value="gemini-2.5-pro-preview-05-06" ${settings.model === 'gemini-2.5-pro-preview-05-06' ? 'selected' : ''}>Gemini 2.5 Pro Preview</option>
                        </select>
                    </label>
                </div>
                
                <div class="gas-settings-section">
                    <h3>Features</h3>
                    <label class="gas-checkbox-label">
                        <input type="checkbox" class="gas-grounding-cb" ${settings.useGoogleSearchGrounding ? 'checked' : ''}>
                        Enable Google Search Grounding
                    </label>
                    <label class="gas-checkbox-label">
                        <input type="checkbox" class="gas-url-context-cb" ${settings.useUrlContext ? 'checked' : ''}>
                        Include current page URL as context
                    </label>
                </div>
                
                <div class="gas-settings-section">
                    <h3>Appearance</h3>
                    <label>Theme:
                        <select class="gas-theme-select">
                            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="transparent" ${settings.theme === 'transparent' ? 'selected' : ''}>Transparent</option>
                        </select>
                    </label>
                </div>
                <button class="gas-save-settings-btn">Save Settings</button>
                <div style="margin-top: 15px; text-align: center;">
                    <a href="https://github.com/ssnnd0/theSuite" target="_blank" style="color: #007bff; text-decoration: none; font-size: 0.9em;">ssnnd0 2025</a>
                </div>
            </div>
            <div class="gas-resize-handle"></div>
        `;
        
        shadow.appendChild(suiteContainer);

        // Get references to elements after they're created
        chatMessagesDiv = suiteContainer.querySelector('.gas-chat-messages');
        chatInput = suiteContainer.querySelector('.gas-chat-input');
        fileInput = suiteContainer.querySelector('.gas-file-input');
        filePreviewArea = suiteContainer.querySelector('.gas-file-preview-area');

        applyTheme();
        addEventListeners();
        renderChatHistory();
        updateFilePreview();
        setupDragAndDrop();
        setupResize();
    }

    function setupDragAndDrop() {
        const header = suiteContainer.querySelector('.gas-header');
        let isDragging = false;
        let dragOffsetX, dragOffsetY;

        const startDrag = (e) => {
            if (e.target.classList.contains('gas-minimize-btn') || e.target.classList.contains('gas-close-btn')) {
                return;
            }
            isDragging = true;
            const rect = shadowHost.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            header.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (isDragging) {
                const x = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragOffsetX));
                const y = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffsetY));
                shadowHost.style.left = x + 'px';
                shadowHost.style.top = y + 'px';
            }
        };

        const endDrag = () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'grab';
            }
        };

        memoryManager.addListener(header, 'mousedown', startDrag);
        memoryManager.addListener(document, 'mousemove', doDrag);
        memoryManager.addListener(document, 'mouseup', endDrag);
    }

    function setupResize() {
        const resizeHandle = suiteContainer.querySelector('.gas-resize-handle');
        let isResizing = false;

        const startResize = (e) => {
            isResizing = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(getComputedStyle(suiteContainer).width, 10);
            const startHeight = parseInt(getComputedStyle(suiteContainer).height, 10);

            const doResize = (e) => {
                if (isResizing) {
                    const newWidth = Math.max(300, Math.min(800, startWidth + e.clientX - startX));
                    const newHeight = Math.max(200, Math.min(800, startHeight + e.clientY - startY));
                    suiteContainer.style.width = newWidth + 'px';
                    suiteContainer.style.height = newHeight + 'px';
                }
            };

            const stopResize = () => {
                if (isResizing) {
                    isResizing = false;
                    document.removeEventListener('mousemove', doResize);
                    document.removeEventListener('mouseup', stopResize);
                }
            };

            document.addEventListener('mousemove', doResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        };

        memoryManager.addListener(resizeHandle, 'mousedown', startResize);
    }

    function addEventListeners() {
        // Close and minimize handlers
        const closeBtn = suiteContainer.querySelector('.gas-close-btn');
        const minimizeBtn = suiteContainer.querySelector('.gas-minimize-btn');
        
        memoryManager.addListener(closeBtn, 'click', () => {
            cleanup();
        });

        memoryManager.addListener(minimizeBtn, 'click', () => {
            shadowHost.style.display = 'none';
            minimizedIcon.style.display = 'flex';
        });

        memoryManager.addListener(minimizedIcon, 'click', () => {
            shadowHost.style.display = 'block';
            minimizedIcon.style.display = 'none';
        });

        // Tab switching with event delegation
        const tabContainer = suiteContainer.querySelector('.gas-tabs');
        memoryManager.addListener(tabContainer, 'click', (e) => {
            if (e.target.classList.contains('gas-tab')) {
                // Remove active class from all tabs
                tabContainer.querySelectorAll('.gas-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // Hide all tab contents
                suiteContainer.querySelectorAll('.gas-tab-content').forEach(c => c.style.display = 'none');
                
                // Show selected tab content
                const targetContent = suiteContainer.querySelector(`.gas-${e.target.dataset.tab}-content`);
                if (targetContent) {
                    targetContent.style.display = e.target.dataset.tab === 'settings' ? 'block' : 'flex';
                }
            }
        });

        // Settings handlers
        const saveSettingsBtn = suiteContainer.querySelector('.gas-save-settings-btn');
        memoryManager.addListener(saveSettingsBtn, 'click', () => {
            const apiKeyInput = suiteContainer.querySelector('.gas-api-key');
            const modelSelect = suiteContainer.querySelector('.gas-model-select');
            const groundingCb = suiteContainer.querySelector('.gas-grounding-cb');
            const urlContextCb = suiteContainer.querySelector('.gas-url-context-cb');
            const themeSelect = suiteContainer.querySelector('.gas-theme-select');
            
            settings.apiKey = apiKeyInput.value.trim();
            settings.model = modelSelect.value;
            settings.useGoogleSearchGrounding = groundingCb.checked;
            settings.useUrlContext = urlContextCb.checked;
            settings.theme = themeSelect.value;
            
            saveSettings();
            applyTheme();
            
            // Visual feedback
            saveSettingsBtn.textContent = 'Saved!';
            const resetTimeout = setTimeout(() => {
                saveSettingsBtn.textContent = 'Save Settings';
            }, 1500);
            memoryManager.addTimer(resetTimeout);
        });

        // Chat handlers
        const sendBtn = suiteContainer.querySelector('.gas-send-btn');
        memoryManager.addListener(sendBtn, 'click', sendChatMessage);
        
        memoryManager.addListener(chatInput, 'keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        // File handling
        const attachBtn = suiteContainer.querySelector('.gas-attach-btn');
        memoryManager.addListener(attachBtn, 'click', () => fileInput.click());
        memoryManager.addListener(fileInput, 'change', handleFileUpload);

        // Paste handling
        const pasteBtn = suiteContainer.querySelector('.gas-paste-btn');
        memoryManager.addListener(pasteBtn, 'click', handlePasteClick);
        memoryManager.addListener(chatInput, 'paste', handlePaste);

        // Clear chat handler
        const clearBtn = suiteContainer.querySelector('.gas-clear-btn');
        memoryManager.addListener(clearBtn, 'click', () => {
            if (confirm('Clear all chat history for this page?')) {
                currentChatHistory = [];
                saveChatHistory();
                renderChatHistory();
                attachedFiles = [];
                updateFilePreview();
            }
        });

        // File drag and drop
        setupFileDragDrop();
    }

    function setupFileDragDrop() {
        let dragCounter = 0;

        const handleDragEnter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (dragCounter === 1) {
                chatInput.classList.add('drag-over');
            }
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                chatInput.classList.remove('drag-over');
            }
        };

        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            chatInput.classList.remove('drag-over');
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
        };

        memoryManager.addListener(chatInput, 'dragenter', handleDragEnter);
        memoryManager.addListener(chatInput, 'dragleave', handleDragLeave);
        memoryManager.addListener(chatInput, 'dragover', handleDragOver);
        memoryManager.addListener(chatInput, 'drop', handleDrop);
    }

    function handleFileUpload(event) {
        processFiles(event.target.files);
        event.target.value = ''; // Reset input
    }

    async function handlePasteClick() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text) {
                    const currentValue = chatInput.value;
                    const cursorPos = chatInput.selectionStart;
                    chatInput.value = currentValue.slice(0, cursorPos) + text + currentValue.slice(chatInput.selectionEnd);
                    chatInput.focus();
                    chatInput.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
                } else {
                    addMessageToChat('system', 'Clipboard appears to be empty');
                }
            } else {
                addMessageToChat('system', 'Clipboard access not available');
            }
        } catch (err) {
            console.error('Paste error:', err);
            addMessageToChat('system', 'Failed to access clipboard. Try using Ctrl+V instead.');
        }
    }

    function handlePaste(event) {
        const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
        if (!items) return;

        const filesToProcess = [];
        for (let item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain')) {
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
        const maxFiles = 10;
        const maxFileSize = 20 * 1024 * 1024; // 20MB
        
        if (attachedFiles.length + fileList.length > maxFiles) {
            addMessageToChat('system', `Too many files. Maximum ${maxFiles} files allowed.`);
            return;
        }

        Array.from(fileList).forEach(file => {
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf' && file.type !== 'text/plain') {
                addMessageToChat('system', `Unsupported file type: ${file.name} (${file.type}). Only images, PDFs, and TXT files are supported.`);
                return;
            }
            
            if (file.size > maxFileSize) {
                addMessageToChat('system', `File too large: ${file.name}. Maximum size is 20MB.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    if (base64Data) {
                        attachedFiles.push({
                            name: file.name,
                            mimeType: file.type,
                            data: base64Data,
                            size: file.size
                        });
                        updateFilePreview();
                    }
                } catch (error) {
                    console.error('File processing error:', error);
                    addMessageToChat('system', `Error processing file: ${file.name}`);
                }
            };
            
            reader.onerror = () => {
                addMessageToChat('system', `Error reading file: ${file.name}`);
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    function updateFilePreview() {
        if (!filePreviewArea) return;
        
        // Clear existing preview items
        filePreviewArea.innerHTML = '';
        
        attachedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'gas-file-preview-item';
            
            const fileName = file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name;
            const fileSize = (file.size / 1024).toFixed(1) + 'KB';
            
            item.innerHTML = `
                <span title="${file.name} (${fileSize})">${fileName}</span>
                <button title="Remove ${file.name}">×</button>
            `;
            
            const removeBtn = item.querySelector('button');
            memoryManager.addListener(removeBtn, 'click', () => {
                attachedFiles.splice(index, 1);
                updateFilePreview();
            });
            
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
                    const fileType = part.inlineData.mimeType.split('/')[0];
                    content += `<span style="opacity: 0.7;">[📎 ${fileType}]</span> `;
                }
            });
        }
        
        msgDiv.innerHTML = content || '[Empty message]';

        // Special styling for system messages
        if (role === 'system') {
            msgDiv.style.backgroundColor = settings.theme === 'transparent' ? 'rgba(108,117,125,0.6)' : 
                                         settings.theme === 'dark' ? '#6c757d' : '#f8f9fa';
            msgDiv.style.color = settings.theme === 'transparent' ? 'rgba(255,255,255,0.8)' : 
                               settings.theme === 'dark' ? '#e9ecef' : '#6c757d';
            msgDiv.style.fontStyle = 'italic';
            msgDiv.style.alignSelf = 'center';
            msgDiv.style.maxWidth = '90%';
            msgDiv.style.fontSize = '0.9em';
        }

        chatMessagesDiv.appendChild(msgDiv);
        
        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
        });

        // Save to history (exclude system messages)
        if (save && (role === 'user' || role === 'model')) {
            const historyEntryParts = [];
            if (typeof parts === 'string') {
                historyEntryParts.push({ text: parts });
            } else if (Array.isArray(parts)) {
                parts.forEach(part => {
                    if (part.text) historyEntryParts.push({ text: part.text });
                    if (part.inlineData) {
                        historyEntryParts.push({ 
                            inlineData: { 
                                mimeType: part.inlineData.mimeType, 
                                data: "preview_only" // Don't save full base64 for storage efficiency
                            }
                        });
                    }
                });
            }
            currentChatHistory.push({ role, parts: historyEntryParts });
            saveChatHistory();
        }
    }
    
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    async function sendChatMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText && attachedFiles.length === 0) return;
        
        if (!settings.apiKey) {
            addMessageToChat('system', '⚠️ API Key is not set. Please set it in the Settings tab.');
            // Switch to settings tab
            suiteContainer.querySelector('.gas-tab[data-tab="settings"]').click();
            return;
        }

        // Prepare user message parts
        const userMessageParts = [];
        if (messageText) {
            userMessageParts.push({ text: messageText });
        }
        
        // Add files to message
        attachedFiles.forEach(file => {
            userMessageParts.push({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.data
                }
            });
        });
        
        // Add message to chat and reset input
        addMessageToChat('user', userMessageParts);
        chatInput.value = '';
        const currentFiles = [...attachedFiles]; // Keep reference for API call
        attachedFiles = [];
        updateFilePreview();
        
        // Update UI state
        const sendBtn = suiteContainer.querySelector('.gas-send-btn');
        chatInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = '🤔 Thinking...';

        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`;

            // Build conversation history for API
            const apiHistory = currentChatHistory
                .filter(msg => msg.role === 'user' || msg.role === 'model')
                .map(msg => ({
                    role: msg.role,
                    parts: msg.parts.filter(p => p.text).map(p => ({ text: p.text }))
                }))
                .filter(msg => msg.parts.length > 0);

            // Remove the last entry as it's the current message
            if (apiHistory.length > 0) apiHistory.pop();

            // Build request body
            const requestBody = {
                contents: [
                    ...apiHistory,
                    {
                        role: 'user',
                        parts: userMessageParts
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };

            // Add tools if grounding is enabled
            if (settings.useGoogleSearchGrounding && settings.model.includes('2.5-pro')) {
                requestBody.tools = [{
                    googleSearchRetrieval: {}
                }];
            }

            // Add URL context if enabled
            if (settings.useUrlContext) {
                const contextText = `\n\n[Page Context: Currently on ${window.location.href}]`;
                if (requestBody.contents.length > 0) {
                    const lastContent = requestBody.contents[requestBody.contents.length - 1];
                    if (lastContent.parts.length > 0 && lastContent.parts[0].text) {
                        lastContent.parts[0].text += contextText;
                    }
                }
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'theSuite/1.0'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: { message: errorText } };
                }
                
                console.error('API Error:', errorData);
                
                let errorMessage = `❌ API Error (${response.status}): `;
                if (errorData.error?.message) {
                    errorMessage += errorData.error.message;
                } else {
                    errorMessage += response.statusText;
                }
                
                addMessageToChat('system', errorMessage);
                
                if (errorData.error?.details) {
                    errorData.error.details.forEach(detail => {
                        addMessageToChat('system', `💡 ${detail.message || JSON.stringify(detail)}`);
                    });
                }
                return;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                const candidate = data.candidates[0];
                const aiResponseParts = candidate.content.parts;
                
                // Check for safety blocks or finish reason
                if (candidate.finishReason === 'SAFETY') {
                    addMessageToChat('system', '⚠️ Response blocked due to safety concerns');
                    if (candidate.safetyRatings) {
                        candidate.safetyRatings.forEach(rating => {
                            if (rating.probability !== 'NEGLIGIBLE') {
                                addMessageToChat('system', `🚫 ${rating.category}: ${rating.probability}`);
                            }
                        });
                    }
                } else if (candidate.finishReason === 'RECITATION') {
                    addMessageToChat('system', '⚠️ Response blocked due to recitation concerns');
                } else {
                    addMessageToChat('model', aiResponseParts);
                }
            } else if (data.promptFeedback && data.promptFeedback.blockReason) {
                addMessageToChat('system', `🚫 Prompt blocked: ${data.promptFeedback.blockReason}`);
                if (data.promptFeedback.blockReasonMessage) {
                    addMessageToChat('system', data.promptFeedback.blockReasonMessage);
                }
            } else {
                addMessageToChat('system', '❓ Received unexpected response from AI');
                console.log("Unexpected AI response:", data);
            }

        } catch (error) {
            console.error('Request Error:', error);
            let errorMessage = '🔌 ';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage += 'Network error: Unable to reach Gemini API. Check your internet connection.';
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            addMessageToChat('system', errorMessage);
        } finally {
            // Reset UI state
            chatInput.disabled = false;
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
            chatInput.focus();
        }
    }

    // Global cleanup function
    function cleanup() {
        try {
            // Clean up memory manager
            memoryManager.cleanup();
            
            // Remove DOM elements
            if (shadowHost && shadowHost.parentNode) {
                shadowHost.parentNode.removeChild(shadowHost);
            }
            if (minimizedIcon && minimizedIcon.parentNode) {
                minimizedIcon.parentNode.removeChild(minimizedIcon);
            }
            
            // Clear references
            suiteContainer = null;
            chatMessagesDiv = null;
            chatInput = null;
            fileInput = null;
            filePreviewArea = null;
            
            // Clear arrays
            currentChatHistory = [];
            attachedFiles = [];
            
            console.log('theSuite cleanup completed');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    // Global cleanup function for emergency use
    window.theSuiteCleanup = cleanup;

    // Initialize the application
    try {
        initUI();
        console.log('theSuite initialized successfully');
    } catch (error) {
        console.error('theSuite initialization error:', error);
        cleanup();
    }

})();
})()
