// 🔹 Google Sheet ID & sheet
const sheetID = "2PACX-1vSbcPcRbgUdW1O-TF-kKKFERDDZKZudEyaQ8w6oewMpSNnFIyfrhKxF1tL96f3mfpzFISvgabB3qUpu";
const SHEET_NAME = "Season 2025-2026"; // default sheet name

// 🔹 Store data
let rawData = [];
const START_BANK = 0;
const SEASON_START_YEAR = 2025;

// 🔹 Parse date dd/mm → Date object
function parseDate(ddmm) {
  if (!ddmm) return null;
  const [day, month] = ddmm.split('/');
  const y = parseInt(month,10) >= 8 ? SEASON_START_YEAR : SEASON_START_YEAR + 1;
  return new Date(`${y}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
}

// 🔹 Fetch & parse Google Sheet
async function fetchData() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/e/${sheetID}/gviz/tq?tqx=out:json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if(!match) throw new Error("Failed to parse Google Sheets JSON");
    const json = JSON.parse(match[1]);
    const rows = json.table.rows;

    let last = {};
    rawData = rows.map(r => {
      const obj = {
        date: r.c[0]?.v || last.date || "",
        match: r.c[1]?.v || last.match || "",
        matchResult: r.c[2]?.v || last.matchResult || "",
        pick: r.c[3]?.v || last.pick || "",
        pickResult: r.c[4]?.v || last.pickResult || "",
        odds: r.c[5]?.v || last.odds || 0,
        parlayOdds: r.c[6]?.v || last.parlayOdds || 0,
        parlayResult: r.c[7]?.v || "",
        bank: r.c[8]?.v || last.bank || 0
      };
      last = {...last, ...obj};
      return obj;
    }).filter(r=>r.date && r.match && r.pick && r.odds);

    populateSeasonAndMonths();
  } catch(err) {
    console.error(err);
    document.getElementById("seasonBank").innerText = "Bank: Error";
    document.getElementById("seasonParlayStats").innerText = "Parlay: Error";
    document.getElementById("seasonPickStats").innerText = "Picks: Error";
  }
}

// 🔹 Calculate stats
function getParlayStats(parlays) {
  let parlayWins=0, parlayLosses=0, pickWins=0, pickLosses=0, finalBank=START_BANK;
  Object.values(parlays).forEach(parlay => {
    const res = (parlay[0].parlayResult||"").toLowerCase();
    if(res==="won") parlayWins++;
    else if(res==="lost") parlayLosses++;
    parlay.forEach(pick=>{
      const pickRes = (pick.pickResult||"").toLowerCase();
      if(pickRes==="won") pickWins++;
      else if(pickRes==="lost") pickLosses++;
    });
    finalBank = Number(parlay[parlay.length-1].bank) || finalBank;
  });
  return {parlayWins, parlayLosses, pickWins, pickLosses, bank: finalBank};
}

// 🔹 Populate Season & Months
function populateSeasonAndMonths() {
  const parlaysByMonth={}; const monthDates={};
  rawData.forEach(item=>{
    const jsDate=parseDate(item.date); if(!jsDate) return;
    const month=jsDate.toLocaleString('default',{month:'long'});
    if(!parlaysByMonth[month]) parlaysByMonth[month]={};
    if(!parlaysByMonth[month][item.date]) parlaysByMonth[month][item.date]={};
    if(!parlaysByMonth[month][item.date][item.parlayOdds]) parlaysByMonth[month][item.date][item.parlayOdds]=[];
    parlaysByMonth[month][item.date][item.parlayOdds].push(item);
    if(!monthDates[month]||jsDate>monthDates[month]) monthDates[month]=jsDate;
  });

  // Season totals
  let allParlays={};
  Object.values(parlaysByMonth).forEach(monthGroup=>{
    Object.values(monthGroup).forEach(dateGroup=>{
      Object.values(dateGroup).forEach(arr=>{
        const key=arr[0].date+"_"+arr[0].parlayOdds;
        allParlays[key]=arr;
      });
    });
  });

  const seasonStats=getParlayStats(allParlays);
  const bankColor=seasonStats.bank>START_BANK?"limegreen":seasonStats.bank<START_BANK?"red":"gold";
  document.getElementById("seasonBank").innerHTML=`Bank: <span style="color:${bankColor}">${seasonStats.bank.toFixed(2)}</span>`;
  document.getElementById("seasonParlayStats").innerText=`Parlay: ${seasonStats.parlayWins}W ${seasonStats.parlayLosses}L`;
  document.getElementById("seasonPickStats").innerText=`Picks: ${seasonStats.pickWins}W ${seasonStats.pickLosses}L`;

  const container=document.getElementById("monthButtons"); container.innerHTML="";
  const sortedMonths=Object.keys(parlaysByMonth).sort((a,b)=>monthDates[a]-monthDates[b]).reverse();

  sortedMonths.forEach(month=>{
    let monthParlays={};
    Object.values(parlaysByMonth[month]).forEach(dateGroup=>Object.values(dateGroup).forEach(arr=>{
      const key=arr[0].date+"_"+arr[0].parlayOdds; monthParlays[key]=arr;
    }));
    const stats=getParlayStats(monthParlays);
    const bankColor=stats.bank>START_BANK?"limegreen":stats.bank<START_BANK?"red":"gold";

    const btn=document.createElement("button");
    btn.className="month-toggle-btn";
    btn.innerHTML=`<span class="month-name">${month}</span><div><span class="month-stats">Parlay: ${stats.parlayWins}W ${stats.parlayLosses}L | Picks: ${stats.pickWins}W ${stats.pickLosses}L</span><div class="bank-display" style="color:${bankColor}">${stats.bank.toFixed(2)}</div></div>`;

    const parlaysContainer=document.createElement("div"); parlaysContainer.className="parlays-dropdown";

    btn.addEventListener("click",()=>{
      document.querySelectorAll('.parlays-dropdown').forEach(el=>{if(el!==parlaysContainer) el.classList.remove("show");});
      parlaysContainer.classList.toggle("show");
    });

    container.appendChild(btn); container.appendChild(parlaysContainer);
    renderParlaysForMonth(parlaysByMonth[month], parlaysContainer);
  });

  document.getElementById("seasonButton")?.addEventListener("click",()=>{
    document.querySelectorAll('.parlays-dropdown').forEach(el=>{if(el.id!=="seasonDropdown") el.classList.remove("show");});
    document.getElementById("seasonDropdown")?.classList.t
