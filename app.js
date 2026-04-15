import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, getDoc, query, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbZ4T8264CDQ5LSoH_4L0luB5VKQbiqkU",
  authDomain: "batrisi-latest-app.firebaseapp.com",
  projectId: "batrisi-latest-app",
  storageBucket: "batrisi-latest-app.firebasestorage.app",
  messagingSenderId: "175592360155",
  appId: "1:175592360155:web:ba95f9aba4558fda9d64fe"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ORG = {
    name: "Shree Batrisi Jain Co-Op Education Society Ltd",
    addr: "Near R.T.O Circle, Subhashbridge, Ahmedabad - 380027",
    meta1: "GSTIN: 24AAATS6070J1ZE | Reg No: GH/230",
    meta2: "Mob: 9586423232 | Email: 32cedusociety@gmail.com"
};

// --- HELPERS ---
const fmtAmt = (val) => parseFloat(val || 0).toFixed(2);
const fmtDate = (str) => str ? str.split('-').reverse().join('/') : '-';

const getFY = () => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() > 2 ? `${y}-${(y+1).toString().slice(2)}` : `${y-1}-${y.toString().slice(2)}`;
};

const genSlip = async (type, id) => {
    const fy = getFY();
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    let max = 0;
    snap.forEach(d => {
        let n = parseInt(d.data().slipNo.split('/')[1]);
        if(n > max) max = n;
    });
    const next = String(max + 1).padStart(3, '0');
    const prefix = type === 'donation' ? 'D' : (type === 'invoice' ? 'INV' : 'DEP');
    document.getElementById(id).value = `${prefix}/${next}/${fy}`;
};

// --- FORM SUBMIT ---
window.handleFormSubmit = async (e, type) => {
    const prefix = type.slice(0, 3);
    const btn = document.getElementById(`btn-submit-${prefix}`);
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        let data = { timestamp: new Date().toISOString() };
        if(type === 'deposit') {
            data = { ...data, 
                slipNo: document.getElementById('dep-slip').value, date: document.getElementById('dep-date').value,
                member: document.getElementById('dep-member').value, name: document.getElementById('dep-name').value,
                address: document.getElementById('dep-address').value, mobile: document.getElementById('dep-mobile').value,
                native: document.getElementById('dep-native').value, funcName: document.getElementById('dep-func-name').value,
                funcDate: document.getElementById('dep-func-date').value, shift: document.getElementById('dep-shift').value,
                payType: document.getElementById('dep-pay-type').value, payDate: document.getElementById('dep-pay-date').value,
                ref: document.getElementById('dep-ref').value, bank: document.getElementById('dep-bank').value,
                amount: fmtAmt(document.getElementById('dep-amount').value), words: document.getElementById('dep-words').value
            };
        } else if(type === 'donation') {
            const descVal = document.getElementById('don-desc').value;
            data = { ...data,
                slipNo: document.getElementById('don-slip').value, date: document.getElementById('don-date').value,
                name: document.getElementById('don-name').value, address: document.getElementById('don-address').value,
                pan: document.getElementById('don-pan').value, 
                desc: descVal === 'Custom' ? document.getElementById('don-custom-desc').value : descVal,
                amount: fmtAmt(document.getElementById('don-amount').value), words: document.getElementById('don-words').value
            };
        } else if(type === 'invoice') {
            const descVal = document.getElementById('inv-desc-select').value;
            data = { ...data,
                slipNo: document.getElementById('inv-slip').value, date: document.getElementById('inv-date').value,
                name: document.getElementById('inv-name').value, gst: document.getElementById('inv-gst').value,
                desc: descVal === 'Custom' ? document.getElementById('inv-custom-desc').value : descVal,
                basic: fmtAmt(document.getElementById('inv-basic').value), 
                cgst: document.getElementById('inv-cgst').value, sgst: document.getElementById('inv-sgst').value,
                total: fmtAmt(document.getElementById('inv-total').value), words: document.getElementById('inv-words').value
            };
        }

        const editId = document.getElementById(`${prefix}-edit-id`).value;
        if(editId) await updateDoc(doc(db, type, editId), data);
        else await addDoc(collection(db, type), data);

        alert("Success!");
        document.getElementById(`form-${type}`).reset();
        printRec(data, type);
        init();
    } catch (err) { alert("Error!"); console.error(err); }
    finally { btn.innerText = "Save & Print"; btn.disabled = false; }
};

