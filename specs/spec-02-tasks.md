# Especificação de Tasks — Demonstrativo de Crédito
**Arquivo 2 de 3 — Para execução no Claude Code / VS Code**

Este arquivo detalha cada task de implementação com contexto, arquivos a criar/editar, código completo e critério de aceite. Execute as tasks em sequência — cada uma deve ser verificada antes de avançar.

---

## Índice de Tasks

| Task | Título | Escopo Principal |
|---|---|---|
| T01 | Scaffold do projeto CAP | `cds init`, `package.json`, `.gitignore` |
| T02 | Schema CDS | `db/schema.cds` |
| T03 | CSV Mock | `db/data/my.company-CreditItems.csv` |
| T04 | Service CDS | `srv/credit-service.cds` |
| T05 | Handler Mock | `srv/credit-service.js` — `_fetchFromMock` |
| T06 | Anotações Fiori Elements | `app/credito/annotations.cds` |
| T07 | Manifest Fiori | `app/credito/webapp/manifest.json` |
| T08 | Configuração multi-profile | `.cdsrc.json` |
| T09 | Handler Produção (stub CPI) | `srv/credit-service.js` — `_fetchFromCPI` |
| T10 | MTA descriptor BTP | `mta.yaml` |
| T11 | Testes unitários | `test/credit.test.js` |
| T12 | Validação de deploy BTP | `mbt build` + `cf push` |

---

## T01 — Scaffold do Projeto CAP

**Objetivo:** criar a estrutura base do projeto CAP pronta para desenvolvimento local e deploy no BTP.

### Comandos

```bash
mkdir demonstrativo-credito && cd demonstrativo-credito
cds init
npm install
```

### `package.json` — dependências obrigatórias

```json
{
  "name": "demonstrativo-credito",
  "version": "1.0.0",
  "scripts": {
    "start": "cds-serve",
    "dev": "cds serve --with-mocks",
    "test": "jest --testEnvironment node"
  },
  "dependencies": {
    "@sap/cds": "^8",
    "express": "^4"
  },
  "devDependencies": {
    "@cap-js/sqlite": "^1",
    "@sap/cds-dk": "^8",
    "jest": "^29",
    "@sap/cds-test": "latest"
  },
  "jest": {
    "testTimeout": 30000
  }
}
```

> ⚠️ **Atenção:** NÃO usar `better-sqlite3` ou `sqlite3` diretamente. Usar apenas `@cap-js/sqlite`, que é a implementação oficial CAP e não tem problemas de build no BTP.

### Critério de Aceite

- [ ] `cds version` retorna versão >= 8
- [ ] `cds serve` não retorna erro de startup
- [ ] Estrutura de pastas `app/`, `srv/`, `db/` criada

---

## T02 — Schema CDS

**Arquivo a criar:** `db/schema.cds`

```cds
namespace my.company;

/**
 * CreditItems — entidade principal
 * Mapeada da tabela BAPI3007_2 retornada pela RFC BAPI_AR_ACC_GETBALANCEDITEMS
 */
entity CreditItems {
  key ID           : UUID;                     // Chave técnica gerada no CAP
  clearingDocNo    : String(10);               // CLR_DOC_NO      — No. Doc. Compensação
  docType          : String(2);                // DOC_TYPE         — Tipo
  paymentMethod    : String(1);                // PYMNT_METH       — MP
  clearingDate     : Date;                     // CLEAR_DATE       — Data da Compensação
  docNo            : String(10);               // DOC_NO           — Número do Documento
  amountLC         : Decimal(15, 2);           // LC_AMOUNT        — Valor R$
  currency         : String(5) default 'BRL';  // CURRENCY
  itemText         : String(50);               // ITEM_TEXT        — Pedido
  notaFiscal       : String(35);               // REF_DOC_NO_LONG  — Nota Fiscal
  companyCode      : String(4);                // COMP_CODE
  customer         : String(10);               // CUSTOMER
  postingDate      : Date;                     // PSTNG_DATE
  fiscalYear       : String(4);                // FISC_YEAR
  dbCrIndicator    : String(1);                // DB_CR_IND
}
```

### Critério de Aceite

- [ ] `cds compile db/schema.cds --to json` retorna JSON sem erros
- [ ] Todos os 15 campos presentes com tipos corretos

---

## T03 — CSV Mock — Dados de Teste

