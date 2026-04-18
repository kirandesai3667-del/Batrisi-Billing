// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, query, orderBy, writeBatch, where, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// --- HELPER: FORMAT DATE TO DD/MM/YYYY ---
window.formatDateIndian = (dateStr) => {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

// --- DATE & SLIP LOGIC ---
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
            if (parts.length === 3) { 
                num = parseInt(parts[1]); docFy = parts[2]; 
            } else if (parts.length === 2) { 
                num = parseInt(parts[0]); docFy = parts[1]; 
            }
            if (docFy === fy && num > lastNum) lastNum = num;
        });
        const newNum = String(lastNum + 1).padStart(3, '0');
        const finalSlip = type === 'donation' ? `D/${newNum}/${fy}` : `${newNum}/${fy}`;
        if(document.getElementById(targetId)) document.getElementById(targetId).value = finalSlip;
    } catch(err) { console.error("Slip Gen Error:", err); }
};

// --- AUTO FETCH DEPOSIT FOR INVOICE ---
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
        } else {
            if(document.getElementById('inv-dep-ref')) document.getElementById('inv-dep-ref').value = '';
            if(document.getElementById('inv-dep-date')) document.getElementById('inv-dep-date').value = '';
        }
    } catch(err) { console.error("Error fetching deposit", err); }
};

