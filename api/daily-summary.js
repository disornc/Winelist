const wines = require('../wines-list.json');

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const dbBase = "https://winelist-6bea7-default-rtdb.firebaseio.com";

  try {
    // Fetch sold-out keys and stock data in parallel
    const [soldOutRes, stockRes] = await Promise.all([
      fetch(`${dbBase}/soldOut.json`),
      fetch(`${dbBase}/wineStock.json`)
    ]);
    const soldOutData = await soldOutRes.json();
    const stockData   = (await stockRes.json()) || {};

    const soldOutKeys = soldOutData ? Object.values(soldOutData) : [];

    // Build wine lookup map
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
      const inStock = {};
      const lowStock = {};
      const outStock = [];

      stockEntries.forEach(([key, data]) => {
        const qty = data.quantity ?? 0;
        const label = typeLabel[data.type] || "🍾 Other";
        if (qty === 0) {
          outStock.push(`• ${data.producer} — ${data.name}`);
        } else {
          const target = qty <= 1 ? lowStock : inStock;
          if (!target[label]) target[label] = [];
          target[label].push(`• ${data.producer} — ${data.name} **(${qty} btl)**`);
        }
      });

      if (Object.keys(inStock).length > 0) {
        lines.push(`✅ **Wine in Stock**`);
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

      const totalBottles = stockEntries.reduce((s, [, d]) => s + (d.quantity ?? 0), 0);
      lines.push(`📊 **Summary:** ${stockEntries.length} wines tracked · ${totalBottles} bottles remaining`);

    } else if (soldOutKeys.length > 0) {
      // Fallback if no stock data set yet
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
    } else {
      lines.push(`✅ ไม่มีไวน์ Sold Out — ครบทุกขวด 🍷`);
    }

    const message = lines.join('\n');

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message })
      });
    }

    res.status(200).json({ ok: true, message });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
