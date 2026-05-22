# Smart Vending Machine IoT System - Architecture & Plan

## Project Overview

A modular, hardware-agnostic, smart food vending machine system. The physical machine features 6 gravity-fed inclined racks holding up to 7 items each (FIFO). The software ecosystem manages real-time inventory locking, hardware communication via MQTT, secure payments, and role-based operations.

### Multi-Tenancy, Authorization & Payment Routing
* **Tenancy Model:** The system operates as a B2B SaaS platform. All core entities (`Users`, `Machines`, `Orders`, `Reports`) include a `tenant_id` field.
* **Built-in Operations Tenant (AibotINK):** To support internal testing, platform prototyping, and direct revenue generation, the system features a permanent, built-in internal operations tenant (`tenant_id: "Super_admin"`) named **AibotINK** (contact email `aibotink.web@gmail.com`).
    * **Exclusion & Security Guards:** This internal tenant is completely hidden from standard client listings in the tenants dashboard view to prevent accidental modification or administrative disruption.
    * **Immutability Protection:** The backend API enforces strict programmatic checks to reject any disable (`POST /admin/tenant/disable`) or edit (`POST /admin/tenant/edit`) requests targeted at the `'Super_admin'` tenant.
    * **Select Visibility:** While filtered out of standard lists, it remains fully visible in the tenant assignment selectors of the Machine Management View.
* **Role-Based Access Control (RBAC):**
    * `SUPER_ADMIN`: Global platform owner. Can create Tenants, provision hardware, assign/edit machines, and view cross-tenant telemetry.
    * `TENANT_ADMIN`: Client-level access. Scoped strictly to their `tenant_id`. Manages menus, reports, and refunds for their assigned fleet.
    * `OPERATOR`: Restocking staff scoped to a `tenant_id`. View-only inventory access.
* **Dynamic Payment Routing:**
    * The system supports per-tenant payment credentials.
    * If a client provides their own PhonePe Merchant ID and Salt Key, the backend encrypts them using AES-256-GCM before storing them securely in the `Tenant` database document.
    * During checkout (`/payment/initiate`), the backend checks the `tenant_id`. If custom keys exist, they are decrypted and used (funds route directly to the client).
    * If no custom keys exist, the system falls back to the Platform Default keys stored in the server's `.env` file (funds route to the Super Admin).
    * **Settlements:** For clients using the Platform Default gateway, revenue payouts are calculated and handled completely offline via manual accounting. The software does not execute automated bank transfers.

## System Architecture (4 Software Components)

### 1. Backend (Node.js & Fastify)

**Role:** The central brain, database manager, and hardware communicator.

* **Tech Stack:** Fastify, `@fastify/static` (for local image hosting), `sharp` (for image optimization), MongoDB Atlas (Mongoose), MQTT (`mqtt` client + Local Eclipse Mosquitto Broker), JWT Authentication, Axios, Resend API, Sentry (Error Tracking).

**Environment Strategy:** Managed via `config.js` and `.env` to seamlessly switch between Development (PhonePe Sandbox, Dev DB) and Production.

**Key Logic:**

- **Cart Locking (Soft Allocation):** Uses 600-second TTL (Time-To-Live) indexes in MongoDB. Unpaid orders auto-expire and return inventory to the rack.
- **Hardware Abstraction:** Backend only sends `rack_number` (1-6) to the ESP32. Hardware logic translates this to physical movements.
- **Transaction PIN:** Admins require a secondary `bcrypt` hashed PIN to authorize PhonePe refunds.
- **Sequential Dispense Queue:** Hardware limitations require items be dispensed one-by-one. Backend manages a dispense queue with per-item success/failure tracking.
- **Device API Key Auth:** All tablet-facing endpoints require a `X-Device-Key` header. Each machine has a unique API key stored in MongoDB and baked into the APK build. Validated server-side on every request.
- **Inventory Push via MQTT:** After every dispense completion, backend publishes updated rack inventory to `vending/machine_{ID}/inventory` so the tablet receives live stock counts without polling.
- **Idempotency:** All mutating tablet endpoints support `X-Idempotency-Key` to prevent double-processing on network retry.
- **Infrastructure & Optimization:**
    * **MQTT Broker:** A local Eclipse Mosquitto instance runs on the VPS, secured with authentication, handling bi-directional TCP/WebSocket communication between the Fastify backend, ESP32 hardware, and Tablet APKs.
    * **Image Optimization:** All Master Catalog image uploads are intercepted by the `sharp` library, resized (e.g., 600x600), and compressed into lightweight `.webp` formats before saving to the local filesystem to drastically reduce tablet bandwidth usage.

### 2. User Tablet APK (Customer Frontend — Mounted Kiosk)

**Role:** Android APK running on a tablet physically mounted into the machine in landscape orientation. Users walk up and interact with the tablet directly. Functions as a kiosk-based launcher in production.

**Tech Stack:** Android Native (Kotlin/Java) or Flutter. PhonePe Android SDK for QR-based payment. MQTT client for real-time inventory updates.

**Kiosk Mode (Production Only):**
- APK is set as the device launcher (Lock Task Mode / COSU — Corporate-Owned Single-Use).
- Auto-relaunches on crash or if user escapes. Home/back/recents buttons suppressed.
- Kiosk mode behavior is gated behind a build variant: `debug` build has normal app behavior; `release` / `production` build locks the device into kiosk mode.
- Admin uses the same admin password (entered during initial setup) via a hidden long-press gesture to unlock the tablet from kiosk mode.

