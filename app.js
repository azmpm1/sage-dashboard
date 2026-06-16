// ── Hitung ringkasan statistik ────────────────────────────────
function computeSummary(data) {
  const totalSales  = d3.sum(data, d => d.sales);
  const totalProfit = d3.sum(data, d => d.profit);
  const margin      = (totalProfit / totalSales * 100).toFixed(1);
  const totalOrders = data.length;
  const totalQuantity = d3.sum(data, d => d.quantity);

  // Revenue per kategori
  const byCategory = d3.rollup(
    data,
    v => ({
      sales:  d3.sum(v, d => d.sales),
      profit: d3.sum(v, d => d.profit)
    }),
    d => d.category
  );

  // Temukan kategori terbaik dan terburuk berdasarkan profit margin
  const catArray = [...byCategory.entries()].map(([cat, v]) => ({
    category: cat,
    sales:    v.sales,
    profit:   v.profit,
    margin:   (v.profit / v.sales * 100).toFixed(1)
  }));
  catArray.sort((a, b) => b.margin - a.margin);

  // Revenue per region
  const byRegion = d3.rollup(
    data,
    v => d3.sum(v, d => d.sales),
    d => d.region
  );
  const regionArray = [...byRegion.entries()]
    .map(([r, s]) => ({ region: r, sales: s }))
    .sort((a, b) => b.sales - a.sales);

  return {
    totalSales:    totalSales.toFixed(2),
    totalProfit:   totalProfit.toFixed(2),
    totalQuantity: totalQuantity,
    overallMargin: margin,
    totalOrders:   totalOrders,
    categories:    catArray,      // diurutkan margin tertinggi ke terendah
    regions:       regionArray,   // diurutkan revenue tertinggi ke terendah
    bestCategory:  catArray[0],
    worstCategory: catArray[catArray.length - 1]
  };
}

function renderTrendChart(data) {

  d3.select('#chart-trend').selectAll('*').remove();

  const margin = { top: 20, right: 20, bottom: 40, left: 80 };
  const w = 400 + margin.left + margin.right;
  const h = 240 + margin.top + margin.bottom;

  // Group per bulan
  const monthlySales = d3.rollups(
    data,
    v => d3.sum(v, d => d.sales),
    d => {
      const dt = d.orderDate;
      return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    }
  )
  .map(([month, sales]) => ({ month, sales }))
  .sort((a,b) => a.month.localeCompare(b.month));

  const svg = d3.select('#chart-trend')
    .append('svg')
    .attr('width', w)
    .attr('height', h);

  const x = d3.scalePoint()
    .domain(monthlySales.map(d => d.month))
    .range([margin.left, w- margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(monthlySales, d => d.sales)])
    .nice()
    .range([h - margin.bottom, margin.top]);

  // Line
  const line = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.sales));

  svg.append('path')
    .datum(monthlySales)
    .attr('fill', 'none')
    .attr('stroke', '#2563eb')   // biru
    .attr('stroke-width', 3)
    .attr('d', line);

  // Titik
  svg.selectAll('circle')
    .data(monthlySales)
    .enter()
    .append('circle')
    .attr('cx', d => x(d.month))
    .attr('cy', d => y(d.sales))
    .attr('r', 4)
    .attr('fill', '#2563eb') // biru
    .append('title')
    .text(d =>
      `${d.month}
Sales: $${Math.round(d.sales).toLocaleString()}`
    );

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${h - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .tickValues(
          monthlySales
            .filter((d,i) => i % 2 === 0)
            .map(d => d.month)
        )
    )
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // Y Axis
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickFormat(d => `$${(d/1000).toFixed(0)}K`)
    );

  // Label Y
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -h/2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Sales');
}

