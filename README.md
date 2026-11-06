# CampusSync

CampusSync is served by a Java 17+ Spring Boot backend on port `8000`. PostgreSQL stores accounts, sessions, onboarding data, workspace snapshots, messages, uploaded files, and calendar imports. The frontend is served by the Java application from this project directory.

## Run locally on Windows

### 1. Start your installed PostgreSQL service

```powershell
Get-Service *postgresql*
Start-Service postgresql-x64-18
```

If the service is already running, continue to the backend. The default development database is `campussync` on `localhost:5432`; configure `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` in the Java process environment if your PostgreSQL setup uses different values.

### 2. Build and start the Java backend

The backend requires Java 17 or newer and Maven. If it is already running, stop it with `Ctrl+C` before rebuilding the JAR. From PowerShell:

```powershell
Set-Location 'C:\Users\RUPAM\Desktop\Java Project\backend'
mvn test
mvn package
java -jar target\campussync-backend-1.0.0.jar
```

If Maven is not on `PATH` in this environment, use the bundled Maven executable:

```powershell
& 'C:\Users\RUPAM\Desktop\dept\maven\bin\mvn.cmd' test
& 'C:\Users\RUPAM\Desktop\dept\maven\bin\mvn.cmd' package
```

Spring Boot applies the Flyway schema migration on startup. Open <http://localhost:8000/>.

To override database settings in PowerShell, set the environment variables before starting Java:

```powershell
$env:DATABASE_URL = 'jdbc:postgresql://localhost:5432/campussync'
$env:DATABASE_USERNAME = 'campussync'
$env:DATABASE_PASSWORD = 'your-local-database-password'
```

### Administrator and role permissions

Student, faculty, and staff are campus roles. Users can select a campus role during initial onboarding, but cannot change a completed role or department themselves. To enable member/role management, set one or more trusted administrator account emails before starting the backend:

```powershell
$env:CAMPUSSYNC_ADMIN_EMAILS = 'admin@example.edu'
```

Only these allowlisted accounts receive the **Manage members & roles** control and can list accounts or update campus roles/departments through the admin API. Admin status is not a profile field and cannot be granted by editing a request or account profile. Leave the variable empty if no account should have administrator access. Use addresses for accounts that already exist in CampusSync.

### Optional: add fictional dashboard activity

After the backend is connected to PostgreSQL and the account you want to view already exists, run this from the project folder. Replace the email with that account's address:

```powershell
$ownerEmail = 'your-account@example.edu'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' `
  --host localhost --port 5432 --username campussync --dbname campussync `
  --set "owner_email=$ownerEmail" --file '.\backend\scripts\seed-campus-demo.sql'
```

`psql` prompts for the PostgreSQL password. The script safely adds 500 non-loginable fictional accounts using reserved `example.test` addresses, simulated messages and read receipts, eight messages for the selected account, and announcements in that account's workspace. It is safe to rerun and does not replace existing announcements or accounts.

### 3. Optional integrations

- **Google sign-in:** In Google Cloud Console, authorize the exact JavaScript origin `http://localhost:8000`. The frontend and backend must use the same host and port.
- **Gemini AI:** Set `GEMINI_API_KEY` in the Java process environment before starting the backend. The default model is `gemini-3.5-flash-lite`, selected for low latency; inbox message optimization also requests low thinking and bounds its output size. For department-routed messages and announcements, the backend sends the router's candidate departments and the optimized message to Gemini for a final relevance review. Gemini may keep relevant suggestions and add relevant departments from the supported catalog; the backend rejects department names outside that catalog. Announcement drafts use the authenticated sender's saved role and designation and resolve relative dates such as “tomorrow” against the current date in the Asia/Kolkata campus timezone. Set `GEMINI_MODEL` before startup to override the default. The server does not read the previous Node server's `.env`.
- **Department routing:** Build the existing router project so `C:\Users\RUPAM\Desktop\dept\target\department-router-1.0-shaded.jar` exists. The backend checks the configured relative path from its working directory and parent directories, so the default also works when this project is nested in a clone folder. To use a different location, set `DEPARTMENT_ROUTER_JAR`. Without the JAR, normal sign-in and non-routing features work; AI routing reports an explicit unavailable error.
- Set `COOKIE_SECURE=true` only when serving over HTTPS. Keep database passwords and API keys out of source control.

## Main API routes

| Route | Purpose |
|---|---|
| `GET /health` | Backend health and optional AI configuration |
| `POST /api/auth/register`, `/login`, `/google`, `/google/register`, `/api/auth/logout` | Account and session management; Google sign-in uses existing accounts, and `/google/register` creates a new account with a required password |
| `GET /api/auth/me` | Current signed-in account |
| `GET /api/onboarding`, `PUT /api/onboarding/{step}`, `PUT /api/onboarding/profile/details` | Profile editing and onboarding persistence |
| `GET /api/contacts?q=...` | Search CampusSync accounts |
| `GET /api/admin/users`, `PUT /api/admin/users/{id}/role` | Allowlisted administrator member and campus-role management |
| `GET`, `POST /api/messages` | Read and send personal or department messages |
| `PUT /api/messages/{id}/read`, `/unread` | Per-recipient message read state |
| `GET`, `PUT`, `DELETE /api/workspace/{collection}` | User-owned feature state |
| `POST /api/files`, `GET /api/files/{id}` | Upload and retrieve account-owned attachments |
| `/university-calendar` | Upload and manage a user's calendar import |
| `POST /assistant-chat` | Gemini assistant and department routing |

Protected writes require the authenticated session cookie and same-origin request header supplied by the frontend client.

## Current scope

Messages, accounts, onboarding, calendar files, and attachments are stored in PostgreSQL. Existing announcements, events, and room-booking screens persist their state as **per-user workspace snapshots**; cross-user announcement feeds, shared room inventory, and server-enforced approval workflows are not implemented yet. Treat those screens as prototype workflows, not authoritative campus-wide records.

The profile menu on dashboard pages includes an editor for a user's name, contact details, profile photo, and student or employment details. Email remains read-only because it is the account's sign-in identifier; completed campus role and department changes require an allowlisted administrator. Student, faculty, and staff members can use their regular workspace features, while administrator-only account management is checked by the backend as well as hidden from other users.

The dashboard retains its original circular activity chart, room snapshot, announcement and pending-action cards, and department activity table. Its statistics and presentation cards use the signed-in user's saved messages, announcements, events, and room bookings when available; the original starter cards remain as a fallback when a workspace has no matching data. Unsupported recipient-delivery metrics are cleared and shown as untracked. Approval and booking demo controls have been removed.

The room-booking and event venue selectors share the supplied C.V. Raman, SR, X-Lab, J.C. Bose, Vikram Sarabhai, Homi J. Bhabha, and NAB directories. Entries distinguish documented locations from proposed placeholders. Room capacities, equipment, and live campus-wide availability were not supplied; the interface does not invent these values, and conflict checks cover only reservations recorded in the current user's workspace.

The backend integration test uses an in-memory H2 database and verifies registration, authentication, onboarding, persistence, direct messages, department messages, and per-user read receipts. It does not replace a live PostgreSQL deployment test.