**Arquivo a criar:** `db/data/my.company-CreditItems.csv`

> A convenção de nome `namespace-EntityName.csv` é **obrigatória** para o CAP fazer o seed automático.

```csv
ID,clearingDocNo,docType,paymentMethod,clearingDate,docNo,amountLC,currency,itemText,notaFiscal,companyCode,customer,postingDate,fiscalYear,dbCrIndicator
11111111-0000-0000-0000-000000000001,100383752,AB,,2026-02-12,0103883221,15.78,BRL,FINR3000670 NF 16642,0000000000043569,1000,0000100001,2026-02-12,2026,H
11111111-0000-0000-0000-000000000002,100383752,AB,,2026-02-12,0104312910,65.11,BRL,FINR3089205 NF 002729364-001,0000000000044927,1000,0000100001,2026-02-12,2026,H
11111111-0000-0000-0000-000000000003,100383752,AB,,2026-02-12,0104312910,26.86,BRL,FINR3089205 NF 002725611-001,0000000000044927,1000,0000100001,2026-02-12,2026,H
11111111-0000-0000-0000-000000000004,100383752,36,,2026-02-12,3600007944,114556.18,BRL,REVENUE - Acoes Comerciais OW Outros Nov/2025,REVENUE,1000,0000100001,2026-02-12,2026,H
11111111-0000-0000-0000-000000000005,100383752,36,,2026-02-12,3600008751,90.40,BRL,Reembolso Revendas Promo RGB Novembro,REEMBOLSO REVEND,1000,0000100001,2026-02-12,2026,H
11111111-0000-0000-0000-000000000006,100383753,AB,D,2026-01-15,0103991100,250.00,BRL,FINR4000001 NF 00001,0000000000055001,1000,0000100002,2026-01-15,2026,S
11111111-0000-0000-0000-000000000007,100383754,36,,2026-01-20,3600009100,1800.00,BRL,BONUS Janeiro 2026,BONUS JAN,1000,0000100002,2026-01-20,2026,H
11111111-0000-0000-0000-000000000008,100383755,AB,T,2026-03-01,0105000001,320.50,BRL,FINR5000001 NF 99999,0000000000066001,1000,0000100001,2026-03-01,2026,S
11111111-0000-0000-0000-000000000009,100383756,36,,2026-03-05,3600010000,-500.00,BRL,ESTORNO REVENUE FEV,ESTORNO,1000,0000100003,2026-03-05,2026,S
11111111-0000-0000-0000-000000000010,100383757,AB,,2026-03-10,0106000001,45.20,BRL,FINR6000001 NF 77777,0000000000077001,1000,0000100003,2026-03-10,2026,H
```

### Cenários cobertos

- Tipo AB com e sem `paymentMethod`
- Tipo 36 (revenue, reembolso, estorno)
- Valor negativo (estorno — linha 9)
- Diferentes clientes (100001, 100002, 100003)
- Datas em 3 meses distintos (Jan, Fev, Mar/2026) para teste de filtro de período
- Nota fiscal numérica e textual (REVENUE, REEMBOLSO REVEND, ESTORNO)

### Critério de Aceite

- [ ] `cds serve` e `GET /odata/v4/credit/CreditItems` retorna 10 registros
- [ ] Filtro `?$filter=clearingDate ge 2026-02-01` retorna apenas registros de Fev+

---

## T04 — Service CDS

**Arquivo a criar:** `srv/credit-service.cds`

```cds
using my.company as db from '../db/schema';

/**
 * CreditService — OData V4 exposto em /odata/v4/credit
 * Serve a entidade CreditItems e a função de consulta paramétrica
 */
@path: '/odata/v4/credit'
service CreditService {

  /**
   * Projeção somente-leitura sobre CreditItems
   * Suporta $filter, $orderby, $top, $skip (OData V4 padrão)
   */
  @readonly
  entity CreditItems as projection on db.CreditItems;

  /**
   * Função paramétrica para consulta com parâmetros de RFC
   * dateFrom e dateTo são obrigatórios (requeridos pela BAPI no ECC)
   * notaFiscal é opcional — filtro parcial
   */
  function getItems(
    dateFrom   : Date,          // DATE_FROM → BAPI param
    dateTo     : Date,          // DATE_TO   → BAPI param
    notaFiscal : String(35)     // REF_DOC_NO_LONG — filtro local/CPI
  ) returns array of CreditItems;

}
```

