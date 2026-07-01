import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB67J0LX09zOUENtnUw_n5JJLDV7OQb7xg",
    authDomain: "pitstop-tracker-1.firebaseapp.com",
    projectId: "pitstop-tracker-1",
    storageBucket: "pitstop-tracker-1.firebasestorage.app",
    messagingSenderId: "497933964321",
    appId: "1:497933964321:web:9ae8916a5b2a9ae328bf60",
    measurementId: "G-MNKKS9VZE8"
};

const app = initializeApp(firebaseConfig);
const dbFS = getFirestore(app);

let currentUserId = localStorage.getItem('f1_auth_uid') || null;
let viewedUserId = currentUserId; 
let globalRoster = [];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKey = `${currentYear}-${monthNames[currentMonth]}`;
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

let driverData = {
    passcode: '', activeTeam: 'audi', name: '', number: '', 
    weeklyGoal: '', monthlyGoal: '', habits: [], archive: {}, lastMonthKey: monthKey
};

const teamData = {
    audi: { color: 'var(--audi-red)', svg: `<svg viewBox="0 0 350 150" class="background-rings"><circle cx="75" cy="75" r="50"/><circle cx="140" cy="75" r="50"/><circle cx="205" cy="75" r="50"/><circle cx="270" cy="75" r="50"/></svg>` },
    mclaren: { color: 'var(--mclaren-orange)', svg: `<svg viewBox="0 0 350 150" class="background-rings"><path d="M 30,120 C 120,40 240,20 320,60 C 350,90 280,140 230,110 C 180,90 100,90 30,120 Z" /></svg>` }
};

document.getElementById('month-display').innerText = `${monthNames[currentMonth]} ${currentYear} TRACK`;

function updateClocks() {
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    document.getElementById('tz-blr').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Asia/Kolkata' }).format(now);
    document.getElementById('tz-hin').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Zurich' }).format(now);
    document.getElementById('tz-lon').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/London' }).format(now);
}
setInterval(updateClocks, 1000); updateClocks();

// --- AUTHENTICATION INTERACTION MATRIX ---
window.switchAuthTab = function(type) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
    document.getElementById('form-login').style.display = type === 'login' ? 'flex' : 'none';
    document.getElementById('form-register').style.display = type === 'register' ? 'flex' : 'none';
    document.getElementById('auth-msg').innerText = '';
}

window.handleRegistration = async function() {
    const id = document.getElementById('reg-id').value.trim().toLowerCase();
    const name = document.getElementById('reg-name').value.trim();
    const number = document.getElementById('reg-number').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const msg = document.getElementById('auth-msg');

    if(!id || !name || !number || !pass) { msg.innerText = "Error: Complete all diagnostic fields."; return; }

    try {
        const docRef = doc(dbFS, "f1_trackers", id);
        const docSnap = await getDoc(docRef);
        
        if(docSnap.exists()) { msg.innerText = "Error: Driver ID already claimed on grid."; return; }

        driverData = {
            passcode: pass, activeTeam: 'audi', name: name, number: number,
            weeklyGoal: '', monthlyGoal: '', habits: [], archive: {}, lastMonthKey: monthKey
        };

        await setDoc(docRef, driverData);
        loginUserSuccess(id);
    } catch(e) { msg.innerText = "Connection lost during registration."; }
}

window.handleLogin = async function() {
    const id = document.getElementById('login-id').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value.trim();
    const msg = document.getElementById('auth-msg');

    if(!id || !pass) { msg.innerText = "Enter ID and passcode."; return; }

    try {
        const docSnap = await getDoc(doc(dbFS, "f1_trackers", id));
        if(!docSnap.exists()) { msg.innerText = "Driver signature not found."; return; }
        
        const data = docSnap.data();
        if(data.passcode !== pass) { msg.innerText = "Authentication failed: Invalid Passcode."; return; }

        loginUserSuccess(id);
    } catch(e) { msg.innerText = "Database connection error."; }
}

function loginUserSuccess(id) {
    currentUserId = id;
    viewedUserId = id;
    localStorage.setItem('f1_auth_uid', id);
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'flex';
    
    if(currentUserId === 'admin') {
        document.getElementById('admin-panel-btn').style.display = 'block';
    } else {
        document.getElementById('admin-panel-btn').style.display = 'none';
    }

    setupLiveSync(id);
    loadGlobalRoster();
}

window.handleLogout = function() {
    currentUserId = null; viewedUserId = null;
    localStorage.removeItem('f1_auth_uid');
    if(unsubscribeDriverDoc) unsubscribeDriverDoc();
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('auth-gate').style.display = 'block';
    document.getElementById('login-id').value = '';
    document.getElementById('login-pass').value = '';
}

