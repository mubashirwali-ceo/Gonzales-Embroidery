import { auth, db, configured, setupBanner, esc, safeUrl, money, fmtDate, ms, statusClass, friendlyError } from "./fb.js";
import { ADMIN_EMAIL, STATUSES } from "./config.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
  ["dash", "orders", "clients", "quotes"].forEach(v => { $("#v-" + v).hidden = v !== view; });
  ({ dash: rDash, orders: rOrders, clients: rClients, quotes: rQuotes })[view]();

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
    </div>
    <div class="tbl-wrap"><table class="tbl">${ORDER_HEAD}<tbody>${list.map(orderRow).join("") || '<tr><td colspan="9" class="empty">No orders found.</td></tr>'}</tbody></table></div>`;
  $("#oq").oninput = (e) => { F.oq = e.target.value; render(); };
  $("#ost").onchange = (e) => { F.ostatus = e.target.value; render(); };
}

function rClients() {
  const q = F.cq.toLowerCase();
  const rows = users.map(u => ({ u, s: clientStats(u) }))
    .filter(r => !q || [r.u.name, r.u.email, r.u.clientId, r.u.phone, r.u.work, r.u.address].join(" ").toLowerCase().includes(q))
    .sort((a, b) => ms(b.u.createdAt) - ms(a.u.createdAt));
  $("#v-clients").innerHTML = `
    <div class="toolbar"><input id="cq" type="search" placeholder="Search name, email, phone, ID..." value="${esc(F.cq)}"><span class="muted">${rows.length} client(s)</span></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Work</th><th class="num">Orders</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Pending</th><th>Pending For</th></tr></thead><tbody>
    ${rows.map(({ u, s }) => `<tr class="click" data-client="${esc(u.uid)}"><td>${esc(u.clientId)}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${esc(u.address)}</td><td>${esc(u.work)}</td>
      <td class="num">${s.count}</td><td class="num">${money(s.billed)}</td><td class="num">${money(s.paid)}</td><td class="num ${s.pending > 0 ? "due" : ""}">${money(s.pending)}</td><td>${monthsLabel(s.since)}</td></tr>`).join("") || '<tr><td colspan="11" class="empty">No clients yet.</td></tr>'}
    </tbody></table></div>`;
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
        <button class="btn btn-outline dark" type="button" id="markPaid">Mark fully paid</button></div>
      <p class="msg" id="mmsg"></p>
    </form>`);
  const f = $("#orderEdit");
  const upd = () => { $("#balOut").value = money(Math.max(0, (Number(f.price.value) || 0) - (Number(f.paid.value) || 0))); };
  f.price.oninput = upd; f.paid.oninput = upd;
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
    <h3 class="sec">Orders</h3>
    <div class="tbl-wrap"><table class="tbl">${ORDER_HEAD}<tbody>${s.os.map(orderRow).join("") || '<tr><td colspan="9" class="empty">No orders.</td></tr>'}</tbody></table></div>`);
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
