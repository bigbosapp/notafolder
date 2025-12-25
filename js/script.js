/* =========================================
   NOTA FOLDER v121.25 - EMAIL VERIFICATION GATE
   Fitur: Wajib Verifikasi Email & Fix Reset Password
   ========================================= */

// 1. IMPORT FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. KONFIGURASI FIREBASE ANDA
const firebaseConfig = {
    apiKey: "AIzaSyDiI0i6bHeMIYiD7BfLst5glQDZ7k9KgSo",
    authDomain: "notafolderapp.firebaseapp.com",
    projectId: "notafolderapp",
    storageBucket: "notafolderapp.firebasestorage.app",
    messagingSenderId: "722500779614",
    appId: "1:722500779614:web:c905ca237c101f1c377ecf",
    measurementId: "G-ZTL4C1DMJK"
};

// 3. INISIALISASI
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 4. CONSTANT DATA LAMA
const DB_KEY_OLD = 'notafolder_db_v119_63';
const HIS_KEY_OLD = 'notafolder_his_v119_63';

// 5. STATE GLOBAL
let currentUser = null; 
let storage = [];
let moveHis = [];
let curParent = null, activeId = null, selMode = false, selIds = [], curTrashTab = 'folder', customCols = [], isFootActive = false, curTheme = 'standard';
let viewMode = localStorage.getItem('notafolder_view_mode') || 'simple';
let layoutMode = localStorage.getItem('notafolder_layout') || 'mobile';
let sortPrio = localStorage.getItem('notafolder_sort_prio') || 'folder'; 
let sortOrder = localStorage.getItem('notafolder_sort_order') || 'created'; 
let resetTimer = null;

/* =========================================
   BAGIAN HELPER (PESAN ERROR)
   ========================================= */

function getFriendlyError(error) {
    if (!error) return "Terjadi kesalahan.";
    if (typeof error === 'string') return error;
    
    // Log kode error di console untuk debugging
    console.log("Firebase Error:", error.code); 

    switch (error.code) {
        case 'auth/invalid-email': return "Format email salah (contoh: nama@gmail.com).";
        case 'auth/user-not-found': return "Akun tidak ditemukan. Daftar dulu ya.";
        case 'auth/wrong-password': return "Kata sandi salah. Coba ingat-ingat lagi.";
        case 'auth/email-already-in-use': return "Email ini sudah terdaftar. Silakan Login.";
        case 'auth/weak-password': return "Kata sandi terlalu lemah (minimal 6 huruf).";
        case 'auth/popup-closed-by-user': return "Login dibatalkan.";
        case 'auth/network-request-failed': return "Internet bermasalah. Cek sinyal Anda.";
        case 'auth/too-many-requests': return "Terlalu banyak mencoba. Tunggu 5 menit.";
        case 'auth/invalid-credential': return "Email atau Password salah.";
        case 'auth/user-disabled': return "Akun ini telah dinonaktifkan.";
        default: return "Error: " + error.message;
    }
}

function uiShowAuthMsg(msg, isError = true) {
    const el = document.getElementById('auth-msg');
    el.innerHTML = msg; // Gunakan innerHTML agar bisa pakai <b> atau emoji
    el.style.color = isError ? 'var(--danger)' : 'var(--success)';
    
    // Efek bergetar jika error
    if(isError) {
        el.style.transform = "translateX(5px)";
        setTimeout(() => el.style.transform = "translateX(0)", 100);
        setTimeout(() => el.style.transform = "translateX(5px)", 200);
        setTimeout(() => el.style.transform = "translateX(0)", 300);
    }
}

/* =========================================
   BAGIAN AUTHENTICATION & SECURITY
   ========================================= */

// 1. LIHAT PASSWORD
window.sysTogglePass = function() {
    const inp = document.getElementById('auth-pass');
    const icon = document.getElementById('btn-eye');
    if(inp.type === 'password') {
        inp.type = 'text';
        icon.innerText = '🔒'; 
    } else {
        inp.type = 'password';
        icon.innerText = '👁️';
    }
}

// 2. LUPA PASSWORD (RESET)
window.sysForgotPass = async function() {
    const e = document.getElementById('auth-email').value;
    
    // VALIDASI: Email harus diisi dulu
    if(!e) {
        document.getElementById('auth-email').focus();
        return uiShowAuthMsg("👆 Ketik email Anda di kolom atas dulu!", true);
    }
    
    uiConfirmAction("Kirim Link Reset?", `Kami akan mengirimkan link untuk mengubah kata sandi ke:<br><b>${e}</b>`, async () => {
        try {
            await sendPasswordResetEmail(auth, e);
            uiShowAuthMsg(`✅ Link reset terkirim ke ${e}.<br>Cek Inbox/Spam email Anda.`, false);
        } catch (error) {
            uiShowAuthMsg(getFriendlyError(error));
        }
    }, false, "Kirim");
}

// 3. LOGIN GOOGLE
window.sysAuthGoogle = async function() {
    const provider = new GoogleAuthProvider();
    uiShowAuthMsg("");
    try { await signInWithPopup(auth, provider); } 
    catch (error) { uiShowAuthMsg(getFriendlyError(error)); }
}

// 4. LOGIN EMAIL BIASA
window.sysAuthLogin = async function() {
    const e = document.getElementById('auth-email').value;
    const p = document.getElementById('auth-pass').value;
    uiShowAuthMsg(""); 
    
    if(!e || !p) return uiShowAuthMsg("Mohon isi Email dan Kata Sandi.");
    
    try { 
        // Proses login firebase (akan memicu onAuthStateChanged)
        await signInWithEmailAndPassword(auth, e, p); 
    } 
    catch (error) { uiShowAuthMsg(getFriendlyError(error)); }
}

// 5. DAFTAR (REGISTRASI)
window.sysAuthRegister = async function() {
    const e = document.getElementById('auth-email').value;
    const p = document.getElementById('auth-pass').value;
    uiShowAuthMsg(""); 
    
    if(!e || !p) return uiShowAuthMsg("Mohon isi Email dan Kata Sandi.");
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, e, p);
        const user = userCredential.user;
        
        // Kirim Email Verifikasi
        await sendEmailVerification(user);
        
        // PENTING: Langsung LOGOUT setelah daftar agar tidak bisa masuk aplikasi
        await signOut(auth);
        
        // Tampilkan Pesan Sukses
        uiConfirmAction(
            "Berhasil Daftar!", 
            `Link verifikasi telah dikirim ke <b>${e}</b>.<br><br>Wajib: Buka email Anda, klik linknya, lalu kembali ke sini untuk Login.`, 
            () => {}, false, "Siap"
        );
        uiShowAuthMsg("Silakan cek email untuk verifikasi.", false);
        
    } catch (error) {
        uiShowAuthMsg(getFriendlyError(error));
    }
}

// --- GATEKEEPER (SATPAM) ---
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('view-login');
    
    if (user) {
        // CEK 1: APAKAH EMAIL SUDAH DIVERIFIKASI?
        // Catatan: Akun Google biasanya sudah verified otomatis.
        if (!user.emailVerified) {
            console.log("Email belum verified. Menendang keluar...");
            
            // Tampilkan pesan error di layar login
            uiShowAuthMsg("⛔ Email belum diverifikasi! Cek Inbox/Spam email Anda dan klik linknya.", true);
            
            // Paksa Logout
            await signOut(auth);
            return; // Berhenti di sini, jangan lanjut load data
        }

        // JIKA SUDAH VERIFIED:
        currentUser = user;
        loginOverlay.classList.add('hidden'); 
        uiNotify(`Selamat datang, ${user.displayName || 'User'}!`);
        uiShowAuthMsg(""); // Bersihkan pesan error login
        
        await loadDataFromCloud();
        setTimeout(sysCheckLocalData, 1000); 

        // Atur tombol profil/logout
        const btnReset = document.querySelector('.view-mode-bar .view-btn[style*="var(--danger)"]');
        if(btnReset) {
            let displayName = user.email.split('@')[0];
            if(displayName.length > 10) displayName = displayName.substring(0, 10) + '...';
            btnReset.innerHTML = `<span style="font-size:11px;">👤 ${displayName}</span>`; 
            btnReset.style.width = "auto"; btnReset.style.minWidth = "80px"; btnReset.style.color = "var(--text)"; btnReset.style.borderColor = "#cbd5e1";
            btnReset.onclick = function() {
                uiConfirmAction("Logout?", `Akun: <b>${user.email}</b>`, () => { signOut(auth).then(() => { location.reload(); }); }, true, "Keluar");
            };
        }
    } else {
        // JIKA TIDAK ADA USER (LOGOUT)
        currentUser = null; storage = []; moveHis = [];
        loginOverlay.classList.remove('hidden'); 
    }
});

/* =========================================
   BAGIAN DATABASE & MIGRASI
   ========================================= */