// --- TELEMETRY ENGINE MECHANICS ---
let unsubscribeDriverDoc = null;
function setupLiveSync(driverIdToWatch) {
    if (unsubscribeDriverDoc) unsubscribeDriverDoc();

    unsubscribeDriverDoc = onSnapshot(doc(dbFS, "f1_trackers", driverIdToWatch), (docSnap) => {
        if (docSnap.exists()) {
            const incoming = docSnap.data();
            driverData = {
                passcode: incoming.passcode || '',
                activeTeam: incoming.activeTeam || 'audi',
                name: incoming.name || '',
                number: incoming.number || '',
                weeklyGoal: incoming.weeklyGoal || '',
                monthlyGoal: incoming.monthlyGoal || '',
                habits: incoming.habits || [],
                archive: incoming.archive || {},
                lastMonthKey: incoming.lastMonthKey || monthKey
            };
            
            if (viewedUserId === currentUserId && driverData.lastMonthKey !== monthKey) {
                driverData.archive[driverData.lastMonthKey] = JSON.parse(JSON.stringify(driverData.habits));
                driverData.habits.forEach(h => h.doneDays = Array(31).fill(false)); 
                driverData.lastMonthKey = monthKey;
                pushDataToCloud();
            }
            updateThemeAndUI();
            renderTable();
        }
    });
}

async function loadGlobalRoster() {
    const querySnapshot = await getDocs(collection(dbFS, "f1_trackers"));
    let list = [currentUserId];
    querySnapshot.forEach((doc) => { if(doc.id && doc.id.trim() !== "") list.push(doc.id); });
    globalRoster = [...new Set(list)];
    
    const dropdown = document.getElementById('driver-roster-select');
    dropdown.innerHTML = globalRoster.map(id => `<option value="${id}" ${id === viewedUserId ? 'selected' : ''}>${id} ${id === currentUserId ? '(You)' : ''}</option>`).join('');
}

async function pushDataToCloud() {
    if (viewedUserId !== currentUserId) return;
    await setDoc(doc(dbFS, "f1_trackers", currentUserId), driverData);
}

window.switchViewedDriver = function() {
    viewedUserId = document.getElementById('driver-roster-select').value;
    const isReadonly = viewedUserId !== currentUserId;
    document.getElementById('add-habit-btn').style.display = isReadonly ? 'none' : 'block';
    document.getElementById('weekly-goal').disabled = isReadonly;
    document.getElementById('monthly-goal').disabled = isReadonly;
    document.getElementById('danger-zone-panel').style.display = isReadonly ? 'none' : 'block';
    setupLiveSync(viewedUserId);
}

window.handleUIProfileUpdate = function() {
    if(viewedUserId !== currentUserId) return;
    driverData.weeklyGoal = document.getElementById('weekly-goal').value;
    driverData.monthlyGoal = document.getElementById('monthly-goal').value;
    pushDataToCloud();
}

window.syncCloudData = function() { loadGlobalRoster(); }

function updateThemeAndUI() {
    const teamKey = driverData.activeTeam || 'audi';
    document.documentElement.style.setProperty('--active-color', teamData[teamKey].color);
    document.body.className = `theme-${teamKey}`;
    document.getElementById('bg-container').innerHTML = teamData[teamKey].svg;
    document.getElementById('telemetry-header').innerText = `${teamKey === 'audi' ? 'Audi' : 'McLaren'} F1 Telemetry`;
    
    document.getElementById('badge-team-name').innerText = teamKey === 'audi' ? 'AUDI F1' : 'MCLAREN';
    document.getElementById('badge-driver-name').innerText = driverData.name || '--';
    document.getElementById('badge-driver-num').innerText = driverData.number || '--';
    
    document.getElementById('weekly-goal').value = driverData.weeklyGoal || '';
    document.getElementById('monthly-goal').value = driverData.monthlyGoal || '';
    document.getElementById('quote-box').innerHTML = `"Leave me alone, I know what to do."<br><span style="font-size:0.4em; color:var(--active-color); display:block; margin-top:10px; font-weight:bold; letter-spacing:1px;">- Kimi Räikkönen</span>`;
}

