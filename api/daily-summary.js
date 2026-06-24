const wines = require('../wines-list.json');

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const dbUrl = "https://winelist-6bea7-default-rtdb.firebaseio.com/soldOut.json";

  try {
    // Fetch sold out indices from Firebase
    const fbRes = await fetch(dbUrl);
    const data = await fbRes.json();
    const soldOutIndices = data ? Object.values(data) : [];

    const now = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "full"
    });

    let message;

    if (soldOutIndices.length === 0) {
      message = `✅ **Daily Summary — ${now}**\n\nไวน์ครบทุกขวด ไม่มีตัวไหน Sold Out 🍷`;
    } else {
      const typeLabel = { red: "🍷 Red", white: "🥂 White", orange: "🍊 Skin-Contact", petnat: "🫧 Pet-Nat", local: "🇹🇭 Local" };
      const grouped = {};

      soldOutIndices.forEach(idx => {
        const w = wines[idx];
        if (!w) return;
        const type = typeLabel[w.type] || "🍾 Other";
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(`${w.producer} — ${w.name} (฿${w.price.toLocaleString()})`);
      });

      const lines = [`🔴 **Daily Summary — ${now}**`, ``, `**Sold Out วันนี้ ${soldOutIndices.length} ขวด:**`, ``];
      for (const [type, list] of Object.entries(grouped)) {
        lines.push(`**${type}**`);
        list.forEach(w => lines.push(`• ${w}`));
        lines.push('');
      }

      message = lines.join('\n');
    }

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message })
      });
    }

    res.status(200).json({ ok: true, soldOut: soldOutIndices.length, message });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
