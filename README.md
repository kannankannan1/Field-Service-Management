# PROJECT KEYSTONE — Field Service Management

A full-stack, real-time Field Service Management (FSM) platform.

- **Backend**: Java 21, Spring Boot 3.5, Spring Security + JWT, Spring Data JPA, PostgreSQL, Flyway, WebSocket (STOMP/SockJS), Swagger/OpenAPI
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Query, Axios, STOMP WebSocket client
- **Deployment**: Docker + Docker Compose (PostgreSQL, backend, frontend/nginx)

## Features

| Area | Details |
|------|---------|
| Auth & RBAC | JWT login; roles `MANAGER`, `DISPATCHER`, `TECHNICIAN`, `CUSTOMER`; role-based routing + backend-enforced permissions |
| Customers & Sites | CRUD, customer portal user provisioning, self-scoped access for customers |
| Work Orders | CRUD, search/filter/pagination, Kanban board, lifecycle `NEW → ASSIGNED → IN_PROGRESS → ON_HOLD → COMPLETED → CLOSED`, immutable audit history, **auto-assignment to the least-loaded technician on creation**, SLA due dates |
| Parts & Stock | Inventory with reorder levels, transactional consumption on work orders (pessimistic locking), stock movements, low-stock alerts |
| Time Tracking | Start/stop timer and explicit time logs per work order; technicians only on their own jobs |
| SLA | Due-time computed from priority (URGENT 4h / HIGH 24h / MEDIUM 72h / LOW 120h), scheduled breach detection + notifications |
| Notifications | Persisted + delivered in real time over WebSocket (`/user/{username}/queue/notifications`) |
| Dashboard | Live manager/dispatcher metrics: open/overdue/SLA compliance, priority & status breakdown, technician workload, recent activity |
| Customer Portal | Customers view their work orders, sites, and can report new issues |
| API docs | Swagger UI at `/swagger-ui.html` |

## Quick start (Docker)

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:8081
- API docs: http://localhost:8080/swagger-ui.html
- Health: http://localhost:8080/actuator/health

### Demo users

| Username | Password | Role |
|----------|----------|------|
| `manager1` | `Manager@123` | Manager |
| `dispatcher1` | `Dispatcher@123` | Dispatcher |
| `tech1` / `tech2` | `Tech@123` | Technician |
| `customer1` | `Customer@123` | Customer |

Data (customers, sites, parts, work orders, history, notifications) is seeded automatically by Flyway migrations.

## Local development

### Backend

Requires JDK 21+. No database setup needed — the default profile uses an embedded in-memory H2
database (PostgreSQL compatibility mode) that is created and seeded by Flyway on startup.
Set `SPRING_PROFILES_ACTIVE=docker` (or set `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`) to use PostgreSQL.

```bash
cd backend
# zero-config dev server (in-memory H2, seeded automatically)
.\mvnw.cmd spring-boot:run
# or build & run
.\mvnw.cmd clean package
java -jar target/fieldservice-1.0.0.jar
```

Configuration is env-driven (`application.yml` / `application-docker.yml`):
`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION_MS`,
`CORS_ALLOWED_ORIGINS`, `SLA_*_HOURS`, `SLA_BREACH_CHECK_MS`, `SLA_SCHEDULER_ENABLED`.

Public signup is available at `POST /api/auth/register` (roles `CUSTOMER` or `TECHNICIAN`);
the response is a JWT `LoginResponse`, so the new user is signed in immediately. A new `CUSTOMER`
account automatically gets a customer profile plus a default site, so they can report issues right away.
Newly created work orders are automatically assigned to the enabled technician with the fewest open jobs.

Tests use an embedded H2 (PostgreSQL compatibility mode) with the same Flyway migrations:

```bash
cd backend
.\mvnw.cmd test
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5174, proxies /api and /ws to :8080
npm run build      # production build to dist/
npm run typecheck
```

## Project layout

```
backend/
  src/main/java/com/keystone/fieldservice/
    config/        # security, websocket, openapi
    controller/    # REST API
    dto/           # request/response records
    domain/        # entities + enums
    exception/     # ApiError + handlers
    repository/
    security/      # JWT + current-user plumbing
    service/       # business logic (RBAC, lifecycle, SLA, notifications)
  src/main/resources/db/migration/   # Flyway schema + seed data
frontend/
  src/api/         # axios client + typed API modules
  src/auth/        # auth context
  src/components/  # layout, UI primitives
  src/pages/       # login, dashboard, kanban, work orders, parts, portal, ...
  src/ws.ts        # STOMP WebSocket notifications
docker-compose.yml # postgres + backend + frontend
```
