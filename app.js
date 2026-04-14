// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const logoUrl = "LOGO_URL_HERE"; // Apne logo ka RAW url yaha daale

// --- UI UTILS & EVENT LISTENERS ---
window.toggleMenu = () => { document.querySelector('.sidebar').classList.toggle('active'); };

window.switchTab = (tabId) => {
    // Hide all sections & remove active class from all tabs
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    
    // Show selected section & add active class to selected tab
    document.getElementById(`sec-${tabId}`).classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Close sidebar on mobile after click
    if(window.innerWidth <= 900) toggleMenu();
    
    // Load records if records tab is opened
    if(tabId === 'records') loadRecords();
};

window.checkCustomDonation = () => {
    const val = document.getElementById('don-desc').value;
    document.getElementById('don-custom-desc').style.display = val === 'Custom' ? 'block' : 'none';
};

// Set Today's Date
const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dep-date').value = today;
    document.getElementById('don-date').value = today;
    document.getElementById('inv-date').value = today;
};

// --- NUMBER TO WORDS (INDIAN) ---
window.numToWords = (num, targetId) => {
    if(!num || num == 0) { document.getElementById(targetId).value = ""; return; }
    let a =['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    let b =['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    
    let n = Math.floor(num);
    if(n.toString().length > 9) return document.getElementById(targetId).value = "Limit Exceeded";
    
    let str = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!str) return;
    let words = '';
    words += (str[1] != 0) ? (a[Number(str[1])] || b[str[1][0]] + ' ' + a[str[1][1]]) + 'Crore ' : '';
    words += (str[2] != 0) ? (a[Number(str[2])] || b[str[2][0]] + ' ' + a[str[2][1]]) + 'Lakh ' : '';
    words += (str[3] != 0) ? (a[Number(str[3])] || b[str[3][0]] + ' ' + a[str[3][1]]) + 'Thousand ' : '';
    words += (str[4] != 0) ? (a[Number(str[4])] || b[str[4][0]] + ' ' + a[str[4][1]]) + 'Hundred ' : '';
    words += (str[5] != 0) ? ((words != '') ? 'and ' : '') + (a[Number(str[5])] || b[str[5][0]] + ' ' + a[str[5][1]]) : '';
    
    document.getElementById(targetId).value = words.trim() + " Rupees Only";
};

// --- TAX INVOICE CALCULATOR ---
window.calcInvoice = () => {
    let basic = parseFloat(document.getElementById('inv-basic').value) || 0;
    let cgst = basic * 0.09;
    let sgst = basic * 0.09;
    let exactTotal = basic + cgst + sgst;
    let roundedTotal = Math.round(exactTotal);
    let roundOff = roundedTotal - exactTotal;

    document.getElementById('inv-cgst').value = cgst.toFixed(2);
    document.getElementById('inv-sgst').value = sgst.toFixed(2);
    document.getElementById('inv-total').value = roundedTotal;
    document.getElementById('inv-round').value = roundOff.toFixed(2);
    numToWords(roundedTotal, 'inv-words');
};

// --- AUTO INCREMENT SLIP LOGIC ---
const getFinancialYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0 = Jan, 3 = Apr
    if(month >= 3) return `${year}-${(year+1).toString().slice(2)}`;
    return `${year-1}-${year.toString().slice(2)}`;
};

const generateSlipNo = async (collectionName, targetId) => {
    const fy = getFinancialYear();
    const q = query(collection(db, collectionName), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    
    let lastNum = 0;
    querySnapshot.forEach((doc) => {
        let slipParts = doc.data().slipNo.split('/');
        if(slipParts[1] === fy && parseInt(slipParts[0]) > lastNum){
            lastNum = parseInt(slipParts[0]);
        }
    });
    
    const newNum = String(lastNum + 1).padStart(3, '0');
    document.getElementById(targetId).value = `${newNum}/${fy}`;
};

// --- CRUD OPERATIONS ---
const handleFormSubmit = async (e, type) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    let originalText = btn.innerHTML;
    btn.innerHTML = "<i class='ri-loader-4-line ri-spin'></i> Saving...";
    btn.disabled = true;

    try {
        let data = { timestamp: new Date().toISOString() };
        
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

        const docRef = await addDoc(collection(db, type), data);
        data.id = docRef.id;
        
        e.target.reset();
        setToday();
        updateDashboardCounts();
        await generateSlipNo(type, type==='deposit' ? 'dep-slip' : type==='donation' ? 'don-slip' : 'inv-slip');
        
        printRecord(data, type);

    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Error saving record!");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// Attach Form Submit Listeners safely
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('form-deposit')?.addEventListener('submit', (e) => handleFormSubmit(e, 'deposit'));
    document.getElementById('form-donation')?.addEventListener('submit', (e) => handleFormSubmit(e, 'donation'));
    document.getElementById('form-invoice')?.addEventListener('submit', (e) => handleFormSubmit(e, 'invoice'));
});

