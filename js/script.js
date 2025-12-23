const DB_KEY = 'notafolder_db_v119_63';
const HIS_KEY = 'notafolder_his_v119_63';
let storage = JSON.parse(localStorage.getItem(DB_KEY)) || [];
let moveHis = JSON.parse(localStorage.getItem(HIS_KEY)) || [];
let curParent = null, activeId = null, selMode = false, selIds = [], curTrashTab = 'folder', customCols = [], isFootActive = false, curTheme = 'standard';
let viewMode = localStorage.getItem('notafolder_view_mode') || 'simple';
let layoutMode = localStorage.getItem('notafolder_layout') || 'mobile';
let resetTimer = null; 

/* --- CORE FUNCTIONS --- */
function dbSave() { localStorage.setItem(DB_KEY, JSON.stringify(storage)); localStorage.setItem(HIS_KEY, JSON.stringify(moveHis)); }

function getUniqueName(name, parentId, type) {
    let newName = name; let counter = 1;
    while (storage.some(i => i.parentId === parentId && i.type === type && i.name.toLowerCase() === newName.toLowerCase() && !i.inTrash)) { newName = `${name} (${counter})`; counter++; }
    return newName;
}

function formatDateIndo(isoDate) {
    if (!isoDate) return '-';
    const [y, m, d] = isoDate.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function formatDateDetail(iso) { const d = new Date(iso); return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID'); }

function getTimeAgo(iso) { const diff = (new Date() - new Date(iso)) / 1000; if (diff < 60) return "Baru saja"; if (diff < 3600) return Math.floor(diff / 60) + " menit lalu"; if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu"; return Math.floor(diff / 86400) + " hari lalu"; }

function sysNum(val) {
    if (!val) return 0;
    const clean = val.toString().replace(/\./g, '');
    return parseFloat(clean) || 0;
}

/* --- UI SYSTEM --- */
function uiShowChangelog() {
    const logs = [
        "<b>v120.9.12</b>: FIX Popup Z-Index (Overlay) & Rename Position.",
        "<b>v120.9.11</b>: Fix Rename Button (PC & Details) & Preview Grid.",
        "<b>v120.9.10</b>: Fix Preview Layout Mobile.",
        "<b>v120.9.8</b>: Fix Title Wrap (Judul Panjang).",
        "<b>v120.9.7</b>: Fix Tombol Mobile & Switch Desktop."
    ];
    uiPopupOpen('changelog', logs);
}

function sysToggleLayout() {
    const isDesktop = document.getElementById('layout-toggle').checked;
    layoutMode = isDesktop ? 'desktop' : 'mobile';
    localStorage.setItem('notafolder_layout', layoutMode);
    document.body.classList.toggle('is-desktop', isDesktop);
}

function sysChangeView(mode) {
    viewMode = mode; localStorage.setItem('notafolder_view_mode', mode);
    document.getElementById('vm-simple').classList.toggle('active', mode === 'simple');
    document.getElementById('vm-details').classList.toggle('active', mode === 'details');
    document.getElementById('comp-grid').className = mode === 'simple' ? 'grid' : 'list-container';
    navRenderGrid();
}

function sysAppResetConfirm() {
    uiPopupReset();
    const p = document.getElementById('comp-popup');
    const btn = document.getElementById('btn-popup-confirm');
    const bc = document.getElementById('btn-popup-cancel');
    const desc = document.getElementById('popup-desc');

    p.classList.remove('hidden');
    document.getElementById('popup-icon').innerText = '☢️';
    document.getElementById('popup-title').innerText = 'Reset Aplikasi';

    desc.innerHTML = `<b>PERHATIAN!</b><br>Seluruh data (Folder, Nota, History) akan <b>DIHAPUS PERMANEN</b>.<br>Aplikasi akan kembali seperti baru install.<br>Pastikan Anda sudah Export data jika ingin menyimpannya.`;
    desc.classList.remove('hidden');

    let count = 5;
    btn.disabled = true;
    btn.style.background = "#94a3b8"; 
    btn.innerText = `Tunggu ${count}s`;

    resetTimer = setInterval(() => {
        count--;
        if(count > 0) {
            btn.innerText = `Tunggu ${count}s`;
        } else {
            clearInterval(resetTimer);
            btn.disabled = false;
            btn.style.background = "var(--success)"; 
            btn.innerText = "YA, HAPUS SEMUA";
            btn.onclick = () => { localStorage.clear(); location.reload(); };
        }
    }, 1000);

    bc.onclick = () => { clearInterval(resetTimer); uiPopupClose(); };
}

/* --- CALCULATION LOGIC --- */
function sysGetFolderTotal(parentId) {
    let total = 0;
    const children = storage.filter(i => i.parentId === parentId && !i.inTrash);
    children.forEach(child => {
        if (child.type === 'nota' && child.items) {
            child.items.forEach(item => { total += (sysNum(item.jml) * sysNum(item.harga)); });
        } else if (child.type === 'folder') {
            total += sysGetFolderTotal(child.id);
        }
    });
    return total;
}

function sysSumSelected() {
    if(selIds.length === 0) return uiNotify("Pilih item dulu!", "danger");
    let totalSum = 0; let folders = []; let files = [];
    selIds.forEach(id => {
        const item = storage.find(i => i.id === id);
        if(item) {
            let itemVal = 0;
            if(item.type === 'nota' && item.items) { 
                item.items.forEach(r => itemVal += (sysNum(r.jml) * sysNum(r.harga))); 
                files.push({ name: item.name, val: itemVal }); 
            } 
            else if(item.type === 'folder') { 
                itemVal = sysGetFolderTotal(item.id); 
                folders.push({ name: item.name, val: itemVal }); 
            }
            totalSum += itemVal;
        }
    });
    folders.sort((a, b) => a.name.localeCompare(b.name)); files.sort((a, b) => a.name.localeCompare(b.name));
    uiPopupOpen('calc', { total: totalSum, folders: folders, files: files });
}

function sysToggleSelectAll(isChecked) {
    const visibleItems = storage.filter(i => i.parentId === curParent && !i.inTrash);
    if(isChecked) { selIds = visibleItems.map(i => i.id); } else { selIds = []; }
    document.getElementById('txt-select-count').innerText = `${selIds.length} Item`;
    navRenderGrid();
}

/* --- NAVIGATION & RENDERING --- */
function sysUpdateBreadcrumbs() {
    const bc = document.getElementById('comp-breadcrumbs');
    bc.innerHTML = ''; 
    let liRoot = document.createElement('li'); liRoot.innerText = 'Beranda'; liRoot.onclick = () => navGo(null); bc.appendChild(liRoot);

    let pathStack = [];
    let tempParent = curParent;
    if (activeId) { const n = storage.find(i => i.id === activeId); if(n) tempParent = n.parentId; }

    let tid = tempParent; let safeguard = 0;
    while(tid && safeguard < 50){
        let f = storage.find(i => i.id === tid);
        if(f){ pathStack.unshift(f); tid = f.parentId; } else break;
        safeguard++;
    }

    pathStack.forEach(f => {
        let li = document.createElement('li'); li.innerText = f.name; li.onclick = () => navGo(f.id); bc.appendChild(li);
    });

    if (activeId) {
        const currentFile = storage.find(i => i.id === activeId);
        if (currentFile) {
            let li = document.createElement('li'); li.innerText = currentFile.name; li.className = 'active-file'; bc.appendChild(li);
        }
    }
}

function sysQuickPreview(id) {
    activeId = id; history.pushState({view: 'preview', id: id}, null, ""); uiPreview(true, true); 
}

function navRenderGrid() {
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
    if(selMode) { const isAll = items.length > 0 && items.every(i => selIds.includes(i.id)); document.getElementById('cb-select-all').checked = isAll; }
    
    if(items.length === 0) { grid.innerHTML = '<div style="text-align:center; color:gray; padding:20px; grid-column:span 8;">Folder Kosong</div>'; return; }
    
    items.forEach(item => {
        const qvBtn = item.type === 'nota' ? `<div class="btn-quick-view" onclick="event.stopPropagation(); sysQuickPreview('${item.id}')">👁️</div>` : '';
        const isSel = selIds.includes(item.id);
        
        let dispName = item.name;
        const limit = viewMode === 'simple' ? 13 : 18;
        if(dispName.length > limit) dispName = dispName.substring(0, limit) + '...';

        if (viewMode === 'simple') {
            const card = document.createElement('div'); card.className = `card ${isSel ? 'selected' : ''}`;
            card.style.borderTop = `5px solid ${item.type === 'folder' ? 'var(--folder)' : 'var(--nota)'}`;
            card.innerHTML = `${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div><div class="card-icon">${item.type==='folder'?'📁':'📄'}</div><b>${dispName}</b><span class="time-label">${getTimeAgo(item.createdAt)}</span>`;
            card.onclick = () => selMode ? sysToggleSelect(item.id) : (item.type==='folder' ? navGo(item.id) : editOpen(item.id));
            grid.appendChild(card);
        } else {
            const row = document.createElement('div'); row.className = `list-item ${isSel ? 'selected' : ''}`;
            const icon = item.type === 'folder' ? '📁' : '📄'; 
            const dateEdit = formatDateDetail(item.lastEdited);
            let metaHtml = '';
            
            if (item.type === 'folder') { 
                const count = storage.filter(x => x.parentId === item.id && !x.inTrash).length; 
                const folderTotal = sysGetFolderTotal(item.id); 
                metaHtml = `<div class="meta-line">📂 Isi: ${count} File</div><div class="meta-line" style="color:#16a34a;font-weight:bold;">💰 Rp ${folderTotal.toLocaleString('id-ID')}</div><div class="meta-line">✏️ Edit: ${dateEdit}</div>`; 
            } else { 
                let itemCount = item.items ? item.items.length : 0; let total = 0; 
                if(item.items) item.items.forEach(r => total += (sysNum(r.jml) * sysNum(r.harga))); 
                metaHtml = `<div class="meta-line">📦 ${itemCount} Barang</div><div class="meta-line" style="color:var(--nota);font-weight:bold;">💰 Rp ${total.toLocaleString('id-ID')}</div><div class="meta-line">✏️ Edit: ${dateEdit}</div>`; 
            }
            
            // FIX: BUTTON RENAME & QUICK VIEW
            row.innerHTML = `<div class="list-icon">${icon}</div><div class="list-body"><div class="list-title">${dispName}</div><div class="list-meta-row">${metaHtml}</div></div>${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div>`;
            
            row.onclick = () => selMode ? sysToggleSelect(item.id) : (item.type==='folder' ? navGo(item.id) : editOpen(item.id));
            grid.appendChild(row);
        }
    });
}

function sysSearch(k) { 
    const grid = document.getElementById('comp-grid'); 
    if(!k){ navRenderGrid(); return; } 
    grid.innerHTML = ''; 
    grid.className = viewMode === 'simple' ? 'grid' : 'list-container';

    const r = storage.filter(i => !i.inTrash && (i.name.toLowerCase().includes(k.toLowerCase()) || (i.uCode && i.uCode.toLowerCase().includes(k.toLowerCase())))); 
    if(r.length === 0){ grid.innerHTML = '<div style="width:100%;text-align:center;color:gray;grid-column:span 2">Tidak ada</div>'; return; } 
    
    r.forEach(item => {
        const qvBtn = item.type === 'nota' ? `<div class="btn-quick-view" onclick="event.stopPropagation(); sysQuickPreview('${item.id}')">👁️</div>` : '';
        const p = storage.find(x => x.id === item.parentId);
        const l = p ? p.name : 'Beranda';

        if (viewMode === 'simple') {
            const card = document.createElement('div'); card.className = 'card';
            card.style.borderTop = `5px solid ${item.type === 'folder' ? 'var(--folder)' : 'var(--nota)'}`;
            card.innerHTML = `${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div><div class="card-icon">${item.type==='folder'?'📁':'📄'}</div><b>${item.name}</b><span class="time-label">di ${l}</span>`;
            card.onclick = () => item.type === 'folder' ? navGo(item.id) : editOpen(item.id);
            grid.appendChild(card);
        } else {
            const row = document.createElement('div'); row.className = 'list-item';
            const icon = item.type === 'folder' ? '📁' : '📄'; 
            let metaHtml = `<div class="time-label">Lokasi: ${l}</div>`;
            
            row.innerHTML = `<div class="list-icon">${icon}</div><div class="list-body"><div class="list-title">${item.name}</div><div class="list-meta-row">${metaHtml}</div></div>${qvBtn}<div class="btn-rename-u" onclick="event.stopPropagation(); uiPopupOpen('rename', '${item.id}')">✎</div>`;
            
            row.onclick = () => item.type === 'folder' ? navGo(item.id) : editOpen(item.id);
            grid.appendChild(row);
        }
    });
}

function navGo(id) { 
    curParent = id; activeId = null; selMode = false; selIds = []; 
    document.body.classList.remove('mode-editor');
    document.getElementById('view-editor').classList.add('hidden'); 
    document.getElementById('view-list').classList.remove('hidden'); 
    document.getElementById('select-bar').classList.add('hidden'); 
    document.getElementById('inp-search').value = ""; // Clear Search
    
    navRenderGrid();
    localStorage.setItem('notafolder_cur_parent', id || '');
    localStorage.removeItem('notafolder_active_id');
    
    if (!history.state || history.state.id !== id || history.state.view !== 'folder') {
        history.pushState({view: 'folder', id: id}, null, "");
    }
}

function navBack(isHardware = false) { 
    if(!isHardware) {
        if(activeId) {
            const n = storage.find(i => i.id === activeId);
            navGo(n ? n.parentId : null); 
        } else if(curParent) {
            const p = storage.find(i => i.id === curParent);
            navGo(p ? p.parentId : null); 
        }
    }
}

// BROWSER BACK HANDLER
window.onpopstate = function(event) { 
    if(!document.getElementById('comp-popup').classList.contains('hidden')) { uiPopupClose(); return; } 
    if(!document.getElementById('comp-trash-modal').classList.contains('hidden')) { uiTrashClose(); return; } 
    if(!document.getElementById('preview-screen').classList.contains('hidden')) { uiPreview(false); return; } 
    if(document.body.classList.contains('is-clean-mode')) { document.body.classList.remove('is-clean-mode'); return; } 

    if(event.state) {
        if(event.state.view === 'editor') {
            const noteId = event.state.id;
            const n = storage.find(x => x.id === noteId);
            if(n) {
                // Restore Editor State without pushing new history
                activeId = noteId;
                curParent = n.parentId;
                
                document.body.classList.add('mode-editor');
                document.getElementById('view-list').classList.add('hidden'); 
                document.getElementById('view-editor').classList.remove('hidden'); 
                document.getElementById('txt-nota-title').innerText = n.name; 
                
                document.getElementById('chk-show-note').checked = (n.showNote !== undefined ? n.showNote : !!n.noteContent);
                document.getElementById('inp-nota-note').classList.toggle('hidden', !document.getElementById('chk-show-note').checked);
                document.getElementById('inp-nota-note').value = n.noteContent || "";
                
                document.getElementById('chk-show-resi').checked = (n.showResi !== undefined ? n.showResi : !!n.resi);
                document.getElementById('inp-resi').classList.toggle('hidden', !document.getElementById('chk-show-resi').checked);
                document.getElementById('inp-resi').value = n.resi || "";

                const showDate = n.showDate !== undefined ? n.showDate : false;
                document.getElementById('chk-show-date').checked = showDate;
                document.getElementById('date-wrapper').classList.toggle('hidden', !showDate);
                
                const chkNum = document.getElementById('chk-show-num');
                if(chkNum) chkNum.checked = (n.showNum !== undefined ? n.showNum : true);

                customCols = n.customCols || []; 
                sysSetDateMode(n.dateMode || 'single', false); 
                document.getElementById('comp-tbody').innerHTML = ''; 
                if(n.items && n.items.length > 0) n.items.forEach(it => editAddRow(it)); else editAddRow(); 
                
                editCalc(); editStatus(true); 
                sysUpdateBreadcrumbs();
            } else { navGo(null); }
        } else {
            curParent = event.state.id;
            activeId = null;
            navRenderGrid();
        }
    } else {
        curParent = null; activeId = null; navRenderGrid();
    }
};

function sysChangeTheme(theme) { curTheme = theme; const paper = document.getElementById('preview-print-area'); if(!paper) return; paper.className = ''; if(theme === 'modern') paper.classList.add('theme-modern'); if(theme === 'transparent') paper.classList.add('theme-transparent'); }

/* --- HISTORY & TRASH --- */
function sysAddHistory(msg, type = 'general') { const now = Date.now(); const t = new Date().toLocaleString('id-ID'); moveHis.unshift({ msg: msg, fullTime: t, type: type, timestamp: now }); const typeItems = moveHis.filter(h => h.type === type || (type === 'trash' && (h.type === 'trash' || h.type === 'restore'))); if (typeItems.length > 50) { const itemToRemove = typeItems[typeItems.length - 1]; moveHis = moveHis.filter(h => h !== itemToRemove); } dbSave(); }

function renderHistoryList(filter) { const list = document.getElementById('trash-list-content'); list.innerHTML = ''; const now = Date.now(); const maxAge = 15 * 24 * 60 * 60 * 1000; moveHis = moveHis.filter(h => { const itemTime = h.timestamp || now; return (now - itemTime) < maxAge; }); dbSave(); document.querySelectorAll('.his-btn').forEach(b => b.classList.remove('active')); document.querySelector(`.his-btn.h-${filter}`).classList.add('active'); const filtered = (filter === 'all') ? moveHis : moveHis.filter(h => { if(filter === 'trash') return h.type === 'trash' || h.type === 'restore'; return h.type === filter; }); if(filtered.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">Belum ada riwayat</div>'; return; } filtered.forEach(h => { let borderColor = '#eee'; if(h.type === 'move') borderColor = 'var(--move)'; if(h.type === 'edit') borderColor = 'var(--edit)'; if(h.type === 'trash' || h.type === 'restore') borderColor = 'var(--danger)'; const itemTime = h.timestamp || now; const daysLeft = Math.ceil((maxAge - (now - itemTime)) / (86400000)); list.innerHTML += `<div class="history-item" style="border-left: 4px solid ${borderColor};">${h.msg}<div class="his-time"><span>${h.fullTime}</span><span class="his-life">Sisa ${daysLeft} Hari</span></div></div>`; }); }

/* --- POPUP SYSTEM --- */
function uiPopupReset() {
    document.getElementById('popup-desc').classList.add('hidden');
    document.getElementById('popup-input-wrapper').classList.add('hidden');
    document.getElementById('popup-content-calc').classList.add('hidden');
    document.getElementById('popup-opt-wrapper').classList.add('hidden');
    document.getElementById('popup-disc-wrapper').classList.add('hidden'); 
    document.getElementById('popup-select').classList.add('hidden'); 
    document.getElementById('btn-popup-extra').classList.add('hidden');
    if(resetTimer) { clearInterval(resetTimer); resetTimer = null; }
    const btn = document.getElementById('btn-popup-confirm');
    const bc = document.getElementById('btn-popup-cancel');
    btn.classList.remove('hidden'); bc.classList.remove('hidden');
    btn.disabled = false; btn.style.background = "var(--nota)"; btn.innerText = "Simpan"; 
    bc.onclick = () => { uiPopupClose(); };
    document.getElementById('popup-input').value = ""; document.getElementById('popup-desc').innerHTML = ""; 
}

function uiConfirmAction(t, d, o, s) { 
    uiPopupReset(); 
    const c = document.getElementById('comp-popup'); 
    document.getElementById('popup-icon').innerText = s ? '⚠️' : 'ℹ️'; 
    document.getElementById('popup-title').innerText = t; 
    document.getElementById('popup-desc').innerHTML = d; 
    document.getElementById('popup-desc').classList.remove('hidden'); 
    const b = document.getElementById('btn-popup-confirm'); const bc = document.getElementById('btn-popup-cancel');
    b.style.background = s ? "var(--danger)" : "var(--success)"; b.innerText = s ? "Hapus" : "Ya"; b.disabled = false; 
    bc.style.background = "#f1f5f9"; bc.style.color = "#64748b"; bc.innerText = "Batal"; 
    c.classList.remove('hidden'); 
    b.onclick = () => { o(); uiPopupClose(); }; bc.onclick = () => { uiPopupClose(); }; 
}

function uiPopupOpen(type, extra = null) {
    uiPopupReset(); 
    const o = document.getElementById('comp-popup'); const input = document.getElementById('popup-input'); const wrap = document.getElementById('popup-input-wrapper'); const btn = document.getElementById('btn-popup-confirm'); const icon = document.getElementById('popup-icon'); const title = document.getElementById('popup-title'); const sel = document.getElementById('popup-select'); const optWrap = document.getElementById('popup-opt-wrapper'); const chkOpen = document.getElementById('popup-chk-open'); const desc = document.getElementById('popup-desc'); const calcArea = document.getElementById('popup-content-calc'); const bc = document.getElementById('btn-popup-cancel'); const discWrap = document.getElementById('popup-disc-wrapper'); const extraBtn = document.getElementById('btn-popup-extra'); 

    o.classList.remove('hidden');
    btn.style.background = "var(--nota)"; btn.innerText = "Simpan"; btn.disabled = false;
    bc.style.background = "#f1f5f9"; bc.style.color = "#64748b"; bc.innerText = "Batal"; bc.onclick = () => { uiPopupClose(); }; 
    
    const savedAutoOpen = localStorage.getItem('notafolder_auto_open_pref'); chkOpen.checked = savedAutoOpen === 'true';

    if(type === 'folder' || type === 'nota') { 
        icon.innerText = type === 'folder' ? '📁' : '📄'; title.innerText = "Buat " + type; input.placeholder = "Nama " + type; 
        wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); optWrap.classList.remove('hidden'); 
        btn.onclick = () => { 
            if(input.value.trim()){ 
                localStorage.setItem('notafolder_auto_open_pref', chkOpen.checked); 
                const safeName = getUniqueName(input.value.trim(), curParent, type);
                sysCreate(type, safeName, chkOpen.checked); uiPopupClose(); 
            } 
        }; 
    }
    else if(type === 'discount') {
        icon.innerText = '🏷️'; title.innerText = "Atur Diskon";
        wrap.classList.remove('hidden'); input.classList.add('hidden'); discWrap.classList.remove('hidden'); 
        const n = storage.find(i=>i.id===activeId);
        document.getElementById('disc-type').value = n.discType || 'n'; document.getElementById('disc-val').value = n.discVal || '';
        btn.onclick = () => {
             const dType = document.getElementById('disc-type').value; const dVal = parseFloat(document.getElementById('disc-val').value) || 0;
             if(dType === 'p' && dVal > 100) return uiNotify("Maksimal 100%", "danger");
             let subtotal = 0; document.querySelectorAll('#comp-tbody tr').forEach(tr => { const rawQ = tr.querySelector('.col-jml').value.replace(/\./g, ''); const rawP = tr.querySelector('.col-harga').value.replace(/\./g, ''); subtotal += ((parseFloat(rawQ)||0) * (parseFloat(rawP)||0)); });
             if(dType === 'n' && dVal > subtotal) return uiNotify("Diskon melebihi total!", "danger");
             n.discType = dType; n.discVal = dVal; editCalc(); uiPopupClose(); uiNotify("Diskon Disimpan");
        };
    }
    else if(type === 'html_export') {
        icon.innerText = '🌐'; title.innerText = "Export HTML";
        desc.innerHTML = `Beberapa browser Android tidak dapat melakukan Download / Simpan Baik .png / .pdf / .html.<br><br>Sehingga kami menyediakan Opsi Salin HTML agar file nota dapat di simpan ke peragkat, gunakan web / aplikasi pihak ke tiga (3).`;
        desc.style.fontSize = "11px"; desc.style.textAlign = "justify"; desc.classList.remove('hidden'); wrap.classList.add('hidden'); 
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
        const item = storage.find(i => i.id === extra); 
        icon.innerText = '✎'; title.innerText = "Ubah Nama"; 
        wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); 
        input.value = item.name; btn.innerText = "Update"; btn.style.background = "var(--success)"; 
        btn.onclick = () => { 
            if(input.value.trim()){ 
                if (input.value.trim().toLowerCase() !== item.name.toLowerCase()) { item.name = getUniqueName(input.value.trim(), item.parentId, item.type); }
                dbSave(); uiPopupClose(); navRenderGrid(); if(activeId) sysUpdateBreadcrumbs(); uiNotify("Nama diubah!"); 
            } 
        }; 
    }
    else if(type === 'move') { 
        if(selIds.length === 0) { uiPopupClose(); return uiNotify("Pilih item dulu!", "danger"); } 
        icon.innerText = '🚚'; title.innerText = "Pindahkan Item"; 
        desc.innerText = "Pilih Folder Tujuan:"; desc.classList.remove('hidden'); wrap.classList.remove('hidden'); input.classList.add('hidden'); sel.classList.remove('hidden'); 
        
        // FIX: Ancestor Check Logic (Ghost Folder Fix)
        const validDestinations = storage.filter(f => {
            if (f.type !== 'folder') return false; 
            if (f.inTrash) return false; 
            if (f.id === curParent) return false; 
            
            // Prevent recursive move (parent into child)
            let tempParent = f.parentId;
            while(tempParent) {
                if(selIds.includes(tempParent)) return false; 
                const p = storage.find(x => x.id === tempParent);
                if(!p) break;
                tempParent = p.parentId;
            }
            if (selIds.includes(f.id)) return false; 

            // FIX: Check if ancestors are in trash
            let pointer = f.parentId;
            while(pointer) {
                const parentObj = storage.find(x => x.id === pointer);
                if(!parentObj) break; 
                if(parentObj.inTrash) return false; // Ancestor in trash!
                pointer = parentObj.parentId;
            }

            return true;
        });

        sel.innerHTML = '<option value="">-- Pilih Folder --</option><option value="HOME">🏠 BERANDA</option>'; 
        validDestinations.sort((a,b)=>a.name.localeCompare(b.name)).forEach(f => { sel.innerHTML += `<option value="${f.id}">📁 ${f.name}</option>`; }); 
        
        btn.innerText = "Pindah"; btn.style.background = "var(--folder)"; 
        btn.onclick = () => { sysMove(sel.value); }; 
    }
    else if(type === 'col') { 
        icon.innerText = '➕'; title.innerText = "Tambah Variasi"; 
        wrap.classList.remove('hidden'); input.classList.remove('hidden'); sel.classList.add('hidden'); 
        input.placeholder = "Nama Variasi"; btn.innerText = "Tambah"; btn.style.background = "var(--nota)"; 
        btn.onclick = () => { if(input.value.trim()){ editAddColAction(input.value.trim()); uiPopupClose(); } }; 
    }
    else if(type === 'changelog') { 
        icon.innerText = '📜'; title.innerText = "Riwayat Update"; 
        desc.classList.remove('hidden'); desc.style.textAlign = "left"; desc.style.maxHeight = "300px"; desc.style.overflowY = "auto"; 
        desc.innerHTML = extra.map(l => `<div style="border-bottom:1px solid #eee; padding:8px 0;">${l}</div>`).join(''); 
        btn.innerText = "Tutup"; btn.onclick = () => uiPopupClose(); bc.classList.add('hidden'); 
    }
    
    if(!['calc', 'changelog', 'move', 'discount', 'html_export'].includes(type)) input.focus();
}

function uiPopupClose() { document.getElementById('comp-popup').classList.add('hidden'); }

/* --- CRUD ACTIONS --- */
function sysCreate(type, name, autoOpen) { const id = 'ID'+Date.now(); storage.push({ id, parentId: curParent, name, type, uCode: type==='folder'?Math.random().toString(36).substring(2,5).toUpperCase():null, inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [], dateMode: 'single', customCols: [], showDate: false, showNote: false, showResi: false, showNum: true, discType:'n', discVal:0 }); dbSave(); if (autoOpen) { type === 'folder' ? navGo(id) : editOpen(id); } else { navRenderGrid(); } uiNotify("Berhasil!"); }

function sysMove(targetId) { 
    if(!targetId && targetId !== null) return; 

    let targetName = "BERANDA";
    if (targetId === 'HOME') {
        targetId = null;
    } else {
        const targetFolder = storage.find(f => f.id === targetId && !f.inTrash);
        if (!targetFolder) return uiNotify("Folder tujuan tidak valid!", "danger");
        targetName = targetFolder.name;
    }

    let moveCount = 0;
    storage.forEach(i => {
        if(selIds.includes(i.id)) {
            sysAddHistory(`<b>${i.name}</b> <span class="his-detail">dipindahkan ke</span> 📁 ${targetName}`, 'move');
            i.parentId = targetId;
            moveCount++;
        }
    });

    if(moveCount > 0) {
        dbSave();
        uiPopupClose();
        uiToggleSelection();
        navRenderGrid();
        uiNotify(`Berhasil memindahkan ${moveCount} item!`);
    }
}

function sysConfirmDelete() { uiConfirmAction("Buang ke Sampah?", `Yakin hapus ${selIds.length} item?`, () => { storage.forEach(i => { if(selIds.includes(i.id)) { i.inTrash = true; i.deletedAt = new Date().toISOString(); sysAddHistory(`<b>${i.name}</b> <span class="his-detail" style="color:red">dibuang ke sampah</span>`, 'trash'); } }); dbSave(); uiToggleSelection(); navRenderGrid(); uiNotify("Dibuang ke sampah", "danger"); }, true); }

function sysRestore(id) { 
    const item = storage.find(x=>x.id===id); let target = item.parentId; let parentExists = true;
    if (target) { const parentFolder = storage.find(p => p.id === target && !p.inTrash); if (!parentFolder) parentExists = false; }
    if(!parentExists) { 
        let newFolder = storage.find(f => f.parentId === null && f.name === "Dipulihkan" && f.type === 'folder' && !f.inTrash);
        if(!newFolder) { const nfId = 'ID_RECOVER_' + Date.now(); newFolder = { id: nfId, parentId: null, name: "Dipulihkan", type: 'folder', uCode: 'REC', inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [] }; storage.push(newFolder); }
        target = newFolder.id; item.name = getUniqueName(item.name, target, item.type);
        sysAddHistory(`<b>${item.name}</b> <span class="his-detail">dipulihkan ke</span> "Dipulihkan"`, 'restore'); uiNotify("Folder asli hilang, dipulihkan ke folder baru"); 
    } else { 
        item.name = getUniqueName(item.name, target, item.type); sysAddHistory(`<b>${item.name}</b> <span class="his-detail" style="color:green">dipulihkan</span>`, 'restore'); uiNotify("Dipulihkan!"); 
    } 
    item.parentId = target; item.inTrash = false; dbSave(); uiTrashTab(curTrashTab); navRenderGrid(); 
}

function uiTrashOpen() { document.getElementById('comp-trash-modal').classList.remove('hidden'); uiTrashTab('folder'); }
function uiTrashClose() { document.getElementById('comp-trash-modal').classList.add('hidden'); }
function uiTrashTab(t) { curTrashTab = t; const tabs = { folder: 'tab-f', nota: 'tab-n', history: 'tab-h' }; Object.keys(tabs).forEach(k => { document.getElementById(tabs[k]).className = 'tab-btn' + (k === t ? ' active-' + (t==='history'?'h':t[0]) : ''); }); const list = document.getElementById('trash-list-content'); list.innerHTML = ''; const btnEmpty = document.getElementById('btn-trash-empty'); const filterBar = document.getElementById('history-filter-bar'); if(t === 'history') { btnEmpty.classList.add('hidden'); filterBar.classList.remove('hidden'); renderHistoryList('all'); } else { btnEmpty.classList.remove('hidden'); filterBar.classList.add('hidden'); const now = new Date(); storage.filter(i => i.inTrash && i.type === t).forEach(i => { const exp = new Date(new Date(i.deletedAt).getTime() + 30*86400000) - now; const d = Math.floor(exp/86400000), h = Math.floor((exp%86400000)/3600000), m = Math.floor((exp%3600000)/60000); list.innerHTML += `<div style="padding:10px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;"><div style="text-align:left"><b>${i.name}</b><br><span class="trash-countdown">Sisa ${d}H ${h}J ${m}M</span></div><button onclick="sysRestore('${i.id}')" style="background:var(--nota);color:white;padding:5px 10px;border-radius:5px;font-size:10px">Restore</button></div>`; }); } }
function sysConfirmTrashEmpty() { uiConfirmAction("Hapus Permanen?", "Tab ini akan dikosongkan selamanya!", () => { storage = storage.filter(i => !(i.inTrash && i.type === curTrashTab)); dbSave(); uiTrashTab(curTrashTab); }, true); }

function uiToggleSelection() { selMode = !selMode; selIds = []; document.getElementById('select-bar').classList.toggle('hidden', !selMode); const btn = document.getElementById('btn-pilih-toggle'); btn.innerText = selMode ? "Batal" : "Pilih"; btn.style.background = selMode ? "var(--danger)" : "var(--success)"; document.getElementById('txt-select-count').innerText = "0 Item"; navRenderGrid(); }
function sysToggleSelect(id) { const idx = selIds.indexOf(id); if(idx > -1) selIds.splice(idx,1); else selIds.push(id); document.getElementById('txt-select-count').innerText = `${selIds.length} Item`; navRenderGrid(); }

/* --- EDITOR FUNCTIONS --- */
function toggleInput(type) {
    const chk = document.getElementById(type === 'note' ? 'chk-show-note' : 'chk-show-resi');
    const inp = document.getElementById(type === 'note' ? 'inp-nota-note' : 'inp-resi');
    inp.classList.toggle('hidden', !chk.checked);
    if(chk.checked) inp.focus();
}

function toggleDateSection() {
    const chk = document.getElementById('chk-show-date');
    const wrap = document.getElementById('date-wrapper');
    const d1 = document.getElementById('inp-d1');
    const d2 = document.getElementById('inp-d2');

    if (chk.checked) {
        wrap.classList.remove('hidden');
    } else {
        const hasD1 = d1 && d1.value; const hasD2 = d2 && d2.value;
        if(hasD1 || hasD2) {
            chk.checked = true; 
            uiConfirmAction("Matikan Tanggal?", "Tanggal yang sudah diisi akan <b>DIHAPUS/RESET</b>.<br>Lanjutkan?", () => { document.getElementById('chk-show-date').checked = false; wrap.classList.add('hidden'); if(d1) d1.value = ""; if(d2) d2.value = ""; editSave(); }, true);
        } else { wrap.classList.add('hidden'); }
    }
}

function editOpen(id) { 
    activeId = id; const n = storage.find(x => x.id === id); if(!n) return; 
    
    document.body.classList.add('mode-editor');
    document.getElementById('view-list').classList.add('hidden'); 
    document.getElementById('view-editor').classList.remove('hidden'); 
    document.getElementById('txt-nota-title').innerText = n.name; 
    
    const showNote = n.showNote !== undefined ? n.showNote : !!n.noteContent; 
    document.getElementById('chk-show-note').checked = showNote;
    document.getElementById('inp-nota-note').classList.toggle('hidden', !showNote);
    document.getElementById('inp-nota-note').value = n.noteContent || "";

    const showResi = n.showResi !== undefined ? n.showResi : !!n.resi; 
    document.getElementById('chk-show-resi').checked = showResi;
    document.getElementById('inp-resi').classList.toggle('hidden', !showResi);
    document.getElementById('inp-resi').value = n.resi || "";

    const showDate = n.showDate !== undefined ? n.showDate : false; 
    document.getElementById('chk-show-date').checked = showDate;
    document.getElementById('date-wrapper').classList.toggle('hidden', !showDate);
    
    customCols = n.customCols || []; sysSetDateMode(n.dateMode || 'single', false); 
    document.getElementById('comp-tbody').innerHTML = ''; 
    n.items && n.items.length > 0 ? n.items.forEach(it => editAddRow(it)) : editAddRow(); 
    
    const chkNum = document.getElementById('chk-show-num'); if(chkNum) chkNum.checked = (n.showNum !== undefined ? n.showNum : true);
    
    editCalc(); editStatus(true); 
    if (!history.state || history.state.view !== 'editor' || history.state.id !== id) { history.pushState({view: 'editor', id: id}, null, ""); }
    localStorage.setItem('notafolder_active_id', id);
    sysUpdateBreadcrumbs();
}

function sysSetDateMode(m, mark = true) { 
    const n = storage.find(i=>i.id===activeId); n.dateMode = m; 
    document.getElementById('btn-mode-single').classList.toggle('active', m === 'single'); 
    document.getElementById('btn-mode-double').classList.toggle('active', m === 'double'); 
    const b = document.getElementById('comp-date-row'); 
    if (m === 'single') { b.innerHTML = `<div>Tanggal:<input type="date" id="inp-d1" class="edit-inp" value="${n.date1||''}" max="9999-12-31" oninput="editStatus(false)"></div>`; } 
    else { b.innerHTML = `<div style="display: flex; gap: 10px;"><div style="flex:1">Tgl. Masuk:<input type="date" id="inp-d1" class="edit-inp" style="width:100%" value="${n.date1||''}" max="9999-12-31" oninput="editStatus(false)"></div><div style="flex:1">Tgl. Keluar:<input type="date" id="inp-d2" class="edit-inp" style="width:100%" value="${n.date2||''}" max="9999-12-31" oninput="editStatus(false)"></div></div>`; }
    renderHeader(); if(mark) editStatus(false); 
}

function renderHeader() { 
    let h = `<tr><th width="30" style="text-align:center;"><input type="checkbox" id="chk-show-num" onchange="editStatus(false)" title="Tampilkan Nomor di Nota"></th><th>Barang</th><th width="60">Jml</th><th width="100">Harga (Rp)</th>`; 
    customCols.forEach((c, i) => h += `<th>${c} <span style="color:red;cursor:pointer" onclick="editRemCol(${i})">x</span></th>`); 
    h += `<th width="40"><div class="btn-add-col-circle" onclick="editAddCol()">+</div></th></tr>`; 
    document.getElementById('comp-thead').innerHTML = h; 
}

function editAddCol() { uiPopupOpen('col'); }
function editAddColAction(name) { editSave(true); customCols.push(name); const nota = storage.find(x => x.id === activeId); if(nota.items) { nota.items.forEach(row => { if(!row.extras) row.extras = []; row.extras.push(""); }); } nota.customCols = customCols; dbSave(); editOpen(activeId); }
function editRemCol(i) { const colName = customCols[i]; uiConfirmAction("Hapus Variasi?", `"${colName}" akan dihapus.`, () => { editSave(true); customCols.splice(i, 1); const nota = storage.find(x => x.id === activeId); if(nota.items) { nota.items.forEach(row => { if(row.extras) row.extras.splice(i, 1); }); } nota.customCols = customCols; dbSave(); editOpen(activeId); uiNotify("Variasi dihapus"); }, true); }

function editAddRow(d = {}) { 
    const tr = document.createElement('tr'); const index = document.getElementById('comp-tbody').children.length + 1;
    let ex = ''; customCols.forEach((c, i) => ex += `<td><textarea class="edit-inp col-extra" rows="1" oninput="checkInputLimit(this)">${(d.extras&&d.extras[i])?d.extras[i]:''}</textarea></td>`); 
    tr.innerHTML = `<td style="text-align:center; font-size:12px; color:#64748b; font-weight:bold; vertical-align:middle;">${index}</td><td><textarea class="edit-inp col-barang" rows="1" oninput="checkInputLimit(this)">${d.barang||''}</textarea></td><td><textarea class="edit-inp col-jml" rows="1" onkeydown="return disableEnter(event)" oninput="formatAndCalc(this)">${d.jml!==undefined?d.jml:''}</textarea></td><td><textarea class="edit-inp col-harga" rows="1" onkeydown="return disableEnter(event)" oninput="formatAndCalc(this)">${d.harga!==undefined?d.harga:''}</textarea></td>${ex}<td style="text-align:center;"><input type="checkbox" class="row-chk"></td>`; 
    document.getElementById('comp-tbody').appendChild(tr); 
}

function disableEnter(e) { if(e.key === 'Enter') { e.preventDefault(); return false; } }
function formatAndCalc(el) { checkInputLimit(el); let val = el.value.replace(/\D/g, ''); if (val !== "") { val = parseInt(val, 10).toLocaleString('id-ID'); el.value = val; } else { el.value = ""; } editCalc(); }
function checkInputLimit(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; editStatus(false); }
function renumberRows() { const rows = document.querySelectorAll('#comp-tbody tr'); rows.forEach((row, index) => { row.cells[0].innerText = index + 1; }); }

function editDeleteSelectedRows() { 
    const checkedBoxes = document.querySelectorAll('#comp-tbody .row-chk:checked'); if (checkedBoxes.length === 0) return uiNotify("Pilih baris yang akan dihapus!", "danger"); 
    uiConfirmAction("Hapus Baris?", `Yakin menghapus ${checkedBoxes.length} baris?`, () => { checkedBoxes.forEach(box => { box.closest('tr').remove(); }); renumberRows(); editCalc(); editStatus(false); uiNotify("Baris dihapus"); }, true); 
}

function editSave(silent = false) { 
    const n = storage.find(x => x.id === activeId); const rows = []; 
    document.querySelectorAll('#comp-tbody tr').forEach(tr => { const e = []; tr.querySelectorAll('.col-extra').forEach(inp => e.push(inp.value)); rows.push({ barang: tr.querySelector('.col-barang').value, jml: tr.querySelector('.col-jml').value, harga: tr.querySelector('.col-harga').value, extras: e }); }); 
    n.items = rows; n.customCols = customCols; 
    n.date1 = document.getElementById('inp-d1')?.value || ''; 
    n.date2 = document.getElementById('inp-d2')?.value || ''; 
    n.noteContent = document.getElementById('inp-nota-note').value; 
    n.resi = document.getElementById('inp-resi').value; 
    n.showDate = document.getElementById('chk-show-date').checked;
    n.showNote = document.getElementById('chk-show-note').checked;
    n.showResi = document.getElementById('chk-show-resi').checked;
    n.showNum = document.getElementById('chk-show-num').checked; 
    n.lastEdited = new Date().toISOString(); 
    if(!silent) sysAddHistory(`<b>${n.name}</b> <span class="his-act" style="color:var(--edit)">diedit/disimpan</span>`, 'edit'); 
    dbSave(); editStatus(true); if(!silent) uiNotify("Nota Tersimpan!"); 
}

function editCalc() { 
    let t = 0; document.querySelectorAll('#comp-tbody tr').forEach(tr => { const rawQ = tr.querySelector('.col-jml').value.replace(/\./g, ''); const rawP = tr.querySelector('.col-harga').value.replace(/\./g, ''); t += ((parseFloat(rawQ) || 0) * (parseFloat(rawP) || 0)); }); 
    const n = storage.find(i=>i.id===activeId); let finalTotal = t;
    if (n && n.discVal && n.discVal > 0) {
        let discountAmount = (n.discType === 'p') ? t * (n.discVal / 100) : n.discVal;
        if(discountAmount > t) discountAmount = t; finalTotal = t - discountAmount;
        document.getElementById('txt-old-total').innerText = "Rp " + t.toLocaleString('id-ID'); document.getElementById('txt-old-total').classList.remove('hidden');
    } else { document.getElementById('txt-old-total').classList.add('hidden'); }
    document.getElementById('txt-total').innerText = finalTotal.toLocaleString('id-ID'); 
}

function editStatus(s) { document.getElementById('btn-preview-trigger').disabled = !s; document.getElementById('btn-preview-trigger').style.opacity = s ? "1" : "0.3"; document.getElementById('txt-save-status').innerText = s ? "✅ Siap Cetak!" : "⚠ Belum disimpan!"; }

function uiNotify(msg, type='success') { const b = document.getElementById('comp-notify'); document.getElementById('notify-msg').innerText = msg; b.style.borderColor = type==='danger'?'var(--danger)':'var(--success)'; b.style.color = type==='danger'?'var(--danger)':'var(--success)'; b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 2000); }
function sysExport() { const a = document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(storage)],{type:'application/json'})); a.download=`Backup.json`; a.click(); }