**Initial Setup Screen (First Launch Only):**
- Two fields: **Machine ID** and **Admin Password**.
- Tablet calls `POST /api/v1/device/register` with `machine_id` + `admin_password`.
- Server validates admin credentials, returns the machine's `device_api_key`.
- API key is stored in Android Keystore (encrypted). Machine ID stored in SharedPreferences.
- On all subsequent launches, skips setup and goes directly to the menu.

**App Update & Version Check:**
- `/api/v1/menu/:machineId` response includes a `min_supported_version` field.
- On every menu fetch, tablet compares its own `versionCode` against `min_supported_version`.
- If `versionCode < min_supported_version`: lock the UI and show "Update Required — Please contact support" screen. No transactions allowed.

**UI Layout (Landscape — Fixed Orientation):**

*Left Half — Menu Carousel:*
- Vertical scrolling carousel showing one food item at a time (full height, ~50% screen width).
- Each card: large photo of the food item at top, description text below, price/add button at bottom.
- The price button shows format `₹XX — Add` (or `+`).
- On tap: button transforms into a quantity stepper — `[-] [count] [+]` — centered, with minus on left and plus on right. User can select multiple of the same item.
- Carousel snap-scrolls so only 1 item (or at most 2 partially visible) is on screen at a time.
- **Out-of-Stock Item:** Card is **greyed out** with a **"Sold Out"** badge overlay. The Add button is hidden. The item remains in the carousel (not removed) for visual completeness — users see what's normally available.
- **Overflow Handling:** If >=20 items, add a search bar at the top of the carousel or pagination dots for quick navigation.
- **Accessibility & Language (MVP Constraints):** The interface is strictly single-language (English) for the MVP to reduce complexity. Font sizing must be universally legible (optimized for elderly/visually impaired users standing 2 feet away). High-contrast text is mandatory on top of the ReactBits dark vail theme.

*Right Half — Cart Panel:*
- Fixed header: `Your Cart` (non-scrollable).
- Scrollable middle section: list of cart items, each showing item name × quantity, unit price, and subtotal. Each line item has a swipe-to-delete or a small `✕` remove button. If cart items exceed visible area, the middle section scrolls while header + footer remain pinned.
- Fixed footer: a wide checkout button displaying `Total: ₹XXX — Pay Now` (non-scrollable, always visible).
- Empty cart state: illustration/text "Your cart is empty. Scroll through the menu to add items."

**Idle Video Playback:**
- After 2-3 minutes of no user interaction, the menu/cart UI fades out and a **full-screen video player** begins looping promotional/ad/product videos.
- Videos are fetched from a configured URL list (stored in machine config or bundled in APK). Ordered playlist, loops from start after last video.
- **Any touch event** (anywhere on screen) immediately stops video playback and restores the menu/cart UI with a fresh session (cart cleared).
- Video playback is disabled during active sessions (cart non-empty, payment in progress, or dispensing).

**Key Logic & Flow:**

1. **Machine ID:** Hardcoded via setup screen. Stores in local config.
2. **Device Auth:** Every API call includes `X-Device-Key` header with the per-machine API key.
3. **Menu Fetching & Caching:**
   - Fetched on app launch (`POST /api/v1/menu/:machineId`).
   - Re-fetched on every **session start** (after previous order completes, or after idle video ends).
   - Periodic background refresh every **5 minutes** if tablet is idle.
   - Pull-to-refresh gesture available in the carousel.
   - Cached menu (from last successful fetch) is displayed as a **stale fallback** if the network is down on launch. Items show last-known inventory with a subtle "Stock may vary" indicator.
4. **Real-time Inventory via MQTT:**
   - Tablet subscribes to `vending/machine_{ID}/inventory` topic.
   - After every dispense completes, backend publishes updated rack quantities.
   - Tablet updates carousel in real-time — no need to re-fetch entire menu.
   - If an item reaches zero via MQTT push, the card immediately transitions to the greyed-out "Sold Out" state.
