import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
const firebaseConfig = {
    apiKey: "AIzaSyCY2KAkDat-AwUJzf4aeqIxMAX80Tb5PUI",
    authDomain: "pitstop-tracker-3.firebaseapp.com",
    projectId: "pitstop-tracker-3",
    storageBucket: "pitstop-tracker-3.firebasestorage.app",
    messagingSenderId: "668134386135",
    appId: "1:668134386135:web:493d503718860350d78392"
};

const app = initializeApp(firebaseConfig);
const dbFS = getFirestore(app);

let currentUserId = localStorage.getItem('f1_auth_uid') || null;
let viewedUserId = currentUserId; 
let globalRoster = [];
let unsubscribeDriverDoc = null;
let adminLoadedDriverId = null;

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKey = `${currentYear}-${monthNames[currentMonth]}`;
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

let driverData = {
    passcode: '', activeTheme: 'fia', name: '', number: '', 
    habits: [], archive: {}, historicalPoints: {}, lastMonthKey: monthKey
};

const teamMetadata = {
    fia: { name: "FIA Control" },
    redbull: { name: "Oracle Red Bull Racing" },
    ferrari: { name: "Scuderia Ferrari" },
    mclaren: { name: "McLaren Formula 1 Team" },
    mercedes: { name: "Mercedes-AMG Petronas F1 Team" },
    aston: { name: "Aston Martin Aramco F1 Team" },
    alpine: { name: "Alpine F1 Team" },
    williams: { name: "Williams Racing" },
    haas: { name: "Haas F1 Team" },
    rb: { name: "Visa Cash App RB (VCARB)" },
    audi: { name: "Audi F1 Team" },
    cadillac: { name: "Cadillac F1 Team" }
};

const teamLogos = {
    fia: '<img src="assets/fia.png" class="team-bg-img">',
    redbull: '<img src="assets/redbull.png" class="team-bg-img">',
    ferrari: '<img src="assets/ferrari.png" class="team-bg-img">',
    mclaren: '<img src="assets/mclaren.png" class="team-bg-img">',
    mercedes: '<img src="assets/mercedes.png" class="team-bg-img">',
    aston: '<img src="assets/aston.png" class="team-bg-img">',
    alpine: '<img src="assets/alpine.png" class="team-bg-img">',
    williams: '<img src="assets/williams.png" class="team-bg-img">',
    haas: '<img src="assets/haas.png" class="team-bg-img">',
    rb: '<img src="assets/rb.png" class="team-bg-img">',
    audi: '<img src="assets/audi.png" class="team-bg-img">',
    cadillac: '<img src="assets/cadillac.png" class="team-bg-img">'
};

const quotesPool = [
    { text: "Leave me alone, I know what to do.", author: "Kimi Räikkönen", country: "Abu Dhabi", year: 2012 },
    { text: "If you no longer go for a gap that exists, you are no longer a racing driver.", author: "Ayrton Senna", country: "Japan", year: 1990 },
    { text: "Everyone is a Ferrari fan. Even if they say they are not, they are Ferrari fans.", author: "Sebastian Vettel", country: "Canada", year: 2016 },
    { text: "To finish first, first you have to finish.", author: "Michael Schumacher", country: "Various", year: "Pre-2000s" },
    { text: "GP2 engine, GP2! ARGH!", author: "Fernando Alonso", country: "Japan", year: 2015 },
    { text: "I am stupid. I am stupid.", author: "Charles Leclerc", country: "Azerbaijan", year: 2019 },
    { text: "What did we just do!? We won the fucking race!", author: "Pierre Gasly", country: "Italy", year: 2020 },
    { text: "Bono, my tyres are dead.", author: "Lewis Hamilton", country: "Monaco", year: 2019 },
    { text: "I never left.", author: "Daniel Ricciardo", country: "Italy", year: 2021 },
    { text: "Multi 21, Seb, Multi 21.", author: "Mark Webber", country: "Malaysia", year: 2013 },
    { text: "No, no, Michael, no, no, that was so not right!", author: "Toto Wolff", country: "Abu Dhabi", year: 2021 },
    { text: "Smooth operator.", author: "Carlos Sainz", country: "Britain", year: 2019 },
    { text: "Bwoah.", author: "Kimi Räikkönen", country: "Global", year: "Always" },
    { text: "Simply lovely.", author: "Max Verstappen", country: "Various", year: "2020-2023" }
];

