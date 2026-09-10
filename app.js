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
const storage = firebase.storage();
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
let coded   = new Set();
let customNotes = {};
let customCodeNotes = {};
const STORAGE_SOLVED      = 'dsa-tracker-solved';
const STORAGE_STARRED     = 'dsa-tracker-starred';
const STORAGE_CODED       = 'dsa-tracker-coded';
const STORAGE_NOTES       = 'dsa-tracker-custom-notes';
const STORAGE_CODE_NOTES  = 'dsa-tracker-code-notes';

let searchQ = '';
let filterDiffs    = new Set();
let filterStatuses = new Set();
let filterTopic    = '';
let filterMatch    = 'all';
let filterHasNotes = false;

let showLogicCol = true;
let showCodedCol = true;

let openHeadings = new Set();
let allExpanded = false;

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
      if (data.coded) coded = new Set(data.coded);
      if (data.customNotes) customNotes = data.customNotes;
      if (data.customCodeNotes) customCodeNotes = data.customCodeNotes;
      
      // Update local storage as a backup/cache
      localStorage.setItem(STORAGE_SOLVED, JSON.stringify([...solved]));
      localStorage.setItem(STORAGE_STARRED, JSON.stringify([...starred]));
      localStorage.setItem(STORAGE_CODED, JSON.stringify([...coded]));
      localStorage.setItem(STORAGE_NOTES, JSON.stringify(customNotes));
      localStorage.setItem(STORAGE_CODE_NOTES, JSON.stringify(customCodeNotes));
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
    const cd = localStorage.getItem(STORAGE_CODED);
    if (cd) coded = new Set(JSON.parse(cd));
    const n = localStorage.getItem(STORAGE_NOTES);
    if (n) customNotes = JSON.parse(n);
    const cn = localStorage.getItem(STORAGE_CODE_NOTES);
    if (cn) customCodeNotes = JSON.parse(cn);
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
      coded: [...coded],
      customNotes: customNotes,
      customCodeNotes: customCodeNotes
    }, { merge: true }).catch(e => console.error("Firebase save error:", e));
  }, 1000); // Debounce saves by 1 second to prevent spamming
}

function saveSolved()     { localStorage.setItem(STORAGE_SOLVED,     JSON.stringify([...solved])); syncToFirebase(); }
function saveStarred()    { localStorage.setItem(STORAGE_STARRED,    JSON.stringify([...starred])); syncToFirebase(); }
function saveCoded()      { localStorage.setItem(STORAGE_CODED,      JSON.stringify([...coded])); syncToFirebase(); }
function saveNotes()      { localStorage.setItem(STORAGE_NOTES,      JSON.stringify(customNotes)); syncToFirebase(); }
function saveCodeNotes()  { localStorage.setItem(STORAGE_CODE_NOTES, JSON.stringify(customCodeNotes)); syncToFirebase(); }

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
    if (filterHasNotes) checks.push(
      !!(customNotes[p.serial] && customNotes[p.serial].trim()) ||
      !!(customCodeNotes[p.serial] && customCodeNotes[p.serial].trim())
    );
    if (checks.length === 0) return true;
    return filterMatch === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  });
}

/* =========================================================
   NOTES MODAL
   ========================================================= */
const notesModal      = document.getElementById('notesEditorModal');
const notesClose      = document.getElementById('notesEditorClose');
const notesTitle      = document.getElementById('notesEditorTitle');
const notesImgInput   = document.getElementById('notesImgFileInput');

// Top-level note type tabs
const noteTypeTabApproach = document.getElementById('noteTypeTabApproach');
const noteTypeTabCode     = document.getElementById('noteTypeTabCode');

// Per-panel elements (approach)
const tabPreviewApproach  = document.getElementById('notesTabPreview');
const tabEditApproach     = document.getElementById('notesTabEdit');
const notesPreviewApproach = document.getElementById('notesPreview');
const notesTextareaApproach = document.getElementById('notesTextarea');
const notesSaveBtnApproach  = document.getElementById('notesSaveBtn');

// Per-panel elements (code)
const tabPreviewCode  = document.getElementById('codeTabPreview');
const tabEditCode     = document.getElementById('codeTabEdit');
const notesPreviewCode = document.getElementById('codePreview');
const notesTextareaCode = document.getElementById('codeTextarea');
const notesSaveBtnCode  = document.getElementById('codeSaveBtn');

let currentEditingSerial = null;
let activeNoteType = 'approach'; // 'approach' | 'code'

function openNotesModal(serial, name, noteType = 'approach') {
  try {
    currentEditingSerial = serial;
    notesTitle.textContent = name;
    activeNoteType = noteType;

    // Load both panels
    const approachNote = customNotes[serial] || '';
    const codeNote = customCodeNotes[serial] || '';
    notesTextareaApproach.value = approachNote;
    notesTextareaCode.value = codeNote;

    // Switch to the requested tab
    switchNoteTypeTab(noteType);

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

function switchNoteTypeTab(type) {
  activeNoteType = type;
  const approachPanel = document.getElementById('approachNotePanel');
  const codePanel     = document.getElementById('codeNotePanel');

  if (type === 'approach') {
    noteTypeTabApproach.classList.add('active');
    noteTypeTabCode.classList.remove('active');
    approachPanel.classList.remove('hidden');
    codePanel.classList.add('hidden');
    // Default to Preview if content, else Edit
    if (notesTextareaApproach.value.trim()) {
      showNotesPreview('approach', notesTextareaApproach.value);
    } else {
      showNotesEdit('approach');
    }
  } else {
    noteTypeTabCode.classList.add('active');
    noteTypeTabApproach.classList.remove('active');
    codePanel.classList.remove('hidden');
    approachPanel.classList.add('hidden');
    if (notesTextareaCode.value.trim()) {
      showNotesPreview('code', notesTextareaCode.value);
    } else {
      showNotesEdit('code');
    }
  }
}

function renderMarkdown(text, targetEl) {
  const src = text || '*No notes yet.*';
  try {
    if (typeof marked !== 'undefined') {
      const rawHtml = marked.parse(src);
      const sanitized = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                               .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                               .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
                               .replace(/<embed[\s\S]*?\/?>/gi, '')
                               .replace(/<object[\s\S]*?<\/object>/gi, '');
      targetEl.innerHTML = sanitized;
    } else {
      targetEl.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit">${escHtml(src)}</pre>`;
    }
  } catch (e) {
    targetEl.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit">${escHtml(src)}</pre>`;
  }
}

function showNotesPreview(panel, markdownText) {
  if (panel === 'approach') {
    tabPreviewApproach.classList.add('active');
    tabEditApproach.classList.remove('active');
    notesPreviewApproach.classList.remove('hidden');
    notesTextareaApproach.classList.add('hidden');
    renderMarkdown(markdownText, notesPreviewApproach);
  } else {
    tabPreviewCode.classList.add('active');
    tabEditCode.classList.remove('active');
    notesPreviewCode.classList.remove('hidden');
    notesTextareaCode.classList.add('hidden');
    renderMarkdown(markdownText, notesPreviewCode);
  }
}

function showNotesEdit(panel) {
  if (panel === 'approach') {
    tabEditApproach.classList.add('active');
    tabPreviewApproach.classList.remove('active');
    notesTextareaApproach.classList.remove('hidden');
    notesPreviewApproach.classList.add('hidden');
    notesTextareaApproach.focus();
  } else {
    tabEditCode.classList.add('active');
    tabPreviewCode.classList.remove('active');
    notesTextareaCode.classList.remove('hidden');
    notesPreviewCode.classList.add('hidden');
    notesTextareaCode.focus();
  }
}

/* ---- Shared image uploader ---- */
function activeTextarea() {
  return activeNoteType === 'approach' ? notesTextareaApproach : notesTextareaCode;
}

async function uploadImageToNotes(file) {
  const user = auth.currentUser;
  if (!user) {
    showImgStatus('error', '⚠ You must be signed in to upload images.');
    return null;
  }
  if (!file || !file.type.startsWith('image/')) {
    showImgStatus('error', '⚠ Only image files are supported.');
    return null;
  }

  const ta = activeTextarea();
  const placeholder = `\n![Uploading image...]()\n`;
  const startPos = ta.selectionStart;
  const endPos   = ta.selectionEnd;
  const val      = ta.value;
  ta.value = val.substring(0, startPos) + placeholder + val.substring(endPos);
  ta.selectionStart = startPos + placeholder.length;
  ta.selectionEnd   = startPos + placeholder.length;

  showImgStatus('uploading', '⏫ Uploading image…');

  const TIMEOUT_MS = 30000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('storage/timeout — Upload timed out after 30s. Check Firebase Storage rules.')), TIMEOUT_MS)
  );

  try {
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const fileName = `notes_images/${user.uid}_${Date.now()}.${ext}`;
    const storageRef = storage.ref().child(fileName);
    const uploadTask = storageRef.put(file);
    await Promise.race([uploadTask, timeoutPromise]);
    const downloadURL = await storageRef.getDownloadURL();
    ta.value = ta.value.replace(placeholder, `\n![Image](${downloadURL})\n`);
    showImgStatus('success', '✓ Image uploaded!');
    setTimeout(() => hideImgStatus(), 2500);
    return downloadURL;
  } catch (err) {
    console.error('Image upload failed:', err);
    ta.value = ta.value.replace(placeholder, '');
    const isTimeout = err.message.includes('timeout');
    const isRules   = err.code === 'storage/unauthorized';
    let msg = `⚠ ${err.code || err.message}`;
    if (isTimeout || isRules) {
      msg = '⚠ Upload blocked — fix Firebase Storage rules (see console for details).';
      console.error('FIX: Go to Firebase Console → Storage → Rules and allow writes for your UID.');
    }
    showImgStatus('error', msg);
    return null;
  }
}

function getActiveStatusEl() {
  return activeNoteType === 'approach' ? document.getElementById('notesImgStatusApproach') : document.getElementById('notesImgStatusCode');
}

function showImgStatus(type, msg) {
  const el = getActiveStatusEl();
  if (!el) return;
  el.textContent = msg;
  el.className   = `notes-img-status ${type}`;
  el.style.display = 'flex';
}
function hideImgStatus() {
  const el = getActiveStatusEl();
  if (!el) return;
  el.style.display = 'none';
}

/* Paste handler — applies to whichever textarea is active */
[notesTextareaApproach, notesTextareaCode].forEach(ta => {
  ta.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        await uploadImageToNotes(item.getAsFile());
        break;
      }
    }
  });
  ta.addEventListener('dragover', (e) => { e.preventDefault(); ta.classList.add('drag-over'); });
  ta.addEventListener('dragleave', () => ta.classList.remove('drag-over'));
  ta.addEventListener('drop', async (e) => {
    e.preventDefault();
    ta.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) await uploadImageToNotes(file);
  });
});

/* File picker buttons */
if (notesImgInput) {
  const approachBtn = document.getElementById('approachImgUploadBtn');
  const codeBtn     = document.getElementById('codeImgUploadBtn');
  if (approachBtn) approachBtn.addEventListener('click', () => notesImgInput.click());
  if (codeBtn) codeBtn.addEventListener('click', () => notesImgInput.click());
  
  notesImgInput.addEventListener('change', async () => {
    const file = notesImgInput.files?.[0];
    if (file) {
      await uploadImageToNotes(file);
      notesImgInput.value = '';
    }
  });
}

/* Note type tab clicks */
noteTypeTabApproach.addEventListener('click', () => switchNoteTypeTab('approach'));
noteTypeTabCode.addEventListener('click',     () => switchNoteTypeTab('code'));

/* Approach sub-tabs */
tabPreviewApproach.addEventListener('click', () => showNotesPreview('approach', notesTextareaApproach.value));
tabEditApproach.addEventListener('click',   () => showNotesEdit('approach'));

/* Code sub-tabs */
tabPreviewCode.addEventListener('click', () => showNotesPreview('code', notesTextareaCode.value));
tabEditCode.addEventListener('click',   () => showNotesEdit('code'));

notesClose.addEventListener('click', closeNotesModal);

/* Save buttons */
notesSaveBtnApproach.addEventListener('click', () => {
  if (currentEditingSerial !== null) {
    customNotes[currentEditingSerial] = notesTextareaApproach.value;
    saveNotes();
    render();
    closeNotesModal();
  }
});