async function loadDataFromCloud() {
    if(!currentUser) return;
    uiNotify("Sinkronisasi...", "success");
    try {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            storage = data.storage ? JSON.parse(data.storage) : [];
            moveHis = data.history ? JSON.parse(data.history) : [];
        } else {
            storage = []; moveHis = [];
        }
        navRenderGrid(); uiNotify("Data Cloud Siap!");
    } catch (e) {
        console.error(e); 
        uiNotify("Gagal memuat data server.", "danger");
    }
}

window.dbSave = async function() {
    if(!currentUser) return; 
    const docRef = doc(db, "users", currentUser.uid);
    try {
        await setDoc(docRef, {
            storage: JSON.stringify(storage), 
            history: JSON.stringify(moveHis),
            lastUpdate: new Date().toISOString()
        }, { merge: true });
        console.log("Cloud saved.");
    } catch (e) {
        console.error("Cloud Save Error:", e);
        uiNotify("Gagal simpan ke Cloud!", "danger");
    }
}

window.sysCheckLocalData = function() {
    const localRaw = localStorage.getItem(DB_KEY_OLD);
    if(localRaw && localRaw.length > 5) {
        const localData = JSON.parse(localRaw);
        if(localData.length > 0) {
            uiConfirmAction(
                "Data Lama Ditemukan!", 
                `Ada ${localData.length} file tersimpan di HP ini (Offline).<br>Ingin meng-uploadnya ke Akun Cloud Anda?`, 
                () => { sysUploadLocalData(localData); },
                false,
                "Upload"
            );
        }
    }
}

window.sysUploadLocalData = function(localData) {
    if(!localData) localData = JSON.parse(localStorage.getItem(DB_KEY_OLD) || "[]");
    let added = 0;
    const currentIds = new Set(storage.map(i => i.id));
    localData.forEach(item => {
        if(!currentIds.has(item.id)) {
            storage.push(item);
            added++;
        }
    });
    if(added > 0) {
        dbSave(); navRenderGrid(); uiNotify(`Berhasil memulihkan ${added} file lama!`);
    } else {
        uiNotify("Data lokal sudah ada di Cloud.");
    }
}

/* =========================================
   FUNGSI LOGIKA (FIX GHOST FOLDER INCLUDE)
   ========================================= */

window.isValidPath = function(item) {
    if(item.inTrash) return false;
    if(!item.parentId || item.parentId === 'HOME') return true;
    const parent = storage.find(p => p.id === item.parentId);
    if(!parent) return false;
    return isValidPath(parent);
}

window.isDescendant = function(parentId, childId) {
    if (!parentId || !childId) return false;
    let curr = storage.find(i => i.id === childId);
    while (curr && curr.parentId) {
        if (curr.parentId === parentId) return true;
        curr = storage.find(i => i.id === curr.parentId);
    }
    return false;
}

window.sysSanitizeDB = function() {
    let changed = false;
    storage.forEach(item => {
        if (item.parentId && item.parentId !== 'HOME') {
            const parentExists = storage.some(p => p.id === item.parentId && !p.inTrash);
            if (!parentExists) {
                item.parentId = null; 
                changed = true;
            }
        }
    });
    if(changed) dbSave();
}

window.sysAutoCleanup = function() {
    const now = Date.now();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const initialStorageLen = storage.length;
    storage = storage.filter(item => {
        if (item.inTrash && item.deletedAt) {
            const age = now - new Date(item.deletedAt).getTime();
            return age < TWO_DAYS_MS;
        }
        return true;
    });
    if (storage.length !== initialStorageLen) { dbSave(); }
}

window.getUniqueName = function(name, parentId, type) {
    let newName = name; let counter = 1; let safeGuard = 0; 
    while (storage.some(i => i.parentId === parentId && i.type === type && i.name.toLowerCase() === newName.toLowerCase() && !i.inTrash) && safeGuard < 500) { 
        newName = `${name} (${counter})`; counter++; safeGuard++;
    }
    return newName;
}