// ── Bar chart: Profit per Region ──────────────────────────────
function renderRegionChart(data) {
  // Struktur serupa, dengan warna berbeda berdasarkan profit positif/negatif
  const margin = { top: 20, right: 20, bottom: 40, left: 80 };
  const w = 400;
  const h = 240;

  const byRegion = d3.rollups(
    data,
    v => d3.sum(v, d => d.profit),
    d => d.region
  ).map(([r, p]) => ({ region: r, profit: p }))
   .sort((a, b) => b.profit - a.profit);

  const svg = d3.select('#chart-region')
    .append('svg')
    .attr('width',  w + margin.left + margin.right)
    .attr('height', h + margin.top  + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(byRegion, d => d.profit)])
    .range([0, w]);
  const y = d3.scaleBand()
    .domain(byRegion.map(d => d.region))
    .range([0, h])
    .padding(0.3);

  svg.selectAll('.bar')
    .data(byRegion)
    .enter().append('rect')
    .attr('x', 0)
    .attr('y',      d => y(d.region))
    .attr('width',  d => x(d.profit))
    .attr('height', y.bandwidth())
    .attr('fill',   d => d.profit >= 0 ? '#16a34a' : '#dc2626')
    .append('title')
    .text(d =>
    `${d.region}
Profit: $${Math.round(d.profit).toLocaleString()}`
  );

  svg.append('g').call(d3.axisLeft(y));
  svg.append('g')
    .attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d => `$${(d/1000).toFixed(0)}K`));
}

// ── Tampilkan summary cards ───────────────────────────────────
function displaySummaryCards(stats) {
  const cards = [
    { label: 'Total Sales',   value: `$${(stats.totalSales/1000000).toFixed(2)}M` },
    { label: 'Total Profit',  value: `$${(stats.totalProfit/1000).toFixed(0)}K` },
    { label: 'Profit Margin', value: `${stats.overallMargin}%` },
    { label: 'Total Quantity Sold',  value: stats.totalQuantity.toLocaleString() },
    { label: 'Total Orders',  value: stats.totalOrders.toLocaleString() }
  ];
  document.getElementById('summary-cards').innerHTML =
    cards.map(c => `
      <div class="summary-card">
        <div class="sc-label">${c.label}</div>
        <div class="sc-value">${c.value}</div>
      </div>`)
    .join('');

  // Tampilkan model yang aktif di badge
  const mb = document.getElementById('model-badge');
  if (mb) mb.textContent = 'llama-3.3-70b-versatile';
}

