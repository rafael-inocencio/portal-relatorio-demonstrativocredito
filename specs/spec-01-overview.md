# Especificação Técnica — Demonstrativo de Crédito
**SAP CAP BTP + Fiori Elements**

| Atributo | Valor |
|---|---|
| Projeto | Demonstrativo de Crédito |
| Versão da Spec | 1.0 |
| Metodologia | Spec Driven Development — Padrão 3 Arquivos |
| Plataforma | SAP BTP — CAP Node.js + SAP Fiori Elements |
| RFC Principal | BAPI_AR_ACC_GETBALANCEDITEMS |
| Estratégia de Dados | Mock-First (CSV) → Produção (RFC via CPI + Cloud Connector) |
| Idioma do Código | Inglês (labels de UI em Português) |

---

## 1. Visão Geral do Projeto

Este projeto substitui o relatório **Demonstrativo de Crédito** do portal legado SAP NetWeaver / Web Dynpro por uma experiência moderna construída sobre SAP Fiori Elements e SAP Cloud Application Programming Model (CAP) no BTP.

### 1.1 Objetivo

Replicar e modernizar a funcionalidade de consulta e exibição de itens compensados de contas a receber, entregando:

- Interface responsiva baseada em SAP Fiori Elements (List Report)
- Backend desacoplado via SAP CAP (Node.js) publicado no BTP
- Estratégia mock-first: dados locais CSV em desenvolvimento; dados reais via RFC ECC em produção
- Interoperabilidade com ECC via Cloud Connector → SAP CPI → CAP

### 1.2 Contexto Legado

A tela legada (Web Dynpro, portal HEINEKEN) apresenta:

- **Tela de filtros:** Data Inicial, Data Final e Nota Fiscal
- **Ação:** botão "Consultar"
- **Resultado:** tabela com colunas No. documento de compensação, Tipo, MP, Data da Compensação, Número do Documento, Valor R$, Pedido e Nota Fiscal
- **Ações na listagem:** Limpar e Imprimir

### 1.3 Arquitetura de Produção

| Camada | Componente | Responsabilidade |
|---|---|---|
| ECC (Backend ABAP) | BAPI_AR_ACC_GETBALANCEDITEMS | Fonte dos dados de itens compensados AR |
| Cloud Connector | SAP Cloud Connector (SCC) | Túnel seguro entre ECC on-premise e BTP |
| Integration | SAP CPI (Integration Suite) | Orquestração, mapeamento e exposição de API REST |
| Application | SAP CAP (Node.js / BTP) | OData V4 service, lógica de negócio, mock-first |
| UI | SAP Fiori Elements (List Report) | Interface declarativa sobre OData V4 |

---

## 2. Estratégia Mock-First

A implementação segue o padrão **mock-first com final pré-definida**: em desenvolvimento e testes os dados são servidos por arquivos CSV locais. Em produção, basta trocar o profile de configuração para que as chamadas externas sejam ativadas.

### 2.1 Por que CSV e não SQLite

Projetos anteriores apresentaram problemas recorrentes com SQLite no ambiente CAP BTP (inconsistências de driver, migração de schema em deploy, diferenças de comportamento). A escolha por CSV elimina esses problemas:

- Arquivos CSV são suportados nativamente pelo CAP
- Sem dependência de driver nativo — compatível com o build do BTP Cloud Foundry
- Dados de teste editáveis em qualquer editor de texto ou Excel
- O CAP carrega os CSV diretamente via `cds serve --with-mocks`
- Troca para produção é apenas configuração: nenhuma linha de código muda

### 2.2 Chaveamento Mock vs Produção

| Ambiente | Arquivo de Config | Fonte de Dados |
|---|---|---|
| Desenvolvimento / Teste | `.cdsrc.json` (profile: development) | CSV local em `db/data/` |
| BTP (Produção) | `.cdsrc.json` (profile: production) | RFC via CPI + Cloud Connector |

O serviço CAP verifica `process.env.NODE_ENV` e, no profile `production`, delega a consulta para um `ExternalService` apontando para o endpoint CPI REST.

---

## 3. Estrutura de Diretórios do Projeto

```
demonstrativo-credito/
├── app/                              # Fiori Elements UI
│   └── credito/                      # Aplicação Fiori
│       ├── webapp/
│       │   └── manifest.json         # Fiori manifest (OData V4)
│       └── annotations.cds           # Anotações UI (labels, filtros, colunas)
├── srv/                              # CAP Service Layer
│   ├── credit-service.cds            # Definição OData V4
│   ├── credit-service.js             # Handlers (mock / produção)
│   └── external/
│       └── CreditRFC.csn             # Contrato do serviço externo (CPI)
├── db/                               # Data Layer
│   ├── schema.cds                    # Entidades CDS
│   └── data/                         # Dados mock (CSV)
│       └── my.company-CreditItems.csv
├── test/
│   └── credit.test.js                # Testes unitários Jest
├── .cdsrc.json                       # Configuração CAP multi-profile
├── package.json
└── mta.yaml                          # Descriptor deploy BTP (MTA)
```