document.getElementById('month-display').innerText = `${monthNames[currentMonth]} ${currentYear} SECTOR MAP`;

function rotateQuote() {
    const selected = quotesPool[Math.floor(Math.random() * quotesPool.length)];
    document.getElementById('quote-box').innerHTML = `"${selected.text}"<br><span style="font-size:0.85em; display:block; margin-top:10px; font-weight:bold; letter-spacing:1px; color: var(--primary-accent);">- ${selected.author} (${selected.country}, ${selected.year})</span>`;
}
rotateQuote(); setInterval(rotateQuote, 15000);

function updateLocalClockFeed() {
    const clockEl = document.getElementById('local-telemetry-clock');
    if (!clockEl) return;
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    clockEl.innerText = `${now.toLocaleTimeString('en-US', { hour12: false })} • ${days[now.getDay()]} ${now.toLocaleDateString('en-US')}`;
}
setInterval(updateLocalClockFeed, 1000); updateLocalClockFeed();

window.updateNavButtons = function() {
    const main = document.getElementById('main-view');
    const btnMain = document.getElementById('nav-btn-main');
    if (btnMain && main) {
        btnMain.style.display = (main.style.display === 'none') ? 'block' : 'none';
    }
}
window.updateThemeAndUI = function() {
    // We use viewedUserId's data to decide which theme to show
    // If we are looking at an archive, we are using driverData, which is updated to the viewed driver's profile
    const themeKey = driverData.activeTheme || 'fia';
    document.body.setAttribute('data-theme', themeKey);
    
    const bgContainer = document.getElementById('bg-glow-hub-container');
    if (bgContainer) {
        bgContainer.innerHTML = teamLogos[themeKey] || teamLogos['fia'];
    }

    document.getElementById('badge-driver-name').innerText = driverData.name || '--';
    document.getElementById('badge-driver-num').innerText = driverData.number || '--';
}

window.handleLogout = function() {
    currentUserId = null; viewedUserId = null;
    localStorage.removeItem('f1_auth_uid');
    if(unsubscribeDriverDoc) unsubscribeDriverDoc();
    
    // Reset Views
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    
    // Clear background and reset to FIA
    document.getElementById('bg-glow-hub-container').innerHTML = teamLogos['fia'];
    
    document.getElementById('auth-gate').style.display = 'block';
    clearAuthFields();
    switchAuthTab('login');
    document.body.setAttribute('data-theme', 'fia');
    updateNavButtons();
}

window.returnToMainView = function() {
    closeMobileMenu();
    document.getElementById('standings-view').style.display = 'none';
    document.getElementById('archive-view').style.display = 'none';
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    updateNavButtons();
}

window.toggleMobileMenu = function() {
    const navHub = document.getElementById('mobile-nav-links-wrapper');
    const backdrop = document.getElementById('mobile-menu-backdrop');
    navHub.classList.toggle('nav-menu-active');
    if(backdrop) backdrop.classList.toggle('active');
}

window.closeMobileMenu = function() {
    const navHub = document.getElementById('mobile-nav-links-wrapper');
    const backdrop = document.getElementById('mobile-menu-backdrop');
    navHub.classList.remove('nav-menu-active');
    if(backdrop) backdrop.classList.remove('active');
}

window.previewRegistrationTheme = function(teamKey) {
    document.body.setAttribute('data-theme', teamKey);
    const bgContainer = document.getElementById('bg-glow-hub-container');
    if (bgContainer) bgContainer.innerHTML = teamLogos[teamKey] || '';
}

function displayAuthError(message, isSuccess = false) {
    const errorBox = document.getElementById('auth-msg');
    if (errorBox) { 
        errorBox.innerText = message || ''; 
        errorBox.style.display = message ? 'block' : 'none'; 
        errorBox.style.color = isSuccess ? '#00cc00' : '#ff4c4c'; 
    }
}

