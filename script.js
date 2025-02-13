document.addEventListener("DOMContentLoaded", function () {
    console.log("✅ JavaScript berhasil dimuat!");

    const sendBtn = document.getElementById("send-btn");
    const resetBtn = document.getElementById("reset-btn");
    const modelSelect = document.getElementById("model-select");
    const questionInput = document.getElementById("question-input");
    const responseContainer = document.getElementById("response-text");
    const timerContainer = document.getElementById("response-timer");
    const historyTable = document.getElementById("history-table").getElementsByTagName('tbody')[0];

    if (!sendBtn || !resetBtn || !modelSelect || !questionInput || !responseContainer || !timerContainer || !historyTable) {
        console.error("❌ ERROR: Elemen HTML tidak ditemukan! Periksa ID elemen di HTML.");
        return;
    }

    // Muat data history dari localStorage (jika ada)
    let historyData = JSON.parse(localStorage.getItem("historyData")) || [];
    historyData.forEach(entry => {
        let newRow = historyTable.insertRow();
        newRow.innerHTML = `
            <td>${entry.question}</td>
            <td>${entry.response}</td>
            <td>${entry.elapsedTime}</td>
            <td>${entry.currentTime}</td>
            <td>${entry.model}</td>
        `;
    });

    sendBtn.addEventListener("click", async function () {
        console.log("✅ Tombol 'Kirim' ditekan!");

        const model = modelSelect.value;
        const question = questionInput.value.trim();

        if (!question) {
            responseContainer.innerHTML = "⚠️ Silakan tulis pertanyaan terlebih dahulu!";
            return;
        }

        responseContainer.innerHTML = "⏳ AI sedang berpikir...";
        timerContainer.innerHTML = "";

        let startTime = Date.now();

        try {
            let response = await fetchResponseFromAI(model, question);
            let endTime = Date.now();
            let elapsedTimeMs = endTime - startTime;
            let elapsedTime = formatElapsedTime(elapsedTimeMs);
            let currentTime = new Date().toLocaleTimeString();

            timerContainer.innerHTML = `<p style="color: gray; font-size: 12px;">⏱️ Waktu respons: ${elapsedTime}</p>`;
            responseContainer.innerHTML = response;

            // Buat objek entry baru
            let newEntry = {
                question,
                response,
                elapsedTime,
                currentTime,
                model
            };

            // Tambahkan entry ke array historyData dan simpan ke localStorage
            historyData.push(newEntry);
            localStorage.setItem("historyData", JSON.stringify(historyData));

            // Tambahkan baris baru ke tabel
            let newRow = historyTable.insertRow();
            newRow.innerHTML = `
                <td>${question}</td>
                <td>${response}</td>
                <td>${elapsedTime}</td>
                <td>${currentTime}</td>
                <td>${model}</td>
            `;

            questionInput.value = "";
        } catch (error) {
            responseContainer.innerHTML = "❌ Terjadi kesalahan, coba lagi nanti!";
            console.error("❌ ERROR fetching AI response:", error);
        }
    });

    resetBtn.addEventListener("click", function () {
        console.log("🗑️ Tombol 'Reset Riwayat' ditekan!");
        // Bersihkan localStorage dan tabel
        localStorage.removeItem("historyData");
        historyData = [];
        historyTable.innerHTML = "";
        console.log("✅ Riwayat telah direset!");
    });
});

async function fetchResponseFromAI(model, question) {
    const modelMap = {
        "deepseek": "deepseek-coder:latest",
        "qwen": "qwen:7b",
        "llama": "llama2:latest",
        "gemini": "gemini-1.5-flash",
        "openai-gpt": "gpt-4"
    };

    if (!(model in modelMap)) {
        return "❌ Model AI tidak ditemukan.";
    }

    let apiUrl = "";
    let requestBody = {};
    let headers = { "Content-Type": "application/json" };

    if (["deepseek", "qwen", "llama"].includes(model)) {
        apiUrl = "http://localhost:11434/api/generate";
        requestBody = { model: modelMap[model], prompt: question, stream: false };
    } else if (model === "gemini") {
        const GEMINI_API_KEY = "AIzaSyDSGUE71uCL2FrSBQDZDWKnh49HF3rSr_8"; // Jangan hardcode API key
        if (!GEMINI_API_KEY) {
            return "⚠️ API Key untuk Gemini tidak ditemukan.";
        }
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        requestBody = { contents: [{ parts: [{ text: question }] }], generationConfig: { temperature: 0.7 } };
    } else if (model === "openai-gpt") {
        const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"; // Jangan hardcode API key
        if (!OPENAI_API_KEY) {
            return "⚠️ API Key untuk OpenAI tidak ditemukan.";
        }
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers["Authorization"] = `Bearer ${OPENAI_API_KEY}`;
        requestBody = { model: modelMap[model], messages: [{ role: "user", content: question }], temperature: 0.7 };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout 15 detik

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId); // Hentikan timeout jika request berhasil

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ API Error:", errorText);
            return `⚠️ Gagal mengambil data dari AI: ${errorText}`;
        }

        const data = await response.json();

        if (model === "gemini") {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "❌ Jawaban kosong dari Gemini.";
        } else if (model === "openai-gpt") {
            return data.choices?.[0]?.message?.content || "❌ Jawaban kosong dari OpenAI.";
        } else {
            return data.response || "❌ Jawaban kosong dari Ollama.";
        }
    } catch (error) {
        if (error.name === "AbortError") {
            return "❌ Permintaan timeout, coba lagi nanti.";
        }
        console.error("❌ ERROR fetching AI response:", error);
        return `⚠️ Error: ${error.message}`;
    }
}

function formatElapsedTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    seconds %= 60;
    minutes %= 60;
    return `${hours} jam, ${minutes} menit, ${seconds} detik`;
}