/* --- SMART IMPORT --- */
function sysImport(e) { 
    const file = e.target.files[0]; if(!file) return; 
    const reader = new FileReader(); 
    reader.onload = (ev) => { 
        try { 
            const imported = JSON.parse(ev.target.result); 
            if (!Array.isArray(imported)) throw new Error("Format Salah");
            const importFolderId = 'IMP_' + Date.now();
            const dateStr = new Date().toLocaleString('id-ID').replace(/[/]/g, '-').replace(',', '');
            const rootName = getUniqueName(`Hasil Import (${dateStr})`, null, 'folder');
            const rootFolder = { id: importFolderId, parentId: null, name: rootName, type: 'folder', uCode: 'IMP', inTrash: false, createdAt: new Date().toISOString(), lastEdited: new Date().toISOString(), items: [] };
            const idMap = {}; imported.forEach(i => { idMap[i.id] = 'ID' + Math.random().toString(36).substr(2, 9); });
            const processed = imported.map(i => { return { ...i, id: idMap[i.id], parentId: i.parentId ? (idMap[i.parentId] || importFolderId) : importFolderId }; });
            storage.push(rootFolder, ...processed); dbSave(); navRenderGrid(); uiNotify("Data Berhasil Diimpor!"); 
        } catch(err) { uiNotify("Gagal membaca file!", "danger"); } 
    }; 
    reader.readAsText(file); 
}

