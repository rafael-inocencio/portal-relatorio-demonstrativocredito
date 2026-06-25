'use strict';
const cds = require('@sap/cds');

const IS_PROD = process.env.NODE_ENV === 'production';
const DEST_RFC = process.env.RFC_DESTINATION || 'QA3_20';
const DEFAULT_COMPANY = process.env.DEFAULT_COMPANY_CODE || '1000';

module.exports = class CreditService extends cds.ApplicationService {

  async init() {
    this.on('getItems', async (req) => {
      const { dateFrom, dateTo, notaFiscal } = req.data;

      if (!dateFrom || !dateTo)
        return req.error(400, 'Os parâmetros dateFrom e dateTo são obrigatórios');
      if (new Date(dateFrom) > new Date(dateTo))
        return req.error(400, 'dateFrom não pode ser maior que dateTo');

      if (IS_PROD) return await this._fetchFromRFC(req);
      return await this._fetchFromMock(req.data);
    });

    return super.init();
  }

  // ── DEV: lê do SQLite mockado com CSV ──────────────────────────────────────
  async _fetchFromMock({ dateFrom, dateTo, notaFiscal }) {
    const { CreditItems } = this.entities;
    const results = await cds.run(
      SELECT.from(CreditItems)
        .where`clearingDate >= ${dateFrom} and clearingDate <= ${dateTo}`
    );
    if (notaFiscal) {
      const term = notaFiscal.toUpperCase();
      return results.filter(r => r.notaFiscal?.toUpperCase().includes(term));
    }
    return results;
  }

  // ── PROD: chama BAPI_AR_ACC_GETBALANCEDITEMS via SOAP + Cloud Connector ────
  async _fetchFromRFC(req) {
    const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');
    const { XMLParser } = require('fast-xml-parser');

    const { dateFrom, dateTo, notaFiscal } = req.data;

    // Primeiros 8 chars do logon SAP (ex: "00012345" de "00012345@acme.com")
    const userId   = req.user?.id ?? '';
    const customer = userId.split('@')[0].slice(0, 8).padStart(8, '0');
    cds.log('credit').info(`RFC CUSTOMER="${customer}" from user="${userId}"`);

    const toSapDate = d => d.replace(/-/g, '');

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:urn="urn:sap-com:document:sap:soap:functions:mc-style">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:BapiArAccGetbalanceditems>
      <CompanyCode>${DEFAULT_COMPANY}</CompanyCode>
      <Customer>${customer}</Customer>
      <DateFrom>${toSapDate(dateFrom)}</DateFrom>
      <DateTo>${toSapDate(dateTo)}</DateTo>
    </urn:BapiArAccGetbalanceditems>
  </soapenv:Body>
</soapenv:Envelope>`;

    const resp = await executeHttpRequest(
      { destinationName: DEST_RFC },
      {
        method : 'POST',
        url    : '/sap/bc/soap/rfc',
        headers: {
          'Content-Type': 'text/xml; charset=UTF-8',
          'SOAPAction'  : 'http://www.sap.com/BAPI_AR_ACC_GETBALANCEDITEMS'
        },
        data: soapBody
      },
      { fetchCsrfToken: false }
    );

    const parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix  : true,
      parseTagValue   : false,
      isArray         : name => name === 'item'
    });
    const parsed = parser.parse(resp.data ?? '');
    const body   = parsed?.Envelope?.Body ?? {};
    const result = body.BapiArAccGetbalanceditemsResponse
                ?? body['BAPI_AR_ACC_GETBALANCEDITEMSResponse']
                ?? {};

    const ret       = result.Return   ?? result.RETURN   ?? {};
    const returnRec = Array.isArray(ret) ? (ret[0] ?? {}) : ret;
    if ((returnRec.Type ?? returnRec.TYPE) === 'E') {
      const msg = returnRec.Message ?? returnRec.MESSAGE ?? 'Erro na RFC';
      throw Object.assign(new Error(`ECC: ${msg}`), { status: 502 });
    }

    const raw = result.Lineitems?.item ?? result.LINEITEMS?.item ?? [];
    return this._mapRFCtoEntity(Array.isArray(raw) ? raw : [raw].filter(Boolean), notaFiscal);
  }

  // ── Mapeamento SOAP (PascalCase) → entidade CAP ─────────────────────────────
  _mapRFCtoEntity(items = [], notaFiscal) {
    const f = (o, pascal, upper) =>
      ((o?.[pascal] ?? o?.[upper] ?? '')).toString().trim();

    const fromSapDate = d => {
      if (!d || d.length !== 8) return null;
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    };

    return items
      .filter(i => !notaFiscal ||
        f(i, 'RefDocNoLong', 'REF_DOC_NO_LONG').toUpperCase()
          .includes(notaFiscal.toUpperCase()))
      .map(i => ({
        ID            : cds.utils.uuid(),
        clearingDocNo : f(i, 'ClrDocNo',    'CLR_DOC_NO'),
        docType       : f(i, 'DocType',     'DOC_TYPE'),
        paymentMethod : f(i, 'PymntMeth',   'PYMNT_METH'),
        clearingDate  : fromSapDate(f(i, 'ClearDate',  'CLEAR_DATE')),
        docNo         : f(i, 'DocNo',       'DOC_NO'),
        amountLC      : parseFloat(f(i, 'LcAmount',   'LC_AMOUNT')   || '0'),
        currency      : f(i, 'Currency',    'CURRENCY')  || 'BRL',
        itemText      : f(i, 'ItemText',    'ITEM_TEXT'),
        notaFiscal    : f(i, 'RefDocNoLong','REF_DOC_NO_LONG'),
        companyCode   : f(i, 'CompCode',    'COMP_CODE'),
        customer      : f(i, 'Customer',    'CUSTOMER'),
        postingDate   : fromSapDate(f(i, 'PstngDate', 'PSTNG_DATE')),
        fiscalYear    : f(i, 'FiscYear',    'FISC_YEAR'),
        dbCrIndicator : f(i, 'DbCrInd',     'DB_CR_IND'),
      }));
  }
};
