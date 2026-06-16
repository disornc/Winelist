module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { wineName, producer, isSoldOut } = req.body;
  const token  = process.env.LINE_TOKEN;
  const userId = process.env.LINE_USER_ID;

  const text = isSoldOut
    ? `🔴 Sold Out\n${producer} — ${wineName}`
    : `✅ Available Again\n${producer} — ${wineName}`;

  try {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text }]
      })
    });
    const data = await r.json();
    res.status(200).json({ ok: true, line: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
