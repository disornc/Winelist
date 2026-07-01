const wines = require('../wines-list.json');

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const dbBase = "https://winelist-6bea7-default-rtdb.firebaseio.com";

  try {
    const [soldOutRes, stockRes] = await Promise.all([
      fetch(`${dbBase}/soldOut.json`),
      fetch(`${dbBase}/wineStock.json`)
    ]);
    const soldOutData = await soldOutRes.json();
    const stockData   = (await stockRes.json()) || {};

    const soldOutKeys = soldOutData ? Object.values(soldOutData) : [];

    const wineMap = {};
    wines.forEach(w => { wineMap[`${w.producer}|${w.name}`] = w; });

    const typeLabel = {
      red: "🍷 Red", white: "🥂 White",
      orange: "🍊 Skin-Contact", petnat: "🫧 Pet-Nat", local: "🇹🇭 Local"
    };

    const now = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok", dateStyle: "full"
    });

    const lines = [`🍇 **Grapey Daily Report — ${now}**`, ``];

    const stockEntries = Object.entries(stockData);

    if (stockEntries.length > 0) {
      const inStock  = {};
      const lowStock = {};
      const outStock = [];
      let totalBottles = 0;
      let totalSold    = 0;

      stockEntries.forEach(([key, data]) => {
        const qty     = data.quantity ?? 0;
        const initial = data.initialStock ?? qty;
        const sold    = initial - qty;
        totalBottles += qty;
        totalSold    += sold;
        const label   = typeLabel[data.type] || "🍾 Other";
        const soldStr = sold > 0 ? ` *(ขายไป ${sold})*` : "";

        if (qty === 0) {
          outStock.push(`• ${data.producer} — ${data.name}${soldStr}`);
        } else if (qty <= 1) {
          if (!lowStock[label]) lowStock[label] = [];
          lowStock[label].push(`• ${data.producer} — ${data.name} — **เหลือ ${qty} btl**${soldStr}`);
        } else {
          if (!inStock[label]) inStock[label] = [];
          inStock[label].push(`• ${data.producer} — ${data.name} — เหลือ ${qty} btl${soldStr}`);
        }
      });

      if (Object.keys(inStock).length > 0) {
        lines.push(`✅ **In Stock**`);
        for (const [type, list] of Object.entries(inStock)) {
          lines.push(`**${type}**`);
          list.forEach(l => lines.push(l));
        }
        lines.push('');
      }
      if (Object.keys(lowStock).length > 0) {
        lines.push(`⚠️ **Low Stock (1 btl)**`);
        for (const [type, list] of Object.entries(lowStock)) {
          lines.push(`**${type}**`);
          list.forEach(l => lines.push(l));
        }
        lines.push('');
      }
      if (outStock.length > 0) {
        lines.push(`🔴 **Out of Stock (${outStock.length})**`);
        outStock.forEach(l => lines.push(l));
        lines.push('');
      }

      const totalBottlesInit = stockEntries.reduce((s, [, d]) => s + (d.initialStock ?? d.quantity ?? 0), 0);
      lines.push(`📊 **สรุป:** ขายไปทั้งหมด **${totalSold} btl** · เหลือ **${totalBottles} btl** จาก ${stockEntries.length} ไวน์`);

    } else if (soldOutKeys.length > 0) {
      const grouped = {};
      soldOutKeys.forEach(key => {
        const w = wineMap[key];
        if (!w) return;
        const type = typeLabel[w.type] || "🍾 Other";
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(`• ${w.producer} — ${w.name}`);
      });
      lines.push(`🔴 **Sold Out (${soldOutKeys.length})**`);
      for (const [type, list] of Object.entries(grouped)) {
        lines.push(`**${type}**`);
        list.forEach(l => lines.push(l));
      }
      lines.push('');
      lines.push(`_ยังไม่ได้ตั้ง stock — เข้า admin mode แล้วใส่จำนวนขวดแต่ละไวน์เพื่อดู report เต็ม_`);
    } else {
      lines.push(`✅ ไม่มีไวน์ Sold Out — ครบทุกขวด 🍷`);
    }

    const message = lines.join('\n');

    // ── Send to Discord (split if > 2000 chars) ─────────────────────────────
    let discordError = null;
    let discordStatus = null;

    if (!webhookUrl) {
      discordError = "DISCORD_WEBHOOK_URL not set";
    } else {
      try {
        // Split message into ≤2000-char chunks at newline boundaries
        const chunks = [];
        let chunk = "";
        for (const line of message.split("\n")) {
          const add = (chunk ? "\n" : "") + line;
          if (chunk.length + add.length > 1900) {
            chunks.push(chunk);
            chunk = line;
          } else {
            chunk += add;
          }
        }
        if (chunk) chunks.push(chunk);

        for (const c of chunks) {
          const dr = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: c })
          });
          discordStatus = dr.status;
          if (!dr.ok) {
            const txt = await dr.text();
            discordError = `Discord ${dr.status}: ${txt}`;
            break;
          }
          // small delay between messages
          if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
        }
      } catch (de) {
        discordError = de.message;
      }
    }

    res.status(200).json({
      ok: true,
      discord: discordError ? `FAILED — ${discordError}` : `OK (${discordStatus})`,
      message
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
