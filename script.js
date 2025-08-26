// 🔹 Google Sheet ID & sheet
const sheetID = "1hqgI3ZtPxQfSTA9y5w3jBmedTZP7sqlMGIVqm4mqZB8";
const SHEET_NAME = "season 2025/2026";

// 🔹 Store data
let rawData = [];
const START_BANK = 0;
const SEASON_START_YEAR = 2025;

// 🔹 Parse date dd/mm → Date object
function parseDate(ddmm) {
  if (!ddmm || typeof ddmm !== 'string') return null;
  const [day, month] = ddmm.split('/');
  if (!day || !month) return null;
  const y = parseInt(month, 10) >= 8 ? SEASON_START_YEAR : SEASON_START_YEAR + 1;
  return new Date(`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
}

// 🔹 Fetch & parse Google Sheet
async function fetchData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tqx=out:json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) throw new Error("Failed to parse Google Sheets JSON");
    const json = JSON.parse(match[1]);
    
    const rows = json.table.rows;
    let lastNonEmpty = {};

    rawData = rows.map(r => {
      const obj = {
        date: r.c[0]?.v || lastNonEmpty.date || "",
        match: r.c[1]?.v || lastNonEmpty.match || "",
        matchResult: r.c[2]?.v || lastNonEmpty.matchResult || "",
        pick: r.c[3]?.v || lastNonEmpty.pick || "",
        pickResult: r.c[4]?.v || lastNonEmpty.pickResult || "",
        odds: r.c[5]?.v || lastNonEmpty.odds || 0,
        parlayOdds: r.c[6]?.v || lastNonEmpty.parlayOdds || 0,
        parlayResult: r.c[7]?.v || "",
        bank: r.c[8]?.v || lastNonEmpty.bank || 0
      };
      lastNonEmpty = { ...lastNonEmpty, ...obj };
      return obj;
    }).filter(r => r.date && r.match && r.pick && r.odds);

    populateSeasonAndMonths();

  } catch (err) {
    console.error("Error fetching data:", err);
    document.getElementById("seasonBank")?.innerText = "Bank: Error loading";
    document.getElementById("seasonParlayStats")?.innerText = "Parlay: Error";
    document.getElementById("seasonPickStats")?.innerText = "Picks: Error";
  }
}

// 🔹 Calculate stats for a group of parlays
function getParlayStats(parlays) {
  let parlayWins = 0, parlayLosses = 0;
  let pickWins = 0, pickLosses = 0;
  let finalBank = START_BANK;

  Object.values(parlays).forEach(parlay => {
    const parlayResult = (parlay[0].parlayResult || "").toLowerCase();
    if (parlayResult === "won") parlayWins++;
    else if (parlayResult === "lost") parlayLosses++;

    parlay.forEach(pick => {
      const pickResult = (pick.pickResult || "").toLowerCase();
      if (pickResult === "won") pickWins++;
      else if (pickResult === "lost") pickLosses++;
    });

    const bankValue = Number(parlay[parlay.length - 1].bank) || finalBank;
    finalBank = bankValue;
  });

  return { parlayWins, parlayLosses, pickWins, pickLosses, bank: finalBank };
}

// 🔹 Populate Season & Month dropdowns
function populateSeasonAndMonths() {
  const parlaysByMonth = {};
  const monthDates = {};

  rawData.forEach(item => {
    const jsDate = parseDate(item.date);
    if (!jsDate) return;
    const month = jsDate.toLocaleString('default', { month: 'long' });
    if (!parlaysByMonth[month]) parlaysByMonth[month] = {};
    if (!parlaysByMonth[month][item.date]) parlaysByMonth[month][item.date] = {};
    if (!parlaysByMonth[month][item.date][item.parlayOdds]) parlaysByMonth[month][item.date][item.parlayOdds] = [];
    parlaysByMonth[month][item.date][item.parlayOdds].push(item);

    if (!monthDates[month] || jsDate > monthDates[month]) monthDates[month] = jsDate;
  });

  // Season totals
  let allParlays = {};
  Object.values(parlaysByMonth).forEach(monthGroup => {
    Object.values(monthGroup).forEach(dateGroup => {
      Object.values(dateGroup).forEach(parlayArr => {
        const key = parlayArr[0].date + "_" + parlayArr[0].parlayOdds;
        allParlays[key] = parlayArr;
      });
    });
  });
  const seasonStats = getParlayStats(allParlays);
  const bankColor = seasonStats.bank > START_BANK ? "limegreen" : (seasonStats.bank < START_BANK ? "red" : "gold");

  document.getElementById("seasonBank")?.innerHTML = `Bank: <span style="color:${bankColor}">${seasonStats.bank.toFixed(2)}</span>`;
  document.getElementById("seasonParlayStats")?.innerText = `Parlay: ${seasonStats.parlayWins}W ${seasonStats.parlayLosses}L`;
  document.getElementById("seasonPickStats")?.innerText = `Picks: ${seasonStats.pickWins}W ${seasonStats.pickLosses}L`;

  // Month buttons
  const container = document.getElementById("monthButtons");
  if (!container) return;
  container.innerHTML = "";

  const sortedMonths = Object.keys(parlaysByMonth).sort((a,b) => monthDates[a].getTime() - monthDates[b].getTime());

  sortedMonths.reverse().forEach(month => {
    let monthParlays = {};
    Object.values(parlaysByMonth[month]).forEach(dateGroup => {
      Object.values(dateGroup).forEach(parlayArr => {
        const key = parlayArr[0].date + "_" + parlayArr[0].parlayOdds;
        monthParlays[key] = parlayArr;
      });
    });
    const stats = getParlayStats(monthParlays);
    const bankColor = stats.bank > START_BANK ? "limegreen" : (stats.bank < START_BANK ? "red" : "gold");

    const btn = document.createElement("button");
    btn.className = "month-toggle-btn";
    btn.innerHTML = `
      <span class="month-name">${month}</span>
      <div>
        <span class="month-stats">Parlay: ${stats.parlayWins}W ${stats.parlayLosses}L | Picks: ${stats.pickWins}W ${stats.pickLosses}L</span>
        <div class="bank-display" style="color:${bankColor}">${stats.bank.toFixed(2)}</div>
      </div>
    `;

    const parlaysContainer = document.createElement("div");
    parlaysContainer.className = "parlays-dropdown";

    btn.addEventListener("click", () => {
      document.getElementById("seasonDropdown")?.classList.remove("show");
      document.querySelectorAll('.parlays-dropdown').forEach(el => {
        if (el !== parlaysContainer && el.id !== "seasonDropdown") el.classList.remove("show");
      });
      parlaysContainer.classList.toggle("show");
    });

    container.appendChild(btn);
    container.appendChild(parlaysContainer);
    renderParlaysForMonth(parlaysByMonth[month], parlaysContainer);
  });

  // Season dropdown toggle
  const seasonButton = document.getElementById("seasonButton");
  seasonButton?.addEventListener("click", () => {
    document.querySelectorAll('.parlays-dropdown').forEach(el => {
      if (el.id !== "seasonDropdown") el.classList.remove("show");
    });
    document.getElementById("seasonDropdown")?.classList.toggle("show");
  });
}

// 🔹 Render parlays per month
function renderParlaysForMonth(monthData, container) {
  container.innerHTML = "";
  const parlaysByDate = {};

  Object.keys(monthData).forEach(date => {
    parlaysByDate[date] = [];
    Object.values(monthData[date]).forEach(parlayArr => {
      if (parlayArr[0].match && parlayArr[0].pick && parlayArr[0].odds) parlaysByDate[date].push(parlayArr);
    });
  });

  Object.keys(parlaysByDate).sort((a,b) => parseDate(b) - parseDate(a)).forEach(date => {
    const jsDate = parseDate(date);
    const dateStr = jsDate ? jsDate.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit' }) : "??/??";

    const dateDivider = document.createElement("div");
    dateDivider.className = "date-divider";
    dateDivider.textContent = dateStr;
    container.appendChild(dateDivider);

    parlaysByDate[date].forEach(parlay => {
      const parlayDiv = document.createElement("div");
      const resultClass = (parlay[0].parlayResult||"").toLowerCase() === "won" ? "won" : "lost";
      parlayDiv.className = `parlay ${resultClass}`;
      parlayDiv.innerHTML = `
        <div class="parlay-body">
          ${parlay.map(m => {
            const pickClass = (m.pickResult||"").toLowerCase();
            return `
              <div class="match ${pickClass}">
                <div class="match-info">
                  <div class="match-teams">${m.match}</div>
                  <div class="match-pick-result">Pick: ${m.pick} ${m.matchResult ? `(${m.matchResult})` : ''}</div>
                </div>
                <div class="match-odds">${m.odds}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="parlay-footer">Total Odds: ${parlay[0].parlayOdds || "N/A"}</div>
      `;
      container.appendChild(parlayDiv);
      setTimeout(() => parlayDiv.classList.add("show"), 50);
    });
  });
}

// ==========================
// Auto-refresh every 60s
// ==========================
fetchData();
setInterval(fetchData, 60000);
