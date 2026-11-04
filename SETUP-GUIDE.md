# Gonzales Embroidery — Client Portal Setup Guide

New pages added to your website:
- `login.html` — Sign in / Sign up (with confirmation email)
- `portal.html` — **Client Panel** (each client sees only their own data)
- `admin.html` — **Admin Panel** (only you: all clients, orders, files, payments)

The home page "Get a Quote" form now saves straight into the Admin Panel (Quote Requests tab) instead of email.
The old `send-quote.php` was removed because GitHub Pages cannot run PHP.

You do this setup **once**. About 20 minutes.

---

## Step 1: Create a Firebase project (free, no card needed)
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project**, name it (e.g. `gonzales-embroidery`), turn off Google Analytics, click **Create**.
3. On the project page click the **Web** icon `</>`, give the app a name, click **Register app**.
4. Copy the values from the `firebaseConfig` code into `assets/js/config.js`, replacing every `PASTE_...`.
   (This config is not secret. Security comes from the Firestore rules.)

## Step 2: Turn on Authentication
1. Left menu: **Build → Authentication → Get started**.
2. Choose **Email/Password**, switch **Enable** on, click **Save**.

## Step 3: Create the database
1. **Build → Firestore Database → Create database**.
2. Choose **Production mode**, pick a location (e.g. `nam5 (United States)`), click **Enable**.
3. Open the **Rules** tab, delete everything, and paste the full contents of the file `firestore.rules`.
4. In that text, find `order@gonzalesembroidery.com` and put **your admin email** (it must match `ADMIN_EMAIL` in `assets/js/config.js`).
5. Click **Publish**.

## Step 4: Allow your GitHub address
**Authentication → Settings → Authorized domains → Add domain**: enter `yourusername.github.io`
(and your own domain too, if you use one). Login will not work without this.

## Step 5: File uploads (optional, free — Cloudinary)
Firebase Storage now requires a billing card, so file uploads use Cloudinary's free plan.
1. Create a free account at https://cloudinary.com and note your **Cloud name**.
2. **Settings → Upload → Upload presets → Add upload preset**. Set **Signing mode = Unsigned**, Save, note the preset name.
3. **Settings → Security**: enable "Allow delivery of PDF and ZIP files".
4. Put `cloudName` and `uploadPreset` into `assets/js/config.js`.

Limit: 10 MB per file. For bigger files, clients can paste a Google Drive / WeTransfer link in the order form.
If you skip this step, only the link option is available.

## Step 6: Publish on GitHub
1. Create a new public repository on https://github.com.
2. Upload all the files from this folder (**Add file → Upload files**). `index.html` must be at the top level.
3. **Settings → Pages → Branch: main / (root) → Save**.
4. After 1–2 minutes the site is live at `https://yourusername.github.io/repo-name/`.

## Step 7: Activate your admin account
1. On the website open **Client Login → Create Account** and sign up with **your admin email**.
2. Open the confirmation link in your inbox (check spam too).
3. Log in again. You will land in the **Admin Panel** automatically.

Every other email is a **client** and cannot open the Admin Panel.

---

## How it works
- **Sign up:** name, email, phone, address, type of work, password. The client gets an ID (GE-1001, GE-1002...) and a confirmation email.
- **Orders:** after confirming email, the client picks a service (digitizing, embroidery, vector, screen printing, DTG, DTF, patches...), writes details and adds files. The order appears instantly in your Admin Panel.
- **Admin Panel:** Dashboard, Orders, Clients (name, email, address, work, orders, billed, paid, pending amount, months pending), Quote Requests.
- **Price and payment:** open an order, set Status, Price, Paid, and optionally a message to the client. The client sees price, paid and balance in their panel.
- **Privacy:** Firestore rules guarantee one client can never see another client's data.

## Notes
- Firebase confirmation emails sometimes land in spam. You can edit the email text under **Authentication → Templates**.
- Cloudinary file links are public but practically impossible to guess. Do not upload highly sensitive files.
- Firebase's free Spark plan is enough for a small business (50,000 reads/day).
- Password reset: "Forgot password?" on the login page emails a reset link.
