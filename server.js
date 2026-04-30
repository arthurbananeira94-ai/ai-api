const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json({ limit: "10kb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 🧠 Rate limit simples (por IP)
const rateLimit = {};
const LIMIT = 10; // 10 requests
const WINDOW = 60 * 1000; // 1 minuto

function isRateLimited(ip) {
  const now = Date.now();

  if (!rateLimit[ip]) {
    rateLimit[ip] = [];
  }

  rateLimit[ip] = rateLimit[ip].filter(t => now - t < WINDOW);

  if (rateLimit[ip].length >= LIMIT) {
    return true;
  }

  rateLimit[ip].push(now);
  return false;
}

// 🔒 Sanitizar input
function sanitize(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[<>]/g, "").slice(0, 500);
}

// 🚀 Endpoint IA
app.post("/ai", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // 🚫 rate limit
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Muitas requisições" });
    }

    // 🧠 validação
    let userMessage = sanitize(req.body.message);

    if (!userMessage || userMessage.length < 2) {
      return res.status(400).json({ error: "Mensagem inválida" });
    }

    // 🔥 request Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: userMessage }]
            }
          ]
        }),
        timeout: 10000
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: "Erro na API externa" });
    }

    const data = await response.json();

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sem resposta";

    // 🧼 limpeza da resposta
    reply = reply.slice(0, 1000);

    res.json({ reply });

  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// 🔒 Rota de health check
app.get("/", (req, res) => {
  res.send("API online 🔥");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
