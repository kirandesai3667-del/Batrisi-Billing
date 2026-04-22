// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, query, orderBy, writeBatch, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbZ4T8264CDQ5LSoH_4L0luB5VKQbiqkU",
  authDomain: "batrisi-latest-app.firebaseapp.com",
  databaseURL: "https://batrisi-latest-app-default-rtdb.firebaseio.com",
  projectId: "batrisi-latest-app",
  storageBucket: "batrisi-latest-app.firebasestorage.app",
  messagingSenderId: "175592360155",
  appId: "1:175592360155:web:ba95f9aba4558fda9d64fe",
  measurementId: "G-5N91PLG8LB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ORGANIZATION DETAILS ---
const orgName = "Shree Batrisi Jain Co-Op Education Society Ltd";
const orgAddress = "Sheth Shri Hiralal Hargovandas Batrishi Hall, Near R.T.O Circle, Subhashbridge, Collector Kacheri, Ahmedabad - 380027";
const orgDetailsLine1 = "GSTIN: 24AAATS6070J1ZE | Reg No: GH/230 | Reg Date: 10/10/1944";
const orgDetailsLine2 = "Mob: 9586423232 | Landline: 079-27557668 | Email: 32cedusociety@gmail.com";

// --- HELPER: FORMAT DATE ---
window.formatDateIndian = (dateStr) => {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

// --- SET DATES & AUTO SLIP GENERATOR ---
const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    ['dep-date', 'don-date', 'inv-date'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = today;
    });
};

const getFinancialYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    return (today.getMonth() >= 3) ? `${year}-${(year+1).toString().slice(2)}` : `${year-1}-${year.toString().slice(2)}`;
};

const generateSlipNo = async (type, targetId) => {
    try {
        const fy = getFinancialYear();
        const q = query(collection(db, type), orderBy("timestamp", "desc"));
        const qs = await getDocs(q);
        let lastNum = 0;
        qs.forEach((doc) => {
            let slipStr = doc.data().slipNo;
            if(!slipStr) return;
            let parts = slipStr.split('/');
            let num = 0, docFy = "";
            if (parts.length === 3) { num = parseInt(parts[1]); docFy = parts[2]; } 
            else if (parts.length === 2) { num = parseInt(parts[0]); docFy = parts[1]; }
            if (docFy === fy && num > lastNum) lastNum = num;
        });
        const newNum = String(lastNum + 1).padStart(3, '0');
        const finalSlip = type === 'donation' ? `D/${newNum}/${fy}` : `${newNum}/${fy}`;
        if(document.getElementById(targetId)) document.getElementById(targetId).value = finalSlip;
    } catch(err) { console.error("Slip Gen Error:", err); }
};

// --- AUTO FETCH DEPOSIT DETAILS FOR INVOICE ---
window.fetchDepositForInvoice = async (nameVal) => {
    if(!nameVal) return;
    try {
        const q = query(collection(db, 'deposit'), where('name', '==', nameVal.toUpperCase()));
        const qs = await getDocs(q);
        if(!qs.empty) {
            let docsList = [];
            qs.forEach(docSnap => docsList.push(docSnap.data()));
            docsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const d = docsList[0];
            if(document.getElementById('inv-dep-ref')) document.getElementById('inv-dep-ref').value = d.slipNo || '';
            if(document.getElementById('inv-dep-date')) document.getElementById('inv-dep-date').value = d.date || '';
            if(document.getElementById('inv-dep-amount')) document.getElementById('inv-dep-amount').value = d.amount || '';
        } else {
            if(document.getElementById('inv-dep-ref')) document.getElementById('inv-dep-ref').value = '';
            if(document.getElementById('inv-dep-date')) document.getElementById('inv-dep-date').value = '';
            if(document.getElementById('inv-dep-amount')) document.getElementById('inv-dep-amount').value = '';
        }
    } catch(err) { console.error("Error fetching deposit", err); }
};