// --- PRINT LOGIC ---
const printRec = (data, type) => {
    const container = document.getElementById('print-container');
    let html = '';
    const copies = ['ORIGINAL COPY', 'OFFICE COPY'];

    copies.forEach((copy, idx) => {
        let fields = '';
        if(type === 'deposit') {
            fields = `
                <div class="print-grid">
                    <div class="print-row"><span class="print-label">Slip No:</span>${data.slipNo}</div>
                    <div class="print-row"><span class="print-label">Date:</span>${fmtDate(data.date)}</div>
                    <div class="print-row"><span class="print-label">Member No:</span>${data.member || '-'}</div>
                    <div class="print-row"><span class="print-label">Name:</span>${data.name}</div>
                    <div class="print-row"><span class="print-label">Address:</span>${data.address || '-'}</div>
                    <div class="print-row"><span class="print-label">Mobile:</span>${data.mobile || '-'}</div>
                    <div class="print-row"><span class="print-label">Function:</span>${data.funcName || '-'}</div>
                    <div class="print-row"><span class="print-label">Func Date:</span>${fmtDate(data.funcDate)}</div>
                    <div class="print-row" style="grid-column:span 2"><span class="print-label">Shift:</span>${data.shift}</div>
                    <div class="print-row"><span class="print-label">Pay Type:</span>${data.payType}</div>
                    <div class="print-row"><span class="print-label">Pay Date:</span>${fmtDate(data.payDate)}</div>
                    <div class="print-row"><span class="print-label">Ref/Bank:</span>${data.ref} / ${data.bank}</div>
                    <div class="print-row"><span class="print-label">Amount:</span><strong>₹ ${data.amount}</strong></div>
                </div>`;
        } else if(type === 'donation') {
            fields = `
                <div class="print-grid">
                    <div class="print-row"><span class="print-label">Slip No:</span>${data.slipNo}</div>
                    <div class="print-row"><span class="print-label">Date:</span>${fmtDate(data.date)}</div>
                    <div class="print-row"><span class="print-label">Name:</span>${data.name}</div>
                    <div class="print-row"><span class="print-label">PAN:</span>${data.pan || '-'}</div>
                    <div class="print-row" style="grid-column:span 2"><span class="print-label">Description:</span>${data.desc}</div>
                    <div class="print-row"><span class="print-label">Amount:</span><strong>₹ ${data.amount}</strong></div>
                </div>
                <p style="text-align:center; font-style:italic; margin: 10px 0; font-size:12px;">"Thank you for your generous donation. Your support is greatly appreciated."</p>`;
        } else {
            fields = `
                <div class="print-grid">
                    <div class="print-row"><span class="print-label">Invoice No:</span>${data.slipNo}</div>
                    <div class="print-row"><span class="print-label">Date:</span>${fmtDate(data.date)}</div>
                    <div class="print-row"><span class="print-label">Name:</span>${data.name}</div>
                    <div class="print-row"><span class="print-label">GSTIN:</span>${data.gst || '-'}</div>
                    <div class="print-row" style="grid-column:span 2"><span class="print-label">Description:</span>${data.desc}</div>
                    <div class="print-row"><span class="print-label">Basic Amount:</span>₹ ${data.basic}</div>
                    <div class="print-row"><span class="print-label">CGST (0.9%):</span>₹ ${data.cgst}</div>
                    <div class="print-row"><span class="print-label">SGST (0.9%):</span>₹ ${data.sgst}</div>
                    <div class="print-row"><span class="print-label">Total:</span><strong>₹ ${data.total}</strong></div>
                </div>`;
        }

        html += `
            <div class="print-copy">
                <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:5px;">
                    <div style="position:absolute; right:20px; font-size:10px; border:1px solid #000; padding:2px;">${copy}</div>
                    <h2 style="margin:0">${ORG.name}</h2>
                    <p style="font-size:11px; margin:2px 0;">${ORG.addr}</p>
                    <p style="font-size:10px; margin:0;">${ORG.meta1} | ${ORG.meta2}</p>
                </div>
                <h3 style="text-align:center; text-decoration:underline; margin:10px 0;">${type.toUpperCase()} SLIP</h3>
                ${fields}
                <div style="font-size:11px; margin:10px 0;"><strong>Words:</strong> ${data.words}</div>
                <div style="display:flex; justify-content:space-between; margin-top:40px;">
                    <div style="border-top:1px solid #000; width:150px; text-align:center;">Authorized Signatory</div>
                    <div style="border-top:1px solid #000; width:150px; text-align:center;">Receiver's Signature</div>
                </div>
            </div>`;
        if(idx === 0) html += `<div style="border-top:1px dashed #999; margin:20px 0; text-align:center; font-size:10px;">✂ Cut Here</div>`;
    });

    container.innerHTML = html;
    setTimeout(() => { window.print(); }, 500);
};

// --- CORE FUNCTIONS ---
window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const body = document.getElementById('records-body');
    body.innerHTML = 'Loading...';
    const q = query(collection(db, type), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    body.innerHTML = '';
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.slipNo}</td><td>${fmtDate(d.date)}</td><td>${d.name}</td><td>₹ ${d.amount || d.total}</td>
            <td>
                <button class="btn-action btn-print" onclick='window.rePrint(${JSON.stringify(d)}, "${type}")'><i class="ri-printer-line"></i></button>
                <button class="btn-action btn-del" onclick='window.deleteRec("${docSnap.id}", "${type}")'><i class="ri-delete-bin-line"></i></button>
            </td>`;
        body.appendChild(tr);
    });
};

window.rePrint = (data, type) => printRec(data, type);
window.deleteRec = async (id, type) => { if(confirm("Delete?")) { await deleteDoc(doc(db, type, id)); window.loadRecords(); } };

window.fetchMember = async (inId, nameId, addrId, natId) => {
    const val = document.getElementById(inId).value;
    if(!val) return;
    const snap = await getDoc(doc(db, "members", val));
    if(snap.exists()) {
        const d = snap.data();
        document.getElementById(nameId).value = d.name;
        document.getElementById(addrId).value = d.address;
        document.getElementById(natId).value = d.native || '';
    }
};

window.uploadCSV = async () => {
    const file = document.getElementById('csv-upload').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const rows = e.target.result.split('\n');
        const batch = writeBatch(db);
        rows.forEach(row => {
            const cols = row.split(',');
            if(cols[0]) batch.set(doc(db, "members", cols[0].trim()), { name: cols[1]?.trim(), address: cols[2]?.trim() });
        });
        await batch.commit();
        alert("Upload Done");
    };
    reader.readAsText(file);
};

const init = () => {
    genSlip('deposit', 'dep-slip');
    genSlip('donation', 'don-slip');
    genSlip('invoice', 'inv-slip');
    const today = new Date().toISOString().split('T')[0];
    ['dep-date', 'don-date', 'inv-date'].forEach(id => document.getElementById(id).value = today);
};

init();
