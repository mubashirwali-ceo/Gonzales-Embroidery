// Sends an email alert to the studio owner (shows as a phone notification in the Gmail app).
// Uses Web3Forms (free). Set ALERT_KEY in config.js. Does nothing if the key is empty.
import { ALERT_KEY } from "./config.js";

export function notifyAdmin(subject, message) {
  if (!ALERT_KEY) return;
  try {
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ access_key: ALERT_KEY, subject: String(subject).slice(0, 150), from_name: "Gonzales Embroidery Portal", message: String(message).slice(0, 3000) })
    }).catch(() => {});
  } catch (_) { /* alerts are best-effort */ }
}
