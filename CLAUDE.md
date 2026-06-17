# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start CAP server locally with CSV mock data (NODE_ENV=development)
npm test             # Run all Jest tests (6 tests, ~2s)
npm test -- --testNamePattern="filtra"  # Run a single test by name pattern
npx cds compile db/schema.cds --to json  # Validate CDS schema
NODE_ENV=production npm start            # Start with production profile (CPI stub active)
mbt build                                # Build MTA archive for BTP deploy
```

## URLs de desenvolvimento

```
http://localhost:4004/credito/webapp/index.html#CreditItems-display   # App standalone
http://localhost:4004/$fiori-preview/CreditService/CreditItems#preview-app  # CAP preview
http://localhost:4004/odata/v4/credit/CreditItems                     # OData endpoint
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
- **`app/services.cds` must stay empty.** CAP includes all `app/**/*.cds` automatically. This file came from a scaffold with a broken reference (`./project1/annotations`) — keep it empty.

### CPI contract

POST `https://<cpi-host>/api/credit/v1/getBalancedItems` with JSON `{ COMPANY_CODE, CUSTOMER, DATE_FROM, DATE_TO }` (dates as `YYYYMMDD`). Response: `{ RETURN: { TYPE, CODE, MESSAGE }, LINEITEMS: [...] }`. `TYPE='E'` means error. The 14 RFC fields used are mapped in `_mapRFCtoEntity()`.

## Fiori Elements app

### SAPUI5 version

Always use **1.145.0**. The CAP cds-fiori plugin uses this version in `/$fiori-preview/`. Modules `sap.fe.core` and `sap.fe.templates` have bugs in earlier versions.

### Standalone index.html — ushell sandbox pattern

`sap.fe.core.AppComponent` requires the Fiori Shell to place views via `sap.fe.core.internal.Target`. Direct `ComponentSupport` renders blank. The only working approach for standalone dev is the ushell sandbox:

```html
<!-- 1. ushell config BEFORE everything -->
<script>
  window["sap-ushell-config"] = {
    defaultRenderer: "fiori2",
    renderers: { fiori2: { componentData: { config: { enableSearch: false } } } },
    applications: {
      "CreditItems-display": {
        additionalInformation: "SAPUI5.Component=com.heineken.demonstrativoCredito",
        applicationType: "SAPUI5",   // must be SAPUI5, not URL
        url: "/credito/webapp",
        navigationMode: "embedded"
      }
    }
  };
</script>

<!-- 2. shell sandbox BEFORE sap-ui-core -->
<script id="sap-ushell-bootstrap"
  src="https://sapui5.hana.ondemand.com/1.145.0/test-resources/sap/ushell/bootstrap/sandbox.js">
</script>

<!-- 3. bootstrap — resourceroots MUST include the namespace AND its parent -->
<script id="sap-ui-bootstrap"
  src="https://sapui5.hana.ondemand.com/1.145.0/resources/sap-ui-core.js"
  data-sap-ui-resourceroots='{"com.heineken.demonstrativoCredito":"/credito/webapp","com.heineken":"/credito/webapp"}'
  data-sap-ui-libs="sap.ui.core, sap.m, sap.ushell, sap.fe.templates"
  ...
></script>

<!-- 4. async renderer -->
<script>
  sap.ui.getCore().attachInit(function () {
    sap.ushell.Container.createRenderer(undefined, true).then(function (r) { r.placeAt("content"); });
  });
</script>
<body class="sapUiBody sapUiSizeCompact" id="content"></body>
```

**Why parent namespace in resourceroots:** UI5 component loader traverses the namespace hierarchy and tries to fetch `com.heineken/manifest.json`. Without the parent registered, it falls back to the CDN, gets a 404, and fails fatally.

**Why `applicationType: "SAPUI5"` not `"URL"`:** URL type passes `manifest: false` to the component factory — `sap.fe.core.AppComponent` fails without its manifest.

**Navigation hash:** Without `rootIntent` in the renderer config, the URL hash drives navigation:
`index.html#CreditItems-display`

### Manifest key settings

Use `contextPath` (not `entitySet`) — required in sap.fe.templates 1.120+:

```json
"settings": {
  "contextPath": "/CreditItems",
  "initialLoad": true,
  "controlConfiguration": {
    "@com.sap.vocabularies.UI.v1.LineItem": {
      "tableSettings": {
        "type": "ResponsiveTable",
        "selectionMode": "None",
        "creationMode": { "name": "None" }
      }
    }
  }
}
```

### Auxiliary files required

| File | Purpose |
|---|---|
| `app/credito/webapp/Component-preload.js` | Empty bundle — prevents CAP from returning HTML on 404 (MIME block) |
| `app/credito/webapp/appconfig/fioriSandboxConfig.json` | Config fetched by sandbox.js at `../appconfig/` relative path |
| `app/credito/webapp/changes/flexibility-bundle.json` | Must be an object `{ "changes": [], ... }` — NOT an array `[]` |

## Test setup

Tests use `@cap-js/cds-test` (requires `@sap/cds >= 9.8`). The server starts once for the whole suite via `cds.test(__dirname + '/..')`. For HTTP error assertions use function-call syntax with `validateStatus` — tagged template literals do not support extra arguments:

```js
// Correct — avoids throw on 4xx, lets you assert res.status
const res = await GET(`/path`, { validateStatus: () => true });

// Wrong — syntax error in const declaration
const res = await GET`/path`, { expect: 400 };
```