function clearAuthFields() {
    const inputs = ['login-id', 'login-pass', 'reg-id', 'reg-name', 'reg-number', 'reg-pass'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const teamDropdown = document.getElementById('reg-team');
    if (teamDropdown) teamDropdown.value = 'fia';
}

window.switchAuthTab = function(type) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');
    document.getElementById('form-login').style.display = type === 'login' ? 'flex' : 'none';
    document.getElementById('form-register').style.display = type === 'register' ? 'flex' : 'none';
    displayAuthError(null); 
    if(type === 'login') {
        document.body.setAttribute('data-theme', 'fia');
        const bgContainer = document.getElementById('bg-glow-hub-container');
        if (bgContainer) bgContainer.innerHTML = teamLogos['fia'];
    } else {
        window.previewRegistrationTheme(document.getElementById('reg-team').value);
    }
}

window.handleRegistration = async function() {
    const id = document.getElementById('reg-id').value.trim().toLowerCase();
    const name = document.getElementById('reg-name').value.trim();
    const number = document.getElementById('reg-number').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const selectedTeam = document.getElementById('reg-team').value;

    if(!id || !name || !number || !pass) { displayAuthError("⚠️ Complete all fields."); return; }
    if (id === 'admin' && selectedTeam !== 'fia') { displayAuthError("❌ Admin restricted to FIA Control."); return; }
    if (selectedTeam === 'fia' && id !== 'admin') { displayAuthError("❌ FIA restricted to admin."); return; }

    try {
        const rosterSnap = await getDocs(collection(dbFS, "public_roster"));
        let teamTaken = false;
        rosterSnap.forEach((doc) => { if(doc.data().team === selectedTeam && doc.id !== id) teamTaken = true; });
        if(teamTaken) { displayAuthError(`❌ Grid conflict: ${teamMetadata[selectedTeam].name} occupied!`); return; }

        const docRef = doc(dbFS, "f1_trackers", id);
        const docSnap = await getDoc(docRef);
        if(docSnap.exists()) { displayAuthError("❌ Driver ID already taken."); return; }

        driverData = {
            passcode: pass, activeTheme: selectedTeam, name: name, number: number,
            habits: [], archive: {}, historicalPoints: {}, lastMonthKey: monthKey
        };

        await setDoc(docRef, driverData);
        await setDoc(doc(dbFS, "public_roster", id), { name: name, number: number, team: selectedTeam });
        
        clearAuthFields();
        switchAuthTab('login');
        displayAuthError("✅ Grid slot secured! You may now login.", true);
    } catch(e) { displayAuthError("💥 Database connection error."); }
}

window.handleLogin = async function() {
    const id = document.getElementById('login-id').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value.trim();
    if(!id || !pass) { displayAuthError("⚠️ Enter Driver ID and Passcode."); return; }

    try {
        const docSnap = await getDoc(doc(dbFS, "f1_trackers", id));
        if(!docSnap.exists()) { displayAuthError("❌ Driver not found."); return; }
        
        const data = docSnap.data();
        if(data.passcode !== pass) { displayAuthError("❌ Incorrect password."); return; }
        
        loginUserSuccess(id);
    } catch(e) { displayAuthError("💥 Database connection error."); }
}

function loginUserSuccess(id) {
    currentUserId = id; viewedUserId = id;
    localStorage.setItem('f1_auth_uid', id);
    document.getElementById('auth-gate').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'flex';
    document.getElementById('admin-panel-btn').style.display = currentUserId === 'admin' ? 'block' : 'none';

    clearAuthFields();
    setupLiveSync(id);
    loadGlobalRoster();
    updateNavButtons();
}

window.handleLogout = function() {
    currentUserId = null; viewedUserId = null;
    localStorage.removeItem('f1_auth_uid');
    if(unsubscribeDriverDoc) unsubscribeDriverDoc();
    
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('main-view').style.display = 'block';
    document.getElementById('standings-view').style.display = 'none';
    document.getElementById('archive-view').style.display = 'none';
    
    document.getElementById('auth-gate').style.display = 'block';
    clearAuthFields();
    switchAuthTab('login');
    document.body.setAttribute('data-theme', 'fia');
    updateNavButtons();
}

