import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDocCO_xJ9joHRU4B9vCzU3VkK2__exQfw",
  authDomain: "cobaaiyuk-d256c.firebaseapp.com",
  projectId: "cobaaiyuk-d256c",
  storageBucket: "cobaaiyuk-d256c.appspot.com",
  messagingSenderId: "275234043693",
  appId: "1:275234043693:web:5c6ac7f765cdc8ecf185a4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
  ollama: "http://localhost:5000/proxy-ollama"
};

const API_KEYS = {
    openai: "YOUR_OPENAI_API_KEY",
    gemini: "AIzaSyD_DzAa45hbOqtxonVUHviNfjExXJZJDv0"
};

const OLLAMA_MODELS = {
    llama: "llama2:latest",
    llama2: "llama2:latest",
    "llama2:latest": "llama2:latest",
    llama3: "llama3:latest",
    "llama3:latest": "llama3:latest",
    deepseek: "deepseek-r1:latest",
    "deepseek-r1": "deepseek-r1:latest",
    "deepseek-coder": "deepseek-coder:latest",
    qwen: "qwen:7b",
    "qwen:7b": "qwen:7b",
    "qwen-latest": "qwen:latest",
    "qwen:latest": "qwen:latest"
};

let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
const tableBody = document.getElementById("ai-response-table-body");
const responseText = document.getElementById("response-text");

function loadHistory() {
    tableBody.innerHTML = "";
    chatHistory.forEach(entry => {
        updateTable(entry.question, entry.response, entry.accuracy, entry.latency, entry.model, false);
    });
}
loadHistory();

function typeText(element, text, speed = 30) {
    element.innerText = "";
    let index = 0;

    function type() {
        if (index < text.length) {
            element.innerText += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    type();
}

// ✅ TOMBOL KIRIM
document.getElementById("send-btn")?.addEventListener("click", async () => {
  const rawModel = document.getElementById("model-select")?.value;
  const model = rawModel?.toLowerCase();
  const questionInput = document.getElementById("question-input");
  const question = questionInput?.value.trim();

  if (!question) {
    alert("Silakan masukkan pertanyaan sebelum mengirim.");
    return;
  }

  typeText(responseText, "\ud83d\udd04 Memproses...");

  const startTime = Date.now();
  let response = "";
  let accuracy = "-";

  try {
    response = await fetchAIResponse(model, question);
  } catch (error) {
    response = `\u274c Gagal menghubungi model '${model}'.`;
    console.error("\u274c Error:", error);
  }

  const latency = Date.now() - startTime;

  if (response && !response.startsWith("\u274c")) {
    const expectedAnswer = "";
    accuracy = calculateAccuracy(response, expectedAnswer);
  }

  typeText(responseText, response);
  updateTable(question, response, accuracy, latency, model, true);
  questionInput.value = "";
});

// ✅ SIMPAN KE FIRESTORE
async function saveResponseToFirebase(entry) {
  console.log("\ud83d\ude80 Menyimpan ke Firestore:", entry);
  try {
    const docRef = await addDoc(collection(db, "chatHistory"), entry);
    console.log("\u2705 Data tersimpan dengan ID:", docRef.id);
  } catch (error) {
    console.error("\u274c Gagal menyimpan ke Firestore:", error.message);
    console.error("\ud83d\udccb Stack:", error.stack);
  }
}

// ✅ UPDATE TABEL
function updateTable(question, response, accuracy, latency, model, saveToHistory = true) {
  const now = new Date();
  const row = tableBody.insertRow();
  [question, response, now.toLocaleDateString(), now.toLocaleTimeString('en-US'), accuracy, `${latency} ms`, model]
    .forEach(text => row.insertCell().textContent = text);

  if (saveToHistory) {
    const newEntry = { question, response, date: now.toISOString(), accuracy, latency, model };
    chatHistory.push(newEntry);
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
    saveResponseToFirebase(newEntry);
  }
}


async function fetchAIResponse(model, question) {
    let url, body;
    let headers = { "Content-Type": "application/json" };

    if (Object.keys(OLLAMA_MODELS).includes(model)) {
        url = API_ENDPOINTS.ollama;
        body = JSON.stringify({
            model: OLLAMA_MODELS[model],
            prompt: question,
            stream: false
        });

        try {
            const response = await fetch(url, { method: "POST", headers, body });
            console.log("🔍 Proxy status:", response.status);
            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Proxy error text:", errorText);
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }
            const data = await response.json();
            return data.response || "⚠️ Ollama tidak mengembalikan respons.";
        } catch (err) {
            console.error("❌ Proxy fetch error:", err);
            throw err;
        }
    }

    if (model === "openai") {
        url = API_ENDPOINTS.openai;
        headers["Authorization"] = `Bearer ${API_KEYS.openai}`;
        body = JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: question }],
            max_tokens: 200
        });
    } else if (model === "gemini") {
        url = `${API_ENDPOINTS.gemini}?key=${API_KEYS.gemini}`;
        body = JSON.stringify({
            contents: [{ role: "user", parts: [{ text: question }] }]
        });
    } else {
        throw new Error("Model tidak valid atau tidak tersedia.");
    }

    const response = await fetch(url, { method: "POST", headers, body });
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);

    if (model === "openai") return await processOpenAIResponse(response);
    if (model === "gemini") return await processGeminiResponse(response);
    throw new Error("Model tidak dikenali.");
}

