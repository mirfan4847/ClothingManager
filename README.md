# Clothing Manager

## ✅ Quick Start

### Step 1 - Run Backend
```cmd
cd D:\ClothingManager\Backend
dotnet restore
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```
Backend runs at: **http://localhost:5000**
Swagger UI at:   **http://localhost:5000/swagger**

### Step 2 - Run Frontend
Open a NEW terminal:
```cmd
cd D:\ClothingManager\Frontend
npm install
npm run dev
```
Frontend runs at: **http://localhost:5173**

## 🔐 Login Credentials
| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | admin    | admin123    |
| Manager | manager  | manager123  |
| Viewer  | viewer   | viewer123   |

## 📁 Project Structure
```
ClothingManager/
├── Backend/          → ASP.NET Core 8 API
│   ├── Controllers/  → API endpoints
│   ├── Models/       → Database models
│   ├── Services/     → Business logic
│   ├── Data/         → EF Core DbContext
│   └── Properties/
│       └── launchSettings.json  → Forces http://localhost:5000
├── Frontend/         → React + Vite
│   └── src/
│       ├── pages/    → All page components
│       ├── components/ → Reusable components
│       ├── services/   → API calls (axios)
│       └── context/    → Auth state
└── Database/
    └── schema.sql    → Manual SQL script (optional)
```
