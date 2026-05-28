# 🛒 NilexKart — Full Stack Marketplace Platform

> A production-ready, full-stack e-commerce marketplace built with the **MERN Stack** — featuring real-time chat, Razorpay payments, Cloudinary media, and JWT authentication.

![MERN Stack](https://img.shields.io/badge/Stack-MERN-7c3aed?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)
![Deployed](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render)

---

## 🌐 Live Demo

| Platform | Link |
|---|---|
| 🌍 Website | [www.nilex.in](https://www.nilex.in/) |
| 💻 GitHub | [github.com/nitinkmrp/nilexkart](https://github.com/nitinkmrp/nilexkart) |

---

## 📌 About the Project

**Nilexkart** is an online product marketplace where users can:
- Post products for sale with images and descriptions
- Browse, search, and filter listings by category
- Purchase products via Razorpay payment gateway
- Manage their listings through a personal dashboard

Built and deployed independently by **Nitin Patel** as a full-stack personal project.

---

## 🧱 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | Component-based UI framework |
| Redux Toolkit | Global state management |
| React Router v6 | Client-side routing & navigation |
| Bootstrap 5 + React-Bootstrap | Responsive UI components |
| Axios | HTTP API requests |
| react-slick | Product image carousels |
| react-toastify | Toast notifications |
| react-spinners | Loading states |
| react-select | Searchable dropdowns |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API framework |
| Mongoose | MongoDB ODM |
| JSON Web Token (JWT) | Secure authentication |
| bcryptjs | Password hashing |
| Socket.io | Real-time messaging |
| Multer | File upload middleware |
| Cloudinary | Cloud image storage |
| Nodemailer | Email OTP & notifications |
| Razorpay | Payment gateway |
| Helmet.js | HTTP security headers |
| express-rate-limit | API rate limiting / DDoS protection |

### Database & Deployment
| Technology | Purpose |
|---|---|
| MongoDB Atlas | Cloud-hosted NoSQL database |
| Render | Backend deployment |
| Netlify | Frontend static deployment |

---

## ✨ Key Features

- 🔐 **JWT Authentication** — Secure login/signup with bcryptjs hashing and role-based access (Admin / User)
- 🛍️ **Product Marketplace** — Post, browse, filter and manage listings with multi-image upload
- 💬 **Real-Time Chat** — Buyer-seller messaging via Socket.io (no page refresh required)
- 💳 **Razorpay Payments** — UPI, card, and netbanking support with server-side order verification
- ☁️ **Cloudinary Media** — Cloud image storage via Multer-Cloudinary adapter
- 📧 **Email Notifications** — OTP verification and order confirmations via Nodemailer
- 🛡️ **Security Hardened** — Helmet.js + express-rate-limit to prevent attacks and abuse
- 📱 **Mobile App** — Companion apps built in React Native & Flutter using the same REST APIs

---

## 📁 Project Structure

```
nilexkart/
├── backend/
│   ├── config/          # DB & Cloudinary configuration
│   ├── middleware/       # Auth, rate-limit middleware
│   ├── models/           # Mongoose schemas (User, Product, Chat)
│   ├── routes/           # API route handlers
│   ├── utils/            # JWT, email, helper functions
│   ├── uploads/          # Temporary file storage
│   └── server.js         # Express app entry point
│
├── frontend/
│   ├── public/           # Static assets
│   └── src/
│       ├── app/          # Redux store & slices
│       ├── components/   # Reusable UI components
│       ├── hooks/        # Custom React hooks
│       ├── pages/        # Page-level components
│       ├── services/     # API service functions
│       ├── utils/        # Frontend utilities
│       └── App.js        # Root component & routing
│
└── render.yaml           # Render deployment config
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Cloudinary account
- Razorpay account

### 1. Clone the Repository
```bash
git clone https://github.com/nitinkmrp/nilexkart.git
cd nilexkart
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

```bash
npm run dev      # Development (nodemon)
npm start        # Production
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:
```env
REACT_APP_API_URL=http://localhost:5000
```

```bash
npm start        # Development server
npm run build    # Production build
```

---

## 📦 Backend Dependencies

```json
{
  "express": "^4.18.2",
  "mongoose": "^8.3.2",
  "jsonwebtoken": "^9.0.3",
  "bcryptjs": "^3.0.3",
  "cloudinary": "^1.41.3",
  "multer": "^2.1.1",
  "multer-storage-cloudinary": "^4.0.0",
  "nodemailer": "^8.0.7",
  "razorpay": "^2.9.6",
  "helmet": "^8.2.0",
  "express-rate-limit": "^8.5.2",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5"
}
```

## 📦 Frontend Dependencies

```json
{
  "react": "^18.2.0",
  "react-router-dom": "^6.11.1",
  "@reduxjs/toolkit": "^1.9.7",
  "react-redux": "^8.1.3",
  "axios": "^1.16.1",
  "bootstrap": "^5.2.3",
  "react-bootstrap": "^2.7.4",
  "react-toastify": "^9.1.2",
  "react-spinners": "^0.13.8",
  "react-slick": "^0.29.0",
  "react-select": "^5.7.3"
}
```

---

## 🚢 Deployment

| Service | Purpose |
|---|---|
| **Render** | Backend Node.js server (configured via `render.yaml`) |
| **MongoDB Atlas** | Production database cluster |
| **Cloudinary** | Image CDN and storage |
| **Netlify / Render Static** | Frontend React build |

---

## 👨‍💻 Developer

**Nitin Patel**
B.Tech – Information Technology | ABES Engineering College, Ghaziabad (2027)

| Contact | Link |
|---|---|
| 📧 Email | [nitinkmrp@gmail.com](mailto:nitinkmrp@gmail.com) |
| 💻 GitHub | [github.com/nitinkmrp](https://github.com/nitinkmrp) |
| 🌐 Website | [www.nilex.in](https://www.nilex.in/) |
| 📱 Phone | +91-8756824747 |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

> ⭐ If you found this project useful, consider giving it a star on GitHub!
