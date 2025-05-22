(function(){(() => {
    async function readClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        return text.trim();
      } catch (err) {
        console.error('Failed to read clipboard contents:', err);
        return "";
      }
    }
 
    async function processClipboardContent() {
      const clipboardText = await readClipboard();
      if (!clipboardText) {
        console.log("Clipboard is empty or couldn't be read.");
        return;
      }
 
      const prompt = "Answer the following as concisely and directly as possible. No introductions, explanations, or extra words. Just the answer. However, make sure you answer the full question with as much detail as required, without extraneous info.\n" + clipboardText;
 
      await sendToAI(prompt);
    }

    async function sendToAI(message, imageData = null) {
      const apiKey = "GEMINI_API_KEY"; // Replace with your key
     
      let contents = [{
        parts: [{ text: message }]
      }];

      if (imageData) {
        contents[0].parts.push({
          inline_data: {
            mime_type: imageData.mimeType,
            data: imageData.data
          }
        });
      }

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: contents,
            generationConfig: { temperature: 0.7 }
          })
        });

        const data = await response.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer.";
       
        // Add to chat history
        addToChatHistory('user', message, imageData);
        addToChatHistory('ai', answer);
       
        localStorage.setItem("aiResponse", answer);
        renderTabs();
      } catch (err) {
        console.error("API Error:", err);
        addToChatHistory('ai', "Error: Could not get response from AI");
      }
    }

    function addToChatHistory(sender, message, imageData = null) {
      const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
      chatHistory.push({
        sender,
        message,
        imageData,
        timestamp: Date.now()
      });
      // Keep only last 50 messages
      if (chatHistory.length > 50) {
        chatHistory.splice(0, chatHistory.length - 50);
      }
      localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    }

    function renderChatHistory() {
      const chatHistory = JSON.parse(localStorage.getItem("chatHistory") || "[]");
      const chatContainer = document.getElementById("chatContent");
      if (!chatContainer) return;

      chatContainer.innerHTML = "";
     
      chatHistory.forEach(entry => {
        const messageDiv = document.createElement("div");
        messageDiv.style.cssText = `
          margin-bottom: 8px;
          padding: 4px;
          border-radius: 3px;
          background: ${entry.sender === 'user' ? 'rgba(0,100,200,0.1)' : 'rgba(100,100,100,0.1)'};
        `;
       
        const senderLabel = document.createElement("div");
        senderLabel.textContent = entry.sender === 'user' ? 'You:' : 'AI:';
        senderLabel.style.cssText = "font-weight: bold; font-size: 10px; margin-bottom: 2px;";
       
        const messageText = document.createElement("div");
        messageText.textContent = entry.message;
        messageText.style.cssText = "font-size: 10px; line-height: 1.2; word-wrap: break-word;";
       
        messageDiv.append(senderLabel, messageText);
       
        if (entry.imageData) {
          const img = document.createElement("img");
          img.src = `data:${entry.imageData.mimeType};base64,${entry.imageData.data}`;
          img.style.cssText = "max-width: 100%; max-height: 80px; margin-top: 4px; border-radius: 2px;";
          messageDiv.appendChild(img);
        }
       
        chatContainer.appendChild(messageDiv);
      });
     
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function createChatInput() {
      const inputContainer = document.createElement("div");
      inputContainer.style.cssText = `
        display: flex;
        padding: 4px;
        background: rgba(0,0,0,0.2);
        gap: 4px;
      `;

      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.placeholder = "Type message...";
      textInput.style.cssText = `
        flex: 1;
        background: rgba(255,255,255,0.1);
        border: none;
        color: #ccc;
        padding: 4px;
        font-size: 10px;
        border-radius: 2px;
      `;

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";

      const imageBtn = document.createElement("button");
      imageBtn.textContent = "📷";
      imageBtn.style.cssText = `
        background: rgba(255,255,255,0.1);
        border: none;
        color: #ccc;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 2px;
        font-size: 10px;
      `;

      const sendBtn = document.createElement("button");
      sendBtn.textContent = "Send";
      sendBtn.style.cssText = `
        background: rgba(0,100,200,0.3);
        border: none;
        color: #ccc;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 2px;
        font-size: 10px;
      `;

      let selectedImage = null;

      imageBtn.onclick = () => fileInput.click();

      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            selectedImage = {
              data: e.target.result.split(',')[1],
              mimeType: file.type
            };
            imageBtn.textContent = "✅";
            imageBtn.style.background = "rgba(0,150,0,0.3)";
          };
          reader.readAsDataURL(file);
        }
      };

      async function sendMessage() {
        const message = textInput.value.trim();
        if (!message && !selectedImage) return;

        const finalMessage = message || "(Image sent)";
        await sendToAI(finalMessage, selectedImage);
       
        textInput.value = "";
        selectedImage = null;
        imageBtn.textContent = "📷";
        imageBtn.style.background = "rgba(255,255,255,0.1)";
        fileInput.value = "";
      }

      sendBtn.onclick = sendMessage;

      textInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      };

      inputContainer.append(textInput, fileInput, imageBtn, sendBtn);
      return inputContainer;
    }
 
    function renderTabs() {
      document.querySelector("#tabContainer")?.remove();
   
      const container = document.createElement("div");
      container.id = "tabContainer";
      container.style = `
        position: fixed;
        bottom: 30px;
        right: 10px;
        width: 320px;
        height: 400px;
        background: rgba(255, 255, 255, 0.05);
        color: #ccc;
        font-size: 11px;
        border-radius: 4px;
        display: none;
        flex-direction: column;
        z-index: 9999;
        backdrop-filter: blur(3px);
        font-family: sans-serif;
        overflow: hidden;
      `;
   
      const tabHeader = document.createElement("div");
      tabHeader.style = "display: flex; height: 24px;";
   
      const aiTab = document.createElement("div");
      aiTab.textContent = "AI";
      aiTab.style = "flex: 1; text-align: center; cursor: pointer; padding: 4px; background: rgba(255,255,255,0.02);";
   
      const chatTab = document.createElement("div");
      chatTab.textContent = "Chat";
      chatTab.style = "flex: 1; text-align: center; cursor: pointer; padding: 4px;";

      const notesTab = document.createElement("div");
      notesTab.textContent = "Notes";
      notesTab.style = "flex: 1; text-align: center; cursor: pointer; padding: 4px;";
   
      const contentBox = document.createElement("div");
      contentBox.id = "tabContent";
      contentBox.style = `
        flex: 1;
        overflow-y: auto;
        padding: 4px;
        white-space: pre-wrap;
        line-height: 1.3;
      `;
   
      function switchTab(tab) {
        // Reset all tabs
        [aiTab, chatTab, notesTab].forEach(t => t.style.background = "transparent");
       
        if (tab === "ai") {
          aiTab.style.background = "rgba(255,255,255,0.02)";
          contentBox.innerHTML = "";
          contentBox.textContent = localStorage.getItem("aiResponse") || "(No AI response yet)";
          contentBox.contentEditable = "false";
        } else if (tab === "chat") {
          chatTab.style.background = "rgba(255,255,255,0.02)";
          contentBox.innerHTML = "";
          contentBox.contentEditable = "false";
         
          // Create chat interface
          const chatContent = document.createElement("div");
          chatContent.id = "chatContent";
          chatContent.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 4px;
            margin-bottom: 4px;
          `;
         
          const chatInput = createChatInput();
         
          contentBox.style.display = "flex";
          contentBox.style.flexDirection = "column";
          contentBox.append(chatContent, chatInput);
         
          renderChatHistory();
        } else {
          notesTab.style.background = "rgba(255,255,255,0.02)";
          contentBox.innerHTML = "";
          contentBox.style.display = "block";
          contentBox.textContent = localStorage.getItem("persistentNotes") || "";
          contentBox.contentEditable = "true";
          contentBox.oninput = () => {
            localStorage.setItem("persistentNotes", contentBox.textContent);
          };
        }
      }
   
      aiTab.onclick = () => switchTab("ai");
      chatTab.onclick = () => switchTab("chat");
      notesTab.onclick = () => switchTab("notes");
   
      tabHeader.append(aiTab, chatTab, notesTab);
      container.append(tabHeader, contentBox);
      document.body.appendChild(container);
    }
   
 
    function cleanupUIOnly() {
      ["requestAIButton", "starButton", "panicButton", "tabContainer"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    }
 
    // Create Buttons
 
    const styleCommon = `
      position: fixed;
      font-size: 14px;
      background: transparent;
      color: #999;
      cursor: pointer;
      z-index: 9999;
      user-select: none;
      opacity: 0.6;
    `;
 
    // ? Button (Ask AI)
    const askBtn = document.createElement("div");
    askBtn.textContent = "?";
    askBtn.id = "requestAIButton";
    askBtn.style = styleCommon + "bottom: 10px; left: 10px;";
    askBtn.onclick = processClipboardContent;
    document.body.appendChild(askBtn);
 
    // * Button (Open Tabs)
    const starBtn = document.createElement("div");
    starBtn.textContent = "*";
    starBtn.id = "starButton";
    starBtn.style = styleCommon + "bottom: 10px; right: 10px;";
    starBtn.onclick = () => {
      const box = document.getElementById("tabContainer");
      if (!box) {
        renderTabs();
      } else {
        box.style.display = box.style.display === "none" ? "flex" : "none";
      }
    };
    document.body.appendChild(starBtn);
 
    // ! Button (Panic – Hide UI)
    const panicBtn = document.createElement("div");
    panicBtn.textContent = "!";
    panicBtn.id = "panicButton";
    panicBtn.style = styleCommon + "bottom: 10px; left: 50%; transform: translateX(-50%);";
    panicBtn.onclick = cleanupUIOnly;
    document.body.appendChild(panicBtn);
 
    // Restore UI if script re-run
    if (localStorage.getItem("aiResponse") || localStorage.getItem("persistentNotes")) {
      // renderTabs();
    }
  })();})()

On Wed, May 21, 2025 at 7:20 PM Sandro Thornton <sandro.thornton@gmail.com> wrote:
javascript:(function()%7B(() %3D> %7B%0A    async function readClipboard() %7B%0A      try %7B%0A        const text %3D await navigator.clipboard.readText()%3B%0A        return text.trim()%3B%0A      %7D catch (err) %7B%0A        console.error('Failed to read clipboard contents%3A'%2C err)%3B%0A        return ""%3B%0A      %7D%0A    %7D%0A %0A    async function processClipboardContent() %7B%0A      const clipboardText %3D await readClipboard()%3B%0A      if (!clipboardText) %7B%0A        console.log("Clipboard is empty or couldn't be read.")%3B%0A        return%3B%0A      %7D%0A %0A      const prompt %3D "Answer the following as concisely and directly as possible. No introductions%2C explanations%2C or extra words. Just the answer. However%2C make sure you answer the full question with as much detail as required%2C without extraneous info.%5Cn" %2B clipboardText%3B%0A %0A      await sendToAI(prompt)%3B%0A    %7D%0A%0A    async function sendToAI(message%2C imageData %3D null) %7B%0A      const apiKey %3D "GEMINI_API_KEY"%3B %2F%2F Replace with your key%0A      %0A      let contents %3D %5B%7B%0A        parts%3A %5B%7B text%3A message %7D%5D%0A      %7D%5D%3B%0A%0A      if (imageData) %7B%0A        contents%5B0%5D.parts.push(%7B%0A          inline_data%3A %7B%0A            mime_type%3A imageData.mimeType%2C%0A            data%3A imageData.data%0A          %7D%0A        %7D)%3B%0A      %7D%0A%0A      try %7B%0A        const response %3D await fetch(%60https%3A%2F%2Fgenerativelanguage.googleapis.com%2Fv1beta%2Fmodels%2Fgemini-2.0-flash-exp%3AgenerateContent%3Fkey%3D%24%7BapiKey%7D%60%2C %7B%0A          method%3A "POST"%2C%0A          headers%3A %7B "Content-Type"%3A "application%2Fjson" %7D%2C%0A          body%3A JSON.stringify(%7B%0A            contents%3A contents%2C%0A            generationConfig%3A %7B temperature%3A 0.7 %7D%0A          %7D)%0A        %7D)%3B%0A%0A        const data %3D await response.json()%3B%0A        const answer %3D data%3F.candidates%3F.%5B0%5D%3F.content%3F.parts%3F.%5B0%5D%3F.text %7C%7C "No answer."%3B%0A        %0A        %2F%2F Add to chat history%0A        addToChatHistory('user'%2C message%2C imageData)%3B%0A        addToChatHistory('ai'%2C answer)%3B%0A        %0A        localStorage.setItem("aiResponse"%2C answer)%3B%0A        renderTabs()%3B%0A      %7D catch (err) %7B%0A        console.error("API Error%3A"%2C err)%3B%0A        addToChatHistory('ai'%2C "Error: Could not get response from AI")%3B%0A      %7D%0A    %7D%0A%0A    function addToChatHistory(sender%2C message%2C imageData %3D null) %7B%0A      const chatHistory %3D JSON.parse(localStorage.getItem("chatHistory") %7C%7C "%5B%5D")%3B%0A      chatHistory.push(%7B%0A        sender%2C%0A        message%2C%0A        imageData%2C%0A        timestamp%3A Date.now()%0A      %7D)%3B%0A      %2F%2F Keep only last 50 messages%0A      if (chatHistory.length > 50) %7B%0A        chatHistory.splice(0%2C chatHistory.length - 50)%3B%0A      %7D%0A      localStorage.setItem("chatHistory"%2C JSON.stringify(chatHistory))%3B%0A    %7D%0A%0A    function renderChatHistory() %7B%0A      const chatHistory %3D JSON.parse(localStorage.getItem("chatHistory") %7C%7C "%5B%5D")%3B%0A      const chatContainer %3D document.getElementById("chatContent")%3B%0A      if (!chatContainer) return%3B%0A%0A      chatContainer.innerHTML %3D ""%3B%0A      %0A      chatHistory.forEach(entry %3D> %7B%0A        const messageDiv %3D document.createElement("div")%3B%0A        messageDiv.style.cssText %3D %60%0A          margin-bottom%3A 8px%3B%0A          padding%3A 4px%3B%0A          border-radius%3A 3px%3B%0A          background%3A %24%7Bentry.sender %3D%3D%3D 'user' %3F 'rgba(0%2C100%2C200%2C0.1)' %3A 'rgba(100%2C100%2C100%2C0.1)'%7D%3B%0A        %60%3B%0A        %0A        const senderLabel %3D document.createElement("div")%3B%0A        senderLabel.textContent %3D entry.sender %3D%3D%3D 'user' %3F 'You%3A' %3A 'AI%3A'%3B%0A        senderLabel.style.cssText %3D "font-weight%3A bold%3B font-size%3A 10px%3B margin-bottom%3A 2px%3B"%3B%0A        %0A        const messageText %3D document.createElement("div")%3B%0A        messageText.textContent %3D entry.message%3B%0A        messageText.style.cssText %3D "font-size%3A 10px%3B line-height%3A 1.2%3B word-wrap%3A break-word%3B"%3B%0A        %0A        messageDiv.append(senderLabel%2C messageText)%3B%0A        %0A        if (entry.imageData) %7B%0A          const img %3D document.createElement("img")%3B%0A          img.src %3D %60data%3A%24%7Bentry.imageData.mimeType%7D%3Bbase64%2C%24%7Bentry.imageData.data%7D%60%3B%0A          img.style.cssText %3D "max-width%3A 100%25%3B max-height%3A 80px%3B margin-top%3A 4px%3B border-radius%3A 2px%3B"%3B%0A          messageDiv.appendChild(img)%3B%0A        %7D%0A        %0A        chatContainer.appendChild(messageDiv)%3B%0A      %7D)%3B%0A      %0A      chatContainer.scrollTop %3D chatContainer.scrollHeight%3B%0A    %7D%0A%0A    function createChatInput() %7B%0A      const inputContainer %3D document.createElement("div")%3B%0A      inputContainer.style.cssText %3D %60%0A        display%3A flex%3B%0A        padding%3A 4px%3B%0A        background%3A rgba(0%2C0%2C0%2C0.2)%3B%0A        gap%3A 4px%3B%0A      %60%3B%0A%0A      const textInput %3D document.createElement("input")%3B%0A      textInput.type %3D "text"%3B%0A      textInput.placeholder %3D "Type message..."%3B%0A      textInput.style.cssText %3D %60%0A        flex%3A 1%3B%0A        background%3A rgba(255%2C255%2C255%2C0.1)%3B%0A        border%3A none%3B%0A        color%3A %23ccc%3B%0A        padding%3A 4px%3B%0A        font-size%3A 10px%3B%0A        border-radius%3A 2px%3B%0A      %60%3B%0A%0A      const fileInput %3D document.createElement("input")%3B%0A      fileInput.type %3D "file"%3B%0A      fileInput.accept %3D "image/*"%3B%0A      fileInput.style.display %3D "none"%3B%0A%0A      const imageBtn %3D document.createElement("button")%3B%0A      imageBtn.textContent %3D "📷"%3B%0A      imageBtn.style.cssText %3D %60%0A        background%3A rgba(255%2C255%2C255%2C0.1)%3B%0A        border%3A none%3B%0A        color%3A %23ccc%3B%0A        padding%3A 4px 6px%3B%0A        cursor%3A pointer%3B%0A        border-radius%3A 2px%3B%0A        font-size%3A 10px%3B%0A      %60%3B%0A%0A      const sendBtn %3D document.createElement("button")%3B%0A      sendBtn.textContent %3D "Send"%3B%0A      sendBtn.style.cssText %3D %60%0A        background%3A rgba(0%2C100%2C200%2C0.3)%3B%0A        border%3A none%3B%0A        color%3A %23ccc%3B%0A        padding%3A 4px 8px%3B%0A        cursor%3A pointer%3B%0A        border-radius%3A 2px%3B%0A        font-size%3A 10px%3B%0A      %60%3B%0A%0A      let selectedImage %3D null%3B%0A%0A      imageBtn.onclick %3D () %3D> fileInput.click()%3B%0A%0A      fileInput.onchange %3D (e) %3D> %7B%0A        const file %3D e.target.files%5B0%5D%3B%0A        if (file) %7B%0A          const reader %3D new FileReader()%3B%0A          reader.onload %3D (e) %3D> %7B%0A            selectedImage %3D %7B%0A              data%3A e.target.result.split('%2C')%5B1%5D%2C%0A              mimeType%3A file.type%0A            %7D%3B%0A            imageBtn.textContent %3D "✅"%3B%0A            imageBtn.style.background %3D "rgba(0%2C150%2C0%2C0.3)"%3B%0A          %7D%3B%0A          reader.readAsDataURL(file)%3B%0A        %7D%0A      %7D%3B%0A%0A      async function sendMessage() %7B%0A        const message %3D textInput.value.trim()%3B%0A        if (!message && !selectedImage) return%3B%0A%0A        const finalMessage %3D message %7C%7C "(Image sent)"%3B%0A        await sendToAI(finalMessage%2C selectedImage)%3B%0A        %0A        textInput.value %3D ""%3B%0A        selectedImage %3D null%3B%0A        imageBtn.textContent %3D "📷"%3B%0A        imageBtn.style.background %3D "rgba(255%2C255%2C255%2C0.1)"%3B%0A        fileInput.value %3D ""%3B%0A      %7D%0A%0A      sendBtn.onclick %3D sendMessage%3B%0A%0A      textInput.onkeypress %3D (e) %3D> %7B%0A        if (e.key %3D%3D%3D 'Enter') %7B%0A          sendMessage()%3B%0A        %7D%0A      %7D%3B%0A%0A      inputContainer.append(textInput%2C fileInput%2C imageBtn%2C sendBtn)%3B%0A      return inputContainer%3B%0A    %7D%0A %0A    function renderTabs() %7B%0A      document.querySelector("%23tabContainer")%3F.remove()%3B%0A   %0A      const container %3D document.createElement("div")%3B%0A      container.id %3D "tabContainer"%3B%0A      container.style %3D %60%0A        position%3A fixed%3B%0A        bottom%3A 30px%3B%0A        right%3A 10px%3B%0A        width%3A 320px%3B%0A        height%3A 400px%3B%0A        background%3A rgba(255%2C 255%2C 255%2C 0.05)%3B%0A        color%3A %23ccc%3B%0A        font-size%3A 11px%3B%0A        border-radius%3A 4px%3B%0A        display%3A none%3B%0A        flex-direction%3A column%3B%0A        z-index%3A 9999%3B%0A        backdrop-filter%3A blur(3px)%3B%0A        font-family%3A sans-serif%3B%0A        overflow%3A hidden%3B%0A      %60%3B%0A   %0A      const tabHeader %3D document.createElement("div")%3B%0A      tabHeader.style %3D "display%3A flex%3B height%3A 24px%3B"%3B%0A   %0A      const aiTab %3D document.createElement("div")%3B%0A      aiTab.textContent %3D "AI"%3B%0A      aiTab.style %3D "flex%3A 1%3B text-align%3A center%3B cursor%3A pointer%3B padding%3A 4px%3B background%3A rgba(255%2C255%2C255%2C0.02)%3B"%3B%0A   %0A      const chatTab %3D document.createElement("div")%3B%0A      chatTab.textContent %3D "Chat"%3B%0A      chatTab.style %3D "flex%3A 1%3B text-align%3A center%3B cursor%3A pointer%3B padding%3A 4px%3B"%3B%0A%0A      const notesTab %3D document.createElement("div")%3B%0A      notesTab.textContent %3D "Notes"%3B%0A      notesTab.style %3D "flex%3A 1%3B text-align%3A center%3B cursor%3A pointer%3B padding%3A 4px%3B"%3B%0A   %0A      const contentBox %3D document.createElement("div")%3B%0A      contentBox.id %3D "tabContent"%3B%0A      contentBox.style %3D %60%0A        flex%3A 1%3B%0A        overflow-y%3A auto%3B%0A        padding%3A 4px%3B%0A        white-space%3A pre-wrap%3B%0A        line-height%3A 1.3%3B%0A      %60%3B%0A   %0A      function switchTab(tab) %7B%0A        %2F%2F Reset all tabs%0A        %5BaiTab%2C chatTab%2C notesTab%5D.forEach(t %3D> t.style.background %3D "transparent")%3B%0A        %0A        if (tab %3D%3D%3D "ai") %7B%0A          aiTab.style.background %3D "rgba(255%2C255%2C255%2C0.02)"%3B%0A          contentBox.innerHTML %3D ""%3B%0A          contentBox.textContent %3D localStorage.getItem("aiResponse") %7C%7C "(No AI response yet)"%3B%0A          contentBox.contentEditable %3D "false"%3B%0A        %7D else if (tab %3D%3D%3D "chat") %7B%0A          chatTab.style.background %3D "rgba(255%2C255%2C255%2C0.02)"%3B%0A          contentBox.innerHTML %3D ""%3B%0A          contentBox.contentEditable %3D "false"%3B%0A          %0A          %2F%2F Create chat interface%0A          const chatContent %3D document.createElement("div")%3B%0A          chatContent.id %3D "chatContent"%3B%0A          chatContent.style.cssText %3D %60%0A            flex%3A 1%3B%0A            overflow-y%3A auto%3B%0A            padding%3A 4px%3B%0A            margin-bottom%3A 4px%3B%0A          %60%3B%0A          %0A          const chatInput %3D createChatInput()%3B%0A          %0A          contentBox.style.display %3D "flex"%3B%0A          contentBox.style.flexDirection %3D "column"%3B%0A          contentBox.append(chatContent%2C chatInput)%3B%0A          %0A          renderChatHistory()%3B%0A        %7D else %7B%0A          notesTab.style.background %3D "rgba(255%2C255%2C255%2C0.02)"%3B%0A          contentBox.innerHTML %3D ""%3B%0A          contentBox.style.display %3D "block"%3B%0A          contentBox.textContent %3D localStorage.getItem("persistentNotes") %7C%7C ""%3B%0A          contentBox.contentEditable %3D "true"%3B%0A          contentBox.oninput %3D () %3D> %7B%0A            localStorage.setItem("persistentNotes"%2C contentBox.textContent)%3B%0A          %7D%3B%0A        %7D%0A      %7D%0A   %0A      aiTab.onclick %3D () %3D> switchTab("ai")%3B%0A      chatTab.onclick %3D () %3D> switchTab("chat")%3B%0A      notesTab.onclick %3D () %3D> switchTab("notes")%3B%0A   %0A      tabHeader.append(aiTab%2C chatTab%2C notesTab)%3B%0A      container.append(tabHeader%2C contentBox)%3B%0A      document.body.appendChild(container)%3B%0A    %7D%0A   %0A %0A    function cleanupUIOnly() %7B%0A      %5B"requestAIButton"%2C "starButton"%2C "panicButton"%2C "tabContainer"%5D.forEach(id %3D> %7B%0A        const el %3D document.getElementById(id)%3B%0A        if (el) el.remove()%3B%0A      %7D)%3B%0A    %7D%0A %0A    %2F%2F Create Buttons%0A %0A    const styleCommon %3D %60%0A      position%3A fixed%3B%0A      font-size%3A 14px%3B%0A      background%3A transparent%3B%0A      color%3A %23999%3B%0A      cursor%3A pointer%3B%0A      z-index%3A 9999%3B%0A      user-select%3A none%3B%0A      opacity%3A 0.6%3B%0A    %60%3B%0A %0A    %2F%2F %3F Button (Ask AI)%0A    const askBtn %3D document.createElement("div")%3B%0A    askBtn.textContent %3D "%3F"%3B%0A    askBtn.id %3D "requestAIButton"%3B%0A    askBtn.style %3D styleCommon %2B "bottom%3A 10px%3B left%3A 10px%3B"%3B%0A    askBtn.onclick %3D processClipboardContent%3B%0A    document.body.appendChild(askBtn)%3B%0A %0A    %2F%2F * Button (Open Tabs)%0A    const starBtn %3D document.createElement("div")%3B%0A    starBtn.textContent %3D "*"%3B%0A    starBtn.id %3D "starButton"%3B%0A    starBtn.style %3D styleCommon %2B "bottom%3A 10px%3B right%3A 10px%3B"%3B%0A    starBtn.onclick %3D () %3D> %7B%0A      const box %3D document.getElementById("tabContainer")%3B%0A      if (!box) %7B%0A        renderTabs()%3B%0A      %7D else %7B%0A        box.style.display %3D box.style.display %3D%3D%3D "none" %3F "flex" %3A "none"%3B%0A      %7D%0A    %7D%3B%0A    document.body.appendChild(starBtn)%3B%0A %0A    %2F%2F ! Button (Panic – Hide UI)%0A    const panicBtn %3D document.createElement("div")%3B%0A    panicBtn.textContent %3D "!"%3B%0A    panicBtn.id %3D "panicButton"%3B%0A    panicBtn.style %3D styleCommon %2B "bottom%3A 10px%3B left%3A 50%25%3B transform%3A translateX(-50%25)%3B"%3B%0A    panicBtn.onclick %3D cleanupUIOnly%3B%0A    document.body.appendChild(panicBtn)%3B%0A %0A    %2F%2F Restore UI if script re-run%0A    if (localStorage.getItem("aiResponse") %7C%7C localStorage.getItem("persistentNotes")) %7B%0A      %2F%2F renderTabs()%3B%0A    %7D%0A  %7D)()%3B%7D)()