window.formatDateIndo = function(isoDate) {
    if (!isoDate) return '-';
    const [y, m, d] = isoDate.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d} ${months[parseInt(m)-1]} ${y}`;
}

window.formatDateDetail = function(iso) { const d = new Date(iso); return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID'); }

window.getTimeAgo = function(iso) { const diff = (new Date() - new Date(iso)) / 1000; if (diff < 60) return "Baru saja"; if (diff < 3600) return Math.floor(diff / 60) + " menit lalu"; if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu"; return Math.floor(diff / 86400) + " hari lalu"; }

window.sysNum = function(val) {
    if (!val) return 0;
    const clean = val.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

window.sysGetNetTotal = function(nota) {
    if(!nota.items) return 0;
    let gross = 0;
    nota.items.forEach(r => gross += (sysNum(r.jml) * sysNum(r.harga)));
    gross = Math.round(gross);
    let discount = 0;
    if(nota.discVal && nota.discVal > 0) {
        discount = (nota.discType === 'p') ? gross * (nota.discVal / 100) : nota.discVal;
        if(discount > gross) discount = gross;
        discount = Math.round(discount);
    }
    return gross - discount;
}

window.sysGetFolderTotal = function(parentId) {
    let total = 0;
    const children = storage.filter(i => i.parentId === parentId && !i.inTrash);
    children.forEach(child => {
        if (child.type === 'nota' && child.items) { total += sysGetNetTotal(child); } 
        else if (child.type === 'folder') { total += sysGetFolderTotal(child.id); }
    });
    return total;
}

window.sysSumSelected = function() {
    if(selIds.length === 0) return uiNotify("Pilih item dulu!", "danger");
    let totalSum = 0; let folders = []; let files = [];
    selIds.forEach(id => {
        const item = storage.find(i => i.id === id);
        if(item) {
            let itemVal = 0;
            if(item.type === 'nota') { 
                itemVal = sysGetNetTotal(item); files.push({ name: item.name, val: itemVal }); 
            } 
            else if(item.type === 'folder') { 
                itemVal = sysGetFolderTotal(item.id); folders.push({ name: item.name, val: itemVal }); 
            }
            totalSum += itemVal;
        }
    });
    folders.sort((a, b) => a.name.localeCompare(b.name)); files.sort((a, b) => a.name.localeCompare(b.name));
    uiPopupOpen('calc', { total: totalSum, folders: folders, files: files });
}

window.sysToggleSelectAll = function(isChecked) {
    const visibleItems = storage.filter(i => i.parentId === curParent && !i.inTrash);
    if(isChecked) { selIds = visibleItems.map(i => i.id); } else { selIds = []; }
    document.getElementById('txt-select-count').innerText = `${selIds.length} Item`;
    navRenderGrid();
}

window.uiShowChangelog = function() {
    const logs = ["<b>v121.25 (Gatekeeper)</b>: Wajib Verifikasi Email sebelum masuk.", "<b>v121.24 (UI)</b>: Pesan error di bawah tombol."];
    uiPopupOpen('changelog', logs);
}

window.sysToggleLayout = function() {
    const isDesktop = document.getElementById('layout-toggle').checked;
    layoutMode = isDesktop ? 'desktop' : 'mobile';
    localStorage.setItem('notafolder_layout', layoutMode);
    document.body.classList.toggle('is-desktop', isDesktop);
}

window.sysChangeView = function(mode) {
    viewMode = mode; localStorage.setItem('notafolder_view_mode', mode);
    document.getElementById('vm-simple').classList.toggle('active', mode === 'simple');
    document.getElementById('vm-details').classList.toggle('active', mode === 'details');
    document.getElementById('comp-grid').className = mode === 'simple' ? 'grid' : 'list-container';
    navRenderGrid();
}

window.sysUpdateBreadcrumbs = function() {
    const bc = document.getElementById('comp-breadcrumbs'); bc.innerHTML = ''; 
    let liRoot = document.createElement('li'); liRoot.innerText = 'Beranda'; liRoot.onclick = () => navGo(null); bc.appendChild(liRoot);
    let pathStack = []; let tempParent = curParent;
    if (activeId) { const n = storage.find(i => i.id === activeId); if(n) tempParent = n.parentId; }
    let tid = tempParent; let safeguard = 0;
    while(tid && safeguard < 50){ let f = storage.find(i => i.id === tid); if(f){ pathStack.unshift(f); tid = f.parentId; } else break; safeguard++; }
    pathStack.forEach(f => { let li = document.createElement('li'); li.innerText = f.name; li.onclick = () => navGo(f.id); bc.appendChild(li); });
    if (activeId) { const currentFile = storage.find(i => i.id === activeId); if (currentFile) { let li = document.createElement('li'); li.innerText = currentFile.name; li.className = 'active-file'; bc.appendChild(li); } }
}

window.sysQuickPreview = function(id) { activeId = id; history.pushState({view: 'preview', id: id}, null, ""); uiPreview(true, true); }

window.navRenderGrid = function() {
    document.body.classList.remove('mode-editor');
    document.getElementById('view-editor').classList.add('hidden'); 
    document.getElementById('view-list').classList.remove('hidden'); 
    document.getElementById('select-bar').classList.toggle('hidden', !selMode);
    sysUpdateBreadcrumbs();
    const grid = document.getElementById('comp-grid'); grid.innerHTML = '';
    document.getElementById('vm-simple').classList.toggle('active', viewMode === 'simple');
    document.getElementById('vm-details').classList.toggle('active', viewMode === 'details');
    grid.className = viewMode === 'simple' ? 'grid' : 'list-container';
    
    const items = storage.filter(i => i.parentId === curParent && !i.inTrash);
    items.sort((a, b) => {
        if (sortPrio === 'folder') { if (a.type !== b.type) return a.type === 'folder' ? -1 : 1; } 
        else if (sortPrio === 'file') { if (a.type !== b.type) return a.type === 'nota' ? -1 : 1; }
        let val = 0;
        if (sortOrder === 'az') { val = a.name.localeCompare(b.name); } 
        else if (sortOrder === 'created') { val = new Date(b.createdAt) - new Date(a.createdAt); } 
        else if (sortOrder === 'edited') { val = new Date(b.lastEdited) - new Date(a.lastEdited); }
        return val;
    });

    if(selMode) { const isAll = items.length > 0 && items.every(i => selIds.includes(i.id)); document.getElementById('cb-select-all').checked = isAll; }
    if(items.length === 0) { grid.innerHTML = '<div style="text-align:center; color:gray; padding:20px; grid-column:span 8;">Folder Kosong</div>'; return; }
    
    items.forEach(item => {
        const qvBtn = item.type === 'nota' ? `<div class="btn-quick-view" onclick="event.stopPropagation(); sysQuickPreview('${item.id}')">👁️</div>` : '';
        const isSel = selIds.includes(item.id);
        let dispName = item.name; const limit = viewMode === 'simple' ? 13 : 18; if(dispName.length > limit) dispName = dispName.substring(0, limit) + '...';

        if (viewMode === 'simple') {
            const card = document.createElement('div'); card.className = `card ${isSel ? 'selected' : ''}`;
            card.style.borderTop = `5px solid ${item.type === 'folder' ? 'var(--folder)' : 'var(--nota)'}`;
            card.innerHTML = `${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div><div class="card-icon">${item.type==='folder'?'📁':'📄'}</div><b>${dispName}</b><span class="time-label">${getTimeAgo(item.createdAt)}</span>`;
            card.onclick = () => selMode ? sysToggleSelect(item.id) : (item.type==='folder' ? navGo(item.id) : editOpen(item.id));
            grid.appendChild(card);
        } else {
            const row = document.createElement('div'); row.className = `list-item ${isSel ? 'selected' : ''}`;
            const icon = item.type === 'folder' ? '📁' : '📄'; const dateEdit = formatDateDetail(item.lastEdited);
            let metaHtml = '';
            if (item.type === 'folder') { 
                const count = storage.filter(x => x.parentId === item.id && !x.inTrash).length; 
                const folderTotal = sysGetFolderTotal(item.id); 
                metaHtml = `<div class="meta-line">📂 Isi: ${count} File</div><div class="meta-line" style="color:#16a34a;font-weight:bold;">💰 Rp ${folderTotal.toLocaleString('id-ID')}</div><div class="meta-line">✏️ Edit: ${dateEdit}</div>`; 
            } else { 
                let itemCount = item.items ? item.items.length : 0; 
                let total = sysGetNetTotal(item); 
                let discBadge = (item.discVal && item.discVal > 0) ? '<span style="color:orange; font-size:9px;"> (Disc)</span>' : '';
                metaHtml = `<div class="meta-line">📦 ${itemCount} Barang</div><div class="meta-line" style="color:var(--nota);font-weight:bold;">💰 Rp ${total.toLocaleString('id-ID')}${discBadge}</div><div class="meta-line">✏️ Edit: ${dateEdit}</div>`; 
            }
            row.innerHTML = `<div class="list-icon">${icon}</div><div class="list-body"><div class="list-title">${dispName}</div><div class="list-meta-row">${metaHtml}</div></div>${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div>`;
            row.onclick = () => selMode ? sysToggleSelect(item.id) : (item.type==='folder' ? navGo(item.id) : editOpen(item.id));
            grid.appendChild(row);
        }
    });
}

window.sysSortChange = function(type, val) {
    if(type === 'p') { sortPrio = val; localStorage.setItem('notafolder_sort_prio', sortPrio); } 
    else { sortOrder = val; localStorage.setItem('notafolder_sort_order', sortOrder); }
    uiPopupOpen('sort'); navRenderGrid();
}

window.sysSearch = function(k) { 
    const grid = document.getElementById('comp-grid'); 
    if(!k){ navRenderGrid(); return; } 
    grid.innerHTML = ''; grid.className = viewMode === 'simple' ? 'grid' : 'list-container';
    const r = storage.filter(i => {
        if (i.inTrash) return false;
        const matchName = i.name.toLowerCase().includes(k.toLowerCase());
        const matchCode = i.uCode && i.uCode.toLowerCase().includes(k.toLowerCase());
        let matchItem = false;
        if (i.type === 'nota' && i.items) { matchItem = i.items.some(row => row.barang.toLowerCase().includes(k.toLowerCase())); }
        return matchName || matchCode || matchItem;
    });

    if(r.length === 0){ grid.innerHTML = '<div style="width:100%;text-align:center;color:gray;grid-column:span 2">Tidak ada</div>'; return; } 
    r.forEach(item => {
        const qvBtn = item.type === 'nota' ? `<div class="btn-quick-view" onclick="event.stopPropagation(); sysQuickPreview('${item.id}')">👁️</div>` : '';
        const p = storage.find(x => x.id === item.parentId); const l = p ? p.name : 'Beranda';
        const extraInfo = (item.type === 'nota' && !item.name.toLowerCase().includes(k.toLowerCase())) ? '<div style="font-size:9px;color:var(--nota);font-style:italic;">(Cocok di nama barang)</div>' : '';

        if (viewMode === 'simple') {
            const card = document.createElement('div'); card.className = 'card'; card.style.borderTop = `5px solid ${item.type === 'folder' ? 'var(--folder)' : 'var(--nota)'}`;
            card.innerHTML = `${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div><div class="card-icon">${item.type==='folder'?'📁':'📄'}</div><b>${item.name}</b>${extraInfo}<span class="time-label">di ${l}</span>`;
            card.onclick = () => item.type === 'folder' ? navGo(item.id) : editOpen(item.id); grid.appendChild(card);
        } else {
            const row = document.createElement('div'); row.className = 'list-item'; const icon = item.type === 'folder' ? '📁' : '📄'; 
            row.innerHTML = `<div class="list-icon">${icon}</div><div class="list-body"><div class="list-title">${item.name} ${extraInfo}</div><div class="list-meta-row"><div class="time-label">Lokasi: ${l}</div></div></div>${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div>`;
            row.onclick = () => item.type === 'folder' ? navGo(item.id) : editOpen(item.id); grid.appendChild(row);
        }
    });
}

window.navGo = function(id) { 
    curParent = id; activeId = null; selMode = false; selIds = []; 
    document.body.classList.remove('mode-editor'); document.getElementById('view-editor').classList.add('hidden'); 
    document.getElementById('view-list').classList.remove('hidden'); document.getElementById('select-bar').classList.add('hidden'); 
    document.getElementById('inp-search').value = ""; navRenderGrid();
    localStorage.setItem('notafolder_cur_parent', id || ''); localStorage.removeItem('notafolder_active_id');
    if (!history.state || history.state.id !== id || history.state.view !== 'folder') { history.pushState({view: 'folder', id: id}, null, ""); }
}

window.navBack = function(isHardware = false, force = false) { 
    if(!force && document.body.classList.contains('mode-editor')) {
        const statusText = document.getElementById('txt-save-status').innerText;
        if(!statusText.includes("Siap Cetak")) {
            uiConfirmAction("Data Belum Disimpan!", "Perubahan akan <b>HILANG</b> jika keluar.<br>Keluar?", () => { navBack(isHardware, true); }, true, "Keluar"); return;
        }
    }
    if(!isHardware) {
        if(activeId) { const n = storage.find(i => i.id === activeId); navGo(n ? n.parentId : null); } 
        else if(curParent) { const p = storage.find(i => i.id === curParent); navGo(p ? p.parentId : null); }
    }
}

window.onpopstate = function(event) { 
    if(!document.getElementById('comp-popup').classList.contains('hidden')) { uiPopupClose(); history.pushState(history.state, null, ""); return; } 
    if(!document.getElementById('comp-trash-modal').classList.contains('hidden')) { uiTrashClose(); history.pushState(history.state, null, ""); return; } 
    if(!document.getElementById('preview-screen').classList.contains('hidden')) { uiPreview(false); history.pushState(history.state, null, ""); return; } 
    if(document.body.classList.contains('is-clean-mode')) { document.body.classList.remove('is-clean-mode'); history.pushState(history.state, null, ""); return; } 

    if (document.body.classList.contains('mode-editor')) {
        const statusText = document.getElementById('txt-save-status').innerText;
        if (!statusText.includes("Siap Cetak")) {
            history.pushState({view: 'editor', id: activeId}, null, "");
            uiConfirmAction("Belum Disimpan!", "Perubahan Anda akan hilang jika kembali.<br>Yakin ingin keluar?", () => {
                document.getElementById('txt-save-status').innerText = "✅ Siap Cetak!";
                if(curParent) navGo(curParent); else navGo(null);
            }, true, "Keluar");
            return; 
        }
    }

    if(event.state) {
        if(event.state.view === 'editor') {
            const noteId = event.state.id; const n = storage.find(x => x.id === noteId);
            if(n) {
                activeId = noteId; curParent = n.parentId;
                document.body.classList.add('mode-editor'); document.getElementById('view-list').classList.add('hidden'); 
                document.getElementById('view-editor').classList.remove('hidden'); document.getElementById('txt-nota-title').innerText = n.name; 
                document.getElementById('chk-show-note').checked = (n.showNote !== undefined ? n.showNote : !!n.noteContent);
                document.getElementById('inp-nota-note').classList.toggle('hidden', !document.getElementById('chk-show-note').checked);
                document.getElementById('inp-nota-note').value = n.noteContent || "";
                document.getElementById('inp-resi').classList.toggle('hidden', !document.getElementById('chk-show-resi').checked);
                document.getElementById('inp-resi').value = n.resi || "";
                const showDate = n.showDate !== undefined ? n.showDate : false;
                document.getElementById('chk-show-date').checked = showDate; document.getElementById('date-wrapper').classList.toggle('hidden', !showDate);
                const chkNum = document.getElementById('chk-show-num'); if(chkNum) chkNum.checked = (n.showNum !== undefined ? n.showNum : true);
                customCols = n.customCols || []; sysSetDateMode(n.dateMode || 'single', false); document.getElementById('comp-tbody').innerHTML = ''; 
                if(n.items && n.items.length > 0) n.items.forEach(it => editAddRow(it)); else editAddRow(); 
                editCalc(); editStatus(true); sysUpdateBreadcrumbs();
            } else { navGo(null); }
        } else { curParent = event.state.id; activeId = null; navRenderGrid(); }
    } else { curParent = null; activeId = null; navRenderGrid(); }
};

window.sysChangeTheme = function(theme) { curTheme = theme; const paper = document.getElementById('preview-print-area'); if(!paper) return; paper.className = ''; if(theme === 'modern') paper.classList.add('theme-modern'); if(theme === 'transparent') paper.classList.add('theme-transparent'); }
window.sysAddHistory = function(msg, type = 'general') { const now = Date.now(); const t = new Date().toLocaleString('id-ID'); moveHis.unshift({ msg: msg, fullTime: t, type: type, timestamp: now }); const typeItems = moveHis.filter(h => h.type === type || (type === 'trash' && (h.type === 'trash' || h.type === 'restore'))); if (typeItems.length > 50) { const itemToRemove = typeItems[typeItems.length - 1]; moveHis = moveHis.filter(h => h !== itemToRemove); } dbSave(); }
window.renderHistoryList = function(filter) { const list = document.getElementById('trash-list-content'); list.innerHTML = ''; const now = Date.now(); const maxAge = 2 * 24 * 60 * 60 * 1000; moveHis = moveHis.filter(h => { const itemTime = h.timestamp || now; return (now - itemTime) < maxAge; }); dbSave(); document.querySelectorAll('.his-btn').forEach(b => b.classList.remove('active')); document.querySelector(`.his-btn.h-${filter}`).classList.add('active'); const filtered = (filter === 'all') ? moveHis : moveHis.filter(h => { if(filter === 'trash') return h.type === 'trash' || h.type === 'restore'; return h.type === filter; }); if(filtered.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">Belum ada riwayat</div>'; return; } filtered.forEach(h => { let borderColor = '#eee'; if(h.type === 'move') borderColor = 'var(--move)'; if(h.type === 'edit') borderColor = 'var(--edit)'; if(h.type === 'trash' || h.type === 'restore') borderColor = 'var(--danger)'; const itemTime = h.timestamp || now; const daysLeft = Math.ceil((maxAge - (now - itemTime)) / (86400000)); list.innerHTML += `<div class="history-item" style="border-left: 4px solid ${borderColor};">${h.msg}<div class="his-time"><span>${h.fullTime}</span><span class="his-life">🕒 ${daysLeft} Hari</span></div></div>`; }); }

/* --- POPUP SYSTEM --- */
window.uiPopupReset = function() {
    document.getElementById('popup-desc').classList.add('hidden');
    document.getElementById('popup-input-wrapper').classList.add('hidden');
    document.getElementById('popup-content-calc').classList.add('hidden');
    document.getElementById('popup-opt-wrapper').classList.add('hidden');
    document.getElementById('popup-disc-wrapper').classList.add('hidden'); 
    document.getElementById('popup-select').classList.add('hidden'); 
    document.getElementById('btn-popup-extra').classList.add('hidden');
    document.getElementById('popup-sort-wrapper').classList.add('hidden'); 
    if(resetTimer) { clearInterval(resetTimer); resetTimer = null; }
    const btn = document.getElementById('btn-popup-confirm'); const bc = document.getElementById('btn-popup-cancel');
    btn.classList.remove('hidden'); bc.classList.remove('hidden'); btn.disabled = false; btn.style.background = "var(--nota)"; btn.innerText = "Simpan"; 
    bc.onclick = () => { uiPopupClose(); }; document.getElementById('popup-input').value = ""; document.getElementById('popup-desc').innerHTML = ""; 
}

window.uiConfirmAction = function(t, d, o, s, customBtnText = null) { 
    uiPopupReset(); const c = document.getElementById('comp-popup'); document.getElementById('popup-icon').innerText = s ? '⚠️' : 'ℹ️'; document.getElementById('popup-title').innerText = t; document.getElementById('popup-desc').innerHTML = d; document.getElementById('popup-desc').classList.remove('hidden'); 
    const b = document.getElementById('btn-popup-confirm'); const bc = document.getElementById('btn-popup-cancel');
    b.style.background = s ? "var(--danger)" : "var(--success)"; 
    b.innerText = customBtnText ? customBtnText : (s ? "Hapus" : "Ya"); 
    b.disabled = false; bc.style.background = "#f1f5f9"; bc.style.color = "#64748b"; bc.innerText = "Batal"; c.classList.remove('hidden'); b.onclick = () => { o(); uiPopupClose(); }; bc.onclick = () => { uiPopupClose(); }; 
}

window.uiPopupOpen = function(type, extra = null) {
    uiPopupReset(); const o = document.getElementById('comp-popup'); const input = document.getElementById('popup-input'); const wrap = document.getElementById('popup-input-wrapper'); const btn = document.getElementById('btn-popup-confirm'); const icon = document.getElementById('popup-icon'); const title = document.getElementById('popup-title'); const sel = document.getElementById('popup-select'); const optWrap = document.getElementById('popup-opt-wrapper'); const chkOpen = document.getElementById('popup-chk-open'); const desc = document.getElementById('popup-desc'); const calcArea = document.getElementById('popup-content-calc'); const bc = document.getElementById('btn-popup-cancel'); const discWrap = document.getElementById('popup-disc-wrapper'); const extraBtn = document.getElementById('btn-popup-extra'); const sortWrap = document.getElementById('popup-sort-wrapper');
    o.classList.remove('hidden'); btn.style.background = "var(--nota)"; btn.innerText = "Simpan"; btn.disabled = false; bc.style.background = "#f1f5f9"; bc.style.color = "#64748b"; bc.innerText = "Batal"; bc.onclick = () => { uiPopupClose(); }; 
    const savedAutoOpen = localStorage.getItem('notafolder_auto_open_pref'); chkOpen.checked = savedAutoOpen === 'true';

    if(type === 'folder' || type === 'nota') { 
        icon.innerText = type === 'folder' ? '📁' : '📄'; title.innerText = "Buat " + type; input.placeholder = "Nama " + type; 
        wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); optWrap.classList.remove('hidden'); 
        btn.onclick = () => { if(input.value.trim()){ localStorage.setItem('notafolder_auto_open_pref', chkOpen.checked); const safeName = getUniqueName(input.value.trim(), curParent, type); sysCreate(type, safeName, chkOpen.checked); uiPopupClose(); } }; 
    }
    else if(type === 'discount') {
        icon.innerText = '🏷️'; title.innerText = "Atur Diskon";
        wrap.classList.remove('hidden'); input.classList.add('hidden'); discWrap.classList.remove('hidden'); 
        const n = storage.find(i=>i.id===activeId); document.getElementById('disc-type').value = n.discType || 'n'; document.getElementById('disc-val').value = n.discVal || '';
        btn.onclick = () => { const dType = document.getElementById('disc-type').value; const dVal = parseFloat(document.getElementById('disc-val').value) || 0; if(dType === 'p' && dVal > 100) return uiNotify("Maksimal 100%", "danger"); let subtotal = 0; document.querySelectorAll('#comp-tbody tr').forEach(tr => { const rawQ = sysNum(tr.querySelector('.col-jml').value); const rawP = sysNum(tr.querySelector('.col-harga').value); subtotal += (rawQ * rawP); }); if(dType === 'n' && dVal > subtotal) return uiNotify("Diskon melebihi total!", "danger"); n.discType = dType; n.discVal = dVal; editCalc(); uiPopupClose(); uiNotify("Diskon Disimpan"); };
    }
    else if(type === 'html_export') {
        icon.innerText = '🌐'; title.innerText = "Export HTML";
        desc.innerHTML = `Opsi Salin HTML agar file nota dapat di simpan ke peragkat, gunakan web / aplikasi pihak ke tiga (3).`; desc.style.fontSize = "11px"; desc.style.textAlign = "justify"; desc.classList.remove('hidden'); wrap.classList.add('hidden'); 
        bc.innerText = "Salin HTML"; bc.style.background = "#8b5cf6"; bc.style.color = "white"; bc.onclick = () => { sysCopyHTML(); };
        btn.innerText = "Download HTML"; btn.style.background = "var(--success)"; btn.onclick = () => { sysDownloadHTMLAction(); uiPopupClose(); };
        extraBtn.classList.remove('hidden'); extraBtn.onclick = () => uiPopupClose();
    }
    else if(type === 'calc') { 
        icon.innerText = '🔢'; title.innerText = "Rincian"; calcArea.classList.remove('hidden'); 
        document.getElementById('popup-total-val').innerText = extra.total.toLocaleString('id-ID'); 
        const listArea = document.getElementById('popup-calc-list'); listArea.innerHTML = ''; 
        extra.folders.forEach(f => { listArea.innerHTML += `<div class="calc-row is-folder"><span style="flex:1"><span class="calc-icon-sm">📁</span> ${f.name}</span><span>Rp ${f.val.toLocaleString('id-ID')}</span></div>`; }); 
        extra.files.forEach(f => { listArea.innerHTML += `<div class="calc-row is-nota"><span style="flex:1"><span class="calc-icon-sm">📄</span> ${f.name}</span><span>Rp ${f.val.toLocaleString('id-ID')}</span></div>`; }); 
        btn.innerText = "Tutup"; btn.style.background = "var(--success)"; bc.classList.add('hidden'); btn.onclick = () => uiPopupClose(); 
    }
    else if(type === 'rename') { 
        const item = storage.find(i => i.id === extra); icon.innerText = '✎'; title.innerText = "Ubah Nama"; 
        wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); input.value = item.name; btn.innerText = "Update"; btn.style.background = "var(--success)"; 
        btn.onclick = () => { if(input.value.trim()){ const newName = input.value.trim(); if (newName !== item.name) { if (newName.toLowerCase() !== item.name.toLowerCase()) { item.name = getUniqueName(newName, item.parentId, item.type); } else { item.name = newName; } dbSave(); uiPopupClose(); navRenderGrid(); if(activeId) sysUpdateBreadcrumbs(); uiNotify("Nama diubah!"); } else { uiPopupClose(); } } }; 
    }
    else if(type === 'move') { 
        if(selIds.length === 0) { uiPopupClose(); return uiNotify("Pilih item dulu!", "danger"); } 
        icon.innerText = '🚚'; title.innerText = "Pindahkan Item"; desc.innerText = "Pilih Folder Tujuan:"; desc.classList.remove('hidden'); wrap.classList.remove('hidden'); input.classList.add('hidden'); sel.classList.remove('hidden'); 
        
        const validDestinations = storage.filter(f => 
            f.type === 'folder' && 
            !selIds.includes(f.id) && 
            !selIds.some(selId => isDescendant(selId, f.id)) &&
            isValidPath(f) 
        ); 
        
        sel.innerHTML = '<option value="">-- Pilih Folder --</option><option value="HOME">🏠 BERANDA</option>'; 
        validDestinations.sort((a,b)=>a.name.localeCompare(b.name)).forEach(f => { sel.innerHTML += `<option value="${f.id}">📁 ${f.name}</option>`; }); 
        btn.innerText = "Pindah"; btn.style.background = "var(--folder)"; btn.onclick = () => { if (!sel.value) return uiNotify("Pilih tujuan!", "danger"); uiPopupClose(); sysMove(sel.value); }; 
    }
    else if(type === 'col') { 
        icon.innerText = '➕'; title.innerText = "Tambah Variasi"; wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); 
        input.placeholder = "Nama Variasi"; btn.innerText = "Tambah"; btn.style.background = "var(--nota)"; btn.onclick = () => { if(input.value.trim()){ editAddColAction(input.value.trim()); uiPopupClose(); } }; 
    }
    else if(type === 'changelog') { 
        icon.innerText = '📜'; title.innerText = "Riwayat Update"; desc.classList.remove('hidden'); desc.style.textAlign = "left"; desc.style.maxHeight = "300px"; desc.style.overflowY = "auto"; 
        desc.innerHTML = extra.map(l => `<div style="border-bottom:1px solid #eee; padding:8px 0;">${l}</div>`).join(''); btn.innerText = "Tutup"; btn.onclick = () => uiPopupClose(); bc.classList.add('hidden'); 
    }
    else if(type === 'sort') {
        icon.innerText = '🔃'; title.innerText = "Urutkan File"; sortWrap.classList.remove('hidden'); btn.innerText = "Tutup"; btn.onclick = () => uiPopupClose(); bc.classList.add('hidden');
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active')); document.getElementById('s-p-'+sortPrio).classList.add('active'); document.getElementById('s-o-'+sortOrder).classList.add('active');
    }
    if(!['calc', 'changelog', 'move', 'discount', 'html_export', 'sort'].includes(type)) input.focus();
}

window.uiPopupClose = function() { document.getElementById('comp-popup').classList.add('hidden'); }

/* --- CRUD ACTIONS --- */
window.sysCreate = function(type, name, autoOpen) { const id = 'ID'+Date.now(); storage.push({ id, parentId: curParent, name, type, uCode: type==='folder'?Math.random().toString(36).substring(2,5).toUpperCase():null, inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [], dateMode: 'single', customCols: [], showDate: false, showNote: false, showResi: false, showNum: true, discType:'n', discVal:0 }); dbSave(); if (autoOpen) { type === 'folder' ? navGo(id) : editOpen(id); } else { navRenderGrid(); } uiNotify("Berhasil!"); }

window.sysMove = function(targetId) { 
    if(targetId === 'HOME') targetId = null; let count = 0;
    storage.forEach(i => { if(selIds.includes(i.id)) { i.parentId = targetId; count++; } });
    if(count > 0) { dbSave(); selMode = false; selIds = []; document.getElementById('select-bar').classList.add('hidden'); document.getElementById('btn-pilih-toggle').innerText = "Pilih"; document.getElementById('btn-pilih-toggle').style.background = "var(--success)"; navRenderGrid(); uiNotify(`Berhasil pindah ${count} item!`); } else { uiNotify("Gagal memindahkan."); }
}

window.sysConfirmDelete = function() { 
    uiConfirmAction("Buang ke Sampah?", `Yakin hapus ${selIds.length} item?`, () => { 
        let allIdsToTrash = [...selIds];
        const findChildren = (parentId) => {
            storage.forEach(item => {
                if (item.parentId === parentId && !item.inTrash) {
                    allIdsToTrash.push(item.id);
                    if (item.type === 'folder') findChildren(item.id);
                }
            });
        };
        selIds.forEach(id => { const item = storage.find(x => x.id === id); if (item && item.type === 'folder') findChildren(id); });
        allIdsToTrash = [...new Set(allIdsToTrash)];

        storage.forEach(i => { if(allIdsToTrash.includes(i.id)) { i.inTrash = true; i.deletedAt = new Date().toISOString(); if (selIds.includes(i.id)) { sysAddHistory(`<b>${i.name}</b> <span class="his-detail" style="color:red">dibuang ke sampah</span>`, 'trash'); } } }); 
        dbSave(); uiToggleSelection(); navRenderGrid(); uiNotify("Dibuang ke sampah", "danger"); 
    }, true); 
}

window.sysRestore = function(id) { 
    const item = storage.find(x=>x.id===id); let target = item.parentId; let parentExists = true;
    if (target) { const parentFolder = storage.find(p => p.id === target && !p.inTrash); if (!parentFolder) parentExists = false; }
    if(!parentExists) { 
        let newFolder = storage.find(f => f.parentId === null && f.name === "Dipulihkan" && f.type === 'folder' && !f.inTrash);
        if(!newFolder) { const nfId = 'ID_RECOVER_' + Date.now(); newFolder = { id: nfId, parentId: null, name: "Dipulihkan", type: 'folder', uCode: 'REC', inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [] }; storage.push(newFolder); }
        target = newFolder.id; item.name = getUniqueName(item.name, target, item.type);
        sysAddHistory(`<b>${item.name}</b> <span class="his-detail">dipulihkan ke</span> "Dipulihkan"`, 'restore'); uiNotify("Folder asli hilang, dipulihkan ke folder baru"); 
    } else { item.name = getUniqueName(item.name, target, item.type); sysAddHistory(`<b>${item.name}</b> <span class="his-detail" style="color:green">dipulihkan</span>`, 'restore'); uiNotify("Dipulihkan!"); } 
    item.parentId = target; item.inTrash = false; dbSave(); uiTrashTab(curTrashTab); navRenderGrid(); 
}

window.uiTrashOpen = function() { document.getElementById('comp-trash-modal').classList.remove('hidden'); uiTrashTab('folder'); }
window.uiTrashClose = function() { document.getElementById('comp-trash-modal').classList.add('hidden'); }
window.uiTrashTab = function(t) { 
    curTrashTab = t; const tabs = { folder: 'tab-f', nota: 'tab-n', history: 'tab-h' }; 
    Object.keys(tabs).forEach(k => { document.getElementById(tabs[k]).className = 'tab-btn' + (k === t ? ' active-' + (t==='history'?'h':t[0]) : ''); }); 
    const list = document.getElementById('trash-list-content'); list.innerHTML = ''; const btnEmpty = document.getElementById('btn-trash-empty'); const filterBar = document.getElementById('history-filter-bar'); 
    if(t === 'history') { btnEmpty.classList.add('hidden'); filterBar.classList.remove('hidden'); renderHistoryList('all'); } else { 
        btnEmpty.classList.remove('hidden'); filterBar.classList.add('hidden'); const now = new Date(); 
        storage.filter(i => i.inTrash && i.type === t).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)).forEach(i => { 
            const delTime = new Date(i.deletedAt).getTime(); const exp = (delTime + (2 * 24 * 60 * 60 * 1000)) - now;
            const d = Math.floor(exp/86400000); const h = Math.floor((exp%86400000)/3600000); const m = Math.floor((exp%3600000)/60000); 
            list.innerHTML += `<div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;"><div style="text-align:left"><b>${i.name}</b><br><span class="trash-countdown">🕒 ${d}H ${h}J ${m}M</span></div><button onclick="sysRestore('${i.id}')" style="background:var(--nota);color:white;padding:5px 10px;border-radius:5px;font-size:10px;border:none;cursor:pointer;">Restore</button></div>`; 
        }); 
    } 
}
window.sysConfirmTrashEmpty = function() { uiConfirmAction("Hapus Permanen?", "Tab ini akan dikosongkan selamanya!", () => { storage = storage.filter(i => !(i.inTrash && i.type === curTrashTab)); dbSave(); uiTrashTab(curTrashTab); }, true); }

