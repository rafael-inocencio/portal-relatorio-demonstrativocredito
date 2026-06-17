# Referência de Integração — CPI + RFC + Cloud Connector
**Demonstrativo de Crédito — Arquivo 3 de 3**

Este arquivo documenta o contrato de integração entre o CAP BTP e o SAP ECC via Cloud Connector e CPI. É o guia de referência para a **fase de ativação de produção** (desligar mock, ligar RFC real).

---

## 1. Fluxo de Dados — Produção

Fluxo sequencial de uma consulta no ambiente de produção:

| Passo | De | Para | Protocolo | Descrição |
|---|---|---|---|---|
| 1 | Usuário (browser) | Fiori Elements (BTP) | HTTPS | Usuário informa Data Inicial, Data Final e Nota Fiscal e clica em Consultar |
| 2 | Fiori Elements | CAP Service (BTP) | OData V4 / HTTPS | Chama função `getItems` com parâmetros de data e `notaFiscal` |
| 3 | CAP Service | CPI (Integration Suite) | REST / HTTPS | `POST /getBalancedItems` com JSON `{DATE_FROM, DATE_TO, COMPANY_CODE, CUSTOMER}` |
| 4 | CPI | Cloud Connector (SCC) | RFC/HTTP Bridge | CPI aciona adaptador RFC via SCC para alcançar ECC on-premise |
| 5 | Cloud Connector | ECC ABAP (on-premise) | RFC ABAP | Chama `BAPI_AR_ACC_GETBALANCEDITEMS` com parâmetros |
| 6 | ECC | Cloud Connector | RFC response | Retorna tabela `LINEITEMS` (BAPI3007_2) e estrutura `RETURN` |
| 7 | Cloud Connector | CPI | HTTP | Dados RFC encaminhados ao CPI |
| 8 | CPI | CAP Service | REST JSON | CPI mapeia campos RFC para JSON e retorna ao CAP |
| 9 | CAP Service | Fiori Elements | OData V4 JSON | CAP executa `_mapRFCtoEntity`, aplica filtro `notaFiscal` e retorna array |
| 10 | Fiori Elements | Usuário | Render HTML | List Report exibe tabela com os 8 campos |

---

## 2. RFC: BAPI_AR_ACC_GETBALANCEDITEMS

### 2.1 Parâmetros de Entrada

| Parâmetro RFC | Campo ABAP | Tipo ABAP | Tipo JSON (CPI) | Obrigatório | Observação |
|---|---|---|---|---|---|
| COMPANYCODE | COMP_CODE | C(4) | string | Sim | Código da empresa SAP (ex: `'1000'`) |
| CUSTOMER | CUSTOMER | C(10) | string | Sim | Código do cliente (padded com zeros: `'0000100001'`) |
| DATE_FROM | FROM_DATE | D | string `YYYYMMDD` | Sim | Formato SAP ABAP — CPI recebe e converte |
| DATE_TO | TO_DATE | D | string `YYYYMMDD` | Sim | Mesmo formato |

### 2.2 Parâmetros de Saída

| Parâmetro RFC | Tipo | Descrição |
|---|---|---|
| RETURN | BAPIRETURN (struct) | Código de retorno. `TYPE='E'` = erro; `TYPE='S'` = sucesso |
| LINEITEMS | BAPI3007_2 (table) | Tabela de itens compensados — até N registros conforme filtro de data |

### 2.3 Campos Utilizados de BAPI3007_2 (LINEITEMS)

Dos 111 campos disponíveis na BAPI3007_2, os seguintes são utilizados neste relatório:

| Campo ABAP | Tipo | Comp. | Campo CDS | Label UI |
|---|---|---|---|---|
| CLR_DOC_NO | C | 10 | clearingDocNo | No. Documento de Compensação |
| DOC_TYPE | C | 2 | docType | Tipo |
| PYMNT_METH | C | 1 | paymentMethod | MP |
| CLEAR_DATE | D | 8 | clearingDate | Data da Compensação |
| DOC_NO | C | 10 | docNo | Número do Documento |
| LC_AMOUNT | P | 12,4 | amountLC | Valor R$ |
| CURRENCY | C | 5 | currency | Moeda (interno) |
| ITEM_TEXT | C | 50 | itemText | Pedido |
| REF_DOC_NO_LONG | C | 35 | notaFiscal | Nota Fiscal |
| COMP_CODE | C | 4 | companyCode | Empresa (interno) |
| CUSTOMER | C | 10 | customer | Cliente (interno) |
| PSTNG_DATE | D | 8 | postingDate | Data Lançamento (interno) |
| FISC_YEAR | N | 4 | fiscalYear | Ano Fiscal (interno) |
| DB_CR_IND | C | 1 | dbCrIndicator | Indicador D/C (interno) |

---

## 3. Contrato do Endpoint CPI

### 3.1 Requisição (CAP → CPI)

```
Método:        POST
Path:          /api/credit/v1/getBalancedItems
Content-Type:  application/json
```

**Payload JSON:**