notesSaveBtnCode.addEventListener('click', () => {
  if (currentEditingSerial !== null) {
    customCodeNotes[currentEditingSerial] = notesTextareaCode.value;
    saveCodeNotes();
    render();
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
  if (activeView === 'plan')     { renderPlanView();     return; }
  if (activeView === 'patterns') { renderPatternsView(); return; }

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
      syncExpandAllBtn();
    });

    const body = card.querySelector('.section-body');

    // Table
    const table = document.createElement('table');
    table.className = 'prob-table';
    const colCount = 5 + (showLogicCol ? 1 : 0) + (showCodedCol ? 1 : 0); // checkboxes + star + problem + 2 notes + diff
    let theadHtml = '<thead><tr>';
    if (showLogicCol) theadHtml += '<th class="th-status" title="Logic solved">🧠</th>';
    if (showCodedCol) theadHtml += '<th class="th-status" title="Coded solution">💻</th>';
    theadHtml += '<th class="th-star">STAR</th><th>PROBLEM</th><th class="th-notes" title="Approach Notes">🧠 Notes</th><th class="th-notes" title="Code Tricks">&lt;/&gt; Code</th><th class="th-diff">DIFFICULTY</th></tr></thead>';
    table.innerHTML = theadHtml;
    const tbody = document.createElement('tbody');

    let lastSub = null;
    Object.entries(subs).forEach(([sub, probs]) => {
      if (sub !== lastSub) {
        lastSub = sub;
        const subRow = document.createElement('tr');
        subRow.className = 'subheading-row';
        subRow.innerHTML = `<td colspan="${colCount}"><div class="subheading"><span class="sub-label">${escHtml(sub)}</span><span class="sub-divider-line"></span></div></td>`;
        tbody.appendChild(subRow);
      }

      probs.forEach(p => {
        const isSolved  = solved.has(p.serial);
        const isStarred = starred.has(p.serial);
        const tr = document.createElement('tr');
        tr.className = `prob-row${isSolved ? ' solved' : ''}`;
        // always visible — no collapse by difficulty

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

        const approachNote = customNotes[p.serial] || '';
        const codeNote = customCodeNotes[p.serial] || '';
        const hasApproachNotes = approachNote.trim() ? 'has-notes' : '';
        const hasCodeNotes = codeNote.trim() ? 'has-notes has-code-notes' : '';
        const isCoded = coded.has(p.serial);

        let rowHtml = '';
        if (showLogicCol) rowHtml += `<td class="td-check"><input type="checkbox" class="prob-checkbox" data-serial="${p.serial}" ${isSolved ? 'checked' : ''}></td>`;
        if (showCodedCol) rowHtml += `<td class="td-check"><input type="checkbox" class="coded-checkbox" data-serial="${p.serial}" ${isCoded ? 'checked' : ''}></td>`;
        rowHtml += `
          <td class="td-star">
            <button class="star-btn ${isStarred ? 'starred' : ''}" data-serial="${p.serial}" title="${isStarred ? 'Unstar' : 'Star'}">${starIcon(isStarred)}</button>
          </td>
          <td class="td-name">${nameCell}</td>
          <td class="td-notes">
            <button class="note-btn approach-note-btn ${hasApproachNotes}" data-serial="${p.serial}" data-note-type="approach" title="Approach Notes">📝</button>
          </td>
          <td class="td-notes">
            <button class="note-btn code-note-btn ${hasCodeNotes}" data-serial="${p.serial}" data-note-type="code" title="Code Tricks & STL">&lt;/&gt;</button>
          </td>
          <td><span class="diff-badge ${diffClass}">${escHtml(p.difficulty)}</span></td>
        `;
        tr.innerHTML = rowHtml;

        // Note buttons
        tr.querySelectorAll('.note-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openNotesModal(p.serial, p.name, btn.dataset.noteType || 'approach');
          });
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

        // Logic Checkbox
        const logicCb = tr.querySelector('.prob-checkbox');
        if (logicCb) {
          logicCb.addEventListener('change', (e) => {
            if (e.target.checked) { solved.add(p.serial); tr.classList.add('solved'); }
            else                  { solved.delete(p.serial); tr.classList.remove('solved'); }
            saveSolved();
            updateStats();
            updateSectionProgress(card, heading);
          });
        }

        // Coded Checkbox
        const codedCb = tr.querySelector('.coded-checkbox');
        if (codedCb) {
          codedCb.addEventListener('change', (e) => {
            if (e.target.checked) coded.add(p.serial);
            else                  coded.delete(p.serial);
            saveCoded();
          });
        }

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

  // Sync expand-all button state
  syncExpandAllBtn();
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
   EXPAND / COLLAPSE ALL
   ========================================================= */
function syncExpandAllBtn() {
  const btn   = document.getElementById('expandAllBtn');
  const label = document.getElementById('expandAllLabel');
  const icon  = document.getElementById('expandAllIcon');
  if (!btn) return;

  const cardSel = activeView === 'plan' ? '.plan-day-card'
                : activeView === 'patterns' ? '.pattern-card'
                : '.section-card';
  const cards = document.querySelectorAll(cardSel);
  const anyOpen = [...cards].some(c => c.classList.contains('open'));
  allExpanded = anyOpen;
  if (anyOpen) {
    btn.classList.add('all-open');
    label.textContent = 'Collapse All';
    icon.innerHTML = '<polyline points="6 15 12 9 18 15"/>';
  } else {
    btn.classList.remove('all-open');
    label.textContent = 'Expand All';
    icon.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
  }
}

document.getElementById('expandAllBtn')?.addEventListener('click', () => {
  // Pick the right card class based on active view
  const cardSel = activeView === 'plan' ? '.plan-day-card'
                : activeView === 'patterns' ? '.pattern-card'
                : '.section-card';
  const cards = document.querySelectorAll(cardSel);
  const anyOpen = [...cards].some(c => c.classList.contains('open'));

  cards.forEach(card => {
    if (activeView === 'sheet') {
      const heading = card.dataset.heading;
      if (anyOpen) { card.classList.remove('open'); openHeadings.delete(heading); }
      else         { card.classList.add('open');    openHeadings.add(heading); }
    } else if (activeView === 'patterns') {
      // Expand/collapse both the pattern-card AND all inner pattern-groups
      if (anyOpen) {
        card.classList.remove('open');
        card.querySelectorAll('.pattern-group').forEach(g => g.classList.remove('open'));
      } else {
        card.classList.add('open');
        card.querySelectorAll('.pattern-group').forEach(g => g.classList.add('open'));
      }
    } else {
      if (anyOpen) card.classList.remove('open');
      else         card.classList.add('open');
    }
  });

  syncExpandAllBtn();
});

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
  filterDiffs.clear(); filterStatuses.clear(); filterTopic = ''; filterMatch = 'all'; filterHasNotes = false;
  document.getElementById('filterMatch').value = 'all';
  document.getElementById('topicFilter').value = '';
  // Deactivate all filter buttons (but NOT the Columns toggles — those persist)
  document.querySelectorAll('#diffFilter .multi-opt, #statusFilter .multi-opt, #notesFilter .multi-opt').forEach(b => b.classList.remove('active'));
  updateFilterBadge(); updateActiveChips(); render();
}

function updateFilterBadge() {
  const count = filterDiffs.size + filterStatuses.size + (filterTopic ? 1 : 0) + (filterHasNotes ? 1 : 0);
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
  if (filterHasNotes) addChip('Notes', 'Has Notes', () => {
    filterHasNotes = false;
    document.querySelector('#notesFilter .multi-opt[data-val="has-notes"]')?.classList.remove('active');
    updateFilterBadge(); updateActiveChips(); render();
  });
}

// Has-Notes filter
document.querySelectorAll('#notesFilter .multi-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    filterHasNotes = btn.classList.contains('active');
    updateFilterBadge(); updateActiveChips(); render();
  });
});

// Column visibility toggles
document.querySelectorAll('#columnsFilter .multi-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const col = btn.dataset.col;
    if (col === 'logic') showLogicCol = btn.classList.contains('active');
    if (col === 'coded') showCodedCol = btn.classList.contains('active');
    render();
  });
});

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
   ANKI EXPORT
   ========================================================= */
let ankiSelectedSerials = new Set();
let ankiSearchQ = '';
let ankiFilterSolved  = false;
let ankiFilterStarred = false;
let ankiFilterHasNotes = false;

const ANKI_LLM_PROMPT = [
  '===== ANKI CARD GENERATION INSTRUCTIONS =====',
  '',
  'You are creating Anki flashcards for DSA spaced repetition practice.',
  '',
  'WORKFLOW CONTEXT:',
  'The learner sees the card front, tries to mentally solve the problem completely from scratch,',
  'then flips to check the back. They rate themselves Again/Hard/Good/Easy.',
  'The card is a scheduling trigger — NOT a quiz.',
  '',
  'FRONT — EXACTLY this, nothing more:',
  '  <b>Problem Name</b>',
  '  Example: <b>Two Sum</b>',
  '  Do NOT add questions, hints, complexity, tags, or any other text to the front.',
  '',
  'BACK — include all sections that have content (skip empty ones):',
  '  <b>Difficulty:</b> Easy/Medium/Hard &nbsp;|&nbsp; <b>Topic:</b> ...<br>',
  '  <b>Approach:</b> ...<br>',
  '  <b>Key Insight:</b> ...<br>',
  '  <b>Code Tricks / STL:</b> ...<br>',
  '  <b>Edge Cases:</b> <ul><li>...</li><li>...</li></ul>',
  '',
  '  CRITICAL RULE: Do NOT include the Problem Link or Curator Notes anywhere in the Anki card.',
  '',
  '  FORMAT: HTML only. Use <b>, <br>, <ul>, <li>. No markdown at all.',
  '  Be thorough — the back is the complete reference.',
  '',
  'CSV FORMAT:',
  '  - Columns in this exact order: Front,Back,Tags',
  '  - Do NOT generate a header row. Start immediately with the first problem.',
  '  - One data row per problem',
  '  - Wrap every field in double quotes',
  '  - Escape any double-quote inside a field by doubling it: ""',
  '  - Never put a raw newline inside a quoted field — use <br> instead',
  '  - Tags: space-separated lowercase words from Topic + Difficulty',
  '    Example: "arrays easy"  or  "binary-search medium"  or  "graphs hard"',
  '',
  'OUTPUT: CSV only. No explanation, no code fences, nothing outside the CSV.'
].join('\n');

function buildAnkiProblemBlock(p) {
  const approachNote = (customNotes[p.serial] || '').trim();
  const codeNote     = (customCodeNotes[p.serial] || '').trim();
  return [
    `===== PROBLEM: ${p.name} =====`,
    `Serial   : ${p.serial}`,
    `Difficulty: ${p.difficulty}`,
    `Topic    : ${p.heading} > ${p.subheading}`,
    `Link     : ${(p.link || '').trim() || 'N/A'}`,
    `Curator Notes: ${p.notes || '(none)'}`,
    ``,
    `--- Approach Notes ---`,
    approachNote || '(none)',
    ``,
    `--- Code Tricks / STL Notes ---`,
    codeNote || '(none)',
    ``
  ].join('\n');
}

function buildAnkiExportText(serials) {
  const blocks = serials
    .map(s => ALL_PROBLEMS.find(p => p.serial === s))
    .filter(Boolean)
    .map(p => buildAnkiProblemBlock(p));
  return blocks.join('\n') + '\n\n' + ANKI_LLM_PROMPT;
}

function getAnkiFilteredProblems() {
  return ALL_PROBLEMS.filter(p => {
    if (isCompactMode && !CURATED_LIST.has(p.serial)) return false;
    if (ankiSearchQ && !p.name.toLowerCase().includes(ankiSearchQ.toLowerCase())) return false;
    if (ankiFilterSolved  && !solved.has(p.serial))  return false;
    if (ankiFilterStarred && !starred.has(p.serial)) return false;
    if (ankiFilterHasNotes) {
      const has = !!(customNotes[p.serial]?.trim()) || !!(customCodeNotes[p.serial]?.trim());
      if (!has) return false;
    }
    return true;
  });
}