// ── Render chart dengan anomaly highlight ─────────────────────
// anomalyNames: Set berisi nama sub-kategori yang anomali
// anomalyMap: Map nama -> { severity, direction }
function renderSubcatChart(data, anomalyMap = new Map()) {
  d3.select('#chart-subcat').selectAll('*').remove(); // clear dulu

  const margin = { top: 20, right: 40, bottom: 20, left: 120 };
  const w = 400 - margin.right;
  const h = 240;

  // Agregasi profit per sub-kategori
  const bySubcat = d3.rollups(data,
    v => ({
      margin: d3.sum(v, d => d.profit) / d3.sum(v, d => d.sales) * 100
    }),
    d => d.subcat
  ).map(([name, v]) => ({ name, margin: +v.margin.toFixed(1) }))
   .sort((a, b) => a.margin - b.margin);

  // Fungsi warna berdasarkan anomali status
  const getColor = (d) => {
    if (!anomalyMap.has(d.name)) return '#94a3b8'; // abu-abu = normal
    const a = anomalyMap.get(d.name);
    if (a.severity === 'severe')  return '#dc2626'; // merah keras
    if (a.severity === 'warning') return '#ea580c'; // oranye
    return '#d97706';                                    // kuning
  };

  const svg = d3.select('#chart-subcat')
    .append('svg')
    .attr('width',  w + margin.left + margin.right)
    .attr('height', h + margin.top  + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([d3.min(bySubcat, d => d.margin) - 2, d3.max(bySubcat, d => d.margin) + 2])
    .range([0, w]);
  const y = d3.scaleBand()
    .domain(bySubcat.map(d => d.name))
    .range([0, h]).padding(0.25);

  // Garis referensi di nol (break-even)
  svg.append('line')
    .attr('x1', x(0)).attr('x2', x(0))
    .attr('y1', 0).attr('y2', h)
    .attr('stroke', '#94a3b8').attr('stroke-dasharray', '4,3')
    .attr('stroke-width', 1);

  // Bar
  svg.selectAll('.bar')
    .data(bySubcat).enter().append('rect')
    .attr('class', 'bar')
    .attr('x',      d => d.margin >= 0 ? x(0) : x(d.margin))
    .attr('y',      d => y(d.name))
    .attr('width',  d => Math.abs(x(d.margin) - x(0)))
    .attr('height', y.bandwidth())
    .attr('fill',   d => getColor(d))
    // Tooltip saat hover
    .append('title')
    .text(d => {
      const tag = anomalyMap.has(d.name)
        ? ` [ANOMALI: Z=${anomalyMap.get(d.name).zScore}]`
        : '';
      return `${d.name}: ${d.margin}%${tag}`;
    });

  // Label nilai margin
  svg.selectAll('.label')
    .data(bySubcat).enter().append('text')
    .attr('x', d => d.margin >= 0
        ? x(d.margin) + 3
        : x(d.margin) - 3)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('text-anchor', d => d.margin >= 0 ? 'start' : 'end')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', 10)
    .attr('fill', d => anomalyMap.has(d.name) ? '#dc2626' : '#6b7280')
    .attr('font-weight', d => anomalyMap.has(d.name) ? '600' : '400')
    .text(d => `${d.margin}%`);

  // Axis kiri
  svg.append('g').call(d3.axisLeft(y).tickSize(0))
    .select('.domain').remove();
}

// ── Buat anomalyMap dari hasil deteksi ────────────────────────
// Format: Map(namaSubkat -> { severity, zScore, direction })
function buildAnomalyMap(anomalies) {
  const map = new Map();
  anomalies.profitOutliers.forEach(a => {
    map.set(a.name, { severity: a.severity, zScore: a.zScore, direction: a.direction });
  });
  return map;
}

function updateChartTitles(anomalies) {
  const worstProfit = anomalies.profitOutliers[0];
  const worstMoM    = anomalies.momSpikes[0];

  if (worstProfit) {
    const sign = +worstProfit.margin < 0 ? 'RUGI' : 'Outlier';

    const subcatTitle = document.getElementById('chart-title-subcat');

    if (subcatTitle) {
      subcatTitle.textContent =
        `Profit Margin per Sub-Kategori — ${worstProfit.name} ${sign} (${worstProfit.margin}%)`;
    }
  }

  const trendTitle = document.getElementById('chart-title-trend');

  if (worstMoM && trendTitle) {
    const dir = worstMoM.direction === 'drop' ? 'Turun' : 'Naik';

    trendTitle.textContent =
      `Tren Revenue — ${worstMoM.month} ${dir} ${Math.abs(worstMoM.changePct)}%`;
  }
}

function renderScatterChart(data) {

  const container = d3.select('#chart-scatter');
  container.selectAll('*').remove();

  const margin = { top: 20, right: 40, bottom: 50, left: 60 };
  const w = 420;
  const h = 240;

  const svg = container.append('svg')
    .attr('width', w + margin.left + margin.right)
    .attr('height', h + margin.top + margin.bottom);
  // Aggregasi per subkategori
  const grouped = d3.rollups(
    data,
    v => ({
      sales: d3.sum(v, d => d.sales),
      profit: d3.sum(v, d => d.profit)
    }),
    d => d.subcat
  ).map(([subcat, values]) => ({
    subcat,
    sales: values.sales,
    profit: values.profit
  }));

  const x = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.sales)])
    .nice()
    .range([margin.left, w + margin.left]);

  const y = d3.scaleLinear()
  .domain([0, d3.max(grouped, d => d.profit)])
  .nice()
  .range([h + margin.top, margin.top]);

  // Axis
  svg.append('g')
    .attr('transform', `translate(0,${h + margin.top})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("$.2s")));

  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickFormat(d3.format("$.2s")));

  // Titik
  svg.selectAll('circle')
    .data(grouped)
    .enter()
    .append('circle')
    .attr('cx', d => x(d.sales))
    .attr('cy', d => y(d.profit))
    .attr('r', 6)
    .attr('fill', '#22c55e')
    .append('title')
    .text(d =>
      `${d.subcat}
Sales: $${Math.round(d.sales).toLocaleString()}
Profit: $${Math.round(d.profit).toLocaleString()}`
    );

  // Label sumbu X
  svg.append('text')
    .attr('x', (w + margin.left + margin.right) / 2)
    .attr('y', h + margin.top + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Sales');

  // Label sumbu Y
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(h + margin.top) / 2)
    .attr('y', 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Profit');
}

// app.js — Capstone Orchestrator
// Data load → anomaly detect → render visual → AI story (async)

// ── Helper: parse angka (koma = desimal) ─────────────────────
function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const num = parseFloat(String(val).trim().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

// ── Helper: parse tanggal DD/MM/YYYY ─────────────────────────
function parseDate(str) {
  if (!str) return null;
  const p = str.trim().split('/');
  if (p.length !== 3) return null;
  const d = new Date(+p[2], +p[1]-1, +p[0]);
  return isNaN(d.getTime()) ? null : d;
}

let rawData          = [];
let summaryStats     = {};
let currentAnomalies = {};

// ── Entry point ───────────────────────────────────────────────
d3.csv('superstore.csv').then(async function(data) {

  // == FASE 1: DATA ==
  rawData = data.map(d => ({
    category:  d['Category'],
    subcat:    d['SubCategory'],
    region:    d['Territory'],
    segment:   d['Segment'],
    sales:     +d['Sales'],
    profit:    +d['Profit'],
    quantity:  +d['Qty'],
    orderDate: new Date(d['OrderDate'])
  })).filter(d => !isNaN(d.sales) && !isNaN(d.profit) && !isNaN(d.orderDate.getTime()));

  summaryStats     = computeSummary(rawData);
  currentAnomalies = detectAllAnomalies(rawData);

  // == FASE 2: RENDER VISUAL (sinkron — tampil dulu) ==
  renderKPICards(summaryStats);
  renderRegionChart(rawData);

  const anomalyMap = buildAnomalyMap(currentAnomalies);
  renderSubcatChart(rawData, anomalyMap);
  renderScatterChart(rawData);
  renderTrendChart(rawData);
  renderAlertList(currentAnomalies);
  dispatchDataReady(summaryStats);

  const mb = document.getElementById('model-badge');
  if (mb) mb.textContent = 'llama-3.3-70b-versatile';

  // == FASE 3: AI NARASI (paralel, tidak saling tunggu) ==
  Promise.allSettled([
    generateTitle(summaryStats, currentAnomalies),
    generateStory(summaryStats, currentAnomalies),
    getInsight(summaryStats, 'Berikan 3 insight paling penting dan rekomendasi konkret. Bahasa Indonesia.')
  ]).then(([titleR, storyR, insightR]) => {

    if (titleR.status === 'fulfilled') {
      const el = document.getElementById('narrative-title');
      if (el) {
        const cleanTitle = titleR.value.trim()
          .replace(/^["']+/, '')
          .replace(/["']+$/, '');
        el.textContent = cleanTitle;
        el.classList.add('loaded');
      }
    }

    if (storyR.status === 'fulfilled') {
      const scr = parseStoryResponse(storyR.value);
      fillZone('setup-text',      scr.setup);
      fillZone('conflict-text',   scr.conflict);
      fillZone('resolution-text', scr.resolution);
    }

    if (insightR.status === 'fulfilled') {
      const el = document.getElementById('insight-output');
      if (el) el.innerHTML = formatInsight(insightR.value);
    }
  });
});

function renderKPICards(stats) {
  displaySummaryCards(stats);
}

function fillZone(id, text) {
  const el = document.getElementById(id);
  if (!el || !text) return;
  el.textContent = text; el.classList.add('ai-loaded');
}

function dispatchDataReady(stats) {
  window.dispatchEvent(new CustomEvent('capstone-data-ready', { detail: stats }));
}

// ── renderAlertList ───────────────────────────────────────────
function renderAlertList(anomalies) {
  const sevCount = countSeverity(anomalies);
  const badgeSev  = document.getElementById('badge-severe');
  const badgeWarn = document.getElementById('badge-warning');
  if (badgeSev)  badgeSev.textContent  = sevCount.severe  + ' Kritis';
  if (badgeWarn) badgeWarn.textContent = sevCount.warning + ' Peringatan';

  const container = document.getElementById('alert-tab-raw');
  if (!container) return;

  const items = [];
  anomalies.profitOutliers.forEach(a => items.push({
    severity: a.severity,
    label:    `Profit Margin Anomali: ${a.name}`,
    detail:   `margin ${a.margin}%  |  Z-score ${a.zScore}  |  ${a.direction==='low'?'jauh di bawah':'jauh di atas'} rata-rata`
  }));
  anomalies.momSpikes.forEach(a => items.push({
    severity: a.severity,
    label:    `Revenue ${a.direction==='drop'?'Turun':'Naik'} Drastis: ${a.month}`,
    detail:   `${a.changePct}% MoM  |  $${Number(a.current).toLocaleString()} vs $${Number(a.previous).toLocaleString()}`
  }));
  (anomalies.iqrOutliers?.bySubcat || []).forEach(a => items.push({
    severity: a.severity,
    label:    `Distribusi Tidak Normal: ${a.subcat}`,
    detail:   `${a.count} transaksi outlier  |  rata-rata $${Number(a.avgSales).toLocaleString()}`
  }));

  container.innerHTML = items.length === 0
    ? '<p class="placeholder-text">Tidak ada anomali signifikan.</p>'
    : items.map(i => `<div class="alert-item">
        <div class="ai-dot ${i.severity}"></div>
        <div><div class="ai-label">${i.label}</div>
        <div class="ai-detail">${i.detail}</div></div>
      </div>`).join('');
}

// ── requestAlertNarration ─────────────────────────────────────
async function requestAlertNarration() {
  const btn    = document.getElementById('btn-narrate');
  const output = document.getElementById('ai-narration-output');
  if (!btn || !output) return;
  btn.disabled = true; btn.textContent = 'Memproses...';
  switchAlertTab('ai', document.querySelector('.alert-tab:last-child'));
  output.innerHTML = '<p class="loading-text"><span class="spinner-inline"></span>Mengirim ke AI...</p>';
  try {
    const n = await narrateAllAlerts(currentAnomalies);
    output.innerHTML = n.split('\n').filter(l => l.trim())
      .map(l => `<div class="narration-line">${l.replace(/\*\*/g,'')}</div>`).join('');
  } catch(e) { output.innerHTML = `<p style="color:#dc2626">${e.message}</p>`; }
  finally  { btn.disabled = false; btn.textContent = '🤖 Narasi AI'; }
}

function switchAlertTab(tab, btnEl) {
  document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.alert-tab-content').forEach(c => c.style.display = 'none');
  if (btnEl) btnEl.classList.add('active');
  const t = document.getElementById('alert-tab-' + tab);
  if (t) t.style.display = 'block';
}

// ── requestInsight + quickAsk ─────────────────────────────────
async function requestInsight() {
  const btn    = document.getElementById('btn-insight');
  const output = document.getElementById('insight-output');
  const q      = document.getElementById('custom-question');
  if (!btn || !output) return;
  btn.disabled = true; btn.textContent = 'Memproses...';
  output.innerHTML = '<div class="insight-loading"><div class="spinner"></div><span>Mengirim ke AI...</span></div>';
  try {
    output.innerHTML = formatInsight(await getInsight(summaryStats, q?.value.trim() || ''));
  } catch(e) { output.innerHTML = `<div class="insight-error">${e.message}</div>`; }
  finally  { btn.disabled = false; btn.textContent = 'Minta Insight →'; }
}
function quickAsk(q) {
  const el = document.getElementById('custom-question');
  if (el) el.value = q;
  requestInsight();
}

// ── formatInsight — bersihkan markdown ───────────────────────
function formatInsight(text) {
  let t = text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g,   '$1')
    .replace(/^#{1,3}\s*/gm,    '')
    .replace(/^---+$/gm,       '');
  let html = '';
  t.split('\n').forEach(l => {
    l = l.trim();
    if (!l) { html += '<div class="insight-gap"></div>'; return; }
    if (/^\d+\.\s/.test(l)) { html += `<div class="insight-item">${l.replace(/^\d+\.\s*/,'<b>$&</b> ')}</div>`; return; }
    if (/^[*\-]\s/.test(l))  { html += `<div class="insight-bullet">&bull;&nbsp; ${l.replace(/^[*\-]\s+/,'')}</div>`; return; }
    html += `<div class="insight-line">${l}</div>`;
  });
  return html;
}