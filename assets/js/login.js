import { auth, configured, setupBanner, friendlyError } from "./fb.js";
import { ADMIN_EMAIL } from "./config.js";
import { createProfile } from "./profile.js";
import { notifyAdmin } from "./alerts.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const $ = (s) => document.querySelector(s);
const msg = $("#msg");
const say = (t, ok) => { msg.textContent = t; msg.className = "msg show " + (ok ? "ok" : "err"); };
const clear = () => { msg.className = "msg"; msg.textContent = ""; };
const dest = (u) => (u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin.html" : "portal.html";

document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === t));
  $("#signinForm").hidden = t.dataset.tab !== "signin";
  $("#signupForm").hidden = t.dataset.tab !== "signup";
  clear();
}));

if (!configured) {
  setupBanner();
} else {
  let busy = false; // while signing up, don't auto-redirect before the profile is saved
  onAuthStateChanged(auth, (u) => { if (u && !busy) location.replace(dest(u)); });

  $("#signinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const c = await signInWithEmailAndPassword(auth, String(f.get("email")).trim(), String(f.get("password")));
      location.replace(dest(c.user));
    } catch (err) { say(friendlyError(err), false); }
    btn.disabled = false;
  });

  $("#forgotBtn").addEventListener("click", async () => {
    clear();
    const email = String(new FormData($("#signinForm")).get("email") || "").trim();
    if (!email) { say("Type your email in the box above first, then press 'Forgot password?'.", false); return; }
    try { await sendPasswordResetEmail(auth, email); say("Password reset link sent. Please check your email (and spam folder).", true); }
    catch (err) { say(friendlyError(err), false); }
  });

  $("#signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    const f = new FormData(e.target);
    if (f.get("password") !== f.get("password2")) { say("Passwords do not match.", false); return; }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; busy = true;
    try {
      const name = String(f.get("name")).trim();
      const c = await createUserWithEmailAndPassword(auth, String(f.get("email")).trim(), String(f.get("password")));
      await updateProfile(c.user, { displayName: name });
      await createProfile(c.user, {
        name,
        phone: String(f.get("phone")).trim(),
        address: String(f.get("address")).trim(),
        work: String(f.get("work")).trim()
      });
      notifyAdmin("New client signed up: " + name, `Name: ${name}\nEmail: ${c.user.email}\nPhone: ${String(f.get("phone")).trim()}\nWork: ${String(f.get("work")).trim()}\nAddress: ${String(f.get("address")).trim()}`);
      try { await sendEmailVerification(c.user); } catch (_) { /* can be resent from the portal */ }
      location.replace(dest(c.user));
    } catch (err) { busy = false; say(friendlyError(err), false); btn.disabled = false; }
  });
}
