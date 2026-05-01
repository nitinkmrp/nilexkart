# 🔌 Connect React App → Express → MongoDB

---

## Your Project Layout

```
Desktop/
├── react-FSD-project-ecommerce-main/   ← React frontend (port 3000)
│   ├── src/
│   │   ├── services/userApi.js
│   │   ├── app/userSlice.js
│   │   └── ...
│   ├── .env                            ← CREATE THIS (step 2)
│   └── package.json
│
└── userbase/                           ← Express backend (port 8800)
    ├── backend/
    │   ├── .env                        ← EDIT THIS (step 1)
    │   ├── server.js
    │   └── config/db.js
    └── ...
```

---

## Step 1 — Set your MongoDB URI in the backend

Open `userbase/backend/.env` and replace the placeholder:

### Option A — MongoDB Atlas (free, cloud) ✅ Recommended

1. Go to **https://cloud.mongodb.com** → sign up / log in
2. Create a free **M0 cluster**
3. **Database Access** → Add Database User
   - Username: `nitin`
   - Password: `choose a password`
   - Role: `Read and write to any database`
4. **Network Access** → Add IP Address → click **"Allow Access from Anywhere"** → Confirm
5. **Clusters** → click **Connect** → **Drivers** → copy the URI

It looks like:
```
mongodb+srv://nitin:yourpassword@cluster0.ab12cd.mongodb.net/?retryWrites=true&w=majority
```

Paste it into `.env` and add your DB name:
```env
MONGO_URI=mongodb+srv://nitin:yourpassword@cluster0.ab12cd.mongodb.net/userbase?retryWrites=true&w=majority
```

### Option B — Local MongoDB

```env
MONGO_URI=mongodb://localhost:27017/userbase
```

---

## Step 2 — Create React .env file

Create a new file: `react-FSD-project-ecommerce-main/.env`

```env
REACT_APP_API_URL=http://localhost:8800
```

This tells your React app where to find the backend API.

---

## Step 3 — Start the backend

```bash
cd userbase/backend
npm install        # only needed once
npm run dev
```

✅ You should see:
```
🔗  Connecting to MongoDB...
    URI ➜  mongodb+srv://nitin:****@cluster0.ab12cd.mongodb.net/userbase

✅  MongoDB connected
    Database ➜  userbase
    Host     ➜  cluster0.ab12cd.mongodb.net

🚀  Backend API    →  http://localhost:8800/api/users
🌐  React dev      →  http://localhost:3000  (run: npm start)
```

---

## Step 4 — Start the React app

Open a **second terminal**:

```bash
cd react-FSD-project-ecommerce-main
npm install        # only needed once
npm start
```

✅ React opens at **http://localhost:3000**

---

## Step 5 — Verify connection

Open your browser and visit:
```
http://localhost:8800/health
```

You should see:
```json
{ "status": "ok", "message": "UserBase API is running", "db": "connected" }
```

Then open:
```
http://localhost:8800/api/users
```

Returns `{ "data": [], "count": 0 }` → backend + MongoDB are working ✅

---

## How data flows

```
React (port 3000)
    │
    │  fetch("http://localhost:8800/api/users")
    ▼
Express (port 8800)
    │
    │  mongoose.connect(MONGO_URI)
    ▼
MongoDB Atlas (cloud)  OR  Local MongoDB
```

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ECONNREFUSED 8800` | Backend not running — run `npm run dev` in `userbase/backend` |
| `Authentication failed` | Wrong password in `MONGO_URI` |
| `Connection timed out` | Atlas IP whitelist — add `0.0.0.0/0` in Network Access |
| `CORS error` in browser | Backend already handles it — make sure `.env` has `REACT_APP_API_URL=http://localhost:8800` |
| `Module not found: userApi` | Create `src/services/userApi.js` in your React project |

