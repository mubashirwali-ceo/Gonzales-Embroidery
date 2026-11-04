// Shared Firebase setup + small helpers used by every portal page.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const configured = !String(firebaseConfig.apiKey).startsWith("PASTE");
const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = configured ? getAuth(app) : null;
export const db = configured ? getFirestore(app) : null;

// Escape any text before putting it into innerHTML (clients type this data!)
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const money = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ms = (ts) => (ts && typeof ts.toMillis === "function") ? ts.toMillis() : (ts ? Number(ts) : Date.now());

export const fmtDate = (ts) => new Date(ms(ts)).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const statusClass = (s) => "st-" + String(s || "New").toLowerCase().replace(/\s+/g, "-");

export function friendlyError(e) {
  const c = (e && e.code) || "";
  const map = {
    "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/network-request-failed": "Network problem. Check your internet and try again.",
    "permission-denied": "Permission denied. Please verify your email first, then try again."
  };
  return map[c] || (e && e.message) || "Something went wrong. Please try again.";
}

export function setupBanner() {
  document.body.insertAdjacentHTML("afterbegin",
    '<div class="setup-banner">Portal is not configured yet. Open <b>assets/js/config.js</b> and paste your Firebase settings (see SETUP-GUIDE.md).</div>');
}

// Only allow normal web links (blocks javascript: links typed by a visitor)
export const safeUrl = (u) => /^https?:\/\//i.test(String(u || "").trim()) ? esc(String(u).trim()) : "#";
