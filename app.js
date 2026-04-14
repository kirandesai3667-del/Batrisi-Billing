// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const orgName = "Shree Batrisi Jain Co-Op Education Society Ltd";
const orgAddress = "Sheth Shri Hiralal Hargovandas Batrishi Hall, Near R.T.O Circle, Subhashbridge, Collector Kacheri, Ahmedabad - 380027";
const orgDetails = "GSTIN: 24AAATS6070J1ZE | Reg No: GH/230 (10/10/1944) | Mob: 9586423232 | Email: 32cedusociety@gmail.com";
const logoUrl = "logo.png"; 

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
            let parts = doc.data().slipNo.split('/');
            if(parts[1] === fy && parseInt(parts[0]) > lastNum) lastNum = parseInt(parts[0]);
        });
        const newNum = String(lastNum + 1).padStart(3, '0');
        if(document.getElementById(targetId)) document.getElementById(targetId).value = `${newNum}/${fy}`;
    } catch(err) { console.error("Slip Gen Error:", err); }
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
            const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/"/g, '').trim().toLowerCase());
            let mIdx = headers.findIndex(h => h.includes('number') || h.includes('no'));
            let nIdx = headers.findIndex(h => h.includes('name') && !h.includes('native'));
            let aIdx = headers.findIndex(h => h.includes('address'));
            let ntIdx = headers.findIndex(h => h.includes('native'));

            const batch = writeBatch(db);
            let count = 0;
            for(let i=1; i<lines.length; i++){
                if(!lines[i].trim()) continue;
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                let memNo = cols[mIdx]?.replace(/"/g,'').trim();
                if(memNo) {
                    batch.set(doc(db, "members", memNo), {
                        name: cols[nIdx]?.replace(/"/g,'').trim() || '',
                        address: cols[aIdx]?.replace(/"/g,'').trim() || '',
                        native: cols[ntIdx]?.replace(/"/g,'').trim() || ''
                    });
                    count++;
                }
            }
            await batch.commit();
            status.innerText = `Success! ${count} Members saved permanently.`;
        } catch (error) { status.innerText = "Error uploading CSV."; }
    };
    reader.readAsText(file);
};

window.fetchMember = async (inputId, nameId, addrId, nativeId) => {
    const val = document.getElementById(inputId).value.trim();
    if(!val) return;
    const docSnap = await getDoc(doc(db, "members", val));
    if(docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById(nameId).value = data.name || '';
        document.getElementById(addrId).value = data.address || '';
        document.getElementById(nativeId).value = data.native || '';
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
        
        // Convert dates to Indian Format for export
        if(data.date) data.date = window.formatDateIndian(data.date);
        if(data.payDate) data.payDate = window.formatDateIndian(data.payDate);
        if(data.funcDate) data.funcDate = window.formatDateIndian(data.funcDate);

        if(headers.length === 0) {
            headers = Object.keys(data);
            rows.push(headers.join(","));
        }
        
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

// --- SAVE & UPDATE LOGIC (Main Persistence) ---
window.handleFormSubmit = async (e, type) => {
    if(e) e.preventDefault();
    const prefix = type.substring(0, 3);
    const btn = document.getElementById(`btn-submit-${prefix}`);
    if(btn) { btn.innerHTML = "Saving to Cloud..."; btn.disabled = true; }

    try {
        let data = { timestamp: new Date().toISOString() };
        let editId = document.getElementById(`${prefix}-edit-id`).value;

        if(type === 'deposit') {
            data = { ...data, slipNo: document.getElementById('dep-slip').value, date: document.getElementById('dep-date').value, name: document.getElementById('dep-name').value, address: document.getElementById('dep-address').value, member: document.getElementById('dep-member').value, native: document.getElementById('dep-native').value, funcName: document.getElementById('dep-func-name').value, funcDate: document.getElementById('dep-func-date').value, payType: document.getElementById('dep-pay-type').value, payDate: document.getElementById('dep-pay-date').value, ref: document.getElementById('dep-ref').value, bank: document.getElementById('dep-bank').value, amount: document.getElementById('dep-amount').value, words: document.getElementById('dep-words').value };
        } else if(type === 'donation') {
            data = { ...data, slipNo: document.getElementById('don-slip').value, date: document.getElementById('don-date').value, name: document.getElementById('don-name').value, address: document.getElementById('don-address').value, member: document.getElementById('don-member').value, native: document.getElementById('don-native').value, pan: document.getElementById('don-pan').value, desc: document.getElementById('don-desc').value === 'Custom' ? document.getElementById('don-custom-desc').value : document.getElementById('don-desc').value, payType: document.getElementById('don-pay-type').value, payDate: document.getElementById('don-pay-date').value, ref: document.getElementById('don-ref').value, bank: document.getElementById('don-bank').value, amount: document.getElementById('don-amount').value, words: document.getElementById('don-words').value };
        } else if(type === 'invoice') {
            data = { ...data, slipNo: document.getElementById('inv-slip').value, date: document.getElementById('inv-date').value, name: document.getElementById('inv-name').value, address: document.getElementById('inv-address').value, gst: document.getElementById('inv-gst').value, desc: document.getElementById('inv-desc').value, basic: document.getElementById('inv-basic').value, cgst: document.getElementById('inv-cgst').value, sgst: document.getElementById('inv-sgst').value, total: document.getElementById('inv-total').value, words: document.getElementById('inv-words').value, payType: document.getElementById('inv-pay-type').value, payDate: document.getElementById('inv-pay-date').value, ref: document.getElementById('inv-ref').value, bank: document.getElementById('inv-bank').value };
        }

        if(editId) {
            await updateDoc(doc(db, type, editId), data);
            document.getElementById(`${prefix}-edit-id`).value = "";
        } else {
            await addDoc(collection(db, type), data);
        }
        
        alert("Data Saved Successfully in Cloud!");
        document.getElementById(`form-${type}`).reset();
        setToday();
        updateDashboardCounts();
        await generateSlipNo(type, `${prefix}-slip`);
        printRecord(data, type);

    } catch (error) { alert("Error saving to Firebase. Check your Internet!"); }
    finally { if(btn) { btn.innerHTML = `<i class="ri-printer-line"></i> Save & Print`; btn.disabled = false; } }
};

// --- LOAD RECORDS (Pulling from Cloud) ---
window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const tbody = document.getElementById('records-body');
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Fetching from Cloud...</td></tr>";
    
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const qs = await getDocs(q);
    tbody.innerHTML = "";
    
    if(qs.empty) { tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No Data Saved Yet</td></tr>"; return; }

    qs.forEach((docSnap) => {
        let d = docSnap.data(); d.id = docSnap.id;
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.slipNo}</strong></td><td>${window.formatDateIndian(d.date)}</td><td>${d.name}</td>
            <td style="color:#10B981; font-weight:600;">₹${d.amount || d.total}</td>
            <td>
                <button class="btn-action btn-edit" onclick='editRec(${JSON.stringify(d)}, "${type}")'><i class="ri-edit-line"></i></button>
                <button class="btn-action btn-print" onclick='rePrint(${JSON.stringify(d)}, "${type}")'><i class="ri-printer-line"></i></button>
                <button class="btn-action btn-del" onclick='deleteRec("${d.id}", "${type}")'><i class="ri-delete-bin-line"></i></button>
            </td>`;
        tbody.appendChild(tr);
    });
};

window.deleteRec = async (id, type) => {
    if(confirm("Confirm Delete from Cloud?")) {
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
};

// --- PRINT LOGIC ---
window.rePrint = (data, type) => { printRecord(data, type); };
const printRecord = (data, type) => {
    const container = document.getElementById('print-container');
    let title = type.toUpperCase() + (type === 'invoice' ? ' INVOICE' : ' SLIP');
    let contentHtml = '';
    
    ['ORIGINAL', 'DUPLICATE'].forEach(copy => {
        let details = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Slip No:</span> ${data.slipNo}</div>
                <div class="print-row"><span class="print-label">Date:</span> ${window.formatDateIndian(data.date)}</div>
                <div class="print-row"><span class="print-label">Name:</span> ${data.name}</div>
                <div class="print-row"><span class="print-label">Address:</span> ${data.address || '-'}</div>
                <div class="print-row"><span class="print-label">Member No:</span> ${data.member || '-'}</div>
                <div class="print-row"><span class="print-label">Native:</span> ${data.native || '-'}</div>
                <div class="print-row"><span class="print-label">Pay Type:</span> ${data.payType}</div>
                <div class="print-row"><span class="print-label">Amount:</span> <strong>₹ ${data.amount || data.total}</strong></div>
            </div>
            <div style="margin-top:10px; font-style:italic;">Words: ${data.words}</div>
        `;
        
        let customInstructionsHtml = '';
        if(type === 'deposit') {
            customInstructionsHtml = `
                <div style="margin-top:15px; font-size:10px; font-family:Arial, sans-serif; border:1px solid #ddd; padding:8px;">
                    <strong style="text-decoration:underline;">Instructions:</strong>
                    <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                        <li>All parking responsibilities shall be kindly managed by the party booking the hall.</li>
                        <li>After completion of the function, at the time of final settlement, you are requested to please bring and submit this deposit slip.</li>
                        <li>For any function, wherever invitations are issued, you are kindly requested to mention the name of the Sanstha as <strong>“Sheth Shri Hiralal Hargovandas Batrisi Hall.”</strong> In case of non-compliance, the Sanstha may levy a penalty as per its rules.</li>
                    </ul>
                </div>
            `;
        }

        contentHtml += `
            <div class="print-copy" style="border:1px dashed #000; padding:15px; margin-bottom:20px; position:relative;">
                <div style="position:absolute; top:10px; right:10px; border:1px solid #000; padding:2px 5px;">${copy}</div>
                
                <div style="position:relative; margin-bottom:15px;">
                    <img src="logo.png" style="width:70px; position:absolute; left:0; top:0; z-index:1; background:#fff; padding-right:10px;">
                    <div style="padding-left: 80px; text-align:center; border-bottom:1px solid #000; padding-bottom:8px;">
                        <h2 style="margin:0; font-size:18px;">${orgName}</h2>
                        <p style="margin:4px 0 0 0; font-size:10px;">${orgAddress}</p>
                    </div>
                </div>

                <h3 style="text-align:center; text-decoration:underline; margin-bottom:10px;">${title}</h3>
                ${details}
                ${customInstructionsHtml}
                
                <div style="display:flex; justify-content:space-between; margin-top:${type === 'deposit' ? '30px' : '60px'};">
                    <div style="border-top:1px solid #000; width:150px; text-align:center;">Payer Signature</div>
                    <div style="border-top:1px solid #000; width:150px; text-align:center;">Receiver Signature</div>
                </div>
            </div>`;
    });
    container.innerHTML = contentHtml;
    setTimeout(() => { window.print(); }, 500);
};

// Start App
window.addEventListener('load', async () => {
    setToday();
    updateDashboardCounts();
    await generateSlipNo('deposit', 'dep-slip');
    await generateSlipNo('donation', 'don-slip');
    await generateSlipNo('invoice', 'inv-slip');
});
