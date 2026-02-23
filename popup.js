 const resultsDiv = document.getElementById("results");
const searchInput = document.getElementById("searchInput");
const countSpan = document.getElementById("count");
const targetSpan = document.getElementById("target");
const scanBtn = document.getElementById("scanBtn");
const copyAllBtn = document.getElementById("copyAllBtn");
const downloadBtn = document.getElementById("downloadBtn");

let allSubs = [];
let currentDomain = "";

/* =========================
   GET CURRENT TAB DOMAIN
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.url) return;

  currentDomain = new URL(tabs[0].url).hostname.replace(/^www\./, "");
  targetSpan.textContent = `Target: ${currentDomain}`;
  countSpan.textContent = "Click Scan Domain";
});

/* =========================
   ENUMERATION (crt.sh)
========================= */
async function enumerate(domain) {
  const url = `https://crt.sh/?q=%25.${domain}&output=json`;
  const res = await fetch(url);
  const data = await res.json();
  const subs = new Set();

  data.forEach(entry => {
    entry.name_value.split("\n").forEach(name => {
      if (name.endsWith(domain)) subs.add(name.trim());
    });
  });

  return [...subs];
}

/* =========================
   LIVE CHECK
========================= */
async function checkLive(sub) {
  try {
    await fetch(`https://${sub}/favicon.ico`, { mode: "no-cors" });
    return "LIVE";
  } catch {
    return "DEAD";
  }
}

/* =========================
   RISK TAGGING
========================= */
function getRiskTag(sub) {
  const s = sub.toLowerCase();
  if (s.includes("admin")) return "ADMIN";
  if (s.includes("api")) return "API";
  if (s.includes("dev") || s.includes("test") || s.includes("stage")) return "DEV";
  return "NORMAL";
}

/* =========================
   SCAN BUTTON (MANUAL)
========================= */
scanBtn.addEventListener("click", async () => {
  if (!currentDomain) return;

  resultsDiv.innerHTML = "";
  allSubs = [];
  countSpan.textContent = "Scanning...";

  const subs = await enumerate(currentDomain);

  for (const sub of subs) {
    const status = await checkLive(sub);
    const tag = getRiskTag(sub);
    allSubs.push({ sub, status, tag });
    render(allSubs);
  }
});

/* =========================
   SEARCH FILTER
========================= */
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  render(allSubs.filter(s => s.sub.includes(q)));
});

/* =========================
   COPY ALL
========================= */
copyAllBtn.addEventListener("click", async () => {
  if (!allSubs.length) return;
  await navigator.clipboard.writeText(allSubs.map(s => s.sub).join("\n"));
});

/* =========================
   DOWNLOAD CSV
========================= */
downloadBtn.addEventListener("click", () => {
  if (!allSubs.length) return;

  let csv = "Subdomain,Status,Risk\n";
  allSubs.forEach(s => {
    csv += `${s.sub},${s.status},${s.tag}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  browser.tabs.create({ url });
});

/* =========================
   RENDER RESULTS
========================= */
function render(list) {
  resultsDiv.innerHTML = "";
  countSpan.textContent = `${list.length} found`;

  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <div>
        <div class="sub">${item.sub}</div>
        <div class="meta">
          <span class="${item.status === "LIVE" ? "live" : "dead"}">
            ${item.status === "LIVE" ? "🟢 LIVE" : "🔴 DEAD"}
          </span>
          <span class="tag ${item.tag.toLowerCase()}">${item.tag}</span>
        </div>
      </div>
      <div class="actions">
        <span class="copy">📋</span>
        <span class="open">🌐</span>
      </div>
    `;

    row.querySelector(".copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.sub);
    });

    row.querySelector(".open").addEventListener("click", () => {
      browser.tabs.create({ url: `https://${item.sub}` });
    });

    resultsDiv.appendChild(row);
  });
}
