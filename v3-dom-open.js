/**
 * theSuite - A self-contained chat widget application.
 * This script has been refactored to remove all obfuscation and improve readability.
 */

// Use a consistent, descriptive namespace for the app instance.
const APP_NAMESPACE = 'THE_SUITE_APP';

// If an old instance of the app exists, clean it up before starting a new one.
if (window[APP_NAMESPACE] && typeof window[APP_NAMESPACE].cleanup === 'function') {
    window[APP_NAMESPACE].cleanup(true); // 'true' indicates a reload
}

/**
 * Manages event listeners and timers to ensure they are properly cleaned up
 * when the widget is closed, preventing memory leaks.
 */
class EventManager {
    constructor() {
        this.listeners = [];
        this.timers = new Set();
        this.cleanupCallbacks = new Set();
    }

    add(element, event, handler, options = false) {
        this.listeners.push({ element, event, handler, options });
        element.addEventListener(event, handler, options);
    }

    addTimer(id) {
        this.timers.add(id);
    }

    cleanup() {
        // Remove all registered event listeners
        this.listeners.forEach(({ element, event, handler, options }) => {
            try {
                element.removeEventListener(event, handler, options);
            } catch (e) {
                console.error("Error removing event listener:", e);
            }
        });
        this.listeners = [];

        // Clear all scheduled timers
        this.timers.forEach(id => {
            clearTimeout(id);
            clearInterval(id);
        });
        this.timers.clear();

        // Execute any other cleanup callbacks
        this.cleanupCallbacks.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.error("Error in cleanup callback:", e);
            }
        });
        this.cleanupCallbacks.clear();
    }
}

/**
 * Manages application settings, storing them in localStorage as plain JSON.
 */
class AppSettings {
    constructor() {
        this.defaults = {
            apiKey: '',
            provider: 'gemini',
            model: 'gemini-1.5-flash-latest',
            cohereKey: '',
            huggingfaceKey: '',
            useGoogleSearchGrounding: false,
            useUrlContext: true,
            theme: 'glass',
            primaryAI: 'gemini',
            secondaryAI: 'cohere'
        };
        this.current = { ...this.defaults };
        // Use a fixed, readable key for localStorage.
        this.storageKey = 'theSuite_Settings';
    }

    save() {
        try {
            // Store settings as a plain JSON string.
            localStorage.setItem(this.storageKey, JSON.stringify(this.current));
        } catch (e) {
            console.error("Failed to save settings:", e);
        }
    }

    load() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (storedData) {
                // Parse the JSON string directly.
                const parsedData = JSON.parse(storedData);
                this.current = { ...this.defaults, ...parsedData };
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    }

    get(key) {
        return this.current[key];
    }

    set(key, value) {
        this.current[key] = value;
    }
}

/**
 * Manages the chat history, storing it in localStorage as plain JSON.
 */
class ChatHistory {
    constructor() {
        this.history = [];
        this.maxHistoryLength = 150;
    }

    getKey() {
        // Use a fixed, readable key for the chat history.
        return 'theSuite_ChatHistory';
    }

    save() {
        try {
            const historyToSave = this.history.slice(-this.maxHistoryLength);
            // Store history as a plain JSON string.
            localStorage.setItem(this.getKey(), JSON.stringify(historyToSave));
        } catch (e) {
            console.error("Failed to save chat history:", e);
        }
    }

    load() {
        try {
            const storedHistory = localStorage.getItem(this.getKey());
            if (storedHistory) {
                // Parse the JSON string directly.
                const loadedHistory = JSON.parse(storedHistory);
                if (Array.isArray(loadedHistory)) {
                    this.history = loadedHistory;
                }
            }
        } catch (e) {
            this.history = [];
            console.error("Failed to load chat history:", e);
        }
    }

    add(role, parts) {
        this.history.push({ role, parts });
        this.save();
    }

    get() {
        return this.history.filter(m => m.role === 'user' || m.role === 'model');
    }

    clear() {
        this.history = [];
        this.save();
    }
}

/**
 * Manages and applies visual themes to the widget.
 */
class ThemeManager {
    constructor() {
        this.themes = {
            glass: `backdrop-filter:blur(18px) saturate(150%); background:rgba(25,25,25,0.7); border:1px solid rgba(255,255,255,0.1);`,
            neon: `background:#0a0a0a; border:2px solid #0ff; box-shadow:0 0 20px rgba(0,255,255,0.3);`,
            matrix: `background:#001100; border:1px solid #0f0; font-family:'Consolas',monospace;`,
            dark: `background:#1e1e1e; border:1px solid #404040;`,
            light: `background:#f8f9fa; border:1px solid #dee2e6;`,
            transparent: `backdrop-filter:blur(5px); background:rgba(255,255,255,0.2); border:1px solid rgba(0,0,0,0.2);`
        };
    }

