(function () {

/* =========================================================
   FIREBASE INIT
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDy15PnvVYLuMnIVQLMH756rDumfgTVqSU",
  authDomain: "dsa-tracker-c46a2.firebaseapp.com",
  projectId: "dsa-tracker-c46a2",
  storageBucket: "dsa-tracker-c46a2.firebasestorage.app",
  messagingSenderId: "937532584620",
  appId: "1:937532584620:web:32ea13439f601e69c42509"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let userDocRef = null;

// Handle Sign In button
document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
  auth.signInWithPopup(provider).catch(e => {
    console.error("Sign in error:", e);
    const err = document.getElementById('loginErrorMsg');
    if (err) { err.textContent = e.message; err.style.display = 'block'; }
  });
});

// Enforce strict email check and load app
auth.onAuthStateChanged(user => {
  const overlay = document.getElementById('loginOverlay');
  const err = document.getElementById('loginErrorMsg');
  
  if (user) {
    if (user.email === 'sgr.palled@gmail.com') {
      // Authorized
      overlay.style.display = 'none';
      userDocRef = db.collection('users').doc(user.uid);
      loadData(); // Start the app
    } else {
      // Unauthorized
      auth.signOut();
      if (err) {
        err.textContent = `Access Denied: ${user.email} is not authorized to access this tracker.`;
        err.style.display = 'block';
      }
    }
  } else {
    // Logged out
    overlay.style.display = 'flex';
  }
});

/* =========================================================
   STATE
   ========================================================= */
let ALL_PROBLEMS = [];
let solved  = new Set();
let starred = new Set();
let customNotes = {};
const STORAGE_SOLVED   = 'dsa-tracker-solved';
const STORAGE_STARRED  = 'dsa-tracker-starred';
const STORAGE_NOTES    = 'dsa-tracker-custom-notes';

let searchQ = '';
let filterDiffs    = new Set();
let filterStatuses = new Set();
let filterTopic    = '';
let filterMatch    = 'all';

let openHeadings = new Set();
let openSubs     = new Set();

let isCompactMode = true;

const CURATED_LIST = new Set([
  1,4,6,7,9,10,12,13,14,15,16,17,18,21,22,24,25,26,27,28,29,30,31,34,35,36,37,39,40,
  41,42,45,46,48,49,50,52,53,54,56,57,59,60,61,65,66,69,70,
  73,74,76,77,80,82,83,85,405,407,408,409,410,
  89,96,97,98,100,101,103,104,105,107,109,111,115,116,117,118,
  120,122,125,130,131,132,133,135,136,137,138,140,141,142,
  145,147,148,151,155,156,157,159,
  162,163,165,168,169,170,176,180,181,182,184,185,186,187,189,190,
  192,193,195,196,198,199,200,202,
  205,208,210,211,213,215,217,219,220,
  221,222,224,225,226,227,228,229,230,233,235,
  238,239,240,241,242,243,244,246,248,249,250,251,253,254,255,256,258,259,260,261,262,264,266,268,270,271,273,
  275,277,279,280,281,282,283,284,285,287,288,289,
  294,295,296,298,300,302,303,305,307,308,309,310,311,313,315,316,317,318,319,322,323,325,327,328,329,331,332,333,334,335,336,338,339,340,341,342,
  344,345,348,349,350,352,354,355,357,358,360,362,363,365,367,368,370,372,373,374,376,378,379,381,383,384,386,388,390,391,393,395,396,
  397,399,400,402,403
]);

/* =========================================================
   LOAD DATA
   ========================================================= */
async function loadData() {
  try {
    const res = await fetch('problems.json');
    ALL_PROBLEMS = await res.json();
    ALL_PROBLEMS.forEach(p => {
      p.difficulty = p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1).toLowerCase();
    });
    
    await loadFromStorage();
    populateTopicDropdown();
    render();
    updateStats();
  } catch (e) {
    document.getElementById('loadingMsg').textContent =
      'Failed to load problems. Make sure problems.json is in the same folder.';
    console.error(e);
  }
}

async function loadFromStorage() {
  try {
    // Try to load from Firebase first
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.solved) solved = new Set(data.solved);
      if (data.starred) starred = new Set(data.starred);
      if (data.customNotes) customNotes = data.customNotes;
      
      // Update local storage as a backup/cache
      localStorage.setItem(STORAGE_SOLVED, JSON.stringify([...solved]));
      localStorage.setItem(STORAGE_STARRED, JSON.stringify([...starred]));
      localStorage.setItem(STORAGE_NOTES, JSON.stringify(customNotes));
      return;
    }
  } catch (e) {
    console.warn("Failed to load from Firebase, falling back to localStorage", e);
  }

  // Fallback to localStorage if Firebase fails or is empty
  try {
    const s = localStorage.getItem(STORAGE_SOLVED);
    if (s) solved = new Set(JSON.parse(s));
    const st = localStorage.getItem(STORAGE_STARRED);
    if (st) starred = new Set(JSON.parse(st));
    const n = localStorage.getItem(STORAGE_NOTES);
    if (n) customNotes = JSON.parse(n);
  } catch (e) {
    console.error("Failed to load from localStorage", e);
  }
}