/* --- EXPORT HTML & PREVIEW --- */
function getFinalHTML() {
    const paper = document.getElementById('preview-print-area'); if(!paper) return null;
    const n = storage.find(i=>i.id===activeId); const title = n ? n.name : 'Nota';
    const styles = `body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; border: 2px solid black; font-size: 13px; } th, td { padding: 8px; border-right: 1px solid black; border-bottom: 1px solid black; } th:last-child, td:last-child { border-right: none; } thead th { border-bottom: 2px solid black; background: #eee; } .theme-modern .preview-header { background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; margin-bottom: 20px; } .theme-modern h2 { margin: 0; color: #1e293b; } .theme-modern table { border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-radius: 12px; overflow: hidden; } .theme-modern th, .theme-modern td { border: none; border-bottom: 1px solid #f1f5f9; } .theme-modern th { background: #f1f5f9; color: #334155; font-weight: 800; } .theme-transparent { background: transparent; } .text-right { text-align: right; } .hidden { display: none; }`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body><div class="${document.getElementById('preview-print-area').className}">${paper.innerHTML}</div></body></html>`;
}
function sysDownloadHTMLAction() { const h = getFinalHTML(); if(!h) return; const n = storage.find(i=>i.id===activeId); const b = new Blob([h], {type: 'text/html'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${n?n.name:'Nota'}.html`; a.click(); }
function sysCopyHTML() { const h = getFinalHTML(); if(!h) return; navigator.clipboard.writeText(h).then(() => { uiNotify("Kode HTML Disalin!"); uiPopupClose(); }).catch(err => { uiNotify("Gagal menyalin!", "danger"); }); }