window.uiToggleSelection = function() { selMode = !selMode; selIds = []; document.getElementById('select-bar').classList.toggle('hidden', !selMode); const btn = document.getElementById('btn-pilih-toggle'); btn.innerText = selMode ? "Batal" : "Pilih"; btn.style.background = selMode ? "var(--danger)" : "var(--success)"; document.getElementById('txt-select-count').innerText = "0 Item"; navRenderGrid(); }
window.sysToggleSelect = function(id) { const idx = selIds.indexOf(id); if(idx > -1) selIds.splice(idx,1); else selIds.push(id); document.getElementById('txt-select-count').innerText = `${selIds.length} Item`; navRenderGrid(); }

/* --- EDITOR FUNCTIONS --- */
window.toggleInput = function(type) { const chk = document.getElementById(type === 'note' ? 'chk-show-note' : 'chk-show-resi'); const inp = document.getElementById(type === 'note' ? 'inp-nota-note' : 'inp-resi'); inp.classList.toggle('hidden', !chk.checked); if(chk.checked) inp.focus(); editStatus(false); }
window.toggleDateSection = function() { const chk = document.getElementById('chk-show-date'); const wrap = document.getElementById('date-wrapper'); const d1 = document.getElementById('inp-d1'); const d2 = document.getElementById('inp-d2'); editStatus(false); if (chk.checked) { wrap.classList.remove('hidden'); } else { const hasD1 = d1 && d1.value; const hasD2 = d2 && d2.value; if(hasD1 || hasD2) { chk.checked = true; uiConfirmAction("Matikan Tanggal?", "Tanggal akan <b>DIHAPUS/RESET</b>.<br>Lanjutkan?", () => { document.getElementById('chk-show-date').checked = false; wrap.classList.add('hidden'); if(d1) d1.value = ""; if(d2) d2.value = ""; editSave(); }, true); } else { wrap.classList.add('hidden'); } } }

