# Anegudde Temple Inventory Backend

FastAPI + PostgreSQL backend for vendor, item, purchase, consumption, wastage, stock, reports, and dashboard.

## Tech
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL

## Project Path
`D:\python_project\AneguddeTemple\backend`

## Setup
```powershell
cd D:\python_project\AneguddeTemple\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Environment
Create `.env` from `.env.example` and fill DB password.

Example:
```env
DATABASE_URL=postgresql://postgres:123456@localhost:5433/anegudde_temple
SECRET_KEY=your_super_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Database
Run migrations:
```powershell
alembic upgrade head
```

Seed roles, privileges, and admin:
```powershell
python -m app.seed
```

Default admin:
- username: `admin`
- password: `admin123`

## Run Server
```powershell
uvicorn app.main:app --reload --port 8006
```

Swagger:
- http://127.0.0.1:8006/docs

## Modules
- Auth: `/auth/*`
- Vendors: `/vendors/*`
- Units: `/units/*`
- Item Categories: `/item-categories/*`
- Items: `/items/*`
- Purchases: `/purchases/*`
- Consumptions: `/consumptions/*`
- Wastages: `/wastages/*`
- Vendor Payments: `/vendor-payments/*`
- Reports: `/reports/*`
- Dashboard: `/dashboard/*`

## Key Features
- JWT auth
- Master + transaction CRUD APIs
- Stock automation through `stock_ledger`
- Daily/monthly/yearly reports
- Combined stock-finance card report
- Dashboard summary endpoints
- Request logging middleware + global 500 handler
- Pagination/search/sort in list endpoints

## Postman
Use collection file:
- `AneguddeTemple_FULL.postman_collection.json`

Set collection variables:
- `base_url = http://127.0.0.1:8006`
- `token = <JWT from /auth/login>`

## Notes
- This folder is currently not a git repository, so no git tag was created.