5. **Cart Management:** Entirely local state on the tablet. Adding/removing items does NOT call the server. Only checkout does.
6. **Inventory Validation:** On "Pay Now" tap, tablet calls `POST /api/v1/order/create-bulk` with the full cart payload + `X-Idempotency-Key`. Server atomically validates all racks have sufficient quantity and deducts inventory in a single transaction. If the tablet times out and retries with the same idempotency key, the server returns the already-created order instead of double-deducting.
7. **Payment via PhonePe SDK:** After order creation, tablet calls `POST /api/v1/payment/initiate` to get the PhonePe transaction. Server transitions order status to `PAYMENT_QR_GENERATED`. The PhonePe Android SDK renders a **QR code on the tablet screen**. User scans this QR with their personal phone to pay.
8. **Payment Polling:** Tablet **polls** `GET /api/v1/order/:orderId/status` every 2 seconds until status becomes `PAID` or a 180-second timeout expires. On timeout, tablet calls `POST /api/v1/order/:orderId/cancel` — server restores inventory to all racks.
9. **Sequential Dispense:** Once `PAID` is confirmed, tablet calls `POST /api/v1/machine/dispense-queue` which triggers the backend to begin sequential MQTT dispense commands to the ESP32 — one item at a time, waiting for hardware acknowledgement before sending the next.
10. **Dispense Progress UI:** Tablet shows a progress screen: "Dispensing item 1 of 4...", with a per-item checklist updating in real-time via `GET /api/v1/machine/dispense-status/:orderId` polling (every 1s during dispense).
11. **Session Management:** A 90-second idle timer on the tablet. If no interaction and cart is empty, triggers idle video mode. If cart is non-empty, show "Session expired — cart cleared" toast and reset. A manual "Clear Cart" button is always visible.
12. **Issue Reporting:** After dispense completes, a subtle "Report an issue" button appears. If a jam occurs mid-dispense, a prominent "Report Jam / Missing Item" button is shown. Issue types: JAM, MISSING_ITEM, WRONG_ITEM_DISPENSED, OTHER. Camera capture is required for JAM and MISSING_ITEM; text-only for WRONG_ITEM_DISPENSED and OTHER.
13. **Offline Handling:**
    - On any failed API call (create-bulk, payment/initiate, polling, dispense-queue), the tablet retries up to 3 times with exponential backoff.
    - If all retries fail: the **entire app UI locks** with a full-screen grey overlay and a centered popup: **"Machine Offline — Please try again later"**. No interaction is possible.
    - The tablet continues retrying in the background every 10 seconds. On first successful response, the overlay dismisses and UI restores.
    - Exception: if the tablet boots with no network at all, show the offline screen immediately after the cached menu fails to refresh.
14. **Analytics & Error Tracking:**
        * **Behavioral Telemetry (PostHog):** Tracks funnel events (`SESSION_START`, `ITEM_ADDED`, `CHECKOUT_TAPPED`, `PAYMENT_ABANDONED`). Fire-and-forget, batched locally to reduce requests.
        * **Crash Logging (Sentry):** Captures native crashes and unhandled exceptions with full device context.
        * **Hardware Heartbeat:** Ping (`POST /api/v1/device/heartbeat`) every 60s with `machine_id`, `battery_level`, and `app_version`.
15. **No-PII / Receipt Policy:** The vending machine operates on a strict zero-PII (Personally Identifiable Information) policy. The system intentionally does not ask for phone numbers or emails to send digital receipts. The PhonePe app acts as the user's financial receipt, and the physical item drop acts as the fulfillment confirmation.

### 3. Admin Web Dashboard
* **Role:** The control center for operations, financial management, and fleet provisioning.
* **Tech Stack & Architecture:** React, CSS custom properties, Tailwind CSS (using dual Shadcn styling presets `b3GdM5eZtK` for `SUPER_ADMIN` and `b3FNvjSkLa` for `TENANT_ADMIN` mapped to HTML `data-theme` datasets), Recharts, Sentry.
    * **Dynamic Dark/Light Adaptation:** Supports both system auto-theming and manual override via a persistent toggle button next to the sidebar's "V" logo badge.
* **Key Logic & User Interfaces:**
    * **Dashboard Views & UI Theming (RBAC):**
        * `SUPER_ADMIN` (Theme Preset: Green): Sees global metrics of all Tenants. Features a "Tenant Impersonation / God Mode" dropdown in the sidebar to browse and administer the system exactly under a client's context.
        * `TENANT_ADMIN` (Theme Preset: Blue): Sees isolated business metrics restricted strictly to their fleet.
    * **Advanced Analytics & Telemetry (MongoDB Aggregation):**
        * Financial and operational charts are powered entirely by backend MongoDB aggregation pipelines.
        * **Spoilage/Donation Ratio:** Tracks `SHIFT_CLEAROUT_DONATION` against loaded inventory to optimize kitchen prep.
        * **Sales Velocity & Peak Hours:** Identifies high-traffic purchasing windows.
        * **Heatmapping:** Tracks slot-level performance (e.g., eye-level vs. bottom-row conversion rates).
    * **Tenants Administration View:**
        * **Password Rendering Cell:** Displays passwords securely masked as `••••••••` by default. Admins can click the interactive Lucide eye-toggle button to reveal the raw credentials in plain text.
        * **Provisioning Popup:** Allows registering a client organization with auto-generated starting passwords. Press-and-hold reveal button enables credential verification before saving.
        * **Internal Operations Toggle:** Includes a dedicated "Register as Internal Operations (Super Admin)" checkbox. Activating this checkbox automatically provisions the permanent `Super_admin` (AibotINK) tenant with pre-filled support credentials, bypassing custom mobile/password inputs.
        * **Assigned Fleet Management:** Selecting a tenant opens an Edit modal showing a high-density, beautifully styled array of assigned machines. Interactive close (`×`) buttons allow releasing machines dynamically. An available machines dropdown filters out already assigned machines to facilitate seamless sequential additions. Submitting modifications triggers comparative transactional updates.
        * **Disabled Profiles Grid:** Shows soft-deleted tenants in a separate section at a lowered `opacity-75` where admins can activate the "Enable" trigger to restore operations.
    * **Machine Management View:**
        * **Unified Single Viewport:** Replaced old tabbed structures with a high-density, single-viewport double table presenting **Assigned** and **Unassigned** hardware fleets sequentially, featuring reactive item count badges.
        * **Enriched Table Layout:** Displays monospaced columns for Machine ID, Assigned Tenant Business Name, auto-capitalized/title-cased Location names, grid dimension bounds in unified `RXCXD` (`rows x columns x depth`) format, and calculated maximum physical slot loading `Capacity`.
        * **Compact Edit Modal:**
            * *Active/Assigned Machines:* Opens a tight, single-column popover allowing quick modifications to Machine ID, Location, and Grid Dimensions.
            * *Warehouse/Unassigned Machines:* Opens a side-by-side Unified Split-Panel Modal. Left side coordinates physical vending configurations (ID, Location, Rows, Columns, Max Depth). Right side displays Tenancy Assignment select dropdown, moving the node immediately into the Active fleet.
    * **Master Catalog Management (Super Admin):** Interface to upload product images (stored locally on the VPS and optimized via `sharp`) and define global approved items.
    * **Tenant Menu Configuration:** Tenants select items from the Super Admin's Master Catalog to assign to their dynamic `Row x Column` machine grid.
    * **Secure Refunds:** Processing a PhonePe refund triggers a high-security modal requiring the admin's Transaction PIN.
    * **Menu Dispatch & Logistics:**
        * Tenant Admin defines slot assignments (which item goes where, and target quantities) for specific shifts (Breakfast, Lunch, Snacks).
        * Admin clicks "Assign Menu". A popup lists available Operators under their `tenant_id`.
        * Selecting an Operator generates a `RestockJob`, calculates the aggregated packing list (total items needed), and sends a push notification to the Operator App.
        * Dashboard provides a real-time aggregate view of current machine inventory levels by category, enabling Admins to easily calculate kitchen preparation needs.
    * **Time-Scoped Analytics:**
        * Telemetry grids (Revenue, Orders, Donations) feature a unified toggle (Daily / Weekly / Monthly) that dynamically refetches aggregated data pipelines from the Fastify backend.
    