### Critério de Aceite

- [ ] `GET /odata/v4/credit/$metadata` retorna EDMX com `CreditItems` e `getItems`
- [ ] Entidade `CreditItems` tem todos os campos do schema
- [ ] Função `getItems` aparece no metadata como `FunctionImport`

---

## T05 — Handler Mock (getItems)

**Arquivo a criar:** `srv/credit-service.js`

```javascript
'use strict';
const cds = require('@sap/cds');

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = class CreditService extends cds.ApplicationService {

  async init() {
    // Handler da função paramétrica getItems
    this.on('getItems', async (req) => {
      const { dateFrom, dateTo, notaFiscal } = req.data;

      // Validação de parâmetros obrigatórios
      if (!dateFrom || !dateTo) {
        return req.error(400, 'Os parâmetros dateFrom e dateTo são obrigatórios');
      }
      if (new Date(dateFrom) > new Date(dateTo)) {
        return req.error(400, 'dateFrom não pode ser maior que dateTo');
      }

      if (IS_PROD) {
        return await this._fetchFromCPI(req.data);
      }
      return await this._fetchFromMock(req.data);
    });

    return super.init();
  }

  /**
   * Implementação MOCK — consulta CSV via CDS query
   * Ativa quando NODE_ENV != 'production'
   */
  async _fetchFromMock({ dateFrom, dateTo, notaFiscal }) {
    const { CreditItems } = this.entities;

    let query = SELECT.from(CreditItems)
      .where`clearingDate >= ${dateFrom} and clearingDate <= ${dateTo}`;

    const results = await cds.run(query);

    // Filtro de Nota Fiscal (parcial, case-insensitive)
    if (notaFiscal) {
      const term = notaFiscal.toUpperCase();
      return results.filter(r =>
        r.notaFiscal && r.notaFiscal.toUpperCase().includes(term)
      );
    }
    return results;
  }

  /**
   * Implementação PRODUÇÃO — delega para CPI endpoint
   * Ativa quando NODE_ENV === 'production'
   * STUB: implementação completa na T09
   */
  async _fetchFromCPI(params) {
    // TODO T09: implementar integração CPI
    throw Object.assign(
      new Error('CPI integration not yet implemented'),
      { status: 501 }
    );
  }

  /**
   * Mapeia campos RFC (ABAP) para campos CDS
   * Usado pela implementação de produção (T09)
   */
  _mapRFCtoEntity(items = [], notaFiscal) {
    return items
      .filter(i => !notaFiscal ||
        i.REF_DOC_NO_LONG?.toUpperCase().includes(notaFiscal.toUpperCase()))
      .map(i => ({
        ID            : cds.utils.uuid(),
        clearingDocNo : i.CLR_DOC_NO?.trim()      ?? '',
        docType       : i.DOC_TYPE?.trim()         ?? '',
        paymentMethod : i.PYMNT_METH?.trim()       ?? '',
        clearingDate  : i.CLEAR_DATE               ?? null,
        docNo         : i.DOC_NO?.trim()            ?? '',
        amountLC      : parseFloat(i.LC_AMOUNT      ?? 0),
        currency      : i.CURRENCY?.trim()          ?? 'BRL',
        itemText      : i.ITEM_TEXT?.trim()         ?? '',
        notaFiscal    : i.REF_DOC_NO_LONG?.trim()  ?? '',
        companyCode   : i.COMP_CODE?.trim()         ?? '',
        customer      : i.CUSTOMER?.trim()          ?? '',
        postingDate   : i.PSTNG_DATE               ?? null,
        fiscalYear    : i.FISC_YEAR?.trim()         ?? '',
        dbCrIndicator : i.DB_CR_IND?.trim()         ?? '',
      }));
  }
};
```

### Critério de Aceite

- [ ] `GET /odata/v4/credit/getItems(dateFrom='2026-02-01',dateTo='2026-02-28')` retorna 5 registros
- [ ] `GET` com `notaFiscal='44927'` retorna apenas os 2 registros com essa nota
- [ ] `GET` sem `dateFrom` retorna erro 400
- [ ] `dateFrom > dateTo` retorna erro 400

---

## T06 — Anotações Fiori Elements

**Arquivo a criar:** `app/credito/annotations.cds`