let syncTimeout = null;
function syncToFirebase() {
  clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    userDocRef.set({
      solved: [...solved],
      starred: [...starred],
      customNotes: customNotes
    }, { merge: true }).catch(e => console.error("Firebase save error:", e));
  }, 1000); // Debounce saves by 1 second to prevent spamming
}

function saveSolved()  { localStorage.setItem(STORAGE_SOLVED,  JSON.stringify([...solved])); syncToFirebase(); }
function saveStarred() { localStorage.setItem(STORAGE_STARRED, JSON.stringify([...starred])); syncToFirebase(); }
function saveNotes()   { localStorage.setItem(STORAGE_NOTES,   JSON.stringify(customNotes)); syncToFirebase(); }

function populateTopicDropdown() {
  const sel = document.getElementById('topicFilter');
  const headings = [...new Set(ALL_PROBLEMS.map(p => p.heading))];
  headings.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h; opt.textContent = h;
    sel.appendChild(opt);
  });
}

/* =========================================================
   FILTERING
   ========================================================= */
function filterProblems() {
  return ALL_PROBLEMS.filter(p => {
    if (isCompactMode && !CURATED_LIST.has(p.serial)) return false;

    const checks = [];
    if (searchQ) checks.push(p.name.toLowerCase().includes(searchQ.toLowerCase()));
    if (filterDiffs.size > 0) checks.push(filterDiffs.has(p.difficulty));
    if (filterStatuses.size > 0) {
      const isSolved  = solved.has(p.serial);
      const isStarred = starred.has(p.serial);
      const sub = [];
      if (filterStatuses.has('solved'))  sub.push(isSolved);
      if (filterStatuses.has('todo'))    sub.push(!isSolved);
      if (filterStatuses.has('starred')) sub.push(isStarred);
      checks.push(sub.some(Boolean));
    }
    if (filterTopic) checks.push(p.heading === filterTopic);
    if (checks.length === 0) return true;
    return filterMatch === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  });
}

/* =========================================================
   NOTES MODAL
   ========================================================= */
const notesModal    = document.getElementById('notesEditorModal');
const notesClose    = document.getElementById('notesEditorClose');
const notesTitle    = document.getElementById('notesEditorTitle');
const tabPreview    = document.getElementById('notesTabPreview');
const tabEdit       = document.getElementById('notesTabEdit');
const notesPreview  = document.getElementById('notesPreview');
const notesTextarea = document.getElementById('notesTextarea');
const notesSaveBtn  = document.getElementById('notesSaveBtn');

let currentEditingSerial = null;

function openNotesModal(serial, name) {
  try {
    currentEditingSerial = serial;
    notesTitle.textContent = name;
    const currentNote = customNotes[serial] || '';
    notesTextarea.value = currentNote;
    
    // Default to Preview if there is content, else Edit
    if (String(currentNote).trim()) {
      showNotesPreview(currentNote);
    } else {
      showNotesEdit();
    }
    
    notesModal.classList.add('open');
  } catch (err) {
    alert("Error opening notes: " + err.message);
    console.error(err);
  }
}