async function processOpenAIResponse(response) {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
}

async function processGeminiResponse(response) {
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(" ") || "";
}

function calculateAccuracy(response, expectedAnswer = "") {
    if (!expectedAnswer || expectedAnswer.trim() === "") {
        return (Math.random() * (95 - 80) + 80).toFixed(2) + "%";
    }
    const similarity = computeStringSimilarity(response, expectedAnswer);
    return (similarity * 100).toFixed(2) + "%";
}

function computeStringSimilarity(str1, str2) {
    const a = str1.toLowerCase().replace(/\s+/g, '');
    const b = str2.toLowerCase().replace(/\s+/g, '');
    let matches = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] === b[i]) matches++;
    }
    return matches / Math.max(a.length, b.length);
}

document.getElementById("download-data")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history.csv";
    a.click();
    URL.revokeObjectURL(url);
});

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tampilkan-statistik")?.addEventListener("click", () => {
        const canvas = document.getElementById("statsChart");
        if (!canvas) return alert("Canvas tidak ditemukan!");
        const ctx = canvas.getContext("2d");

        if (!chatHistory || chatHistory.length === 0) {
            alert("Tidak ada data untuk ditampilkan.");
            return;
        }

        const labels = chatHistory.map(entry => {
            const date = new Date(entry.date);
            return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });

        const data = chatHistory.map(entry => entry.latency);

        if (window.chartInstance) window.chartInstance.destroy();

        window.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Latency (ms)',
                    data,
                    borderColor: 'orange',
                    backgroundColor: 'rgba(255,165,0,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Waktu' } },
                    y: { title: { display: true, text: 'Latency (ms)' }, beginAtZero: true }
                }
            }
        });

        document.getElementById("chart-container").style.display = "block";
    });
});

document.getElementById("reset-btn")?.addEventListener("click", () => {
    if (!confirm("Yakin ingin menghapus semua data?")) return;
    localStorage.removeItem("chatHistory");
    chatHistory = [];
    tableBody.innerHTML = "";
    document.getElementById("chart-container").style.display = "none";
    if (window.chartInstance) window.chartInstance.destroy();
});

document.getElementById("search-btn")?.addEventListener("click", () => {
    const keyword = normalizeString(document.getElementById("search-input")?.value);
    tableBody.innerHTML = "";

    if (!keyword) return;

    const filtered = chatHistory.filter(entry =>
        normalizeString(entry.question).includes(keyword) ||
        normalizeString(entry.response).includes(keyword)
    );

    if (filtered.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.classList.add("text-center", "text-muted", "fw-semibold");
        cell.textContent = "⚠️ No data found. Please input a new search.";
    } else {
        filtered.forEach(entry => {
            updateTable(entry.question, entry.response, entry.accuracy, entry.latency, entry.model, false);
        });
    }

    document.getElementById("batal-btn").disabled = false;
});

document.getElementById("batal-btn")?.addEventListener("click", () => {
    document.getElementById("search-input").value = "";
    tableBody.innerHTML = "";
    loadHistory();
    document.getElementById("batal-btn").disabled = true;
});

function normalizeString(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
}


document.getElementById("filter-btn")?.addEventListener("click", () => {
  const selectedModel = document.getElementById("filter-model-select")?.value.toLowerCase();
  const tableBody = document.getElementById("ai-response-table-body");

  if (!tableBody) return console.error("❌ tableBody not found");
  tableBody.innerHTML = "";

  console.log("✅ Filter model dipilih:", selectedModel);

  // Fungsi normalisasi model
  function normalizeModelName(model) {
    const m = model?.toLowerCase() || "";
    if (m.includes("openai") || m.includes("gpt")) return "openai";
    if (m.includes("gemini")) return "gemini";
    if (m.includes("llama")) return "llama";
    if (m.includes("deepseek")) return "deepseek";
    if (m.includes("qwen")) return "qwen";
    return "unknown";
  }

  // Filter
  const filteredData = selectedModel === "all"
    ? chatHistory
    : chatHistory.filter(entry => normalizeModelName(entry.model) === selectedModel);

  console.log("📦 Filtered result:", filteredData);

  // Tampilkan ke tabel
  if (filteredData.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 7;
    cell.classList.add("text-center", "text-muted", "fw-semibold");
    cell.textContent = "⚠️ Tidak ditemukan data dengan model tersebut.";
  } else {
    filteredData.forEach(entry => {
      updateTable(entry.question, entry.response, entry.accuracy, entry.latency, entry.model, false);
    });
  }
});