window.editOpen = function(id) { 
    activeId = id; const n = storage.find(x => x.id === id); if(!n) return; 
    document.body.classList.add('mode-editor'); document.getElementById('view-list').classList.add('hidden'); document.getElementById('view-editor').classList.remove('hidden'); 
    document.getElementById('txt-nota-title').innerText = n.name; 
    const showNote = n.showNote !== undefined ? n.showNote : !!n.noteContent; document.getElementById('chk-show-note').checked = showNote; document.getElementById('inp-nota-note').classList.toggle('hidden', !showNote); document.getElementById('inp-nota-note').value = n.noteContent || "";
    const showResi = n.showResi !== undefined ? n.showResi : !!n.resi; document.getElementById('chk-show-resi').checked = showResi; document.getElementById('inp-resi').classList.toggle('hidden', !showResi); document.getElementById('inp-resi').value = n.resi || "";
    const showDate = n.showDate !== undefined ? n.showDate : false; document.getElementById('chk-show-date').checked = showDate; document.getElementById('date-wrapper').classList.toggle('hidden', !showDate);
    customCols = n.customCols || []; sysSetDateMode(n.dateMode || 'single', false); document.getElementById('comp-tbody').innerHTML = ''; n.items && n.items.length > 0 ? n.items.forEach(it => editAddRow(it)) : editAddRow(); 
    const chkNum = document.getElementById('chk-show-num'); if(chkNum) chkNum.checked = (n.showNum !== undefined ? n.showNum : true);
    editCalc(); editStatus(true); 
    if (!history.state || history.state.view !== 'editor' || history.state.id !== id) { history.pushState({view: 'editor', id: id}, null, ""); }
    localStorage.setItem('notafolder_active_id', id); sysUpdateBreadcrumbs();
}

