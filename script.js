// 🔹 Google Sheet ID & sheet
const sheetID = "2PACX-1vSbcPcRbgUdW1O-TF-kKKFERDDZKZudEyaQ8w6oewMpSNnFIyfrhKxF1tL96f3mfpzFISvgabB3qUpu";
const SHEET_NAME = "season 2025-2026"; // default sheet name

// 🔹 Store data
let rawData = [];
const START_BANK = 0;
const SEASON_START_YEAR = 2025;

// 🔹 Parse date dd/mm → Date object
function parseDate(ddmm) {
  if (!ddmm) return null;
  const [day, month] = ddmm.split('/');
  const y = parseInt(month, 10) >= 8 ? SEASON_START_YEAR : SEASON_START_YEAR + 1;
  return new Date(`${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
}

// 🔹 Fetch & parse Google Sheet (CSV version)
async function fetchData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetID}/pub?output=csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csvText = await res.text();

    const [headerLine, ...rows] = csvText.trim().split('\n');
    const headers = headerLine.split(',');

    let last = {};
    rawData = rows.map(row => {
      const values = row.split(',');
      const obj = {
        date: values[0] || last.date || "",
        match: values[1] || last.match || "",
        matchResult: values[2] || last.matchResult || "",
        pick: values[3] || last.pick || "",
        pickResult: values[4] || last.pickResult || "",
        odds: parseFloat(values[5]) || last.odds || 0,
        parlayOdds: parseFloat(values[6]) || last.parlayOdds || 0,
        parlayResult: values[7] || "",
        bank: parseFloat(values[8]) || last.bank || 0
      };
      last = {...last, ...obj};
      return obj;
    }).filter(r => r.date && r.match && r.pick && r.odds);

    populateSeasonAndMonths();
  } catch (err) {
    console.error(err);
    document.getElementById("seasonBank").innerText = "Bank: Error";
    document.getElementById("seasonWins").innerText = "Parlay W: Error";
    document.getElementById("seasonLosses").innerText = "Parlay L: Error";
    document.getElementById("seasonPickWins").innerText = "Pick W: Error";
    document.getElementById("seasonPickLosses").innerText = "Pick L: Error";
  }
}

// 🔹 Compute Parlay & Pick Stats
function getParlayStats(parlays) {
  let parlayWins = 0, parlayLosses = 0;
  let pickWins = 0, pickLosses = 0;
  let finalBank = START_BANK;

  const sortedParlays = Object.entries(parlays).sort(([keyA, parlayA], [keyB, parlayB]) => {
    const dateA = parseDate(parlayA[0].date);
    const dateB = parseDate(parlayB[0].date);
    return dateA - dateB;
  });

  sortedParlays.forEach(([key, parlay]) => {
    const parlayResult = (parlay[0].parlayResult || "").toLowerCase();
    if (parlayResult === "won") parlayWins++;
    else if (parlayResult === "lost") parlayLosses++;

    parlay.forEach(pick => {
      const pickResult = (pick.pickResult || "").toLowerCase();
      if (pickResult === "won") pickWins++;
      else if (pickResult === "lost") pickLosses++;
    });

    const bankValue = Number(parlay[parlay.length - 1].bank);
    if (!isNaN(bankValue)) finalBank = bankValue;
  });

  return { parlayWins, parlayLosses, pickWins, pickLosses, bank: finalBank };
}

// 🔹 Populate season & month stats
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
  const currentBank = seasonStats.bank;
  const bankColor = currentBank > START_BANK ? "limegreen" : (currentBank < START_BANK ? "red" : "gold");

  document.getElementById("seasonBank").innerHTML = `Bank: <span style="color:${bankColor}">${currentBank.toFixed(2)}</span>`;
  document.getElementById("seasonWins").innerText = `Parlay W: ${seasonStats.parlayWins}`;
  document.getElementById("seasonLosses").innerText = `Parlay L: ${seasonStats.parlayLosses}`;
  document.getElementById("seasonPickWins").innerText = `Pick W: ${seasonStats.pickWins}`;
  document.getElementById("seasonPickLosses").innerText = `Pick L: ${seasonStats.pickLosses}`;

  const sortedMonths = Object.keys(parlaysByMonth).sort((a, b) => monthDates[a] - monthDates[b]);
  const monthStatsMap = {};

  sortedMonths.forEach(month => {
    let monthParlays = {};
    Object.values(parlaysByMonth[month]).forEach(dateGroup => {
      Object.values(dateGroup).forEach(parlayArr => {
        const key = parlayArr[0].date + "_" + parlayArr[0].parlayOdds;
        monthParlays[key] = parlayArr;
      });
    });

    let parlayWins = 0, parlayLosses = 0, pickWins = 0, pickLosses = 0;
    Object.values(monthParlays).forEach(parlay => {
      const parlayResult = (parlay[0].parlayResult || "").toLowerCase();
      if (parlayResult === "won") parlayWins++;
      else if (parlayResult === "lost") parlayLosses++;
      parlay.forEach(pick => {
        const pickResult = (pick.pickResult || "").toLowerCase();
        if (pickResult === "won") pickWins++;
        else if (pickResult === "lost") pickLosses++;
      });
    });

    let finalBankForMonth = START_BANK;
    const monthDatesArray = Object.keys(parlaysByMonth[month]).sort((a, b) => parseDate(b) - parseDate(a));
    if (monthDatesArray.length > 0) {
      const latestDate = monthDatesArray[0];
      const latestDateParlays = Object.values(parlaysByMonth[month][latestDate]);
      if (latestDateParlays.length > 0) {
        const lastParlay = latestDateParlays[latestDateParlays.length - 1];
        const bankValue = Number(lastParlay[lastParlay.length - 1].bank);
        if (!isNaN(bankValue)) finalBankForMonth = bankValue;
      }
    }

    monthStatsMap[month] = { parlayWins, parlayLosses, pickWins, pickLosses, bank: finalBankForMonth };
  });

  // Season dropdown
  const seasonDropdown = document.getElementById("seasonDropdown");
  if (seasonDropdown) {
    seasonDropdown.innerHTML = "";
    sortedMonths.forEach(month => {
      const stats = monthStatsMap[month];
      const bankColor = stats.bank > START_BANK ? "limegreen" : (stats.bank < START_BANK ? "red" : "gold");
      const monthSummary = document.createElement("div");
      monthSummary.className = "month-summary";
      monthSummary.innerHTML = `
        <span class="month-summary-name">${month}</span>
        <span class="month-summary-stats">
          Parlay W: ${stats.parlayWins} | Parlay L: ${stats.parlayLosses} | 
          Pick W: ${stats.pickWins} | Pick L: ${stats.pickLosses} | 
          Bank: <span style="color:${bankColor}">${stats.bank.toFixed(2)}</span>
        </span>
      `;
      seasonDropdown.appendChild(monthSummary);
    });
  }

  const seasonButton = document.getElementById("seasonButton");
  if (seasonButton) {
    const newSeasonButton = seasonButton.cloneNode(true);
    seasonButton.parentNode.replaceChild(newSeasonButton, seasonButton);
    newSeasonButton.addEventListener("click", () => {
      document.querySelectorAll('.parlays-dropdown').forEach(el => {
        if (el.id !== 'seasonDropdown') el.style.display = "none";
      });
      const dropdown = document.getElementById("seasonDropdown");
      if (dropdown) dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    });
  }

  const container = document.getElementById("monthButtons");
  if (container) {
    container.innerHTML = "";
    [...sortedMonths].sort((a, b) => monthDates[b] - monthDates[a]).forEach(month => {
      const stats = monthStatsMap[month];
      const bankColor = stats.bank > START_BANK ? "limegreen" : (stats.bank < START_BANK ? "red" : "gold");

      const btn = document.createElement("button");
      btn.className = "month-toggle-btn";
      btn.innerHTML = `
        <span class="month-name">${month}</span>
        <span class="month-stats">
          Parlay W: ${stats.parlayWins} | Parlay L: ${stats.parlayLosses} | 
          Pick W: ${stats.pickWins} | Pick L: ${stats.pickLosses} | 
          Bank: <span style="color:${bankColor}">${stats.bank.toFixed(2)}</span>
        </span>
      `;

      const parlaysContainer = document.createElement("div");
      parlaysContainer.className = "parlays-dropdown";
      parlaysContainer.style.display = "none";
      parlaysContainer.style.marginTop = "5px";
      renderParlaysForMonth(parlaysByMonth[month], parlaysContainer);

      btn.addEventListener("click", () => {
        const seasonDropdown = document.getElementById("seasonDropdown");
        if (seasonDropdown) seasonDropdown.style.display = "none";
        document.querySelectorAll('.parlays-dropdown').forEach(el => {
          if (el !== parlaysContainer && el.id !== 'seasonDropdown') el.style.display = "none";
        });
        parlaysContainer.style.display = parlaysContainer.style.display === "none" ? "block" : "none";
      });

      container.appendChild(btn);
      container.appendChild(parlaysContainer);
    });
  }
}

// 🔹 Render parlays for a month
function renderParlaysForMonth(monthData, container) {
  Object.keys(monthData)
    .sort((a, b) => parseDate(b) - parseDate(a))
    .forEach(date => {
      const dateGroup = monthData[date];
      Object.keys(dateGroup).forEach(parlayOdds => {
        const parlay = dateGroup[parlayOdds];
        const parlayResult = (parlay[0].parlayResult || "").toLowerCase();
        const jsDate = parseDate(parlay[0].date);
        if (!parlay[0].match || !parlay[0].pick || !parlay[0].odds) return;

        const parlayDiv = document.createElement("div");
        parlayDiv.classList.add("parlay", parlayResult === "won" ? "won" : "lost");
        parlayDiv.innerHTML = `
          <div class="parlay-header">
            <span class="parlay-date">${jsDate ? jsDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : "??/??"}</span>
            <span class="parlay-status">${parlayResult === "won" ? "WON" : "LOST"}</span>
          </div>
          <div class="parlay-body">
            ${parlay.map(m => {
              const pickResult = (m.pickResult || "").toLowerCase();
              const pickClass = pickResult === "won" ? "won" : (pickResult === "lost" ? "lost" : "");
              return `
                <div class="match ${pickClass}">
                  <div class="match-info">
                    <div class="match-teams">${m.match}</div>
                    <div class="match-pick">Pick: ${m.pick}</div>
                    <div class="match-result">Result: ${m.matchResult || "N/A"}</div>
                  </div>
                  <div class="match-odds">${m.odds}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div class="parlay-footer">
            <span class="total-odds">Total Odds: ${parlayOdds || "N/A"}</span>
          </div>
        `;
        container.appendChild(parlayDiv);
        setTimeout(() => parlayDiv.classList.add("show"), 50);
      });
    });
}

// 🔹 Auto-refresh every 60s
fetchData();
setInterval(fetchData, 60000);