function setupLiveSync(driverIdToWatch) {
    if (unsubscribeDriverDoc) unsubscribeDriverDoc();

    unsubscribeDriverDoc = onSnapshot(doc(dbFS, "f1_trackers", driverIdToWatch), (docSnap) => {
        if (docSnap.exists()) {
            const incoming = docSnap.data();
            driverData = {
                passcode: incoming.passcode || '',
                activeTheme: incoming.activeTheme || 'fia',
                name: incoming.name || '',
                number: incoming.number || '',
                habits: incoming.habits || [],
                archive: incoming.archive || {},
                historicalPoints: incoming.historicalPoints || {},
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
            if(document.getElementById('archive-view').style.display === 'block') renderArchive();
        }
    });
}

async function loadGlobalRoster() {
    try {
        const querySnapshot = await getDocs(collection(dbFS, "public_roster"));
        let list = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({ id: docSnap.id, name: data.name, number: data.number, team: data.team });
        });
        globalRoster = list;
        
        const dropdown = document.getElementById('driver-roster-select');
        if(dropdown) {
            dropdown.innerHTML = globalRoster.map(d => `
                <option value="${d.id}" ${d.id === viewedUserId ? 'selected' : ''}>
                    [${teamMetadata[d.team]?.name || 'Unknown'}] ${d.name} #${d.number}
                </option>
            `).join('');
        }
        calculateLeaderboards();
    } catch(e) { console.error(e); }
}

async function pushDataToCloud() {
    if (viewedUserId !== currentUserId) return;
    await setDoc(doc(dbFS, "f1_trackers", currentUserId), driverData);
}

window.switchViewedDriver = function() {
    viewedUserId = document.getElementById('driver-roster-select').value;
    const isReadonly = viewedUserId !== currentUserId;
    
    const addHabitBtn = document.getElementById('add-habit-btn');
    if (addHabitBtn) addHabitBtn.style.display = isReadonly ? 'none' : 'block';
    
    const archiveGlobalActions = document.getElementById('archive-global-actions');
    if (archiveGlobalActions) archiveGlobalActions.style.display = isReadonly ? 'none' : 'flex';
    
    const dangerZonePanel = document.getElementById('danger-zone-panel');
    if (dangerZonePanel) dangerZonePanel.style.display = isReadonly ? 'none' : 'flex';
    
    setupLiveSync(viewedUserId);
}

function updateThemeAndUI() {
    const themeKey = driverData.activeTheme || 'fia';
    document.body.setAttribute('data-theme', themeKey);
    const bgContainer = document.getElementById('bg-glow-hub-container');
    if (bgContainer) bgContainer.innerHTML = teamLogos[themeKey] || '';

    document.getElementById('badge-driver-name').innerText = driverData.name || '--';
    document.getElementById('badge-driver-num').innerText = driverData.number || '--';
}

function getPointsForHabit(habit, targetYear, targetMonthIndex) {
    let pCount = 0, cCount = 0, tCount = 0;
    const targetDays = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    
    if (!habit.plannedDaysOfWeek || !habit.doneDays) return { pts: 0, pct: 0 };
    
    for(let d=1; d<=targetDays; d++) {
        let date = new Date(targetYear, targetMonthIndex, d);
        let uiDay = (date.getDay() === 0 ? 6 : date.getDay() - 1);
        let isP = habit.plannedDaysOfWeek[uiDay] || false;
        let isD = habit.doneDays[d-1] || false;
        if(isP) pCount++;
        if(isD) { tCount++; if(isP) cCount++; }
    }
    
    let pct = pCount > 0 ? Math.floor((cCount/pCount)*100) : 0;
    let basePts = 0;
    if (pCount > 0) {
        if (pct >= 90) basePts = 5;
        else if (pct >= 80) basePts = 4;
        else if (pct >= 70) basePts = 3;
        else if (pct >= 60) basePts = 2;
        else if (pct >= 50) basePts = 1;
    }
    return { pts: basePts + (tCount - cCount), pct: pct };
}

function calculatePoints(habit) {
    return getPointsForHabit(habit, currentYear, currentMonth);
}