### 4. Operator App (Restocking)
* **Role:** A strictly guided, mobile-optimized application that connects physical restocking to digital dispatch.
* **Tech Stack:** React Native or Flutter. Protected by JWT.
* **Key Logic & Flow:**
    * **Tenancy Isolation:** Operator logs in via their assigned Mobile Number and Password. The Fastify backend intercepts this, checks the DB, and issues a JWT tied securely to their employer's `tenant_id`. They only see jobs and machines assigned to them.
    * **The Dispatch Notification:** Operator receives a `RestockJob` push notification (e.g., "Lunch Shift - Machine V01"). App displays the `packing_list` (aggregated totals) so the operator knows exactly what to pull from the kitchen.
    * **Authentication & Hardware Unlock:**
        * Operator walks to the back of the machine and scans the physical QR code (containing `machine_id` + `tenant_id`).
        * App calls `POST /api/v1/operator/unlock`. Backend validates the active `RestockJob` and fires the MQTT `UNLOCK_DOOR` command to the ESP32 solenoid.
        * ESP32 detects the door opening and publishes `DOOR_OPEN`. The front-facing Tablet APK instantly locks into a "Maintenance in Progress" screen to prevent user orders.
    * * **Step-by-Step Execution Wizard:**
        * **Phase 1: Automated Clear-Out (If `clearout_required: true`):**
            * Operator scans the machine QR to unlock the door. 
            * App identifies a shift change and shows a single-action screen: *"Remove all remaining items. Tap confirm when empty."*
            * Operator taps "Machine Emptied" (`POST /api/v1/operator/clearout`).
            * The backend securely references its own real-time inventory state, automatically zeroes out the machine slots, and logs the exact remaining quantities to `InventoryAudit` as `SHIFT_CLEAROUT_DONATION`. No manual operator counting is required.
        * **Phase 2: Restock Protocol:**
            * App immediately syncs with the new `slot_assignments` for the upcoming shift.
            * Shows strictly one slot at a time (e.g., "Slot R1-C1").
            * Displays the target item image and name. Asks: *"Target: 5. How many did you load?"*
            * Operator inputs the actual amount loaded and taps "Next" until complete.
    * **Completion & Reactivation:**
        * Operator submits the final job. App instructs them to close the physical door.
        * ESP32 limit switch detects closure, publishes `DOOR_CLOSED`. Backend syncs the new inventory.
        * The Tablet APK drops the maintenance screen and instantly displays the updated menu and stock levels.

---

## Hardware Team Contracts (Firmware Interface)


| Direction | MQTT Topic | Payload |
|-----------|-----------|---------|
| Backend → ESP32 (Dispense) | `vending/machine_{ID}/commands` | `{"action": "DISPENSE", "rack": 2, "orderId": "ORD_123"}` |
| Backend → ESP32 (Door Control) | `vending/machine_{ID}/commands` | `{"action": "UNLOCK_DOOR", "operatorId": "OP_123"}` |
| ESP32 → Backend (Door Status) | `vending/machine_{ID}/status` | `{"status": "DOOR_OPEN"}` or `{"status": "DOOR_CLOSED"}` |
| ESP32 → Backend (Dispense Ack) | `vending/machine_{ID}/status` | `{"status": "DISPENSE_COMPLETED", "orderId": "ORD_123", "rack": 2}` |

