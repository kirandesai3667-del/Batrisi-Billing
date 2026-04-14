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

// --- GLOBAL VARIABLES ---
const orgName = "Shree Batrisi Jain Co-Op Education Society Ltd";
const orgAddress = "Sheth Shri Hiralal Hargovandas Batrishi Hall, Near R.T.O Circle, Subhashbridge, Collector Kacheri, Ahmedabad - 380027";
const orgDetails = "GSTIN: 24AAATS6070J1ZE | Reg No: GH/230 (10/10/1944) | Mob: 9586423232 | Email: 32cedusociety@gmail.com";
const logoUrl = "logo.png"; 

// --- AUTO INCREMENT SLIP LOGIC ---
const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('dep-date')) document.getElementById('dep-date').value = today;
    if(document.getElementById('don-date')) document.getElementById('don-date').value = today;
    if(document.getElementById('inv-date')) document.getElementById('inv-date').value = today;
};

const getFinancialYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    if(today.getMonth() >= 3) return `${year}-${(year+1).toString().slice(2)}`;
    return `${year-1}-${year.toString().slice(2)}`;
};

const generateSlipNo = async (collectionName, targetId) => {
    try {
        const fy = getFinancialYear();
        const q = query(collection(db, collectionName), orderBy("timestamp", "desc"));
        const qs = await getDocs(q);
        let lastNum = 0;
        qs.forEach((doc) => {
            let parts = doc.data().slipNo.split('/');
            if(parts[1] === fy && parseInt(parts[0]) > lastNum) lastNum = parseInt(parts[0]);
        });
        const newNum = String(lastNum + 1).padStart(3, '0');
        if(document.getElementById(targetId)) document.getElementById(targetId).value = `${newNum}/${fy}`;
    } catch(err) { console.error("Slip Error:", err); }
};