window.sysSetDateMode = function(m, mark = true) { 
    const n = storage.find(i=>i.id===activeId); n.dateMode = m; 
    document.getElementById('btn-mode-single').classList.toggle('active', m === 'single'); document.getElementById('btn-mode-double').classList.toggle('active', m === 'double'); 
    const b = document.getElementById('comp-date-row'); 
    if (m === 'single') { b.innerHTML = `<div>Tanggal:<input type="date" id="inp-d1" class="edit-inp" value="${n.date1||''}" max="9999-12-31" oninput="editStatus(false)"></div>`; } 
    else { b.innerHTML = `<div style="display: flex; gap: 10px;"><div style="flex:1">Tgl. Masuk:<input type="date" id="inp-d1" class="edit-inp" style="width:100%" value="${n.date1||''}" max="9999-12-31" oninput="editStatus(false)"></div><div style="flex:1">Tgl. Keluar:<input type="date" id="inp-d2" class="edit-inp" style="width:100%" value="${n.date2||''}" max="9999-12-31" oninput="editStatus(false)"></div></div>`; }
    renderHeader(); if(mark) editStatus(false); 
}

window.renderHeader = function() { 
    let h = `<tr><th width="30" style="text-align:center;"><input type="checkbox" id="chk-show-num" onchange="editStatus(false)" title="Tampilkan Nomor"></th><th>Barang</th><th width="60">Jml</th><th width="100">Harga (Rp)</th>`; 
    customCols.forEach((c, i) => h += `<th>${c} <span style="color:red;cursor:pointer" onclick="editRemCol(${i})">x</span></th>`); h += `<th width="40"><div class="btn-add-col-circle" onclick="editAddCol()">+</div></th></tr>`; document.getElementById('comp-thead').innerHTML = h; 
}

window.editAddCol = function() { uiPopupOpen('col'); }
window.editAddColAction = function(name) { editSave(true); customCols.push(name); const nota = storage.find(x => x.id === activeId); if(nota.items) { nota.items.forEach(row => { if(!row.extras) row.extras = []; row.extras.push(""); }); } nota.customCols = customCols; dbSave(); editOpen(activeId); }
window.editRemCol = function(i) { const colName = customCols[i]; uiConfirmAction("Hapus Variasi?", `"${colName}" akan dihapus.`, () => { editSave(true); customCols.splice(i, 1); const nota = storage.find(x => x.id === activeId); if(nota.items) { nota.items.forEach(row => { if(row.extras) row.extras.splice(i, 1); }); } nota.customCols = customCols; dbSave(); editOpen(activeId); uiNotify("Variasi dihapus"); }, true); }