function renderTable() {
    const headerRow = document.getElementById('table-header-row');
    if (!headerRow) return;
    
    let headerHTML = `<th class="habit-name">Sector (Habit)</th><th class="plan-col">Target Plan</th>`;
    for(let i=1; i<=daysInMonth; i++) headerHTML += `<th class="day-col">${i}</th>`;
    headerHTML += `<th class="stats-col">Race Pace</th><th class="pts-col">Points</th>`;
    headerRow.innerHTML = headerHTML;

    const tbody = document.getElementById('habit-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const habitsList = driverData.habits || [];
    const isReadonly = viewedUserId !== currentUserId;

    habitsList.forEach((habit, hIndex) => {
        const tr = document.createElement('tr');
        let plannedCount = 0, completedCountInPlanned = 0, totalCompleted = 0, monthCellsHTML = '';
        
        for(let d=1; d<=daysInMonth; d++) {
            let date = new Date(currentYear, currentMonth, d);
            let uiDay = (date.getDay() === 0 ? 6 : date.getDay() - 1);
            let isPlanned = habit.plannedDaysOfWeek[uiDay] || false;
            let isDone = habit.doneDays[d-1] || false;
            
            if (isPlanned) plannedCount++;
            if (isDone) { totalCompleted++; if (isPlanned) completedCountInPlanned++; }
            
            let cellClass = isPlanned ? 'day-cell is-planned-cell' : 'day-cell';
            monthCellsHTML += `<td class="${cellClass}"><input type="checkbox" ${isDone ? 'checked' : ''} ${isReadonly ? 'disabled' : ''} onchange="window.updateHabitCheckbox(${hIndex}, ${d-1}, this.checked)"></td>`;
        }

        let percent = plannedCount > 0 ? Math.floor((completedCountInPlanned / plannedCount) * 100) : 0;
        let basePts = 0; let pos = "DNF"; let posColor = "#ff4c4c";
        if (plannedCount > 0) {
            if (percent >= 90) { basePts = 5; pos = "P1"; posColor = "#00cc00"; }
            else if (percent >= 80) { basePts = 4; pos = "P2"; posColor = "#32cd32"; }
            else if (percent >= 70) { basePts = 3; pos = "P3"; posColor = "#9acd32"; }
            else if (percent >= 60) { basePts = 2; pos = "P4"; posColor = "#ffd700"; }
            else if (percent >= 50) { basePts = 1; pos = "P5"; posColor = "#ffa500"; }
        }

        let bonus = totalCompleted - completedCountInPlanned;
        let ptsDisplay = (basePts + bonus) + (bonus > 0 ? ` <span style="font-size:0.6em; color:#00ff00;">(+${bonus})</span>` : '');

        let plannedHTML = '<div class="planned-days">';
        ['M','T','W','T','F','S','S'].forEach((dayText, i) => {
            plannedHTML += `<div class="day-toggle ${habit.plannedDaysOfWeek[i] ? 'active' : ''}" style="${isReadonly ? 'pointer-events:none;' : ''}" onclick="window.togglePlannedDay(${hIndex}, ${i})">${dayText}</div>`;
        });
        plannedHTML += '</div>';

        tr.innerHTML = `
            <td class="habit-name">
                <input type="text" value="${habit.name || ''}" ${isReadonly ? 'disabled' : ''} onchange="window.updateHabitName(${hIndex}, this.value)" placeholder="Enter habit...">
                ${!isReadonly ? `<span class="del-btn" onclick="window.deleteHabit(${hIndex})">🗑️</span>` : ''}
            </td>
            <td>${plannedHTML}</td>
            ${monthCellsHTML}
            <td class="stats-col" style="color: ${posColor}">
                ${pos} (${percent}%)
                <div class="progress-track"><div class="progress-fill" style="width:${percent}%; background: ${posColor}"></div></div>
            </td>
            <td class="pts-col">${ptsDisplay}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateHabitCheckbox = function(hIndex, dayIndex, isChecked) {
    driverData.habits[hIndex].doneDays[dayIndex] = isChecked;
    pushDataToCloud();
};

window.togglePlannedDay = function(hIndex, dayIndex) {
    driverData.habits[hIndex].plannedDaysOfWeek[dayIndex] = !driverData.habits[hIndex].plannedDaysOfWeek[dayIndex];
    pushDataToCloud();
};

window.updateHabitName = function(hIndex, value) {
    driverData.habits[hIndex].name = value;
    pushDataToCloud();
};

window.deleteHabit = function(hIndex) {
    driverData.habits.splice(hIndex, 1);
    pushDataToCloud();
};

window.addHabit = function() {
    if (viewedUserId !== currentUserId) return;
    if (!driverData.habits) driverData.habits = [];
    driverData.habits.push({ name: '', plannedDaysOfWeek: [false,false,false,false,false,false,false], doneDays: Array(31).fill(false) });
    pushDataToCloud();
}

window.toggleArchiveView = function() {
    const mainView = document.getElementById('main-view');
    const archView = document.getElementById('archive-view');
    const adminView = document.getElementById('admin-view');
    adminView.style.display = 'none';
    if (mainView.style.display === 'none') {
        mainView.style.display = 'block'; archView.style.display = 'none';
    } else {
        mainView.style.display = 'none'; archView.style.display = 'block';
        renderArchive();
    }
}

// --- DATA EXPORT BACKUP ENGINE ---
window.downloadDriverTelemetry = function() {
    if (!currentUserId || viewedUserId !== currentUserId) return;
    
    const exportPackage = {
        driverId: currentUserId,
        meta: {
            exportedAt: new Date().toISOString(),
            driverName: driverData.name || 'Anonymous',
            racingNumber: driverData.number || '--'
        },
        telemetry: {
            currentHabits: driverData.habits || [],
            monthlyGoals: { weekly: driverData.weeklyGoal, monthly: driverData.monthlyGoal },
            historicalArchive: driverData.archive || {}
        }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPackage, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `f1_telemetry_${currentUserId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
};

// --- DESTRUCTION CRITICAL ACCOUNT ERASURE ENGINE ---
window.deleteDriverAccount = async function() {
    if (!currentUserId || viewedUserId !== currentUserId) return;

    const firstCheck = confirm("🚨 RED FLAG: Are you sure you want to delete your profile? This permanently clears your telemetry history off the cloud!");
    if (!firstCheck) return;

    const finalCheck = confirm("🏁 FINAL CONFIRMATION: Did you remember to download your telemetry backup? Press OK to wipe this record forever.");
    if (!finalCheck) return;

    try {
        await deleteDoc(doc(dbFS, "f1_trackers", currentUserId));
        handleLogout();
        alert("Account purged successfully. Grid slot cleared.");
    } catch (e) {
        console.error("Account erasure failed: ", e);
        alert("Error: Paddock server rejected data erasure request.");
    }
};

// --- ADMINISTRATIVE RACE CONTROL PANEL MATRIX ---
window.toggleAdminPanelSection = async function() {
    const mainView = document.getElementById('main-view');
    const archView = document.getElementById('archive-view');
    const adminView = document.getElementById('admin-view');
    archView.style.display = 'none';

    if (adminView.style.display === 'block') {
        adminView.style.display = 'none';
        mainView.style.display = 'block';
    } else {
        mainView.style.display = 'none';
        adminView.style.display = 'block';
        
        const rosterBody = document.getElementById('admin-roster-body');
        rosterBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#ffcc00;">Polling Grid Telemetry Records...</td></tr>`;
        
        try {
            const querySnapshot = await getDocs(collection(dbFS, "f1_trackers"));
            let html = "";
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const driverID = docSnap.id;
                const dName = data.name || '<span style="color:#666;">No Profile Display Name</span>';
                const dNum = data.number || '--';
                const dPass = data.passcode || '<span style="color:#ff4c4c;">None Set</span>';
                const sectorCount = data.habits ? data.habits.length : 0;
                
                html += `
                    <tr>
                        <td style="font-family:monospace; font-weight:bold; color:var(--active-color);">${driverID}</td>
                        <td>${dName}</td>
                        <td style="font-weight:bold;">#${dNum}</td>
                        <td style="font-family:monospace; color:#00ff00;">${dPass}</td>
                        <td>${sectorCount} Sectors</td>
                    </tr>
                `;
            });
            rosterBody.innerHTML = html;
        } catch(e) {
            rosterBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Race Control feed lost: Security query denied.</td></tr>`;
        }
    }
}

function renderArchive() {
    const list = document.getElementById('archive-list');
    let driverDisplay = driverData.name ? driverData.name : `${viewedUserId}`;
    document.getElementById('archive-driver-display').innerText = `Data for ${driverDisplay}`;
    
    if (!driverData.archive || Object.keys(driverData.archive).length === 0) {
        list.innerHTML = "<p style='text-align:center; color:#888;'>No past performances recorded yet.</p>";
        return;
    }
    
    let html = '';
    for (const [key, oldHabits] of Object.entries(driverData.archive)) {
        html += `<div class="archive-data"><h3>🏎️ ${key}</h3><ul>`;
        oldHabits.forEach(h => {
            if (h.name && h.name.trim() !== '') {
                let totalDone = (h.doneDays || []).filter(Boolean).length;
                html += `<li><strong>${h.name}</strong>: Completed ${totalDone} laps.</li>`;
            }
        });
        html += `</ul></div>`;
    }
    list.innerHTML = html;
}

if(currentUserId) { loginUserSuccess(currentUserId); }
else { document.getElementById('auth-gate').style.display = 'block'; }