// --- CSV MEMBER DATA LOGIC ---
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

            if (mIdx === -1) mIdx = 0;
            if (nIdx === -1) nIdx = 1;
            if (aIdx === -1) aIdx = 2;
            if (ntIdx === -1) ntIdx = 3;
            if (mobIdx === -1) mobIdx = 4;

            const batch = writeBatch(db);
            let count = 0;
            for(let i=1; i<lines.length; i++){
                if(!lines[i].trim()) continue;
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                let memNo = cols[mIdx]?.replace(/["\r]/g,'').trim();
                
                if(memNo) {
                    let mob = cols[mobIdx]?.replace(/["\r]/g,'').trim() || '';
                    if (mob === '0' || mob.toLowerCase() === 'null' || mob === '-') {
                        mob = '';
                    }

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
            if(mob === '0' || mob.toLowerCase() === 'null' || mob === '-') {
                mob = '';
            }
            document.getElementById(mobileId).value = mob;
        }
    }
};

// --- EXCEL/CSV EXPORT LOGIC ---
window.exportData = async () => {
    const type = document.getElementById('record-filter').value;
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const qs = await getDocs(q);
    if(qs.empty) { alert("No data available to download!"); return; }
    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = [];
    let rows = [];
    qs.forEach((docSnap) => {
        let data = docSnap.data();
        delete data.timestamp;
        if(data.date) data.date = window.formatDateIndian(data.date);
        if(data.payDate) data.payDate = window.formatDateIndian(data.payDate);
        if(data.funcDate) data.funcDate = window.formatDateIndian(data.funcDate);
        if(headers.length === 0) { headers = Object.keys(data); rows.push(headers.join(",")); }
        let row = headers.map(h => `"${(data[h] || '').toString().replace(/"/g, '""')}"`);
        rows.push(row.join(","));
    });
    csvContent += rows.join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${type}_Data_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- TABLE SEARCH LOGIC ---
window.searchTable = () => {
    const input = document.getElementById("search-bar");
    if(!input) return;
    const filter = input.value.toUpperCase();
    const tbody = document.getElementById("records-body");
    const tr = tbody.getElementsByTagName("tr");

    for (let i = 0; i < tr.length; i++) {
        let rowText = tr[i].textContent || tr[i].innerText;
        if (rowText.toUpperCase().indexOf(filter) > -1) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
};

// --- SAVE & UPDATE LOGIC ---
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
                isMember: document.getElementById('inv-is-member') ? document.getElementById('inv-is-member').value : 'No',
                member: document.getElementById('inv-member') ? document.getElementById('inv-member').value : '',
                slipNo: document.getElementById('inv-slip').value, 
                date: document.getElementById('inv-date').value, 
                name: document.getElementById('inv-name').value, 
                address: document.getElementById('inv-address').value, 
                gst: document.getElementById('inv-gst').value, 
                desc: document.getElementById('inv-desc-select').value === 'Other' ? document.getElementById('inv-desc-custom').value : document.getElementById('inv-desc-select').value, 
                depRef: document.getElementById('inv-dep-ref').value, 
                depDate: document.getElementById('inv-dep-date').value, 
                depAmount: document.getElementById('inv-dep-amount') ? document.getElementById('inv-dep-amount').value : '',
                basic: document.getElementById('inv-basic').value, 
                cgst: document.getElementById('inv-cgst').value, 
                sgst: document.getElementById('inv-sgst').value, 
                round: document.getElementById('inv-round').value, 
                total: document.getElementById('inv-total').value, 
                words: document.getElementById('inv-words').value,
                settlementType: document.getElementById('inv-settlement-type') ? document.getElementById('inv-settlement-type').value : 'Refund',
                payType: document.getElementById('inv-pay-type').value, 
                payDate: document.getElementById('inv-pay-date').value, 
                ref: document.getElementById('inv-ref').value, 
                bank: document.getElementById('inv-bank').value,
                refundAmount: document.getElementById('inv-refund-amount') ? document.getElementById('inv-refund-amount').value : '',
                refundWords: document.getElementById('inv-refund-words') ? document.getElementById('inv-refund-words').value : '',
                recDepNo: document.getElementById('inv-rec-dep-no') ? document.getElementById('inv-rec-dep-no').value : '',
                recDepDate: document.getElementById('inv-rec-dep-date') ? document.getElementById('inv-rec-dep-date').value : '',
                recAmount: document.getElementById('inv-received-amount') ? document.getElementById('inv-received-amount').value : '',
                recWords: document.getElementById('inv-received-words') ? document.getElementById('inv-received-words').value : ''
            };
        }

        if(editId) { await updateDoc(doc(db, type, editId), data); document.getElementById(`${prefix}-edit-id`).value = ""; }
        else { await addDoc(collection(db, type), data); }
        
        alert("Data Saved Successfully!");
        document.getElementById(`form-${type}`).reset();
        
        if (type === 'invoice') {
            document.getElementById('inv-desc-custom').style.display = 'none';
            if(document.getElementById('inv-member-group')) document.getElementById('inv-member-group').style.display = 'none';
        }
        
        setToday();
        updateDashboardCounts();
        await generateSlipNo(type, `${prefix}-slip`);
        printRecord(data, type);

    } catch (error) { alert("Error saving to Firebase!"); }
    finally { if(btn) { btn.innerHTML = `<i class="ri-printer-line"></i> Save & Print`; btn.disabled = false; } }
};

// --- LOAD, EDIT & DELETE RECORDS LOGIC ---
window.allRecords = {};

window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const thead = document.getElementById('records-head');
    const tbody = document.getElementById('records-body');
    
    if(type === 'deposit') {
        thead.innerHTML = `<tr><th>Slip No.</th><th>Name</th><th>Func. Date</th><th>Func. Type</th><th>Shift</th><th>Amount</th><th>Actions</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th>Slip No.</th><th>Date</th><th>Name</th><th>Amount</th><th>Actions</th></tr>`;
    }

    tbody.innerHTML = `<tr><td colspan='${type==='deposit'? 7 : 5}' style='text-align:center;'>Fetching...</td></tr>`;
    
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const qs = await getDocs(q);
    tbody.innerHTML = "";
    
    if(qs.empty) { tbody.innerHTML = `<tr><td colspan='${type==='deposit'? 7 : 5}' style='text-align:center;'>No Data</td></tr>`; return; }
    
    window.allRecords = {};
    let recordsArray = [];
    
    qs.forEach((docSnap) => {
        let d = docSnap.data(); 
        d.id = docSnap.id;
        recordsArray.push(d);
        window.allRecords[d.id] = d;
    });

    recordsArray.sort((a, b) => {
        let parseSlip = (slip) => {
            if(!slip) return { num: 0, year: "" };
            let parts = slip.split('/');
            if(parts.length === 3) return { num: parseInt(parts[1]) || 0, year: parts[2] || "" };
            if(parts.length === 2) return { num: parseInt(parts[0]) || 0, year: parts[1] || "" };
            return { num: 0, year: "" };
        };
        let slipA = parseSlip(a.slipNo);
        let slipB = parseSlip(b.slipNo);
        
        if (slipA.year !== slipB.year) {
            return slipB.year.localeCompare(slipA.year); 
        }
        return slipB.num - slipA.num; 
    });

    recordsArray.forEach((d) => {
        let tr = document.createElement('tr');
        if(type === 'deposit') {
            tr.innerHTML = `
                <td><strong>${d.slipNo}</strong></td>
                <td>${d.name}</td>
                <td style="color:#4F46E5; font-weight:600;">${window.formatDateIndian(d.funcDate) || '-'}</td>
                <td>${d.funcName || '-'}</td>
                <td>${d.funcShift || '-'}</td>
                <td style="color:#10B981; font-weight:600;">₹${parseFloat(d.amount || 0).toFixed(2)}</td>
                <td>
                    <button class="btn-action btn-edit" onclick='editRec("${d.id}", "${type}")'><i class="ri-edit-line"></i></button>
                    <button class="btn-action btn-print" onclick='rePrint("${d.id}", "${type}")'><i class="ri-printer-line"></i></button>
                    <button class="btn-action btn-del" onclick='deleteRec("${d.id}", "${type}")'><i class="ri-delete-bin-line"></i></button>
                </td>`;
        } else {
            tr.innerHTML = `
                <td><strong>${d.slipNo}</strong></td>
                <td>${window.formatDateIndian(d.date)}</td>
                <td>${d.name}</td>
                <td style="color:#10B981; font-weight:600;">₹${parseFloat(d.amount || d.total).toFixed(2)}</td>
                <td>
                    <button class="btn-action btn-edit" onclick='editRec("${d.id}", "${type}")'><i class="ri-edit-line"></i></button>
                    <button class="btn-action btn-print" onclick='rePrint("${d.id}", "${type}")'><i class="ri-printer-line"></i></button>
                    <button class="btn-action btn-del" onclick='deleteRec("${d.id}", "${type}")'><i class="ri-delete-bin-line"></i></button>
                </td>`;
        }
        tbody.appendChild(tr);
    });
};