function ankiPassesFilter(p) {
  if (ankiSearchQ && !p.name.toLowerCase().includes(ankiSearchQ.toLowerCase())) return false;
  if (ankiFilterSolved  && !solved.has(p.serial))  return false;
  if (ankiFilterStarred && !starred.has(p.serial)) return false;
  if (ankiFilterHasNotes) {
    const has = !!(customNotes[p.serial]?.trim()) || !!(customCodeNotes[p.serial]?.trim());
    if (!has) return false;
  }
  return true;
}

/* Build [{label, subLabel, probs}] array depending on active view */
function getAnkiGroupsForView() {
  if (activeView === 'plan') {
    const groups = [];
    PLAN_DATA.forEach(weekData => {
      weekData.days.forEach(dayData => {
        dayData.blocks.forEach(block => {
          if (!block.problems) return; // skip mock-only blocks
          const probs = block.problems
            .map(item => findProblem(item.name))
            .filter(Boolean)
            .filter(p => (isCompactMode ? CURATED_LIST.has(p.serial) : true) && ankiPassesFilter(p));
          if (probs.length === 0) return;
          groups.push({
            label: `Day ${dayData.day}`,
            subLabel: `Block ${block.label} — ${block.title}`,
            probs,
          });
        });
      });
    });
    return groups;
  }

  if (activeView === 'patterns') {
    const groups = [];
    PATTERN_DATA.forEach(patternData => {
      patternData.groups.forEach(group => {
        const probs = group.problems
          .map(item => findProblem(item.name))
          .filter(Boolean)
          .filter(p => (isCompactMode ? CURATED_LIST.has(p.serial) : true) && ankiPassesFilter(p));
        if (probs.length === 0) return;
        groups.push({
          label: `${patternData.id}. ${patternData.title}`,
          subLabel: group.title,
          probs,
        });
      });
    });
    return groups;
  }

  // Default: Sheet view — group by heading
  const byHeading = {};
  ALL_PROBLEMS.forEach(p => {
    if (isCompactMode && !CURATED_LIST.has(p.serial)) return;
    if (!ankiPassesFilter(p)) return;
    if (!byHeading[p.heading]) byHeading[p.heading] = [];
    byHeading[p.heading].push(p);
  });
  return Object.entries(byHeading).map(([heading, probs]) => ({
    label: heading,
    subLabel: null,
    probs,
  }));
}

function renderAnkiSelector() {
  const list = document.getElementById('ankiProblemList');
  list.innerHTML = '';

  const groups = getAnkiGroupsForView();

  if (groups.length === 0) {
    list.innerHTML = '<div class="anki-empty">No problems match your filters.</div>';
    return;
  }

  groups.forEach(({ label, subLabel, probs }) => {
    const groupEl = document.createElement('div');
    groupEl.className = 'anki-group';

    const allSel  = probs.every(p => ankiSelectedSerials.has(p.serial));
    const someSel = probs.some(p  => ankiSelectedSerials.has(p.serial));

    // Build header label — two lines when subLabel exists
    const subLabelHtml = subLabel
      ? `<span class="anki-group-sub">${escHtml(subLabel)}</span>`
      : '';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'anki-group-header';
    groupHeader.innerHTML = `
      <label class="anki-group-label">
        <input type="checkbox" class="anki-group-cb" ${allSel ? 'checked' : ''}>
        <span class="anki-group-name-wrap">
          <span class="anki-group-name">${escHtml(label)}</span>
          ${subLabelHtml}
        </span>
        <span class="anki-group-count">${probs.filter(p => ankiSelectedSerials.has(p.serial)).length}/${probs.length}</span>
      </label>`;

    const groupCb = groupHeader.querySelector('.anki-group-cb');
    groupCb.indeterminate = someSel && !allSel;

    groupCb.addEventListener('change', () => {
      probs.forEach(p => {
        if (groupCb.checked) ankiSelectedSerials.add(p.serial);
        else ankiSelectedSerials.delete(p.serial);
      });
      updateAnkiSelectedCount();
      renderAnkiSelector();
    });

    groupEl.appendChild(groupHeader);

    // Problem rows
    probs.forEach(p => {
      const isSelected  = ankiSelectedSerials.has(p.serial);
      const hasApproach = !!(customNotes[p.serial]?.trim());
      const hasCode     = !!(customCodeNotes[p.serial]?.trim());
      const isSolved    = solved.has(p.serial);
      const isStarred   = starred.has(p.serial);

      const row = document.createElement('label');
      row.className = `anki-problem-row${isSelected ? ' selected' : ''}`;
      row.innerHTML = `
        <input type="checkbox" class="anki-prob-cb" data-serial="${p.serial}" ${isSelected ? 'checked' : ''}>
        <span class="anki-prob-name">${escHtml(p.name)}</span>
        <span class="anki-prob-badges">
          ${isSolved    ? '<span class="anki-badge solved-badge" title="Solved">\u2713</span>' : ''}
          ${isStarred   ? '<span class="anki-badge star-badge"   title="Starred">\u2605</span>' : ''}
          ${hasApproach ? '<span class="anki-badge note-badge"   title="Has Approach Notes">\ud83e\udde0</span>' : ''}
          ${hasCode     ? '<span class="anki-badge code-badge"   title="Has Code Notes">&lt;/&gt;</span>' : ''}
          <span class="diff-badge diff-${p.difficulty.toLowerCase()}">${escHtml(p.difficulty)}</span>
        </span>`;

      const cb = row.querySelector('.anki-prob-cb');
      cb.addEventListener('change', e => {
        e.stopPropagation();
        if (e.target.checked) ankiSelectedSerials.add(p.serial);
        else ankiSelectedSerials.delete(p.serial);
        row.classList.toggle('selected', e.target.checked);
        updateAnkiSelectedCount();

        // Sync group header checkbox
        const gRows    = groupEl.querySelectorAll('.anki-prob-cb');
        const gAllSel  = [...gRows].every(c => c.checked);
        const gSomeSel = [...gRows].some(c => c.checked);
        groupCb.checked       = gAllSel;
        groupCb.indeterminate = gSomeSel && !gAllSel;
        groupEl.querySelector('.anki-group-count').textContent =
          `${groupEl.querySelectorAll('.anki-prob-cb:checked').length}/${probs.length}`;
      });

      groupEl.appendChild(row);
    });

    list.appendChild(groupEl);
  });
}


function updateAnkiSelectedCount() {
  const n = ankiSelectedSerials.size;
  document.getElementById('ankiSelectedCount').textContent =
    n === 0 ? 'No problems selected' : `${n} problem${n === 1 ? '' : 's'} selected`;
  document.getElementById('ankiGenerateBtn').disabled = n === 0;
}

function openAnkiModal() {
  ankiSelectedSerials.clear();
  ankiSearchQ = '';
  ankiFilterSolved = ankiFilterStarred = ankiFilterHasNotes = false;
  document.querySelectorAll('.anki-filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ankiSearch').value = '';
  updateAnkiSelectedCount();
  renderAnkiSelector();
  document.getElementById('ankiSelectorModal').classList.add('open');
}

function closeAnkiModal() {
  document.getElementById('ankiSelectorModal').classList.remove('open');
}

function openAnkiOutputModal(text) {
  document.getElementById('ankiOutputText').value = text;
  document.getElementById('ankiSelectorModal').classList.remove('open');
  const copyBtn = document.getElementById('ankiCopyBtn');
  copyBtn.textContent = 'Copy to Clipboard';
  copyBtn.classList.remove('copied');
  document.getElementById('ankiOutputModal').classList.add('open');
}

function closeAnkiOutputModal() {
  document.getElementById('ankiOutputModal').classList.remove('open');
}

// Event wiring — Anki
document.getElementById('ankiExportBtn').addEventListener('click', openAnkiModal);
document.getElementById('ankiSelectorClose').addEventListener('click', closeAnkiModal);
document.getElementById('ankiOutputClose').addEventListener('click', closeAnkiOutputModal);

document.getElementById('ankiBackBtn').addEventListener('click', () => {
  document.getElementById('ankiOutputModal').classList.remove('open');
  document.getElementById('ankiSelectorModal').classList.add('open');
});

document.getElementById('ankiSelectorModal').addEventListener('click', e => {
  if (e.target === document.getElementById('ankiSelectorModal')) closeAnkiModal();
});
document.getElementById('ankiOutputModal').addEventListener('click', e => {
  if (e.target === document.getElementById('ankiOutputModal')) closeAnkiOutputModal();
});

document.getElementById('ankiSearch').addEventListener('input', e => {
  ankiSearchQ = e.target.value.trim();
  renderAnkiSelector();
});

document.querySelectorAll('.anki-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const f = btn.dataset.filter;
    if (f === 'solved')    ankiFilterSolved    = btn.classList.contains('active');
    if (f === 'starred')   ankiFilterStarred   = btn.classList.contains('active');
    if (f === 'has-notes') ankiFilterHasNotes  = btn.classList.contains('active');
    renderAnkiSelector();
  });
});

document.getElementById('ankiSelectAll').addEventListener('click', () => {
  getAnkiFilteredProblems().forEach(p => ankiSelectedSerials.add(p.serial));
  updateAnkiSelectedCount();
  renderAnkiSelector();
});

document.getElementById('ankiSelectNone').addEventListener('click', () => {
  ankiSelectedSerials.clear();
  updateAnkiSelectedCount();
  renderAnkiSelector();
});

document.getElementById('ankiGenerateBtn').addEventListener('click', () => {
  openAnkiOutputModal(buildAnkiExportText([...ankiSelectedSerials]));
});

document.getElementById('ankiCopyBtn').addEventListener('click', async () => {
  const text = document.getElementById('ankiOutputText').value;
  const btn  = document.getElementById('ankiCopyBtn');
  const done = () => {
    btn.textContent = '\u2713 Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy to Clipboard'; btn.classList.remove('copied'); }, 2500);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    // Fallback
    document.getElementById('ankiOutputText').select();
    document.execCommand('copy');
    done();
  }
});

/* =========================================================
   VIEW SWITCHING
   ========================================================= */
let activeView = 'sheet'; // 'sheet' | 'plan' | 'patterns'

function switchView(view) {
  activeView = view;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.view === view);
  });

  const isSheet = view === 'sheet';

  // Show search + filter + random in all views; hide Sheet-only elements when needed
  // (All three views benefit from search/filter/random)
  ['searchBox', 'filterBtn', 'randomBtn', 'activeFilters'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  // Always close filter panel when switching views
  const filterPanel = document.getElementById('filterPanel');
  if (filterPanel) filterPanel.classList.remove('open');

  // Topic filter is only meaningful in Sheet view — hide it in other views
  const topicFilterRow = document.getElementById('topicFilter')?.closest('.filter-row');
  if (topicFilterRow) topicFilterRow.style.display = isSheet ? '' : 'none';

  // Compact toggle is only meaningful in Sheet view
  const modeToggleWrap = document.querySelector('.mode-toggle-wrap');
  if (modeToggleWrap) modeToggleWrap.style.display = isSheet ? '' : 'none';

  render();
}

document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

/* =========================================================
   NAME → SERIAL LOOKUP (with fix map for md name mismatches)
   ========================================================= */
const NAME_FIX_MAP = {
  'Best time to buy and sell stock IV *(finish/repair if needed)*': 'Best time to buy and sell stock IV',
  'Binary Search on Answer: Koko eating bananas': 'Koko eating bananas',
  'Coin Change 2 (DP-22)': 'Coin Change 2 (DP - 22)',
  'Count Square Submatrices with All Ones (DP-56)': 'Count Square Submatrices with All Ones|(DP-56)',
  'Find the number that appears once, and other numbers twice': 'Find the number that appears once, and other numbers twice.',
  'Longest subarray with given sum K (positives)': 'Longest subarray with given sum K(positives)',
  "Maximum Rectangle Area with all 1's (DP-55)": "Maximum Rectangle Area with all 1's|(DP-55)",
  'Middle of a LinkedList [Tortoise-Hare Method]': 'Middle of a LinkedList [TortoiseHare Method]',
  'Minimum Coins (DP-20)': 'Minimum Coins (DP - 20)',
  'Monotonic Stack: Largest rectangle in a histogram': 'Largest rectangle in a histogram',
  'Print matrix in spiral manner': 'Print the matrix in spiral manner',
  'Sliding Window: Minimum Window Substring': 'Minimum Window Substring',
  'Subset sum equal to target (DP-14)': 'Subset sum equal to target (DP- 14)',
  'Tree DP: Diameter of Binary Tree': 'Diameter of Binary Tree',
};