```cds
using CreditService as service from '../../srv/credit-service';

// ─── Labels dos campos ────────────────────────────────────────────────────
annotate service.CreditItems with {
  clearingDocNo  @title: 'No. Documento de Compensação';
  docType        @title: 'Tipo';
  paymentMethod  @title: 'MP';
  clearingDate   @title: 'Data da Compensação';
  docNo          @title: 'Número do Documento';
  amountLC       @title: 'Valor R$'
                 @Measures.ISOCurrency: currency;
  itemText       @title: 'Pedido';
  notaFiscal     @title: 'Nota Fiscal';
  companyCode    @title: 'Empresa';
  customer       @title: 'Cliente';
}

// ─── UI List Report ───────────────────────────────────────────────────────
annotate service.CreditItems with @(

  UI.HeaderInfo: {
    TypeName       : 'Demonstrativo de Crédito',
    TypeNamePlural : 'Demonstrativo de Crédito',
    Title          : { $Type: 'UI.DataField', Value: clearingDocNo }
  },

  // Colunas da tabela de resultado (ordem = ordem da tela legada)
  UI.LineItem: [
    { $Type: 'UI.DataField', Value: clearingDocNo,  Label: 'No. Doc. Compensação' },
    { $Type: 'UI.DataField', Value: docType,        Label: 'Tipo' },
    { $Type: 'UI.DataField', Value: paymentMethod,  Label: 'MP' },
    { $Type: 'UI.DataField', Value: clearingDate,   Label: 'Data da Compensação' },
    { $Type: 'UI.DataField', Value: docNo,          Label: 'Número do Documento' },
    { $Type: 'UI.DataField', Value: amountLC,       Label: 'Valor R$' },
    { $Type: 'UI.DataField', Value: itemText,       Label: 'Pedido' },
    { $Type: 'UI.DataField', Value: notaFiscal,     Label: 'Nota Fiscal' },
  ],

  // Filtros da barra de busca
  UI.SelectionFields: [
    clearingDate,
    notaFiscal
  ],

);
```

### Critério de Aceite

- [ ] `cds preview` (Fiori Sandbox) abre o List Report com as 8 colunas
- [ ] Filtros Data da Compensação e Nota Fiscal aparecem na Search Bar
- [ ] Coluna Valor R$ exibe formatação monetária

---

## T07 — Manifest Fiori

**Arquivo a criar:** `app/credito/webapp/manifest.json`

```json
{
  "_version": "1.65.0",
  "sap.app": {
    "id": "com.heineken.demonstrativoCredito",
    "type": "application",
    "title": "Demonstrativo de Crédito",
    "description": "Consulta de itens compensados AR — substitui portal legado Web Dynpro",
    "applicationVersion": { "version": "1.0.0" },
    "dataSources": {
      "creditService": {
        "uri": "/odata/v4/credit/",
        "type": "OData",
        "settings": { "odataVersion": "4.0" }
      }
    }
  },
  "sap.ui5": {
    "dependencies": {
      "minUI5Version": "1.120.0",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {},
        "sap.fe.templates": {}
      }
    },
    "models": {
      "": {
        "dataSource": "creditService",
        "settings": {
          "synchronizationMode": "None",
          "operationMode": "Server"
        }
      }
    },
    "routing": {
      "routes": [{
        "pattern": ":?query:",
        "name": "CreditItemsList",
        "target": "CreditItemsList"
      }],
      "targets": {
        "CreditItemsList": {
          "type": "Component",
          "id": "CreditItemsList",
          "name": "sap.fe.templates.ListReport",
          "options": {
            "settings": {
              "entitySet": "CreditItems",
              "variantManagement": "Page",
              "initialLoad": false
            }
          }
        }
      }
    }
  }
}
```

### Critério de Aceite

- [ ] `cds preview` abre Fiori Sandbox sem erro de manifest
- [ ] List Report carrega com título "Demonstrativo de Crédito"
- [ ] Botão "Go" aciona a consulta e exibe os dados mock

---

## T08 — Configuração Multi-Profile (`.cdsrc.json`)

**Arquivo a criar:** `.cdsrc.json` (raiz do projeto)