async function calculateLeaderboards() {
    try {
        const querySnapshot = await getDocs(collection(dbFS, "f1_trackers"));
        let driverStandings = [];
        let constructorStandings = { redbull: 0, ferrari: 0, mclaren: 0, mercedes: 0, aston: 0, alpine: 0, williams: 0, haas: 0, rb: 0, audi: 0, cadillac: 0, fia: 0 };
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            let totalPoints = 0;
            
            (data.habits || []).forEach(h => { 
                totalPoints += getPointsForHabit(h, currentYear, currentMonth).pts; 
            });
            
            if (data.archive) {
                for (const [key, oldHabits] of Object.entries(data.archive)) {
                    const [aYear, aMonth] = key.split('-');
                    if (aYear === currentYear.toString()) {
                        const mIdx = monthNames.indexOf(aMonth);
                        oldHabits.forEach(h => { 
                            totalPoints += getPointsForHabit(h, parseInt(aYear), mIdx).pts; 
                        });
                    }
                }
            }

            if (data.historicalPoints && data.historicalPoints[currentYear.toString()]) {
                totalPoints += data.historicalPoints[currentYear.toString()];
            }

            if (docSnap.id !== 'admin') {
                driverStandings.push({ name: data.name || docSnap.id, team: data.activeTheme, points: totalPoints });
                if (constructorStandings[data.activeTheme] !== undefined) constructorStandings[data.activeTheme] += totalPoints;
            }
        });
        
        driverStandings.sort((a,b) => b.points - a.points);
        document.getElementById('driver-leaderboard').innerHTML = driverStandings.map((d, i) => `<div class="lb-row"><span>${i+1}. ${d.name} (${d.team.toUpperCase()})</span><strong>${d.points} PTS</strong></div>`).join('');
        let constArr = Object.keys(constructorStandings).filter(k => k !== 'fia').map(k => ({ name: teamMetadata[k].name, points: constructorStandings[k] }));
        constArr.sort((a,b) => b.points - a.points);
        document.getElementById('constructor-leaderboard').innerHTML = constArr.map((c, i) => `<div class="lb-row"><span>${i+1}. ${c.name}</span><strong>${c.points} PTS</strong></div>`).join('');
    } catch(e) { console.error(e); }
}

window.toggleStandingsView = function() {
    closeMobileMenu();
    const mainView = document.getElementById('main-view'); const standingsView = document.getElementById('standings-view');
    const archView = document.getElementById('archive-view'); const adminView = document.getElementById('admin-view');
    archView.style.display = 'none'; adminView.style.display = 'none';
    if (standingsView.style.display === 'block') { standingsView.style.display = 'none'; mainView.style.display = 'block'; } 
    else { mainView.style.display = 'none'; standingsView.style.display = 'block'; calculateLeaderboards(); }
    updateNavButtons();
}

window.toggleArchiveView = function() {
    closeMobileMenu();

    // If viewing another driver's tracker, switch back to yourself first
    if (viewedUserId !== currentUserId) {
        viewedUserId = currentUserId;
        adminLoadedDriverId = null;

        const dropdown = document.getElementById("driver-roster-select");
        if (dropdown) dropdown.value = currentUserId;

        setupLiveSync(currentUserId);

        document.getElementById('add-habit-btn').style.display = 'block';
        document.getElementById('archive-global-actions').style.display = 'flex';
        document.getElementById('danger-zone-panel').style.display = 'flex';
    }

    const mainView = document.getElementById('main-view');
    const archView = document.getElementById('archive-view');
    const standingsView = document.getElementById('standings-view');
    const adminView = document.getElementById('admin-view');

    standingsView.style.display = 'none';
    adminView.style.display = 'none';

    if (archView.style.display === 'block') {
        archView.style.display = 'none';
        mainView.style.display = 'block';
    } else {
        mainView.style.display = 'none';
        archView.style.display = 'block';
        renderArchive();
    }

    updateNavButtons();
}

// ADMIN RACE CONTROL: ACCESS DRIVER ARCHIVES
window.openAdminDriverArchive = async function(driverId) {
    const docSnap = await getDoc(doc(dbFS, "f1_trackers", driverId));
    if(!docSnap.exists()) return;
    
    adminLoadedDriverId = driverId;
    driverData = docSnap.data();
    
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('archive-view').style.display = 'block';
    renderArchive();
    updateNavButtons();
}