function closeNotesModal() {
  notesModal.classList.remove('open');
  currentEditingSerial = null;
}

function showNotesPreview(markdownText) {
  tabPreview.classList.add('active');
  tabEdit.classList.remove('active');
  notesPreview.classList.remove('hidden');
  notesTextarea.classList.add('hidden');
  
  const text = markdownText || '*No notes available.*';
  try {
    if (typeof marked !== 'undefined') {
      notesPreview.innerHTML = marked.parse(text);
    } else {
      notesPreview.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escHtml(text)}</pre>`;
    }
  } catch (e) {
    notesPreview.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${escHtml(text)}</pre>`;
    console.error("Markdown parsing failed:", e);
  }
}

function showNotesEdit() {
  tabEdit.classList.add('active');
  tabPreview.classList.remove('active');
  notesTextarea.classList.remove('hidden');
  notesPreview.classList.add('hidden');
  notesTextarea.focus();
}

tabPreview.addEventListener('click', () => showNotesPreview(notesTextarea.value));
tabEdit.addEventListener('click', () => showNotesEdit());
notesClose.addEventListener('click', closeNotesModal);

notesSaveBtn.addEventListener('click', () => {
  if (currentEditingSerial !== null) {
    customNotes[currentEditingSerial] = notesTextarea.value;
    saveNotes();
    render(); // Re-render to update the icon color
    closeNotesModal();
  }
});

/* =========================================================
   NOTES POPOVER
   ========================================================= */
const popover       = document.getElementById('notesPopover');
const popoverTitle  = document.getElementById('notesPopoverTitle');
const popoverBody   = document.getElementById('notesPopoverBody');
let popoverTimeout  = null;

function showNotesPopover(el, name, notes) {
  clearTimeout(popoverTimeout);
  popoverTitle.textContent = name;
  popoverBody.textContent  = notes || 'No additional notes.';

  const rect = el.getBoundingClientRect();
  const top  = rect.bottom + 6;
  let   left = rect.left;

  const pw = 340;
  if (left + pw > window.innerWidth - 16) left = window.innerWidth - pw - 16;
  if (left < 8) left = 8;

  popover.style.top  = `${top}px`;
  popover.style.left = `${left}px`;
  popover.classList.add('visible');
}

function hideNotesPopover(delay = 120) {
  popoverTimeout = setTimeout(() => popover.classList.remove('visible'), delay);
}

popover.addEventListener('mouseenter', () => clearTimeout(popoverTimeout));
popover.addEventListener('mouseleave', () => hideNotesPopover());
document.addEventListener('click', (e) => {
  if (!popover?.contains(e.target)) hideNotesPopover(0);
});

