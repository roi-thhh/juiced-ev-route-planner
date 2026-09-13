# Contributing to JUICED

Thank you for your interest in contributing to **JUICED**! We welcome contributions to improve our highway corridor planning, add new EV motorcycle/scooter profiles, expand charging network datasets, or enhance the semi-brutalist mobile UI.

---

## 🛠️ Development Setup

1. **Fork the repository** on GitHub.
2. **Clone your fork locally**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/juiced-ev-route-planner.git
   cd juiced-ev-route-planner
   ```
3. **Set up the Python backend**:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate

   pip install -r requirements.txt
   ```
4. **Run the local dev server**:
   ```bash
   python -m uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload
   ```

---

## 📱 Android Development

1. Open the `android/` directory in **Android Studio Hedgehog or newer**.
2. Whenever you modify files in `public/`, sync them to Android assets:
   ```bash
   python scripts/prepare_assets.py
   ```
3. Build and test on an Android emulator or connected device:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

---

## 📋 Pull Request Process

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/add-ather-rizta-profile
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat(profiles): add Ather Rizta battery and charge rate specs"
   ```
3. Ensure no private keys or `.env` files are tracked.
4. Push to your fork and submit a Pull Request to `main`.
