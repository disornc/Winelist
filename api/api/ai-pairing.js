export default async function handler(req, res) {
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

  const prompt = `คุณเป็น sommelier ของร้านไวน์ natural wine ช่วยแนะนำไวน์จากรายการด้านล่างให้ลูกค้า

ลูกค้าบอกว่า: "${query}"

รายการไวน์:
${wineList}

ตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น รูปแบบ:
[{"idx": <number>, "reason": "<อธิบาย 1 ประโยคภาษาไทยว่าทำไมเหมาะ ใช้ภาษาง่ายๆ ไม่ต้องใช้ศัพท์ wine>"}]

แนะนำ 3-5 ขวด เรียงจากเหมาะที่สุด ตอบแค่ JSON เท่านั้น`;

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
