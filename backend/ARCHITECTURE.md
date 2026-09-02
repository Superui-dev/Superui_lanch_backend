# SuperUI — MongoDB Multi-Database Architecture

Last updated: 2026-09-01

The backend uses **four MongoDB databases** (Atlas clusters) with strict separation of concerns:

| DB | Cluster name | URI env var | Purpose |
| --- | --- | --- | --- |
| DB1 | `catalog_db_1` | `MONGO_DB_1_URI` | **Primary Catalog** — active reads + writes |
| DB2 | `catalog_db_2` | `MONGO_DB_2_URI` | **Catalog Overflow** — auto-activated when DB1 reaches threshold |
| DB3 | `commerce_db` | `MONGO_DB_3_URI` | **Users + Commerce** — never used for catalog overflow |
| DB4 | `operations_security_db` | `MONGO_DB_4_URI` | **Operations + Security** — promotions, logs, delivery |

## Collection Placement

### DB1 (`catalog_db_1`) — Primary Catalog
- `products`
- `categories`
- `productimages`
- `producttechstacks`
- `productfeatures`
- `producthighlights`
- `productfaqs`
- `productversions`
- `heroimages`
- `sitesettings`
- `counters`
- `downloadtokens`
- `downloadlogs`

### DB2 (`catalog_db_2`) — Catalog Overflow
Same schema as DB1. **Writes activate automatically** when:
- DB1 `products` count ≥ `CATALOG_DB_OVERFLOW_THRESHOLD` (default **50,000**), **or**
- DB1 storage size ≥ **4 GB**

`GET /apiCatalogPrimaryConnectionSync()` returns the current primary connection; overflow is checked once per minute.

**Reads** continue to query both DB1 + DB2 and merge results with de-duplication by `_id`. The `Product` and `Category` facades and the sub-collection facades (`ProductImage`, `ProductTechStack`, `ProductFeature`, etc.) all read from both connections transparently.

### DB3 (`commerce_db`) — Users + Commerce
- `users`
- `orders`
- `orderitems`
- `invoices`
- `payments`
- `carts`
- `wishlists`

**DB3 is never used for catalog overflow** — overflow only writes products + sub-collections into DB2.

### DB4 (`operations_security_db`) — Operations + Security

**Promotions / Engagement:**
- `feedback`
- `issues`
- `bookings`
- `pageviews`
- `visitors`

**Site Content:**
- `heroimages`
- `sitesettings`
- `counters`

**Security / Delivery:**
- `adminlogs`
- `emaillogs`
- `paymentevents`
- `contacts`
- `notifications`
- `deliveries`
- `downloadtokens`
- `downloadlogs`

## Connection Getters (`src/config/db.js`)

| New getter | Returns |
| --- | --- |
| `getCatalogDb1Connection()` | DB1 primary connection |
| `getCatalogDb2Connection()` | DB2 overflow connection |
| `getCatalogPrimaryConnection()` (async) | DB1 or DB2 based on overflow |
| `getCatalogPrimaryConnectionSync()` | Same, without overflow check |
| `getCatalogReadConnections()` | `[DB1, DB2]` for merged reads |
| `getCommerceConnection()` | DB3 |
| `getOperationsConnection()` | DB4 |

**Backwards-compatible aliases** (kept for legacy callers):
- `getCoreConnection` → `getCatalogDb1Connection`
- `getUsersConnection` → `getCommerceConnection`
- `getPromotionsConnection` / `getSecurityConnection` / `getAnalyticsConnection` → `getOperationsConnection`
- `getMessagingConnection` → `getCommerceConnection`

## Catalog Facades

Two facades let you treat the catalog as a single model:

- **`Product`** (`src/models/Product.js`) — `Product.read.find(...)`, `Product.create(...)`, `Product.findByIdAndUpdate(...)`, `Product.findByIdAndDelete(...)`, `Product.findOne(...)`, `Product.countDocuments(...)`, `Product.deleteMany(...)`.
- **`Category`** (`src/models/Category.js`) — same API.
- **Sub-collection facades** (`src/models/ProductSubCollections.js`):
  - `ProductImage.findAllForProduct(productId)`, `replaceForProduct(productId, docs)`
  - `ProductTechStack.findAllForProduct(productId)`, `replaceForProduct(productId, docs)`
  - `ProductFeature.findAllForProduct(productId)`, `replaceForProduct(productId, docs)`
  - `ProductHighlight`, `ProductFAQ`, `ProductVersion` — same shape.

## Overflow Logic

1. Every 60 seconds, `checkOverflowStatus()` runs `dbStats` + `estimatedDocumentCount('products')` against DB1.
2. If count ≥ threshold **or** size ≥ 4 GB → set `overflowActive = true` and log a warning.
3. New product writes go to DB2 (`Product.create`, `replaceForProduct`).
4. Reads always span both DB1 + DB2.
5. When count drops below threshold again → overflow deactivated.

## Schema Highlights

- **`products.productId`** — immutable, format `SUP-YYYY-XXXXXX`, generated atomically via `Counter.findOneAndUpdate` with year-scoped key (`product_sup_<year>`). Database-enforced `unique` constraint guarantees no collisions.
- **`products.slug`** — immutable, auto-generated from name with collision-check across DB1 + DB2.
- **Soft delete only** — `status='archived'` + `archivedAt` date; `productId` is never reused.
- **Pricing** — `originalPrice` ≥ `sellingPrice`; `discountPercent` computed in pre-validate hook.
- **Tech stack colors** — stored per product (`color` hex field); admin UI uses DB values, not defaults.