function renderArchive() {
    const list = document.getElementById('archive-list');
    const isReadonly = (viewedUserId !== currentUserId && !adminLoadedDriverId) || (adminLoadedDriverId && adminLoadedDriverId !== currentUserId);
    
    const wipeAllBtn = document.getElementById('wipe-all-archive-btn');
    if (wipeAllBtn) wipeAllBtn.style.display = isReadonly ? 'none' : 'block';
    
    if (!driverData.archive || Object.keys(driverData.archive).length === 0) {
        list.innerHTML = "<p style='text-align:center; padding:30px; color:#888;'>No past performance logs found.</p>"; return;
    }
    let html = '';
    Object.keys(driverData.archive).sort((a,b)=> b.localeCompare(a)).forEach(key => {
        const oldHabits = driverData.archive[key];
        let totalPointsScored = 0;
        const [aYear, aMonth] = key.split('-');
        const mIdx = monthNames.indexOf(aMonth);
        
        oldHabits.forEach(h => { 
            totalPointsScored += getPointsForHabit(h, parseInt(aYear), mIdx).pts;
        });
        
        html += `
            <div class="archive-data" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
                <div>
                    <h3 style="margin:0; color:#e10600; text-transform:uppercase; font-size:1.1em;">📅 ${key}</h3>
                    <p style="margin:5px 0 0 0; font-size:0.85em; color:#aaa;">Tracked ${oldHabits.length} sectors • Accumulated ${totalPointsScored} Points</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn-archive" style="background:#28a745; border:none;" onclick="downloadSingleMonthExcel('${key}')">📥 Download Excel</button>
                    ${!isReadonly ? `<button type="button" class="btn-archive" style="background:#ff4c4c; border:none;" onclick="deleteSingleMonthArchive('${key}')">🗑️ Wipe Month</button>` : ''}
                </div>
            </div>`;
    });
    list.innerHTML = html;
}

