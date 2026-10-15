# SafeLink Backend Documentation

This document is a code-oriented overview of the current SafeLink backend for developers maintaining or extending it. It describes the service as implemented today, rather than an aspirational API specification.

## Purpose and stack

SafeLink is a community safety reporting service for Pangasinan. Citizens submit incident reports; Barangay, LGU, and police personnel review, coordinate, and resolve them according to their role and geographic jurisdiction.

The backend lives in [`server/`](server) and uses:

- Node.js with Express 5
- MongoDB with Mongoose
- JWT bearer tokens for authenticated API access
- bcrypt for password hashing
- Nodemailer (Gmail SMTP) for citizen verification and password-reset email
- Multer for protected image/video evidence uploads

The API base URL is `/api`. The application process starts in [`server/src/server.js`](server/src/server.js), connects to MongoDB, and begins listening only after the database connection succeeds. [`server/src/app.js`](server/src/app.js) configures middleware and mounts the route modules.

## Request flow

Most protected requests move through this sequence:

```text
HTTP request
  -> global middleware (Helmet, JSON parsing, CORS, API rate limit)
  -> route middleware (authentication, role check, validation, upload handling)
  -> controller
  -> Mongoose models / utility functions
  -> JSON response
```

`verifyToken` checks for `Authorization: Bearer <JWT>`, validates the token, then reloads the user. The account must still exist, be verified, and have `active` status. The middleware places a compact authorization context on `req.user`:

```js
{
  id: 'MongoDB user id',
  role: 'citizen | barangay_personnel | lgu_personnel | police_personnel | admin',
  jurisdiction: { barangay, municipalityOrCity }
}
```

This database re-check is intentional: a previously issued token stops working if the account becomes suspended or unverified.

## Project layout

```text
server/
  src/
    app.js                 Express configuration and route mounting
    server.js              MongoDB connection and HTTP server startup
    routes/                HTTP path-to-controller wiring
    controllers/           Request orchestration and business rules
    models/                Mongoose schemas
    middleware/            Authentication, input validation, uploads
    utils/                 Scope checks, notifications, audit logging, Pangasinan data
  scripts/seedAdmin.js     Creates or activates the initial administrator
  uploads/evidence/        Local, non-public uploaded evidence files
  postman/                 Collections and a local environment for manual API testing
```

## Configuration and startup

1. Copy `server/.env.example` to `server/.env` and supply real values.
2. Start MongoDB and set `MONGO_URI` to its connection string.
3. From `server/`, install dependencies with `npm install`.
4. Create the initial administrator with `npm run seed:admin`.
5. Run the service with `npm run dev`.

Required configuration values are:

| Variable | Used for |
| --- | --- |
| `PORT` | HTTP port; defaults to `5000` |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Signing and verifying one-day JWTs |
| `EMAIL_USER`, `EMAIL_PASS` | Gmail SMTP credentials; an app password is expected |
| `INITIAL_ADMIN_*` | Values used only by `npm run seed:admin` |
| `NODE_ENV` | Enables detailed email errors only when set to `development` |
| `CLIENT_URL` | Frontend origin used in email verification and password-reset links (`APP_URL` is accepted as a legacy fallback) |

`CLIENT_URL` is the canonical frontend-origin setting and defaults to `http://localhost:5173`. `APP_URL` is accepted only as a backward-compatible fallback for existing deployments; new environments should use `CLIENT_URL`.

There is no production start script or automated test script in the current `server/package.json`.

## Cross-cutting safeguards

- `helmet()` adds HTTP security headers.
- CORS currently allows all origins (`cors()` with no origin restriction).
- All `/api` routes share a limit of 300 requests per 15 minutes per client.
- `/api/auth` has a 20-request/15-minute limit; unsuccessful logins have an additional limit of 5 per 15 minutes.
- JSON request bodies are limited to 1 MB.
- Route validation uses `express-validator`; validation failures return HTTP 400 with an `errors` array.
- Most controllers return `{ message: '...' }` for errors. Uncaught route errors pass through the global error handler and return `500` with `Internal server error.`

## Accounts, roles, and authorization

### Roles