```json
{
  "COMPANY_CODE" : "1000",
  "CUSTOMER"     : "0000100001",
  "DATE_FROM"    : "20260201",
  "DATE_TO"      : "20260228"
}
```

> ⚠️ O CPI espera datas no formato `YYYYMMDD` (formato SAP ABAP). O CAP converte de `YYYY-MM-DD` para `YYYYMMDD` antes de enviar.

### 3.2 Resposta (CPI → CAP)

**Payload de sucesso:**

```json
{
  "RETURN": {
    "TYPE": "S",
    "CODE": "000",
    "MESSAGE": "Success"
  },
  "LINEITEMS": [
    {
      "CLR_DOC_NO"      : "100383752",
      "DOC_TYPE"        : "AB",
      "PYMNT_METH"      : "",
      "CLEAR_DATE"      : "20260212",
      "DOC_NO"          : "0103883221",
      "LC_AMOUNT"       : "15.78",
      "CURRENCY"        : "BRL",
      "ITEM_TEXT"       : "FINR3000670 NF 16642",
      "REF_DOC_NO_LONG" : "0000000000043569",
      "COMP_CODE"       : "1000",
      "CUSTOMER"        : "0000100001",
      "PSTNG_DATE"      : "20260212",
      "FISC_YEAR"       : "2026",
      "DB_CR_IND"       : "H"
    }
  ]
}
```

**Payload de erro:**

```json
{
  "RETURN": {
    "TYPE"    : "E",
    "CODE"    : "001",
    "MESSAGE" : "Customer not found"
  },
  "LINEITEMS": []
}
```

---

## 4. Mapeamento de Conversão de Campos

### 4.1 Conversão de Datas

| Direção | Formato Origem | Formato Destino | Exemplo |
|---|---|---|---|
| CAP → CPI (requisição) | `YYYY-MM-DD` (ISO 8601) | `YYYYMMDD` (SAP ABAP) | `2026-02-01` → `20260201` |
| CPI → CAP (resposta) | `YYYYMMDD` (SAP ABAP) | `YYYY-MM-DD` (ISO 8601) | `20260212` → `2026-02-12` |

**Código de conversão no CAP (`_fetchFromCPI`):**

```javascript
// CAP para CPI: converter YYYY-MM-DD para YYYYMMDD
const toSapDate = d => d ? d.replace(/-/g, '') : '';

// CPI para CDS: converter YYYYMMDD para Date
const fromSapDate = d => {
  if (!d || d.length !== 8) return null;
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
};
```

### 4.2 Conversão de Valores Monetários

| Campo ABAP | Tipo ABAP | Tratamento no CAP |
|---|---|---|
| LC_AMOUNT | P (BCD packed, 12 dig, 4 dec) | `parseFloat(i.LC_AMOUNT ?? 0)` — CPI já envia como string decimal |
| AMT_DOCCUR | P (12,4) | Não utilizado neste relatório |

---

## 5. Configuração do Cloud Connector (SCC)

O SCC deve ser configurado para permitir que o CPI alcance o sistema ECC on-premise via túnel seguro.

| Configuração SCC | Valor Esperado |
|---|---|
| Tipo de acesso | RFC (ABAP) |
| Sistema backend | ECC (SID do sistema SAP) |
| RFC permitido | `BAPI_AR_ACC_GETBALANCEDITEMS` |
| Método de autenticação | Principal Propagation ou Basic |
| Virtual host (para CPI) | Configurado no BTP Connectivity Service |

---

## 6. Configuração BTP para Produção

### 6.1 Destination Service

Criar um Destination no BTP Cockpit apontando para o endpoint CPI:

| Propriedade Destination | Valor |
|---|---|
| Name | `CreditRFC_CPI` |
| Type | HTTP |
| URL | `https://<cpi-host>/api/credit/v1` |
| Authentication | OAuth2ClientCredentials |
| Token Service URL | `https://<xsuaa-host>/oauth/token` |
| Client ID | `<client-id>` (do service key CPI) |
| Client Secret | `<client-secret>` (do service key CPI) |

### 6.2 Binding no CAP

O CAP lê a Destination pelo nome `'CreditRFC'` configurado em `.cdsrc.json`. Em produção no BTP, o binding é feito automaticamente via serviço de Destination.

---

## 7. Procedimento de Ativação de Produção

Checklist sequencial para **desligar o mock e ligar os dados reais:**

| Passo | Ação | Responsável | Verificação |
|---|---|---|---|
| 1 | Configurar SCC: adicionar sistema ECC e liberar RFC `BAPI_AR_ACC_GETBALANCEDITEMS` | Basis / Infra | SCC console mostra conexão ativa |
| 2 | Criar iFlow no CPI: receber POST REST, chamar RFC via SCC, retornar JSON | CPI Developer | Teste no CPI Integration Suite retorna dados reais |
| 3 | Criar Destination no BTP Cockpit apontando para endpoint CPI | BTP Admin | Destination check retorna HTTP 200 |
| 4 | Atualizar `.cdsrc.json`: preencher URL do CPI no profile production | Dev | Arquivo commitado no repositório (sem credenciais) |
| 5 | Configurar variáveis de ambiente no BTP CF (client-id, client-secret) | DevOps | `cf env demonstrativo-credito-srv` mostra variáveis |
| 6 | Deploy com `NODE_ENV=production` | DevOps | `cf push` / `mbt deploy` bem-sucedido |
| 7 | Teste end-to-end: filtrar por data e verificar dados reais do ECC | QA / Dev | Dados conferidos com transação FBL5N no ECC |

