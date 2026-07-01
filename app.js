import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

// Your verified web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB67J0LX09zOUENtnUw_n5JJLDV7OQb7xg",
    authDomain: "pitstop-tracker-1.firebaseapp.com",
    projectId: "pitstop-tracker-1",
    storageBucket: "pitstop-tracker-1.firebasestorage.app",
    messagingSenderId: "497933964321",
    appId: "1:497933964321:web:9ae8916a5b2a9ae328bf60",
    measurementId: "G-MNKKS9VZE8"
};

// Initialize Firebase Core Engine Services
const app = initializeApp(firebaseConfig);
const dbFS = getFirestore(app);
const analytics = getAnalytics(app);

// Core Architecture Context Variables
let currentUserId = localStorage.getItem('f1_driver_uid') || "driver1";
let viewedUserId = currentUserId; 
let globalRoster = [currentUserId];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKey = `${currentYear}-${monthNames[currentMonth]}`;
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

let driverData = {
    activeTeam: 'audi',
    name: '', number: '', weeklyGoal: '', monthlyGoal: '', 
    habits: [], archive: {}, lastMonthKey: monthKey
};

// SVG Assets
const teamData = {
    audi: { color: 'var(--audi-red)', svg: `<svg viewBox="0 0 350 150" class="background-rings"><circle cx="75" cy="75" r="50"/><circle cx="140" cy="75" r="50"/><circle cx="205" cy="75" r="50"/><circle cx="270" cy="75" r="50"/></svg>` },
    mclaren: { color: 'var(--mclaren-orange)', svg: `<svg viewBox="0 0 350 150" class="background-rings"><path d="M 30,120 C 120,40 240,20 320,60 C 350,90 280,140 230,110 C 180,90 100,90 30,120 Z" /></svg>` }
};

// Initialization Setup Hook bounds
document.getElementById('my-driver-id').value = currentUserId;
document.getElementById('month-display').innerText = `${monthNames[currentMonth]} ${currentYear} TRACK`;

// World Race Clocks Engine Tracker
function updateClocks() {
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    document.getElementById('tz-blr').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Asia/Kolkata' }).format(now);
    document.getElementById('tz-hin').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Zurich' }).format(now);
    document.getElementById('tz-lon').innerText = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/London' }).format(now);
}
setInterval(updateClocks, 1000); updateClocks();

// Subscription management
let unsubscribeDriverDoc = null;
function setupLiveSync(driverIdToWatch) {
    if (unsubscribeDriverDoc) unsubscribeDriverDoc();

    unsubscribeDriverDoc = onSnapshot(doc(dbFS, "f1_trackers", driverIdToWatch), (docSnap) => {
        if (docSnap.exists()) {
            driverData = docSnap.data();
            
            if (driverData.lastMonthKey && driverData.lastMonthKey !== monthKey) {
                if(!driverData.archive) driverData.archive = {};
                driverData.archive[driverData.lastMonthKey] = JSON.parse(JSON.stringify(driverData.habits));
                driverData.habits.forEach(h => h.doneDays = Array(31).fill(false)); 
                driverData.lastMonthKey = monthKey;
                pushDataToCloud();
            }
        } else {
            if(driverIdToWatch === currentUserId) {
                driverData = {
                    activeTeam: 'audi', name: '', number: '', weeklyGoal: '', monthlyGoal: '', 
                    habits: [{ name: 'Morning Warmup Run', plannedDaysOfWeek: [true,true,true,true,true,false,false], doneDays: Array(31).fill(false) }], 
                    archive: {}, lastMonthKey: monthKey
                };
                pushDataToCloud();
            }
        }
        updateThemeAndUI();
        renderTable();
    });
}