---

## 4. Mapeamento RFC → Entidades CAP

### 4.1 Assinatura da RFC

**RFC:** `BAPI_AR_ACC_GETBALANCEDITEMS`

| Parâmetro | Direção | Campo ABAP | Tipo | Descrição |
|---|---|---|---|---|
| COMPANYCODE | INPUT | COMP_CODE | C(4) | Código da empresa |
| CUSTOMER | INPUT | CUSTOMER | C(10) | Código do cliente |
| DATE_FROM | INPUT | FROM_DATE | D | Data inicial do filtro |
| DATE_TO | INPUT | TO_DATE | D | Data final do filtro |
| RETURN | OUTPUT | BAPIRETURN | Struct | Código de retorno / mensagem de erro |
| LINEITEMS | TABLE | BAPI3007_2 | Table | Itens compensados (resultado principal) |

### 4.2 Campos Utilizados da Tabela LINEITEMS (BAPI3007_2)

Dos 111 campos disponíveis na BAPI3007_2, os seguintes são utilizados neste relatório:

| Campo ABAP | Campo CAP (CDS) | Label PT | Coluna na Tela | Tipo |
|---|---|---|---|---|
| CLR_DOC_NO | clearingDocNo | No. Documento de Compensação | Sim | String(10) |
| DOC_TYPE | docType | Tipo | Sim | String(2) |
| PYMNT_METH | paymentMethod | MP | Sim | String(1) |
| CLEAR_DATE | clearingDate | Data da Compensação | Sim | Date |
| DOC_NO | docNo | Número do Documento | Sim | String(10) |
| LC_AMOUNT | amountLC | Valor R$ | Sim | Decimal(15,2) |
| CURRENCY | currency | Moeda | Interno | String(5) |
| ITEM_TEXT | itemText | Pedido | Sim | String(50) |
| REF_DOC_NO_LONG | notaFiscal | Nota Fiscal | Sim | String(35) |
| COMP_CODE | companyCode | Empresa | Filtro interno | String(4) |
| CUSTOMER | customer | Cliente | Filtro interno | String(10) |
| PSTNG_DATE | postingDate | Data de Lançamento | Filtro UI | Date |
| FISC_YEAR | fiscalYear | Ano Fiscal | Interno | String(4) |
| DB_CR_IND | dbCrIndicator | Indicador D/C | Interno | String(1) |

---

## 5. Filtros da Interface (List Report)

| Filtro UI | Campo CDS | Obrigatório | Tipo | Observação |
|---|---|---|---|---|
| Data Inicial | dateFrom | Sim | Date | Filtro aplicado sobre clearingDate |
| Data Final | dateTo | Sim | Date | Filtro aplicado sobre clearingDate |
| Nota Fiscal | notaFiscal | Não | String | Filtro parcial (contains) |

> **Nota:** `dateFrom` e `dateTo` são parâmetros de função CAP (não filtros OData padrão), pois a RFC exige datas explícitas. A implementação usa uma função com `@odata.draft.enabled: false`.

---

## 6. Definição CDS

### 6.1 `db/schema.cds`

```cds
namespace my.company;

entity CreditItems {
  key ID           : UUID;
  clearingDocNo    : String(10);
  docType          : String(2);
  paymentMethod    : String(1);
  clearingDate     : Date;
  docNo            : String(10);
  amountLC         : Decimal(15, 2);
  currency         : String(5)  default 'BRL';
  itemText         : String(50);
  notaFiscal       : String(35);
  companyCode      : String(4);
  customer         : String(10);
  postingDate      : Date;
  fiscalYear       : String(4);
  dbCrIndicator    : String(1);
}
```

### 6.2 `srv/credit-service.cds`

```cds
using my.company as db from '../db/schema';

@path: '/odata/v4/credit'
service CreditService {

  @readonly
  entity CreditItems as projection on db.CreditItems;

  function getItems(
    dateFrom   : Date,
    dateTo     : Date,
    notaFiscal : String(35)
  ) returns array of CreditItems;

}
```

---

## 7. Dados Mock (CSV)

**Arquivo:** `db/data/my.company-CreditItems.csv`

> A convenção de nome `namespace-EntityName.csv` é obrigatória para o CAP fazer o seed automático.

O CSV deve conter ao menos 10 registros cobrindo cenários:

- Tipo AB (lançamentos de compensação simples)
- Tipo 36 (revenue / reembolso)
- Com e sem Nota Fiscal preenchida
- Diferentes datas para validar filtro de período
- Valores positivos e negativos (débito / crédito)

---

## 8. Handler CAP (`srv/credit-service.js`)

O handler verifica o perfil de execução e delega para a implementação correta:

