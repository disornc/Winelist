const wines = require('../wines-list.json');

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const dbBase = "https://winelist-6bea7-default-rtdb.firebaseio.com";

  try {
    const [soldOutRes, stockRes, snapRes] = await Promise.all([
      fetch(`${dbBase}/soldOut.json`),
      fetch(`${dbBase}/wineStock.json`),
      fetch(`${dbBase}/reportSnapshot.json`)
    ]);
    const soldOutData = await soldOutRes.json();
    const stockData   = (await stockRes.json()) || {};
    const snapshot    = await snapRes.json(); // { stockKey: quantity } from the previous report

    const soldOutKeys = new Set(soldOutData ? Object.values(soldOutData) : []);

    const typeLabel = {
      red: "🍷 Red", white: "🥂 White",
      orange: "🍊 Skin-Contact", petnat: "🫧 Pet-Nat", local: "🇹🇭 Local"
    };

    const now = new Date().toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok", dateStyle: "full"
    });

    const lines = [`🍇 **Grapey Daily Report — ${now}**`, ``];
    const stockEntries = Object.entries(stockData);

    // Current quantities become the baseline for tomorrow's report
    const newSnapshot = {};
    stockEntries.forEach(([key, d]) => { newSnapshot[key] = d.quantity ?? 0; });

    if (!snapshot) {
      lines.push(`📝 เริ่มบันทึกยอดขายรายวันแล้ว — report พรุ่งนี้จะแสดงไวน์ที่ขายในแต่ละวัน`);
    } else {
      const grouped = {};
      let totalSold = 0;
      let wineCount = 0;

      stockEntries.forEach(([key, data]) => {
        const qty  = data.quantity ?? 0;
        const prev = snapshot[key];
        if (prev === undefined) return;      // wine added today — no baseline yet
        const sold = prev - qty;
        if (sold <= 0) return;                // nothing sold (or restocked)

        totalSold += sold;
        wineCount++;
        const label = typeLabel[data.type] || "🍾 Other";
        const wk = `${data.producer}|${data.name}`;
        const isOut = qty === 0 || soldOutKeys.has(wk);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(
          `• ${data.producer} — ${data.name} × **${sold}**` + (isOut ? ` 🔴 **หมดแล้ว**` : ``)
        );
      });

      if (wineCount === 0) {
        lines.push(`วันนี้ยังไม่มีไวน์ขาย`);
      } else {
        lines.push(`🛒 **ขายวันนี้**`);
        for (const [type, list] of Object.entries(grouped)) {
          lines.push(`**${type}**`);
          list.forEach(l => lines.push(l));
        }
        lines.push('');
        lines.push(`📊 **สรุป:** ขายไป **${totalSold} btl** จาก ${wineCount} ไวน์`);
      }
    }

    const message = lines.join('\n');

    // Save today's quantities for tomorrow's comparison
    let snapshotError = null;
    if (stockEntries.length > 0) {
      try {
        const sr = await fetch(`${dbBase}/reportSnapshot.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSnapshot)
        });
        if (!sr.ok) snapshotError = `Firebase ${sr.status}`;
      } catch (se) {
        snapshotError = se.message;
      }
    }

    // ── Send to Discord (split if > 2000 chars) ─────────────────────────────
    let discordError = null;
    let discordStatus = null;

    if (!webhookUrl) {
      discordError = "DISCORD_WEBHOOK_URL not set";
    } else {
      try {
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
          if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
        }
      } catch (de) {
        discordError = de.message;
      }
    }

    res.status(200).json({
      ok: true,
      discord: discordError ? `FAILED — ${discordError}` : `OK (${discordStatus})`,
      snapshot: snapshotError ? `FAILED — ${snapshotError}` : "saved",
      message
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