```json
{
  "requires": {
    "[development]": {
      "db": {
        "kind": "sqlite",
        "credentials": { "url": ":memory:" }
      }
    },
    "[production]": {
      "db": {
        "kind": "hana"
      },
      "CreditRFC": {
        "kind": "rest",
        "credentials": {
          "url": "https://<cpi-host>/api/credit/v1",
          "authentication": "OAuth2ClientCredentials",
          "tokenServiceUrl": "https://<xsuaa-host>/oauth/token",
          "clientId": "<client-id>",
          "clientSecret": "<client-secret>"
        }
      }
    }
  },
  "server": {
    "cors": true
  }
}
```

### Como usar

- **Desenvolvimento:** `cds serve` (NODE_ENV=development implícito)
- **Produção BTP:** `NODE_ENV=production node_modules/.bin/cds-serve`
- As credenciais de produção virão de variáveis de ambiente BTP ou do serviço de Destination

### Critério de Aceite

- [ ] `cds serve` em development carrega CSV e retorna dados
- [ ] `NODE_ENV=production cds serve` sobe sem erro de config (CPI stub ativo)

---

## T09 — Handler Produção — Integração CPI

**Arquivo a editar:** `srv/credit-service.js` — substituir o método `_fetchFromCPI`

> ⚠️ Esta task substitui o stub de T05 pela implementação real de chamada ao endpoint CPI REST que intermedia a RFC `BAPI_AR_ACC_GETBALANCEDITEMS`.

```javascript
/**
 * PRODUÇÃO: chama CPI endpoint que expõe a RFC como REST
 * O CPI recebe JSON { DATE_FROM, DATE_TO, COMPANY_CODE, CUSTOMER }
 * e retorna { RETURN: {...}, LINEITEMS: [...] }
 */
async _fetchFromCPI({ dateFrom, dateTo, notaFiscal }) {
  const ext = await cds.connect.to('CreditRFC');

  // Converte datas de YYYY-MM-DD para YYYYMMDD (formato SAP ABAP)
  const toSapDate = d => d ? d.replace(/-/g, '') : '';

  // companyCode e customer virão do contexto do usuário autenticado (xsuaa)
  const companyCode = process.env.DEFAULT_COMPANY_CODE || '1000';
  const customer    = process.env.DEFAULT_CUSTOMER     || '';

  const response = await ext.send({
    method : 'POST',
    path   : '/getBalancedItems',
    data   : {
      COMPANY_CODE : companyCode,
      CUSTOMER     : customer,
      DATE_FROM    : toSapDate(dateFrom),
      DATE_TO      : toSapDate(dateTo)
    }
  });

  if (!response || !response.LINEITEMS) {
    const msg = response?.RETURN?.MESSAGE || 'Sem retorno da RFC';
    return req.error(502, `Erro CPI: ${msg}`);
  }

  if (response.RETURN?.TYPE === 'E') {
    return req.error(502, `Erro ECC: ${response.RETURN.MESSAGE}`);
  }

  return this._mapRFCtoEntity(response.LINEITEMS, notaFiscal);
}
```

> **Dependência:** configuração de Destination no BTP apontando para CPI (tarefa de infraestrutura, fora do escopo do código).

### Critério de Aceite

- [ ] `NODE_ENV=production` com CPI disponível: `getItems` retorna dados reais do ECC
- [ ] Erro de CPI retorna HTTP 502 com mensagem legível
- [ ] `NODE_ENV=development`: T09 não afeta comportamento (`IS_PROD = false`)

---

## T10 — MTA Descriptor para BTP (`mta.yaml`)

**Arquivo a criar:** `mta.yaml` (raiz do projeto)

```yaml
_schema-version: '3.3.0'
ID: demonstrativo-credito
version: 1.0.0
description: Demonstrativo de Crédito — SAP CAP BTP

modules:

  - name: demonstrativo-credito-srv
    type: nodejs
    path: .
    parameters:
      buildpack: nodejs_buildpack
      disk-quota: 512M
      memory: 256M
    build-parameters:
      builder: npm
      build-result: .
      ignore: [node_modules/, .env]
    requires:
      - name: demonstrativo-credito-dest
      - name: demonstrativo-credito-xsuaa
    provides:
      - name: srv-api
        properties:
          srv-url: ${default-url}

  - name: demonstrativo-credito-app
    type: html5
    path: app/credito
    build-parameters:
      builder: custom
      commands: []
      supported-platforms: []

resources:

  - name: demonstrativo-credito-dest
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: demonstrativo-credito-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      config:
        xsappname: demonstrativo-credito
        tenant-mode: dedicated
```

