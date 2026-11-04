import { auth, db, configured, setupBanner, esc, safeUrl, money, fmtDate, ms, statusClass, friendlyError } from "./fb.js";
import { ADMIN_EMAIL, STATUSES, SERVICES } from "./config.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, serverTimestamp, runTransaction, Timestamp, getDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const msg = $("#msg");
const say = (t, ok) => { msg.textContent = t; msg.className = "msg show " + (ok ? "ok" : "err"); };
const clearMsg = () => { msg.className = "msg"; msg.textContent = ""; };

let users = [], orders = [], quotes = [];
let view = "dash";
const F = { oq: "", ostatus: "all", cq: "" };
const DAY = 864e5;

if (!configured) {
  setupBanner();
} else {
  onAuthStateChanged(auth, (u) => {
    if (!u) { location.replace("login.html"); return; }
    if ((u.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { location.replace("portal.html"); return; }
    if (!u.emailVerified) { gate(u); return; }
    $("#gate").hidden = true;
    $("#app").hidden = false;
    $("#whoEmail").textContent = u.email;
    start();
  });
}

function gate(u) {
  const g = $("#gate");
  g.hidden = false;
  g.innerHTML = `<div class="card"><h3>Confirm your email first</h3>
    <p>The admin panel opens only after this email is confirmed: <b>${esc(u.email)}</b>. Open the confirmation link we emailed you, then press the button.</p>
    <div class="row"><button class="btn btn-solid sm" id="gRe" type="button">I have confirmed</button>
    <button class="btn btn-outline sm dark" id="gSend" type="button">Resend email</button>
    <button class="btn btn-outline sm dark" id="gOut" type="button">Log out</button></div></div>`;
  $("#gRe").onclick = async () => { await u.reload(); await u.getIdToken(true); location.reload(); };
  $("#gSend").onclick = async () => { try { await sendEmailVerification(u); alert("Email sent. Check inbox and spam."); } catch (e) { alert(friendlyError(e)); } };
  $("#gOut").onclick = async () => { await signOut(auth); location.replace("login.html"); };
}

$("#logoutBtn").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });

let started = false;
function start() {
  if (started) return; started = true;
  const err = (e) => say(friendlyError(e), false);
  onSnapshot(collection(db, "users"), s => { users = s.docs.map(d => ({ uid: d.id, ...d.data() })); render(); }, err);
  onSnapshot(collection(db, "orders"), s => { orders = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)); render(); }, err);
  onSnapshot(collection(db, "quotes"), s => { quotes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)); render(); }, err);
}

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => { view = t.dataset.view; clearMsg(); render(); }));

/* ---------- calculations ---------- */
const bal = (o) => o.status === "Cancelled" ? 0 : Math.max(0, (Number(o.price) || 0) - (Number(o.paid) || 0));
const monthsLabel = (since) => {
  if (!since) return "—";
  const m = Math.floor((Date.now() - since) / (30 * DAY));
  return m < 1 ? "< 1 mo" : m + " mo";
};
function clientStats(u) {
  const os = orders.filter(o => o.uid === u.uid);
  const live = os.filter(o => o.status !== "Cancelled");
  const billed = live.reduce((a, o) => a + (Number(o.price) || 0), 0);
  const paid = live.reduce((a, o) => a + Math.min(Number(o.paid) || 0, Number(o.price) || 0), 0);
  const unpaid = live.filter(o => bal(o) > 0.004 && Number(o.price) > 0);
  const since = unpaid.length ? Math.min(...unpaid.map(o => ms(o.createdAt))) : 0;
  return { os, count: os.length, billed, paid, pending: unpaid.reduce((a, o) => a + bal(o), 0), since };
}

/* ---------- rendering ---------- */
function render() {
  if ($("#app").hidden) return;
  const a = document.activeElement;
  const keep = a && a.id && (a.tagName === "INPUT" || a.tagName === "SELECT") ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;

  const newOrders = orders.filter(o => o.status === "New").length;
  const newQuotes = quotes.filter(q => q.status !== "done").length;
  $("#pOrders").textContent = newOrders || ""; $("#pOrders").hidden = !newOrders;
  $("#pQuotes").textContent = newQuotes || ""; $("#pQuotes").hidden = !newQuotes;

  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  ["dash", "orders", "clients", "quotes", "import"].forEach(v => { $("#v-" + v).hidden = v !== view; });
  ({ dash: rDash, orders: rOrders, clients: rClients, quotes: rQuotes, import: rImport })[view]();

  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
}

