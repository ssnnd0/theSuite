(() => {
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
  
      const apiKey = "GEMINI_API_KEY"; // Replace with your key
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        })
      })
      .then(res => res.json())
      .then(data => {
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer.";
        localStorage.setItem("aiResponse", answer);
        renderTabs();
      })
      .catch(err => console.error("API Error:", err));
    }
  
    function renderTabs() {
      document.querySelector("#tabContainer")?.remove();
    
      const container = document.createElement("div");
      container.id = "tabContainer";
      container.style = `
        position: fixed;
        bottom: 30px;
        right: 10px;
        width: 240px;
        height: 140px;
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
      tabHeader.style = "display: flex; height: 20px;";
    
      const aiTab = document.createElement("div");
      aiTab.textContent = "AI";
      aiTab.style = "flex: 1; text-align: center; cursor: pointer; padding: 2px; background: rgba(255,255,255,0.02);";
    
      const notesTab = document.createElement("div");
      notesTab.textContent = "Notes";
      notesTab.style = "flex: 1; text-align: center; cursor: pointer; padding: 2px;";
    
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
        if (tab === "ai") {
          aiTab.style.background = "rgba(255,255,255,0.02)";
          notesTab.style.background = "transparent";
          contentBox.textContent = localStorage.getItem("aiResponse") || "(No AI response yet)";
          contentBox.contentEditable = "false";
        } else {
          aiTab.style.background = "transparent";
          notesTab.style.background = "rgba(255,255,255,0.02)";
          contentBox.textContent = localStorage.getItem("persistentNotes") || "";
          contentBox.contentEditable = "true";
          contentBox.oninput = () => {
            localStorage.setItem("persistentNotes", contentBox.textContent);
          };
        }
      }
    
      aiTab.onclick = () => switchTab("ai");
      notesTab.onclick = () => switchTab("notes");
    
      tabHeader.append(aiTab, notesTab);
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
  })();  
