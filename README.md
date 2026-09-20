# Restaurant QR Ordering System — No Waiter Needed

A working, self-hosted table-ordering system. Diners scan a QR code at
their table, browse the menu on their own phone, and send their order
straight to the kitchen — no waiter has to take it down. The kitchen sees
every order the instant it's placed and moves it through **New → Preparing
→ Ready** on a live screen. Diners can also tap "Request the bill" from
their phone, which flags their table for staff.

## How it works

```
 Diner's phone            Kitchen screen            Admin panel
┌────────────────┐       ┌──────────────────┐      ┌──────────────────┐
│ customer.html   │       │ kitchen.html      │      │ admin.html        │
│ (scan QR code)  │       │ (left open on a   │      │ (manage menu,     │
│                  │       │  tablet/monitor)  │      │  tables, QR       │
└────────┬─────────┘       └─────────▲─────────┘      │  codes)           │
         │  place order              │ live update     └─────────┬─────────┘
         └──────────────► server.js (Express + Socket.io) ◄───────┘
                                  │
                          data/*.json (menu, orders, tables)
```

- **customer.html** — the page a QR code points to. Each table has its own
  QR code that links to `/customer.html?table=<id>`, so the app always
  knows which table an order came from without asking the diner to type
  anything.
- **kitchen.html** — a live kitchen display screen (KDS). New orders appear
  instantly via WebSocket (Socket.io), grouped into columns by status, with
  a running timer on each ticket.
- **admin.html** — where staff manage the menu (add/hide/delete items),
  manage tables, and generate/print the QR code for each table.
- **server.js** — a small Express API (`/api/menu`, `/api/orders`,
  `/api/tables`) backed by plain JSON files in `data/`, plus a Socket.io
  server that pushes `order:new`, `order:updated`, `menu:updated` and
  `tables:updated` events to every connected screen in real time.

No database server to install — orders, the menu, and table state are
stored in `data/*.json` and persist across restarts.

## Project structure

```
restaurant-qr-ordering-system/
├── server.js                   # Express + Socket.io entry point
├── generate-qr.js              # CLI script: generate all table QR codes
├── package.json
├── data/
│   ├── menu.json               # menu items
│   ├── orders.json             # order history (auto-updated)
│   └── tables.json             # tables + live status
├── src/
│   ├── routes/                 # /api/menu, /api/orders, /api/tables
│   ├── controllers/            # request handling + business logic
│   └── utils/
│       ├── storage.js          # safe JSON read/write
│       └── qrGenerator.js      # per-table QR code PNG generator
├── public/
│   ├── index.html              # links to the 3 screens (for testing)
│   ├── customer.html           # diner menu + ordering screen
│   ├── kitchen.html            # kitchen display screen
│   ├── admin.html              # admin/back-office panel
│   ├── css/                    # one stylesheet per screen + shared base.css
│   └── js/                     # one script per screen (customer.js, kitchen.js, admin.js)
└── qr-codes/                   # generated QR code PNGs land here
```

Every screen has its own HTML, CSS and JS file — nothing is bundled
together, so you can open any single file to see exactly what it does.

## Setup

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd restaurant-qr-ordering-system
npm install
npm start
```

The server prints its URLs on startup:

```
Landing page:   http://localhost:3000
Customer menu:  http://localhost:3000/customer.html?table=1
Kitchen screen: http://localhost:3000/kitchen.html
Admin panel:    http://localhost:3000/admin.html
```

For development with auto-restart on file changes: `npm run dev`
(requires the `nodemon` devDependency, already listed in package.json).

> **Note:** every page links to the others with relative paths (e.g.
> `admin.html`, not `/admin.html`), so clicking between screens works even
> if you open a file straight from the folder. But menu loading, placing
> orders, and live kitchen updates all call the API and Socket.io server —
> those only work once the server is actually running and you're visiting
> pages through `http://localhost:3000/...`, not through `file://`.

## Try it out (no QR scanner needed)

1. Run `npm start`.
2. Open `http://localhost:3000/kitchen.html` in one tab — leave it open.
3. Open `http://localhost:3000/customer.html?table=3` in another tab (or
   on your phone, if it's on the same Wi-Fi — see below), add a few dishes,
   and send the order.
4. Watch it appear on the kitchen screen immediately, with no refresh.
5. Click through **New → Start preparing → Mark ready → Mark served** on
   the kitchen screen and watch the status pill update live on the
   customer's phone.

## Generating real QR codes for your tables

Once the app is deployed (or running on your restaurant's Wi-Fi), generate
a QR code per table:

```bash
# Local testing (codes will point at localhost — only works on this machine)
npm run generate-qr

# Real deployment or same-Wi-Fi testing — point at your actual URL/IP
node generate-qr.js https://your-restaurant-domain.com
node generate-qr.js http://192.168.1.20:3000
```

PNG files land in `qr-codes/`, one per table (`table-1.png`, `table-2.png`,
...) — print them and stick one on each table. You can also generate and
preview them from the **Admin panel → QR codes** tab, which uses whatever
URL is currently in your browser's address bar by default.

Scanning a table's code opens `customer.html?table=<id>` directly, so a
diner never has to select their own table — it's baked into the code.

## Finding your phone on the same Wi-Fi (for local testing)

1. Find your computer's local IP address (e.g. `192.168.1.20`) — on
   Mac/Linux run `ifconfig` or `ip addr`, on Windows run `ipconfig`.
2. Make sure your phone is on the **same Wi-Fi network**.
3. On your phone's browser, open `http://192.168.1.20:3000/customer.html?table=1`.

## Deploying for real use

For actual restaurant use, deploy `server.js` to any Node-friendly host
(Render, Railway, Fly.io, a VPS, etc.) so it has a stable public URL, then
regenerate the QR codes pointing at that URL. The JSON-file storage in
`data/` is fine for a single small restaurant; for higher order volume or
multiple locations, swap `src/utils/storage.js` for a real database (the
rest of the app doesn't need to change — every controller only talks to
`readJSON`/`writeJSON`).

## API reference

| Method | Route                     | Purpose                                  |
|--------|---------------------------|-------------------------------------------|
| GET    | `/api/menu`               | List menu items                           |
| POST   | `/api/menu`                | Add a menu item                           |
| PATCH  | `/api/menu/:id`            | Update/hide a menu item                   |
| DELETE | `/api/menu/:id`            | Remove a menu item                        |
| GET    | `/api/tables`               | List tables + status                      |
| POST   | `/api/tables`                | Add a table                               |
| PATCH  | `/api/tables/:id/status`     | Update table status (free/occupied/bill_requested) |
| GET    | `/api/tables/:id/qr`         | Get that table's QR code PNG              |
| GET    | `/api/orders`               | List orders (filter with `?table=` or `?status=`) |
| POST   | `/api/orders`                | Place an order                            |
| PATCH  | `/api/orders/:id/status`     | Advance an order (received → preparing → ready → served) |

All state changes also broadcast a matching Socket.io event
(`order:new`, `order:updated`, `menu:updated`, `tables:updated`) so every
open screen stays in sync without polling.
