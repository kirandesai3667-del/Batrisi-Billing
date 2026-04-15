import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    meta: "GSTIN: 24AAATS6070J1ZE | Mob: 9586423232"
};

// --- Formatters ---
const fDate = (d) => d ? d.split('-').reverse().join('/') : '-';
const fAmt = (v) => parseFloat(v || 0).toFixed(2);

const getFY = () => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() > 2 ? `${y}-${(y+1).toString().slice(2)}` : `${y-1}-${y.toString().slice(2)}`;
};

async function genSlip(type, id) {
    const fy = getFY();
    const snap = await getDocs(query(collection(db, type), orderBy("timestamp", "desc")));
    let max = 0;
    snap.forEach(d => {
        const parts = d.data().slipNo.split('/');
        const num = parseInt(parts[1]); // Index 1 is the sequence
        if(num > max) max = num;
    });
    const next = String(max + 1).padStart(3, '0');
    const prefix = type === 'donation' ? 'D' : (type === 'invoice' ? 'INV' : 'DEP');
    document.getElementById(id).value = `${prefix}/${next}/${fy}`;
}

window.handleFormSubmit = async (e, type) => {
    const pre = type.slice(0, 3);
    const btn = document.getElementById(`btn-submit-${pre}`);
    btn.disabled = true;

    let data = { timestamp: new Date().toISOString() };
    if(type === 'deposit') {
        data = { ...data, 
            slipNo: document.getElementById('dep-slip').value, date: document.getElementById('dep-date').value,
            name: document.getElementById('dep-name').value, member: document.getElementById('dep-member').value,
            mobile: document.getElementById('dep-mobile').value, address: document.getElementById('dep-address').value,
            native: document.getElementById('dep-native').value, funcName: document.getElementById('dep-func-name').value,
            funcDate: document.getElementById('dep-func-date').value, shift: document.getElementById('dep-shift').value,
            payType: document.getElementById('dep-pay-type').value, payDate: document.getElementById('dep-pay-date').value,
            ref: document.getElementById('dep-ref').value, bank: document.getElementById('dep-bank').value,
            amount: fAmt(document.getElementById('dep-amount').value), words: document.getElementById('dep-words').value
        };
    } else if(type === 'donation') {
        const dVal = document.getElementById('don-desc').value;
        data = { ...data,
            slipNo: document.getElementById('don-slip').value, date: document.getElementById('don-date').value,
            name: document.getElementById('don-name').value, pan: document.getElementById('don-pan').value,
            desc: dVal === 'Other' ? document.getElementById('don-custom').value : dVal,
            amount: fAmt(document.getElementById('don-amount').value), words: document.getElementById('don-words').value
        };
    } else {
        const dVal = document.getElementById('inv-desc-select').value;
        data = { ...data,
            slipNo: document.getElementById('inv-slip').value, date: document.getElementById('inv-date').value,
            name: document.getElementById('inv-name').value, gst: document.getElementById('inv-gst').value,
            desc: dVal === 'Other' ? document.getElementById('inv-custom').value : dVal,
            basic: fAmt(document.getElementById('inv-basic').value), cgst: document.getElementById('inv-cgst').value,
            sgst: document.getElementById('inv-sgst').value, total: fAmt(document.getElementById('inv-total').value), words: document.getElementById('inv-words').value
        };
    }

    await addDoc(collection(db, type), data);
    alert("Saved Successfully!");
    printRec(data, type);
    location.reload();
};