    apply(themeName, container) {
        const isLight = themeName === 'light' || themeName === 'transparent';
        const baseStyle = `color: ${isLight ? '#000' : '#fff'};`;
        container.style.cssText = '';
        container.className = 'suite-container';
        container.style.cssText += baseStyle + (this.themes[themeName] || this.themes.glass);
    }
}

/**
 * Handles API requests to various AI providers.
 */
class ApiClient {
    constructor() {
        this.endpoints = {
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models/',
            cohere: 'https://api.cohere.ai/v1/chat',
            huggingface: 'https://api-inference.huggingface.co/models/'
        };
    }

    async sendMessage(provider, model, messages, apiKey) {
        switch (provider) {
            case 'gemini':
                return this.sendGemini(model, messages, apiKey);
            case 'cohere':
                return this.sendCohere(model, messages, apiKey);
            case 'huggingface':
                return this.sendHuggingFace(model, messages, apiKey);
            default:
                throw new Error(`Provider ${provider} not supported.`);
        }
    }

    async sendGemini(model, messages, apiKey) {
        const response = await fetch(`${this.endpoints.gemini}${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: messages })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error.message);
        }
        return data.candidates[0].content.parts;
    }

    async sendCohere(model, messages, apiKey) {
        const chat_history = messages.slice(0, -1).map(m => ({
            role: m.role === 'user' ? 'USER' : 'CHATBOT',
            message: m.parts[0].text
        }));
        const body = {
            model,
            message: messages[messages.length - 1].parts[0].text,
            chat_history
        };
        const response = await fetch(this.endpoints.cohere, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        return [{ text: data.text }];
    }

    async sendHuggingFace(model, messages, apiKey) {
        const inputs = {
            past_user_inputs: messages.slice(0, -1).filter(m => m.role === 'user').map(m => m.parts[0].text),
            generated_responses: messages.slice(0, -1).filter(m => m.role === 'model').map(m => m.parts[0].text),
            text: messages[messages.length - 1].parts[0].text
        };
        const response = await fetch(`${this.endpoints.huggingface}${model}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ inputs })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Hugging Face API Error');
        }
        return [{ text: data[0].generated_text }];
    }
}

/**
 * The main application class that builds the UI, handles events, and orchestrates everything.
 */
class ChatWidget {
    constructor() {
        this.settings = new AppSettings();
        this.settings.load();
        this.chatHistory = new ChatHistory();
        this.chatHistory.load();
        this.memory = new EventManager();
        this.api = new ApiClient();
        this.themeSystem = new ThemeManager();
        this.attachedFiles = [];

        this.buildUI();
        this.addEventListeners();
        this.applyInitialState();
    }