---

## 8. Tratamento de Erros em Produção

| Cenário de Erro | Origem | HTTP Status | Mensagem ao Usuário | Ação CAP |
|---|---|---|---|---|
| CPI indisponível | Timeout / network | 503 | Serviço temporariamente indisponível. Tente novamente. | Logar erro, retornar 503 |
| RFC retorna `TYPE=E` | ECC ABAP | 502 | Erro ao consultar dados: {MESSAGE da RFC} | Retornar mensagem da RFC |
| Cliente não encontrado | ECC ABAP | 404 | Nenhum registro encontrado para o período informado. | Retornar array vazio |
| Data inválida (FROM > TO) | CAP (validação) | 400 | Data inicial não pode ser maior que data final. | Validar antes de chamar CPI |
| Credenciais CPI expiradas | OAuth token | 401 | Erro de autenticação. Contate o administrador. | Renovar token automaticamente via OAuth |

---

## 9. Esboço do iFlow CPI

O desenvolvedor CPI deve implementar o iFlow com os seguintes passos:

| Passo iFlow | Tipo | Configuração |
|---|---|---|
| 1. Receiver REST | HTTP Adapter (inbound) | `POST /getBalancedItems` — recebe JSON do CAP |
| 2. Converter JSON → XML | Message Mapping | JSON payload → estrutura XML RFC |
| 3. Converter datas | Groovy Script | `YYYY-MM-DD` → `YYYYMMDD` para `DATE_FROM` e `DATE_TO` |
| 4. Chamar RFC via SCC | RFC Adapter | `BAPI_AR_ACC_GETBALANCEDITEMS` — SCC Virtual Host configurado |
| 5. Verificar RETURN | Router / Condition | `TYPE='E'` → lançar exceção; `TYPE='S'` → continuar |
| 6. Mapear resposta | Message Mapping | LINEITEMS (XML RFC) → array JSON com campos mapeados |
| 7. Converter datas resposta | Groovy Script | `YYYYMMDD` → `YYYY-MM-DD` para `CLEAR_DATE` e `PSTNG_DATE` |
| 8. Retornar JSON | HTTP Response | 200 OK com `{RETURN, LINEITEMS}` ou 502 com `{RETURN}` |

> Os campos a mapear no iFlow (passo 6) são exatamente os **14 campos** listados na seção 2.3. Os demais 97 campos da BAPI3007_2 podem ser descartados no iFlow.

---

## 10. Perguntas Frequentes (FAQ)

**Por que usar CPI em vez de chamar o RFC diretamente do CAP?**

O CAP roda no BTP Cloud Foundry (internet). O ECC é on-premise. O Cloud Connector estabelece o túnel, mas o protocolo RFC ABAP não é nativo no Node.js. O CPI age como mediador: expõe REST para o CAP e fala RFC com o ECC via SCC.

---

**O filtro de Nota Fiscal é feito no ECC ou no CAP?**

No CAP. A RFC `BAPI_AR_ACC_GETBALANCEDITEMS` não tem parâmetro de nota fiscal — aceita apenas datas. O filtro de nota fiscal é aplicado no método `_mapRFCtoEntity` após receber o `LINEITEMS` completo do ECC.

---

**Como o CAP identifica o cliente (CUSTOMER) a ser consultado?**

Em produção, o `customer` deve vir do contexto do usuário autenticado via XSUAA (atributo do token) ou de um parâmetro adicional passado pela UI. Em mock, o CSV contém vários clientes e o filtro por data é suficiente.

---

**O que muda no código ao ir para produção?**

Nada no código. Apenas `NODE_ENV=production` e as variáveis de ambiente com credenciais CPI. O chaveamento `IS_PROD` já está implementado no handler.

---

**Como testar o iFlow CPI sem o ECC?**

O CPI suporta simulação de respostas RFC via Mock configurado no Integration Suite. Basta configurar o Mock Adapter no lugar do RFC Adapter durante o desenvolvimento do iFlow.

---

## 11. Referências

| Recurso | Link |
|---|---|
| Documentação CAP | https://cap.cloud.sap/docs |
| SAP CPI (Integration Suite) | https://help.sap.com/docs/cloud-integration |
| Cloud Connector | https://help.sap.com/docs/connectivity/sap-btp-connectivity-cf/cloud-connector |
| Fiori Elements V4 | https://ui5.sap.com/#/topic/fe119f44793c454ea67af3bb80dced92 |
| BAPI_AR_ACC_GETBALANCEDITEMS | Transação SE37 no ECC para inspeção completa da assinatura |
| MTA Tools | https://github.com/SAP/cloud-mta-build-tool |
