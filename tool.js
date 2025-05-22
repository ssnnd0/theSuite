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
