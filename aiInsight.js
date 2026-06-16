// aiInsight.js
// Modul untuk komunikasi dengan LLM (Ollama atau Groq)
// Pastikan config.js sudah di-load sebelum file ini

// ── Build prompt dari ringkasan data ─────────────────────────
// Fungsi ini mengubah objek summaryStats menjadi teks yang
// bisa dipahami LLM sebagai konteks bisnis
function buildPrompt(stats, focusQuestion = '') {
  const catLines = stats.categories
    .map(c => `  - ${c.category}: Sales $${(c.sales/1000).toFixed(1)}K, Profit $${(c.profit/1000).toFixed(1)}K, Margin ${c.margin}%`)
    .join('\n');

  const regionLines = stats.regions
    .map(r => `  - ${r.region}: Sales $${(r.sales/1000).toFixed(1)}K`)
    .join('\n');

  const context = `
Berikut adalah ringkasan data penjualan SAGE:

KESELURUHAN:
  - Total Sales  : $${(stats.totalSales/1)}
  - Total Profit : $${(stats.totalProfit/1)}
  - Profit Margin: ${stats.overallMargin}%
  - Total Orders : ${stats.totalOrders}

PERFORMA PER KATEGORI (diurutkan dari margin tertinggi):
${catLines}

REVENUE PER REGION (diurutkan dari tertinggi):
${regionLines}

Kategori terbaik (margin): ${stats.bestCategory.category} (${stats.bestCategory.margin}%)
Kategori terburuk (margin): ${stats.worstCategory.category} (${stats.worstCategory.margin}%)
`;

  const question = focusQuestion ||
    'Berikan insight bisnis yang paling penting dari data ini dalam 3 poin singkat. ' +
    'Sertakan rekomendasi konkret untuk tiap poin. Gunakan Bahasa Indonesia.';

  return context + '\n---\nPertanyaan: ' + question;
}

// ── Panggil LLM dan dapatkan insight ─────────────────────────
async function getInsight(stats, focusQuestion = '') {
  const prompt = buildPrompt(stats, focusQuestion);

  if (CONFIG.AI_PROVIDER === 'ollama') {
    return await callOllama(prompt);
  } else {
    return await callGroq(prompt);
  }
}

// ── Implementasi Groq ─────────────────────────────────────────
async function callGroq(prompt) {
  const res = await fetch(CONFIG.GROQ_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: CONFIG.GROQ_MODEL,
      messages: [
        {
          role:    'system',
          content: 'Kamu adalah analis bisnis yang memberi insight singkat, ' +
                   'praktis, dan langsung ke poin. Gunakan Bahasa Indonesia.'
        },
        {
          role:    'user',
          content: prompt
        }
      ],
      max_tokens:  500,
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq error: ${err.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
  // Groq (OpenAI-compatible) mengembalikan di choices[0].message.content
}

// ── Fungsi baru: narrateAlert() ───────────────────────────────
// Berbeda dari getInsight() yang umum, narrateAlert() fokus
// pada satu anomali spesifik dan menghasilkan alert singkat
async function narrateAlert(anomaly) {
  const prompt = buildAlertPrompt(anomaly);
  if (CONFIG.AI_PROVIDER === 'ollama') {
    return await callOllama(prompt);
  }
  return await callGroq(prompt);
}

// ── Build prompt untuk satu anomali ──────────────────────────
function buildAlertPrompt(anomaly) {
  let context = '';

  if (anomaly.type === 'profit_outlier') {
    context = `
Sub-kategori produk "${anomaly.name}" memiliki profit margin ${anomaly.margin}%
yang sangat ${anomaly.direction === 'low' ? 'rendah' : 'tinggi'} dibanding rata-rata
(Z-score: ${anomaly.zScore}, severity: ${anomaly.severity}).
Total profit untuk sub-kategori ini: $${anomaly.profit}.`;
  }

  else if (anomaly.type === 'mom_spike') {
    context = `
Revenue bulan ${anomaly.month} mengalami ${anomaly.direction === 'drop' ? 'penurunan' : 'kenaikan'}
sebesar ${Math.abs(anomaly.changePct)}% dibanding bulan sebelumnya (${anomaly.prevMonth}).
Revenue bulan ini: $${Number(anomaly.current).toLocaleString()},
bulan lalu: $${Number(anomaly.previous).toLocaleString()}.
Severity: ${anomaly.severity}.`;
  }

  else if (anomaly.type === 'iqr_outlier') {
    context = `
Sub-kategori "${anomaly.subcat}" memiliki ${anomaly.count} transaksi yang bernilai
sangat ${anomaly.direction === 'high' ? 'tinggi' : 'rendah'} secara statistik (outlier IQR).
Rata-rata nilai transaksi outlier: $${anomaly.avgSales.toLocaleString()}.`;
  }

  return `Kamu adalah analis data bisnis. Berikan ALERT singkat (maksimal 2 kalimat) 
dalam Bahasa Indonesia tentang anomali berikut di data penjualan SAGE:
${context}

Format alert: mulai dengan angka kunci yang mengejutkan, jelaskan implikasinya,
dan sertakan satu rekomendasi tindakan konkret.
Jangan gunakan kata "Alert:" di awal. Langsung ke poin.`;
}

// ── Narasi batch: generate alert untuk semua anomali sekaligus ─
// Lebih efisien: satu panggilan LLM untuk semua anomali,
// bukan satu panggilan per anomali
async function narrateAllAlerts(anomalies) {
  // Kumpulkan semua anomali jadi satu konteks
  const allItems = [
    ...anomalies.profitOutliers,
    ...anomalies.momSpikes.slice(0, 3)
  ];

  if (allItems.length === 0) return 'Tidak ada anomali signifikan terdeteksi.';

  const itemLines = allItems.map((a, i) => {
    if (a.type === 'profit_outlier')
      return `${i+1}. [${a.severity.toUpperCase()}] Sub-kategori ${a.name}: margin ${a.margin}% (Z=${a.zScore})`;
    if (a.type === 'mom_spike')
      return `${i+1}. [${a.severity.toUpperCase()}] Revenue ${a.month}: ${a.changePct}% MoM`;
    return `${i+1}. [INFO] IQR outlier di ${a.subcat} (${a.count} transaksi)`;
  }).join('\n');

  const prompt = `Kamu adalah analis data bisnis yang memberi alert singkat dan actionable.
Berikut adalah daftar anomali yang terdeteksi di data penjualan SAGE:

${itemLines}

Untuk setiap anomali, tulis satu kalimat alert dalam Bahasa Indonesia.
Format untuk setiap baris: "• [nama/bulan]: [fakta mengejutkan] — [rekomendasi 1 kata kerja]"
Urutkan dari yang paling kritis. Jangan preamble, langsung list.`;

  if (CONFIG.AI_PROVIDER === 'ollama') return await callOllama(prompt);
  return await callGroq(prompt);
}