async function loadGlobalRoster() {
    const querySnapshot = await getDocs(collection(dbFS, "f1_trackers"));
    let list = [currentUserId];
    querySnapshot.forEach((doc) => {
        if(doc.id !== currentUserId) list.push(doc.id);
    });
    globalRoster = [...new Set(list)];
    
    const dropdown = document.getElementById('driver-roster-select');
    dropdown.innerHTML = globalRoster.map(id => `<option value="${id}" ${id === viewedUserId ? 'selected' : ''}>${id} ${id === currentUserId ? '(You)' : ''}</option>`).join('');
}

async function pushDataToCloud() {
    if (viewedUserId !== currentUserId) return;
    await setDoc(doc(dbFS, "f1_trackers", currentUserId), driverData);
}

window.updateYourID = function() {
    const val = document.getElementById('my-driver-id').value.trim().toLowerCase();
    if(val) {
        currentUserId = val;
        localStorage.setItem('f1_driver_uid', currentUserId);
        viewedUserId = currentUserId;
        setupLiveSync(currentUserId);
        loadGlobalRoster();
    }
}

window.switchViewedDriver = function() {
    viewedUserId = document.getElementById('driver-roster-select').value;
    const isReadonly = viewedUserId !== currentUserId;
    document.getElementById('add-habit-btn').style.display = isReadonly ? 'none' : 'block';
    document.getElementById('driver-name').disabled = isReadonly;
    document.getElementById('driver-number').disabled = isReadonly;
    document.getElementById('team-select').disabled = isReadonly;
    document.getElementById('weekly-goal').disabled = isReadonly;
    document.getElementById('monthly-goal').disabled = isReadonly;

    setupLiveSync(viewedUserId);
}

window.handleUIProfileUpdate = function() {
    if(viewedUserId !== currentUserId) return;
    driverData.activeTeam = document.getElementById('team-select').value;
    driverData.name = document.getElementById('driver-name').value;
    driverData.number = document.getElementById('driver-number').value;
    driverData.weeklyGoal = document.getElementById('weekly-goal').value;
    driverData.monthlyGoal = document.getElementById('monthly-goal').value;
    pushDataToCloud();
}

window.syncCloudData = function() {
    pushDataToCloud();
    loadGlobalRoster();
}

function updateThemeAndUI() {
    const teamKey = driverData.activeTeam || 'audi';
    document.documentElement.style.setProperty('--active-color', teamData[teamKey].color);
    document.body.className = `theme-${teamKey}`;
    document.getElementById('bg-container').innerHTML = teamData[teamKey].svg;
    document.getElementById('telemetry-header').innerText = `${teamKey === 'audi' ? 'Audi' : 'McLaren'} F1 Telemetry`;
    
    document.getElementById('team-select').value = teamKey;
    document.getElementById('driver-name').value = driverData.name || '';
    document.getElementById('driver-number').value = driverData.number || '';
    document.getElementById('weekly-goal').value = driverData.weeklyGoal || '';
    document.getElementById('monthly-goal').value = driverData.monthlyGoal || '';
    
    document.getElementById('quote-box').innerHTML = `"Leave me alone, I know what to do."<br><span style="font-size:0.4em; color:var(--active-color); display:block; margin-top:10px; font-weight:bold; letter-spacing:1px;">- Kimi Räikkönen</span>`;
}