// Load Records
window.loadRecords = async () => {
    const type = document.getElementById('record-filter').value;
    const tbody = document.getElementById('records-body');
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'><i class='ri-loader-4-line ri-spin'></i> Loading data...</td></tr>";
    
    try {
        const q = query(collection(db, type), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        tbody.innerHTML = "";
        
        if(querySnapshot.empty) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No records found</td></tr>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            let data = docSnap.data();
            let tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${data.slipNo}</strong></td>
                <td>${data.date}</td>
                <td>${data.name}</td>
                <td style="color:#10B981; font-weight:600;">₹${data.amount || data.total}</td>
                <td>
                    <button class="btn-action btn-print" onclick='rePrint(${JSON.stringify(data)}, "${type}")' title="Print"><i class="ri-printer-line"></i></button>
                    <button class="btn-action btn-del" onclick='deleteRec("${docSnap.id}", "${type}")' title="Delete"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red;'>Error loading data</td></tr>";
        console.error("Load Record Error:", err);
    }
};

// Search Table
window.searchTable = () => {
    let filter = document.getElementById('search-bar').value.toUpperCase();
    let trs = document.getElementById('records-table').getElementsByTagName("tr");
    for (let i = 1; i < trs.length; i++) {
        let td = trs[i].getElementsByTagName("td")[2]; 
        if (td) {
            let txtValue = td.textContent || td.innerText;
            trs[i].style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
        }
    }
};

// Delete Record
window.deleteRec = async (id, type) => {
    if(confirm("Are you sure you want to delete this record?")) {
        try {
            await deleteDoc(doc(db, type, id));
            loadRecords();
            updateDashboardCounts();
        } catch(err) {
            alert("Error deleting record.");
            console.error(err);
        }
    }
};

// Update Dashboard Counts
const updateDashboardCounts = async () => {
    try {
        const deps = await getDocs(collection(db, 'deposit'));
        const dons = await getDocs(collection(db, 'donation'));
        const invs = await getDocs(collection(db, 'invoice'));
        document.getElementById('stat-dep').innerText = deps.size;
        document.getElementById('stat-don').innerText = dons.size;
        document.getElementById('stat-inv').innerText = invs.size;
    } catch (err) {
        console.error("Error fetching counts", err);
    }
};

// --- PRINTING LOGIC ---
window.rePrint = (data, type) => { printRecord(data, type); };

const printRecord = (data, type) => {
    const container = document.getElementById('print-container');
    let title = type === 'deposit' ? 'DEPOSIT SLIP' : type === 'donation' ? 'DONATION RECEIPT' : 'TAX INVOICE';
    
    let contentHtml = '';
    
    ['ORIGINAL', 'DUPLICATE'].forEach(copyType => {
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
                    ${type === 'deposit' ? `
                        <div class="print-row"><span class="print-label">Function:</span> ${data.funcName || '-'}</div>
                        <div class="print-row"><span class="print-label">Func Date:</span> ${data.funcDate || '-'}</div>
                    ` : `
                        <div class="print-row"><span class="print-label">PAN No:</span> ${data.pan || '-'}</div>
                        <div class="print-row"><span class="print-label">Description:</span> ${data.desc || '-'}</div>
                    `}
                    <div class="print-row"><span class="print-label">Pay Type:</span> ${data.payType}</div>
                    <div class="print-row"><span class="print-label">Bank:</span> ${data.bank || '-'}</div>
                    <div class="print-row"><span class="print-label">Ref No:</span> ${data.ref || '-'}</div>
                    <div class="print-row"><span class="print-label">Pay Date:</span> ${data.payDate || '-'}</div>
                </div>
                <div class="print-row" style="font-size:16px;">
                    <span class="print-label">Amount:</span> <strong>₹ ${data.amount}</strong> 
                    <span style="margin-left:15px;">(${data.words})</span>
                </div>
            `;
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
                <div class="print-row" style="font-size:14px; margin-top:10px;">
                    <span class="print-label">Amount in words:</span> ${data.words}
                </div>
            `;
        }

        let donationFooter = type === 'donation' ? `
            <div class="print-footer-text">
                PAN No.AAATS670J | URN NO.AAATS6070JF20217 | DATE 24-09-2021<br>
                Donation to Shree Batrisi Jain Co-Op Education Society Ltd. is Exempted under section 80G(5) 180/09-10 Dated: 20/11/2009 of Income Tax Act 1961 (Renewal)
            </div>
        ` : '';

        // If no Logo URL, hide image tag entirely to avoid broken image icon
        let logoHtml = logoUrl !== "LOGO_URL_HERE" ? `<img src="${logoUrl}" alt="Logo">` : ``;

        contentHtml += `
            <div class="print-copy">
                <div class="print-copy-type">${copyType}</div>
                <div class="print-header">
                    ${logoHtml}
                    <h2>${orgName}</h2>
                    <p>${orgAddress}</p>
                    <p>${orgDetails}</p>
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
    
    setTimeout(() => {
        window.print();
    }, 500);
};

// --- INIT CALLS ---
window.onload = async () => {
    try {
        setToday();
        await updateDashboardCounts();
        await generateSlipNo('deposit', 'dep-slip');
        await generateSlipNo('donation', 'don-slip');
        await generateSlipNo('invoice', 'inv-slip');
        console.log("App loaded successfully!");
    } catch(err) {
        console.error("Initialization error: ", err);
    }
};