const orderRow = (o) => `<tr class="click" data-order="${esc(o.id)}">
  <td>#${esc(o.id.slice(0, 6).toUpperCase())}</td><td>${fmtDate(o.createdAt)}</td>
  <td>${esc(o.clientName)}<small>${esc(o.clientId)}</small></td><td>${esc(o.service)}</td><td>${esc(o.title)}</td>
  <td><span class="badge ${statusClass(o.status)}">${esc(o.status)}</span></td>
  <td class="num">${Number(o.price) ? money(o.price) : "—"}</td><td class="num">${money(o.paid)}</td>
  <td class="num ${bal(o) > 0 && Number(o.price) ? "due" : ""}">${Number(o.price) ? money(bal(o)) : "—"}</td></tr>`;
const ORDER_HEAD = "<thead><tr><th>Order</th><th>Date</th><th>Client</th><th>Service</th><th>Job</th><th>Status</th><th class='num'>Price</th><th class='num'>Paid</th><th class='num'>Balance</th></tr></thead>";

function rDash() {
  const rows = users.map(u => ({ u, s: clientStats(u) }));
  const billed = rows.reduce((a, r) => a + r.s.billed, 0), paid = rows.reduce((a, r) => a + r.s.paid, 0), pending = rows.reduce((a, r) => a + r.s.pending, 0);
  const owing = rows.filter(r => r.s.pending > 0).sort((x, y) => y.s.pending - x.s.pending).slice(0, 8);
  $("#v-dash").innerHTML = `
    <div class="stats">
      <div class="stat"><span>Clients</span><b>${users.length}</b></div>
      <div class="stat"><span>New Orders</span><b>${orders.filter(o => o.status === "New").length}</b></div>
      <div class="stat"><span>In Progress</span><b>${orders.filter(o => o.status === "In Progress").length}</b></div>
      <div class="stat"><span>New Quote Requests</span><b>${quotes.filter(q => q.status !== "done").length}</b></div>
      <div class="stat"><span>Total Billed</span><b>${money(billed)}</b></div>
      <div class="stat"><span>Collected</span><b>${money(paid)}</b></div>
      <div class="stat ${pending > 0 ? "warn" : ""}"><span>Payment Pending</span><b>${money(pending)}</b></div>
    </div>
    <h3 class="sec">Latest Orders</h3>
    <div class="tbl-wrap"><table class="tbl">${ORDER_HEAD}<tbody>${orders.slice(0, 8).map(orderRow).join("") || '<tr><td colspan="9" class="empty">No orders yet.</td></tr>'}</tbody></table></div>
    <h3 class="sec">Clients With Pending Payment</h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Phone</th><th class="num">Pending</th><th>Pending For</th></tr></thead><tbody>
    ${owing.map(r => `<tr class="click" data-client="${esc(r.u.uid)}"><td>${esc(r.u.name)}<small>${esc(r.u.clientId)}</small></td><td>${esc(r.u.phone)}</td><td class="num due">${money(r.s.pending)}</td><td>${monthsLabel(r.s.since)}</td></tr>`).join("") || '<tr><td colspan="4" class="empty">Nobody owes anything.</td></tr>'}
    </tbody></table></div>`;
}

