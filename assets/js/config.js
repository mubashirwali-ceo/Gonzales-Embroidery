// =====================================================================
//  GONZALES EMBROIDERY — PORTAL SETTINGS  (fill these in once)
//  Step-by-step help: SETUP-GUIDE.md
// =====================================================================

// 1) Paste your Firebase web-app config here (Firebase Console > Project settings > Your apps)
export const firebaseConfig = {
  apiKey: "AIzaSyD3fdWdjrqcLconwrTeyaK68mezPKhjZbU",
  authDomain: "gonzales-embroidery.firebaseapp.com",
  projectId: "gonzales-embroidery",
  storageBucket: "gonzales-embroidery.firebasestorage.app",
  messagingSenderId: "1010735953032",
  appId: "1:1010735953032:web:eeb881009ddf0886d51b3d"
};

// 2) The ONE email that opens the Admin Panel (must be verified).
//    It must be the same email written inside firestore.rules.
export const ADMIN_EMAIL = "mhrsunny2019@gmail.com";

// 3) File uploads (Cloudinary free plan). Leave empty to disable file upload;
//    clients can still paste a Google Drive / WeTransfer link.
export const CLOUDINARY = {
  cloudName: "ain40zr2",        // e.g. "dxxxxxxx"
  uploadPreset: "i55as4em"      // an UNSIGNED upload preset, e.g. "gonzales_orders"
};

export const SERVICES = [
  "Digitizing (embroidery file)",
  "Custom Embroidery",
  "Logo Embroidery",
  "Vector Art Conversion",
  "Screen Printing",
  "DTG Printing",
  "DTF Printing",
  "Custom Patches",
  "Caps & Hats",
  "Marketing Services",
  "Other"
];

export const STATUSES = ["New", "In Progress", "Ready", "Delivered", "Cancelled"];