// --- CSV MEMBER UPLOAD & FETCH ---
window.uploadCSV = async () => {
    const file = document.getElementById('csv-upload').files[0];
    if(!file) return alert('Please select a CSV file first.');
    const status = document.getElementById('csv-status');
    status.innerText = "Saving members to Cloud... Please wait.";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const lines = e.target.result.split(/\r?\n/);
            const headers = lines[0].toLowerCase().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/["\r]/g, '').trim());
            let mIdx = headers.findIndex(h => h.includes('member number'));
            let nIdx = headers.findIndex(h => h.includes('member name'));
            let aIdx = headers.findIndex(h => h.includes('address'));
            let ntIdx = headers.findIndex(h => h.includes('native name'));
            let mobIdx = headers.findIndex(h => h.includes('mobile number'));

            if (mIdx === -1) mIdx = 0; if (nIdx === -1) nIdx = 1; if (aIdx === -1) aIdx = 2; if (ntIdx === -1) ntIdx = 3; if (mobIdx === -1) mobIdx = 4;

            const batch = writeBatch(db);
            let count = 0;
            for(let i=1; i<lines.length; i++){
                if(!lines[i].trim()) continue;
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                let memNo = cols[mIdx]?.replace(/["\r]/g,'').trim();
                if(memNo) {
                    let mob = cols[mobIdx]?.replace(/["\r]/g,'').trim() || '';
                    if (mob === '0' || mob.toLowerCase() === 'null' || mob === '-') mob = '';
                    batch.set(doc(db, "members", memNo), {
                        name: cols[nIdx]?.replace(/["\r]/g,'').trim() || '',
                        address: cols[aIdx]?.replace(/["\r]/g,'').trim() || '',
                        native: cols[ntIdx]?.replace(/["\r]/g,'').trim() || '',
                        mobile: mob
                    });
                    count++;
                }
            }
            await batch.commit();
            status.innerText = `Success! ${count} Members saved permanently.`;
        } catch (error) { status.innerText = "Error uploading CSV. Check format."; console.error(error); }
    };
    reader.readAsText(file);
};

window.fetchMember = async (inputId, nameId, addrId, nativeId, mobileId) => {
    const val = document.getElementById(inputId).value.trim();
    if(!val) return;
    const docSnap = await getDoc(doc(db, "members", val));
    if(docSnap.exists()) {
        const data = docSnap.data();
        if(document.getElementById(nameId)) document.getElementById(nameId).value = data.name || '';
        if(document.getElementById(addrId)) document.getElementById(addrId).value = data.address || '';
        if(nativeId && document.getElementById(nativeId)) document.getElementById(nativeId).value = data.native || '';
        if(mobileId && document.getElementById(mobileId)) {
            let mob = data.mobile || '';
            if(mob === '0' || mob.toLowerCase() === 'null' || mob === '-') mob = '';
            document.getElementById(mobileId).value = mob;
        }
    }
};

// --- DATA EXPORT TO EXCEL ---
window.exportData = async () => {
    const type = document.getElementById('record-filter').value;
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const qs = await getDocs(q);
    if(qs.empty) { alert("No data available to download!"); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = []; let rows = [];
    qs.forEach((docSnap) => {
        let data = docSnap.data(); delete data.timestamp;
        if(data.date) data.date = window.formatDateIndian(data.date);
        if(data.payDate) data.payDate = window.formatDateIndian(data.payDate);
        if(data.funcDate) data.funcDate = window.formatDateIndian(data.funcDate);
        if(headers.length === 0) { headers = Object.keys(data); rows.push(headers.join(",")); }
        let row = headers.map(h => `"${(data[h] || '').toString().replace(/"/g, '""')}"`);
        rows.push(row.join(","));
    });
    csvContent += rows.join("\r\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${type}_Data_Export.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

// --- SEARCH FILTER ---
window.searchTable = () => {
    const input = document.getElementById("search-bar"); if(!input) return;
    const filter = input.value.toUpperCase();
    const tbody = document.getElementById("records-body");
    const tr = tbody.getElementsByTagName("tr");
    for (let i = 0; i < tr.length; i++) {
        let rowText = tr[i].textContent || tr[i].innerText;
        tr[i].style.display = (rowText.toUpperCase().indexOf(filter) > -1) ? "" : "none";
    }
};

// --- FORM SUBMIT (SAVE & UPDATE) ---
window.handleFormSubmit = async (e, type) => {
    if(e) e.preventDefault();
    const prefix = type.substring(0, 3);
    const btn = document.getElementById(`btn-submit-${prefix}`);
    if(btn) { btn.innerHTML = "Saving to Cloud..."; btn.disabled = true; }

    try {
        let data = { timestamp: new Date().toISOString() };
        let editId = document.getElementById(`${prefix}-edit-id`).value;

        if(type === 'deposit') {
            data = { ...data, slipNo: document.getElementById('dep-slip').value, date: document.getElementById('dep-date').value, name: document.getElementById('dep-name').value, mobile: document.getElementById('dep-mobile').value, address: document.getElementById('dep-address').value, member: document.getElementById('dep-member').value, native: document.getElementById('dep-native').value, funcName: document.getElementById('dep-func-name').value, funcDate: document.getElementById('dep-func-date').value, funcShift: document.getElementById('dep-func-shift').value, payType: document.getElementById('dep-pay-type').value, payDate: document.getElementById('dep-pay-date').value, ref: document.getElementById('dep-ref').value, bank: document.getElementById('dep-bank').value, amount: document.getElementById('dep-amount').value, words: document.getElementById('dep-words').value };
        } else if(type === 'donation') {
            data = { ...data, slipNo: document.getElementById('don-slip').value, date: document.getElementById('don-date').value, name: document.getElementById('don-name').value, address: document.getElementById('don-address').value, member: document.getElementById('don-member').value, native: document.getElementById('don-native').value, pan: document.getElementById('don-pan').value, desc: document.getElementById('don-desc').value === 'Custom' ? document.getElementById('don-custom-desc').value : document.getElementById('don-desc').value, payType: document.getElementById('don-pay-type').value, payDate: document.getElementById('don-pay-date').value, ref: document.getElementById('don-ref').value, bank: document.getElementById('don-bank').value, amount: document.getElementById('don-amount').value, words: document.getElementById('don-words').value };
        } else if(type === 'invoice') {
            data = { ...data, 
                isMember: document.getElementById('inv-is-member') ? document.getElementById('inv-is-member').value : 'No', member: document.getElementById('inv-member') ? document.getElementById('inv-member').value : '',
                slipNo: document.getElementById('inv-slip').value, date: document.getElementById('inv-date').value, name: document.getElementById('inv-name').value, address: document.getElementById('inv-address').value, gst: document.getElementById('inv-gst').value, desc: document.getElementById('inv-desc-select').value === 'Other' ? document.getElementById('inv-desc-custom').value : document.getElementById('inv-desc-select').value, 
                depRef: document.getElementById('inv-dep-ref').value, depDate: document.getElementById('inv-dep-date').value, depAmount: document.getElementById('inv-dep-amount') ? document.getElementById('inv-dep-amount').value : '',
                basic: document.getElementById('inv-basic').value, cgst: document.getElementById('inv-cgst').value, sgst: document.getElementById('inv-sgst').value, round: document.getElementById('inv-round').value, total: document.getElementById('inv-total').value, words: document.getElementById('inv-words').value,
                settlementType: document.getElementById('inv-settlement-type') ? document.getElementById('inv-settlement-type').value : 'Refund', payType: document.getElementById('inv-pay-type').value, payDate: document.getElementById('inv-pay-date').value, ref: document.getElementById('inv-ref').value, bank: document.getElementById('inv-bank').value,
                refundAmount: document.getElementById('inv-refund-amount') ? document.getElementById('inv-refund-amount').value : '', refundWords: document.getElementById('inv-refund-words') ? document.getElementById('inv-refund-words').value : '',
                recDepNo: document.getElementById('inv-rec-dep-no') ? document.getElementById('inv-rec-dep-no').value : '', recDepDate: document.getElementById('inv-rec-dep-date') ? document.getElementById('inv-rec-dep-date').value : '', recAmount: document.getElementById('inv-received-amount') ? document.getElementById('inv-received-amount').value : '', recWords: document.getElementById('inv-received-words') ? document.getElementById('inv-received-words').value : ''
            };
        }

        if(editId) { await updateDoc(doc(db, type, editId), data); document.getElementById(`${prefix}-edit-id`).value = ""; }
        else { await addDoc(collection(db, type), data); }
        
        document.getElementById(`form-${type}`).reset();
        if (type === 'invoice') { document.getElementById('inv-desc-custom').style.display = 'none'; if(document.getElementById('inv-member-group')) document.getElementById('inv-member-group').style.display = 'none'; }
        
        setToday(); updateDashboardCounts(); await generateSlipNo(type, `${prefix}-slip`);
        printRecord(data, type);

    } catch (error) { alert("Error saving to Firebase!"); console.error(error); }
    finally { if(btn) { btn.innerHTML = `<i class="ri-printer-line"></i> Save & Print Receipt`; btn.disabled = false; } }
};

// --- LOAD, EDIT & DELETE RECORDS ---
window.allRecords = {};
window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const thead = document.getElementById('records-head');
    const tbody = document.getElementById('records-body');
    
    if(type === 'deposit') { thead.innerHTML = `<tr><th>Slip No.</th><th>Name</th><th>Func. Date</th><th>Event</th><th>Shift</th><th>Amount</th><th>Actions</th></tr>`; } 
    else { thead.innerHTML = `<tr><th>Slip No.</th><th>Date</th><th>Name</th><th>Amount</th><th>Actions</th></tr>`; }
    tbody.innerHTML = `<tr><td colspan='${type==='deposit'? 7 : 5}' style='text-align:center;'>Fetching...</td></tr>`;
    
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const qs = await getDocs(q); tbody.innerHTML = "";
    if(qs.empty) { tbody.innerHTML = `<tr><td colspan='${type==='deposit'? 7 : 5}' style='text-align:center;'>No Data Found</td></tr>`; return; }
    
    window.allRecords[type] = {}; let recordsArray = [];
    qs.forEach((docSnap) => { let d = docSnap.data(); d.id = docSnap.id; recordsArray.push(d); window.allRecords[d.id] = d; });

    recordsArray.sort((a, b) => {
        let parseSlip = (slip) => {
            if(!slip) return { num: 0, year: "" };
            let parts = slip.split('/');
            if(parts.length === 3) return { num: parseInt(parts[1]) || 0, year: parts[2] || "" };
            if(parts.length === 2) return { num: parseInt(parts[0]) || 0, year: parts[1] || "" };
            return { num: 0, year: "" };
        };
        let slipA = parseSlip(a.slipNo); let slipB = parseSlip(b.slipNo);
        if (slipA.year !== slipB.year) return slipB.year.localeCompare(slipA.year); 
        return slipB.num - slipA.num; 
    });

    recordsArray.forEach((d) => {
        let tr = document.createElement('tr');
        if(type === 'deposit') {
            tr.innerHTML = `<td><strong>${d.slipNo}</strong></td><td>${d.name}</td><td style="color:var(--primary); font-weight:600;">${window.formatDateIndian(d.funcDate) || '-'}</td><td>${d.funcName || '-'}</td><td>${d.funcShift || '-'}</td><td style="color:var(--secondary); font-weight:700;">₹${parseFloat(d.amount || 0).toFixed(2)}</td>
                <td><button class="btn-action btn-edit" onclick='editRec("${d.id}", "${type}")'><i class="ri-edit-line"></i></button><button class="btn-action btn-print" onclick='rePrint("${d.id}", "${type}")'><i class="ri-printer-line"></i></button><button class="btn-action btn-del" onclick='deleteRec("${d.id}", "${type}")'><i class="ri-delete-bin-line"></i></button></td>`;
        } else {
            tr.innerHTML = `<td><strong>${d.slipNo}</strong></td><td>${window.formatDateIndian(d.date)}</td><td>${d.name}</td><td style="color:var(--secondary); font-weight:700;">₹${parseFloat(d.amount || d.total).toFixed(2)}</td>
                <td><button class="btn-action btn-edit" onclick='editRec("${d.id}", "${type}")'><i class="ri-edit-line"></i></button><button class="btn-action btn-print" onclick='rePrint("${d.id}", "${type}")'><i class="ri-printer-line"></i></button><button class="btn-action btn-del" onclick='deleteRec("${d.id}", "${type}")'><i class="ri-delete-bin-line"></i></button></td>`;
        }
        tbody.appendChild(tr);
    });
};

window.editRec = (id, type) => {
    let data = window.allRecords[id]; if(!data) return;
    if (window.switchTab) window.switchTab(type);
    let prefix = type.substring(0, 3);
    if(document.getElementById(`${prefix}-edit-id`)) document.getElementById(`${prefix}-edit-id`).value = data.id;

    if(type === 'deposit') {
        document.getElementById('dep-slip').value = data.slipNo || ''; document.getElementById('dep-date').value = data.date || ''; document.getElementById('dep-member').value = data.member || ''; document.getElementById('dep-name').value = data.name || ''; document.getElementById('dep-mobile').value = data.mobile || ''; document.getElementById('dep-address').value = data.address || ''; document.getElementById('dep-native').value = data.native || ''; document.getElementById('dep-func-name').value = data.funcName || ''; document.getElementById('dep-func-date').value = data.funcDate || ''; document.getElementById('dep-func-shift').value = data.funcShift || 'Morning (08:00 AM – 02:00 PM)'; document.getElementById('dep-pay-type').value = data.payType || 'Cheque'; document.getElementById('dep-pay-date').value = data.payDate || ''; document.getElementById('dep-ref').value = data.ref || ''; document.getElementById('dep-bank').value = data.bank || ''; document.getElementById('dep-amount').value = data.amount || ''; document.getElementById('dep-words').value = data.words || '';
    } else if(type === 'donation') {
        document.getElementById('don-slip').value = data.slipNo || ''; document.getElementById('don-date').value = data.date || ''; document.getElementById('don-member').value = data.member || ''; document.getElementById('don-name').value = data.name || ''; document.getElementById('don-address').value = data.address || ''; document.getElementById('don-native').value = data.native || ''; document.getElementById('don-pan').value = data.pan || '';
        let descSelect = document.getElementById('don-desc'); let knownOptions = ["Dattak Yojna", "General Sahay", "Education Sahay", "Inaam Vitran", "Custom"];
        if(knownOptions.includes(data.desc)) { descSelect.value = data.desc; if(document.getElementById('don-custom-desc')) document.getElementById('don-custom-desc').style.display = 'none'; } else { descSelect.value = "Custom"; if(document.getElementById('don-custom-desc')) { document.getElementById('don-custom-desc').style.display = 'block'; document.getElementById('don-custom-desc').value = data.desc || ''; } }
        document.getElementById('don-pay-type').value = data.payType || 'Cheque'; document.getElementById('don-pay-date').value = data.payDate || ''; document.getElementById('don-ref').value = data.ref || ''; document.getElementById('don-bank').value = data.bank || ''; document.getElementById('don-amount').value = data.amount || ''; document.getElementById('don-words').value = data.words || '';
    } else if(type === 'invoice') {
        document.getElementById('inv-slip').value = data.slipNo || ''; document.getElementById('inv-date').value = data.date || ''; document.getElementById('inv-is-member').value = data.isMember || 'No'; if(window.toggleInvMember) window.toggleInvMember(); document.getElementById('inv-member').value = data.member || ''; document.getElementById('inv-name').value = data.name || ''; document.getElementById('inv-address').value = data.address || ''; document.getElementById('inv-gst').value = data.gst || '';
        let descSelect = document.getElementById('inv-desc-select'); if(data.desc === 'Maintenance') { descSelect.value = data.desc; if(document.getElementById('inv-desc-custom')) document.getElementById('inv-desc-custom').style.display = 'none'; } else { descSelect.value = "Other"; if(document.getElementById('inv-desc-custom')) { document.getElementById('inv-desc-custom').style.display = 'block'; document.getElementById('inv-desc-custom').value = data.desc || ''; } }
        document.getElementById('inv-dep-ref').value = data.depRef || ''; document.getElementById('inv-dep-date').value = data.depDate || ''; if(document.getElementById('inv-dep-amount')) document.getElementById('inv-dep-amount').value = data.depAmount || ''; document.getElementById('inv-basic').value = data.basic || ''; document.getElementById('inv-cgst').value = data.cgst || ''; document.getElementById('inv-sgst').value = data.sgst || ''; document.getElementById('inv-round').value = data.round || ''; document.getElementById('inv-total').value = data.total || ''; document.getElementById('inv-words').value = data.words || ''; document.getElementById('inv-pay-type').value = data.payType || 'Cheque'; document.getElementById('inv-pay-date').value = data.payDate || ''; document.getElementById('inv-ref').value = data.ref || ''; document.getElementById('inv-bank').value = data.bank || '';
        if(document.getElementById('inv-settlement-type')) { document.getElementById('inv-settlement-type').value = data.settlementType || 'Refund'; if(window.toggleInvSettlement) window.toggleInvSettlement(); }
        if(document.getElementById('inv-refund-amount')) document.getElementById('inv-refund-amount').value = data.refundAmount || ''; if(document.getElementById('inv-refund-words')) document.getElementById('inv-refund-words').value = data.refundWords || ''; if(document.getElementById('inv-rec-dep-no')) document.getElementById('inv-rec-dep-no').value = data.recDepNo || ''; if(document.getElementById('inv-rec-dep-date')) document.getElementById('inv-rec-dep-date').value = data.recDepDate || ''; if(document.getElementById('inv-received-amount')) document.getElementById('inv-received-amount').value = data.recAmount || ''; if(document.getElementById('inv-received-words')) document.getElementById('inv-received-words').value = data.recWords || '';
    }
    const btn = document.getElementById(`btn-submit-${prefix}`); if(btn) { btn.innerHTML = "<i class='ri-edit-box-line'></i> Update Record"; }
};

window.deleteRec = async (id, type) => { if(confirm("Are you sure you want to delete this record?")) { await deleteDoc(doc(db, type, id)); loadRecords(); updateDashboardCounts(); } };

const updateDashboardCounts = async () => {
    const deps = await getDocs(collection(db, 'deposit')); const dons = await getDocs(collection(db, 'donation')); const invs = await getDocs(collection(db, 'invoice'));
    if(document.getElementById('stat-dep')) document.getElementById('stat-dep').innerText = deps.size;
    if(document.getElementById('stat-don')) document.getElementById('stat-don').innerText = dons.size;
    if(document.getElementById('stat-inv')) document.getElementById('stat-inv').innerText = invs.size;
    const today = new Date().toISOString().split('T')[0]; let upcomingList = [];
    deps.forEach(docSnap => { let d = docSnap.data(); if(d.funcDate && d.funcDate >= today) upcomingList.push(d); });
    upcomingList.sort((a, b) => new Date(a.funcDate) - new Date(b.funcDate));
    const upBody = document.getElementById('upcoming-functions-body');
    if(upBody) {
        upBody.innerHTML = "";
        if(upcomingList.length === 0) { upBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color:#64748B;">No Upcoming Functions</td></tr>`; } 
        else { upcomingList.slice(0, 10).forEach(ev => { let tr = document.createElement('tr'); tr.innerHTML = `<td style="color:var(--primary); font-weight:700;">${window.formatDateIndian(ev.funcDate)}</td><td>${ev.funcShift || '-'}</td><td>${ev.funcName || '-'}</td><td>${ev.name || '-'}</td><td>${ev.mobile || '-'}</td>`; upBody.appendChild(tr); }); }
    }
};

window.rePrint = (idOrData, type) => { let data = typeof idOrData === 'string' && window.allRecords[idOrData] ? window.allRecords[idOrData] : idOrData; printRecord(data, type); };

// --- PERFECT A4 SINGLE PAGE PRINT LOGIC ---
const printRecord = (data, type) => {
    const container = document.getElementById('print-container');
    let title = type === 'invoice' ? 'TAX INVOICE' : type.toUpperCase() + ' SLIP';
    let contentHtml = '';
    let copiesArray = ['ORIGINAL', 'DUPLICATE'];
    
    contentHtml += `
    <style>
        @media print {
            @page { size: A4 portrait; margin: 0; } 
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff !important; color: #000; font-family: Arial, sans-serif; overflow: hidden !important;}
            #print-container { width: 100%; height: 100%; display: flex; flex-direction: column; }
            
            /* Main Wrapper - Exactly 1 A4 page */
            .print-page { width: 210mm; height: 297mm; padding: 5mm; box-sizing: border-box; display: flex; flex-direction: column; }

            /* Each copy exactly 50% of available vertical space */
            .print-copy-wrapper { flex: 1; display: flex; flex-direction: column; padding-bottom: 2mm; box-sizing: border-box; }
            
            /* Border box */
            .print-copy { flex: 1; border: 2px solid #000; border-radius: 4px; padding: 12px; display: flex; flex-direction: column; box-sizing: border-box; position: relative;}

            /* Header Structure */
            .print-header { position: relative; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; text-align: center; }
            .header-logo { position: absolute; left: 0; top: 0; height: 50px; }
            .header-copy-type { position: absolute; right: 0; top: 0; border: 1.5px solid #000; padding: 4px 10px; font-weight: bold; font-size: 11px; background:#f0f0f0 !important; -webkit-print-color-adjust: exact;}
            .print-header h2 { margin: 0 0 3px; font-size: 17px; font-weight: bold; }
            .print-header p { margin: 2px 0; font-size: 10px; font-weight: bold; }

            /* Slip Title */
            .print-title { text-align: center; text-decoration: underline; margin-bottom: 10px; font-size: 14px; font-weight: bold; }

            /* Grid System for Fields */
            .print-grid { display: grid; grid-template-columns: repeat(4, auto); gap: 6px 12px; align-items: end; font-size: 11px; margin-bottom: 10px;}
            .print-grid .label { font-weight: bold; color: #333; border-bottom: 1px dotted #ccc;}
            .print-grid .value { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px;}
            .full-width { grid-column: 1 / -1; display: flex; border-bottom: 1px solid #000; padding-bottom: 2px;}
            .full-width .label { border:none; margin-right: 10px; }

            /* Extra Info Boxes */
            .extra-box { border: 1.5px solid #000; border-radius: 4px; padding: 8px; font-size: 10px; line-height: 1.4; margin-top: auto; margin-bottom: 15px;}
            .box-title { font-weight: bold; text-decoration: underline; margin-bottom: 5px; font-size: 11px; text-align: center;}
            
            /* Fill Space between fields and bottom signatures */
            .flex-spacer { flex-grow: 1; }

            /* Bottom Signatures */
            .signature-row { display: flex; justify-content: space-between; margin-top: 10px; padding: 0 15px; }
            .sign-box { border-top: 1.5px solid #000; width: 180px; text-align: center; padding-top: 5px; font-weight: bold; font-size: 12px; }
            
            /* Cut Line in Middle */
            .cut-line { height: 6mm; display: flex; align-items: center; justify-content: center; }
            .cut-line span { border-bottom: 1px dashed #666; width: 100%; position: relative; display: flex; justify-content: center;}
            .cut-line span::after { content: "✂ cut here ✂"; position: absolute; background: #fff; padding: 0 10px; top: -7px; font-size: 10px; color: #666;}
        }
    </style>
    <div class="print-page">
    `;

    copiesArray.forEach((copy, index) => {
        let detailsHtml = ""; let extraBox = "";

        if(type === 'invoice') {
            let isRefund = data.settlementType === 'Refund';
            detailsHtml = `
            <div class="print-grid">
                <span class="label">Invoice No:</span> <span class="value">${data.slipNo}</span>
                <span class="label">Date:</span> <span class="value">${window.formatDateIndian(data.date)}</span>
            </div>
            <div class="full-width"><span class="label">Name:</span> <span class="value" style="flex:1; border:none;">${data.name}</span></div>
            <div class="full-width"><span class="label">Address:</span> <span class="value" style="flex:1; border:none;">${data.address || '-'}</span></div>
            <div class="print-grid" style="margin-top:6px;">
                <span class="label">GSTIN:</span> <span class="value">${data.gst || '-'}</span>
                <span class="label">Description:</span> <span class="value">${data.desc || '-'}</span>
                <span class="label">Dep Ref No:</span> <span class="value">${data.depRef || '-'}</span>
                <span class="label">Dep Date:</span> <span class="value">${window.formatDateIndian(data.depDate) || '-'}</span>
                <span class="label">Dep Amount:</span> <span class="value">₹ ${parseFloat(data.depAmount || 0).toFixed(2)}</span>
                <span class="label">Basic Amount:</span> <span class="value">₹ ${parseFloat(data.basic || 0).toFixed(2)}</span>
                <span class="label">CGST (9%):</span> <span class="value">₹ ${parseFloat(data.cgst || 0).toFixed(2)}</span>
                <span class="label">SGST (9%):</span> <span class="value">₹ ${parseFloat(data.sgst || 0).toFixed(2)}</span>
                <span class="label">Round Off:</span> <span class="value">₹ ${data.round || '0.00'}</span>
                <span class="label" style="font-size:13px;">Total Amt:</span> <span class="value" style="font-size:13px;">₹ ${parseFloat(data.total || 0).toFixed(2)}</span>
            </div>
            <div class="full-width" style="margin-bottom: 10px;"><span class="label">Amount In Words:</span> <span class="value" style="flex:1; border:none;"><i>${data.words || '-'}</i></span></div>
            `;
            
            extraBox = `
            <div class="extra-box">
                <div class="box-title">${isRefund ? 'REFUND DETAILS' : 'RECEIVED DETAILS'}</div>
                <div class="print-grid" style="margin-bottom:0;">
                    ${isRefund ? `
                        <span class="label">Pay Type:</span> <span class="value">${data.payType}</span>
                        <span class="label">Pay Date:</span> <span class="value">${window.formatDateIndian(data.payDate)}</span>
                        <span class="label">Cheque/Ref:</span> <span class="value">${data.ref || '-'}</span>
                        <span class="label">Bank:</span> <span class="value">${data.bank || '-'}</span>
                    ` : `
                        <span class="label">Dep Slip:</span> <span class="value">${data.recDepNo || '-'}</span>
                        <span class="label">Dep Date:</span> <span class="value">${window.formatDateIndian(data.recDepDate)}</span>
                        <span class="label">Pay Type:</span> <span class="value">${data.payType}</span>
                        <span class="label">Cheque/Ref:</span> <span class="value">${data.ref || '-'}</span>
                    `}
                </div>
                <div class="full-width" style="border:none; margin-top:5px;">
                    <span class="label">${isRefund ? 'Refund' : 'Received'} Amt:</span> <strong style="font-size:12px;">₹ ${parseFloat(isRefund ? (data.refundAmount||0) : (data.recAmount||0)).toFixed(2)}</strong>
                    <span style="margin-left:15px; font-style:italic;">(${isRefund ? data.refundWords : data.recWords})</span>
                </div>
            </div>`;
        } 
        else if (type === 'donation') {
            detailsHtml = `
            <div class="print-grid">
                <span class="label">Slip No:</span> <span class="value">${data.slipNo}</span>
                <span class="label">Date:</span> <span class="value">${window.formatDateIndian(data.date)}</span>
            </div>
            <div class="full-width"><span class="label">Name:</span> <span class="value" style="flex:1; border:none;">${data.name}</span></div>
            <div class="full-width"><span class="label">Address:</span> <span class="value" style="flex:1; border:none;">${data.address || '-'}</span></div>
            <div class="print-grid" style="margin-top:6px;">
                <span class="label">Member No:</span> <span class="value">${data.member || '-'}</span>
                <span class="label">Native:</span> <span class="value">${data.native || '-'}</span>
                <span class="label">PAN No:</span> <span class="value">${data.pan || '-'}</span>
                <span class="label">Description:</span> <span class="value">${data.desc || '-'}</span>
                <span class="label">Pay Mode:</span> <span class="value">${data.payType}</span>
                <span class="label">Cheque/Ref:</span> <span class="value">${data.ref || '-'}</span>
            </div>
            <div class="full-width" style="margin-top:5px;"><span class="label" style="font-size:13px;">Donation Amount:</span> <span class="value" style="flex:1; border:none; font-size:13px;">₹ ${parseFloat(data.amount || 0).toFixed(2)}</span></div>
            <div class="full-width" style="margin-bottom: 10px;"><span class="label">Amount In Words:</span> <span class="value" style="flex:1; border:none;"><i>${data.words || '-'}</i></span></div>
            `;
            
            extraBox = `
            <div class="extra-box" style="text-align:center; background:#f9f9f9 !important; -webkit-print-color-adjust: exact;">
                <strong>PAN NO. AAATS6070J | URN NO. AAATS6070JF20217 | DATE 24-09-2021</strong><br>
                DONATION TO SHREE BATRISI JAIN CO-OP EDUCATION SOCIETY LTD. IS EXEMPTED UNDER SEC 80G(5) 180/09-10 DTD: 20/11/2009 OF INCOMETAX ACT 1961 (RENEWAL)<br>
                <span style="font-size:12px; margin-top:5px; display:block;">Thank you for your generous donation. Your support is sincerely appreciated.</span>
            </div>`;
        } 
        else {
            detailsHtml = `
            <div class="print-grid">
                <span class="label">Slip No:</span> <span class="value">${data.slipNo}</span>
                <span class="label">Date:</span> <span class="value">${window.formatDateIndian(data.date)}</span>
            </div>
            <div class="full-width"><span class="label">Name:</span> <span class="value" style="flex:1; border:none;">${data.name}</span></div>
            <div class="full-width"><span class="label">Address:</span> <span class="value" style="flex:1; border:none;">${data.address || '-'}</span></div>
            <div class="print-grid" style="margin-top:6px;">
                <span class="label">Mobile:</span> <span class="value">${data.mobile || '-'}</span>
                <span class="label">Member No:</span> <span class="value">${data.member || '-'}</span>
                <span class="label">Event / Desc:</span> <span class="value">${data.funcName || '-'}</span>
                <span class="label">Event Date:</span> <span class="value">${window.formatDateIndian(data.funcDate) || '-'}</span>
                <span class="label">Shift:</span> <span class="value" style="grid-column: span 3;">${data.funcShift || '-'}</span>
                <span class="label">Pay Mode:</span> <span class="value">${data.payType}</span>
                <span class="label">Cheque/Ref:</span> <span class="value">${data.ref || '-'}</span>
            </div>
            <div class="full-width" style="margin-top:5px;"><span class="label" style="font-size:13px;">Deposit Amount:</span> <span class="value" style="flex:1; border:none; font-size:13px;">₹ ${parseFloat(data.amount || 0).toFixed(2)}</span></div>
            <div class="full-width" style="margin-bottom: 10px;"><span class="label">Amount In Words:</span> <span class="value" style="flex:1; border:none;"><i>${data.words || '-'}</i></span></div>
            `;
            
            extraBox = `
            <div class="extra-box">
                <div class="box-title">TERMS & CONDITIONS</div>
                <ol style="margin: 0; padding-left: 20px;">
                    <li>Vehicle management and parking responsibility lies solely with the host/booking organization.</li>
                    <li>Original Deposit Receipt is mandatory for final settlement and processing of refunds.</li>
                    <li>Venue must be identified on all invitations exactly as: <strong>“Sheth Shri Hiralal Hargovandas Batrisi Hall.”</strong></li>
                </ol>
            </div>`;
        }

        contentHtml += `
            <div class="print-copy-wrapper">
                <div class="print-copy">
                    <div class="print-header">
                        <img src="logo.png" class="header-logo" onerror="this.style.display='none'">
                        <h2>${orgName}</h2>
                        <p>${orgAddress}</p>
                        <p>${orgDetailsLine1} | ${orgDetailsLine2}</p>
                        <div class="header-copy-type">${copy}</div>
                    </div>
                    <div class="print-title">${title}</div>
                    
                    ${detailsHtml}
                    <div class="flex-spacer"></div> <!-- Pushes extra spacing to the bottom -->
                    ${extraBox}
                    
                    <div class="signature-row">
                        <div class="sign-box">Payer Signature</div>
                        <div class="sign-box">Authorized Signatory</div>
                    </div>
                </div>
            </div>`;

        if (index === 0) {
            contentHtml += `<div class="cut-line"><span></span></div>`;
        }
    });
    
    contentHtml += `</div>`;
    container.innerHTML = contentHtml;
    
    // Wait for DOM to render then trigger print
    setTimeout(() => { window.print(); }, 600);
};

// --- INITIALIZE ON LOAD ---
window.addEventListener('load', async () => {
    setToday(); 
    updateDashboardCounts();
    await generateSlipNo('deposit', 'dep-slip'); 
    await generateSlipNo('donation', 'don-slip'); 
    await generateSlipNo('invoice', 'inv-slip');
});
