# Maincrafts — Task 6: Connecting to a Real Backend API

The Task 5 catalog now loads its products over HTTP instead of from a local JSON file.

## Run it

**Option A — FakeStoreAPI (default, no setup)**
1. Open the project folder in VS Code and start **Live Server** on `maincrafts-catalog.html`.
2. The page fetches `https://fakestoreapi.com/products`.

**Option B — JSON Server (changes are saved)**
1. In the project folder run `npm install`, then `npm run api`.
   (This serves `db.json` at `http://localhost:3000/products`.)
2. Open the catalog with Live Server and pick **JSON Server** in the **Data source** menu.

> The page uses ES modules, so it must be opened through `http://` (Live Server). Double-clicking the HTML file will not work.

## What changed from Task 5

| File | Status | Purpose |
|---|---|---|
| `maincrafts-api.js` | **new** | Service layer. All `fetch` calls (GET / POST / DELETE), timeout, error handling, data shaping. |
| `maincrafts-catalog.js` | **rewritten** | UI only. Calls `fetchProducts()`, `addProduct()`, `deleteProduct()`. No raw `fetch`. |
| `maincrafts-catalog.html` | updated | Add Product form, spinner, error banner, data-source switch. |
| `maincrafts-cart.html` | updated | Loads the catalog script as a module. |
| `maincrafts-style.css` | extended | Task 6 block at the bottom (spinner, skeletons, error, toasts, form). |
| `db.json`, `package.json` | **new** | JSON Server data (your 24 Task 5 products) and an `npm run api` script. |

## Checklist

- [x] `api.js` service layer — UI never calls `fetch` directly
- [x] Products loaded from FakeStoreAPI or JSON Server on page load
- [x] Loading spinner **and** skeleton cards while fetching
- [x] Friendly error message for network failures, timeouts and 4xx/5xx, with a **Try again** button
- [x] `async/await` + `try/catch` everywhere, no `.then()` chains
- [x] DELETE button on every card (optimistic: card disappears at once, comes back if the server fails)
- [x] Add Product form sends POST and puts the new card first
- [x] Search (debounced 300ms), category filter, sorting and pagination run on fetched data
- [x] Cart (LocalStorage) works with fetched products

## Things worth knowing

- **FakeStoreAPI only pretends to save.** It accepts POST/DELETE and replies, but nothing is stored, so your changes disappear on reload. This is expected; use JSON Server to see changes persist (check `db.json` after adding a product).
- **Prices:** FakeStoreAPI prices are in US dollars. They are shown in ₹ using a fixed rate (`usdToInr: 83` in `maincrafts-api.js`) so the cart stays in one currency.
- **Cart lines are matched on source + id**, because FakeStoreAPI, JSON Server and your old Task 5 data all number products from 1. Items already in your Task 5 cart keep working and show an icon instead of a photo.
- To demo the error state, choose **JSON Server** while it is not running, then start it and click **Try again**.
- Open DevTools → Network to see the `GET`, `POST` and `DELETE` requests with their status codes.