function uiPreview(show, useStorage = false) {
    document.getElementById('preview-screen').classList.toggle('hidden', !show);
    if(show) {
        if(!useStorage) history.pushState({view: 'preview'}, null, ""); 
        const paper = document.getElementById('preview-paper');
        if(window.innerWidth < 500) { const scale = (window.innerWidth - 30) / 450; paper.style.transform = `scale(${scale})`; paper.style.marginTop = '10px'; } 
        else { paper.style.transform = 'none'; paper.style.marginTop = '30px'; }

        const n = storage.find(i=>i.id===activeId); let total = 0; let rows = ''; let headEx = (n.customCols || customCols).map(c => `<th>${c}</th>`).join('');
        const showNum = n.showNum; const headNum = showNum ? '<th style="padding:8px;border:1px solid black;text-align:center;width:30px;">No</th>' : '';

        if (useStorage) {
            if(n.items) {
                n.items.forEach((item, idx) => {
                    const q = parseFloat(item.jml) || 0; const p = parseFloat(item.harga) || 0; total += (q * p);
                    let rowEx = ''; if(item.extras) item.extras.forEach(e => rowEx += `<td style="padding:8px;text-align:center">${e}</td>`);
                    const rowNum = showNum ? `<td style="padding:8px;text-align:center;border-right:1px solid black;border-bottom:1px solid black;">${idx + 1}</td>` : '';
                    rows += `<tr>${rowNum}<td style="padding:8px">${item.barang.replace(/\n/g, "<br>")}</td><td style="padding:8px;text-align:center">${parseInt(item.jml).toLocaleString('id-ID').replace(/\n/g, "<br>")}</td><td style="padding:8px">${parseInt(item.harga).toLocaleString('id-ID').replace(/\n/g, "<br>")}</td>${rowEx}</tr>`;
                });
            }
        } else {
            document.querySelectorAll('#comp-tbody tr').forEach((tr, idx) => {
                const q = parseFloat(tr.querySelector('.col-jml').value.replace(/\./g, '')) || 0; const p = parseFloat(tr.querySelector('.col-harga').value.replace(/\./g, '')) || 0; total += (q*p);
                let rowEx = ''; tr.querySelectorAll('.col-extra').forEach(inp => rowEx += `<td style="padding:8px;text-align:center">${inp.value}</td>`);
                const rowNum = showNum ? `<td style="padding:8px;text-align:center;border-right:1px solid black;border-bottom:1px solid black;">${idx + 1}</td>` : '';
                rows += `<tr>${rowNum}<td style="padding:8px">${tr.querySelector('.col-barang').value.replace(/\n/g, "<br>")}</td><td style="padding:8px;text-align:center">${tr.querySelector('.col-jml').value.replace(/\n/g, "<br>")}</td><td style="padding:8px">${tr.querySelector('.col-harga').value.replace(/\n/g, "<br>")}</td>${rowEx}</tr>`;
            });
        }
        
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
            if(discountAmount > total) discountAmount = total; finalTotal = total - discountAmount;
            totalHtml = `<div style="text-align:right; margin-top:20px;"><div style="text-decoration: line-through; color: #64748b; font-size: 14px; margin-bottom: 2px;">Rp ${total.toLocaleString('id-ID')}</div><div class="preview-total" style="font-weight:bold; font-size:22px">Total: Rp ${finalTotal.toLocaleString('id-ID')}</div></div>`;
        } else { totalHtml = `<div class="preview-total" style="text-align:right; margin-top:20px; font-weight:bold; font-size:22px">Total: Rp ${total.toLocaleString('id-ID')}</div>`; }

        document.getElementById('preview-content').innerHTML = `<div id="preview-print-area" class=""><div class="preview-header" style="text-align:center; border-bottom:3px solid black; padding-bottom:10px; margin-bottom:15px;"><h2 style="margin:0; text-transform:uppercase;">${n.name}</h2></div>${dateHtml ? `<div class="preview-date" style="font-style:italic; font-size:12px; margin-bottom:15px; line-height:1.6; color:#000; font-weight:normal;">${dateHtml}</div>` : ''}<table style="width:100%; border-collapse:collapse; border:2px solid black; font-size:13px;"><thead style="background:#eee"><tr>${headNum}<th style="padding:8px;border:1px solid black">Barang</th><th style="padding:8px;border:1px solid black">Jml</th><th style="padding:8px;border:1px solid black">Harga</th>${headEx}</tr></thead><tbody>${rows}</tbody></table>${totalHtml}${noteHtml}${resiHtml}<div class="${isFootActive?'':'hidden'}" style="margin-top:50px; text-align:center; font-size:10px; color:gray; font-style:italic">*By: Nota_Folder*<br>${new Date().toLocaleString()}</div></div>`;
        sysChangeTheme(curTheme);
    } else { if(history.state && history.state.view === 'preview') history.back(); }
}

