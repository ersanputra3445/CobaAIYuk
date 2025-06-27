const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname)));

app.post('/proxy-ollama', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
  console.log('✅ Server jalan di http://localhost:5000');
});