**Sequential Dispense Protocol:**
1. Backend sends DISPENSE for item 1 → waits for `DISPENSE_COMPLETED` ack → sends item 2 → ...
2. If `JAMMED` received at any point, **stop the queue immediately**. Remaining items are marked undispensed and eligible for partial refund.
3. After dispense completes (success or jam), backend publishes updated inventory to `vending/machine_{ID}/inventory`.
4. Timeout: if no ack received within 30 seconds per item, retry once. After retry failure, treat as jam.

---

## Database Schemas (Mongoose)

### 1. Tenant
```javascript
tenant_id: String (Unique)           // "Super_admin" or TEN_<timestamp>
business_name: String
contact_email: String
is_custom_gateway_active: Boolean
status: String (ACTIVE | DISABLED)   // ACTIVE or DISABLED status
password: String                     // Plaintext password for platform owner visibility
payment_config: String               // Stored encrypted on disk as iv:ciphertext:tag (Transparent AES-256-GCM hooks)
createdAt: Date
```

### 2. Master Catalog (Super Admin Only)
```javascript
item_id: String (Unique)
item_name: String
item_description: String
image_path: String                   // Path to local VPS storage (e.g., /uploads/catalog/idli.webp)
default_price_paise: Number          // Tenants can override this price
createdAt: Date
```

### 3. Machine
```javascript
tenant_id: String                    // Reverts to 'TEN_PLATFORM_ROOT' if unassigned
machine_id: String (Unique)          // Prefix "V" followed strictly by digits (e.g., V05)
device_api_key: String (Hashed)
assignment_status: Enum ['ACTIVE', 'UNASSIGNED', 'MAINTENANCE'] // Tracks operational lifecycle
location: String                     // Title-cased placement name (auto-formatted)
grid_config: {                       
    rows: Number,
    columns: Number,
    max_depth: Number
}
slots: [{                            
    row: Number,
    column: Number,
    slot_id: String,                 // e.g. "R1-C2"
    item_id: String,                 
    quantity: Number,                // Quantities are validated server-side to not exceed grid_config.max_depth
    status: 'ACTIVE' | 'INOPERATIONAL'
}]
idle_video_urls: [String]
min_supported_app_version: Number
```

### 4. Order (Revised for Multi-Item Cart)

```javascript
tenant_id: String
order_id: String (Unique)           // ORD_<timestamp>_<random>
idempotency_key: String (Unique)     // Client-generated UUID, hashed index
machine_id: String
items: [{
  rack_number: Number,
  item_id: String,
  item_name: String,
  quantity: Number,
  price_paise: Number                // per-unit price
}]
total_amount: Number                 // total in paise
items_dispensed: Number              // count of successfully dispensed items
total_items: Number                  // sum of all quantities
status: Enum [
  'PENDING_PAYMENT',                 // order created, inventory locked
  'PAYMENT_QR_GENERATED',            // PhonePe QR is showing on tablet (set by /payment/initiate)
  'PAID',                            // payment confirmed via webhook/polling
  'DISPENSING',                      // sequential dispense in progress
  'PARTIALLY_DISPENSED',             // some items dispensed, some jammed
  'COMPLETED',                       // all items dispensed successfully
  'CANCELLED',                       // payment timeout / user cancelled
  'REFUNDED'                         // full or partial refund processed
]
createdAt: Date (TTL index: 600s)
```

### 5. User

```javascript
tenant_id: String                    // Bound to client tenant, or 'TEN_PLATFORM_ROOT' for Super Admin
email: String (Unique, Sparse)       // Used exclusively by Super Admin (allows multiple null/omitted users)
mobile_number: String (Unique, Sparse) // Used by TENANT_ADMIN and OPERATOR (allows multiple null/omitted users)
password: String (Hashed)            // Bcrypt-hashed credentials
role: Enum (SUPER_ADMIN | TENANT_ADMIN | OPERATOR)
transactionPin: String (Hashed)      // Bcrypt-hashed secondary refund auth pin
```

### 6. Report

```javascript
tenant_id: String
report_id: String (Unique)         // REP_<timestamp>
order_id: String
machine_id: String
issueType: String                    // JAM, MISSING_ITEM, WRONG_ITEM_DISPENSED, OTHER
imageUrl: String                     // nullable for text-only issue types
description: String                  // optional free text
status: 'PENDING' | 'RESOLVED_REFUNDED'
undispensed_items: [{ rack_number, item_name, quantity, price_paise }]
```

### 7. AnalyticsEvent

```javascript
event_id: String (Unique)
machine_id: String
event_type: String                   // SESSION_START, ITEM_ADDED_TO_CART, ...
payload: Mixed                       // event-specific data
createdAt: Date (TTL index: 30 days)
```
### 8. RestockJob
```javascript
tenant_id: String
job_id: String (Unique)
machine_id: String
operator_id: String (References User)
status: Enum ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
shift_type: Enum ['BREAKFAST', 'LUNCH', 'SNACKS', 'ADHOC']
clearout_required: Boolean           // True for shift changes, False for mid-shift top-ups
clearout_list: [{                    // Expected items to be removed and donated
    slot_id: String,
    item_id: String,
    expected_quantity: Number,
    actual_removed_quantity: Number  // Auto-filled by backend during 1-Click Flush
}]
packing_list: [{                     // Aggregated totals for the operator to pack
    item_id: String,
    item_name: String,
    total_quantity_needed: Number
}]
slot_assignments: [{                 // Exact map of where things go
    slot_id: String,
    item_id: String,
    target_quantity: Number,
    actual_quantity_loaded: Number   // Filled by Operator during execution
}]
createdAt: Date
completedAt: Date
```