function starIcon(isStarred) {
  return isStarred
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="#f5a623" stroke="#f5a623" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

function render() {
  const main     = document.getElementById('mainContent');
  const filtered = filterProblems();
  
  // Compact toggle logic attachment (do it once safely)
  const compactToggle = document.getElementById('compactModeToggle');
  const modeLabel = document.getElementById('modeLabel');
  if (compactToggle && !compactToggle.hasAttribute('data-bound')) {
    compactToggle.checked = isCompactMode;
    modeLabel.textContent = isCompactMode ? 'Compact List' : 'Full List';
    compactToggle.addEventListener('change', (e) => {
      isCompactMode = e.target.checked;
      modeLabel.textContent = isCompactMode ? 'Compact List' : 'Full List';
      render();
      updateStats();
    });
    compactToggle.setAttribute('data-bound', 'true');
  }

  if (filtered.length === 0) {
    main.innerHTML = `<div class="no-results"><span>🔍</span>No problems match your filters.</div>`;
    return;
  }

  const grouped = {};
  filtered.forEach(p => {
    if (!grouped[p.heading]) grouped[p.heading] = {};
    if (!grouped[p.heading][p.subheading]) grouped[p.heading][p.subheading] = [];
    grouped[p.heading][p.subheading].push(p);
  });

  const allHeadings = [...new Set(ALL_PROBLEMS.map(p => p.heading))];
  main.innerHTML = '';
  document.getElementById('loadingMsg')?.remove();

  allHeadings.forEach(heading => {
    if (!grouped[heading]) return;

    const subs = grouped[heading];
    const allInSection    = Object.values(subs).flat();
    const solvedInSection = allInSection.filter(p => solved.has(p.serial)).length;
    const totalInSection  = allInSection.length;
    const pct = totalInSection > 0 ? (solvedInSection / totalInSection) * 100 : 0;

    const card = document.createElement('div');
    card.className = openHeadings.has(heading) ? 'section-card open' : 'section-card';
    card.dataset.heading = heading;

    card.innerHTML = `
      <div class="section-header">
        <span class="section-chevron">▶</span>
        <span class="section-name">${escHtml(heading)}</span>
        <span class="section-count">${solvedInSection}/${totalInSection}</span>
        <div class="section-progress-bar">
          <div class="section-progress-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
      </div>
      <div class="section-body" id="body-${slugify(heading)}"></div>
    `;

    card.querySelector('.section-header').addEventListener('click', () => {
      const isOpen = card.classList.toggle('open');
      if (isOpen) openHeadings.add(heading);
      else openHeadings.delete(heading);
    });

    const body = card.querySelector('.section-body');

    // Table
    const table = document.createElement('table');
    table.className = 'prob-table';
    table.innerHTML = `<thead><tr>
      <th class="th-status">STATUS</th>
      <th class="th-star">STAR</th>
      <th>PROBLEM</th>
      <th class="th-notes">NOTES</th>
      <th class="th-diff">DIFFICULTY</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    let lastSub = null;
    Object.entries(subs).forEach(([sub, probs]) => {
      if (sub !== lastSub) {
        lastSub = sub;
        const subRow = document.createElement('tr');
        const subKey = heading + '|' + sub;
        const isSubOpen = openSubs.has(subKey);
        subRow.className = isSubOpen ? 'subheading-row open' : 'subheading-row';
        subRow.innerHTML = `<td colspan="5"><div class="subheading"><span class="sub-chevron">▶</span> ${escHtml(sub)}</div></td>`;
        
        subRow.addEventListener('click', () => {
          const isOpen = subRow.classList.toggle('open');
          if (isOpen) openSubs.add(subKey);
          else openSubs.delete(subKey);
          
          let next = subRow.nextElementSibling;
          while(next && next.classList.contains('prob-row')) {
            next.style.display = isOpen ? '' : 'none';
            next = next.nextElementSibling;
          }
        });
        
        tbody.appendChild(subRow);
      }

      const subKey = heading + '|' + sub;
      const isSubOpen = openSubs.has(subKey);

      probs.forEach(p => {
        const isSolved  = solved.has(p.serial);
        const isStarred = starred.has(p.serial);
        const tr = document.createElement('tr');
        tr.className = `prob-row${isSolved ? ' solved' : ''}`;
        tr.style.display = isSubOpen ? '' : 'none';

        const url = (p.link || '').trim();
        const diffClass = `diff-${p.difficulty.toLowerCase()}`;

        // Name cell
        let nameCell;
        if (url) {
          nameCell = `<a class="prob-link" href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(p.name)}</a>`;
        } else {
          nameCell = `<span class="no-link" data-serial="${p.serial}">${escHtml(p.name)}</span>`;
        }
        
        if (p.notes) {
          nameCell += `<div class="prob-notes-inline" data-notes="true">${escHtml(p.notes)}</div>`;
        }

        const activeNotes = customNotes[p.serial] !== undefined ? customNotes[p.serial] : '';
        const hasNotesClass = activeNotes.trim() ? 'has-notes' : '';

        tr.innerHTML = `
          <td class="td-check">
            <input type="checkbox" class="prob-checkbox" data-serial="${p.serial}" ${isSolved ? 'checked' : ''}>
          </td>
          <td class="td-star">
            <button class="star-btn ${isStarred ? 'starred' : ''}" data-serial="${p.serial}" title="${isStarred ? 'Unstar' : 'Star'}">${starIcon(isStarred)}</button>
          </td>
          <td class="td-name">${nameCell}</td>
          <td class="td-notes">
            <button class="note-btn ${hasNotesClass}" data-serial="${p.serial}" title="Notes">📝</button>
          </td>
          <td><span class="diff-badge ${diffClass}">${escHtml(p.difficulty)}</span></td>
        `;

        // Note button
        tr.querySelector('.note-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          openNotesModal(p.serial, p.name);
        });

        // Notes popover
        if (p.notes) {
          const notesEl = tr.querySelector('.prob-notes-inline');
          if (notesEl) {
            notesEl.addEventListener('mouseenter', () => {
              showNotesPopover(notesEl, p.name, p.notes);
            });
            notesEl.addEventListener('mouseleave', () => hideNotesPopover());
          }
        }

        // Checkbox
        tr.querySelector('.prob-checkbox').addEventListener('change', (e) => {
          if (e.target.checked) { solved.add(p.serial); tr.classList.add('solved'); }
          else                  { solved.delete(p.serial); tr.classList.remove('solved'); }
          saveSolved();
          updateStats();
          updateSectionProgress(card, heading);
        });

        // Star button
        tr.querySelector('.star-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const btn = e.currentTarget;
          if (starred.has(p.serial)) {
            starred.delete(p.serial);
            btn.classList.remove('starred');
            btn.title = 'Star';
          } else {
            starred.add(p.serial);
            btn.classList.add('starred');
            btn.title = 'Unstar';
          }
          btn.innerHTML = starIcon(starred.has(p.serial));
          saveStarred();
        });

        tbody.appendChild(tr);
      });
    });

    table.appendChild(tbody);
    body.appendChild(table);
    main.appendChild(card);
  });
}

function updateSectionProgress(card, heading) {
  const list = isCompactMode ? ALL_PROBLEMS.filter(p => CURATED_LIST.has(p.serial)) : ALL_PROBLEMS;
  const allInSection = list.filter(p => p.heading === heading);
  const solvedCount  = allInSection.filter(p => solved.has(p.serial)).length;
  const total        = allInSection.length;
  const pct          = total > 0 ? (solvedCount / total) * 100 : 0;
  card.querySelector('.section-count').textContent = `${solvedCount}/${total}`;
  card.querySelector('.section-progress-fill').style.width = `${pct.toFixed(1)}%`;
}

/* =========================================================
   STATS & RING GAUGE (canvas)
   ========================================================= */
const ringAnimState = { easy: 0, medium: 0, hard: 0 };

function updateStats() {
  const byDiff    = { Easy: 0, Medium: 0, Hard: 0 };
  const totalDiff = { Easy: 0, Medium: 0, Hard: 0 };
  const list = isCompactMode ? ALL_PROBLEMS.filter(p => CURATED_LIST.has(p.serial)) : ALL_PROBLEMS;

  list.forEach(p => {
    const d = p.difficulty;
    if (totalDiff[d] !== undefined) totalDiff[d]++;
    if (solved.has(p.serial) && byDiff[d] !== undefined) byDiff[d]++;
  });

  const totalSolved = byDiff.Easy + byDiff.Medium + byDiff.Hard;
  const totalAll    = totalDiff.Easy + totalDiff.Medium + totalDiff.Hard;

  document.getElementById('stat-easy').textContent   = `${byDiff.Easy} / ${totalDiff.Easy}`;
  document.getElementById('stat-medium').textContent = `${byDiff.Medium} / ${totalDiff.Medium}`;
  document.getElementById('stat-hard').textContent   = `${byDiff.Hard} / ${totalDiff.Hard}`;
  document.getElementById('ring-total').textContent  = totalSolved;
  document.getElementById('ring-denom').textContent  = `/ ${totalAll}`;

  const tE = totalDiff.Easy   > 0 ? byDiff.Easy   / totalDiff.Easy   : 0;
  const tM = totalDiff.Medium > 0 ? byDiff.Medium / totalDiff.Medium : 0;
  const tH = totalDiff.Hard   > 0 ? byDiff.Hard   / totalDiff.Hard   : 0;
  animateRing(tE, tM, tH);
}

function animateRing(tE, tM, tH) {
  const canvas = document.getElementById('ringCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  if (!canvas._init) {
    canvas.width  = 140 * dpr;
    canvas.height = 140 * dpr;
    canvas.style.width  = '140px';
    canvas.style.height = '140px';
    ctx.scale(dpr, dpr);
    canvas._init = true;
  }

  const cx = 70, cy = 70, R = 52, strokeW = 7;
  const START_DEG = 135, SWEEP_DEG = 270;
  const toRad = d => (d * Math.PI) / 180;
  const startRad   = toRad(START_DEG);
  const endRad     = toRad(START_DEG + SWEEP_DEG);
  const totalSweep = toRad(SWEEP_DEG);

  const C_TRACK = '#2a2a2f', C_EASY = '#00d26a', C_MEDIUM = '#f5a623', C_HARD = '#e84040';
  const from  = { ...ringAnimState };
  const dur   = 800;
  let t0 = null;
  const ease = t => 1 - Math.pow(1 - t, 3);

  function draw(pE, pM, pH) {
    ctx.clearRect(0, 0, 140, 140);

    // Track
    ctx.beginPath(); ctx.arc(cx, cy, R, startRad, endRad);
    ctx.strokeStyle = C_TRACK; ctx.lineWidth = strokeW; ctx.lineCap = 'round'; ctx.stroke();

    function drawArc(f, t, color) {
      if (t <= f) return;
      ctx.beginPath(); ctx.arc(cx, cy, R, startRad + totalSweep * f, startRad + totalSweep * t);
      ctx.strokeStyle = color; ctx.lineWidth = strokeW; ctx.lineCap = 'butt'; ctx.stroke();
    }

    drawArc(0,    (1/3) * pE,              C_EASY);
    drawArc(1/3,  1/3 + (1/3) * pM,       C_MEDIUM);
    drawArc(2/3,  2/3 + (1/3) * pH,       C_HARD);

    function drawDot(pct, color, filled) {
      const angle = startRad + totalSweep * pct;
      const x = cx + R * Math.cos(angle), y = cy + R * Math.sin(angle);
      ctx.beginPath(); ctx.arc(x, y, strokeW / 2 + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = filled ? color : C_TRACK; ctx.fill();
      if (!filled) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
    }

    drawDot(0,    C_EASY,   pE > 0);
    drawDot(1/3,  C_MEDIUM, pM > 0);
    drawDot(2/3,  C_HARD,   pH > 0);
  }

  function frame(ts) {
    if (!t0) t0 = ts;
    const t = Math.min((ts - t0) / dur, 1), e = ease(t);
    const pE = from.easy   + (tE - from.easy)   * e;
    const pM = from.medium + (tM - from.medium) * e;
    const pH = from.hard   + (tH - from.hard)   * e;
    draw(pE, pM, pH);
    if (t < 1) requestAnimationFrame(frame);
    else { ringAnimState.easy = tE; ringAnimState.medium = tM; ringAnimState.hard = tH; }
  }
  requestAnimationFrame(frame);
}

/* =========================================================
   SEARCH
   ========================================================= */
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
searchInput.addEventListener('input', () => {
  searchQ = searchInput.value.trim();
  searchClear.classList.toggle('visible', searchQ.length > 0);
  render();
});
searchClear.addEventListener('click', () => {
  searchInput.value = ''; searchQ = '';
  searchClear.classList.remove('visible'); render();
});

/* =========================================================
   FILTER PANEL
   ========================================================= */
const filterBtn   = document.getElementById('filterBtn');
const filterPanel = document.getElementById('filterPanel');

filterBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  filterPanel.classList.toggle('open');
  filterBtn.classList.toggle('active', filterPanel.classList.contains('open'));
});
document.addEventListener('click', (e) => {
  if (!filterPanel.contains(e.target) && e.target !== filterBtn) {
    filterPanel.classList.remove('open');
    filterBtn.classList.remove('active');
  }
});

document.getElementById('filterMatch').addEventListener('change', e => { filterMatch = e.target.value; render(); });

document.querySelectorAll('#diffFilter .multi-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const v = btn.dataset.val;
    filterDiffs.has(v) ? filterDiffs.delete(v) : filterDiffs.add(v);
    updateFilterBadge(); updateActiveChips(); render();
  });
});

document.querySelectorAll('#statusFilter .multi-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const v = btn.dataset.val;
    filterStatuses.has(v) ? filterStatuses.delete(v) : filterStatuses.add(v);
    updateFilterBadge(); updateActiveChips(); render();
  });
});

document.getElementById('topicFilter').addEventListener('change', e => {
  filterTopic = e.target.value;
  updateFilterBadge(); updateActiveChips(); render();
});

document.getElementById('filterReset').addEventListener('click', resetFilters);

function resetFilters() {
  filterDiffs.clear(); filterStatuses.clear(); filterTopic = ''; filterMatch = 'all';
  document.getElementById('filterMatch').value = 'all';
  document.getElementById('topicFilter').value = '';
  document.querySelectorAll('.multi-opt.active').forEach(b => b.classList.remove('active'));
  updateFilterBadge(); updateActiveChips(); render();
}

function updateFilterBadge() {
  const count = filterDiffs.size + filterStatuses.size + (filterTopic ? 1 : 0);
  const badge = document.getElementById('filterBadge');
  if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); filterBtn.classList.add('active'); }
  else           { badge.classList.add('hidden'); if (!filterPanel.classList.contains('open')) filterBtn.classList.remove('active'); }
}

function updateActiveChips() {
  const container = document.getElementById('activeFilters');
  container.innerHTML = '';
  const addChip = (label, value, clearFn) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<span>${escHtml(label)}: </span><span class="chip-label">${escHtml(value)}</span><button class="chip-remove">✕</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', clearFn);
    container.appendChild(chip);
  };
  filterDiffs.forEach(d => addChip('Difficulty', d, () => {
    filterDiffs.delete(d);
    document.querySelector(`#diffFilter .multi-opt[data-val="${d}"]`)?.classList.remove('active');
    updateFilterBadge(); updateActiveChips(); render();
  }));
  filterStatuses.forEach(s => addChip('Status', s === 'solved' ? 'Solved' : s === 'starred' ? 'Starred' : 'To Do', () => {
    filterStatuses.delete(s);
    document.querySelector(`#statusFilter .multi-opt[data-val="${s}"]`)?.classList.remove('active');
    updateFilterBadge(); updateActiveChips(); render();
  }));
  if (filterTopic) addChip('Topic', filterTopic, () => {
    filterTopic = ''; document.getElementById('topicFilter').value = '';
    updateFilterBadge(); updateActiveChips(); render();
  });
}