```javascript
const IS_PROD = process.env.NODE_ENV === 'production';

// Mock: consulta CSV via CDS query
async _fetchFromMock({ dateFrom, dateTo, notaFiscal }) { ... }

// Produção: chama endpoint CPI REST
async _fetchFromCPI({ dateFrom, dateTo, notaFiscal }) { ... }

// Mapeamento campos RFC (ABAP) → campos CDS
_mapRFCtoEntity(items = [], notaFiscal) { ... }
```

---

## 9. Anotações Fiori Elements

**Arquivo:** `app/credito/annotations.cds`

```cds
UI.LineItem: [
  { Value: clearingDocNo,  Label: 'No. Doc. Compensação' },
  { Value: docType,        Label: 'Tipo' },
  { Value: paymentMethod,  Label: 'MP' },
  { Value: clearingDate,   Label: 'Data da Compensação' },
  { Value: docNo,          Label: 'Número do Documento' },
  { Value: amountLC,       Label: 'Valor R$' },
  { Value: itemText,       Label: 'Pedido' },
  { Value: notaFiscal,     Label: 'Nota Fiscal' },
]

UI.SelectionFields: [ clearingDate, notaFiscal ]
```

---

## 10. Configuração CAP (`.cdsrc.json`)

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
      "db": { "kind": "hana" },
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
  "server": { "cors": true }
}
```

> Em `development`, o CSV em `db/data/` é carregado automaticamente pelo CAP como seed do SQLite in-memory. A troca para produção não exige alteração de código — apenas `NODE_ENV=production`.

---

## 11. Deploy no BTP (`mta.yaml`)

| Módulo MTA | Tipo | Descrição |
|---|---|---|
| demonstrativo-credito-srv | nodejs | CAP backend (OData V4 service) |
| demonstrativo-credito-app | staticfile | Fiori Elements UI (HTML/JS) |
| demonstrativo-credito-db | hdb | Deploy do schema HANA |
| demonstrativo-credito-dest | destination | Serviço de destino BTP (CPI endpoint) |

---

## 12. Planejamento de Tasks — Implementação

| # | Task | Escopo | Critério de Aceite |
|---|---|---|---|
| T01 | Scaffold do projeto CAP | `cds init` + `package.json` | `cds serve` executa sem erros |
| T02 | Schema CDS | `db/schema.cds` | `cds compile` sem erros |
| T03 | CSV Mock (10+ registros) | `db/data/*.csv` | GET `/odata/v4/credit/CreditItems` retorna dados |
| T04 | Service CDS | `srv/credit-service.cds` | `$metadata` OData disponível |
| T05 | Handler mock (getItems) | `srv/credit-service.js` | Função retorna dados filtrados por data e notaFiscal |
| T06 | Anotações Fiori Elements | `app/credito/annotations.cds` | Colunas e filtros no Fiori Preview |
| T07 | manifest.json Fiori | `app/credito/webapp/manifest.json` | App abre no Fiori Launchpad local |
| T08 | `.cdsrc.json` multi-profile | `.cdsrc.json` | `development` e `production` funcionam |
| T09 | Handler produção (CPI stub) | `srv/credit-service.js` `_fetchFromCPI` | Stub retorna 501 em development |
| T10 | `mta.yaml` | `mta.yaml` | `mbt build` sem erros |
| T11 | Testes unitários (Jest) | `test/credit.test.js` | Todos os testes passam |
| T12 | Deploy BTP (validação) | `cf push` / `mbt deploy` | App acessível no BTP com dados mock |

---

## 13. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| SQLite in-memory não persiste entre hot-reloads | Alta | Médio | CSV re-carregado a cada `cds serve` — sem estado salvo |
| CPI endpoint indisponível em dev | Alta | Baixo | Mock isola completamente a camada CPI |
| Mapeamento RFC ↔ CDS incompleto | Média | Alto | Todos os 14 campos mapeados e documentados |
| Timeout RFC em volume alto | Baixa | Alto | Paginação OData + `$top`/`$skip` no List Report |
| CORS em dev local | Média | Baixo | `cds serve` ativa CORS automaticamente em development |

---

## 14. Glossário

| Termo | Definição |
|---|---|
| CAP | SAP Cloud Application Programming Model |
| CPI | SAP Cloud Platform Integration (Integration Suite) |
| BTP | SAP Business Technology Platform |
| SCC | SAP Cloud Connector |
| OData V4 | Protocolo REST para serviços SAP (padrão Fiori Elements) |
| RFC | Remote Function Call — módulo de função ABAP |
| BAPI | Business Application Programming Interface (tipo especial de RFC) |
| Mock-First | Estratégia de desenvolvimento com dados locais antes de integração real |
| MTA | Multi-Target Application — descriptor de deploy multi-módulo BTP |
| CSV Seed | Arquivo CSV usado pelo CAP para popular banco em memória automaticamente |
