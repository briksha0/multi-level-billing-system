# Multi-Level Billing & Stock Management System

A complete **full-stack** multi-level billing, inventory, and distribution management system with **SQLite database** + **Express.js API backend** + **React frontend**.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  Admin · SS · Distributor · Retailer · Role-based Routing    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP /api/*
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js API Server (Port 3001)               │
│  Auth · Users · Products · Stock · Billing · Reports         │
└──────────────────────────────┬──────────────────────────────┘
                               │ better-sqlite3
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLite Database                          │
│  data/mlb_system.db (auto-created + seeded on first run)    │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Business Flow

**Admin → SS (Super Store) → Distributor → Retailer → Customer**

Each level receives stock, maintains its own inventory, creates bills for the next level, and the system **automatically records stock movement and payments** in the database.

## ✨ Features

### 🔐 Role-Based Access Control (Backend-Enforced)
- **Admin** - Complete system management
- **SS (Super Store)** - Wholesale management
- **Distributor** - Distribution management  
- **Retailer** - Retail sales + invoice printing

### 💾 Database-Powered Features
- **Automated Stock Transfer** - Creating a bill automatically:
  - ✅ Deducts stock from seller
  - ✅ Adds stock to buyer
  - ✅ Creates `stock_transactions` record
  - ✅ All wrapped in a database transaction
- **Hierarchical Permissions** - Backend validates every request. A distributor can NEVER access another distributor's data, even by manipulating IDs
- **Secure Authentication** - JWT tokens + bcrypt password hashing
- **Payment System** - Cash, UPI, Bank Transfer, Credit, Partial Payments
- **Complete Audit Trail** - Every stock movement recorded

### 📊 Comprehensive Reports
- Sales by level / by buyer / by product
- Payment status distribution
- Outstanding payments tracking
- Monthly sales trends
- Low stock alerts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Step 1: Install dependencies
```bash
npm install
```

### Step 2: Start the full stack (frontend + backend)
```bash
npm run dev
```

This starts **both** servers concurrently:
- 🌐 **Frontend**: http://localhost:5173 (Vite dev server with HMR)
- 🔌 **Backend API**: http://localhost:3001 (Express + SQLite)

The database (`data/mlb_system.db`) is **automatically created and seeded** with demo data on first run.

### Alternative: Run servers separately
```bash
# Terminal 1: Backend only
npm run server

# Terminal 2: Frontend only  
npm run client
```

### Production build
```bash
npm run build       # Build frontend to dist/
npm start           # Run production server (serves frontend + API)
```

### Reset database
```bash
npm run db:reset    # Deletes database, re-seeds on next start
```

## 🔑 Demo Credentials

| Role Panel | Username | Password |
|-----------|----------|----------|
| 👑 **Admin** | `admin` | `admin123` |
| 🏪 **Super Store** | `ss_agra` | `ss123` |
| 📦 **Distributor** | `dist_a` | `dist123` |
| 🛒 **Retailer** | `retail_a` | `retail123` |

## 📁 Project Structure

```
multi-level-billing-system/
├── server/                     # 🟢 Backend (Node.js + Express)
│   ├── index.js                # Express server entry point
│   ├── db/
│   │   └── init.js             # SQLite schema + auto-seed
│   ├── middleware/
│   │   └── auth.js             # JWT auth + role hierarchy checks
│   └── routes/
│       ├── auth.js             # Login / token endpoints
│       ├── users.js            # User CRUD + hierarchy
│       ├── products.js         # Products + categories
│       ├── stock.js            # Stock + transactions
│       ├── billing.js          # Bills + payments + customers
│       └── reports.js          # Analytics endpoints
├── src/                        # 🔵 Frontend (React)
│   ├── api.js                  # API helper module
│   ├── App.jsx                 # Routing with protected routes
│   ├── main.jsx
│   ├── index.css               # Tailwind + custom styles
│   ├── context/
│   │   ├── AuthContext.jsx     # Auth state (JWT)
│   │   └── DataContext.jsx     # Data state (API-backed)
│   ├── components/             # Layouts + shared components
│   └── pages/                  # Pages organized by role
│       ├── admin/
│       ├── ss/
│       ├── distributor/
│       └── retailer/
├── data/                       # SQLite database (auto-created)
├── package.json
├── vite.config.js              # Vite + API proxy config
├── tailwind.config.js
└── README.md
```

## 🗄️ Database Schema (SQLite)

| Table | Purpose |
|-------|---------|
| `users` | All system users with `parent_id` for hierarchy |
| `categories` | Product categories |
| `products` | Product master with pricing, GST, HSN |
| `stock` | Current inventory per user per product |
| `bills` | Invoice headers |
| `bill_items` | Products in each invoice |
| `stock_transactions` | Every stock movement with audit trail |
| `payments` | Payment records |
| `customers` | Retail customers |
| `notifications` | System alerts |
| `audit_logs` | User activity history |

## 🔒 Security Model

Permissions are enforced at the **API level**, not just hidden in the UI:

| Role | Can Access |
|------|-----------|
| **ADMIN** | Everything in the system |
| **SS** | Only their own distributors + their retailers |
| **DISTRIBUTOR** | Only their own retailers |
| **RETAILER** | Only their own customers and data |

The backend validates the hierarchy on every request. Manually changing an ID in the URL will return `403 Access Denied`.

## 🛣️ API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Login, returns JWT | Public |
| GET | `/api/auth/me` | Get current user | Required |
| GET/POST | `/api/users` | List / create users | Required |
| GET/POST | `/api/products` | List / create products | Required |
| GET | `/api/stock` | Get user stock | Required |
| POST | `/api/stock/add` | Add opening stock | Admin only |
| GET/POST | `/api/bills` | List / create bills | Required |
| POST | `/api/bills/:id/payments` | Add payment to bill | Required |
| GET | `/api/reports/summary` | Dashboard summary | Required |
| GET | `/api/reports/*` | Various analytics | Required |
| GET | `/api/health` | Health check | Public |

## 🧪 Testing the Flow

1. **Login as Admin** → Go to Billing → Create a bill to SS Agra
2. **Login as SS Agra** → Stock increased automatically → Bill to Distributor A
3. **Login as Distributor A** → Stock increased automatically → Bill to Retailer A
4. **Login as Retailer A** → Stock increased automatically → Create customer bill → Print invoice
5. **Check Reports** in any panel to see analytics update in real-time
