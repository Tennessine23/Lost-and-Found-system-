# Daystar University · Campus Lost & Found Management System

A web-based system that helps students and staff report, search for and recover lost belongings on campus, with an administrator dashboard for managing reports and claims.

**Stack:** Node.js + Express (backend) · SQLite via Node's built-in `node:sqlite` (database, nothing extra to install) · plain HTML/CSS/JavaScript (frontend, responsive: phone and laptop).

## Run it

Requires [Node.js](https://nodejs.org) **22.13 or newer** (the current LTS is fine). Check with `node -v`.

```bash
npm install
npm start          # http://localhost:3000
npm test           # runs the automated tests
```

On first start an administrator account is created:

| Email | Password |
|---|---|
| `admin@daystar.ac.ke` | `admin12345` |

**Change this before real use.** Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `JWT_SECRET` as environment variables (see `.env.example`) *before the first start*. The admin is only created when the database has none.

## How the objectives are met

| Objective | Where it lives |
|---|---|
| 1. Report lost and found items | `routes/items.js` (`POST /api/items`), `public/js/app.js` (`report`) |
| 2. Search for reported items | `routes/items.js` (`GET /api/items?q=&type=&category=`), Home and Browse screens |
| 3. Database for item information | `db.js` (SQLite: `users`, `items`, `claims`) |
| 4. Submit claims | `routes/claims.js`, claim dialog on the item page |
| 5. Admin dashboard | `routes/admin.js`, `#/admin` screen (stats, claims, items) |
| 6. Testing | `test/api.test.js` (15 automated tests) |
| Scope: registration and login | `routes/auth.js`, `#/register` and `#/login` |
| Scope: uploading item images | `multer` in `routes/items.js`, files saved in `uploads/` |

## Project structure

```
campus-lost-found/
├── server.js            starts the server
├── app.js               Express app: middleware, routes, error handling
├── config.js            categories, campus locations, holding points
├── db.js                database schema + default admin
├── utils.js
├── middleware/auth.js   login cookie (JWT), requireAuth, requireAdmin
├── routes/
│   ├── auth.js          register, login, logout, me
│   ├── items.js         browse/search, report, details, close report
│   ├── claims.js        submit a claim, my claims
│   └── admin.js         stats, manage items, approve/reject claims
├── public/              the web app
│   ├── index.html
│   ├── css/styles.css   navy & gold design tokens at the top
│   └── js/              api.js (fetch), ui.js (helpers), app.js (screens + routing)
└── test/api.test.js
```

To change the campus locations or item categories, edit `config.js`; the forms update automatically.

## Database

```
users  (id, name, email UNIQUE, password_hash, role: student|staff|admin, created_at)
   │ 1
   │ ── many ──> items  (id, user_id, type: lost|found, title, category, description,
   │                      location, event_date, image_path, held_at,
   │                      status: open|returned, created_at)
   │                         │ 1
   │ ── many ──> claims ─────┘ many  (id, item_id, user_id, message,
                                       status: pending|approved|rejected,
                                       admin_note, created_at, resolved_at,
                                       UNIQUE(item_id, user_id))
```

## How it works

1. A user registers (as student or staff) and logs in. Browsing and searching need no account.
2. Anyone logged in can **report** a lost or found item, with an optional photo.
3. A person who recognises a **found** item clicks **"This is mine — Claim it"** and describes something only the owner would know.
4. The admin reviews the claim on the dashboard and **approves** or **rejects** it. Approving marks the item *returned* and automatically rejects competing claims. Returned items leave the public search.
5. For **lost** items, the button reads **"I found this"** and opens the found-item form. Owners can close their own reports.

## API summary

| Method and path | Who | Purpose |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/logout` · `GET /api/auth/me` | anyone | accounts |
| `GET /api/items` (`q`, `type`, `category`, `limit`) | anyone | search and browse open items |
| `GET /api/items/:id` | anyone | item details (and your claim, if any) |
| `GET /api/items/mine` | user | my reports |
| `POST /api/items` (multipart, optional `image`) | user | report lost/found |
| `PATCH /api/items/:id/resolve` | owner/admin | close a report |
| `POST /api/claims` · `GET /api/claims/mine` | user | submit / list my claims |
| `GET /api/admin/stats`, `/items`, `/claims` | admin | dashboard data |
| `PATCH /api/admin/claims/:id` (`status`, `note`) | admin | approve or reject |
| `PATCH` / `DELETE /api/admin/items/:id` | admin | change status / delete |

## Security notes

- Passwords are hashed with bcrypt; the login cookie is `httpOnly`, `sameSite=lax` (and `secure` in production).
- All database queries are parameterised; all text shown on the page is escaped.
- Uploads: JPG/PNG/WebP only, max 3 MB, file contents checked, saved under random names.
- Reporter names are shown by first name only; emails are visible to admins only.
- Admin accounts cannot be created through registration.

## Out of scope (as per the project scope)

No mobile app (the site is responsive in a browser), no artificial intelligence or automatic matching, and no integration with existing university systems.

## Ideas for later

Email notifications, password reset, rate-limiting login attempts, pagination on the admin lists, and restricting registration to `@daystar.ac.ke` addresses.