function sysToggleFootnote() { isFootActive = !isFootActive; document.getElementById('btn-foot-toggle').innerText = isFootActive ? "Catatan: ON" : "Catatan: OFF"; uiPreview(true); }
function sysDownloadImg() { html2canvas(document.getElementById('preview-paper'), {scale:3}).then(c => { const a = document.createElement('a'); a.download=`Nota.png`; a.href=c.toDataURL(); a.click(); }); }
function sysEnterScreenshotMode() { document.body.classList.add('is-clean-mode'); history.pushState({view: 'clean'}, null, ""); uiNotify("Mode Screenshot: Tekan Kembali untuk keluar"); }
function sysPrint() { window.print(); }

// INIT APP
document.getElementById('layout-toggle').checked = (layoutMode === 'desktop');
if(window.innerWidth <= 600 && layoutMode !== 'desktop') { document.body.classList.remove('is-desktop'); } else { sysToggleLayout(); }
const savedParent = localStorage.getItem('notafolder_cur_parent'); const savedNote = localStorage.getItem('notafolder_active_id');
history.replaceState({view: 'folder', id: null}, null, "");
if (savedNote) { if(savedParent) curParent = savedParent; history.pushState({view: 'folder', id: curParent}, null, ""); editOpen(savedNote); } 
else if (savedParent) { navGo(savedParent); } else { navRenderGrid(); }
if(localStorage.getItem('notafolder_view_mode')) { viewMode = localStorage.getItem('notafolder_view_mode'); sysChangeView(viewMode); }
