# Step-by-Step Guide: Getting Your Free Google Maps API Key

Google Maps provides a **$200 free monthly credit** on Google Cloud, which gives you roughly **28,000 map loads per month** completely free of charge.

Follow these steps to obtain and configure your API key for VoltPath:

---

## Step 1: Open Google Cloud Console
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your standard Google Account (Gmail).

---

## Step 2: Create a New Project
1. At the top of the page, click the **Project Dropdown** (next to the "Google Cloud" logo).
2. Click **"NEW PROJECT"** in the top right of the modal.
3. Enter a Project Name: e.g., `VoltPath EV Planner`.
4. Click **"CREATE"** and wait a few seconds for the project to finish creating.
5. Make sure your newly created project is selected in the top bar.

---

## Step 3: Enable the 3 Required APIs
VoltPath needs 3 Google Maps services:
1. In the top search bar, type: **`Maps JavaScript API`**
   - Click on **Maps JavaScript API** in the results.
   - Click the blue **"ENABLE"** button.
2. In the top search bar, type: **`Places API`**
   - Click on **Places API** (or Places API (New)).
   - Click the blue **"ENABLE"** button.
3. In the top search bar, type: **`Directions API`**
   - Click on **Directions API**.
   - Click the blue **"ENABLE"** button.

---

## Step 4: Generate Your API Key
1. Go to the left navigation menu (☰ hamburger icon) ➔ **"APIs & Services"** ➔ **"Credentials"**.
2. Click **"+ CREATE CREDENTIALS"** at the top.
3. Select **"API key"**.
4. A popup will appear displaying your new key:
   ```text
   AIzaSy...your_generated_key_here...
   ```
5. Copy this key.

---

## Step 5: (Recommended) Secure Your API Key
To ensure no one else can use your key:
1. In the popup, click **"Edit API key"** (or click the pencil icon next to your key under *API Keys*).
2. Under **"Set application restrictions"**, choose:
   - For local development: Choose **Websites** and add:
     - `http://localhost:8000/*`
     - `http://127.0.0.1:8000/*`
   - For production: Add your custom domain (e.g. `https://your-domain.com/*`).
3. Under **"API restrictions"**, select **Restrict key** and check:
   - *Maps JavaScript API*
   - *Places API*
   - *Directions API*
4. Click **"SAVE"**.

---

## Step 6: Using the Key in VoltPath

### In Testing Phase (Quick UI Modal)
1. Open the VoltPath web app at `http://localhost:8000`.
2. Click the **"🔑 Google Maps Key"** button in the header.
3. Paste your key and click **"Activate Google Maps"**.
4. The app immediately converts to **100% Native Google Maps**!

### In Production Mode (Automatic & Secure)
Create a `.env` file in the project root directory:
```env
GOOGLE_MAPS_API_KEY=AIzaSyYourFullKeyHere
```
When running in production, the server automatically supplies this key to the app engine. **No input field or modal will be displayed to end-users!**