### Critério de Aceite

- [ ] `mbt build` executa sem erros e gera pasta `mta_archives/`
- [ ] `cf deploy mta_archives/*.mtar` sobe os módulos no BTP
- [ ] App acessível via URL do BTP com dados mock

---

## T11 — Testes Unitários (Jest + `@sap/cds-test`)

**Arquivo a criar:** `test/credit.test.js`

```javascript
'use strict';
const cds = require('@sap/cds/lib');

describe('CreditService — Mock Tests', () => {

  const { GET } = cds.test('.').in(__dirname + '/..');

  it('retorna todos os itens sem filtros adicionais', async () => {
    const { data } = await GET
      `/odata/v4/credit/getItems(dateFrom='2026-01-01',dateTo='2026-12-31')`;
    expect(data.value.length).toBeGreaterThanOrEqual(10);
  });

  it('filtra por periodo de data', async () => {
    const { data } = await GET
      `/odata/v4/credit/getItems(dateFrom='2026-02-01',dateTo='2026-02-28')`;
    expect(data.value.length).toBe(5);
    data.value.forEach(r => {
      const d = new Date(r.clearingDate);
      expect(d.getMonth()).toBe(1); // Fevereiro = índice 1
    });
  });

  it('filtra por nota fiscal (parcial)', async () => {
    const { data } = await GET
      `/odata/v4/credit/getItems(dateFrom='2026-01-01',dateTo='2026-12-31',notaFiscal='44927')`;
    expect(data.value.length).toBe(2);
  });

  it('retorna erro 400 sem dateFrom', async () => {
    const res = await GET
      `/odata/v4/credit/getItems(dateTo='2026-12-31')`, { expect: 400 };
    expect(res.status).toBe(400);
  });

  it('retorna erro 400 quando dateFrom maior que dateTo', async () => {
    const res = await GET
      `/odata/v4/credit/getItems(dateFrom='2026-12-31',dateTo='2026-01-01')`, { expect: 400 };
    expect(res.status).toBe(400);
  });

  it('campos obrigatorios presentes em cada item', async () => {
    const { data } = await GET
      `/odata/v4/credit/getItems(dateFrom='2026-01-01',dateTo='2026-12-31')`;
    const item = data.value[0];
    ['clearingDocNo', 'docType', 'clearingDate', 'docNo', 'amountLC', 'notaFiscal']
      .forEach(field => expect(item).toHaveProperty(field));
  });

});
```

### Critério de Aceite

- [ ] `npm test` retorna 6 testes passing
- [ ] Sem dependência de banco externo — tudo in-memory com CSV seed

---

## T12 — Validação de Deploy BTP

Esta task é um checklist de validação pós-deploy — não gera código novo.

### Pré-requisitos

- CF CLI instalado e autenticado no BTP subaccount
- MBT Tool instalado: `npm install -g mbt`
- Serviços `destination` e `xsuaa` disponíveis no subaccount

### Comandos de deploy

```bash
# Build MTA
mbt build

# Deploy no BTP Cloud Foundry
cf deploy mta_archives/demonstrativo-credito_1.0.0.mtar
```

### Checklist de validação

- [ ] App URL acessível via browser (URL fornecida pelo `cf deploy`)
- [ ] `GET <url>/odata/v4/credit/$metadata` retorna EDMX sem erro
- [ ] `GET <url>/odata/v4/credit/getItems(dateFrom='2026-01-01',dateTo='2026-12-31')` retorna dados mock
- [ ] Fiori Elements UI abre e exibe List Report com as 8 colunas
- [ ] Filtros de data e nota fiscal funcionam na UI
- [ ] `cf logs demonstrativo-credito-srv --recent` sem erros críticos

---

## Definition of Done — Critério de Conclusão do Projeto

| Item | Verificação |
|---|---|
| Todas as 12 tasks concluídas | Checklist T01–T12 completo |
| Testes passando (6/6) | `npm test` — 0 falhas |
| Build MTA sem erros | `mbt build` retorna exit 0 |
| Deploy BTP validado | App acessível e funcional no BTP |
| Chaveamento mock/prod documentado | `.cdsrc.json` com profiles `development` e `production` |
| Mapeamento RFC documentado | 14 campos mapeados em `_mapRFCtoEntity` |
| Spec Driven Development completo | 3 arquivos de spec gerados e revisados |