### 9. InventoryAudit
```javascript
tenant_id: String
operator_id: String (References User)
machine_id: String
slot_id: String
item_id: String
action_type: Enum ['RESTOCK', 'SHIFT_CLEAROUT_DONATION', 'SPOILAGE', 'ADMIN_ADJUSTMENT']
quantity_changed: Number             // Positive for restock, Negative for clearout
previous_quantity: Number
new_quantity: Number
createdAt: Date
```
---

## API Endpoints

### Tablet-Facing Endpoints (All require `X-Device-Key` header)

| Method | Endpoint | Idempotent | Description |
|--------|----------|------------|-------------|
| `POST` | `/api/v1/device/register` | No | Initial setup: validates admin password, returns `device_api_key`, `machine_id` |
| `POST` | `/api/v1/menu/:machineId` | N/A (read) | Returns menu items with live inventory, `min_supported_version`, `idle_video_urls`. Response includes `cache_ttl_seconds`. |
| `POST` | `/api/v1/order/create-bulk` | Yes | Atomically deducts inventory for all cart items. Requires `idempotency_key`. Returns `order_id`. Rejects entirely if any rack has insufficient stock. |
| `POST` | `/api/v1/payment/initiate` | Yes | Initiates PhonePe transaction, transitions order to `PAYMENT_QR_GENERATED`, returns QR payload for SDK rendering. |
| `GET` | `/api/v1/order/:orderId/status` | N/A (read) | Polled by tablet for payment status. Returns `{status, items_dispensed, total_items, dispense_details[]}`. |
| `POST` | `/api/v1/order/:orderId/cancel` | Yes | Cancels unpaid order, atomically restores inventory to all racks. |
| `POST` | `/api/v1/machine/dispense-queue` | Yes | Starts sequential dispense for a PAID order. Backend manages the queue internally. |
| `GET` | `/api/v1/machine/dispense-status/:orderId` | N/A (read) | Returns current dispense progress with per-item status (`pending|dispensing|completed|jammed`). |
| `POST` | `/api/v1/reports` | No | Submits issue report. Accepts `image` (multipart) plus `issueType`, `orderId`, `description`. |
| `POST` | `/api/v1/device/heartbeat` | No | Health ping with device telemetry. |
| `POST` | `/api/v1/device/event` | No | Funnel analytics event (fire-and-forget). |

### Admin / Auth / Operator Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | None | Accepts `identifier` (Email for Super Admin, Mobile for Tenants/Operators) and `password`. Returns JWT. |
| `POST` | `/api/v1/admin/tenant/create` | JWT (SUPER_ADMIN) | Creates tenant and admin user atomically. Supports `is_internal` flag for `'Super_admin'`. |
| `POST` | `/api/v1/admin/tenant/edit` | JWT (SUPER_ADMIN) | Updates a tenant and syncs its machine fleet via comparative atomic syncing (`assigned_machines` array). Immutable for `'Super_admin'`. |
| `POST` | `/api/v1/admin/tenant/enable` | JWT (SUPER_ADMIN) | Re-enables / activates a disabled B2B tenant profile. |
| `POST` | `/api/v1/admin/tenant/disable` | JWT (SUPER_ADMIN) | Soft-deletes a tenant, cascadingly unassigning all their hardware to warehouse status. Immutable for `'Super_admin'`. |
| `GET` | `/api/v1/admin/tenants` | JWT (SUPER_ADMIN) | Retrieves full list of tenants enriched with status, mobile number, assigned machines, and plaintext starting password. |
| `GET` | `/api/v1/admin/machines/available` | JWT (SUPER_ADMIN) | Retrieves an array of all unassigned machine_id strings. |
| `GET` | `/api/v1/admin/machines` | JWT (SUPER_ADMIN) | Retrieves list of all machine fleet entries, resolving dynamic tenant business names. |
| `POST` | `/api/v1/admin/machine/create` | JWT (SUPER_ADMIN) | Creates a new machine. Enforces uppercase formatted `V\d+` ID masks, auto-capitalizes location, and auto-generates device keys. |
| `POST` | `/api/v1/admin/machine/edit` | JWT (SUPER_ADMIN) | Modifies machine details, layout config, and tenancy assignments. Auto-capitalizes locations. |
| `POST` | `/api/v1/admin/machine/unassign` | JWT (SUPER_ADMIN) | Revokes a machine from a tenant, sets tenant_id to platform root, and status to UNASSIGNED. |
| `POST` | `/api/v1/admin/operator/create` | JWT (ADMIN) | Tenant Admins generate Operator accounts (Mobile + Password) with inherited `tenant_id`. |
| `POST` | `/api/v1/admin/rack/lock` | JWT (ADMIN) | Lock or unlock a specific rack. |
| `POST` | `/api/v1/admin/refund` | JWT (ADMIN) + PIN | Process PhonePe refund with secondary `transactionPin` validation. |

### Deprecated Endpoints

| Endpoint | Replacement |
|----------|------------|
| `POST /api/v1/order/create` | `POST /api/v1/order/create-bulk` |
| `POST /api/v1/machine/dispense` | `POST /api/v1/machine/dispense-queue` |