window.unformatInput = function(el) {
    if(el.classList.contains('col-jml')) return; 
    let val = el.value.replace(/\./g, '');
    if(val === '0') val = '';
    el.value = val;
}
window.formatInput = function(el) {
    if(el.classList.contains('col-jml')) { checkInputLimit(el); editCalc(); return; } 
    let val = el.value.replace(/[^0-9]/g, '');
    if(val) { el.value = parseInt(val).toLocaleString('id-ID'); }
    checkInputLimit(el); editCalc();
}

window.editAddRow = function(d = {}) { 
    const tr = document.createElement('tr'); const index = document.getElementById('comp-tbody').children.length + 1;
    let ex = ''; customCols.forEach((c, i) => ex += `<td><textarea class="edit-inp col-extra" rows="1" oninput="checkInputLimit(this)">${(d.extras&&d.extras[i])?d.extras[i]:''}</textarea></td>`); 
    
    tr.innerHTML = `<td style="text-align:center; font-size:12px; color:#64748b; font-weight:bold; vertical-align:middle;">${index}</td>
    <td><textarea class="edit-inp col-barang" rows="1" oninput="checkInputLimit(this); editStatus(false)">${d.barang||''}</textarea></td>
    <td><textarea class="edit-inp col-jml" rows="1" onkeydown="return disableEnter(event)" oninput="editCalc(); editStatus(false); checkInputLimit(this)">${d.jml!==undefined?d.jml:''}</textarea></td>
    <td><textarea class="edit-inp col-harga" rows="1" onkeydown="return disableEnter(event)" onfocus="unformatInput(this)" onblur="formatInput(this)" oninput="editCalc(); editStatus(false); checkInputLimit(this)">${d.harga!==undefined?d.harga:''}</textarea></td>${ex}
    <td style="text-align:center;"><input type="checkbox" class="row-chk"></td>`; 
    document.getElementById('comp-tbody').appendChild(tr); renumberRows();
}

window.disableEnter = function(e) { if(e.key === 'Enter') { e.preventDefault(); return false; } }
window.checkInputLimit = function(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
window.renumberRows = function() { const rows = document.querySelectorAll('#comp-tbody tr'); rows.forEach((row, index) => { row.cells[0].innerText = index + 1; }); }
window.editDeleteSelectedRows = function() { const checkedBoxes = document.querySelectorAll('#comp-tbody .row-chk:checked'); if (checkedBoxes.length === 0) return uiNotify("Pilih baris yang akan dihapus!", "danger"); uiConfirmAction("Hapus Baris?", `Yakin menghapus ${checkedBoxes.length} baris?`, () => { checkedBoxes.forEach(box => { box.closest('tr').remove(); }); renumberRows(); editCalc(); editStatus(false); uiNotify("Baris dihapus"); }, true); }

window.editSave = function(silent = false) { 
    const n = storage.find(x => x.id === activeId); const rows = []; 
    document.querySelectorAll('#comp-tbody tr').forEach(tr => { const e = []; tr.querySelectorAll('.col-extra').forEach(inp => e.push(inp.value)); rows.push({ barang: tr.querySelector('.col-barang').value, jml: tr.querySelector('.col-jml').value, harga: tr.querySelector('.col-harga').value, extras: e }); }); 
    n.items = rows; n.customCols = customCols; n.date1 = document.getElementById('inp-d1')?.value || ''; n.date2 = document.getElementById('inp-d2')?.value || ''; n.noteContent = document.getElementById('inp-nota-note').value; n.resi = document.getElementById('inp-resi').value; n.showDate = document.getElementById('chk-show-date').checked; n.showNote = document.getElementById('chk-show-note').checked; n.showResi = document.getElementById('chk-show-resi').checked; n.showNum = document.getElementById('chk-show-num').checked; n.lastEdited = new Date().toISOString(); 
    if(!silent) sysAddHistory(`<b>${n.name}</b> <span class="his-act" style="color:var(--edit)">diedit/disimpan</span>`, 'edit'); 
    dbSave(); editStatus(true); if(!silent) uiNotify("Nota Tersimpan!"); 
}

window.editCalc = function() { 
    let t = 0; 
    document.querySelectorAll('#comp-tbody tr').forEach(tr => { 
        const rawQ = sysNum(tr.querySelector('.col-jml').value); 
        const rawP = sysNum(tr.querySelector('.col-harga').value); 
        t += (rawQ * rawP); 
    }); 
    t = Math.round(t);
    const n = storage.find(i=>i.id===activeId); let finalTotal = t;
    if (n && n.discVal && n.discVal > 0) {
        let discountAmount = (n.discType === 'p') ? t * (n.discVal / 100) : n.discVal;
        if(discountAmount > t) discountAmount = t; 
        discountAmount = Math.round(discountAmount);
        finalTotal = t - discountAmount;
        document.getElementById('txt-old-total').innerText = "Rp " + t.toLocaleString('id-ID'); document.getElementById('txt-old-total').classList.remove('hidden');
    } else { document.getElementById('txt-old-total').classList.add('hidden'); }
    document.getElementById('txt-total').innerText = finalTotal.toLocaleString('id-ID'); 
}

window.editStatus = function(s) { document.getElementById('btn-preview-trigger').disabled = !s; document.getElementById('btn-preview-trigger').style.opacity = s ? "1" : "0.3"; document.getElementById('txt-save-status').innerText = s ? "✅ Siap Cetak!" : "⚠ Belum disimpan!"; }
window.uiNotify = function(msg, type='success') { const b = document.getElementById('comp-notify'); document.getElementById('notify-msg').innerText = msg; b.style.borderColor = type==='danger'?'var(--danger)':'var(--success)'; b.style.color = type==='danger'?'var(--danger)':'var(--success)'; b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 2000); }
window.sysExport = function() { const a = document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(storage)],{type:'application/json'})); a.download=`Backup.json`; a.click(); }
window.sysImport = function(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const imported = JSON.parse(ev.target.result); if (!Array.isArray(imported)) throw new Error("Format Salah"); const importFolderId = 'IMP_' + Date.now(); const dateStr = new Date().toLocaleString('id-ID').replace(/[/]/g, '-').replace(',', ''); const rootName = getUniqueName(`Hasil Import (${dateStr})`, null, 'folder'); const rootFolder = { id: importFolderId, parentId: null, name: rootName, type: 'folder', uCode: 'IMP', inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [] }; const idMap = {}; imported.forEach(i => { idMap[i.id] = 'ID' + Math.random().toString(36).substr(2, 9); }); const processed = imported.map(i => { return { ...i, id: idMap[i.id], parentId: i.parentId ? (idMap[i.parentId] || importFolderId) : importFolderId }; }); storage.push(rootFolder, ...processed); dbSave(); navRenderGrid(); uiNotify("Data Berhasil Diimpor!"); } catch(err) { uiNotify("Gagal membaca file!", "danger"); } finally { e.target.value = ''; } }; reader.readAsText(file); }

window.getFinalHTML = function() {
    const paper = document.getElementById('preview-print-area'); if(!paper) return null;
    const n = storage.find(i=>i.id===activeId); const title = n ? n.name : 'Nota';
    const styles = `body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; border: 2px solid black; font-size: 13px; } th, td { padding: 8px; border-right: 1px solid black; border-bottom: 1px solid black; } th:last-child, td:last-child { border-right: none; } thead th { border-bottom: 2px solid black; background: #eee; } .theme-modern .preview-header { background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; margin-bottom: 20px; } .theme-modern h2 { margin: 0; color: #1e293b; } .theme-modern table { border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; } .theme-modern th, .theme-modern td { border: none; border-bottom: 1px solid #f1f5f9 !important; border-right: 1px solid #e2e8f0 !important; padding: 12px !important; color: #475569; } .theme-modern th:last-child, .theme-modern td:last-child { border-right: none !important; } .theme-modern th { background: #f1f5f9; color: #334155; font-weight: 800; text-transform: uppercase; } .theme-modern .preview-total { color: #2563eb !important; text-shadow: none !important; } .theme-transparent { background: transparent; } .theme-transparent .preview-header { border-bottom: 4px solid black !important; padding-bottom: 10px; margin-bottom: 20px !important; text-align: center; } .theme-transparent table { border: none !important; } .theme-transparent th { border: none !important; border-bottom: 2px solid black !important; border-right: 1px dotted black !important; background: transparent !important; color: black !important; font-weight: 900; } .theme-transparent td { border: none !important; border-bottom: 1px dotted #999 !important; border-right: 1px dotted black !important; color: black !important; } .theme-transparent th:last-child, .theme-transparent td:last-child { border-right: none !important; } .theme-transparent .preview-total { text-decoration: underline; } .text-right { text-align: right; } .hidden { display: none; }`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body><div class="${document.getElementById('preview-print-area').className}">${paper.innerHTML}</div></body></html>`;
}
window.sysDownloadHTMLAction = function() { if(!document.getElementById('view-editor').classList.contains('hidden')) { editSave(true); } const h = getFinalHTML(); if(!h) return; const n = storage.find(i=>i.id===activeId); const b = new Blob([h], {type: 'text/html'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${n?n.name:'Nota'}.html`; a.click(); }
window.sysCopyHTML = function() { const h = getFinalHTML(); if(!h) return; navigator.clipboard.writeText(h).then(() => { uiNotify("Kode HTML Disalin!"); uiPopupClose(); }).catch(err => { uiNotify("Gagal menyalin!", "danger"); }); }