    buildUI() {
        this.shadowHost = document.createElement('div');
        this.shadowHost.setAttribute('data-thesuite-host', 'true');
        this.shadowHost.style.cssText = `all:initial; position:fixed; top:50px; left:50px; z-index:2147483647;`;
        
        // Use an open shadow DOM for easier debugging.
        this.shadow = this.shadowHost.attachShadow({ mode: 'open' });
        document.body.appendChild(this.shadowHost);

        this.minimizedIcon = document.createElement('div');
        this.minimizedIcon.setAttribute('data-thesuite-minimized', 'true');
        this.minimizedIcon.textContent = '*';
        this.minimizedIcon.style.cssText = `all:initial; position:fixed; bottom:10px; right:10px; width:30px; height:30px; color:rgba(0,0,0,0.5); opacity:0.08; display:none; justify-content:center; align-items:center; font-size:24px; cursor:pointer; z-index:2147483646; border-radius:50%; font-family:'Segoe UI',sans-serif;`;
        document.body.appendChild(this.minimizedIcon);

        this.suiteContainer = document.createElement('div');
        this.suiteContainer.className = 'suite-container';
        this.shadow.appendChild(this.createStyles());

        this.suiteContainer.innerHTML = `
            <div class="header"><span class="title">theSuite</span><div class="header-buttons"><button class="minimize-btn" title="Minimize">–</button><button class="close-btn" title="Close">×</button></div></div>
            <div class="tabs"><button class="tab active" data-tab="chat">Chat</button><button class="tab" data-tab="settings">Settings</button></div>
            <div class="tab-content chat-content">
                <div class="chat-messages"></div>
                <div class="chat-input-area">
                    <div class="file-preview-area"></div><textarea class="chat-input" placeholder="Type or drop files..."></textarea>
                    <div class="chat-buttons">
                        <button class="send-btn">Send</button><button id="multi-send-btn">Multi-Send</button><input type="file" class="file-input" style="display:none;" multiple><button class="attach-btn" title="Attach">📎</button><button class="paste-btn" title="Paste">📋</button><button class="clear-btn" title="Clear">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="tab-content settings-content" style="display:none;">
                 <div class="settings-section"><h3>API Provider (Single Send)</h3><select id="provider-selector"></select></div>
                 <div id="gemini-settings" class="settings-section"><label>Gemini API Key: <input type="password" id="gemini-key"></label></div>
                 <div id="cohere-settings" class="settings-section"><label>Cohere API Key: <input type="password" id="cohere-key"></label></div>
                 <div id="huggingface-settings" class="settings-section"><label>Hugging Face API Key: <input type="password" id="huggingface-key"></label></div>
                 <div class="settings-section"><label>Model: <select id="model-selector"></select></label></div>
                 <div class="settings-section"><h3>Multi-AI Comparison</h3><label>Primary AI: <select id="primary-ai-selector"></select></label><label>Secondary AI: <select id="secondary-ai-selector"></select></label></div>
                 <div class="settings-section"><h3>Features</h3><label class="checkbox-label"><input type="checkbox" id="grounding-cb"> Google Search Grounding</label><label class="checkbox-label"><input type="checkbox" id="url-context-cb"> Send Page Context</label></div>
                 <div class="settings-section"><h3>Appearance</h3><label>Theme: <select id="theme-selector"></select></label></div>
                 <button class="save-settings-btn">Save Settings</button>
            </div>
            <div class="resize-handle"></div>`;
        this.shadow.appendChild(this.suiteContainer);

        // Cache UI elements
        this.chatMessagesDiv = this.shadow.querySelector('.chat-messages');
        this.chatInput = this.shadow.querySelector('.chat-input');
        this.fileInput = this.shadow.querySelector('.file-input');
        this.filePreviewArea = this.shadow.querySelector('.file-preview-area');
    }

    createStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            :host { font-family: 'Segoe UI', sans-serif; }
            .suite-container { position:relative; width:450px; height:600px; min-width:300px; min-height:200px; border-radius:10px; display:flex; flex-direction:column; overflow:hidden; box-sizing:border-box; resize:both; }
            .header { background:rgba(0,0,0,0.2); padding:10px 14px; cursor:grab; display:flex; justify-content:space-between; align-items:center; user-select:none; }
            .header:active { cursor:grabbing; }
            .title { font-weight:600; }
            .header-buttons button { background:none; border:none; color:inherit; font-size:16px; cursor:pointer; padding:0 4px; }
            .tabs { display:flex; border-bottom:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.1); }
            .tab { padding:10px 15px; cursor:pointer; flex-grow:1; text-align:center; border:0; background:none; color:inherit; opacity:0.7; border-bottom:2px solid transparent; transition:all 0.2s ease; }
            .tab.active { font-weight:bold; opacity:1; border-bottom-color:#007bff; }
            .tab-content { padding:16px; flex-grow:1; display:flex; flex-direction:column; overflow:hidden; }
            .settings-content { overflow-y:auto; }
            .settings-section { margin-bottom:15px; }
            .settings-section h3 { margin:0 0 10px; font-size:1em; }
            .settings-content label { display:block; margin-bottom:8px; font-size:0.9em; }
            .checkbox-label { display:flex; align-items:center; }
            .checkbox-label input { width:auto; margin-right:8px; }
            input, select, textarea { width:100%; padding:8px; border-radius:5px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.2); color:inherit; box-sizing:border-box; }
            .save-settings-btn { padding:10px; border:0; border-radius:5px; background:#007bff; color:#fff; cursor:pointer; width:100%; }
            .chat-messages { flex-grow:1; overflow-y:auto; margin-bottom:10px; display:flex; flex-direction:column; gap:8px; }
            .user-message, .ai-message, .system-message, .multi-response-container { padding:10px 14px; border-radius:18px; max-width:100%; word-wrap:break-word; line-height:1.4; }
            .user-message { align-self:flex-end; background:#007bff; color:#fff; border-bottom-right-radius:4px; max-width:85%; }
            .ai-message { align-self:flex-start; background:rgba(255,255,255,0.1); border-bottom-left-radius:4px; max-width:85%; }
            .system-message { align-self:center; font-style:italic; background:rgba(255,255,255,0.1); font-size:0.9em; }
            .multi-response-container { display:flex; gap:10px; background:rgba(0,0,0,0.1); padding:10px; }
            .multi-response-column { flex:1; min-width:0; background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; }
            .multi-response-header { font-weight:bold; font-size:0.8em; opacity:0.7; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:4px; }
            .chat-input-area { display:flex; flex-direction:column; border-top:1px solid rgba(255,255,255,0.2); padding-top:10px; }
            .file-preview-area { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:5px; font-size:0.8em; }
            .file-preview-item { background:rgba(0,0,0,0.3); padding:2px 5px; border-radius:4px; }
            .file-preview-item button { background:none; border:none; color:red; cursor:pointer; }
            .chat-input { min-height:50px; resize:vertical; }
            .chat-buttons { display:flex; gap:5px; margin-top:5px; }
            .send-btn, #multi-send-btn { flex-grow:1; }
            .resize-handle { position:absolute; width:15px; height:15px; bottom:0; right:0; cursor:nwse-resize; }
        `;
        return styleElement;
    }

    addEventListeners() {
        // Drag-and-drop functionality
        let isDragging = false, offsetX, offsetY;
        const header = this.shadow.querySelector('.header');
        this.memory.add(header, 'mousedown', e => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('.header-buttons')) return;
            isDragging = true;
            const rect = this.shadowHost.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
        });
        this.memory.add(window, 'mousemove', e => {
            if (isDragging) {
                this.shadowHost.style.left = `${e.clientX - offsetX}px`;
                this.shadowHost.style.top = `${e.clientY - offsetY}px`;
            }
        });
        this.memory.add(window, 'mouseup', () => isDragging = false);

        // Window controls
        this.memory.add(this.shadow.querySelector('.minimize-btn'), 'click', () => {
            this.shadowHost.style.display = 'none';
            this.minimizedIcon.style.display = 'flex';
        });
        this.memory.add(this.minimizedIcon, 'click', () => {
            this.shadowHost.style.display = 'block';
            this.minimizedIcon.style.display = 'none';
        });
        this.memory.add(this.shadow.querySelector('.close-btn'), 'click', () => this.cleanup());

        // Tabs
        this.shadow.querySelectorAll('.tab').forEach(tab => {
            this.memory.add(tab, 'click', (e) => this.handleTabClick(e));
        });

        // Chat buttons
        this.memory.add(this.shadow.querySelector('.send-btn'), 'click', () => this.sendMessage(false));
        this.memory.add(this.shadow.querySelector('#multi-send-btn'), 'click', () => this.sendMessage(true));
        this.memory.add(this.chatInput, 'keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(false);
            }
        });

        // File and clipboard buttons
        this.memory.add(this.shadow.querySelector('.attach-btn'), 'click', () => this.fileInput.click());
        this.memory.add(this.fileInput, 'change', e => this.processFiles(e.target.files));
        this.memory.add(this.shadow.querySelector('.paste-btn'), 'click', () => this.handlePaste());
        this.memory.add(this.shadow.querySelector('.clear-btn'), 'click', () => {
            if (confirm("Are you sure you want to clear the chat history?")) {
                this.chatHistory.clear();
                this.chatMessagesDiv.innerHTML = '';
            }
        });

        // Settings controls
        this.memory.add(this.shadow.querySelector('#provider-selector'), 'change', () => this.handleProviderChange());
        this.memory.add(this.shadow.querySelector('.save-settings-btn'), 'click', () => this.saveSettingsFromUI());
    }

    applyInitialState() {
        this.themeSystem.apply(this.settings.get('theme'), this.suiteContainer);
        this.chatHistory.history.forEach(msg => this.addMessageToUI(msg.role, msg.parts, false));
        this.populateSettingsUI();
    }
    
    handleTabClick(e) {
        this.shadow.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const isSettings = e.target.dataset.tab === 'settings';
        this.shadow.querySelector('.chat-content').style.display = isSettings ? 'none' : 'flex';
        this.shadow.querySelector('.settings-content').style.display = isSettings ? 'block' : 'none';
    }

    populateSettingsUI() {
        const providers = ['gemini', 'cohere', 'huggingface'];
        const providerSelectors = ['#provider-selector', '#primary-ai-selector', '#secondary-ai-selector'];
        providerSelectors.forEach(sel => {
            this.shadow.querySelector(sel).innerHTML = providers.map(p => `<option value="${p}">${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('');
        });

        this.shadow.querySelector('#theme-selector').innerHTML = Object.keys(this.themeSystem.themes).map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');

        this.shadow.querySelector('#provider-selector').value = this.settings.get('provider');
        this.shadow.querySelector('#primary-ai-selector').value = this.settings.get('primaryAI');
        this.shadow.querySelector('#secondary-ai-selector').value = this.settings.get('secondaryAI');
        this.shadow.querySelector('#gemini-key').value = this.settings.get('apiKey');
        this.shadow.querySelector('#cohere-key').value = this.settings.get('cohereKey');
        this.shadow.querySelector('#huggingface-key').value = this.settings.get('huggingfaceKey');
        this.shadow.querySelector('#grounding-cb').checked = this.settings.get('useGoogleSearchGrounding');
        this.shadow.querySelector('#url-context-cb').checked = this.settings.get('useUrlContext');
        this.shadow.querySelector('#theme-selector').value = this.settings.get('theme');
        this.handleProviderChange();
    }

    handleProviderChange() {
        const provider = this.shadow.querySelector('#provider-selector').value;
        this.shadow.querySelector('#gemini-settings').style.display = provider === 'gemini' ? 'block' : 'none';
        this.shadow.querySelector('#cohere-settings').style.display = provider === 'cohere' ? 'block' : 'none';
        this.shadow.querySelector('#huggingface-settings').style.display = provider === 'huggingface' ? 'block' : 'none';
        this.populateModelSelector();
    }

    populateModelSelector() {
        const provider = this.shadow.querySelector('#provider-selector').value;
        const models = {
            'gemini': ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'],
            'cohere': ['command-r-plus', 'command-r'],
            'huggingface': ['microsoft/DialoGPT-large']
        };
        this.shadow.querySelector('#model-selector').innerHTML = models[provider].map(item => `<option value="${item}">${item}</option>`).join('');
        const currentModel = this.settings.get('model');
        if (models[provider].includes(currentModel)) {
            this.shadow.querySelector('#model-selector').value = currentModel;
        } else {
            this.shadow.querySelector('#model-selector').selectedIndex = 0;
        }
    }

    saveSettingsFromUI() {
        this.settings.set('provider', this.shadow.querySelector('#provider-selector').value);
        this.settings.set('apiKey', this.shadow.querySelector('#gemini-key').value);
        this.settings.set('cohereKey', this.shadow.querySelector('#cohere-key').value);
        this.settings.set('huggingfaceKey', this.shadow.querySelector('#huggingface-key').value);
        this.settings.set('model', this.shadow.querySelector('#model-selector').value);
        this.settings.set('primaryAI', this.shadow.querySelector('#primary-ai-selector').value);
        this.settings.set('secondaryAI', this.shadow.querySelector('#secondary-ai-selector').value);
        this.settings.set('useGoogleSearchGrounding', this.shadow.querySelector('#grounding-cb').checked);
        this.settings.set('useUrlContext', this.shadow.querySelector('#url-context-cb').checked);
        this.settings.set('theme', this.shadow.querySelector('#theme-selector').value);
        this.settings.save();
        this.themeSystem.apply(this.settings.get('theme'), this.suiteContainer);

        const saveButton = this.shadow.querySelector('.save-settings-btn');
        saveButton.textContent = 'Saved!';
        this.memory.addTimer(setTimeout(() => saveButton.textContent = 'Save Settings', 1500));
    }

    async sendMessage(isMultiSend = false) {
        const text = this.chatInput.value.trim();
        if (!text && this.attachedFiles.length === 0) return;

        const userParts = [];
        if (text) userParts.push({ text: text });
        this.attachedFiles.forEach(file => userParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } }));

        this.addMessageToUI('user', userParts);
        this.chatHistory.add('user', userParts);

        // Clear input fields
        this.chatInput.value = '';
        this.attachedFiles = [];
        this.updateFilePreview();

        const sendBtn = this.shadow.querySelector('.send-btn');
        const multiSendBtn = this.shadow.querySelector('#multi-send-btn');
        sendBtn.textContent = '...';
        sendBtn.disabled = true;
        multiSendBtn.disabled = true;

        if (isMultiSend) {
            await this.executeMultiSend();
        } else {
            try {
                const provider = this.settings.get('provider');
                const model = this.settings.get('model');
                const apiKey = this.settings.get(provider === 'gemini' ? 'apiKey' : `${provider}Key`);

                if (!apiKey) throw new Error(`${provider} API key not set.`);
                
                const history = this.chatHistory.get().map(entry => ({ role: entry.role, parts: entry.parts.filter(p => p.text || p.inlineData) }));
                const responseParts = await this.api.sendMessage(provider, model, history, apiKey);
                
                this.addMessageToUI('model', responseParts);
                this.chatHistory.add('model', responseParts);
            } catch (error) {
                this.addMessageToUI('system', [{ text: error.message }]);
            }
        }
        
        sendBtn.textContent = 'Send';
        sendBtn.disabled = false;
        multiSendBtn.disabled = false;
    }

    async executeMultiSend() {
        const p1 = this.settings.get('primaryAI');
        const p2 = this.settings.get('secondaryAI');
        const k1 = this.settings.get(p1 === 'gemini' ? 'apiKey' : `${p1}Key`);
        const k2 = this.settings.get(p2 === 'gemini' ? 'apiKey' : `${p2}Key`);
        
        // Using fixed models for simplicity in multi-send
        const m1 = 'gemini-1.5-flash-latest'; 
        const m2 = 'command-r';

        if (!k1 || !k2) {
            this.addMessageToUI('system', [{ text: 'API keys for both primary and secondary AI must be set.' }]);
            return;
        }

        const history = this.chatHistory.get().map(msg => ({ role: msg.role, parts: msg.parts.filter(p => p.text || p.inlineData) }));

        const results = await Promise.allSettled([
            this.api.sendMessage(p1, m1, history, k1),
            this.api.sendMessage(p2, m2, history, k2)
        ]);
        
        const res1 = results[0].status === 'fulfilled' ? results[0].value : [{ text: `Error: ${results[0].reason.message}` }];
        const res2 = results[1].status === 'fulfilled' ? results[1].value : [{ text: `Error: ${results[1].reason.message}` }];

        this.addMultiMessageToUI(p1, res1, p2, res2);
    }

    addMessageToUI(role, parts) {
        const messageEl = document.createElement('div');
        messageEl.className = `${role}-message`;
        let content = '';
        parts.forEach(p => {
            if (p.text) {
                content += p.text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + ' ';
            }
            if (p.inlineData) {
                content += '[Attachment] ';
            }
        });
        messageEl.innerHTML = content;
        this.chatMessagesDiv.appendChild(messageEl);
        this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
    }

    addMultiMessageToUI(provider1, parts1, provider2, parts2) {
        const container = document.createElement('div');
        container.className = 'multi-response-container';
        const text1 = parts1[0]?.text || '[No Response]';
        const text2 = parts2[0]?.text || '[No Response]';

        container.innerHTML = `
            <div class="multi-response-column">
                <div class="multi-response-header">${provider1}</div>
                <div>${text1}</div>
            </div>
            <div class="multi-response-column">
                <div class="multi-response-header">${provider2}</div>
                <div>${text2}</div>
            </div>`;
        this.chatMessagesDiv.appendChild(container);
        this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
    }

    async handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                this.chatInput.value += text;
            }
        } catch (error) {
            this.addMessageToUI('system', [{ text: 'Clipboard read failed. Ensure you have granted permission.' }]);
        }
    }

    processFiles(files) {
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = e => {
                this.attachedFiles.push({
                    name: file.name,
                    mimeType: file.type,
                    data: e.target.result.split(',')[1] // Get base64 data
                });
                this.updateFilePreview();
            };
            reader.readAsDataURL(file);
        }
    }

    updateFilePreview() {
        this.filePreviewArea.innerHTML = this.attachedFiles.map((file, index) =>
            `<div class="file-preview-item">${file.name}<button data-index="${index}">×</button></div>`
        ).join('');

        this.filePreviewArea.querySelectorAll('button').forEach(button => {
            this.memory.add(button, 'click', e => {
                this.attachedFiles.splice(e.target.dataset.index, 1);
                this.updateFilePreview();
            });
        });
    }

    cleanup() {
        this.memory.cleanup();
        if (this.shadowHost) this.shadowHost.remove();
        if (this.minimizedIcon) this.minimizedIcon.remove();
        window[APP_NAMESPACE] = null;
    }
}

// Initialize and attach the application to the window object.
window[APP_NAMESPACE] = new ChatWidget();