| Role | Primary scope and capabilities |
| --- | --- |
| `citizen` | Own account, own reports, own evidence, privacy-safe community map and analytics |
| `barangay_personnel` | Reports in their Barangay; may claim unassigned Barangay work, review reports, confirm priority, request escalation, and confirm closure |
| `lgu_personnel` | Reports and staff in their municipality/city; may approve/manage Barangay personnel, assign or refer incidents, and take over incidents for LGU response |
| `police_personnel` | Incidents assigned specifically to that officer; municipality-scoped map and analytics |
| `admin` | Personnel administration and audit logs; deliberately does not receive incident, map, or analytics access |

Jurisdiction is not merely display data. It restricts queries and is evaluated again when a personnel account is selected for assignment. Barangay personnel must match both Barangay and municipality/city; LGU and police personnel must match the municipality/city.

### Account lifecycle

```text
Citizen registration
  -> account stored with a hashed verification token
  -> verification email link (15 minutes)
  -> verified active account
  -> login issues a JWT

Personnel application or registration
  -> pending, unverified account
  -> approval by an authorized Admin or LGU account
  -> verified active account
  -> login issues a JWT
```

Passwords must be at least eight characters and contain an uppercase letter, a number, and a special character. Citizen and personnel registration currently accept only `@gmail.com` addresses. Password-reset tokens are SHA-256 hashes in MongoDB, expire after 15 minutes, and are delivered by email.

## Incident lifecycle

An incident starts with the citizen's suggested urgency. Its initial `severity` is set to that urgency, it is assigned to `Barangay`, and it receives a first response-history entry. The server also checks for likely duplicates: an active report with the same type and address area, created within 24 hours, and within 200 meters.

The supported workflow is:

```text
Submitted
  -> Under Barangay Review
  -> Verified or Rejected

Verified
  -> In Progress
  -> Resolved
  -> Closed
```

Before a Barangay worker can move a report to `Verified`, they must set the official severity/priority. Referrals normally require a verified (or later) report. Barangay may request LGU or police escalation with explanatory remarks; LGU may take ownership of a verified report. A `Resolved` report requires a separate Barangay closure confirmation to become `Closed`.

Every processing action can create response-history entries, audit records, and relevant notifications. Important assignment rules are enforced server-side:

- A Barangay worker can claim an unassigned local Barangay report for themself.
- LGU personnel perform assignment, reassignment, and agency referral within their municipality/city.
- Assigned personnel must be active, verified, in scope, and have a role matching the selected agency.
- Police access is assignment-based; a police user does not see every incident in the municipality through the incident-list endpoint.

`Under Validation` exists in the incident schema and query filters, but it is not an allowed request value in the current processing validator and is not part of the configured transition map. Treat it as a legacy/read-compatible status unless the workflow is deliberately extended.

## Data model

### `User`

Stores identity, hashed password, role, status, verification flags, citizen address or personnel jurisdiction, and hashed/expiring email-verification and password-reset tokens. Email is unique.

### `Incident`

The central record. It references its reporting citizen and can include:

- Incident type, description, citizen urgency, official severity, and status
- Structured Pangasinan address, latitude/longitude, and GeoJSON `geoPoint`
- Public URL-based `mediaEvidence` and protected uploaded `evidenceFiles`
- Agency and personnel assignment, referral, escalation, and closure-confirmation state
- Duplicate-report reference and a chronological `responseHistory`

It has an index for common location/type/time queries and a sparse `2dsphere` index on `location.geoPoint`.

### `Notification`

An in-app notification for one recipient, tied to an incident. It tracks type, priority, read state, and timestamps.

### `AuditLog`

An immutable operational record of the actor, optional target user/incident, action, outcome, request IP and user agent. The application attempts to log important authentication, user-management, incident, and evidence events. Audit-log write errors are logged to the server but do not fail the main request.

## API surface

Protected endpoints require `Authorization: Bearer <token>` unless noted otherwise.

