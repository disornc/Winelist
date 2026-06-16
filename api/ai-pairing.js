module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { query, wines } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key" });

  const wineList = wines.map((w, i) =>
    `[${w.idx}] ${w.producer} — ${w.name} (${w.type}, ${w.region}) ฿${w.price} | Grapes: ${w.grapes || '-'} | ${(w.vinification || '').slice(0, 120)}`
  ).join('\n');

  const prompt = `You are a sommelier at a natural wine bar. Recommend wines from the list below based on the customer's request.

Customer said: "${query}"

Wine list:
${wineList}

Reply with a JSON array only, no other text. Format:
[{"idx": <number>, "reason": "<1 sentence in simple English explaining why this wine fits — no wine jargon, just vibe and feeling>"}]

Recommend 3-5 wines, best match first. Reply with JSON only.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data });
    const text = data.content[0].text.trim();
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0];
    const recommendations = JSON.parse(jsonStr);
    res.status(200).json({ recommendations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
