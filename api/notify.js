module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { wineName, producer, isSoldOut } = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const content = isSoldOut
    ? `🔴 **Sold Out**\n${producer} — ${wineName}`
    : `✅ **Available Again**\n${producer} — ${wineName}`;

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    res.status(200).json({ ok: true, status: r.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