### Authentication and account management

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register-citizen` | Public | Create an unverified citizen account and send verification email |
| GET | `/api/auth/verify-email/:token` | Public | Verify a citizen email token |
| POST | `/api/auth/resend-verification` | Public | Resend a citizen verification link, with cooldown and non-enumerating response |
| POST | `/api/auth/apply-personnel` | Public | Submit a pending personnel application |
| POST | `/api/auth/register-personnel` | Admin/LGU | Create a pending personnel account |
| POST | `/api/auth/login` | Public | Authenticate and return JWT plus user profile |
| GET | `/api/auth/me` | Any active account | Read current user and authorization scope |
| GET | `/api/auth/pending-personnel` | Admin/LGU | List approval candidates within the caller's scope |
| PUT | `/api/auth/approve-personnel/:id` | Admin/LGU | Activate an eligible personnel account |
| POST | `/api/auth/forgot-password` | Public | Send password-reset link when possible |
| POST | `/api/auth/reset-password/:token` | Public | Replace password using a valid reset token |
| PATCH | `/api/auth/users/:id/status` | Admin/LGU | Change a user status within permission scope |
| DELETE | `/api/auth/users/:id` | Admin/LGU | Delete an eligible user; self-deletion is blocked |

### Incidents and evidence

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/api/incidents` | Citizen | Submit an incident; location must be inside Pangasinan |
| GET | `/api/incidents` | Citizen/personnel | List reports visible to the caller's role and scope |
| GET | `/api/incidents/map` | Citizen/personnel | Return scoped, privacy-safe GeoJSON markers; accepts status, severity, type, bounds, and date filters |
| GET | `/api/incidents/map/boundary` | Citizen/personnel | Return the Pangasinan boundary GeoJSON |
| PATCH | `/api/incidents/:id/process` | Personnel | Apply authorized status, priority, assignment, referral, escalation, closure, or note changes |
| POST | `/api/incidents/:id/evidence` | Incident owner/authorized personnel | Upload `multipart/form-data` evidence under the `evidence` field |
| GET | `/api/incidents/:id/evidence/:evidenceId` | Incident owner/authorized personnel | Download a protected evidence file |

Evidence uses locally stored files, not public static URLs. A request may contain up to five total evidence files per incident, each no larger than 20 MB. Permitted MIME type/extension pairs are JPEG, PNG, WebP, MP4, WebM, and MOV. Files are assigned UUID filenames, while metadata stores the original filename. Downloads are authorization-checked before `res.download()` sends the file.

### Supporting endpoints

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| GET | `/api/users/personnel` | Admin/LGU | List active, verified personnel available for assignment |
| GET | `/api/notifications` | Citizen/personnel | Paginated personal notifications; supports `page`, `limit`, and `read` |
| PATCH | `/api/notifications/read-all` | Citizen/personnel | Mark all personal notifications as read |
| PATCH | `/api/notifications/:id/read` | Citizen/personnel | Mark one personal notification as read |
| GET | `/api/analytics/overview` | Citizen/personnel | Return role-scoped counts, breakdowns, and Asia/Manila daily trend |
| GET | `/api/admin/audit-logs` | Admin | Paginated/filterable audit records |

For request and response examples, use the current Postman collections in [`server/postman/`](server/postman). They are the closest maintained reference for endpoint payloads.

## Maps and analytics privacy model

The map endpoint returns only marker information: incident type, severity, status, agency, Barangay, municipality/city, coordinates, and timestamps. It does not include citizen identity, descriptions, evidence, response history, or assignment details.

Citizens see only `Verified`, `In Progress`, `Resolved`, and `Closed` map reports and community analytics. Personnel get data limited to their jurisdiction; administrators are explicitly denied map, incident, and analytics routes. Analytics aggregate MongoDB data by status, severity, type, agency, and date, using the `Asia/Manila` timezone for daily buckets.

## Extending the backend safely

When adding a feature, keep the existing layering consistent:

1. Add schema fields and indexes in `models/` if data changes.
2. Add input validation in `middleware/validation.js`.
3. Put authorization/scope rules in reusable utilities when they apply in multiple places.
4. Implement business rules in the relevant controller.
5. Mount a focused route in `routes/` and protect it before the controller runs.
6. Decide whether the action needs a response-history entry, audit event, and notification.
7. Update the Postman collection and this document when behavior or permissions change.

Be especially careful not to trust a client-supplied role, jurisdiction, incident owner, evidence URL, or assignment. Derive authorization from `req.user` and re-check related records in the controller, as the current incident and evidence flows do.

## Operational considerations

- Evidence files are stored on the application filesystem under `server/uploads/evidence`. A production deployment needs persistent storage and backups; horizontally scaled instances will not share those files without a shared/object-storage replacement.
- Email delivery is synchronous with registration/reset response handling and times out after 15 seconds. Registration can save an account but respond with `503 EMAIL_DELIVERY_FAILED` if verification email delivery fails.
- CORS is unrestricted in the current code. Restrict allowed origins before exposing a production deployment publicly.
- Rate limits use the default in-memory store. For multiple server instances, use a shared rate-limit store.
- There is no automated test suite yet. Add route/controller tests before changing access rules or the incident state machine.
