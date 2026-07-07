// CONFIGURATION: Replace with your deployed Google Apps Script Web App URL
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwKRPK7cxnfFteehJVck88yZIxBY7GgnDWTHbgLo3upzbkqXIHKVCiD-L_gz5_4IKnxTA/exec";

// User Session Definition
const USER_SESSION = {
  userId: "user-example-id-12345",
  syncToken: "sync-example-token-12345"
};

let globalHistoryData = [];
let myChart = null;

// --- EXPLICIT FIX FOR ANDROID CHROME DATE LOCALIZATION QUIRKS ---
function formatInputDateToBackend(inputDateStr) {
  if (!inputDateStr) return "";
  
  // Native HTML5 date field values are uniformly provided as "YYYY-MM-DD"
  // regardless of regional formatting masks displayed on Chrome Mobile layouts
  const parts = inputDateStr.split('-');
  if (parts.length !== 3) return inputDateStr;
  
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  // Re-map string sequence into the custom format expected by your Apps Script
  return `${day}-${month}-${year}`;
}

function parseBackendDateToTimestamp(backendDateStr) {
  if (!backendDateStr) return 0;
  const parts = backendDateStr.split('-');
  if (parts.length !== 3) return 0;
  // Map dd-mm-yyyy arrays cleanly back into browser UNIX timestamps
  return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
}

// System initialization bootstrap loader
window.addEventListener('DOMContentLoaded', () => {
  const todayIso = new Date().toISOString().split('T')[0];
  document.getElementById('txDate').value = todayIso;
  
  // Load initial backend metric parameters
  fetchDashboardData();
  
  // Dynamic filter trigger hook listening handlers
  document.getElementById('filterStart').addEventListener('change', filterHistoryTable);
  document.getElementById('filterEnd').addEventListener('change', filterHistoryTable);
});

// UI System Status Banners UI Engine
function showAlert(msg, isError = false) {
  const alertBox = document.getElementById('alertBox');
  alertBox.className = `alert ${isError ? 'alert-error' : 'alert-success'}`;
  alertBox.innerText = msg;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 5000);
}

// POST REQUEST MUTATION CONTROLLER
document.getElementById('txForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerText = "Processing...";

  const rawDateVal = document.getElementById('txDate').value;
  const formattedDate = formatInputDateToBackend(rawDateVal);

  const payload = {
    action: "append",
    userId: USER_SESSION.userId,
    syncToken: USER_SESSION.syncToken,
    name: document.getElementById('txName').value,
    amount: parseFloat(document.getElementById('txAmount').value),
    selectedDate: formattedDate,
    desc: document.getElementById('txDesc').value,
    txId: "tx-" + new Date().getTime() // Deduplication sequence anchor token
  };

  fetch(BACKEND_URL, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      showAlert("Transaction successfully recorded into Google Sheet!");
      document.getElementById('txForm').reset();
      document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
      fetchDashboardData(); // Instantly update view data models
    } else {
      throw new Error(data.error || "Execution failed on Server.");
    }
  })
  .catch(err => {
    showAlert(err.message, true);
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Transaction";
  });
});

// DASHBOARD SYNCHRONIZATION AND CONTEXT REFRESH ENGINE
function fetchDashboardData() {
  const payload = {
    action: "dashboard",
    userId: USER_SESSION.userId,
    syncToken: USER_SESSION.syncToken
  };

  fetch(BACKEND_URL, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.ok) {
      document.getElementById('connectionStatus').innerText = "Connected";
      document.getElementById('connectionStatus').style.background = "#d1fae5";
      
      // Update UI Counters
      document.getElementById('metricToday').innerText = "₹" + data.todayCollection.toLocaleString('en-IN');
      document.getElementById('metricMonth').innerText = "₹" + data.thisMonth.toLocaleString('en-IN');
      document.getElementById('metricTotal').innerText = "₹" + data.totalCollection.toLocaleString('en-IN');
      
      globalHistoryData = data.recent || [];
      filterHistoryTable(); // Repopulate list dynamically
      updateChartData(data.chart);
    } else {
      throw new Error(data.error);
    }
  })
  .catch(err => {
    document.getElementById('connectionStatus').innerText = "Disconnected";
    document.getElementById('connectionStatus').style.background = "#fee2e2";
    console.error("Dashboard synchronization error:", err);
  });
}

// CLIENT-SIDE SEARCH MATRIX FILTERS
function filterHistoryTable() {
  const startVal = document.getElementById('filterStart').value; // Returns yyyy-mm-dd format
  const endVal = document.getElementById('filterEnd').value;     // Returns yyyy-mm-dd format

  const startTs = startVal ? new Date(startVal).setHours(0,0,0,0) : null;
  const endTs = endVal ? new Date(endVal).setHours(23,59,59,999) : null;

  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = "";

  const filtered = globalHistoryData.filter(item => {
    const itemTs = parseBackendDateToTimestamp(item.selectedDate);
    if (!itemTs) return true;
    if (startTs && itemTs < startTs) return false;
    if (endTs && itemTs > endTs) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-light);">No data found for this date range.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.selectedDate}</td>
      <td style="font-weight:500;">${item.name}</td>
      <td><span style="background:#f3f4f6; padding:4px 8px; border-radius:4px; font-size:12px;">${item.desc || 'General'}</span></td>
      <td style="font-weight:600; color:var(--primary-dark);">₹${Number(item.amount).toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
}

// GRAPH GENERATION AND ENGINE RENDERER
function updateChartData(chartPayload) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (myChart) { myChart.destroy(); }
  
  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: chartPayload.labels || [],
      datasets: [{
        data: chartPayload.values || [],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } }
    }
  });
}