let _problemByName = null;
function problemByName() {
  if (!_problemByName) {
    _problemByName = {};
    ALL_PROBLEMS.forEach(p => { _problemByName[p.name.toLowerCase()] = p; });
  }
  return _problemByName;
}

function findProblem(mdName) {
  const canonical = NAME_FIX_MAP[mdName] || mdName;
  return problemByName()[canonical.toLowerCase()] || null;
}

/* =========================================================
   SHARED PROBLEM ROW BUILDER (used by Plan + Patterns views)
   ========================================================= */
function buildProblemTable(problems, container) {
  if (problems.length === 0) return;
  const colCount = 5 + (showLogicCol ? 1 : 0) + (showCodedCol ? 1 : 0);
  const table = document.createElement('table');
  table.className = 'prob-table';
  let theadHtml = '<thead><tr>';
  if (showLogicCol) theadHtml += '<th class="th-status" title="Logic solved">🧠</th>';
  if (showCodedCol) theadHtml += '<th class="th-status" title="Coded solution">💻</th>';
  theadHtml += '<th class="th-star">STAR</th><th>PROBLEM</th><th class="th-notes" title="Approach Notes">🧠 Notes</th><th class="th-notes" title="Code Tricks">&lt;/&gt; Code</th><th class="th-diff">DIFFICULTY</th></tr></thead>';
  table.innerHTML = theadHtml;
  const tbody = document.createElement('tbody');

  problems.forEach(item => {
    const p = findProblem(item.name);
    if (!p) return; // problem not in database — skip silently

    const isSolved  = solved.has(p.serial);
    const isStarred = starred.has(p.serial);
    const isCoded   = coded.has(p.serial);
    const approachNote = customNotes[p.serial] || '';
    const codeNote     = customCodeNotes[p.serial] || '';
    const hasApproachNotes = approachNote.trim() ? 'has-notes' : '';
    const hasCodeNotes     = codeNote.trim() ? 'has-notes has-code-notes' : '';

    const tr = document.createElement('tr');
    tr.className = `prob-row${isSolved ? ' solved' : ''}`;

    const url = (p.link || '').trim();
    const diffClass = `diff-${p.difficulty.toLowerCase()}`;
    let nameCell = url
      ? `<a class="prob-link" href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(p.name)}</a>`
      : `<span class="no-link">${escHtml(p.name)}</span>`;

    // Show priority badge from plan/pattern data
    if (item.priority) {
      nameCell = `<span class="priority-${item.priority}">${item.priority}</span> ` + nameCell;
    }

    let rowHtml = '';
    if (showLogicCol) rowHtml += `<td class="td-check"><input type="checkbox" class="prob-checkbox" data-serial="${p.serial}" ${isSolved ? 'checked' : ''}></td>`;
    if (showCodedCol) rowHtml += `<td class="td-check"><input type="checkbox" class="coded-checkbox" data-serial="${p.serial}" ${isCoded ? 'checked' : ''}></td>`;
    rowHtml += `
      <td class="td-star">
        <button class="star-btn ${isStarred ? 'starred' : ''}" data-serial="${p.serial}" title="${isStarred ? 'Unstar' : 'Star'}">${starIcon(isStarred)}</button>
      </td>
      <td class="td-name">${nameCell}</td>
      <td class="td-notes">
        <button class="note-btn approach-note-btn ${hasApproachNotes}" data-serial="${p.serial}" data-note-type="approach" title="Approach Notes">📝</button>
      </td>
      <td class="td-notes">
        <button class="note-btn code-note-btn ${hasCodeNotes}" data-serial="${p.serial}" data-note-type="code" title="Code Tricks &amp; STL">&lt;/&gt;</button>
      </td>
      <td><span class="diff-badge ${diffClass}">${escHtml(p.difficulty)}</span></td>
    `;
    tr.innerHTML = rowHtml;

    // Note buttons
    tr.querySelectorAll('.note-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openNotesModal(p.serial, p.name, btn.dataset.noteType || 'approach');
      });
    });

    // Logic checkbox
    const logicCb = tr.querySelector('.prob-checkbox');
    if (logicCb) {
      logicCb.addEventListener('change', e => {
        if (e.target.checked) { solved.add(p.serial); tr.classList.add('solved'); }
        else                  { solved.delete(p.serial); tr.classList.remove('solved'); }
        saveSolved();
        updateStats();
        // Update parent card progress text if present
        const card = tr.closest('.plan-day-card, .pattern-card');
        if (card) updateCardProgressText(card);
      });
    }

    // Coded checkbox
    const codedCb = tr.querySelector('.coded-checkbox');
    if (codedCb) {
      codedCb.addEventListener('change', e => {
        if (e.target.checked) coded.add(p.serial);
        else coded.delete(p.serial);
        saveCoded();
      });
    }

    // Star button
    tr.querySelector('.star-btn').addEventListener('click', e => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (starred.has(p.serial)) { starred.delete(p.serial); btn.classList.remove('starred'); btn.title = 'Star'; }
      else                       { starred.add(p.serial);    btn.classList.add('starred');    btn.title = 'Unstar'; }
      btn.innerHTML = starIcon(starred.has(p.serial));
      saveStarred();
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function updateCardProgressText(card) {
  const allProblems = [...card.querySelectorAll('.prob-checkbox')].map(cb => parseInt(cb.dataset.serial));
  const solvedCount = allProblems.filter(s => solved.has(s)).length;
  const total = allProblems.length;
  const el = card.querySelector('.plan-day-progress, .pattern-progress');
  if (el) el.textContent = `${solvedCount}/${total}`;
}

/* =========================================================
   30-DAY PLAN DATA
   ========================================================= */
const PLAN_DATA = [
  { week: 1, days: [
    { day: 1, title: 'Arrays + Binary Search + Stack/Queue foundations', blocks: [
      { label: 'A', title: 'Array fundamentals', problems: [
        {priority:'A',name:'Largest Element'},{priority:'A',name:'Remove duplicates from Sorted array'},
        {priority:'A',name:'Left Rotate Array by K Places'},{priority:'A',name:'Move Zeros to End'},
        {priority:'B',name:'Union of two sorted arrays'},{priority:'A',name:'Find missing number'},
        {priority:'A',name:'Find the number that appears once, and other numbers twice'},
      ]},
      { label: 'B', title: 'Binary Search fundamentals', problems: [
        {priority:'A',name:'Search X in sorted array'},{priority:'A',name:'Lower Bound'},
        {priority:'B',name:'Floor and Ceil in Sorted Array'},{priority:'A',name:'First and last occurrence'},
      ]},
      { label: 'C', title: 'Stack/Queue implementation', problems: [
        {priority:'A',name:'Implement Stack using Arrays'},{priority:'A',name:'Implement Queue using Arrays'},
        {priority:'A',name:'Implement Queue using Stack'},
      ]},
    ]},
    { day: 2, title: 'Recursion + Binary Trees + Modified Binary Search', blocks: [
      { label: 'A', title: 'Recursion basics', problems: [
        {priority:'A',name:'Pow(x, n)'},{priority:'B',name:'Sort a stack using recursion'},
        {priority:'A',name:'Generate Parentheses'},
      ]},
      { label: 'B', title: 'Tree traversal foundation', problems: [
        {priority:'A',name:'Pre, Post, Inorder in one traversal'},{priority:'A',name:'Preorder Traversal'},
        {priority:'A',name:'Inorder Traversal of Binary Tree'},{priority:'A',name:'Postorder Traversal'},
      ]},
      { label: 'C', title: 'Rotated/modified binary search', problems: [
        {priority:'A',name:'Search in rotated sorted array-I'},{priority:'B',name:'Search in rotated sorted array-II'},
        {priority:'A',name:'Find minimum in Rotated Sorted Array'},{priority:'B',name:'Single element in a Sorted Array'},
        {priority:'B',name:'Find peak element'},
      ]},
    ]},
    { day: 3, title: 'DP foundations + Linked List + Stack patterns', blocks: [
      { label: 'A', title: '1D DP', problems: [
        {priority:'A',name:'Climbing stairs'},{priority:'A',name:'Frog Jump'},
        {priority:'A',name:'House robber'},{priority:'B',name:"Ninja's training"},
      ]},
      { label: 'B', title: 'Linked-list pointer basics', problems: [
        {priority:'A',name:'Insertion at the head of Linked List'},{priority:'B',name:'Reverse a Doubly Linked List'},
        {priority:'A',name:'Middle of a LinkedList [Tortoise-Hare Method]'},
        {priority:'A',name:'Reverse a LinkedList [Iterative]'},{priority:'A',name:'Detect a loop in LL'},
      ]},
      { label: 'C', title: 'Stack foundations', problems: [
        {priority:'A',name:'Balanced Paranthesis'},{priority:'A',name:'Implement Min Stack'},
        {priority:'B',name:'Infix to Postfix Conversion'},{priority:'A',name:'Next Greater Element'},
      ]},
    ]},
    { day: 4, title: 'Bit Manipulation + Prefix Sum/Hashing', blocks: [
      { label: 'A', title: 'Bit fundamentals', problems: [
        {priority:'A',name:'Check if the i-th bit is Set or Not'},{priority:'A',name:'Check if a Number is Power of 2 or Not'},
        {priority:'A',name:'Count the Number of Set Bits'},{priority:'B',name:'Divide two numbers without multiplication and division'},
        {priority:'A',name:'XOR of numbers in a given range'},{priority:'A',name:'Single Number - III'},
        {priority:'C',name:'Print Prime Factors of a Number'},{priority:'C',name:'Count primes in range L to R'},
      ]},
      { label: 'B', title: 'Subarray state / hashing', problems: [
        {priority:'A',name:'Longest subarray with given sum K (positives)'},{priority:'A',name:'Longest subarray with sum K'},
        {priority:'A',name:'Count subarrays with given sum'},{priority:'A',name:'Two Sum'},
      ]},
      { label: 'C', title: 'Array partitioning', problems: [
        {priority:'A',name:"Sort an array of 0's 1's and 2's"},
      ]},
    ]},
    { day: 5, title: 'Strings + Tree Traversal + Backtracking foundations', blocks: [
      { label: 'A', title: 'String implementation', problems: [
        {priority:'A',name:'Remove Outermost Parentheses'},{priority:'A',name:'Reverse words in a given string / Palindrome Check'},
        {priority:'A',name:'Longest Common Prefix'},{priority:'A',name:'Isomorphic String'},
        {priority:'B',name:'Sort Characters by Frequency'},{priority:'A',name:'Roman to Integer'},
      ]},
      { label: 'B', title: 'Iterative tree traversal', problems: [
        {priority:'A',name:'Level Order Traversal'},{priority:'A',name:'Iterative Preorder Traversal of Binary Tree'},
        {priority:'A',name:'Iterative Inorder Traversal of Binary Tree'},{priority:'B',name:'Post-order Traversal of Binary Tree using 1 stack'},
        {priority:'A',name:'Maximum Depth in BT'},
      ]},
      { label: 'C', title: 'Backtracking', problems: [
        {priority:'A',name:'Combination Sum'},{priority:'B',name:'Combination Sum II'},{priority:'A',name:'Subsets I'},
      ]},
    ]},
    { day: 6, title: 'Greedy + Grid DP + Linked List continuation', blocks: [
      { label: 'A', title: 'Greedy foundations', problems: [
        {priority:'A',name:'Assign Cookies'},{priority:'A',name:'Fractional Knapsack'},
        {priority:'A',name:'Valid Paranthesis Checker'},{priority:'A',name:'N meetings in one room'},
        {priority:'A',name:'Jump Game - I'},{priority:'A',name:'Jump Game II'},
      ]},
      { label: 'B', title: 'Grid DP', problems: [
        {priority:'A',name:'Grid Unique Paths : DP on Grids (DP8)'},{priority:'B',name:'Minimum Falling Path Sum'},
        {priority:'B',name:'Ninja and his Friends'},
      ]},
      { label: 'C', title: 'Linked List', problems: [
        {priority:'A',name:'Find the starting point in LL'},{priority:'A',name:'Check if LL is palindrome or not'},
        {priority:'A',name:'Segregate odd and even nodes in Linked List'},{priority:'A',name:'Remove Nth node from the back of the LL'},
      ]},
    ]},
    { day: 7, title: 'Array optimization + Binary Search on Answer + Monotonic Stack', blocks: [
      { label: 'A', title: 'Array optimization', problems: [
        {priority:'A',name:'Majority Element-I'},{priority:'A',name:"Kadane's Algorithm"},
        {priority:'B',name:'Rearrange array elements by sign'},{priority:'A',name:'Next Permutation'},
        {priority:'A',name:'Longest Consecutive Sequence in an Array'},{priority:'B',name:'Set Matrix Zeroes'},
      ]},
      { label: 'B', title: 'Binary Search on Answer', problems: [
        {priority:'A',name:'Find square root of a number'},{priority:'A',name:'Koko eating bananas'},
        {priority:'A',name:'Minimum days to make M bouquets'},{priority:'A',name:'Capacity to Ship Packages Within D Days'},
      ]},
      { label: 'C', title: 'Monotonic stack', problems: [
        {priority:'A',name:'Trapping Rainwater'},{priority:'A',name:'Sum of Subarray Minimums'},
      ]},
    ]},
  ]},
  { week: 2, days: [
    { day: 8, title: 'BST + Tree recursion + Strings', blocks: [
      { label: 'A', title: 'BST invariant', problems: [
        {priority:'A',name:'Search in a Binary Search Tree'},{priority:'A',name:'Floor and Ceil in a BST'},
        {priority:'A',name:'Insert a given node in BST'},{priority:'B',name:'Delete a node in BST'},
        {priority:'A',name:'Kth Smallest and Largest element in BST'},{priority:'A',name:'Check if a tree is a BST or not'},
      ]},
      { label: 'B', title: 'Tree recursion', problems: [
        {priority:'A',name:'Check for balanced binary tree'},{priority:'A',name:'Diameter of Binary Tree'},
        {priority:'A',name:'Maximum path sum'},{priority:'B',name:'Zig Zag or Spiral Traversal'},
        {priority:'B',name:'Boundary Traversal'},
      ]},
      { label: 'C', title: 'String parsing', problems: [
        {priority:'A',name:'String to Integer (atoi)'},{priority:'A',name:'Longest Palindromic Substring'},
        {priority:'B',name:'Count and say'},
      ]},
    ]},
    { day: 9, title: 'Sliding Window + Backtracking + Greedy intervals', blocks: [
      { label: 'A', title: 'Sliding Window core', problems: [
        {priority:'A',name:'Longest Substring Without Repeating Characters'},{priority:'A',name:'Max Consecutive Ones III'},
        {priority:'A',name:'Longest Repeating Character Replacement'},
      ]},
      { label: 'B', title: 'Backtracking', problems: [
        {priority:'A',name:'Subsets II'},{priority:'A',name:'Letter Combinations of a Phone Number'},
        {priority:'A',name:'Palindrome partitioning'},{priority:'A',name:'Word Search'},
      ]},
      { label: 'C', title: 'Greedy intervals', problems: [
        {priority:'A',name:'Minimum number of platforms required for a railway'},{priority:'A',name:'Job sequencing Problem'},
        {priority:'A',name:'Candy'},{priority:'A',name:'Insert Interval'},{priority:'A',name:'Non-overlapping Intervals'},
      ]},
    ]},
    { day: 10, title: 'Arrays + Advanced Binary Search', blocks: [
      { label: 'A', title: 'Matrix / array patterns', problems: [
        {priority:'A',name:'Rotate matrix by 90 degrees'},{priority:'A',name:'Print the matrix in spiral manner'},
        {priority:'A',name:'Count subarrays with given sum'},{priority:'B',name:"Pascal's Triangle I"},
        {priority:'A',name:'Majority Element-II'},{priority:'A',name:'3 Sum'},
      ]},
      { label: 'B', title: 'Binary Search variants', problems: [
        {priority:'A',name:'Kth Missing Positive Number'},{priority:'A',name:'Aggressive Cows'},
        {priority:'B',name:'Minimize Max Distance to Gas Station'},{priority:'B',name:'Median of 2 sorted arrays'},
      ]},
      { label: 'C', title: '2D search', problems: [
        {priority:'A',name:'Search in a 2D matrix'},{priority:'B',name:'Search in 2D matrix - II'},
      ]},
    ]},
    { day: 11, title: 'Tree views/path patterns + BST advanced', blocks: [
      { label: 'A', title: 'Tree views', problems: [
        {priority:'B',name:'Vertical Order Traversal'},{priority:'B',name:'Top View of BT'},
        {priority:'B',name:'Right/Left View of Binary Tree'},{priority:'A',name:'Symmetric Binary Tree'},
      ]},
      { label: 'B', title: 'Tree path/ancestor patterns', problems: [
        {priority:'A',name:'Print root to leaf path in BT'},{priority:'A',name:'LCA in BT'},
      ]},
      { label: 'C', title: 'BST advanced', problems: [
        {priority:'A',name:'LCA in BST'},{priority:'B',name:'Construct a BST from a preorder traversal'},
        {priority:'B',name:'Inorder Successor/Predecessor in BST'},{priority:'B',name:'Two Sum In BST | Check if there exists a pair with Sum K'},
        {priority:'C',name:'Correct BST with two nodes swapped'},{priority:'C',name:'Largest BST in Binary Tree'},
      ]},
    ]},
    { day: 12, title: 'Graph fundamentals + Monotonic Stack', blocks: [
      { label: 'A', title: 'Graph traversal', problems: [
        {priority:'A',name:'Traversal Techniques'},{priority:'A',name:'DFS'},{priority:'A',name:'Number of provinces'},
        {priority:'A',name:'Rotten Oranges'},{priority:'A',name:'Cycle Detection in Undirected Graph (bfs)'},
        {priority:'A',name:'Distance of nearest cell having one'},{priority:'B',name:'Surrounded Regions'},
        {priority:'A',name:'Number of islands'},
      ]},
      { label: 'B', title: 'Graph-on-grid / BFS application', problems: [
        {priority:'B',name:'Word ladder I'},
      ]},
      { label: 'C', title: 'Monotonic stack', problems: [
        {priority:'A',name:'Asteroid Collision'},{priority:'A',name:'Remove K Digits'},
        {priority:'A',name:'Largest rectangle in a histogram'},{priority:'A',name:'Maximum Rectangles'},
      ]},
    ]},
    { day: 13, title: 'Subset/Knapsack DP + Sliding Window completion', blocks: [
      { label: 'A', title: '0/1 subset DP', problems: [
        {priority:'A',name:'Subset sum equal to target (DP-14)'},{priority:'A',name:'Partition a set into two subsets with minimum absolute sum difference'},
        {priority:'A',name:'Count subsets with sum K'},
      ]},
      { label: 'B', title: 'Unbounded knapsack', problems: [
        {priority:'A',name:'Minimum Coins (DP-20)'},{priority:'A',name:'Coin Change 2 (DP-22)'},{priority:'B',name:'Unbounded knapsack'},
      ]},
      { label: 'C', title: 'Sliding Window advanced', problems: [
        {priority:'A',name:'Binary Subarrays With Sum'},{priority:'A',name:'Number of Substrings Containing All Three Characters'},
        {priority:'A',name:'Maximum Points You Can Obtain from Cards'},{priority:'A',name:'Longest Substring With At Most K Distinct Characters'},
        {priority:'A',name:'Minimum Window Substring'},
      ]},
    ]},
    { day: 14, title: 'Graph cycles/topological sort + Stack/Queue design', blocks: [
      { label: 'A', title: 'Directed graph patterns', problems: [
        {priority:'A',name:'Bipartite Graph (DFS)'},{priority:'A',name:'Cycle Detection in Directed Graph (DFS)'},
        {priority:'A',name:'Topo Sort'},{priority:'A',name:'Topological sort or Kahn\'s algorithm'},
        {priority:'A',name:'Course Schedule I'},{priority:'A',name:'Find eventual safe states'},{priority:'B',name:'Alien Dictionary'},
      ]},
      { label: 'B', title: 'Data-structure design', problems: [
        {priority:'A',name:'Sliding Window Maximum'},{priority:'B',name:'Celebrity Problem'},{priority:'B',name:'LRU Cache'},
      ]},
    ]},
  ]},
  { week: 3, days: [
    { day: 15, title: 'Heaps + String matching + DP strings', blocks: [
      { label: 'A', title: 'Heap fundamentals', problems: [
        {priority:'A',name:'Implement Min Heap'},{priority:'A',name:'K-th Largest element in an array'},
        {priority:'A',name:'Sort K sorted array'},{priority:'A',name:'Merge K sorted Lists'},{priority:'B',name:'Task Scheduler'},
      ]},
      { label: 'B', title: 'String pattern matching', problems: [
        {priority:'B',name:'Rabin Karp Algorithm'},{priority:'B',name:'Z function'},
        {priority:'A',name:'KMP Algorithm or LPS array'},{priority:'B',name:'Shortest Palindrome'},
      ]},
      { label: 'C', title: 'DP transition', problems: [
        {priority:'A',name:'Longest common subsequence'},{priority:'A',name:'Longest common substring'},
        {priority:'A',name:'Longest palindromic subsequence'},
      ]},
    ]},
    { day: 16, title: 'Shortest Paths + Heap variants', blocks: [
      { label: 'A', title: 'Shortest-path progression', problems: [
        {priority:'A',name:'Shortest path in undirected graph with unit weights'},{priority:'B',name:'Shortest path in DAG'},
        {priority:'A',name:'Djisktra\'s Algorithm'},{priority:'B',name:'Path with minimum effort'},
        {priority:'B',name:'Cheapest flight within K stops'},{priority:'B',name:'Number of ways to arrive at destination'},
      ]},
      { label: 'B', title: 'Heap applications', problems: [
        {priority:'B',name:'Design Twitter'},{priority:'A',name:'Kth largest element in a stream of running integers'},
        {priority:'A',name:'Find Median from Data Stream'},{priority:'A',name:'Top K Frequent Elements'},
      ]},
    ]},
    { day: 17, title: 'All-pairs/negative-weight shortest path + String DP', blocks: [
      { label: 'A', title: 'Advanced shortest paths', problems: [
        {priority:'B',name:'Bellman Ford Algorithm'},{priority:'B',name:'Floyd warshall algorithm'},
        {priority:'B',name:'Find the city with the smallest number of neighbors'},
      ]},
      { label: 'B', title: 'MST', problems: [
        {priority:'A',name:"Prim's Algorithm"},{priority:'A',name:'Disjoint Set'},{priority:'A',name:'Find the MST weight'},
      ]},
      { label: 'C', title: 'String DP', problems: [
        {priority:'A',name:'Minimum insertions or deletions to convert string A to B'},
      ]},
    ]},
    { day: 18, title: 'DSU applications + Graph connectivity', blocks: [
      { label: 'A', title: 'DSU applications', problems: [
        {priority:'A',name:'Number of operations to make network connected'},{priority:'A',name:'Most stones removed with same row or column'},
        {priority:'A',name:'Accounts merge'},{priority:'B',name:'Making a large island'},
      ]},
      { label: 'B', title: 'Timed implementation drill', mock: 'Re-implement DSU from scratch:\n- Path compression\n- Union by size/rank\n- Component counting\n\nNo new problem required.' },
    ]},
    { day: 19, title: 'Trie + String DP', blocks: [
      { label: 'A', title: 'Trie', problems: [
        {priority:'A',name:'Trie Implementation and Operations'},{priority:'B',name:'Longest Word with All Prefixes'},
        {priority:'B',name:'Number of distinct substrings in a string'},{priority:'B',name:'Maximum XOR of two numbers in an array'},
        {priority:'B',name:'Maximum Xor with an element from an array'},
      ]},
      { label: 'B', title: 'String DP', problems: [
        {priority:'A',name:'Distinct subsequences'},{priority:'A',name:'Edit distance'},{priority:'B',name:'Wildcard matching'},
      ]},
      { label: 'C', title: 'Stock DP', problems: [
        {priority:'A',name:'Best time to buy and sell stock II'},
      ]},
    ]},
    { day: 20, title: 'Stock DP + LIS family', blocks: [
      { label: 'A', title: 'Stock state DP', problems: [
        {priority:'A',name:'Best Time to Buy and Sell Stock with Cooldown'},
        {priority:'B',name:'Best time to buy and sell stock IV *(finish/repair if needed)*'},
      ]},
      { label: 'B', title: 'LIS family', problems: [
        {priority:'A',name:'Longest Increasing Subsequence'},{priority:'A',name:'Longest Increasing Subsequence |(DP-43)'},
        {priority:'B',name:'Largest Divisible Subset'},{priority:'B',name:'Longest Bitonic Subsequence'},
      ]},
    ]},
  ]},
  { week: 4, days: [
    { day: 21, title: 'Interval DP + mixed high-value reinforcement', blocks: [
      { label: 'A', title: 'Interval/partition DP', problems: [
        {priority:'C',name:'Matrix chain multiplication'},{priority:'C',name:'Minimum cost to cut the stick'},{priority:'C',name:'Burst balloons'},
      ]},
      { label: 'B', title: 'High-value transfer', mock: 'Solve one from each family with topic label hidden:\n- Binary Search on Answer: Koko eating bananas\n- Sliding Window: Minimum Window Substring\n- Monotonic Stack: Largest rectangle in a histogram\n- Tree DP: Diameter of Binary Tree' },
      { label: 'C', title: 'Optional advanced DP', mock: 'Study only if Block A and B are secure.' },
    ]},
    { day: 22, title: 'Trees: finish structural problems', blocks: [
      { label: 'A', title: 'Tree structure', problems: [
        {priority:'A',name:'Maximum Width of BT'},{priority:'A',name:'Print all nodes at a distance of K in BT'},
        {priority:'B',name:'Count total nodes in a complete BT'},
      ]},
      { label: 'B', title: 'Construction / serialization', problems: [
        {priority:'B',name:'Construct a BT from Preorder and Inorder'},{priority:'B',name:'Serialize and De-serialize BT'},
        {priority:'B',name:'Flatten Binary Tree to Linked List'},
      ]},
      { label: 'C', title: 'Advanced traversal', problems: [
        {priority:'C',name:'Morris Preorder Traversal of a Binary Tree'},
      ]},
    ]},
    { day: 23, title: 'Arrays: high-value advanced family', blocks: [
      { label: 'A', title: 'Prefix/XOR/interval', problems: [
        {priority:'A',name:'Count subarrays with given xor K'},{priority:'A',name:'Merge Overlapping Subintervals'},
        {priority:'B',name:'Merge two sorted arrays without extra space'},
      ]},
      { label: 'B', title: 'Transfer drill', mock: 'Solve one unseen/less-familiar problem from your completed list with the topic label hidden.' },
    ]},
    { day: 24, title: 'Arrays: advanced algorithms', blocks: [
      { label: 'A', title: 'Advanced array', problems: [
        {priority:'B',name:'Find the repeating and missing number'},{priority:'C',name:'Reverse Pairs'},
        {priority:'B',name:'Maximum Product Subarray in an Array'},
      ]},
      { label: 'B', title: 'Placement-style mixed set', mock: 'Solve 3 problems chosen randomly from your completed list, with topic labels hidden.' },
    ]},
    { day: 25, title: 'Linked List: advanced manipulation', blocks: [
      { label: 'A', title: 'Advanced LL', problems: [
        {priority:'B',name:'Sort LL'},{priority:'A',name:'Find the intersection point of Y LL'},
        {priority:'B',name:'Add two numbers in Linked List'},
      ]},
      { label: 'B', title: 'LL patterns', problems: [
        {priority:'B',name:'Reverse LL in group of given size K'},{priority:'B',name:'Rotate a LL'},
        {priority:'C',name:'Flattening of LL'},
      ]},
    ]},
    { day: 26, title: 'Advanced Linked List + Backtracking reserve', blocks: [
      { label: 'A', title: 'Advanced LL structure', problems: [
        {priority:'C',name:'Clone a LL with random and next pointer'},
      ]},
      { label: 'B', title: 'Backtracking reserve', problems: [
        {priority:'B',name:'N Queen'},{priority:'B',name:'Word Break'},
        {priority:'C',name:'M Coloring Problem'},{priority:'C',name:'Sudoku Solver'},
      ]},
      { label: 'C', title: 'Short timed mixed set', mock: 'Solve 2 randomly selected A/B problems from earlier weeks with topic labels hidden.' },
    ]},
    { day: 27, title: 'Graph advanced connectivity + DP finish', blocks: [
      { label: 'A', title: 'Advanced graph', problems: [
        {priority:'B',name:'Swim in Rising Water'},{priority:'C',name:'Bridges in graph'},
        {priority:'C',name:'Articulation point in graph'},{priority:"C",name:"Kosaraju's algorithm"},
      ]},
      { label: 'B', title: 'DP finish', problems: [
        {priority:'C',name:'Palindrome partitioning II'},{priority:'B',name:"Maximum Rectangle Area with all 1's (DP-55)"},
        {priority:'B',name:'Count Square Submatrices with All Ones (DP-56)'},
      ]},
      { label: 'C', title: 'Mixed test', mock: 'Solve 3 topic-hidden problems from your A/B pool.' },
    ]},
    { day: 28, title: 'Placement Mock 1', blocks: [
      { label: 'A', title: 'Timed mock — 6 problems', mock: 'Complete a timed mixed set of 6 problems (topic labels hidden):\n1. Array / Hashing\n2. Binary Search\n3. Sliding Window / Two Pointer\n4. Stack / Heap / Linked List\n5. Tree / Graph\n6. DP\n\nAfter the mock, classify every failure:\n- Pattern not recognized\n- Correct pattern, wrong implementation\n- Edge-case error\n- Complexity error\n- Incomplete DP transition\n- Time-management failure' },
    ]},
    { day: 29, title: 'Placement Mock 2 + targeted repair', blocks: [
      { label: 'A', title: 'Timed mock — 6 problems', mock: 'Complete 6 topic-hidden problems. Use a different difficulty mix from Day 28.' },
      { label: 'B', title: 'Repair', mock: 'For every problem missed in Day 28/29:\n1. State the pattern in one sentence.\n2. State the invariant/state/transition.\n3. Re-code the solution from scratch.' },
    ]},
    { day: 30, title: 'Final placement simulation', blocks: [
      { label: 'A', title: 'Final mock — 8 problems', mock: 'Complete 8 topic-hidden problems under realistic placement conditions:\n1. Arrays / Hashing\n2. Binary Search\n3. Sliding Window / Two Pointer\n4. Stack / Queue / Heap\n5. Linked List\n6. Trees / BST\n7. Graphs\n8. DP' },
      { label: 'B', title: 'Final pattern audit', mock: 'Write down the patterns you can recognize without prompting.\n\nYour final revision list should be based on patterns you still fail to recognize — not on the raw number of problems solved.' },
    ]},
  ]},
];

/* =========================================================
   PATTERN DATA
   ========================================================= */
const PATTERN_DATA = [
  { id: 1, title: 'Arrays & Hashing', groups: [
    { title: 'In-place array manipulation / partitioning', problems: [
      {priority:'A',name:'Remove duplicates from Sorted array'},{priority:'A',name:'Move Zeros to End'},
      {priority:'A',name:"Sort an array of 0's 1's and 2's"},{priority:'B',name:'Rearrange array elements by sign'},
      {priority:'A',name:'Next Permutation'},{priority:'A',name:'Left Rotate Array by K Places'},
    ]},
    { title: 'Hash lookup / complement / prefix-state lookup', cue: 'The current answer depends on information seen earlier; ask whether a hash table can remember the needed state.', problems: [
      {priority:'A',name:'Two Sum'},{priority:'A',name:'Longest subarray with given sum K (positives)'},
      {priority:'A',name:'Longest subarray with sum K'},{priority:'A',name:'Count subarrays with given sum'},
      {priority:'A',name:'Count subarrays with given xor K'},{priority:'A',name:'Longest Consecutive Sequence in an Array'},
    ]},
    { title: 'Kadane / running subarray optimum', problems: [
      {priority:'A',name:"Kadane's Algorithm"},{priority:'B',name:'Maximum Product Subarray in an Array'},
    ]},
    { title: 'Majority / voting', problems: [
      {priority:'A',name:'Majority Element-I'},{priority:'A',name:'Majority Element-II'},
    ]},
    { title: 'Matrix manipulation / simulation', problems: [
      {priority:'B',name:'Set Matrix Zeroes'},{priority:'A',name:'Rotate matrix by 90 degrees'},
      {priority:'A',name:'Print the matrix in spiral manner'},{priority:'B',name:"Pascal's Triangle I"},
    ]},
    { title: 'Sorting / merging / intervals', problems: [
      {priority:'A',name:'Merge Overlapping Subintervals'},{priority:'A',name:'Merge two sorted arrays without extra space'},
    ]},
    { title: 'Missing / repeating / XOR tricks', problems: [
      {priority:'A',name:'Find missing number'},{priority:'A',name:'Find the number that appears once, and other numbers twice'},
      {priority:'B',name:'Find the repeating and missing number'},
    ]},
    { title: 'Advanced array algorithms', problems: [
      {priority:'C',name:'Reverse Pairs'},{priority:'A',name:'3 Sum'},
      {priority:'A',name:'Largest Element'},{priority:'B',name:'Union of two sorted arrays'},
    ]},
  ]},
  { id: 2, title: 'Binary Search', groups: [
    { title: 'Basic boundary search', problems: [
      {priority:'A',name:'Search X in sorted array'},{priority:'A',name:'Lower Bound'},
      {priority:'B',name:'Floor and Ceil in Sorted Array'},{priority:'A',name:'First and last occurrence'},
    ]},
    { title: 'Rotated / modified sorted arrays', problems: [
      {priority:'A',name:'Search in rotated sorted array-I'},{priority:'B',name:'Search in rotated sorted array-II'},
      {priority:'A',name:'Find minimum in Rotated Sorted Array'},{priority:'B',name:'Single element in a Sorted Array'},
      {priority:'B',name:'Find peak element'},
    ]},
    { title: 'Binary search over a 2D / search space', problems: [
      {priority:'A',name:'Search in a 2D matrix'},{priority:'B',name:'Search in 2D matrix - II'},
      {priority:'B',name:'Median of 2 sorted arrays'},
    ]},
    { title: 'Binary search on answer / monotonic feasibility', cue: 'The answer itself is hard to construct directly, but you can efficiently test whether a candidate answer is feasible, and feasibility changes monotonically.', problems: [
      {priority:'A',name:'Find square root of a number'},{priority:'A',name:'Koko eating bananas'},
      {priority:'A',name:'Minimum days to make M bouquets'},{priority:'A',name:'Capacity to Ship Packages Within D Days'},
      {priority:'A',name:'Kth Missing Positive Number'},{priority:'A',name:'Aggressive Cows'},
      {priority:'B',name:'Minimize Max Distance to Gas Station'},
    ]},
  ]},
  { id: 3, title: 'Sliding Window & Two Pointers', groups: [
    { title: 'Variable sliding window', problems: [
      {priority:'A',name:'Longest Substring Without Repeating Characters'},{priority:'A',name:'Max Consecutive Ones III'},
      {priority:'A',name:'Longest Repeating Character Replacement'},{priority:'A',name:'Longest Substring With At Most K Distinct Characters'},
      {priority:'A',name:'Minimum Window Substring'},
    ]},
    { title: 'Counting / exact-window variants', problems: [
      {priority:'A',name:'Binary Subarrays With Sum'},{priority:'A',name:'Number of Substrings Containing All Three Characters'},
    ]},
    { title: 'Complement / shrinking-window variant', problems: [
      {priority:'A',name:'Maximum Points You Can Obtain from Cards'},
    ]},
    { title: 'Two-pointer array reasoning', cue: 'Maintain a contiguous or ordered region and update it incrementally instead of recomputing the whole range.', problems: [
      {priority:'A',name:'3 Sum'},{priority:'B',name:'Merge two sorted arrays without extra space'},
    ]},
  ]},
  { id: 4, title: 'Strings', groups: [
    { title: 'Parsing / simulation', problems: [
      {priority:'A',name:'Remove Outermost Parentheses'},{priority:'A',name:'Reverse words in a given string / Palindrome Check'},
      {priority:'A',name:'Roman to Integer'},{priority:'A',name:'String to Integer (atoi)'},{priority:'B',name:'Count and say'},
    ]},
    { title: 'Character mapping / frequency', problems: [
      {priority:'A',name:'Isomorphic String'},{priority:'B',name:'Sort Characters by Frequency'},{priority:'A',name:'Longest Common Prefix'},
    ]},
    { title: 'Palindrome', problems: [
      {priority:'A',name:'Longest Palindromic Substring'},{priority:'B',name:'Shortest Palindrome'},
    ]},
    { title: 'String pattern matching', cue: 'Substring/pattern occurrence problem where naive repeated matching is too slow.', problems: [
      {priority:'B',name:'Rabin Karp Algorithm'},{priority:'B',name:'Z function'},{priority:'A',name:'KMP Algorithm or LPS array'},
    ]},
  ]},
  { id: 5, title: 'Linked List', groups: [
    { title: 'Fast/slow pointer', problems: [
      {priority:'A',name:'Middle of a LinkedList [Tortoise-Hare Method]'},{priority:'A',name:'Detect a loop in LL'},
      {priority:'A',name:'Find the starting point in LL'},{priority:'A',name:'Check if LL is palindrome or not'},
      {priority:'A',name:'Remove Nth node from the back of the LL'},
    ]},
    { title: 'Reversal / pointer rewiring', problems: [
      {priority:'A',name:'Reverse a LinkedList [Iterative]'},{priority:'B',name:'Reverse a Doubly Linked List'},
      {priority:'B',name:'Reverse LL in group of given size K'},{priority:'B',name:'Rotate a LL'},
    ]},
    { title: 'Intersection / merge / ordering', problems: [
      {priority:'A',name:'Find the intersection point of Y LL'},{priority:'B',name:'Sort LL'},
      {priority:'A',name:'Segregate odd and even nodes in Linked List'},
    ]},
    { title: 'Arithmetic / simulation', problems: [
      {priority:'B',name:'Add two numbers in Linked List'},
    ]},
    { title: 'Basic / advanced structure', cue: 'Think pointer invariants first; dummy node, fast/slow pointers, reversal, or pointer splicing usually drives the solution.', problems: [
      {priority:'A',name:'Insertion at the head of Linked List'},{priority:'C',name:'Flattening of LL'},
      {priority:'C',name:'Clone a LL with random and next pointer'},
    ]},
  ]},
  { id: 6, title: 'Recursion & Backtracking', groups: [
    { title: 'Pure recursion', problems: [
      {priority:'A',name:'Pow(x, n)'},{priority:'B',name:'Sort a stack using recursion'},
    ]},
    { title: 'Pick / skip / generate', problems: [
      {priority:'A',name:'Generate Parentheses'},{priority:'A',name:'Subsets I'},{priority:'A',name:'Subsets II'},
      {priority:'A',name:'Combination Sum'},{priority:'B',name:'Combination Sum II'},
      {priority:'A',name:'Letter Combinations of a Phone Number'},
    ]},
    { title: 'Constraint backtracking', problems: [
      {priority:'B',name:'N Queen'},{priority:'C',name:'Sudoku Solver'},{priority:'C',name:'M Coloring Problem'},
      {priority:'A',name:'Word Search'},
    ]},
    { title: 'Partition / segmentation recursion', cue: 'Make a choice → recurse on the remaining state → undo/advance the choice. Add memoization when the same state repeats.', problems: [
      {priority:'A',name:'Palindrome partitioning'},{priority:'B',name:'Word Break'},
    ]},
  ]},
  { id: 7, title: 'Bit Manipulation', groups: [
    { title: 'Basic bit operations', problems: [
      {priority:'A',name:'Check if the i-th bit is Set or Not'},{priority:'A',name:'Check if a Number is Power of 2 or Not'},
      {priority:'A',name:'Count the Number of Set Bits'},{priority:'B',name:'Divide two numbers without multiplication and division'},
    ]},
    { title: 'XOR', problems: [
      {priority:'A',name:'XOR of numbers in a given range'},{priority:'A',name:'Single Number - III'},
    ]},
    { title: 'Number theory / utility', problems: [
      {priority:'C',name:'Print Prime Factors of a Number'},{priority:'C',name:'Count primes in range L to R'},
    ]},
  ]},
  { id: 8, title: 'Stack & Queue', groups: [
    { title: 'Basic data structures', problems: [
      {priority:'A',name:'Implement Stack using Arrays'},{priority:'A',name:'Implement Queue using Arrays'},
      {priority:'A',name:'Implement Queue using Stack'},{priority:'A',name:'Implement Min Stack'},
    ]},
    { title: 'Parentheses / expressions', problems: [
      {priority:'A',name:'Balanced Paranthesis'},{priority:'B',name:'Infix to Postfix Conversion'},
      {priority:'A',name:'Valid Paranthesis Checker'},
    ]},
    { title: 'Monotonic stack', cue: 'When the problem repeatedly asks for next greater/smaller information or a contribution from the nearest dominating element, consider a monotonic structure.', problems: [
      {priority:'A',name:'Next Greater Element'},{priority:'A',name:'Trapping Rainwater'},
      {priority:'A',name:'Sum of Subarray Minimums'},{priority:'A',name:'Asteroid Collision'},
      {priority:'A',name:'Remove K Digits'},{priority:'A',name:'Largest rectangle in a histogram'},
      {priority:'A',name:'Maximum Rectangles'},
    ]},
    { title: 'Monotonic deque', problems: [
      {priority:'A',name:'Sliding Window Maximum'},
    ]},
    { title: 'Design', problems: [
      {priority:'B',name:'LRU Cache'},{priority:'B',name:'Celebrity Problem'},
    ]},
  ]},
  { id: 9, title: 'Heaps', groups: [
    { title: 'Top-K / Kth element', problems: [
      {priority:'A',name:'K-th Largest element in an array'},{priority:'A',name:'Kth largest element in a stream of running integers'},
      {priority:'A',name:'Top K Frequent Elements'},
    ]},
    { title: 'K-way merge / partially sorted input', problems: [
      {priority:'A',name:'Sort K sorted array'},{priority:'A',name:'Merge K sorted Lists'},
    ]},
    { title: 'Two heaps', problems: [
      {priority:'A',name:'Find Median from Data Stream'},
    ]},
    { title: 'Heap-based scheduling / design', problems: [
      {priority:'B',name:'Task Scheduler'},{priority:'B',name:'Design Twitter'},
    ]},
    { title: 'Heap mechanics', cue: 'Repeatedly need the current minimum/maximum among changing candidates, top K elements, or the next item from multiple sorted sources.', problems: [
      {priority:'A',name:'Implement Min Heap'},
    ]},
  ]},
  { id: 10, title: 'Greedy', groups: [
    { title: 'Interval scheduling', problems: [
      {priority:'A',name:'N meetings in one room'},{priority:'A',name:'Insert Interval'},
      {priority:'A',name:'Non-overlapping Intervals'},{priority:'A',name:'Minimum number of platforms required for a railway'},
    ]},
    { title: 'Resource allocation', problems: [
      {priority:'A',name:'Job sequencing Problem'},{priority:'A',name:'Fractional Knapsack'},{priority:'A',name:'Assign Cookies'},
    ]},
    { title: 'Reachability / jump greedy', problems: [
      {priority:'A',name:'Jump Game - I'},{priority:'A',name:'Jump Game II'},
    ]},
    { title: 'Other greedy-choice problems', cue: 'After sorting or establishing an invariant, a locally optimal decision can be shown to preserve the global optimum.', problems: [
      {priority:'A',name:'Valid Paranthesis Checker'},{priority:'A',name:'Candy'},
    ]},
  ]},
  { id: 11, title: 'Binary Trees', groups: [
    { title: 'Traversal family', problems: [
      {priority:'A',name:'Preorder Traversal'},{priority:'A',name:'Inorder Traversal of Binary Tree'},
      {priority:'A',name:'Postorder Traversal'},{priority:'A',name:'Pre, Post, Inorder in one traversal'},
      {priority:'A',name:'Iterative Preorder Traversal of Binary Tree'},{priority:'A',name:'Iterative Inorder Traversal of Binary Tree'},
      {priority:'B',name:'Post-order Traversal of Binary Tree using 1 stack'},{priority:'A',name:'Level Order Traversal'},
      {priority:'C',name:'Morris Preorder Traversal of a Binary Tree'},
    ]},
    { title: 'Tree DFS state / "what do I return to my parent?"', cue: 'Recurse on children, decide what information the child returns, combine it at the current node, and return the state needed by the parent.', problems: [
      {priority:'A',name:'Maximum Depth in BT'},{priority:'A',name:'Check for balanced binary tree'},
      {priority:'A',name:'Diameter of Binary Tree'},{priority:'A',name:'Maximum path sum'},
      {priority:'A',name:'Symmetric Binary Tree'},{priority:'A',name:'Maximum Width of BT'},
      {priority:'B',name:'Count total nodes in a complete BT'},
    ]},
    { title: 'Views / traversal plus ordering', problems: [
      {priority:'B',name:'Zig Zag or Spiral Traversal'},{priority:'B',name:'Boundary Traversal'},
      {priority:'B',name:'Vertical Order Traversal'},{priority:'B',name:'Top View of BT'},
      {priority:'B',name:'Right/Left View of Binary Tree'},
    ]},
    { title: 'Path / ancestor queries', problems: [
      {priority:'A',name:'Print root to leaf path in BT'},{priority:'A',name:'LCA in BT'},
      {priority:'A',name:'Print all nodes at a distance of K in BT'},
    ]},
    { title: 'Construction / serialization / transformation', problems: [
      {priority:'B',name:'Construct a BT from Preorder and Inorder'},{priority:'B',name:'Serialize and De-serialize BT'},
      {priority:'B',name:'Flatten Binary Tree to Linked List'},
    ]},
  ]},
  { id: 12, title: 'Binary Search Trees', groups: [
    { title: 'BST-property operations', problems: [
      {priority:'A',name:'Search in a Binary Search Tree'},{priority:'A',name:'Insert a given node in BST'},
      {priority:'B',name:'Delete a node in BST'},{priority:'A',name:'Floor and Ceil in a BST'},
    ]},
    { title: 'BST + inorder / recursion boundaries', cue: 'Core invariant: inorder traversal of a BST is sorted.', problems: [
      {priority:'A',name:'Check if a tree is a BST or not'},{priority:'A',name:'Kth Smallest and Largest element in BST'},
      {priority:'A',name:'LCA in BST'},{priority:'B',name:'Inorder Successor/Predecessor in BST'},
      {priority:'B',name:'Construct a BST from a preorder traversal'},
    ]},
    { title: 'Advanced BST', problems: [
      {priority:'B',name:'Two Sum In BST | Check if there exists a pair with Sum K'},
      {priority:'C',name:'Correct BST with two nodes swapped'},{priority:'C',name:'Largest BST in Binary Tree'},
    ]},
  ]},
  { id: 13, title: 'Graphs', groups: [
    { title: 'BFS / DFS foundations', problems: [
      {priority:'A',name:'Traversal Techniques'},{priority:'A',name:'DFS'},{priority:'A',name:'Number of provinces'},
    ]},
    { title: 'Grid as an implicit graph', problems: [
      {priority:'A',name:'Rotten Oranges'},{priority:'A',name:'Distance of nearest cell having one'},
      {priority:'B',name:'Surrounded Regions'},{priority:'A',name:'Number of islands'},
      {priority:'B',name:'Making a large island'},{priority:'B',name:'Swim in Rising Water'},
    ]},
    { title: 'Cycle / bipartite detection', problems: [
      {priority:'A',name:'Cycle Detection in Undirected Graph (bfs)'},{priority:'A',name:'Bipartite Graph (DFS)'},
      {priority:'A',name:'Cycle Detection in Directed Graph (DFS)'},
    ]},
    { title: 'Topological ordering / dependencies', problems: [
      {priority:'A',name:'Topo Sort'},{priority:'A',name:"Topological sort or Kahn's algorithm"},
      {priority:'A',name:'Course Schedule I'},{priority:'A',name:'Find eventual safe states'},{priority:'B',name:'Alien Dictionary'},
    ]},
    { title: 'BFS shortest path on an implicit graph', problems: [
      {priority:'B',name:'Word ladder I'},
    ]},
    { title: 'Shortest paths', cue: 'Unweighted → BFS · dependency → topo sort · nonneg weighted → Dijkstra · negative edges → Bellman-Ford · all-pairs → Floyd-Warshall · merging components → DSU', problems: [
      {priority:'A',name:'Shortest path in undirected graph with unit weights'},{priority:'B',name:'Shortest path in DAG'},
      {priority:'A',name:"Djisktra's Algorithm"},{priority:'B',name:'Path with minimum effort'},
      {priority:'B',name:'Cheapest flight within K stops'},{priority:'B',name:'Number of ways to arrive at destination'},
      {priority:'B',name:'Bellman Ford Algorithm'},{priority:'B',name:'Floyd warshall algorithm'},
      {priority:'B',name:'Find the city with the smallest number of neighbors'},
    ]},
    { title: 'MST / DSU', problems: [
      {priority:'A',name:"Prim's Algorithm"},{priority:'A',name:'Disjoint Set'},{priority:'A',name:'Find the MST weight'},
      {priority:'A',name:'Number of operations to make network connected'},{priority:'A',name:'Most stones removed with same row or column'},
      {priority:'A',name:'Accounts merge'},
    ]},
    { title: 'Advanced connectivity', problems: [
      {priority:'C',name:'Bridges in graph'},{priority:'C',name:'Articulation point in graph'},
      {priority:'C',name:"Kosaraju's algorithm"},
    ]},
  ]},
  { id: 14, title: 'Dynamic Programming', groups: [
    { title: '1D DP / small state', problems: [
      {priority:'A',name:'Climbing stairs'},{priority:'A',name:'Frog Jump'},
      {priority:'A',name:'House robber'},{priority:'B',name:"Ninja's training"},
    ]},
    { title: 'Grid / multi-dimensional state', problems: [
      {priority:'A',name:'Grid Unique Paths : DP on Grids (DP8)'},{priority:'B',name:'Minimum Falling Path Sum'},
      {priority:'B',name:'Ninja and his Friends'},
    ]},
    { title: 'Subset / 0-1 knapsack family', problems: [
      {priority:'A',name:'Subset sum equal to target (DP-14)'},{priority:'A',name:'Partition a set into two subsets with minimum absolute sum difference'},
      {priority:'A',name:'Count subsets with sum K'},
    ]},
    { title: 'Unbounded knapsack family', problems: [
      {priority:'A',name:'Minimum Coins (DP-20)'},{priority:'A',name:'Coin Change 2 (DP-22)'},{priority:'A',name:'Unbounded knapsack'},
    ]},
    { title: 'Two-string DP', problems: [
      {priority:'A',name:'Longest common subsequence'},{priority:'A',name:'Longest common substring'},
      {priority:'A',name:'Longest palindromic subsequence'},{priority:'A',name:'Minimum insertions or deletions to convert string A to B'},
      {priority:'A',name:'Distinct subsequences'},{priority:'A',name:'Edit distance'},{priority:'B',name:'Wildcard matching'},
    ]},
    { title: 'Stock state DP', problems: [
      {priority:'A',name:'Best time to buy and sell stock II'},{priority:'B',name:'Best time to buy and sell stock IV *(finish/repair if needed)*'},
      {priority:'A',name:'Best Time to Buy and Sell Stock with Cooldown'},
    ]},
    { title: 'LIS family', problems: [
      {priority:'A',name:'Longest Increasing Subsequence'},{priority:'A',name:'Longest Increasing Subsequence |(DP-43)'},
      {priority:'B',name:'Largest Divisible Subset'},{priority:'B',name:'Longest Bitonic Subsequence'},
    ]},
    { title: 'Interval / partition DP', problems: [
      {priority:'C',name:'Matrix chain multiplication'},{priority:'C',name:'Minimum cost to cut the stick'},
      {priority:'C',name:'Burst balloons'},{priority:'C',name:'Palindrome partitioning II'},
    ]},
    { title: 'Matrix DP / histogram connection', cue: 'Identify the smallest state that completely summarizes the past, then define transition + base case. Do not memorize isolated formulas.', problems: [
      {priority:'B',name:"Maximum Rectangle Area with all 1's (DP-55)"},{priority:'B',name:'Count Square Submatrices with All Ones (DP-56)'},
    ]},
  ]},
  { id: 15, title: 'Tries', groups: [
    { title: 'Prefix trie', problems: [
      {priority:'A',name:'Trie Implementation and Operations'},{priority:'B',name:'Longest Word with All Prefixes'},
      {priority:'B',name:'Number of distinct substrings in a string'},
    ]},
    { title: 'Bitwise trie / XOR', cue: 'When the problem asks about prefixes or maximizing XOR under bitwise choices, think trie.', problems: [
      {priority:'B',name:'Maximum XOR of two numbers in an array'},{priority:'B',name:'Maximum Xor with an element from an array'},
    ]},
  ]},
];

/* =========================================================
   PLAN VIEW RENDERER
   ========================================================= */
function planProblemMatchesFilters(p) {
  if (!p) return false;
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
  if (filterHasNotes) checks.push(
    !!(customNotes[p.serial] && customNotes[p.serial].trim()) ||
    !!(customCodeNotes[p.serial] && customCodeNotes[p.serial].trim())
  );
  if (checks.length === 0) return true;
  return filterMatch === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

function renderPlanView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '';
  document.getElementById('loadingMsg')?.remove();

  let anyVisible = false;

  PLAN_DATA.forEach(weekData => {
    const weekEl = document.createElement('div');
    weekEl.className = 'plan-week';
    weekEl.innerHTML = `<div class="plan-week-label">Week ${weekData.week}</div>`;
    let weekHasCards = false;

    weekData.days.forEach(dayData => {
      // Collect all problems for this day (non-mock blocks only), applying filters
      const allProbs = dayData.blocks.flatMap(b => b.problems || []);
      const resolved = allProbs.map(item => findProblem(item.name)).filter(p => planProblemMatchesFilters(p));
      const allResolved = allProbs.map(item => findProblem(item.name)).filter(Boolean);
      const solvedCount = allResolved.filter(p => solved.has(p.serial)).length;
      const total = allResolved.length;

      // Check if day has any matching content (mock blocks always show if no search/filter)
      const hasMockBlocks = dayData.blocks.some(b => b.mock);
      const hasMatchingProblems = resolved.length > 0;
      const hasFilters = searchQ || filterDiffs.size > 0 || filterStatuses.size > 0 || filterHasNotes;
      if (!hasMatchingProblems && !(hasMockBlocks && !hasFilters)) return;

      weekHasCards = true;
      anyVisible = true;

      const card = document.createElement('div');
      card.className = 'plan-day-card';
      card.innerHTML = `
        <div class="plan-day-header">
          <span class="plan-day-chevron">▶</span>
          <span class="plan-day-num">Day ${dayData.day}</span>
          <span class="plan-day-title">${escHtml(dayData.title)}</span>
          <span class="plan-day-progress">${solvedCount}/${total}</span>
        </div>
        <div class="plan-day-body"></div>
      `;

      card.querySelector('.plan-day-header').addEventListener('click', () => {
        card.classList.toggle('open');
        syncExpandAllBtn();
      });

      const body = card.querySelector('.plan-day-body');

      dayData.blocks.forEach(block => {
        // Filter problems in this block
        const filteredProblems = (block.problems || []).filter(item => {
          const p = findProblem(item.name);
          return planProblemMatchesFilters(p);
        });
        const hasMock = !!block.mock;
        const hasFilters = searchQ || filterDiffs.size > 0 || filterStatuses.size > 0 || filterHasNotes;

        // Skip blocks with no matching problems (unless it's a mock block with no active filter)
        if (!hasMock && filteredProblems.length === 0) return;
        if (hasMock && hasFilters) return; // hide mock blocks when filtering

        const blockEl = document.createElement('div');
        blockEl.className = 'plan-block';
        blockEl.innerHTML = `<div class="plan-block-label">Block ${block.label} — ${escHtml(block.title)}</div>`;

        if (block.mock) {
          const note = document.createElement('p');
          note.className = 'plan-mock-note';
          note.textContent = block.mock;
          blockEl.appendChild(note);
        } else if (filteredProblems.length > 0) {
          buildProblemTable(filteredProblems, blockEl);
        }

        body.appendChild(blockEl);
      });

      weekEl.appendChild(card);
    });

    if (weekHasCards) main.appendChild(weekEl);
  });

  if (!anyVisible) {
    main.innerHTML = `<div class="no-results"><span>🔍</span>No problems match your filters.</div>`;
  }

  syncExpandAllBtn();
}

/* =========================================================
   PATTERNS VIEW RENDERER
   ========================================================= */
function renderPatternsView() {
  const main = document.getElementById('mainContent');
  main.innerHTML = '';
  document.getElementById('loadingMsg')?.remove();

  let anyVisible = false;

  PATTERN_DATA.forEach(patternData => {
    // Count solved across all groups (using full unfiltered list for progress display)
    const allProbs = patternData.groups.flatMap(g => g.problems);
    const resolved = allProbs.map(item => findProblem(item.name)).filter(Boolean);
    const solvedCount = resolved.filter(p => solved.has(p.serial)).length;
    const total = resolved.length;

    // Check if pattern has any problems matching filters
    const hasMatchingGroups = patternData.groups.some(group =>
      group.problems.some(item => planProblemMatchesFilters(findProblem(item.name)))
    );
    if (!hasMatchingGroups) return;

    anyVisible = true;

    const card = document.createElement('div');
    card.className = 'pattern-card';
    card.innerHTML = `
      <div class="pattern-header">
        <span class="pattern-chevron">▶</span>
        <span class="pattern-num">${patternData.id}.</span>
        <span class="pattern-title">${escHtml(patternData.title)}</span>
        <span class="pattern-progress">${solvedCount}/${total}</span>
      </div>
      <div class="pattern-body"></div>
    `;

    card.querySelector('.pattern-header').addEventListener('click', () => {
      card.classList.toggle('open');
      syncExpandAllBtn();
    });

    const body = card.querySelector('.pattern-body');

    patternData.groups.forEach(group => {
      // Filter problems in this group
      const filteredItems = group.problems.filter(item => planProblemMatchesFilters(findProblem(item.name)));
      if (filteredItems.length === 0) return;

      const groupEl = document.createElement('div');
      groupEl.className = 'pattern-group';

      const groupResolved = filteredItems.map(item => findProblem(item.name)).filter(Boolean);
      const groupSolved = groupResolved.filter(p => solved.has(p.serial)).length;

      groupEl.innerHTML = `
        <div class="pattern-group-header">
          <span class="pattern-group-chevron">▶</span>
          <span class="pattern-group-title">${escHtml(group.title)}</span>
          <span class="pattern-group-count">${groupSolved}/${groupResolved.length}</span>
        </div>
        <div class="pattern-group-body"></div>
      `;

      groupEl.querySelector('.pattern-group-header').addEventListener('click', () => {
        groupEl.classList.toggle('open');
        syncExpandAllBtn();
        // Also update parent pattern card progress
        const allCbs = card.querySelectorAll('.prob-checkbox');
        const solvedNow = [...allCbs].filter(cb => solved.has(parseInt(cb.dataset.serial))).length;
        card.querySelector('.pattern-progress').textContent = `${solvedNow}/${total}`;
      });

      const groupBody = groupEl.querySelector('.pattern-group-body');

      if (group.cue) {
        const cueEl = document.createElement('div');
        cueEl.className = 'recognition-cue';
        cueEl.textContent = group.cue;
        groupBody.appendChild(cueEl);
      }

      buildProblemTable(filteredItems, groupBody);

      body.appendChild(groupEl);
    });

    main.appendChild(card);
  });

  if (!anyVisible) {
    main.innerHTML = `<div class="no-results"><span>🔍</span>No problems match your filters.</div>`;
  }

  syncExpandAllBtn();
}

/* =========================================================
   INIT
   ========================================================= */
// loadData(); // Now handled by onAuthStateChanged

})();


