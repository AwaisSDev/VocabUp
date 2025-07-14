chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveVocab",
    title: "Add To Magic Dictionary",
    contexts: ["selection"]  // right-click on selected text
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  const selectedWord = info.selectionText.trim();

  if (!selectedWord) {
    console.error("❌ No word selected.");
    return;
  }

  console.log("📌 Selected Word:", selectedWord);

  const [meaning, sentence, explanation] = await fetchVocabFromGroq(selectedWord);

  console.log("📄 Groq AI Response:", { meaning, sentence, explanation });


  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error("❌ OAuth Error:", chrome.runtime.lastError);
      return;
    }

    console.log("✅ OAuth Token Acquired:", token);

    const sheetId = "YOUR-SHEET-ID";
    const range = "SHEET1!A:C";
    const values = [[selectedWord, meaning, sentence, explanation]];
    const body = { values };

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      console.log(`✅ "${selectedWord}" saved to Google Sheets.`);
    } else {
      const errorText = await res.text();
      console.error("❌ Failed to save to Google Sheets:", errorText);
    }
  });
});


// 🔥 Groq AI Function
async function fetchVocabFromGroq(word) {
  const groqApiKey = 'YOUR-GROQ-API-KEY';

  const prompt = `For the word "${word}", respond ONLY in this CSV format:
Meaning (max 5 words), Simple Sentence, Short Explanation

Example:
Joy, I feel joy., Feeling happy.

ONLY output a single CSV line. No explanation. No extra text. Just the CSV. Now explain "${word}".`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {  // ✅ correct endpoint
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + groqApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama3-70b-8192',    // or mixtral if you prefer
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();

  console.log("🔍 Groq Full API Response:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('❌ Invalid Groq API response:', JSON.stringify(data, null, 2));
    return ["-", "-", "-"];
  }

  const content = data.choices[0].message.content.trim();
  console.log("📄 Raw Groq Output:", content);

  const parts = content.split(',').map(p => p.trim());

  if (parts.length < 3) {
    console.error("❌ Bad Groq Output: ", content);
    return [content, "-", "-"];
  }

  return parts.slice(0, 3);
}

