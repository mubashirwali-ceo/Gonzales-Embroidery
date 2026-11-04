import { auth, db, configured, setupBanner, esc, safeUrl, money, fmtDate, ms, statusClass, friendlyError } from "./fb.js";
import { ADMIN_EMAIL, SERVICES } from "./config.js";
import { createProfile } from "./profile.js";
import { uploadFile, uploadsEnabled, MAX_FILE_MB } from "./upload.js";
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const msg = $("#msg");
const say = (t, ok) => { msg.textContent = t; msg.className = "msg show " + (ok ? "ok" : "err"); window.scrollTo({ top: 0, behavior: "smooth" }); };
const clearMsg = () => { msg.className = "msg"; msg.textContent = ""; };

let user = null, profile = null, orders = [];

if (!configured) {
  setupBanner();
} else {
  onAuthStateChanged(auth, async (u) => {
    if (!u) { location.replace("login.html"); return; }
    if ((u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) { location.replace("admin.html"); return; }
    user = u;
    try {
      let snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) { await createProfile(u, { name: u.displayName || "" }); snap = await getDoc(doc(db, "users", u.uid)); }
      profile = snap.data();
    } catch (e) { say(friendlyError(e), false); return; }
    start();
  });
}

function start() {
  $("#app").hidden = false;
  $("#whoName").textContent = profile.name || user.email;
  $("#whoId").textContent = profile.clientId || "";
  $("#serviceSel").innerHTML = SERVICES.map(s => `<option>${esc(s)}</option>`).join("");
  $("#fileHint").textContent = uploadsEnabled() ? `(max ${MAX_FILE_MB} MB each)` : "(file upload is off — use the link box below)";
  if (!uploadsEnabled()) $("#files").disabled = true;
  fillProfile();
  renderVerify();

  onSnapshot(query(collection(db, "orders"), where("uid", "==", user.uid)), (s) => {
    orders = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    renderStats(); renderOrders();
  }, (e) => say(friendlyError(e), false));
}

function renderVerify() {
  $("#verifyBox").hidden = user.emailVerified;
  $("#verifyEmail").textContent = user.email;
}
$("#checkVerified").addEventListener("click", async () => {
  await user.reload(); await user.getIdToken(true);
  renderVerify();
  if (user.emailVerified) say("Email confirmed. You can now place orders.", true); else say("Not confirmed yet. Please open the link in your email.", false);
});
$("#resendVerify").addEventListener("click", async () => {
  try { await sendEmailVerification(user); say("Confirmation email sent again. Check your inbox and spam folder.", true); }
  catch (e) { say(friendlyError(e), false); }
});
$("#logoutBtn").addEventListener("click", async () => { await signOut(auth); location.replace("login.html"); });

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
  ["orders", "new", "profile"].forEach(v => { $("#v-" + v).hidden = v !== t.dataset.view; });
  clearMsg();
}));

const balance = (o) => Math.max(0, (Number(o.price) || 0) - (Number(o.paid) || 0));

function renderStats() {
  const active = orders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length;
  const due = orders.filter(o => o.status !== "Cancelled").reduce((a, o) => a + balance(o), 0);
  $("#stats").innerHTML = `
    <div class="stat"><span>Total Orders</span><b>${orders.length}</b></div>
    <div class="stat"><span>In Progress</span><b>${active}</b></div>
    <div class="stat ${due > 0 ? "warn" : ""}"><span>Balance Due</span><b>${money(due)}</b></div>`;
}

function renderOrders() {
  const box = $("#v-orders");
  if (!orders.length) { box.innerHTML = '<div class="empty card">No orders yet. Click <b>Place New Order</b> to start.</div>'; return; }
  box.innerHTML = orders.map(o => {
    const files = (o.files || []).map(f => `<a href="${safeUrl(f.url)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join("");
    return `<article class="card order">
      <div class="order-top">
        <div><span class="ono">#${esc(o.id.slice(0, 6).toUpperCase())}</span><h3>${esc(o.title)}</h3><p class="muted">${esc(o.service)} &middot; Qty ${esc(o.quantity)} &middot; ${fmtDate(o.createdAt)}</p></div>
        <span class="badge ${statusClass(o.status)}">${esc(o.status)}</span>
      </div>
      <p class="desc">${esc(o.description)}</p>
      ${o.deadline ? `<p class="muted">Deadline: ${esc(o.deadline)}</p>` : ""}
      ${files || o.link ? `<div class="files">${files}${o.link ? `<a href="${safeUrl(o.link)}" target="_blank" rel="noopener">Shared link</a>` : ""}</div>` : ""}
      ${o.adminNote ? `<p class="note"><b>Message from studio:</b> ${esc(o.adminNote)}</p>` : ""}
      <div class="money">
        <span>Price <b>${Number(o.price) ? money(o.price) : "To be quoted"}</b></span>
        <span>Paid <b>${money(o.paid)}</b></span>
        <span class="${balance(o) > 0 ? "due" : ""}">Balance <b>${money(balance(o))}</b></span>
      </div>
    </article>`;
  }).join("");
}

function fillProfile() {
  const f = $("#profileForm");
  $("#pId").value = profile.clientId || ""; $("#pEmail").value = user.email;
  ["name", "phone", "address", "work"].forEach(k => { f.elements[k].value = profile[k] || ""; });
}
$("#profileForm").addEventListener("submit", async (e) => {
  e.preventDefault(); clearMsg();
  const f = e.target;
  const data = { name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim(), address: f.elements.address.value.trim(), work: f.elements.work.value.trim() };
  try { await updateDoc(doc(db, "users", user.uid), data); profile = { ...profile, ...data }; $("#whoName").textContent = data.name; say("Profile saved.", true); }
  catch (err) { say(friendlyError(err), false); }
});

$("#orderForm").addEventListener("submit", async (e) => {
  e.preventDefault(); clearMsg();
  if (!user.emailVerified) { say("Please confirm your email first (see the yellow box above).", false); return; }
  const f = e.target, btn = $("#orderBtn");
  const picked = uploadsEnabled() ? Array.from($("#files").files) : [];
  const big = picked.find(x => x.size > MAX_FILE_MB * 1024 * 1024);
  if (big) { say(`"${big.name}" is larger than ${MAX_FILE_MB} MB. Please paste a Drive/WeTransfer link instead.`, false); return; }
  btn.disabled = true;
  try {
    const files = [];
    for (let i = 0; i < picked.length; i++) {
      btn.textContent = `Uploading file ${i + 1} of ${picked.length}...`;
      files.push(await uploadFile(picked[i]));
    }
    btn.textContent = "Saving order...";
    await addDoc(collection(db, "orders"), {
      uid: user.uid,
      clientId: profile.clientId || "",
      clientName: profile.name || "",
      clientEmail: user.email,
      service: f.elements.service.value,
      title: f.elements.title.value.trim(),
      quantity: Math.max(1, Number(f.elements.quantity.value) || 1),
      deadline: f.elements.deadline.value || "",
      size: f.elements.size.value.trim(),
      garment: f.elements.garment.value.trim(),
      description: f.elements.description.value.trim(),
      link: f.elements.link.value.trim(),
      files,
      status: "New", price: 0, paid: 0, adminNote: "",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    f.reset();
    document.querySelector('.tab[data-view="orders"]').click();
    say("Order received! We will review it and send you the price.", true);
  } catch (err) { say(friendlyError(err), false); }
  btn.disabled = false; btn.textContent = "Submit Order";
});
