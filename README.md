# Transaction Management System

A small full-stack app for viewing and recording financial transactions. Transactions are stored in a CSV file on disk — there is no database.

- **Backend:** Java 17 + Spring Boot (REST API, reads/writes a CSV file)
- **Frontend:** React + TypeScript (via Vite)

This README assumes no prior familiarity with Spring Boot, Maven, React, or Vite — every command needed to get the app running is spelled out below.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [API Documentation](#api-documentation)
7. [Data Integrity (ACID on a CSV File)](#data-integrity-acid-on-a-csv-file)
8. [Dashboard Features](#dashboard-features)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [AI Tool Usage Disclosure](#ai-tool-usage-disclosure)

---

## Project Structure

```
transaction-management-system/
├── backend/                  Spring Boot API (Java)
│   ├── data/
│   │   └── transactions.csv  The CSV "database" — pre-loaded with sample data
│   ├── src/main/java/com/transactionmanagement/
│   │   ├── controller/       REST endpoints (GET/POST /transactions)
│   │   ├── service/          CSV read/write logic
│   │   ├── model/            Internal domain model (Transaction, TransactionStatus)
│   │   ├── dto/               Request/response shapes exposed by the API
│   │   ├── config/            CORS configuration
│   │   └── exception/         Centralized error handling
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml                Maven project file (dependency list + build config)
│
└── frontend/                  React + TypeScript app (Vite)
    ├── src/
    │   ├── api/                Functions that call the backend API
    │   ├── components/         TransactionTable (sort/filter/pagination), AddTransactionModal, StatusBadge
    │   ├── types/               Shared TypeScript types
    │   └── App.tsx               Top-level page
    ├── .env.example
    └── package.json
```

---

## Prerequisites

Install these before you start. Version numbers matter less than "recent enough" — anything equal to or newer than what's listed will work.

| Tool | Minimum Version | Check your version | Download |
|---|---|---|---|
| **Java JDK** | 17 | `java -version` | [Adoptium Temurin 17](https://adoptium.net/temurin/releases/?version=17) |
| **Maven** | 3.6+ | `mvn -version` | [maven.apache.org/download](https://maven.apache.org/download.cgi) (see note below) |
| **Node.js** | 18+ (20 LTS recommended) | `node -v` | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ (bundled with Node.js) | `npm -v` | Comes with Node.js |

**About Maven:** if `mvn -version` fails, install Maven and make sure it's on your `PATH`:
- **Windows:** download the "Binary zip archive" from the link above, unzip it somewhere permanent (e.g. `C:\apache-maven-3.9.9`), then add `C:\apache-maven-3.9.9\bin` to your `PATH` environment variable (Settings → System → About → Advanced system settings → Environment Variables). Open a **new** terminal afterwards so the change takes effect.
- **macOS:** `brew install maven`
- **Linux (Debian/Ubuntu):** `sudo apt install maven`

You do **not** need to install anything related to CSV handling, a database, or Docker — none of that is used here.

---

## Installation

Clone or download this repository, then open a terminal **in the project's root folder** (the folder containing `backend/` and `frontend/`).

### 1. Backend

```bash
cd backend
mvn install
```

This downloads all Java dependencies (Spring Boot, OpenCSV, etc.) and compiles the project. The first run can take a minute or two while Maven downloads packages — subsequent runs are fast.

### 2. Frontend

```bash
cd frontend
npm install
```

This downloads all JavaScript/TypeScript dependencies into a `frontend/node_modules` folder.

---

## Configuration

Nothing needs to be changed to run the app locally with default settings — this section just explains what's configurable.

### Backend — `backend/src/main/resources/application.properties`

```properties
server.port=8080
transactions.csv.path=data/transactions.csv
app.cors.allowed-origin=http://localhost:5173
```

- `server.port` — port the API listens on.
- `transactions.csv.path` — where the CSV file lives, relative to the directory you run the backend from (i.e. `backend/`). If the file doesn't exist yet, it's created automatically with just a header row.
- `app.cors.allowed-origin` — the only origin allowed to call this API from a browser. It's pre-set to the frontend's default dev URL.

### Frontend — `frontend/.env`

The frontend needs to know where the backend is running. Copy the example file:

```bash
cd frontend
cp .env.example .env
```

(On Windows PowerShell, use `copy .env.example .env` instead.)

`.env` contains:

```
VITE_API_BASE_URL=http://localhost:8080
```

Leave this as-is unless you changed `server.port` in the backend config. The app also falls back to `http://localhost:8080` automatically if `.env` is missing, so creating it is optional for the default setup.

---

## Running the Application

You need **two terminals** open at the same time — one for the backend, one for the frontend.

### Terminal 1 — start the backend

```bash
cd backend
mvn spring-boot:run
```

Wait until you see a line like `Started TransactionManagementApplication in X seconds`. The API is now running at **http://localhost:8080**.

Leave this terminal running. To stop the server later, press `Ctrl+C` in this terminal.

### Terminal 2 — start the frontend

```bash
cd frontend
npm run dev
```

Vite will print a local URL, typically:

```
➜  Local:   http://localhost:5173/
```

Open that URL in your browser. You should see a "Transactions" table pre-loaded with sample data, and an "Add Transaction" button.

To stop the frontend later, press `Ctrl+C` in this terminal.

> **Order matters the first time:** start the backend before the frontend, so the initial transaction list loads successfully. If you open the frontend first, it'll show a "Could not reach the server" message with a **Retry** button — just click Retry once the backend is up.

---

## API Documentation

Base URL: `http://localhost:8080`

### `GET /transactions`

Returns every transaction currently stored in the CSV file.

**Request:** no parameters or body.

**Response:** `200 OK`

```json
[
  {
    "transactionDate": "2025-03-01",
    "accountNumber": "7289-3445-1121",
    "accountHolderName": "Maria Johnson",
    "amount": 150.00,
    "status": "Settled"
  },
  {
    "transactionDate": "2025-03-02",
    "accountNumber": "1122-3456-7890",
    "accountHolderName": "John Smith",
    "amount": 75.50,
    "status": "Pending"
  }
]
```

### `POST /transactions`

Adds a new transaction. The server assigns `status` randomly (`Pending`, `Settled`, or `Failed`) — it is not supplied by the client.

**Request body:**

```json
{
  "transactionDate": "2025-03-15",
  "accountNumber": "1111-2222-3333",
  "accountHolderName": "Alex Rivera",
  "amount": 199.99
}
```

**Response:** `201 Created`

```json
{
  "transactionDate": "2025-03-15",
  "accountNumber": "1111-2222-3333",
  "accountHolderName": "Alex Rivera",
  "amount": 199.99,
  "status": "Failed"
}
```

**Validation errors:** `400 Bad Request` if a required field is missing, the amount is zero, negative or has more than 13 digits before the decimal point, the date is in the future, or the body is malformed, e.g.:

```json
{
  "timestamp": "2025-03-15T10:00:00Z",
  "status": 400,
  "message": "Validation failed",
  "details": ["accountHolderName: accountHolderName is required"]
}
```

**Server errors:** `500 Internal Server Error` if the CSV file can't be read or written (e.g. permissions issue).

---

## Data Integrity (ACID on a CSV File)

A flat file has none of a real database's transactional guarantees — the filesystem will happily leave you with a half-written row if the process dies mid-write, or two concurrent writers stomping on each other. `TransactionService` (in `backend/src/main/java/com/transactionmanagement/service/TransactionService.java`) enforces all four properties by hand:

| Property | How it's enforced |
|---|---|
| **Atomicity** | A new row is fully formatted as a string **in memory** before anything touches disk, then appended with a single `write()` call. A crash before that call leaves the file completely untouched; there is no code path that can leave a half-written row like `2025-03-11,4646-8282-1919,Ama`. |
| **Consistency** | `transactionDate` and `amount` are typed as `LocalDate`/`BigDecimal` (not `String`), so Jackson itself rejects anything that isn't a strictly valid `YYYY-MM-DD` date or decimal number before the request even reaches application code — this also catches calendar-invalid dates like `2025-02-30`, which a regex alone wouldn't. `accountNumber` and `accountHolderName` have explicit `@Pattern` validation (12 digits; letters/spaces only). `status` can't be inconsistent by construction — it's a closed Java enum the server assigns itself, never read from client input. |
| **Isolation** | `getAllTransactions()`/`addTransaction()` are `synchronized` (serializes concurrent requests within the running process), **and** every read/write additionally takes a real OS-level file lock (`FileChannel.lock()` — exclusive for writes, shared for reads), so two simultaneous "Add Transaction" clicks can never interleave or overwrite each other, even across separate processes. |
| **Durability** | Before `addTransaction()` returns (and therefore before the API responds `201 Created`), it calls `FileChannel.force(true)` — an `fsync` — which blocks until the OS has actually flushed those bytes to physical disk, not just handed them to a buffer. A successful response is a guarantee the row survived, not an optimistic assumption. |

### How to test each one yourself

**Isolation + Atomicity** — fire a burst of concurrent `POST` requests and confirm every single one lands as a clean, complete row with nothing lost or garbled:

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/transactions \
    -H "Content-Type: application/json" \
    -d "{\"transactionDate\":\"2025-04-01\",\"accountNumber\":\"$(printf '%04d' $i)-0000-0000\",\"accountHolderName\":\"Concurrent Tester\",\"amount\":$i.00}" &
done
wait
```

Then check the CSV: `grep -c "Concurrent Tester" backend/data/transactions.csv` should print exactly `25`, each on its own well-formed line. This is also covered by an automated test — `addTransaction_isSafeUnderConcurrentWrites()` in `backend/src/test/java/.../TransactionServiceTest.java` — which fires 20 threads at the service simultaneously via a `CountDownLatch` and asserts all 20 rows come back distinct and parseable.

**Consistency** — send deliberately malformed payloads and confirm each is rejected with `400` and never touches the CSV:

```bash
# Bad date format
curl -w "\n%{http_code}\n" -X POST http://localhost:8080/transactions -H "Content-Type: application/json" \
  -d '{"transactionDate":"15-03-2025","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":10.00}'

# Non-numeric amount
curl -w "\n%{http_code}\n" -X POST http://localhost:8080/transactions -H "Content-Type: application/json" \
  -d '{"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":"abc"}'

# Letters in account number / digits in name
curl -w "\n%{http_code}\n" -X POST http://localhost:8080/transactions -H "Content-Type: application/json" \
  -d '{"transactionDate":"2025-03-15","accountNumber":"abcd-5678-9012","accountHolderName":"Jane123","amount":10.00}'
```

Each should return `400` with a message naming the specific bad field. Also covered by `TransactionControllerValidationTest`.

**Durability** — prove a committed row survives even a hard crash, not just a clean shutdown:

1. `POST` a transaction and confirm you get `201 Created`.
2. Immediately force-kill the backend process (not `Ctrl+C` — an actual hard kill, e.g. Task Manager → End Task, or `taskkill /F /PID <pid>` / `kill -9 <pid>`).
3. Check `backend/data/transactions.csv` directly — the row is already there, because the `fsync` completed before step 1's response was ever sent.
4. Restart the backend (`mvn spring-boot:run`) and confirm `GET /transactions` still returns it from a cold process.

If `force(true)` weren't there, a hard kill timed right after the response could still lose the write (sitting in a buffer that a graceful shutdown would have flushed, but a hard kill wouldn't) — this test specifically rules that out.

---

## Dashboard Features

On top of the required table and modal, the frontend adds a few client-side-only enhancements (no new API calls — all computed from the same `GET /transactions` response already in memory):

- **Search** — a search box in the top bar finds transactions by account holder name (case-insensitive) or account number (hyphens optional, so `11223456` matches `1122-3456-7890`). A result count appears above the table while a search is active.
- **Status filter** — a funnel icon beside the "Status" column header opens an All / Pending / Settled / Failed menu, each showing a live count; selecting one narrows the table instantly. A dot on the icon shows when a filter is active.
- **Sortable columns** — click the "Transaction Date" or "Amount" column header to sort by it; click again to reverse direction (▲/▼ indicates the active sort).
- **Pagination** — a "Rows per page" dropdown (5 / 10 / 25 / 50, default 10) with Previous/Next controls, so the table stays usable as the CSV grows well past the 12 sample rows.

Search, filtering, sorting and pagination compose together (e.g. search "john", filter to "Pending", then sort by Amount) and all reset to page 1 whenever the search, filter, sort or page size changes.

---

## Testing

### Option A — Use the UI (recommended)

1. With both servers running, open `http://localhost:5173` in your browser.
2. Confirm the table shows the 12 pre-loaded sample transactions, with status badges colored yellow (Pending), green (Settled), or red (Failed).
3. Click **Add Transaction**, fill in the form, and click **Add Transaction** again. Review the summary that appears and click **Confirm and record** (or **Back to edit** to change something).
4. Confirm the new row appears at the bottom of the table with a randomly assigned status.
5. Refresh the page — the new transaction should still be there (it's now saved in `backend/data/transactions.csv`).
6. Open `backend/data/transactions.csv` in a text editor to confirm the row was actually appended to the file.

### Option B — Test the API directly

With the backend running, from a terminal that has `curl` (macOS/Linux Terminal, Git Bash, or WSL on Windows — in plain Windows PowerShell use `curl.exe` instead of `curl`, since `curl` is aliased to a different command there):

```bash
# Fetch all transactions
curl http://localhost:8080/transactions

# Add a transaction
curl -X POST http://localhost:8080/transactions \
  -H "Content-Type: application/json" \
  -d '{"transactionDate":"2025-03-20","accountNumber":"9999-8888-7777","accountHolderName":"Test User","amount":42.50}'
```

### Option C — Backend unit/integration tests

```bash
cd backend
mvn test
```

19 tests total: CSV read/write behavior, the concurrent-write safety test described in [Data Integrity](#data-integrity-acid-on-a-csv-file), and controller-level validation tests for every rejected payload shape.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Frontend shows "Could not reach the server" | Backend isn't running, or isn't fully started yet | Start/wait for the backend (Terminal 1), then click **Retry** |
| Browser console shows a CORS error | Frontend is running on a port other than 5173 | Either run the frontend on its default port, or update `app.cors.allowed-origin` in `application.properties` to match |
| `mvn` / `java` command not found | Not installed or not on `PATH` | Revisit [Prerequisites](#prerequisites); open a **new** terminal after installing |
| Port 8080 already in use | Another process is using that port | Either stop that process, or change `server.port` in `application.properties` and `VITE_API_BASE_URL` in `frontend/.env` to match |
| Port 5173 already in use | Another Vite project is running | Vite will automatically try the next free port (5174, etc.) — check the terminal output for the actual URL |
| New transactions don't persist after restarting the backend | Not a bug — they're written to `backend/data/transactions.csv`; check that file directly | — |

---

## AI Tool Usage Disclosure

This project was built with the assistance of **Claude** (Anthropic's AI coding assistant), used as a pair-programming tool throughout:

- **Scaffolding both projects** — generating the Maven/Spring Boot project structure and the Vite/React/TypeScript project structure.
- **Backend implementation** — the CSV read/write service (using OpenCSV for RFC-4180-correct parsing/escaping rather than hand-rolled string splitting), the REST controller, request validation, centralized error handling, CORS configuration, and the hand-rolled ACID guarantees described in [Data Integrity](#data-integrity-acid-on-a-csv-file) (in-memory buffering for atomicity, `@Pattern`-based consistency checks, `FileChannel` locking for isolation, `fsync` for durability).
- **Frontend implementation** — the transaction table, the Add Transaction modal with client-side validation, API client functions with error handling, status-color styling, and the dashboard enhancements described in [Dashboard Features](#dashboard-features) (status filter tabs, sortable columns, pagination).
- **Verification** — running `npm run build` and lint, and driving the running app in a headless browser to confirm the table, error states, and modal all render and behave correctly before considering the frontend done.
- **This README** — drafted to be followable by someone with no prior Spring Boot or React/Vite experience.

All generated code was reviewed before being committed. Architecture and technology choices (Spring Boot + React/TypeScript, CSV as the data store, project layout) reflect the task requirements and my own familiarity with this stack.
