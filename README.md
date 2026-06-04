# SETU Face Authentication System

A secure, offline-first face recognition and geofenced attendance logging system.

---

## Credentials

* **Role**: Admin / Supervisor
* **Email**: `admin@millennium.com`
* **Password**: `admin123`

---

## Service Setup & Running Steps

### 1. Backend (FastAPI)
Runs the database operations, matches face templates, and stores log data.
```bash
# Navigate to backend
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server (accessible over LAN)
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

* **Environment / Configuration**:
  * **Database**: Local PostgreSQL database (`setuauth`).
    * If your database requires authentication, set the `DATABASE_URL` environment variable:
      ```bash
      export DATABASE_URL="postgresql://username:password@localhost:5432/setuauth"
      ```
    * **Setting up PostgreSQL (macOS Homebrew)**:
      1. Start the service: `brew services start postgresql`
      2. Create the database: `createdb setuauth`
      3. On startup, the FastAPI app automatically runs migrations/tables creation and seeds the default admin.
  * **Network Port**: `8001` (Exposed via `--host 0.0.0.0` so physical mobile devices on the same Wi-Fi network can connect).

---

### 2. Admin Web App (Vite React)
Browser dashboard for HR/Admins to manage workers, view sync metrics, and download reports.
```bash
# Navigate to web app
cd admin-web

# Install dependencies (if first time)
npm install

# Run the development server
npm run dev
```

* **Environment / Configuration**:
  * The frontend makes API requests to the backend at `http://localhost:8001`.
  * Open the admin web dashboard at `http://localhost:5173`.

---

### 3. Worker Mobile App (Expo React Native)
On-device face verification app with randomized liveness challenges and geofencing.
```bash
# Navigate to mobile app
cd app/frontend

# Install dependencies (if first time)
npm install

# Clean Expo prebuild caches
npx expo prebuild --clean

# Build & Run on physical iOS device
npx expo run:ios --device

# Start Expo bundler with LAN hosting
npx expo start -c --host lan
```

* **Environment / Configuration**:
  * Open [app/frontend/src/utils/config.ts](file:///Users/ishas/Downloads/setuauth/app/frontend/src/utils/config.ts) and set `BACKEND_URL` to your local machine's LAN IP address:
    ```typescript
    export const BACKEND_URL = 'http://<YOUR-LOCAL-LAN-IP>:8001';
    ```

---

## 📦 Key Libraries Used

### 1. Backend Libraries
* **Libraries**:
  * `fastapi` & `uvicorn` — REST API endpoint hosting
  * `sqlalchemy` & `psycopg2-binary` — Database ORM & PostgreSQL driver
* **Installation Command**:
  ```bash
  pip install fastapi uvicorn sqlalchemy psycopg2-binary
  ```

---

### 2. Admin Web App Libraries
* **Libraries**:
  * `recharts` — Visual data plotting for weekly attendance stats
  * `lucide-react` — Slick interface icons
* **Installation Command**:
  ```bash
  npm install recharts lucide-react
  ```

---

### 3. Worker Mobile App Libraries
* **Libraries**:
  * `react-native-fast-tflite` — High performance on-device MobileFaceNet embedding generation
  * `react-native-vision-camera` — Camera frame provider
  * `react-native-vision-camera-face-detector` — Accurate MLKit face bounding box and landmarks
  * `vision-camera-resize-plugin` — Image resizing for tensor input preparation
  * `react-native-mmkv` — High speed on-device state persistence
  * `expo-sqlite` — Local SQLite cache for offline verification logs
  * `zustand` — Lightweight React state management
* **Installation Command**:
  ```bash
  npm install react-native-fast-tflite react-native-vision-camera react-native-vision-camera-face-detector vision-camera-resize-plugin react-native-mmkv expo-sqlite zustand
  ```

