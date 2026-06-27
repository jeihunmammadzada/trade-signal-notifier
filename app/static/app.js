const rows = document.getElementById("signalRows");
const historyRows = document.getElementById("historyRows");
const intervalBadge = document.getElementById("intervalBadge");
const updatedAt = document.getElementById("updatedAt");
const errorBox = document.getElementById("errorBox");
const refreshBtn = document.getElementById("refreshBtn");
const viewToggleBtn = document.getElementById("viewToggleBtn");
const signalsWrap = document.getElementById("signalsWrap");
const buyCount = document.getElementById("buyCount");
const sellCount = document.getElementById("sellCount");
const holdCount = document.getElementById("holdCount");
const dominantSignal = document.getElementById("dominantSignal");
const opportunityList = document.getElementById("opportunityList");
const alertList = document.getElementById("alertList");
const telegramStatus = document.getElementById("telegramStatus");
const VIEW_MODE_KEY = "signal_view_mode";

let detailedMode = false;

try {
  detailedMode = localStorage.getItem(VIEW_MODE_KEY) === "detailed";
} catch (error) {
  detailedMode = false;
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function signalBadge(signal) {
  const lower = signal.toLowerCase();
  return `<span class="badge badge-${lower}">${signal}</span>`;
}

function buildAction(item) {
  if (item.signal === "BUY") {
    if (item.strength === "HIGH") {
      return "Alis fikrine bax. Siqnal gucludur, riski yenede bol.";
    }
    return "Alis ola biler, amma ehtiyatli ol.";
  }

  if (item.signal === "SELL") {
    if (item.strength === "HIGH") {
      return "Satisa bax. Dusme riski gucludur.";
    }
    return "Satisa baxmaq olar, hele tam guclu deyil.";
  }

  return "Hazirda deqiq istiqamet yoxdur, gozlemek daha yaxsidir.";
}

function riskTone(level) {
  if (level === "HIGH") {
    return "Yuksek";
  }
  if (level === "MEDIUM") {
    return "Orta";
  }
  return "Asagi";
}

function renderSparkline(values, signal) {
  if (!values?.length) {
    return '<span class="empty">Trend yoxdur</span>';
  }

  const width = 90;
  const height = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * width;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const color = signal === "BUY" ? "#1f9d58" : signal === "SELL" ? "#d94841" : "#7e6110";
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" /></svg>`;
}

function renderSignals(signals) {
  rows.innerHTML = "";

  if (!signals.length) {
    rows.innerHTML = `<tr><td colspan="${detailedMode ? 10 : 6}" class="empty">Hele siqnal yoxdur.</td></tr>`;
    return;
  }

  signals.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.style.animationDelay = `${index * 40}ms`;

    tr.innerHTML = `
      <td>${item.symbol}</td>
      <td>${signalBadge(item.signal)}</td>
      <td>${renderSparkline(item.sparkline, item.signal)}</td>
      <td class="action-cell">${buildAction(item)}</td>
      <td><span class="risk-pill risk-${item.risk_level.toLowerCase()}">${riskTone(item.risk_level)} risk (${item.risk_score})</span><br><small>SL: ${item.stop_loss_range}</small></td>
      <td>${item.reasons.join("; ")}</td>
      <td class="detailed-only">${formatNumber(item.snapshot.close_price, 4)}</td>
      <td class="detailed-only">${item.score}</td>
      <td class="detailed-only">${formatNumber(item.snapshot.rsi)}</td>
      <td class="detailed-only">${formatNumber(item.snapshot.macd, 4)} / ${formatNumber(item.snapshot.macd_signal, 4)}</td>
    `;

    rows.appendChild(tr);
  });
}

function syncViewMode() {
  signalsWrap.classList.toggle("show-detailed", detailedMode);
  viewToggleBtn.textContent = detailedMode ? "Sade gorunus" : "Genis gorunus";

  try {
    localStorage.setItem(VIEW_MODE_KEY, detailedMode ? "detailed" : "simple");
  } catch (error) {
    // Ignore storage errors in private mode or restricted contexts.
  }
}

function renderHistory(history) {
  historyRows.innerHTML = "";

  if (!history.length) {
    historyRows.innerHTML = '<tr><td colspan="6" class="empty">Hele BUY/SELL tarixcesi yoxdur.</td></tr>';
    return;
  }

  history.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(item.timestamp).toLocaleString()}</td>
      <td>${item.symbol}</td>
      <td>${signalBadge(item.signal)}</td>
      <td>${item.strength}</td>
      <td>${formatNumber(item.price, 4)}</td>
      <td>${item.reasons.join("; ")}</td>
    `;
    historyRows.appendChild(tr);
  });
}

function renderPulse(pulse, opportunities) {
  buyCount.textContent = pulse?.buy_count ?? 0;
  sellCount.textContent = pulse?.sell_count ?? 0;
  holdCount.textContent = pulse?.hold_count ?? 0;
  dominantSignal.textContent = pulse?.dominant ?? "HOLD";

  opportunityList.innerHTML = "";
  if (!opportunities?.length) {
    opportunityList.innerHTML = '<li class="empty">Hazirda aciq furset gorunmur.</li>';
    return;
  }

  opportunities.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `${item.symbol} - ${item.signal} (${item.strength}, skor ${item.score})<br><small>${item.reason}</small><br><small>Risk: ${riskTone(item.risk)} | SL: ${item.stop_loss}</small>`;
    opportunityList.appendChild(li);
  });
}

function renderAlerts(alerts) {
  alertList.innerHTML = "";

  if (!alerts?.length) {
    alertList.innerHTML = '<li class="empty">Hec yeni xeberdarliq yoxdur.</li>';
    return;
  }

  alerts.slice(0, 8).forEach((item) => {
    const li = document.createElement("li");
    li.className = `alert-item alert-${(item.level || "INFO").toLowerCase()}`;
    li.innerHTML = `
      <p><strong>${item.symbol}</strong> - ${item.title}</p>
      <p>${item.message}</p>
      <small>${new Date(item.timestamp).toLocaleString()}</small>
    `;
    alertList.appendChild(li);
  });
}

async function loadSignals() {
  errorBox.textContent = "";

  try {
    const response = await fetch("/api/signals", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Signal API xetasi: ${response.status}`);
    }

    const payload = await response.json();
    intervalBadge.textContent = `Interval: ${payload.interval}`;
    updatedAt.textContent = `Son yenilenme: ${new Date(payload.last_updated).toLocaleString()}`;
    telegramStatus.textContent = payload.telegram_enabled ? "Telegram: aktiv" : "Telegram: passiv";
    renderSignals(payload.signals);
    renderHistory(payload.history || []);
    renderPulse(payload.market_pulse || {}, payload.opportunities || []);
    renderAlerts(payload.alerts || []);
  } catch (error) {
    errorBox.textContent = "Serverden melumat alina bilmedi.";
  }
}

refreshBtn.addEventListener("click", loadSignals);
viewToggleBtn.addEventListener("click", () => {
  detailedMode = !detailedMode;
  syncViewMode();
  loadSignals();
});

syncViewMode();
loadSignals();
setInterval(loadSignals, 600000);