function rOrders() {
  const q = F.oq.toLowerCase();
  const list = orders.filter(o => (F.ostatus === "all" || o.status === F.ostatus) &&
    (!q || [o.clientName, o.clientId, o.clientEmail, o.title, o.service, o.id].join(" ").toLowerCase().includes(q)));
  $("#v-orders").innerHTML = `
    <div class="toolbar">
      <input id="oq" type="search" placeholder="Search client, job, order #..." value="${esc(F.oq)}">
      <select id="ost"><option value="all">All statuses</option>${STATUSES.map(s => `<option ${F.ostatus === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <span class="muted">${list.length} order(s)</span>
      <button class="btn btn-solid sm" id="addOrder" type="button">+ Add Order</button>
    </div>
    <div class="tbl-wrap"><table class="tbl">${ORDER_HEAD}<tbody>${list.map(orderRow).join("") || '<tr><td colspan="9" class="empty">No orders found.</td></tr>'}</tbody></table></div>`;
  $("#addOrder").onclick = () => openOrderForm();
  $("#oq").oninput = (e) => { F.oq = e.target.value; render(); };
  $("#ost").onchange = (e) => { F.ostatus = e.target.value; render(); };
}

function rClients() {
  const q = F.cq.toLowerCase();
  const rows = users.map(u => ({ u, s: clientStats(u) }))
    .filter(r => !q || [r.u.name, r.u.email, r.u.clientId, r.u.phone, r.u.work, r.u.address].join(" ").toLowerCase().includes(q))
    .sort((a, b) => ms(b.u.createdAt) - ms(a.u.createdAt));
  $("#v-clients").innerHTML = `
    <div class="toolbar"><input id="cq" type="search" placeholder="Search name, email, phone, ID..." value="${esc(F.cq)}"><span class="muted">${rows.length} client(s)</span><button class="btn btn-solid sm" id="addClient" type="button">+ Add Client</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Work</th><th class="num">Orders</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Pending</th><th>Pending For</th></tr></thead><tbody>
    ${rows.map(({ u, s }) => `<tr class="click" data-client="${esc(u.uid)}"><td>${esc(u.clientId)}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${esc(u.address)}</td><td>${esc(u.work)}</td>
      <td class="num">${s.count}</td><td class="num">${money(s.billed)}</td><td class="num">${money(s.paid)}</td><td class="num ${s.pending > 0 ? "due" : ""}">${money(s.pending)}</td><td>${monthsLabel(s.since)}</td></tr>`).join("") || '<tr><td colspan="11" class="empty">No clients yet.</td></tr>'}
    </tbody></table></div>`;
  $("#addClient").onclick = () => openClientForm();
  $("#cq").oninput = (e) => { F.cq = e.target.value; render(); };
}

function rQuotes() {
  $("#v-quotes").innerHTML = quotes.length ? quotes.map(q => `
    <article class="card order ${q.status === "done" ? "done" : ""}">
      <div class="order-top"><div><h3>${esc(q.name)}${q.company ? ` <small>(${esc(q.company)})</small>` : ""}</h3>
        <p class="muted"><a href="mailto:${esc(q.email)}">${esc(q.email)}</a> &middot; ${fmtDate(q.createdAt)}</p></div>
        <span class="badge ${q.status === "done" ? "st-delivered" : "st-new"}">${q.status === "done" ? "Handled" : "New"}</span></div>
      <p class="desc">${esc(q.details)}</p>
      <div class="row"><button class="btn btn-outline sm dark" data-qtoggle="${esc(q.id)}" type="button">${q.status === "done" ? "Mark as new" : "Mark as handled"}</button>
        <button class="btn btn-outline sm dark danger" data-qdel="${esc(q.id)}" type="button">Delete</button></div>
    </article>`).join("") : '<div class="empty card">No quote requests yet.</div>';
}

/* ---------- modal ---------- */
const modal = $("#modal");
const openModal = (html) => { $("#modalBody").innerHTML = html; modal.hidden = false; };
const closeModal = () => { modal.hidden = true; $("#modalBody").innerHTML = ""; };
$("#modalX").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function openOrder(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  const u = users.find(x => x.uid === o.uid) || {};
  const files = (o.files || []).map(f => `<a href="${safeUrl(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join("");
  openModal(`
    <p class="ono">#${esc(o.id.slice(0, 6).toUpperCase())}</p><h2 class="mt">${esc(o.title)}</h2>
    <div class="kv">
      <div><span>Client</span><b>${esc(o.clientName)} (${esc(o.clientId)})</b></div>
      <div><span>Email</span><b><a href="mailto:${esc(o.clientEmail)}">${esc(o.clientEmail)}</a></b></div>
      <div><span>Phone</span><b>${esc(u.phone || "—")}</b></div>
      <div><span>Service</span><b>${esc(o.service)}</b></div>
      <div><span>Quantity</span><b>${esc(o.quantity)}</b></div>
      <div><span>Deadline</span><b>${esc(o.deadline || "—")}</b></div>
      <div><span>Size / placement</span><b>${esc(o.size || "—")}</b></div>
      <div><span>Garment</span><b>${esc(o.garment || "—")}</b></div>
      <div><span>Placed</span><b>${fmtDate(o.createdAt)}</b></div>
    </div>
    <p class="desc">${esc(o.description)}</p>
    ${files || o.link ? `<div class="files">${files}${o.link ? `<a href="${safeUrl(o.link)}" target="_blank" rel="noopener">Shared link</a>` : ""}</div>` : '<p class="muted">No files attached.</p>'}
    <form class="pform edit" id="orderEdit" data-id="${esc(o.id)}">
      <div class="grid2">
        <label>Status<select name="status">${STATUSES.map(s => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <label>Price (USD)<input type="number" name="price" min="0" step="0.01" value="${Number(o.price) || 0}"></label>
        <label>Paid so far (USD)<input type="number" name="paid" min="0" step="0.01" value="${Number(o.paid) || 0}"></label>
        <label>Balance<input type="text" id="balOut" disabled value="${money(bal(o))}"></label>
      </div>
      <label>Message to client (shown in their panel)<textarea name="adminNote" rows="2" maxlength="1000">${esc(o.adminNote || "")}</textarea></label>
      <div class="row"><button class="btn btn-solid" type="submit">Save</button>
        <button class="btn btn-outline dark" type="button" id="markPaid">Mark fully paid</button>
        <button class="btn btn-outline sm danger" type="button" id="delOrder">Delete order</button></div>
      <p class="msg" id="mmsg"></p>
    </form>`);
  const f = $("#orderEdit");
  const upd = () => { $("#balOut").value = money(Math.max(0, (Number(f.price.value) || 0) - (Number(f.paid.value) || 0))); };
  f.price.oninput = upd; f.paid.oninput = upd;
  $("#delOrder").onclick = async () => {
    if (!confirm("Delete this order permanently?")) return;
    try { await deleteDoc(doc(db, "orders", o.id)); closeModal(); say("Order deleted.", true); } catch (err) { say(friendlyError(err), false); }
  };
  $("#markPaid").onclick = () => { f.paid.value = f.price.value || 0; upd(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const m = $("#mmsg"), price = Number(f.price.value), paid = Number(f.paid.value);
    if (!(price >= 0) || !(paid >= 0)) { m.textContent = "Price and paid must be 0 or more."; m.className = "msg show err"; return; }
    try {
      await updateDoc(doc(db, "orders", f.dataset.id), { status: f.status.value, price, paid, adminNote: f.adminNote.value.trim(), updatedAt: serverTimestamp() });
      closeModal(); say("Order updated.", true);
    } catch (err) { m.textContent = friendlyError(err); m.className = "msg show err"; }
  };
}

function openClient(uid) {
  const u = users.find(x => x.uid === uid); if (!u) return;
  const s = clientStats(u);
  openModal(`
    <p class="ono">${esc(u.clientId)}</p><h2 class="mt">${esc(u.name)}</h2>
    <div class="kv">
      <div><span>Email</span><b><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></b></div>
      <div><span>Phone</span><b>${esc(u.phone || "—")}</b></div>
      <div><span>Work</span><b>${esc(u.work || "—")}</b></div>
      <div><span>Address</span><b>${esc(u.address || "—")}</b></div>
      <div><span>Joined</span><b>${fmtDate(u.createdAt)}</b></div>
      <div><span>Orders</span><b>${s.count}</b></div>
      <div><span>Total billed</span><b>${money(s.billed)}</b></div>
      <div><span>Paid</span><b>${money(s.paid)}</b></div>
      <div><span>Pending</span><b class="${s.pending > 0 ? "due" : ""}">${money(s.pending)} ${s.pending > 0 ? `(${monthsLabel(s.since)})` : ""}</b></div>
    </div>
    <div class="row"><button class="btn btn-solid sm" id="cAddOrder" type="button">+ Add order for this client</button>
      <button class="btn btn-outline sm dark" id="cEdit" type="button">Edit details</button></div>
    <h3 class="sec">Orders</h3>
    <div class="tbl-wrap"><table class="tbl">${ORDER_HEAD}<tbody>${s.os.map(orderRow).join("") || '<tr><td colspan="9" class="empty">No orders.</td></tr>'}</tbody></table></div>`);
  $("#cAddOrder").onclick = () => openOrderForm(u.uid);
  $("#cEdit").onclick = () => openClientForm(u);
}

/* ---------- add / edit client and order (manual entry) ---------- */
function openClientForm(u) {
  const v = u || {};
  openModal(`
    <h2 class="mt">${u ? "Edit client" : "Add client"}</h2>
    <form class="pform" id="cForm">
      <div class="grid2">
        <label>Full name<input name="name" required maxlength="120" value="${esc(v.name || "")}"></label>
        <label>Email (optional)<input type="email" name="email" maxlength="160" value="${esc(v.email || "")}"></label>
        <label>Phone / WhatsApp<input name="phone" maxlength="40" value="${esc(v.phone || "")}"></label>
        <label>What work do they do?<input name="work" maxlength="160" value="${esc(v.work || "")}"></label>
      </div>
      <label>Address<textarea name="address" rows="2" maxlength="300">${esc(v.address || "")}</textarea></label>
      <button class="btn btn-solid" type="submit">${u ? "Save changes" : "Add client"}</button>
      <p class="msg" id="mmsg"></p>
    </form>`);
  $("#cForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, m = $("#mmsg");
    const data = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), work: f.work.value.trim(), address: f.address.value.trim() };
    try {
      if (u) {
        await updateDoc(doc(db, "users", u.uid), data);
        closeModal(); say("Client updated.", true);
      } else {
        const counterRef = doc(db, "meta", "clientCounter");
        const newRef = doc(collection(db, "users"));
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const n = snap.exists() ? Number(snap.data().n) + 1 : 1;
          tx.set(counterRef, { n });
          tx.set(newRef, { ...data, clientId: "GE-" + (1000 + n), manual: true, createdAt: serverTimestamp() });
        });
        closeModal(); say("Client added.", true);
      }
    } catch (err) { m.textContent = friendlyError(err); m.className = "msg show err"; }
  };
}