// --- SMART CSV PARSER ---
window.uploadCSV = async () => {
    const file = document.getElementById('csv-upload').files[0];
    if(!file) return alert('Please select a CSV file first.');
    const status = document.getElementById('csv-status');
    status.style.color = "#10B981";
    status.innerText = "Processing Data... Please wait!";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const lines = e.target.result.split(/\r?\n/);
            if (lines.length < 2) throw new Error("CSV is empty");

            const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.replace(/"/g, '').trim().toLowerCase());
            
            let memIdx = headers.findIndex(h => h.includes('number') || h.includes('no'));
            let nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('native'));
            let addrIdx = headers.findIndex(h => h.includes('address'));
            let nativeIdx = headers.findIndex(h => h.includes('native'));

            if (memIdx === -1) memIdx = 0;
            if (nameIdx === -1) nameIdx = 1;
            if (addrIdx === -1) addrIdx = 2;
            if (nativeIdx === -1) nativeIdx = 3;

            let count = 0;
            const chunks =[];
            let currentChunk =[];
            
            for(let i=1; i<lines.length; i++){
                if(!lines[i].trim()) continue;
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                
                let memNo = cols[memIdx] ? cols[memIdx].replace(/"/g,'').trim() : "";
                let name = cols[nameIdx] ? cols[nameIdx].replace(/"/g,'').trim() : "";
                let addr = cols[addrIdx] ? cols[addrIdx].replace(/"/g,'').trim() : "";
                let native = cols[nativeIdx] ? cols[nativeIdx].replace(/"/g,'').trim() : "";

                if(memNo) {
                    currentChunk.push({memNo, name, addr, native});
                    count++;
                }

                if(currentChunk.length === 500) {
                    chunks.push(currentChunk);
                    currentChunk =[];
                }
            }
            if(currentChunk.length > 0) chunks.push(currentChunk);

            for (let chunk of chunks) {
                const batch = writeBatch(db);
                for (let member of chunk) {
                    const docRef = doc(db, "members", member.memNo);
                    batch.set(docRef, { name: member.name, address: member.addr, native: member.native });
                }
                await batch.commit();
            }

            status.innerText = `Success! ${count} members added.`;
        } catch (error) {
            console.error("CSV Upload Error:", error);
            status.style.color = "red";
            status.innerText = "Error uploading data.";
        }
    };
    reader.readAsText(file);
};

// Fetch Member (Auto-fill Data)
window.fetchMember = async (inputId, nameId, addrId, nativeId) => {
    const val = document.getElementById(inputId).value.trim();
    if(!val) return;
    try {
        const docSnap = await getDoc(doc(db, "members", val));
        if(docSnap.exists()) {
            const data = docSnap.data();
            if(document.getElementById(nameId)) document.getElementById(nameId).value = data.name || '';
            if(document.getElementById(addrId)) document.getElementById(addrId).value = data.address || '';
            if(document.getElementById(nativeId)) document.getElementById(nativeId).value = data.native || '';
        }
    } catch (err) { console.error("Fetch Member Error:", err); }
};

// --- CRUD OPERATIONS (SAVE, EDIT, DELETE) ---
const handleFormSubmit = async (e, type) => {
    e.preventDefault(); // STOP PAGE FROM RELOADING
    
    // Bug Fix: Matching the exact Button ID from HTML ('dep' instead of 'deposit')
    const prefix = type === 'deposit' ? 'dep' : type === 'donation' ? 'don' : 'inv';
    const btn = document.getElementById(`btn-submit-${prefix}`);
    
    if(btn) {
        btn.innerHTML = "<i class='ri-loader-4-line ri-spin'></i> Saving...";
        btn.disabled = true;
    }

    try {
        let data = { timestamp: new Date().toISOString() };
        let editIdField = document.getElementById(`${prefix}-edit-id`);
        let editId = editIdField ? editIdField.value : "";

        if(type === 'deposit') {
            data.slipNo = document.getElementById('dep-slip').value;
            data.date = document.getElementById('dep-date').value;
            data.name = document.getElementById('dep-name').value;
            data.address = document.getElementById('dep-address').value;
            data.member = document.getElementById('dep-member').value;
            data.native = document.getElementById('dep-native').value;
            data.funcName = document.getElementById('dep-func-name').value;
            data.funcDate = document.getElementById('dep-func-date').value;
            data.payType = document.getElementById('dep-pay-type').value;
            data.payDate = document.getElementById('dep-pay-date').value;
            data.ref = document.getElementById('dep-ref').value;
            data.bank = document.getElementById('dep-bank').value;
            data.amount = document.getElementById('dep-amount').value;
            data.words = document.getElementById('dep-words').value;
        } else if(type === 'donation') {
            data.slipNo = document.getElementById('don-slip').value;
            data.date = document.getElementById('don-date').value;
            data.name = document.getElementById('don-name').value;
            data.address = document.getElementById('don-address').value;
            data.member = document.getElementById('don-member').value;
            data.native = document.getElementById('don-native').value;
            data.pan = document.getElementById('don-pan').value;
            data.desc = document.getElementById('don-desc').value === 'Custom' ? document.getElementById('don-custom-desc').value : document.getElementById('don-desc').value;
            data.payType = document.getElementById('don-pay-type').value;
            data.payDate = document.getElementById('don-pay-date').value;
            data.ref = document.getElementById('don-ref').value;
            data.bank = document.getElementById('don-bank').value;
            data.amount = document.getElementById('don-amount').value;
            data.words = document.getElementById('don-words').value;
        } else if(type === 'invoice') {
            data.slipNo = document.getElementById('inv-slip').value;
            data.date = document.getElementById('inv-date').value;
            data.name = document.getElementById('inv-name').value;
            data.address = document.getElementById('inv-address').value;
            data.gst = document.getElementById('inv-gst').value;
            data.desc = document.getElementById('inv-desc').value;
            data.basic = document.getElementById('inv-basic').value;
            data.cgst = document.getElementById('inv-cgst').value;
            data.sgst = document.getElementById('inv-sgst').value;
            data.total = document.getElementById('inv-total').value;
            data.words = document.getElementById('inv-words').value;
            data.payType = document.getElementById('inv-pay-type').value;
            data.payDate = document.getElementById('inv-pay-date').value;
            data.ref = document.getElementById('inv-ref').value;
            data.bank = document.getElementById('inv-bank').value;
        }

        if(editId) {
            await updateDoc(doc(db, type, editId), data);
            if(editIdField) editIdField.value = ""; 
        } else {
            await addDoc(collection(db, type), data);
        }
        
        e.target.reset();
        setToday();
        updateDashboardCounts();
        await generateSlipNo(type, `${prefix}-slip`);
        
        // Print
        printRecord(data, type);

    } catch (error) {
        console.error("Save Error:", error);
        alert("Error saving record! Check console.");
    } finally {
        if(btn) {
            btn.innerHTML = `<i class="ri-printer-line"></i> Save & Print`;
            btn.disabled = false;
        }
    }
};

// 100% Guaranteed Event Attachment
setTimeout(() => {
    const fDep = document.getElementById('form-deposit');
    if(fDep) fDep.onsubmit = (e) => handleFormSubmit(e, 'deposit');

    const fDon = document.getElementById('form-donation');
    if(fDon) fDon.onsubmit = (e) => handleFormSubmit(e, 'donation');

    const fInv = document.getElementById('form-invoice');
    if(fInv) fInv.onsubmit = (e) => handleFormSubmit(e, 'invoice');
}, 500);

// Load Records to Table
window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const tbody = document.getElementById('records-body');
    if(!tbody) return;
    
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'><i class='ri-loader-4-line ri-spin'></i> Loading data...</td></tr>";
    
    try {
        const q = query(collection(db, type), orderBy("timestamp", "desc"));
        const qs = await getDocs(q);
        tbody.innerHTML = "";
        
        if(qs.empty) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No records found</td></tr>";
            return;
        }

        qs.forEach((docSnap) => {
            let data = docSnap.data();
            data.id = docSnap.id; 
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.slipNo}</strong></td>
                <td>${data.date}</td>
                <td>${data.name}</td>
                <td style="color:#10B981; font-weight:600;">₹${data.amount || data.total}</td>
                <td>
                    <button class="btn-action btn-edit" onclick='editRec(${JSON.stringify(data)}, "${type}")' title="Edit"><i class="ri-edit-line"></i></button>
                    <button class="btn-action btn-print" onclick='rePrint(${JSON.stringify(data)}, "${type}")' title="Print"><i class="ri-printer-line"></i></button>
                    <button class="btn-action btn-del" onclick='deleteRec("${data.id}", "${type}")' title="Delete"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
};

// EDIT RECORD
window.editRec = (data, type) => {
    switchTab(type);
    const prefix = type === 'deposit' ? 'dep' : type === 'donation' ? 'don' : 'inv';
    
    if(type === 'deposit') {
        document.getElementById('dep-edit-id').value = data.id;
        document.getElementById('dep-slip').value = data.slipNo;
        document.getElementById('dep-date').value = data.date;
        document.getElementById('dep-member').value = data.member || '';
        document.getElementById('dep-name').value = data.name;
        document.getElementById('dep-address').value = data.address || '';
        document.getElementById('dep-native').value = data.native || '';
        document.getElementById('dep-func-name').value = data.funcName || '';
        document.getElementById('dep-func-date').value = data.funcDate || '';
        document.getElementById('dep-pay-type').value = data.payType;
        document.getElementById('dep-pay-date').value = data.payDate || '';
        document.getElementById('dep-ref').value = data.ref || '';
        document.getElementById('dep-bank').value = data.bank || '';
        document.getElementById('dep-amount').value = data.amount;
        document.getElementById('dep-words').value = data.words;
    } else if(type === 'donation') {
        document.getElementById('don-edit-id').value = data.id;
        document.getElementById('don-slip').value = data.slipNo;
        document.getElementById('don-date').value = data.date;
        document.getElementById('don-member').value = data.member || '';
        document.getElementById('don-name').value = data.name;
        document.getElementById('don-address').value = data.address || '';
        document.getElementById('don-native').value = data.native || '';
        document.getElementById('don-pan').value = data.pan || '';
        let sel = document.getElementById('don-desc');
        let options = Array.from(sel.options).map(o => o.value);
        if(options.includes(data.desc)) {
            sel.value = data.desc;
            document.getElementById('don-custom-desc').style.display = 'none';
        } else {
            sel.value = 'Custom';
            document.getElementById('don-custom-desc').style.display = 'block';
            document.getElementById('don-custom-desc').value = data.desc;
        }
        document.getElementById('don-pay-type').value = data.payType;
        document.getElementById('don-pay-date').value = data.payDate || '';
        document.getElementById('don-ref').value = data.ref || '';
        document.getElementById('don-bank').value = data.bank || '';
        document.getElementById('don-amount').value = data.amount;
        document.getElementById('don-words').value = data.words;
    } else if(type === 'invoice') {
        document.getElementById('inv-edit-id').value = data.id;
        document.getElementById('inv-slip').value = data.slipNo;
        document.getElementById('inv-date').value = data.date;
        document.getElementById('inv-name').value = data.name;
        document.getElementById('inv-address').value = data.address || '';
        document.getElementById('inv-gst').value = data.gst || '';
        document.getElementById('inv-desc').value = data.desc;
        document.getElementById('inv-basic').value = data.basic;
        document.getElementById('inv-cgst').value = data.cgst;
        document.getElementById('inv-sgst').value = data.sgst;
        document.getElementById('inv-total').value = data.total;
        document.getElementById('inv-words').value = data.words;
        document.getElementById('inv-pay-type').value = data.payType;
        document.getElementById('inv-pay-date').value = data.payDate || '';
        document.getElementById('inv-ref').value = data.ref || '';
        document.getElementById('inv-bank').value = data.bank || '';
    }
    
    let btn = document.getElementById(`btn-submit-${prefix}`);
    if(btn) btn.innerHTML = `<i class="ri-save-line"></i> Update & Print`;
};

window.deleteRec = async (id, type) => {
    if(confirm("Are you sure you want to delete this record?")) {
        try { await deleteDoc(doc(db, type, id)); window.loadRecords(); updateDashboardCounts(); } 
        catch(err) { alert("Error deleting record."); }
    }
};

const updateDashboardCounts = async () => {
    try {
        const deps = await getDocs(collection(db, 'deposit'));
        const dons = await getDocs(collection(db, 'donation'));
        const invs = await getDocs(collection(db, 'invoice'));
        if(document.getElementById('stat-dep')) document.getElementById('stat-dep').innerText = deps.size;
        if(document.getElementById('stat-don')) document.getElementById('stat-don').innerText = dons.size;
        if(document.getElementById('stat-inv')) document.getElementById('stat-inv').innerText = invs.size;
    } catch (err) {}
};

// --- PRINTING LOGIC ---
window.rePrint = (data, type) => { printRecord(data, type); };

const printRecord = (data, type) => {
    const container = document.getElementById('print-container');
    let title = type === 'deposit' ? 'DEPOSIT SLIP' : type === 'donation' ? 'DONATION RECEIPT' : 'TAX INVOICE';
    let contentHtml = '';['ORIGINAL', 'DUPLICATE'].forEach(copyType => {
        let detailsHtml = '';
        if(type === 'deposit' || type === 'donation') {
            detailsHtml = `
                <div class="print-grid">
                    <div class="print-row"><span class="print-label">Slip No:</span> ${data.slipNo}</div>
                    <div class="print-row"><span class="print-label">Date:</span> ${data.date}</div>
                    <div class="print-row"><span class="print-label">Name:</span> ${data.name}</div>
                    <div class="print-row"><span class="print-label">Address:</span> ${data.address || '-'}</div>
                    <div class="print-row"><span class="print-label">Member No:</span> ${data.member || '-'}</div>
                    <div class="print-row"><span class="print-label">Native:</span> ${data.native || '-'}</div>
                    ${type === 'deposit' ? `<div class="print-row"><span class="print-label">Function:</span> ${data.funcName || '-'}</div><div class="print-row"><span class="print-label">Func Date:</span> ${data.funcDate || '-'}</div>` : `<div class="print-row"><span class="print-label">PAN No:</span> ${data.pan || '-'}</div><div class="print-row"><span class="print-label">Description:</span> ${data.desc || '-'}</div>`}
                    <div class="print-row"><span class="print-label">Pay Type:</span> ${data.payType}</div>
                    <div class="print-row"><span class="print-label">Bank:</span> ${data.bank || '-'}</div>
                    <div class="print-row"><span class="print-label">Ref No:</span> ${data.ref || '-'}</div>
                    <div class="print-row"><span class="print-label">Pay Date:</span> ${data.payDate || '-'}</div>
                </div>
                <div class="print-row" style="font-size:16px; margin-top:5px;"><span class="print-label">Amount:</span> <strong>₹ ${data.amount}</strong> <span style="margin-left:15px;">(${data.words})</span></div>`;
        } else if(type === 'invoice') {
            detailsHtml = `
                <div class="print-grid">
                    <div class="print-row"><span class="print-label">Invoice No:</span> ${data.slipNo}</div>
                    <div class="print-row"><span class="print-label">Date:</span> ${data.date}</div>
                    <div class="print-row"><span class="print-label">Name:</span> ${data.name}</div>
                    <div class="print-row"><span class="print-label">GST No:</span> ${data.gst || '-'}</div>
                    <div class="print-row" style="grid-column: span 2;"><span class="print-label">Address:</span> ${data.address || '-'}</div>
                    <div class="print-row"><span class="print-label">Description:</span> ${data.desc}</div>
                    <div class="print-row"><span class="print-label">Basic Amt:</span> ₹${data.basic}</div>
                    <div class="print-row"><span class="print-label">CGST (9%):</span> ₹${data.cgst}</div>
                    <div class="print-row"><span class="print-label">SGST (9%):</span> ₹${data.sgst}</div>
                    <div class="print-row"><span class="print-label">Total:</span> <strong>₹${data.total}</strong></div>
                    <div class="print-row"><span class="print-label">Pay Type:</span> ${data.payType}</div>
                </div>
                <div class="print-row" style="font-size:14px; margin-top:10px;"><span class="print-label">Amount in words:</span> ${data.words}</div>`;
        }
        
        let donationFooter = type === 'donation' ? `<div class="print-footer-text">PAN No.AAATS670J | URN NO.AAATS6070JF20217 | DATE 24-09-2021<br>Donation Exempted under section 80G(5) 180/09-10 Dated: 20/11/2009 of Income Tax Act 1961</div>` : '';
        
        contentHtml += `
            <div class="print-copy">
                <div class="print-copy-type" style="position: absolute; top: 10px; right: 10px; border: 1px solid #000; padding: 3px 8px; font-weight: bold; font-size:11px;">${copyType}</div>
                <div class="print-header" style="position:relative; text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; min-height: 75px;">
                    <img src="${logoUrl}" alt="Logo" style="width:70px; position:absolute; left:10px; top:0;">
                    <div style="margin: 0 90px;">
                        <h2 style="font-size: 18px; margin: 0 0 5px 0;">${orgName}</h2>
                        <p style="font-size: 11px; margin: 2px 0;">${orgAddress}</p>
                        <p style="font-size: 11px; margin: 2px 0;">${orgDetails}</p>
                    </div>
                </div>
                <div class="print-title">${title}</div>
                ${detailsHtml}
                <div class="print-signatures">
                    <div class="sign-box">Payer's Signature</div>
                    <div class="sign-box">Receiver's Signature</div>
                </div>
                ${donationFooter}
            </div>
        `;
    });

    container.innerHTML = `<div class="print-page">${contentHtml}</div>`;
    setTimeout(() => { window.print(); }, 500);
};

window.onload = async () => {
    try {
        setToday();
        await updateDashboardCounts();
        await generateSlipNo('deposit', 'dep-slip');
        await generateSlipNo('donation', 'don-slip');
        await generateSlipNo('invoice', 'inv-slip');
    } catch(err) { }
};