window.editRec = (id, type) => {
    let data = window.allRecords[id];
    if(!data) return;
    if (window.switchTab) window.switchTab(type);
    let prefix = type.substring(0, 3);
    if(document.getElementById(`${prefix}-edit-id`)) document.getElementById(`${prefix}-edit-id`).value = data.id;

    if(type === 'deposit') {
        document.getElementById('dep-slip').value = data.slipNo || '';
        document.getElementById('dep-date').value = data.date || '';
        document.getElementById('dep-member').value = data.member || '';
        document.getElementById('dep-name').value = data.name || '';
        document.getElementById('dep-mobile').value = data.mobile || '';
        document.getElementById('dep-address').value = data.address || '';
        document.getElementById('dep-native').value = data.native || '';
        document.getElementById('dep-func-name').value = data.funcName || '';
        document.getElementById('dep-func-date').value = data.funcDate || '';
        document.getElementById('dep-func-shift').value = data.funcShift || 'Morning (08:00 AM – 02:00 PM)';
        document.getElementById('dep-pay-type').value = data.payType || 'Cheque';
        document.getElementById('dep-pay-date').value = data.payDate || '';
        document.getElementById('dep-ref').value = data.ref || '';
        document.getElementById('dep-bank').value = data.bank || '';
        document.getElementById('dep-amount').value = data.amount || '';
        document.getElementById('dep-words').value = data.words || '';
    } else if(type === 'donation') {
        document.getElementById('don-slip').value = data.slipNo || '';
        document.getElementById('don-date').value = data.date || '';
        document.getElementById('don-member').value = data.member || '';
        document.getElementById('don-name').value = data.name || '';
        document.getElementById('don-address').value = data.address || '';
        document.getElementById('don-native').value = data.native || '';
        document.getElementById('don-pan').value = data.pan || '';
        let descSelect = document.getElementById('don-desc');
        let knownOptions = ["Dattak Yojna", "General Sahay", "Education Sahay", "Inaam Vitran", "Custom"];
        if(knownOptions.includes(data.desc)) {
            descSelect.value = data.desc;
            if(document.getElementById('don-custom-desc')) document.getElementById('don-custom-desc').style.display = 'none';
        } else {
            descSelect.value = "Custom";
            if(document.getElementById('don-custom-desc')) {
                document.getElementById('don-custom-desc').style.display = 'block';
                document.getElementById('don-custom-desc').value = data.desc || '';
            }
        }
        document.getElementById('don-pay-type').value = data.payType || 'Cheque';
        document.getElementById('don-pay-date').value = data.payDate || '';
        document.getElementById('don-ref').value = data.ref || '';
        document.getElementById('don-bank').value = data.bank || '';
        document.getElementById('don-amount').value = data.amount || '';
        document.getElementById('don-words').value = data.words || '';
    } else if(type === 'invoice') {
        document.getElementById('inv-slip').value = data.slipNo || '';
        document.getElementById('inv-date').value = data.date || '';
        document.getElementById('inv-is-member').value = data.isMember || 'No';
        if(window.toggleInvMember) window.toggleInvMember();
        document.getElementById('inv-member').value = data.member || '';
        document.getElementById('inv-name').value = data.name || '';
        document.getElementById('inv-address').value = data.address || '';
        document.getElementById('inv-gst').value = data.gst || '';
        let descSelect = document.getElementById('inv-desc-select');
        if(data.desc === 'Maintenance') {
            descSelect.value = data.desc;
            if(document.getElementById('inv-desc-custom')) document.getElementById('inv-desc-custom').style.display = 'none';
        } else {
            descSelect.value = "Other";
            if(document.getElementById('inv-desc-custom')) {
                document.getElementById('inv-desc-custom').style.display = 'block';
                document.getElementById('inv-desc-custom').value = data.desc || '';
            }
        }
        document.getElementById('inv-dep-ref').value = data.depRef || '';
        document.getElementById('inv-dep-date').value = data.depDate || '';
        if(document.getElementById('inv-dep-amount')) document.getElementById('inv-dep-amount').value = data.depAmount || '';
        document.getElementById('inv-basic').value = data.basic || '';
        document.getElementById('inv-cgst').value = data.cgst || '';
        document.getElementById('inv-sgst').value = data.sgst || '';
        document.getElementById('inv-round').value = data.round || '';
        document.getElementById('inv-total').value = data.total || '';
        document.getElementById('inv-words').value = data.words || '';
        document.getElementById('inv-pay-type').value = data.payType || 'Cheque';
        document.getElementById('inv-pay-date').value = data.payDate || '';
        document.getElementById('inv-ref').value = data.ref || '';
        document.getElementById('inv-bank').value = data.bank || '';
        if(document.getElementById('inv-settlement-type')) {
            document.getElementById('inv-settlement-type').value = data.settlementType || 'Refund';
            if(window.toggleInvSettlement) window.toggleInvSettlement();
        }
        if(document.getElementById('inv-refund-amount')) document.getElementById('inv-refund-amount').value = data.refundAmount || '';
        if(document.getElementById('inv-refund-words')) document.getElementById('inv-refund-words').value = data.refundWords || '';
        if(document.getElementById('inv-rec-dep-no')) document.getElementById('inv-rec-dep-no').value = data.recDepNo || '';
        if(document.getElementById('inv-rec-dep-date')) document.getElementById('inv-rec-dep-date').value = data.recDepDate || '';
        if(document.getElementById('inv-received-amount')) document.getElementById('inv-received-amount').value = data.recAmount || '';
        if(document.getElementById('inv-received-words')) document.getElementById('inv-received-words').value = data.recWords || '';
    }
    const btn = document.getElementById(`btn-submit-${prefix}`);
    if(btn) btn.innerHTML = "<i class='ri-edit-box-line'></i> Update Record";
};