function openOrderForm(preUid) {
  const sorted = [...users].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!sorted.length) { say("Add a client first, then add their order.", false); return; }
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <h2 class="mt">Add order</h2>
    <form class="pform" id="oForm">
      <label>Client<select name="uid" required>${sorted.map(u => `<option value="${esc(u.uid)}" ${u.uid === preUid ? "selected" : ""}>${esc(u.name)} (${esc(u.clientId)})</option>`).join("")}</select></label>
      <div class="grid2">
        <label>Service<select name="service">${SERVICES.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
        <label>Job name<input name="title" required maxlength="120"></label>
        <label>Quantity<input type="number" name="quantity" min="1" value="1"></label>
        <label>Order date<input type="date" name="date" value="${today}" max="${today}"></label>
        <label>Status<select name="status">${STATUSES.map(x => `<option ${x === "Delivered" ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label>Price (USD)<input type="number" name="price" min="0" step="0.01" value="0"></label>
        <label>Paid so far (USD)<input type="number" name="paid" min="0" step="0.01" value="0"></label>
      </div>
      <label>Details<textarea name="description" rows="3" maxlength="3000"></textarea></label>
      <label>Message to client (optional)<textarea name="adminNote" rows="2" maxlength="1000"></textarea></label>
      <button class="btn btn-solid" type="submit">Add order</button>
      <p class="msg" id="mmsg"></p>
    </form>`);
  $("#oForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, m = $("#mmsg");
    const u = users.find(x => x.uid === f.uid.value);
    const price = Number(f.price.value) || 0, paid = Number(f.paid.value) || 0;
    if (price < 0 || paid < 0) { m.textContent = "Price and paid must be 0 or more."; m.className = "msg show err"; return; }
    const when = f.date.value ? new Date(f.date.value + "T12:00:00") : new Date();
    try {
      await addDoc(collection(db, "orders"), {
        uid: u.uid, clientId: u.clientId || "", clientName: u.name || "", clientEmail: u.email || "",
        service: f.service.value, title: f.title.value.trim(), quantity: Math.max(1, Number(f.quantity.value) || 1),
        deadline: "", size: "", garment: "", description: f.description.value.trim(), link: "", files: [],
        status: f.status.value, price, paid, adminNote: f.adminNote.value.trim(),
        createdAt: Timestamp.fromDate(when), updatedAt: serverTimestamp()
      });
      closeModal(); say("Order added.", true);
    } catch (err) { m.textContent = friendlyError(err); m.className = "msg show err"; }
  };
}


/* ---------- bulk import from Excel / CSV ---------- */
let impBuilt = false;
let SHEETS = [];          // { file, name, rows:[{...}], type:'orders'|'clients'|'skip', head:[] }
let XLSXmod = null;

const ALIAS = {
  client: ["client", "clientname", "customer", "customername", "name", "fullname", "clientid"],
  service: ["service", "servicetype", "services", "category", "type"],
  title: ["title", "job", "jobname", "design", "designname", "item", "itemname", "product", "orderdetails", "orderdetail", "order", "ordername", "work"],
  qty: ["quantity", "qty", "pcs", "pieces", "units"],
  date: ["date", "orderdate", "createdat", "datereceived", "receiveddate", "jobdate", "dateofwork"],
  status: ["status", "orderstatus", "state"],
  price: ["price", "total", "amount", "totalamount", "charges", "charge", "cost", "invoice", "invoiceamount", "totalprice", "bill"],
  paid: ["paid", "amountpaid", "paidamount", "payment", "received", "advance", "paymentreceived"],
  balance: ["balance", "due", "pending", "remaining", "unpaid", "amountdue", "balancedue"],
  desc: ["description", "details", "notes", "note", "remarks", "comments", "instructions"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "contact", "contactno", "number", "whatsapp", "cell"],
  address: ["address", "location", "city"],
  work: ["work", "business", "businessname", "company", "companyname", "worktype", "occupation", "type"],
  since: ["since", "joined", "datejoined", "createdat", "registered", "date"],
  cid: ["clientid", "customerid", "id"]
};
const ALL_ALIASES = new Set(Object.values(ALIAS).flat());
const norm = (h) => String(h ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
const getv = (o, list) => { for (const k of list) if (o[k] !== undefined && o[k] !== "") return o[k]; return ""; };
const toNum = (v) => parseFloat(String(v || "").replace(/[^0-9.\-]/g, "")) || 0;
const hash36 = (str) => { let h = 5381; for (const c of String(str).toLowerCase()) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

let DAYFIRST = false;
const toDate = (v) => {
  v = String(v || "").trim();
  if (!v) return null;
  let m;
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3], 12);
  if ((m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000;
    const [d, mo] = DAYFIRST ? [a, b] : [b, a];
    const dt = new Date(y, mo - 1, d, 12);
    return (dt.getMonth() === mo - 1) ? dt : null;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
const normStatus = (v) => {
  const t = String(v || "").trim().toLowerCase();
  if (!t) return "Delivered";
  if (/cancel/.test(t)) return "Cancelled";
  if (/deliver|complete|done|finish|shipped|paid|closed/.test(t)) return "Delivered";
  if (/ready/.test(t)) return "Ready";
  if (/progress|process|working|pending|started|production/.test(t)) return "In Progress";
  if (/new|open|received/.test(t)) return "New";
  return "Delivered";
};
const normService = (v) => {
  const t = String(v || "").trim();
  if (!t) return "Other";
  return SERVICES.find(x => x.toLowerCase() === t.toLowerCase()) || t.slice(0, 80);
};
const ymd = (d) => { const x = new Date(d.getTime() + 12 * 3600 * 1000); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`; };
const cellText = (v) => v instanceof Date ? ymd(v) : String(v ?? "").trim();

async function loadXLSX() {
  if (XLSXmod) return XLSXmod;
  try { XLSXmod = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs"); }
  catch (_) { XLSXmod = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs"); }
  return XLSXmod;
}

function guessType(head) {
  const has = (g) => ALIAS[g].some(k => head.includes(k));
  const score = ["price", "paid", "balance", "service", "qty", "status"].filter(has).length + (has("title") && has("client") ? 1 : 0);
  if (score >= 2) return "orders";
  if (has("phone") || has("email") || has("address") || head.some(k => ["name", "clientname", "fullname", "customername"].includes(k))) return "clients";
  return "skip";
}

async function readWorkbook(file) {
  const X = await loadXLSX();
  const wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const out = [];
  for (const name of wb.SheetNames) {
    const grid = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true, blankrows: false });
    if (grid.length < 2) continue;
    // find the header row (best match of known column names within the first 10 rows)
    let hi = 0, best = -1;
    for (let r = 0; r < Math.min(10, grid.length); r++) {
      const sc = grid[r].filter(c => ALL_ALIASES.has(norm(c))).length;
      if (sc > best) { best = sc; hi = r; }
    }
    const rawHead = grid[hi].map(c => cellText(c));
    const head = rawHead.map(norm);
    const rows = [];
    for (let r = hi + 1; r < grid.length; r++) {
      const o = { _row: r + 1 };
      let any = false;
      head.forEach((k, j) => { if (!k) return; const t = cellText(grid[r][j]); if (t !== "") any = true; if (o[k] === undefined || o[k] === "") o[k] = t; });
      if (any) rows.push(o);
    }
    if (rows.length) out.push({ file: file.name, name, rows, head, rawHead, type: guessType(head) });
  }
  return out;
}

const orderFields = (o) => ({
  client: getv(o, ALIAS.client), service: normService(getv(o, ALIAS.service)), title: getv(o, ALIAS.title),
  qty: Math.max(1, Math.round(toNum(getv(o, ALIAS.qty))) || 1), date: toDate(getv(o, ALIAS.date)), dateRaw: getv(o, ALIAS.date),
  status: normStatus(getv(o, ALIAS.status)), price: toNum(getv(o, ALIAS.price)), paid: toNum(getv(o, ALIAS.paid)),
  hasPaid: getv(o, ALIAS.paid) !== "", balance: toNum(getv(o, ALIAS.balance)), hasBal: getv(o, ALIAS.balance) !== "",
  desc: getv(o, ALIAS.desc)
});
function finishMoney(f) {
  let { price, paid } = f;
  if (!price && paid) price = paid;
  if (!f.hasPaid && f.hasBal && price) paid = Math.max(0, price - f.balance);
  return { price: Math.max(0, price), paid: Math.max(0, paid) };
}

function rImport() {
  if (impBuilt) return;   // keep this page stable while files are loaded / importing
  impBuilt = true;
  $("#v-import").innerHTML = `
    <div class="card">
      <div class="imp-step"><h3>Import from Excel</h3>
        <p>Choose your Excel file(s) (.xlsx, .xls or .csv). You can pick your clients file and your orders file together.
        I detect the columns automatically, show you what was found, and nothing is saved until you press <b>Import everything</b>.
        Clients mentioned in the orders but missing from the clients list are created automatically.
        Importing the same file again does not create duplicates.</p>
        <input type="file" id="fX" accept=".xlsx,.xls,.csv" multiple>
        <p style="margin-top:12px"><label>Dates written as text (like 03/04/2025) are:
          <select id="dfSel"><option value="us">Month / Day / Year (US)</option><option value="eu">Day / Month / Year</option></select></label></p>
      </div>
      <div id="impPreview"></div>
      <button class="btn btn-solid" id="goAll" type="button" hidden>Import everything</button>
      <div class="log" id="impLog">Waiting for a file...</div>
    </div>`;
  const log = (t) => { const el = $("#impLog"); el.textContent += (el.textContent === "Waiting for a file..." ? "" : "\n") + t; el.scrollTop = el.scrollHeight; };
  $("#impLog").textContent = "Waiting for a file...";

  const preview = () => {
    DAYFIRST = $("#dfSel").value === "eu";
    const html = SHEETS.map((sh, i) => {
      const sample = sh.rows.slice(0, 3).map(o => {
        if (sh.type === "orders") { const f = orderFields(o), m = finishMoney(f); return `<tr><td>${esc(f.client)}</td><td>${esc(f.service)}</td><td>${esc(f.title)}</td><td>${f.date ? esc(ymd(f.date)) : "<i>none</i>"}</td><td>${money(m.price)}</td><td>${money(m.paid)}</td><td>${esc(f.status)}</td></tr>`; }
        return `<tr><td>${esc(getv(o, ALIAS.client))}</td><td>${esc(getv(o, ALIAS.phone))}</td><td>${esc(getv(o, ALIAS.email))}</td><td>${esc(getv(o, ALIAS.address))}</td><td>${esc(getv(o, ALIAS.work))}</td></tr>`;
      }).join("");
      const head = sh.type === "orders" ? "<th>Client</th><th>Service</th><th>Job</th><th>Date</th><th>Price</th><th>Paid</th><th>Status</th>" : "<th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Work</th>";
      const unknown = sh.rawHead.filter((h, j) => h && !ALL_ALIASES.has(sh.head[j]));
      return `<div class="imp-step"><h3>${esc(sh.file)} &rsaquo; ${esc(sh.name)} <small class="muted">(${sh.rows.length} rows)</small></h3>
        <p>Treat this sheet as: <select data-sheet="${i}"><option value="orders" ${sh.type === "orders" ? "selected" : ""}>Orders</option><option value="clients" ${sh.type === "clients" ? "selected" : ""}>Clients</option><option value="skip" ${sh.type === "skip" ? "selected" : ""}>Ignore</option></select></p>
        ${sh.type === "skip" ? "" : `<div class="tbl-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${sample}</tbody></table></div>`}
        ${unknown.length ? `<p class="muted">Columns not used: ${esc(unknown.join(", "))}</p>` : ""}</div>`;
    }).join("");
    $("#impPreview").innerHTML = html || '<p class="muted">No data found in the file.</p>';
    $("#goAll").hidden = !SHEETS.some(s => s.type !== "skip");
    $("#impPreview").querySelectorAll("select[data-sheet]").forEach(sel => sel.onchange = () => { SHEETS[+sel.dataset.sheet].type = sel.value; preview(); });
  };
  $("#dfSel").onchange = preview;

  $("#fX").onchange = async (e) => {
    const files = Array.from(e.target.files);
    SHEETS = [];
    $("#impLog").textContent = "Reading file(s)...";
    try {
      for (const f of files) SHEETS.push(...await readWorkbook(f));
      $("#impLog").textContent = `Found ${SHEETS.length} sheet(s) with data. Check the preview, then press Import everything.`;
      preview();
    } catch (err) { $("#impLog").textContent = "Could not read the file: " + (err.message || err) + "\nIf it is blocked, check your internet connection and try again."; }
  };

  $("#goAll").onclick = async () => {
    DAYFIRST = $("#dfSel").value === "eu";
    const cSheets = SHEETS.filter(s => s.type === "clients"), oSheets = SHEETS.filter(s => s.type === "orders");
    const nC = cSheets.reduce((a, s) => a + s.rows.length, 0), nO = oSheets.reduce((a, s) => a + s.rows.length, 0);
    if (!confirm(`Import ${nC} client row(s) and ${nO} order row(s)?`)) return;
    $("#goAll").disabled = true;
    try {
      const counterRef = doc(db, "meta", "clientCounter");
      const cs = await getDoc(counterRef);
      let n = cs.exists() ? Number(cs.data().n) : 0;
      const byName = new Map(), byCid = new Map();
      users.forEach(u => { if (u.name) byName.set(String(u.name).trim().toLowerCase(), u); if (u.clientId) byCid.set(String(u.clientId).toLowerCase(), u); });
      let batch = writeBatch(db), ops = 0, nc = 0, no = 0, skipped = 0, created = 0;
      const push = async () => { if (++ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; log(`...${nc} clients, ${no} orders saved`); } };

      // find or create a client by name; returns the client record
      const ensureClient = async (name, x = {}) => {
        const key = String(name).trim().toLowerCase();
        let u = byName.get(key) || byCid.get(key);
        if (u) return u;
        const id = "imp-c-" + hash36(key);
        const clientId = x.clientId || "GE-" + (1000 + (++n));
        const since = x.since || null;
        u = { uid: id, clientId, name: String(name).trim().slice(0, 120), email: (x.email || "").slice(0, 160), phone: (x.phone || "").slice(0, 40), address: (x.address || "").slice(0, 300), work: (x.work || "").slice(0, 160) };
        batch.set(doc(db, "users", id), { clientId: u.clientId, name: u.name, email: u.email, phone: u.phone, address: u.address, work: u.work, manual: true, createdAt: since ? Timestamp.fromDate(since) : serverTimestamp() });
        byName.set(key, u); byCid.set(clientId.toLowerCase(), u);
        nc++; await push();
        return u;
      };

      // 1) clients sheets
      for (const sh of cSheets) {
        for (const o of sh.rows) {
          const name = getv(o, ALIAS.client);
          if (!name) { log(`${sh.name} row ${o._row}: no name, skipped`); skipped++; continue; }
          let cid = "";
          const given = getv(o, ["clientid", "customerid"]);
          if (/^GE-\d+$/i.test(given)) { cid = given.toUpperCase(); n = Math.max(n, Number(cid.slice(3)) - 1000); }
          await ensureClient(name, { clientId: cid, email: getv(o, ALIAS.email), phone: getv(o, ALIAS.phone), address: getv(o, ALIAS.address), work: getv(o, ["work", "business", "businessname", "company", "companyname", "worktype", "occupation"]), since: toDate(getv(o, ["since", "joined", "datejoined", "registered", "createdat"])) });
        }
      }
      log(`Clients done: ${nc} added.`);

      // 2) orders sheets
      for (let si = 0; si < oSheets.length; si++) {
        const sh = oSheets[si];
        for (const o of sh.rows) {
          const f = orderFields(o);
          if (!f.client) { log(`${sh.name} row ${o._row}: no client name, skipped`); skipped++; continue; }
          const before = nc;
          const u = await ensureClient(f.client, { email: getv(o, ALIAS.email), phone: getv(o, ALIAS.phone), address: getv(o, ALIAS.address) });
          if (nc > before) created++;
          if (f.dateRaw && !f.date) log(`${sh.name} row ${o._row}: date "${f.dateRaw}" not understood, used today`);
          const m = finishMoney(f);
          const id = "imp-o-" + hash36(sh.file + "|" + sh.name) + "-" + o._row;
          batch.set(doc(db, "orders", id), {
            uid: u.uid, clientId: u.clientId || "", clientName: u.name || "", clientEmail: u.email || "",
            service: f.service, title: (f.title || f.service || "Order").slice(0, 120), quantity: f.qty,
            deadline: "", size: "", garment: "", description: String(f.desc || "").slice(0, 3000), link: "", files: [],
            status: f.status, price: m.price, paid: m.paid, adminNote: "",
            createdAt: Timestamp.fromDate(f.date || new Date()), updatedAt: serverTimestamp()
          });
          no++; await push();
        }
      }
      batch.set(counterRef, { n });
      await batch.commit();
      log(`DONE: ${no} order(s) imported, ${nc} client(s) added (${created} of them created automatically from orders), ${skipped} row(s) skipped.`);
    } catch (err) { log("ERROR: " + friendlyError(err)); }
    $("#goAll").disabled = false;
  };
}

/* ---------- click delegation ---------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-order],[data-client],[data-qtoggle],[data-qdel]");
  if (!t || e.target.closest("a")) return;
  if (t.dataset.order) openOrder(t.dataset.order);
  else if (t.dataset.client) openClient(t.dataset.client);
  else if (t.dataset.qtoggle) {
    const q = quotes.find(x => x.id === t.dataset.qtoggle);
    try { await updateDoc(doc(db, "quotes", q.id), { status: q.status === "done" ? "new" : "done" }); } catch (err) { say(friendlyError(err), false); }
  } else if (t.dataset.qdel) {
    if (confirm("Delete this quote request permanently?")) {
      try { await deleteDoc(doc(db, "quotes", t.dataset.qdel)); } catch (err) { say(friendlyError(err), false); }
    }
  }
});