const printRec = (data, type) => {
    const cont = document.getElementById('print-container');
    let body = '';
    const copies = ['ORIGINAL', 'DUPLICATE'];

    copies.forEach((c) => {
        let rows = '';
        if(type === 'deposit') {
            rows = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Slip No:</span><span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span><span class="print-val">${fDate(data.date)}</span></div>
                <div class="print-row"><span class="print-label">Member No:</span><span class="print-val">${data.member||'-'}</span></div>
                <div class="print-row"><span class="print-label">Mobile:</span><span class="print-val">${data.mobile||'-'}</span></div>
                <div class="print-row" style="grid-column:span 2"><span class="print-label">Name:</span><span class="print-val">${data.name}</span></div>
                <div class="print-row" style="grid-column:span 2"><span class="print-label">Address:</span><span class="print-val">${data.address||'-'}</span></div>
                <div class="print-row"><span class="print-label">Function:</span><span class="print-val">${data.funcName||'-'}</span></div>
                <div class="print-row"><span class="print-label">Func Date:</span><span class="print-val">${fDate(data.funcDate)}</span></div>
                <div class="print-row" style="grid-column:span 2"><span class="print-label">Shift:</span><span class="print-val">${data.shift}</span></div>
                <div class="print-row"><span class="print-label">Ref No:</span><span class="print-val">${data.ref||'-'}</span></div>
                <div class="print-row"><span class="print-label">Bank:</span><span class="print-val">${data.bank||'-'}</span></div>
                <div class="print-row"><span class="print-label">Pay Date:</span><span class="print-val">${fDate(data.payDate)}</span></div>
                <div class="print-row"><span class="print-label">Amount:</span><span class="print-val"><strong>₹ ${data.amount}</strong></span></div>
            </div>`;
        } else if(type === 'donation') {
            rows = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Slip No:</span><span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span><span class="print-val">${fDate(data.date)}</span></div>
                <div class="print-row" style="grid-column:span 2"><span class="print-label">Name:</span><span class="print-val">${data.name}</span></div>
                <div class="print-row"><span class="print-label">PAN:</span><span class="print-val">${data.pan||'-'}</span></div>
                <div class="print-row"><span class="print-label">Description:</span><span class="print-val">${data.desc}</span></div>
                <div class="print-row"><span class="print-label">Amount:</span><span class="print-val"><strong>₹ ${data.amount}</strong></span></div>
            </div>
            <p style="text-align:center; font-size:11px; margin-top:10px;">"Thank you for your generous donation. Your support is greatly appreciated."</p>`;
        } else {
            rows = `
            <div class="print-grid">
                <div class="print-row"><span class="print-label">Invoice No:</span><span class="print-val">${data.slipNo}</span></div>
                <div class="print-row"><span class="print-label">Date:</span><span class="print-val">${fDate(data.date)}</span></div>
                <div class="print-row"><span class="print-label">GSTIN:</span><span class="print-val">${data.gst||'-'}</span></div>
                <div class="print-row"><span class="print-label">Description:</span><span class="print-val">${data.desc}</span></div>
                <div class="print-row"><span class="print-label">Basic:</span><span class="print-val">₹ ${data.basic}</span></div>
                <div class="print-row"><span class="print-label">CGST (0.9%):</span><span class="print-val">₹ ${data.cgst}</span></div>
                <div class="print-row"><span class="print-label">SGST (0.9%):</span><span class="print-val">₹ ${data.sgst}</span></div>
                <div class="print-row"><span class="print-label">Total:</span><span class="print-val"><strong>₹ ${data.total}</strong></span></div>
            </div>`;
        }

        body += `
        <div class="print-copy">
            <span class="print-copy-type">${c}</span>
            <div style="text-align:center; position:relative;">
                <img src="logo.png" style="width:50px; position:absolute; left:0; top:0;">
                <h2 style="margin:0">${ORG.name}</h2>
                <p style="font-size:11px; margin:2px 0;">${ORG.addr}</p>
                <p style="font-size:10px; margin:0;">${ORG.meta}</p>
            </div>
            <h3 style="text-align:center; text-decoration:underline; margin:10px 0;">${type.toUpperCase()}</h3>
            ${rows}
            <div style="font-size:11px; margin-top:5px;"><strong>Words:</strong> ${data.words}</div>
            <div style="display:flex; justify-content:space-between; margin-top:50px;">
                <div style="border-top:1px solid #000; width:150px; text-align:center; font-size:11px;">Payer Signature</div>
                <div style="border-top:1px solid #000; width:150px; text-align:center; font-size:11px;">Receiver Signature</div>
            </div>
        </div><div style="border-top:1px dashed #999; margin:15px 0; text-align:center; font-size:9px;">✂ Cut Here</div>`;
    });
    cont.innerHTML = body;
    setTimeout(()=>window.print(), 500);
};

window.loadRecords = async () => {
    const t = document.getElementById('record-filter').value;
    const snap = await getDocs(query(collection(db, t), orderBy("timestamp", "desc")));
    const body = document.getElementById('records-body');
    body.innerHTML = '';
    snap.forEach(d => {
        const row = d.data();
        body.innerHTML += `<tr><td>${row.slipNo}</td><td>${fDate(row.date)}</td><td>${row.name}</td><td>₹ ${row.amount||row.total}</td>
        <td><button class="btn-action btn-print" onclick='window.rePrint(${JSON.stringify(row)}, "${t}")'><i class="ri-printer-line"></i></button></td></tr>`;
    });
};

window.rePrint = (data, type) => printRec(data, type);

window.fetchMember = async (id, name, addr, nat) => {
    const v = document.getElementById(id).value;
    if(!v) return;
    const snap = await getDoc(doc(db, "members", v));
    if(snap.exists()) {
        const d = snap.data();
        document.getElementById(name).value = d.name;
        document.getElementById(addr).value = d.address;
        document.getElementById(nat).value = d.native||'';
    }
};

const init = () => {
    genSlip('deposit', 'dep-slip');
    genSlip('donation', 'don-slip');
    genSlip('invoice', 'inv-slip');
    const today = new Date().toISOString().split('T')[0];
    ['dep-date','don-date','inv-date'].forEach(i => document.getElementById(i).value = today);
};
init();