function renderTable() {
    const headerRow = document.getElementById('table-header-row');
    let headerHTML = `<th class="habit-name">Sector (Habit)</th><th class="plan-col">Target Plan</th>`;
    for(let i=1; i<=daysInMonth; i++) headerHTML += `<th class="day-col">${i}</th>`;
    headerHTML += `<th class="stats-col">Race Pace</th><th class="pts-col">Points</th>`;
    headerRow.innerHTML = headerHTML;

    const tbody = document.getElementById('habit-body');
    tbody.innerHTML = '';
    
    if(!driverData.habits) driverData.habits = [];
    const isReadonly = viewedUserId !== currentUserId;

    driverData.habits.forEach((habit, hIndex) => {
        const tr = document.createElement('tr');
        let plannedCount = 0, completedCountInPlanned = 0, totalCompleted = 0, monthCellsHTML = '';
        
        for(let d=1; d<=daysInMonth; d++) {
            let date = new Date(currentYear, currentMonth, d);
            let uiDay = (date.getDay() === 0 ? 6 : date.getDay() - 1);
            let isPlanned = habit.plannedDaysOfWeek[uiDay];
            let isDone = habit.doneDays[d-1];
            
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

        let plannedHTML = '<div class="planned-days flex justify-center gap-1">';
        ['M','T','W','T','F','S','S'].forEach((dayText, i) => {
            plannedHTML += `<div class="day-toggle w-5 h-5 rounded-full border border-[#666] flex items-center justify-center text-[0.75rem] text-[#aaa] cursor-pointer transition-all duration-200 ${habit.plannedDaysOfWeek[i] ? 'bg-[var(--active-color)] text-white border-[var(--active-color)] font-bold active' : ''}" style="${isReadonly ? 'pointer-events:none;' : ''}" onclick="window.togglePlannedDay(${hIndex}, ${i})">${dayText}</div>`;
        });
        plannedHTML += '</div>';

        tr.innerHTML = `
            <td class="habit-name">
                <input type="text" value="${habit.name}" ${isReadonly ? 'disabled' : ''} onchange="window.updateHabitName(${hIndex}, this.value)" placeholder="Enter habit..." class="w-[80%] bg-transparent text-white border border-[#555] p-2 rounded">
                ${!isReadonly ? `<span class="del-btn cursor-pointer text-[var(--active-color)] ml-2 font-bold text-lg" onclick="window.deleteHabit(${hIndex})">🗑️</span>` : ''}
            </td>
            <td>${plannedHTML}</td>
            ${monthCellsHTML}
            <td class="stats-col font-bold min-w-[120px]" style="color: ${posColor}">
                ${pos} (${percent}%)
                <div class="progress-track w-full h-2 bg-[#222] rounded relative mt-1"><div class="progress-fill h-full rounded transition-[width] duration-400 ease-in-out" style="width:${percent}%; background: ${posColor}"></div></div>
            </td>
            <td class="pts-col min-w-[80px] text-xl font-bold text-white">${ptsDisplay}</td>
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
    driverData.habits.push({ name: '', plannedDaysOfWeek: [false,false,false,false,false,false,false], doneDays: Array(31).fill(false) });
    pushDataToCloud();
}

window.toggleArchiveView = function() {
    const mainView = document.getElementById('main-view');
    const archView = document.getElementById('archive-view');
    if (mainView.classList.contains('hidden')) {
        mainView.classList.remove('hidden'); mainView.classList.add('block');
        archView.classList.remove('block'); archView.classList.add('hidden');
    } else {
        mainView.classList.remove('block'); mainView.classList.add('hidden');
        archView.classList.remove('hidden'); archView.classList.add('block');
        renderArchive();
    }
}

function renderArchive() {
    const list = document.getElementById('archive-list');
    let driverDisplay = driverData.name ? driverData.name : `${viewedUserId}`;
    document.getElementById('archive-driver-display').innerText = `Data for ${driverDisplay}`;
    
    if (!driverData.archive || Object.keys(driverData.archive).length === 0) {
        list.innerHTML = "<p class='text-center text-[#888]'>No past performances recorded yet.</p>";
        return;
    }
    
    let html = '';
    for (const [key, oldHabits] of Object.entries(driverData.archive)) {
        html += `<div class="archive-data"><h3>🏎️ ${key}</h3><ul>`;
        oldHabits.forEach(h => {
            if (h.name.trim() !== '') {
                let totalDone = h.doneDays.filter(Boolean).length;
                html += `<li><strong>${h.name}</strong>: Completed ${totalDone} laps.</li>`;
            }
        });
        html += `</ul></div>`;
    }
    list.innerHTML = html;
}

// Initialize Global Engine Bounds
setupLiveSync(currentUserId);
loadGlobalRoster();