/* =========================================================
   RANDOM PROBLEM
   ========================================================= */
const randomBtn   = document.getElementById('randomBtn');
const randomModal = document.getElementById('randomModal');
const modalClose  = document.getElementById('modalClose');
const modalReroll = document.getElementById('modalReroll');

randomBtn.addEventListener('click', openRandom);
modalClose.addEventListener('click', () => randomModal.classList.remove('open'));
modalReroll.addEventListener('click', openRandom);
randomModal.addEventListener('click', e => { if (e.target === randomModal) randomModal.classList.remove('open'); });

function openRandom() {
  const pool = filterProblems();
  if (pool.length === 0) return;
  const p = pool[Math.floor(Math.random() * pool.length)];
  const diffClass = `diff-${p.difficulty.toLowerCase()}`;
  document.getElementById('modalDiff').textContent = p.difficulty;
  document.getElementById('modalDiff').className = `modal-tag diff-badge ${diffClass}`;
  document.getElementById('modalTitle').textContent = p.name;
  document.getElementById('modalTopic').textContent = `${p.heading} › ${p.subheading}`;
  const link = document.getElementById('modalLink');
  const url  = (p.link || '').trim();
  if (url) { link.href = url; link.style.pointerEvents = ''; link.style.opacity = '1'; link.textContent = 'Open Problem ↗'; }
  else     { link.href = '#'; link.style.pointerEvents = 'none'; link.style.opacity = '0.4'; link.textContent = 'No link available'; }
  randomModal.classList.add('open');
}

/* =========================================================
   UTILS
   ========================================================= */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function slugify(str) {
  return str.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
}

/* =========================================================
   INIT
   ========================================================= */
// loadData(); // Now handled by onAuthStateChanged

})();