window.deleteRec = async (id, type) => { 
    if(confirm("Are you sure you want to delete this record?")) { 
        await deleteDoc(doc(db, type, id)); 
        loadRecords(); 
        updateDashboardCounts(); 
    } 
};

const updateDashboardCounts = async () => {
    const deps = await getDocs(collection(db, 'deposit')); 
    const dons = await getDocs(collection(db, 'donation')); 
    const invs = await getDocs(collection(db, 'invoice'));
    if(document.getElementById('stat-dep')) document.getElementById('stat-dep').innerText = deps.size;
    if(document.getElementById('stat-don')) document.getElementById('stat-don').innerText = dons.size;
    if(document.getElementById('stat-inv')) document.getElementById('stat-inv').innerText = invs.size;

    const today = new Date().toISOString().split('T')[0];
    let upcomingList = [];
    deps.forEach(docSnap => {
        let d = docSnap.data();
        if(d.funcDate && d.funcDate >= today) upcomingList.push(d);
    });

    upcomingList.sort((a, b) => new Date(a.funcDate) - new Date(b.funcDate));
    const upBody = document.getElementById('upcoming-functions-body');
    if(upBody) {
        upBody.innerHTML = "";
        if(upcomingList.length === 0) {
            upBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No Upcoming Functions</td></tr>`;
        } else {
            upcomingList.slice(0, 10).forEach(ev => {
                let tr = document.createElement('tr');
                tr.innerHTML = `<td>${window.formatDateIndian(ev.funcDate)}</td><td>${ev.funcShift || '-'}</td><td>${ev.funcName || '-'}</td><td>${ev.name || '-'}</td><td>${ev.mobile || '-'}</td>`;
                upBody.appendChild(tr);
            });
        }
    }
};

window.rePrint = (idOrData, type) => { 
    let data = typeof idOrData === 'string' && window.allRecords[idOrData] ? window.allRecords[idOrData] : idOrData;
    printRecord(data, type); 
};

const printRecord = (data, type) => {
    const container = document.getElementById('print-container');
    let title = type === 'invoice' ? 'TAX INVOICE' : type.toUpperCase() + ' SLIP';
    let contentHtml = '';
    let copiesArray = ['ORIGINAL', 'DUPLICATE'];
    
    contentHtml += `
    <style>
        @media print {
            @page { size: A4 portrait; margin: 4mm; } 
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; background: #ffffff !important; -webkit-print-color-adjust: exact; color: #000; font-family: Arial, sans-serif; }
            #print-container { width: 100%; display: block; background: #ffffff !important; }
            
            .print-copy { 
                width: 100%; 
                height: 136mm; /* Adjusted height */
                box-sizing: border-box; 
                border: 2px solid #000; 
                border-radius: 8px; 
                padding: 10px 18px; 
                display: flex; 
                flex-direction: column; 
                page-break-inside: avoid; 
                background: #ffffff !important;
                overflow: hidden;
            }
            
            .header-section { position: relative; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 8px; text-align: center; } 
            .header-logo { position: absolute; left: 0; top: 0; height: 45px; background: #ffffff !important; }
            .header-copy-type { position: absolute; right: 0; top: 0; border: 2px solid #000; padding: 2px 8px; font-weight: bold; font-size: 11px; background: #ffffff !important; }
            .header-text { padding: 0 65px; }
            .header-text h2 { margin: 0; font-size: 16px; line-height: 1.1; color: #000; }
            .header-text p { margin: 2px 0; font-size: 9px; font-weight: bold; color: #000; }
            .header-text p.sub-text { font-size: 8px; font-weight: normal; margin: 0; }

            .print-title { text-align: center; text-decoration: underline; margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #000; text-transform: uppercase;}

            .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 25px; margin-bottom: 4px; } 
            .print-row { display: flex; align-items: flex-start; padding: 2px 0; border-bottom: 1px dashed #ccc; font-size: 10.5px; background: #ffffff !important; } 
            .print-row.no-border { border-bottom: none; padding-bottom: 0; padding-top: 4px; }
            .print-label { font-weight: bold; width: 130px; flex-shrink: 0; color: #000; }
            .print-val { flex-grow: 1; color: #000; }
            .full-span { grid-column: span 2; }
            
            .section-heading { font-weight: bold; font-size: 10px; margin-top: 6px; margin-bottom: 4px; text-transform: uppercase; color: #000; border-bottom: 1px solid #000; display: inline-block; } 

            .spacer { flex-grow: 1; min-height: 10px; }
            
            .signature-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; margin-bottom: 12px; } /* SIGNATURE SPACE INCREASED */
            .sign-box { border-top: 1.5px solid #000; width: 170px; text-align: center; padding-top: 5px; font-weight: bold; font-size: 11px; color: #000; }
            
            .cut-wrapper { width: 100%; text-align: center; margin: 3.5mm 0; border-bottom: 1px dashed #000; line-height: 0.1em; }
            .cut-text { background: #ffffff !important; padding: 0 10px; font-size: 10px; color: #000; font-weight: bold; letter-spacing: 1px;}
            
            .footer-box { font-size: 8.5px; line-height: 1.2; text-align: center; border-top: 1px solid #000; padding-top: 5px; background: #ffffff !important; }
        }
    </style>
    `;

    copiesArray.forEach((copy, index) => {
        let detailsHtml = "";
        let footerNoteHtml = "";

        if(type === 'invoice') {
            let isRefund = data.settlementType === 'Refund';
            detailsHtml = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Invoice No:</span> <span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span> <span class="print-val">${window.formatDateIndian(data.date)}</span></div>
                <div class="print-row"><span class="print-label">Name:</span> <span class="print-val">${data.name}</span></div>
                <div class="print-row"><span class="print-label">Address:</span> <span class="print-val">${data.address || '-'}</span></div>
                <div class="print-row"><span class="print-label">GSTIN:</span> <span class="print-val">${data.gst || '-'}</span></div>
                <div class="print-row"><span class="print-label">Description:</span> <span class="print-val">${data.desc || '-'}</span></div>
                <div class="print-row"><span class="print-label">Deposit Ref:</span> <span class="print-val">${data.depRef || '-'}</span></div>
                <div class="print-row"><span class="print-label">Deposit Date:</span> <span class="print-val">${window.formatDateIndian(data.depDate) || '-'}</span></div>
                <div class="print-row"><span class="print-label">Deposit Amt:</span> <span class="print-val"><strong>₹ ${parseFloat(data.depAmount || 0).toFixed(2)}</strong></span></div>
                <div></div>
                <div class="print-row"><span class="print-label">Basic Amount:</span> <span class="print-val">₹ ${parseFloat(data.basic || 0).toFixed(2)}</span></div>
                <div class="print-row"><span class="print-label">CGST (9.0%):</span> <span class="print-val">₹ ${parseFloat(data.cgst || 0).toFixed(2)}</span></div>
                <div class="print-row"><span class="print-label">SGST (9.0%):</span> <span class="print-val">₹ ${parseFloat(data.sgst || 0).toFixed(2)}</span></div>
                <div class="print-row"><span class="print-label">Round Off:</span> <span class="print-val">₹ ${parseFloat(data.round || 0).toFixed(2)}</span></div>
                <div class="print-row"><span class="print-label">Total Amount:</span> <span class="print-val"><strong>₹ ${parseFloat(data.total || 0).toFixed(2)}</strong></span></div>
                <div></div>
                <div class="print-row full-span no-border" style="font-style:italic; font-weight: bold;">In Words: ${data.words || '-'}</div>
            </div>
            <div class="section-heading" style="margin-top:4px;">${isRefund ? 'REFUND DETAILS' : 'RECEIVED DETAILS'}</div>
            <div class="print-grid">
                ${isRefund ? `
                    <div class="print-row"><span class="print-label">Pay Type/Date:</span> <span class="print-val">${data.payType || '-'} / ${window.formatDateIndian(data.payDate) || '-'}</span></div>
                    <div class="print-row"><span class="print-label">Ref/Bank:</span> <span class="print-val">${data.ref || '-'} / ${data.bank || '-'}</span></div>
                    <div class="print-row"><span class="print-label">Refund Amt:</span> <span class="print-val"><strong>₹ ${parseFloat(data.refundAmount || 0).toFixed(2)}</strong></span></div>
                ` : `
                    <div class="print-row"><span class="print-label">Dep No/Date:</span> <span class="print-val">${data.recDepNo || '-'} / ${window.formatDateIndian(data.recDepDate) || '-'}</span></div>
                    <div class="print-row"><span class="print-label">Pay Type/Date:</span> <span class="print-val">${data.payType || '-'} / ${window.formatDateIndian(data.payDate) || '-'}</span></div>
                    <div class="print-row"><span class="print-label">Rec Amount:</span> <span class="print-val"><strong>₹ ${parseFloat(data.recAmount || 0).toFixed(2)}</strong></span></div>
                `}
            </div>`;
        } 
        else if (type === 'donation') {
            detailsHtml = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Slip No:</span> <span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span> <span class="print-val">${window.formatDateIndian(data.date)}</span></div>
                <div class="print-row"><span class="print-label">Name:</span> <span class="print-val">${data.name}</span></div>
                <div class="print-row"><span class="print-label">Address:</span> <span class="print-val">${data.address || '-'}</span></div>
                <div class="print-row"><span class="print-label">Member/Native:</span> <span class="print-val">${data.member || '-'}/${data.native || '-'}</span></div>
                <div class="print-row"><span class="print-label">PAN No:</span> <span class="print-val">${data.pan || '-'}</span></div>
                <div class="print-row"><span class="print-label">Description:</span> <span class="print-val">${data.desc || '-'}</span></div>
                <div class="print-row"><span class="print-label">Pay Type/Date:</span> <span class="print-val">${data.payType} / ${window.formatDateIndian(data.payDate) || '-'}</span></div>
                <div class="print-row"><span class="print-label">Ref/Bank:</span> <span class="print-val">${data.ref || '-'} / ${data.bank || '-'}</span></div>
                <div class="print-row"><span class="print-label">Amount:</span> <span class="print-val"><strong>₹ ${parseFloat(data.amount || 0).toFixed(2)}</strong></span></div>
                <div class="print-row full-span no-border" style="font-style:italic; font-weight: bold;">In Words: ${data.words || '-'}</div>
            </div>`;
            footerNoteHtml = `
                <div class="footer-box" style="border: 1px solid #000; padding: 4px;">
                    <strong>PAN NO. AAATS6070J | URN NO. AAATS6070JF20217 | DATE 24-09-2021</strong><br>
                    DONATION IS EXEMPTED UNDER SECTION 80G(5) 180/09-10 DATED: 20/11/2009 OF IT ACT 1961
                </div>`;
        } 
        else {
            detailsHtml = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Slip No:</span> <span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span> <span class="print-val">${window.formatDateIndian(data.date)}</span></div>
                <div class="print-row"><span class="print-label">Name:</span> <span class="print-val">${data.name}</span></div>
                <div class="print-row"><span class="print-label">Mobile No:</span> <span class="print-val">${data.mobile || '-'}</span></div>
                <div class="print-row full-span"><span class="print-label">Address:</span> <span class="print-val">${data.address || '-'}</span></div>
                <div class="print-row"><span class="print-label">Member/Native:</span> <span class="print-val">${data.member || '-'}/${data.native || '-'}</span></div>
                <div class="print-row"><span class="print-label">Function Type:</span> <span class="print-val">${data.funcName || '-'}</span></div>
                <div class="print-row"><span class="print-label">Function Date:</span> <span class="print-val">${window.formatDateIndian(data.funcDate) || '-'} (${data.funcShift || '-'})</span></div>
                <div class="print-row"><span class="print-label">Pay Type/Date:</span> <span class="print-val">${data.payType} / ${window.formatDateIndian(data.payDate) || '-'}</span></div>
                <div class="print-row"><span class="print-label">Ref/Bank:</span> <span class="print-val">${data.ref || '-'} / ${data.bank || '-'}</span></div>
                <div class="print-row"><span class="print-label">Amount:</span> <span class="print-val"><strong>₹ ${parseFloat(data.amount || 0).toFixed(2)}</strong></span></div>
                <div class="print-row full-span no-border" style="font-style:italic; font-weight: bold;">In Words: ${data.words || '-'}</div>
            </div>`;
            footerNoteHtml = `
            <div class="footer-box">
                <table style="width:100%; border-collapse: collapse; text-align: left; font-size: 8px;">
                    <tbody>
                        <tr><td style="border: 1px solid #000; padding: 1px 3px; font-weight: bold; width:10px;">1.</td><td style="border: 1px solid #000; padding: 1px 3px;">Vehicle parking is host responsibility. Sanstha has no liability.</td></tr>
                        <tr><td style="border: 1px solid #000; padding: 1px 3px; font-weight: bold;">2.</td><td style="border: 1px solid #000; padding: 1px 3px;">Original Receipt is mandatory for final settlement and refunds.</td></tr>
                        <tr><td style="border: 1px solid #000; padding: 1px 3px; font-weight: bold;">3.</td><td style="border: 1px solid #000; padding: 1px 3px;">Venue name must be: <strong>“Sheth Shri Hiralal Hargovandas Batrisi Hall.”</strong></td></tr>
                    </tbody>
                </table>
            </div>`;
        }

        contentHtml += `
            <div class="print-copy">
                <div class="header-section">
                    <img src="logo.png" class="header-logo">
                    <div class="header-text">
                        <h2>${orgName}</h2>
                        <p>${orgAddress}</p>
                        <p class="sub-text">${orgDetailsLine1}</p>
                        <p class="sub-text">${orgDetailsLine2}</p>
                    </div>
                    <div class="header-copy-type">${copy}</div>
                </div>
                <div class="print-title">${title}</div>
                ${detailsHtml}
                <div class="spacer"></div>
                <div class="signature-row">
                    <div class="sign-box">Payer Signature</div>
                    <div class="sign-box">Receiver Signature</div>
                </div>
                ${footerNoteHtml}
            </div>`;

        if (index === 0) {
            contentHtml += `<div class="cut-wrapper"><span class="cut-text">✂ - - - Cut Here - - - ✂</span></div>`;
        }
    });
    
    container.innerHTML = contentHtml;
    setTimeout(() => { window.print(); }, 500);
};

window.addEventListener('load', async () => {
    setToday(); updateDashboardCounts();
    await generateSlipNo('deposit', 'dep-slip'); await generateSlipNo('donation', 'don-slip'); await generateSlipNo('invoice', 'inv-slip');
});