---

## User Flow (Tablet — Step by Step)

```
┌─────────────────────────────────────────────────────────────────┐
│  LAUNCH: App starts → checks stored config                      │
│  First run? → Setup screen (Machine ID + Admin Password)        │
│  Normal run → Fetch menu + subscribe to MQTT inventory topic    │
│  Version < min_supported? → "Update Required" screen (locked)   │
│  Network down? → Show cached menu OR "Machine Offline" overlay  │
├─────────────────────────────────────────────────────────────────┤
│  IDLE STATE: No touch for 2-3 min, cart empty                   │
│  → Menu/cart fades out → Full-screen promo/ad video loop        │
│  → Any touch = stop video → restore menu (fresh session)        │
├─────────────────────────────────────────────────────────────────┤
│  STEP 1: Browse Menu                                            │
│  Carousel with photos, descriptions, prices.                    │
│  Sold-out items: greyed out + "Sold Out" badge, no Add button.  │
│  Pull-to-refresh available.                                     │
├─────────────────────────────────────────────────────────────────┤
│  STEP 2: Build Cart (local state only, no server calls)         │
│  Tap "₹30 Add" → button becomes [-][count][+]                   │
│  Cart panel (right) updates in real-time.                       │
│  Header + footer fixed; middle items scrollable.                │
│  90s idle timer → cart clears with toast, returns to menu.      │
├─────────────────────────────────────────────────────────────────┤
│  STEP 3: Checkout                                               │
│  Tap "Total: ₹90 — Pay Now"                                     │
│  → POST /order/create-bulk (all items + idempotency_key)        │
│  → Atomic validation + deduction                                │
│  → Returns order_id OR {"error": "INSUFFICIENT_STOCK", ...}     │
│  If request times out, retry with same idempotency_key.         │
├─────────────────────────────────────────────────────────────────┤
│  STEP 4: Payment QR                                             │
│  → POST /payment/initiate → order → PAYMENT_QR_GENERATED        │
│  → PhonePe SDK renders QR on screen                             │
│  → 180s countdown timer starts, polls /order/:id/status (2s)    │
├─────────────────────────────────────────────────────────────────┤
│  STEP 5: User Pays                                              │
│  User scans QR with phone → completes payment                   │
│  → PhonePe webhook → server sets order to PAID                  │
│  → Tablet poll detects PAID → advances to dispense screen       │
│  Timeout (180s): auto-cancel, inventory restored.               │
├─────────────────────────────────────────────────────────────────┤
│  STEP 6: Sequential Dispense                                    │
│  → POST /machine/dispense-queue                                 │
│  → Backend sends MQTT DISPENSE → waits for ack → next item      │
│  → Polls /dispense-status (every 1s) for progress UI:           │
│    "✓ Idli  ✓ Vada  ⟳ Dosa (dispensing)  ⏳ Chips"             │
├─────────────────────────────────────────────────────────────────┤
│  STEP 7: Completion / Jam                                       │
│  ALL OK: "Enjoy your meal!" → return to menu (refetch menu)     │
│  PARTIAL/FULL JAM: "Machine error. Please report."              │
│    → Tablet displays a dynamic WhatsApp QR Code                 │
│    → QR links to `wa.me/YOUR_NUMBER?text=Issue+Machine+V01...`  │
│    → User scans with phone, sends photo directly to Support.    │
│    → Backend logs the failed dispense for Admin partial refund. │
├─────────────────────────────────────────────────────────────────┤
│  POST-DISPENSE: Backend publishes updated inventory via MQTT    │
│  Tablet receives → updates carousel stock counts in real-time   │
│  2-3 min idle → video playback resumes                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Failure Handling

### 1. Cart Abandonment (Idle User)
- **Scenario:** User adds items, then walks away without checking out.
- **Solution:** 90-second idle timer on tablet. If cart is non-empty on expiry: "Session expired — cart cleared" toast, reset UI. No server calls (inventory was never locked). If cart is empty on expiry: transition to idle video playback.

### 2. Checkout Race Condition (Inventory Changed)
- **Scenario:** User builds cart with 3 Idlis. Between the last menu fetch and checkout, a prior dispense reduced rack to 2.
- **Solution:** `create-bulk` uses MongoDB atomic `findOneAndUpdate` with `$elemMatch` + `quantity >= requested` in a **single transaction**. If any rack fails, entire order is rejected atomically (no partial deductions). Error response: `{"error": "INSUFFICIENT_STOCK", "details": {"Idli": {"requested": 3, "available": 2}}}`. Tablet shows the error and re-fetches menu to update displayed inventory.

### 3. Payment QR Timeout
- **Scenario:** User generates QR but takes too long to scan (>180 seconds).
- **Solution:** Tablet-side countdown reaches 0 → calls `POST /order/:id/cancel` with idempotency key → server restores inventory to all racks atomically. Tablet shows "Payment timed out — please try again." and returns to menu with refreshed inventory.

### 4. Network Loss During Payment Polling
- **Scenario:** WiFi drops after QR generation. User completes payment on phone, but tablet can't poll.
- **Solution:** Tablet retries polling with exponential backoff (2s → 4s → 8s → ...). PhonePe webhook already transitioned order to `PAID` server-side. On reconnect, tablet detects `PAID` and immediately advances to dispense. If payment was already completed and the 180s timeout fires, the cancel endpoint will reject the cancellation (order is already PAID, not cancellable) — tablet detects this and proceeds to dispense.

### 5. create-bulk Network Retry (Double-Deduction)
- **Scenario:** Tablet calls `create-bulk`. Request times out (server received and processed it, but response never reached tablet). Tablet retries.
- **Solution:** Every `create-bulk` request includes `X-Idempotency-Key` (UUID generated at checkout). Server stores the key with the created order. On retry with the same key, server returns the existing order instead of creating a new one. No double-deduction.

### 6. Hardware Jam Mid-Dispense (Sequential)
- **Scenario:** 4-item order. Items 1 and 2 dispensed. Item 3 jams.
- **Solution:**
  - Hardware sends `JAMMED` via MQTT → backend stops queue immediately, publishes updated inventory to MQTT.
  - `items_dispensed` counter stays at 2. Order status → `PARTIALLY_DISPENSED`.
  - Tablet shows: "2 items dispensed. Item 3 (Vada) jammed. Report this issue?" with a prominent Report button.
  - Admin gets Resend email with jam details + remaining undispensed items.
  - Partial refund: Admin processes refund for `(total_amount / total_items) * remaining_items`.

### 7. Tablet Power Loss During Dispense
- **Scenario:** Tablet loses power while machine is mid-dispense.
- **Solution:** Backend continues dispense queue independently (it manages the sequence, not the tablet). MQTT callbacks still processed. On tablet reboot + app relaunch, it queries `GET /dispense-status/:orderId` using the last known order ID stored in local state. Recovers current progress and displays appropriate UI.

### 8. User Walks Away After Payment (Before/During Dispense)
- **Scenario:** User pays, then leaves before items are dispensed.
- **Solution:** Items are dispensed and fall into the collection tray. A "Dispense Complete — Please Collect" screen stays until the next user interacts or idle video timeout triggers.

### 9. Concurrent Sessions (Single Tablet)
- **Scenario:** User A finishes checkout, User B immediately starts browsing before User A's dispense finishes.
- **Solution:** Tablet is **single-session**. During payment polling and dispense, the menu/cart UI is locked behind a full-screen overlay ("Payment in progress" or "Dispensing..."). Only after the session fully completes (success or jam) does the UI unlock for a new session.

### 10. PhonePe SDK QR Rendering Failure
- **Scenario:** PhonePe SDK fails to generate QR (API down, bad credentials).
- **Solution:** Tablet shows "Payment service temporarily unavailable. Please try again." with a Retry button. After 3 consecutive failures, cancel the order (restore inventory) and show "Machine Offline" overlay with the payment error detail. Tablet continues background health checks.

### 11. Rack Item Limit (Max 7)
- **Scenario:** User tries to add 8th Idli via quantity stepper.
- **Solution:** Tablet caps the stepper at `min(7, current_inventory)` per rack. Inventory count is from the last menu fetch + live MQTT updates.

### 12. Machine ID Mismatch / Unregistered Tablet
- **Scenario:** Tablet is moved to a different machine without re-running setup.
- **Solution:** `POST /menu/:machineId` validates the device API key against the stored machine. If mismatch: tablet shows "Configuration Error — This tablet is registered to a different machine. Please contact support." A hidden admin settings gesture (long-press corner for 5 seconds → prompts admin password) allows re-running the setup flow.

### 13. Dual-Payment Race
- **Scenario:** Two users scan the same QR simultaneously (unlikely on a mounted screen).
- **Solution:** PhonePe's first-successful-payment policy handles this. Backend webhook handler is idempotent — only transitions from `PAYMENT_QR_GENERATED` → `PAID`, never from `PAID` → `PAID`.

### 14. App Crash / Watchdog Recovery
- **Scenario:** APK crashes due to unhandled exception or memory pressure.
- **Solution:** In production (kiosk/launcher mode), Android auto-relaunches the app as the device launcher. The app restores from last-known state stored in local prefs. If a crash loop is detected (3 restarts in <60 seconds), app enters a "Recovery Mode" showing device info + support contact. Admin password needed to exit recovery mode.

### 15. Offline / Network Down Completely
- **Scenario:** WiFi is down when tablet launches, or goes down mid-session.
- **Solution:** On launch with no network: show cached menu if available (items marked "Stock may vary"), otherwise show "Machine Offline" full-screen overlay. Mid-session network loss: after 3 retry failures on any API call, lock entire UI with "Machine Offline" overlay. Tablet continues background retries every 10s. First successful response dismisses overlay. During payment polling, if network drops, the PhonePe webhook still processes server-side — tablet recovers on reconnect.

### 16. Admin Kiosk Unlock
- **Scenario:** Support staff needs to exit kiosk mode to update firmware, change settings, or debug.
- **Solution:** Long-press bottom-right corner of screen for 5 seconds → prompts for admin password → validates via `POST /api/v1/auth/login` → on success, exits kiosk mode to Android home screen. Re-entering the app (which is the launcher) requires re-authentication via setup flow.

### 17. Video Playback Failure
- **Scenario:** Idle video URLs are unreachable or media playback fails.
- **Solution:** Skip failed video, log error to heartbeat payload, attempt next video in playlist. If all videos fail, fall back to static promotional image slideshow.