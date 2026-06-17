# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start CAP server locally with CSV mock data (NODE_ENV=development)
npm test             # Run all Jest tests (6 tests, ~2s)
npm test -- --testNamePattern="filtra"  # Run a single test by name pattern
npx cds compile db/schema.cds --to json  # Validate CDS schema
npx cds serve --with-mocks               # Alternative dev start
NODE_ENV=production npm start            # Start with production profile (CPI stub active)
mbt build                                # Build MTA archive for BTP deploy
```

## Architecture

This is a **SAP CAP (Cloud Application Programming Model)** project targeting SAP BTP Cloud Foundry. It replaces a legacy Web Dynpro "Demonstrativo de Crédito" report with a Fiori Elements List Report over OData V4.

### Mock-first strategy

Development and tests always use in-memory SQLite seeded from `db/data/my.company-CreditItems.csv`. Production switches to SAP HANA + CPI REST call — **no code change required**, only `NODE_ENV=production`.

The switch is controlled by `IS_PROD = process.env.NODE_ENV === 'production'` at the top of `srv/credit-service.js`.

### Request flow (production)

```
Browser → Fiori Elements
        → CAP getItems() function  (OData V4 function import, not entity query)
        → _fetchFromCPI()          (POST /getBalancedItems to CPI)
        → SAP CPI Integration Suite
        → Cloud Connector → ECC on-premise
        → BAPI_AR_ACC_GETBALANCEDITEMS
```

In development `_fetchFromMock()` runs a CDS SELECT against the SQLite CSV data instead.

### Key design decisions

- **`getItems` is a CAP function, not a direct entity filter.** The RFC `BAPI_AR_ACC_GETBALANCEDITEMS` requires explicit `DATE_FROM`/`DATE_TO` parameters, so date filtering cannot be delegated to OData `$filter`. `dateFrom` and `dateTo` are mandatory.
- **Nota fiscal filter is applied in-process** (`_mapRFCtoEntity` / `_fetchFromMock`), not in the RFC, because the BAPI has no NF parameter.
- **CSV naming convention is mandatory:** `db/data/my.company-CreditItems.csv` — CAP derives the target entity from `namespace-EntityName.csv`.
- **No `better-sqlite3` or `sqlite3` directly** — only `@cap-js/sqlite` (official CAP adapter, no native build issues on BTP).
- **Date conversion:** CAP uses `YYYY-MM-DD`; SAP ABAP RFC uses `YYYYMMDD`. `_fetchFromCPI` converts both directions.

### CPI contract

POST `https://<cpi-host>/api/credit/v1/getBalancedItems` with JSON `{ COMPANY_CODE, CUSTOMER, DATE_FROM, DATE_TO }` (dates as `YYYYMMDD`). Response: `{ RETURN: { TYPE, CODE, MESSAGE }, LINEITEMS: [...] }`. `TYPE='E'` means error. The 14 RFC fields used are mapped in `_mapRFCtoEntity()`.

### Test setup

Tests use `@cap-js/cds-test` (requires `@sap/cds >= 9.8`). The server starts once for the whole suite via `cds.test(__dirname + '/..')`. For HTTP error assertions use function-call syntax with `validateStatus` — tagged template literals do not support extra arguments:

```js
// Correct — avoids throw on 4xx, lets you assert res.status
const res = await GET(`/path`, { validateStatus: () => true });

// Wrong — syntax error in const declaration
const res = await GET`/path`, { expect: 400 };
```