window.uiPreview = function(show, useStorage = false) {
    document.getElementById('preview-screen').classList.toggle('hidden', !show);
    if(show) {
        if(!useStorage) history.pushState({view: 'preview'}, null, ""); 
        const paper = document.getElementById('preview-paper');
        const baseScale = (window.innerWidth < 500) ? ((window.innerWidth - 30) / 450) : 1;
        const targetScale = baseScale * 0.8; paper.style.transform = `scale(${targetScale})`;
        if(window.innerWidth >= 500) { paper.style.marginTop = '30px'; } else { paper.style.marginTop = '10px'; }

        const n = storage.find(i=>i.id===activeId); let total = 0; let rows = ''; let headEx = (n.customCols || customCols).map(c => `<th>${c}</th>`).join('');
        const showNum = n.showNum; const headNum = showNum ? '<th style="padding:8px;border:1px solid black;text-align:center;width:30px;">No</th>' : '';

        if (useStorage) {
            if(n.items) {
                n.items.forEach((item, idx) => {
                    const q = sysNum(item.jml); const p = sysNum(item.harga); total += (q * p);
                    let rowEx = ''; if(item.extras) item.extras.forEach(e => rowEx += `<td style="padding:8px;text-align:center">${e}</td>`);
                    const rowNum = showNum ? `<td style="padding:8px;text-align:center;border-right:1px solid black;border-bottom:1px solid black;">${idx + 1}</td>` : '';
                    rows += `<tr>${rowNum}<td style="padding:8px">${item.barang.replace(/\n/g, "<br>")}</td><td style="padding:8px;text-align:center">${item.jml.replace(/\n/g, "<br>")}</td><td style="padding:8px">${item.harga.replace(/\n/g, "<br>")}</td>${rowEx}</tr>`;
                });
            }
        } else {
            document.querySelectorAll('#comp-tbody tr').forEach((tr, idx) => {
                const q = sysNum(tr.querySelector('.col-jml').value); const p = sysNum(tr.querySelector('.col-harga').value); total += (q*p);
                let rowEx = ''; tr.querySelectorAll('.col-extra').forEach(inp => rowEx += `<td style="padding:8px;text-align:center">${inp.value}</td>`);
                const rowNum = showNum ? `<td style="padding:8px;text-align:center;border-right:1px solid black;border-bottom:1px solid black;">${idx + 1}</td>` : '';
                rows += `<tr>${rowNum}<td style="padding:8px">${tr.querySelector('.col-barang').value.replace(/\n/g, "<br>")}</td><td style="padding:8px;text-align:center">${tr.querySelector('.col-jml').value.replace(/\n/g, "<br>")}</td><td style="padding:8px">${tr.querySelector('.col-harga').value.replace(/\n/g, "<br>")}</td>${rowEx}</tr>`;
            });
        }
        
        total = Math.round(total);
        let dateHtml = '';
        if (n.showDate) {
            if (n.dateMode === 'double') { dateHtml = `<b>Tgl. Masuk :</b> ${n.date1 ? formatDateIndo(n.date1) : "..."}<br><b>Tgl. Keluar :</b> ${n.date2 ? formatDateIndo(n.date2) : "..."}`; } 
            else { dateHtml = `Tanggal : ${n.date1 ? formatDateIndo(n.date1) : "..."}`; }
        }
        let noteHtml = n.showNote ? `<div style="margin-top:20px; font-size:12px; border-top:1px dashed #ccc; padding-top:10px;"><b>Keterangan:</b><br>${(n.noteContent||'').replace(/\n/g, "<br>")}</div>` : '';
        let resiHtml = n.showResi ? `<div style="text-align:center; margin-top:20px;"><div style="font-style:italic;font-size:12px;color:black;">No. Resi / Paket :</div><div style="font-size:18px;font-weight:bold;margin-top:5px;color:black; min-height:24px;">${n.resi||''}</div></div>` : '';
        let finalTotal = total; let totalHtml = '';
        if (n.discVal && n.discVal > 0) {
            let discountAmount = (n.discType === 'p') ? total * (n.discVal / 100) : n.discVal;
            if(discountAmount > total) discountAmount = total; 
            discountAmount = Math.round(discountAmount);
            finalTotal = total - discountAmount;
            totalHtml = `<div style="text-align:right; margin-top:20px;"><div style="text-decoration: line-through; color: #64748b; font-size: 14px; margin-bottom: 2px;">Rp ${total.toLocaleString('id-ID')}</div><div class="preview-total" style="font-weight:bold; font-size:22px">Total: Rp ${finalTotal.toLocaleString('id-ID')}</div></div>`;
        } else { totalHtml = `<div class="preview-total" style="text-align:right; margin-top:20px; font-weight:bold; font-size:22px">Total: Rp ${total.toLocaleString('id-ID')}</div>`; }

        document.getElementById('preview-content').innerHTML = `<div id="preview-print-area" class=""><div class="preview-header" style="text-align:center; border-bottom:3px solid black; padding-bottom:10px; margin-bottom:15px;"><h2 style="margin:0; text-transform:uppercase;">${n.name}</h2></div>${dateHtml ? `<div class="preview-date" style="font-style:italic; font-size:12px; margin-bottom:15px; line-height:1.6; color:#000; font-weight:normal;">${dateHtml}</div>` : ''}<table style="width:100%; border-collapse:collapse; border:2px solid black; font-size:13px;"><thead style="background:#eee"><tr>${headNum}<th style="padding:8px;border:1px solid black">Barang</th><th style="padding:8px;border:1px solid black">Jml</th><th style="padding:8px;border:1px solid black">Harga</th>${headEx}</tr></thead><tbody>${rows}</tbody></table>${totalHtml}${noteHtml}${resiHtml}<div class="${isFootActive?'':'hidden'}" style="margin-top:50px; text-align:center; font-size:10px; color:gray; font-style:italic">*By: Nota_Folder*<br>${new Date().toLocaleString()}</div></div>`;
        sysChangeTheme(curTheme);
    } else { if(history.state && history.state.view === 'preview') history.back(); }
}

window.sysDownloadImg = function() { const p = document.getElementById('preview-paper'); const oldTrans = p.style.transform; p.style.transform = 'scale(1)'; p.style.width = '450px'; html2canvas(p, {scale:3}).then(c => { const a = document.createElement('a'); a.download=`Nota.png`; a.href=c.toDataURL(); a.click(); p.style.transform = oldTrans; }); }
window.sysToggleFootnote = function() { isFootActive = !isFootActive; document.getElementById('btn-foot-toggle').innerText = isFootActive ? "Catatan: ON" : "Catatan: OFF"; uiPreview(true); }
window.sysEnterScreenshotMode = function() { document.body.classList.add('is-clean-mode'); history.pushState({view: 'clean'}, null, ""); uiNotify("Mode Screenshot: Tekan Kembali untuk keluar"); }
window.sysPrint = function() { window.print(); }

window.onbeforeunload = function() {
    if (document.body.classList.contains('mode-editor')) {
        const statusText = document.getElementById('txt-save-status').innerText;
        if (!statusText.includes("Siap Cetak")) {
            return "Data belum disimpan!";
        }
    }
};

document.getElementById('layout-toggle').checked = (layoutMode === 'desktop');
if(window.innerWidth <= 600 && layoutMode !== 'desktop') { document.body.classList.remove('is-desktop'); } else { sysToggleLayout(); }
const savedParent = localStorage.getItem('notafolder_cur_parent'); const savedNote = localStorage.getItem('notafolder_active_id');
sysSanitizeDB(); sysAutoCleanup(); 
history.replaceState({view: 'folder', id: null}, null, "");
if (savedNote) { if(savedParent) curParent = savedParent; history.pushState({view: 'folder', id: curParent}, null, ""); editOpen(savedNote); } 
else if (savedParent) { navGo(savedParent); } else { navRenderGrid(); }
if(localStorage.getItem('notafolder_view_mode')) { viewMode = localStorage.getItem('notafolder_view_mode'); sysChangeView(viewMode); }
