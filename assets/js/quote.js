// Home-page "Get a Quote" form -> saved in Firestore, appears in the Admin Panel (no email needed).
import { db, configured, friendlyError } from "./fb.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const form = document.getElementById("quoteForm");
if (form) {
  const statusEl = document.getElementById("formStatus");
  const btn = form.querySelector('button[type="submit"]');
  const show = (msg, ok) => {
    statusEl.textContent = msg;
    statusEl.classList.remove("ok", "err");
    statusEl.classList.add("show", ok ? "ok" : "err");
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    if (d.get("website")) { form.reset(); show("Thanks! We'll be in touch shortly.", true); return; }
    const name = String(d.get("name") || "").trim();
    const email = String(d.get("email") || "").trim();
    const details = String(d.get("details") || "").trim();
    if (!name || !email || !details) { show("Please fill in your name, email and details.", false); return; }
    if (!configured) { show("Quote form is not connected yet. Please email us directly.", false); return; }
    btn.disabled = true; btn.style.opacity = "0.7";
    try {
      await addDoc(collection(db, "quotes"), {
        name: name.slice(0, 120),
        email: email.slice(0, 160),
        company: String(d.get("company") || "").trim().slice(0, 160),
        details: details.slice(0, 4000),
        status: "new",
        createdAt: serverTimestamp()
      });
      form.reset();
      show("Thanks! Your request has been received — we'll reply shortly.", true);
    } catch (err) {
      show(friendlyError(err), false);
    } finally {
      btn.disabled = false; btn.style.opacity = "";
    }
  });
}
