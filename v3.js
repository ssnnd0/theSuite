(function(){
javascript:(function() {
    const SECURITY_NAMESPACE = 'TS_SECURE_MULTI_' + Math.random().toString(36).substr(2, 15);
    if (window[SECURITY_NAMESPACE] && typeof window[SECURITY_NAMESPACE].cleanup === 'function') {
        window[SECURITY_NAMESPACE].cleanup(true);
    }

    class SecureMemoryManager {
        constructor() { this.listeners = new Map(); this.timers = new Set(); this.cleanupCallbacks = new Set(); }
        add(element, event, handler, options = false) { const k = `l_${Math.random()}`; this.listeners.set(k, { element, event, handler, options }); element.addEventListener(event, handler, options); }
        addTimer(id) { this.timers.add(id); }
        cleanup(isReload = false) {
            this.listeners.forEach(({ element, event, handler, options }) => { try { element.removeEventListener(event, handler, options); } catch (e) {} });
            this.listeners.clear();
            this.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
            this.timers.clear();
            this.cleanupCallbacks.forEach(cb => { try { cb(); } catch (e) {} });
            this.cleanupCallbacks.clear();
        }
    }

    class SecureSettings {
        constructor() { this.defaults = { apiKey: '', provider: 'gemini', model: 'gemini-1.5-flash-latest', cohereKey: '', huggingfaceKey: '', useGoogleSearchGrounding: false, useUrlContext: true, theme: 'glass', primaryAI: 'gemini', secondaryAI: 'cohere' }; this.current = { ...this.defaults }; this.storageKey = SECURITY_NAMESPACE + '_conf'; }
        obfuscate(v) { return btoa(encodeURIComponent(JSON.stringify(v))); }
        deobfuscate(v) { try { return JSON.parse(decodeURIComponent(atob(v))); } catch { return null; } }
        save() { try { localStorage.setItem(this.storageKey, this.obfuscate(this.current)); } catch (e) {} }
        load() { try { const d = localStorage.getItem(this.storageKey); if (d) this.current = { ...this.defaults, ...this.deobfuscate(d) }; } catch (e) {} }
        get(key) { return this.current[key]; }
        set(key, value) { this.current[key] = value; }
    }

    class SecureChatHistory {
        constructor() { this.history = []; this.max = 150; }
        getKey() { return `${SECURITY_NAMESPACE}_chat_${btoa(window.location.hostname + window.location.pathname).replace(/=/g, '')}`; }
        compress(d) { return btoa(encodeURIComponent(JSON.stringify(d))); }
        decompress(d) { try { return JSON.parse(decodeURIComponent(atob(d))); } catch { return []; } }
        save() { try { localStorage.setItem(this.getKey(), this.compress(this.history.slice(-this.max))); } catch (e) {} }
        load() { try { const s = localStorage.getItem(this.getKey()); if (s) { const d = this.decompress(s); if (Array.isArray(d)) this.history = d; } } catch (e) { this.history = []; } }
        add(role, parts) { this.history.push({ role, parts }); this.save(); }
        get() { return this.history.filter(m => m.role === 'user' || m.role === 'model'); }
        clear() { this.history = []; this.save(); }
    }

    class AdvancedThemeSystem {
        constructor() { this.themes = { glass: `backdrop-filter:blur(18px) saturate(150%); background:rgba(25,25,25,0.7); border:1px solid rgba(255,255,255,0.1);`, neon: `background:#0a0a0a; border:2px solid #0ff; box-shadow:0 0 20px rgba(0,255,255,0.3);`, matrix: `background:#001100; border:1px solid #0f0; font-family:'Consolas',monospace;`, dark: `background:#1e1e1e; border:1px solid #404040;`, light: `background:#f8f9fa; border:1px solid #dee2e6;`, transparent: `backdrop-filter:blur(5px); background:rgba(255,255,255,0.2); border:1px solid rgba(0,0,0,0.2);` }; }
        apply(themeName, container) {
            const isLight = themeName === 'light' || themeName === 'transparent';
            const baseStyle = `color: ${isLight ? '#000' : '#fff'};`;
            container.style.cssText = '';
            container.className = 'suite-container';
            container.style.cssText += baseStyle + (this.themes[themeName] || this.themes.glass);
        }
    }

    class MultiProviderAPI {
        constructor() { this.endpoints = { gemini: 'https://generativelanguage.googleapis.com/v1beta/models/', cohere: 'https://api.cohere.ai/v1/chat', huggingface: 'https://api-inference.huggingface.co/models/' }; }
        async sendMessage(provider, model, messages, apiKey) {
            switch (provider) {
                case 'gemini': return this.sendGemini(model, messages, apiKey);
                case 'cohere': return this.sendCohere(model, messages, apiKey);
                case 'huggingface': return this.sendHuggingFace(model, messages, apiKey);
                default: throw new Error(`Provider ${provider} not supported.`);
            }
        }
        async sendGemini(model, messages, apiKey) { const r=await fetch(`${this.endpoints.gemini}${model}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:messages})}); if(!r.ok){const e=await r.json();throw new Error(e.error.message);} const d=await r.json(); return d.candidates[0].content.parts; }
        async sendCohere(model, messages, apiKey) { const h=messages.slice(0,-1).map(m=>({role:m.role==='user'?'USER':'CHATBOT',message:m.parts[0].text})); const b={model,message:messages[messages.length-1].parts[0].text,chat_history:h}; const r=await fetch(this.endpoints.cohere,{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(b)}); if(!r.ok){const e=await r.json();throw new Error(e.message);} const d=await r.json(); return [{text:d.text}];}
        async sendHuggingFace(model, messages, apiKey) { const i={past_user_inputs:messages.slice(0,-1).filter(m=>m.role==='user').map(m=>m.parts[0].text),generated_responses:messages.slice(0,-1).filter(m=>m.role==='model').map(m=>m.parts[0].text),text:messages[messages.length-1].parts[0].text}; const r=await fetch(`${this.endpoints.huggingface}${model}`,{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`},body:JSON.stringify({inputs:i})}); if(!r.ok){const e=await r.json();throw new Error(e.error||'HF API Error');} const d=await r.json(); return [{text:d[0].generated_text}];}
    }

    class SuiteApplication {
        constructor() {
            this.settings = new SecureSettings(); this.settings.load();
            this.chatHistory = new SecureChatHistory(); this.chatHistory.load();
            this.memory = new SecureMemoryManager();
            this.api = new MultiProviderAPI();
            this.themeSystem = new AdvancedThemeSystem();
            this.attachedFiles = [];
            this.buildUI();
            this.addEventListeners();
            this.applyInitialState();
        }
        buildUI() {
            this.shadowHost = document.createElement('div'); this.shadowHost.setAttribute('data-thesuite-host','true'); this.shadowHost.style.cssText = `all:initial; position:fixed; top:50px; left:50px; z-index:2147483647;`;
            this.shadow = this.shadowHost.attachShadow({mode:'closed'}); document.body.appendChild(this.shadowHost);
            this.minimizedIcon = document.createElement('div'); this.minimizedIcon.setAttribute('data-thesuite-minimized','true'); this.minimizedIcon.textContent = '*';
            this.minimizedIcon.style.cssText = `all:initial; position:fixed; bottom:10px; right:10px; width:30px; height:30px; color:rgba(0,0,0,0.5); opacity:0.08; display:none; justify-content:center; align-items:center; font-size:24px; cursor:pointer; z-index:2147483646; border-radius:50%; font-family:'Segoe UI',sans-serif;`;
            document.body.appendChild(this.minimizedIcon);
            this.suiteContainer = document.createElement('div'); this.suiteContainer.className = 'suite-container';
            this.shadow.appendChild(this.createStyles());
            let html = `
            <div class="gas-header"><span class="gas-title">theSuite</span><div class="gas-header-buttons"><button class="gas-minimize-btn" title="Minimize">–</button><button class="gas-close-btn" title="Close">×</button></div></div>
            <div class="gas-tabs"><button class="gas-tab active" data-tab="chat">Chat</button><button class="gas-tab" data-tab="settings">Settings</button></div>
            <div class="gas-tab-content gas-chat-content">
                <div class="gas-chat-messages"></div>
                <div class="gas-chat-input-area">
                    <div class="gas-file-preview-area"></div><textarea class="gas-chat-input" placeholder="Type or drop files..."></textarea>
                    <div class="gas-chat-buttons">
                        <button class="gas-send-btn">Send</button><button id="multi-send-btn">Multi-Send</button><input type="file" class="gas-file-input" style="display:none;" multiple><button class="gas-attach-btn" title="Attach">📎</button><button class="gas-paste-btn" title="Paste">📋</button><button class="gas-clear-btn" title="Clear">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="gas-tab-content gas-settings-content">
                 <div class="gas-settings-section"><h3>API Provider (Single Send)</h3><select id="provider-selector"></select></div>
                 <div id="gemini-settings" class="gas-settings-section"><label>Gemini API Key: <input type="password" id="gemini-key"></label></div>
                 <div id="cohere-settings" class="gas-settings-section"><label>Cohere API Key: <input type="password" id="cohere-key"></label></div>
                 <div id="huggingface-settings" class="gas-settings-section"><label>Hugging Face API Key: <input type="password" id="huggingface-key"></label></div>
                 <div class="gas-settings-section"><label>Model: <select id="model-selector"></select></label></div>
                 <div class="gas-settings-section"><h3>Multi-AI Comparison</h3><label>Primary AI: <select id="primary-ai-selector"></select></label><label>Secondary AI: <select id="secondary-ai-selector"></select></label></div>
                 <div class="gas-settings-section"><h3>Features</h3><label class="gas-checkbox-label"><input type="checkbox" id="grounding-cb"> Google Search Grounding</label><label class="gas-checkbox-label"><input type="checkbox" id="url-context-cb"> Send Page Context</label></div>
                 <div class="gas-settings-section"><h3>Appearance</h3><label>Theme: <select id="theme-selector"></select></label></div>
                 <button class="gas-save-settings-btn">Save Settings</button>
            </div>
            <div class="gas-resize-handle"></div>`;
            this.suiteContainer.innerHTML = html; this.shadow.appendChild(this.suiteContainer);
            this.chatMessagesDiv = this.shadow.querySelector('.gas-chat-messages'); this.chatInput = this.shadow.querySelector('.gas-chat-input'); this.fileInput = this.shadow.querySelector('.gas-file-input'); this.filePreviewArea = this.shadow.querySelector('.gas-file-preview-area');
        }
        createStyles(){const s=document.createElement('style');s.textContent=`
            .suite-container{position:relative;width:450px;height:600px;min-width:300px;min-height:200px;border-radius:10px;display:flex;flex-direction:column;font-family:'Segoe UI',sans-serif;overflow:hidden;box-sizing:border-box;resize:both;}
            .gas-header{background:rgba(0,0,0,0.2);padding:10px 14px;cursor:grab;display:flex;justify-content:space-between;align-items:center;user-select:none;}
            .gas-header:active{cursor:grabbing;}.gas-title{font-weight:600;}
            .gas-header-buttons button{background:0;border:0;color:inherit;font-size:16px;cursor:pointer;padding:0 4px;}
            .gas-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.1);}
            .gas-tab{padding:10px 15px;cursor:pointer;flex-grow:1;text-align:center;border:0;background:0;color:inherit;opacity:0.7;border-bottom:2px solid transparent;transition:all 0.2s ease;}
            .gas-tab.active{font-weight:bold;opacity:1;border-bottom-color:#007bff;}
            .gas-tab-content{padding:16px;flex-grow:1;display:flex;flex-direction:column;overflow:hidden;}
            .gas-chat-content{display:flex;}.gas-settings-content{display:none;overflow-y:auto;}
            .gas-settings-section{margin-bottom:15px;}.gas-settings-section h3{margin:0 0 10px;font-size:1em;}
            .gas-settings-content label{display:block;margin-bottom:8px;font-size:0.9em;}
            .gas-checkbox-label{display:flex;flex-direction:row;align-items:center;}.gas-checkbox-label input{width:auto;margin-right:8px;}
            input,select,textarea{width:100%;padding:8px;border-radius:5px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.2);color:inherit;box-sizing:border-box;}
            .gas-save-settings-btn{padding:10px;border:0;border-radius:5px;background:#007bff;color:#fff;cursor:pointer;width:100%;}
            .gas-chat-messages{flex-grow:1;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;}
            .user-message,.ai-message,.system-message,.multi-response-container{padding:10px 14px;border-radius:18px;max-width:100%;word-wrap:break-word;line-height:1.4;}
            .user-message{align-self:flex-end;background:#007bff;color:#fff;border-bottom-right-radius:4px;max-width:85%;}
            .ai-message{align-self:flex-start;background:rgba(255,255,255,0.1);border-bottom-left-radius:4px;max-width:85%;}
            .system-message{align-self:center;font-style:italic;background:rgba(255,255,255,0.1);font-size:0.9em;}
            .multi-response-container{display:flex;gap:10px;background:rgba(0,0,0,0.1);padding:10px;}
            .multi-response-column{flex:1;min-width:0;background:rgba(0,0,0,0.2);padding:8px;border-radius:8px;}
            .multi-response-header{font-weight:bold;font-size:0.8em;opacity:0.7;margin-bottom:5px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;}
            .gas-chat-input-area{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.2);padding-top:10px;}
            .gas-file-preview-area{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px;font-size:0.8em;}
            .gas-file-preview-item{background:rgba(0,0,0,0.3);padding:2px 5px;border-radius:4px;}
            .gas-file-preview-item button{background:0;border:0;color:red;cursor:pointer;}
            .gas-chat-input{min-height:50px;resize:vertical;}
            .gas-chat-buttons{display:flex;gap:5px;margin-top:5px;}.gas-send-btn,#multi-send-btn{flex-grow:1;}
            .gas-resize-handle{position:absolute;width:15px;height:15px;bottom:0;right:0;cursor:nwse-resize;}`; return s;}
        addEventListeners() {
            let isDragging=false,offsetX,offsetY;
            this.memory.add(this.shadow.querySelector('.gas-header'),'mousedown',e=>{if(e.target.tagName==='BUTTON'||e.target.closest('.gas-header-buttons'))return;isDragging=true;const r=this.shadowHost.getBoundingClientRect();offsetX=e.clientX-r.left;offsetY=e.clientY-r.top;});
            this.memory.add(window,'mousemove',e=>{if(isDragging){this.shadowHost.style.left=`${e.clientX-offsetX}px`;this.shadowHost.style.top=`${e.clientY-offsetY}px`;}});
            this.memory.add(window,'mouseup',()=>isDragging=false);
            this.memory.add(this.shadow.querySelector('.gas-minimize-btn'),'click',()=>{this.shadowHost.style.display='none';this.minimizedIcon.style.display='flex';});
            this.memory.add(this.minimizedIcon,'click',()=>{this.shadowHost.style.display='block';this.minimizedIcon.style.display='none';});
            this.memory.add(this.shadow.querySelector('.gas-close-btn'),'click',()=>this.cleanup());
            this.shadow.querySelectorAll('.gas-tab').forEach(tab=>this.memory.add(tab,'click',(e)=>this.handleTabClick(e)));
            this.memory.add(this.shadow.querySelector('.gas-send-btn'),'click',()=>this.sendMessage());
            this.memory.add(this.shadow.querySelector('#multi-send-btn'),'click',()=>this.sendMultiMessage());
            this.memory.add(this.chatInput,'keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.sendMessage();}});
            this.memory.add(this.shadow.querySelector('.gas-attach-btn'),'click',()=>this.fileInput.click());
            this.memory.add(this.fileInput,'change',e=>this.processFiles(e.target.files));
            this.memory.add(this.shadow.querySelector('.gas-paste-btn'),'click',()=>this.handlePaste());
            this.memory.add(this.shadow.querySelector('.gas-clear-btn'),'click',()=>{if(confirm("Clear history?")){this.chatHistory.clear();this.chatMessagesDiv.innerHTML='';}});
            this.memory.add(this.shadow.querySelector('#provider-selector'),'change',()=>this.handleProviderChange());
            this.memory.add(this.shadow.querySelector('.gas-save-settings-btn'),'click',()=>this.saveSettingsFromUI());
        }
        applyInitialState(){this.themeSystem.apply(this.settings.get('theme'),this.suiteContainer);this.chatHistory.history.forEach(msg=>this.addMessageToUI(msg.role,msg.parts,false));this.populateSettingsUI();}
        handleTabClick(e){this.shadow.querySelectorAll('.gas-tab').forEach(t=>t.classList.remove('active'));e.target.classList.add('active');const isSettings=e.target.dataset.tab==='settings';this.shadow.querySelector('.gas-chat-content').style.display=isSettings?'none':'flex';this.shadow.querySelector('.gas-settings-content').style.display=isSettings?'block':'none';}
        populateSettingsUI() {
            const providers=['gemini','cohere','huggingface'];
            const pSels=['#provider-selector','#primary-ai-selector','#secondary-ai-selector'];
            pSels.forEach(sel=>{this.shadow.querySelector(sel).innerHTML=providers.map(p=>`<option value="${p}">${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');});
            this.shadow.querySelector('#theme-selector').innerHTML=Object.keys(this.themeSystem.themes).map(t=>`<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('');
            this.shadow.querySelector('#provider-selector').value=this.settings.get('provider');
            this.shadow.querySelector('#primary-ai-selector').value=this.settings.get('primaryAI');
            this.shadow.querySelector('#secondary-ai-selector').value=this.settings.get('secondaryAI');
            this.shadow.querySelector('#gemini-key').value=this.settings.get('apiKey');
            this.shadow.querySelector('#cohere-key').value=this.settings.get('cohereKey');
            this.shadow.querySelector('#huggingface-key').value=this.settings.get('huggingfaceKey');
            this.shadow.querySelector('#grounding-cb').checked=this.settings.get('useGoogleSearchGrounding');
            this.shadow.querySelector('#url-context-cb').checked=this.settings.get('useUrlContext');
            this.shadow.querySelector('#theme-selector').value=this.settings.get('theme');
            this.handleProviderChange();
        }
        handleProviderChange(){const p=this.shadow.querySelector('#provider-selector').value;this.shadow.querySelector('#gemini-settings').style.display=p==='gemini'?'block':'none';this.shadow.querySelector('#cohere-settings').style.display=p==='cohere'?'block':'none';this.shadow.querySelector('#huggingface-settings').style.display=p==='huggingface'?'block':'none';this.populateModelSelector();}
        populateModelSelector(){const p=this.shadow.querySelector('#provider-selector').value;const m={'gemini':['gemini-1.5-flash-latest','gemini-1.5-pro-latest'],'cohere':['command-r-plus','command-r'],'huggingface':['microsoft/DialoGPT-large']};this.shadow.querySelector('#model-selector').innerHTML=m[p].map(i=>`<option value="${i}">${i}</option>`).join('');const c=this.settings.get('model');if(m[p].includes(c)){this.shadow.querySelector('#model-selector').value=c;}else{this.shadow.querySelector('#model-selector').selectedIndex=0;}}
        saveSettingsFromUI() {
            this.settings.set('provider',this.shadow.querySelector('#provider-selector').value);
            this.settings.set('apiKey',this.shadow.querySelector('#gemini-key').value);
            this.settings.set('cohereKey',this.shadow.querySelector('#cohere-key').value);
            this.settings.set('huggingfaceKey',this.shadow.querySelector('#huggingface-key').value);
            this.settings.set('model',this.shadow.querySelector('#model-selector').value);
            this.settings.set('primaryAI',this.shadow.querySelector('#primary-ai-selector').value);
            this.settings.set('secondaryAI',this.shadow.querySelector('#secondary-ai-selector').value);
            this.settings.set('useGoogleSearchGrounding',this.shadow.querySelector('#grounding-cb').checked);
            this.settings.set('useUrlContext',this.shadow.querySelector('#url-context-cb').checked);
            this.settings.set('theme',this.shadow.querySelector('#theme-selector').value);
            this.settings.save();
            this.themeSystem.apply(this.settings.get('theme'),this.suiteContainer);
            const btn=this.shadow.querySelector('.gas-save-settings-btn');btn.textContent='Saved!';this.memory.addTimer(setTimeout(()=>btn.textContent='Save Settings',1500));
        }
        async sendMessage(isMulti=false){const t=this.chatInput.value.trim();if(!t&&this.attachedFiles.length===0)return;const p=[];if(t)p.push({text:t});this.attachedFiles.forEach(f=>p.push({inlineData:{mimeType:f.mimeType,data:f.data}}));this.addMessageToUI('user',p);this.chatHistory.add('user',p);this.chatInput.value='';this.attachedFiles=[];this.updateFilePreview();const s=this.shadow.querySelector('.gas-send-btn'),m=this.shadow.querySelector('#multi-send-btn');s.textContent='...';s.disabled=true;m.disabled=true;if(isMulti){await this.executeMultiSend(p);s.textContent='Send';s.disabled=false;m.disabled=false;}else{try{const r=this.settings.get('provider'),o=this.settings.get('model'),i=this.settings.get(r==='gemini'?'apiKey':`${r}Key`);if(!i)throw new Error(`${r} API key not set.`);const a=this.chatHistory.get().map(e=>({role:e.role,parts:e.parts.filter(p=>p.text||p.inlineData)}));const n=await this.api.sendMessage(r,o,a,i);this.addMessageToUI('model',n);this.chatHistory.add('model',n);}catch(e){this.addMessageToUI('system',[{text:e.message}]);}finally{s.textContent='Send';s.disabled=false;m.disabled=false;}}}
        async sendMultiMessage(){await this.sendMessage(true);}
        async executeMultiSend(userParts){
            const p1=this.settings.get('primaryAI'),p2=this.settings.get('secondaryAI');
            const k1=this.settings.get(p1==='gemini'?'apiKey':`${p1}Key`),k2=this.settings.get(p2==='gemini'?'apiKey':`${p2}Key`);
            const m1='gemini-1.5-flash-latest',m2='command-r';// Simplified for now
            const h=this.chatHistory.get().map(msg=>({role:msg.role,parts:msg.parts.filter(p=>p.text||p.inlineData)}));
            if(!k1||!k2){this.addMessageToUI('system',[{text:'API keys for both primary and secondary AI must be set.'}]);return;}
            const results=await Promise.allSettled([this.api.sendMessage(p1,m1,h,k1),this.api.sendMessage(p2,m2,h,k2)]);
            const res1=results[0].status==='fulfilled'?results[0].value:[{text:`Error: ${results[0].reason.message}`}];
            const res2=results[1].status==='fulfilled'?results[1].value:[{text:`Error: ${results[1].reason.message}`}];
            this.addMultiMessageToUI(p1,res1,p2,res2);
        }
        addMessageToUI(role,parts,save=true){const el=document.createElement('div');el.className=`${role}-message`;let c='';parts.forEach(p=>{if(p.text)c+=p.text.replace(/</g,"&lt;").replace(/>/g,"&gt;")+' ';if(p.inlineData)c+='[Attachment] ';});el.innerHTML=c;this.chatMessagesDiv.appendChild(el);this.chatMessagesDiv.scrollTop=this.chatMessagesDiv.scrollHeight;}
        addMultiMessageToUI(p1,parts1,p2,parts2){const c=document.createElement('div');c.className='multi-response-container';const t1=parts1[0]?.text||'[No Response]',t2=parts2[0]?.text||'[No Response]';c.innerHTML=`<div class="multi-response-column"><div class="multi-response-header">${p1}</div><div>${t1}</div></div><div class="multi-response-column"><div class="multi-response-header">${p2}</div><div>${t2}</div></div>`;this.chatMessagesDiv.appendChild(c);this.chatMessagesDiv.scrollTop=this.chatMessagesDiv.scrollHeight;}
        async handlePaste(){try{const t=await navigator.clipboard.readText();if(t)this.chatInput.value+=t;}catch(e){this.addMessageToUI('system',[{text:'Clipboard read failed.'}]);}}
        processFiles(files){for(const f of files){const r=new FileReader();r.onload=e=>{this.attachedFiles.push({name:f.name,mimeType:f.type,data:e.target.result.split(',')[1]});this.updateFilePreview();};r.readAsDataURL(f);}}
        updateFilePreview(){this.filePreviewArea.innerHTML=this.attachedFiles.map((f,i)=>`<div class="gas-file-preview-item">${f.name}<button data-index="${i}">×</button></div>`).join('');this.filePreviewArea.querySelectorAll('button').forEach(b=>this.memory.add(b,'click',e=>{this.attachedFiles.splice(e.target.dataset.index,1);this.updateFilePreview();}));}
        cleanup(isReload=false){this.memory.cleanup(isReload);if(this.shadowHost)this.shadowHost.remove();if(this.minimizedIcon)this.minimizedIcon.remove();window[SECURITY_NAMESPACE]=null;}
    }
    window[SECURITY_NAMESPACE]=new SuiteApplication();
})();
})()