function renderTable() {
    const headerRow = document.getElementById('table-header-row'); if (!headerRow) return;
    let headerHTML = `<th class="habit-name">Sector (Habit)</th><th class="plan-col">Target Plan</th>`;
    for(let i=1; i<=daysInMonth; i++) headerHTML += `<th class="day-col">${i}</th>`;
    headerHTML += `<th class="stats-col">Race Pace</th><th class="pts-col">Points</th>`;
    headerRow.innerHTML = headerHTML;
    const tbody = document.getElementById('habit-body'); if (!tbody) return; tbody.innerHTML = '';
    const habitsList = driverData.habits || []; 
    const isReadonly = viewedUserId !== currentUserId;
    
    habitsList.forEach((habit, hIndex) => {
        if (!habit.plannedDaysOfWeek) habit.plannedDaysOfWeek = Array(7).fill(false);
        if (!habit.doneDays) habit.doneDays = Array(31).fill(false);
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
        const metrics = calculatePoints(habit);
        let pos = "DNF", posColor = "#ff4c4c";
        if (metrics.pct >= 90) { pos = "P1"; posColor = "#00cc00"; }
        else if (metrics.pct >= 80) { pos = "P2"; posColor = "#32cd32"; }
        else if (metrics.pct >= 70) { pos = "P3"; posColor = "#9acd32"; }
        else if (metrics.pct >= 60) { pos = "P4"; posColor = "#ffd700"; }
        else if (metrics.pct >= 50) { pos = "P5"; posColor = "#ffa500"; }
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
                ${pos} (${metrics.pct}%)
                <div class="progress-track"><div class="progress-fill" style="width:${metrics.pct}%; background: ${posColor}"></div></div>
            </td>
            <td class="pts-col">${metrics.pts}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateHabitCheckbox = function(hIndex, dayIndex, isChecked) { driverData.habits[hIndex].doneDays[dayIndex] = isChecked; pushDataToCloud(); };
window.togglePlannedDay = function(hIndex, dayIndex) { driverData.habits[hIndex].plannedDaysOfWeek[dayIndex] = !driverData.habits[hIndex].plannedDaysOfWeek[dayIndex]; pushDataToCloud(); renderTable(); };
window.updateHabitName = function(hIndex, value) { driverData.habits[hIndex].name = value; pushDataToCloud(); };
window.deleteHabit = function(hIndex) { driverData.habits.splice(hIndex, 1); pushDataToCloud(); renderTable(); };
window.addHabit = function() { driverData.habits.push({ name: '', plannedDaysOfWeek: Array(7).fill(false), doneDays: Array(31).fill(false) }); pushDataToCloud(); renderTable(); };

window.downloadDriverTelemetryBackup = function() {
    closeMobileMenu();
    if (!currentUserId) return;
    const exportPackage = { driverId: viewedUserId, meta: { exportedAt: new Date().toISOString(), driverName: driverData.name || 'Anonymous' }, telemetry: { currentHabits: driverData.habits || [], historicalArchive: driverData.archive || {} } };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPackage, null, 2));
    const downloadAnchor = document.createElement('a'); downloadAnchor.setAttribute("href", dataStr); downloadAnchor.setAttribute("download", `telemetry_backup_${viewedUserId}.json`); document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
};

window.deleteDriverAccount = async function() {
    closeMobileMenu();
    if (!currentUserId) return;
    if (currentUserId !== viewedUserId && currentUserId !== 'admin') return;
    if (!confirm(`🚨 RED FLAG: Delete profile records for ${viewedUserId} permanently?`)) return;
    try { await deleteDoc(doc(dbFS, "f1_trackers", viewedUserId)); await deleteDoc(doc(dbFS, "public_roster", viewedUserId)); handleLogout(); } catch (e) { console.error(e); }
};

window.adminPurgeWholeAccount = async function(driverId) {
    if(!confirm(`🚨 PURGE ACCOUNT: Completely erase profile [${driverId}]?`)) return;
    try {
        await deleteDoc(doc(dbFS, "f1_trackers", driverId));
        await deleteDoc(doc(dbFS, "public_roster", driverId));
        alert(`Purged ${driverId}`);
        if(currentUserId === 'admin') toggleAdminPanelSection();
    } catch(e) { alert("Operation rejected."); }
}

window.toggleAdminPanelSection = async function() {
    closeMobileMenu();
    if (currentUserId !== 'admin') return;

    const mainView = document.getElementById('main-view'); const adminView = document.getElementById('admin-view');
    const standingsView = document.getElementById('standings-view'); const archView = document.getElementById('archive-view');
    
    standingsView.style.display = 'none'; archView.style.display = 'none';
    
    if (adminView.style.display === 'block') { 
        adminView.style.display = 'none'; mainView.style.display = 'block'; 
    } 
    else {
        mainView.style.display = 'none'; adminView.style.display = 'block'; const rosterBody = document.getElementById('admin-roster-body');
        try {
            const querySnapshot = await getDocs(collection(dbFS, "f1_trackers")); let html = "";
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data(); 
                const teamName = teamMetadata[data.activeTheme]?.name || 'Unknown';
                html += `
                    <tr>
                        <td>${docSnap.id}</td>
                        <td>${data.name || '--'}</td>
                        <td>#${data.number || '--'}</td>
                        <td style="font-weight:bold;">${teamName}</td>
                        <td><button class="btn-archive" style="background:#28a745;" onclick="openAdminDriverArchive('${docSnap.id}')">📂 View History</button></td>
                        <td>
                            <button class="btn-archive" style="background:#ff4c4c; border:none; padding:4px 8px;" onclick="adminPurgeWholeAccount('${docSnap.id}')">🗑️ Purge</button>
                        </td>
                    </tr>`;
            });
            rosterBody.innerHTML = html;
        } catch(e) { rosterBody.innerHTML = `<tr><td colspan="6">Access Refused.</td></tr>`; }
    }
    updateNavButtons();
}

document.body.setAttribute('data-theme', 'fia');
const initialBg = document.getElementById('bg-glow-hub-container');
if(initialBg) initialBg.innerHTML = teamLogos['fia'];

if(currentUserId) { loginUserSuccess(currentUserId); }
else { document.getElementById('auth-gate').style.display = 'block'; }