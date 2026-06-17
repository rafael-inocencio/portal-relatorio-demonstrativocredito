'use strict';
const cds = require('@sap/cds');

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = class CreditService extends cds.ApplicationService {

  async init() {
    this.on('getItems', async (req) => {
      const { dateFrom, dateTo, notaFiscal } = req.data;

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

  async _fetchFromMock({ dateFrom, dateTo, notaFiscal }) {
    const { CreditItems } = this.entities;

    const query = SELECT.from(CreditItems)
      .where`clearingDate >= ${dateFrom} and clearingDate <= ${dateTo}`;

    const results = await cds.run(query);

    if (notaFiscal) {
      const term = notaFiscal.toUpperCase();
      return results.filter(r =>
        r.notaFiscal && r.notaFiscal.toUpperCase().includes(term)
      );
    }
    return results;
  }

  /**
   * PRODUÇÃO: chama CPI endpoint que expõe a RFC como REST.
   * O CPI recebe JSON { DATE_FROM, DATE_TO, COMPANY_CODE, CUSTOMER }
   * e retorna { RETURN: {...}, LINEITEMS: [...] }
   */
  async _fetchFromCPI({ dateFrom, dateTo, notaFiscal }) {
    const ext = await cds.connect.to('CreditRFC');

    const toSapDate = d => d ? d.replace(/-/g, '') : '';

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
      throw Object.assign(new Error(`Erro CPI: ${msg}`), { status: 502 });
    }

    if (response.RETURN?.TYPE === 'E') {
      throw Object.assign(
        new Error(`Erro ECC: ${response.RETURN.MESSAGE}`),
        { status: 502 }
      );
    }

    return this._mapRFCtoEntity(response.LINEITEMS, notaFiscal);
  }

  _mapRFCtoEntity(items = [], notaFiscal) {
    const fromSapDate = d => {
      if (!d || d.length !== 8) return null;
      return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    };

    return items
      .filter(i => !notaFiscal ||
        i.REF_DOC_NO_LONG?.toUpperCase().includes(notaFiscal.toUpperCase()))
      .map(i => ({
        ID            : cds.utils.uuid(),
        clearingDocNo : i.CLR_DOC_NO?.trim()             ?? '',
        docType       : i.DOC_TYPE?.trim()               ?? '',
        paymentMethod : i.PYMNT_METH?.trim()             ?? '',
        clearingDate  : fromSapDate(i.CLEAR_DATE)        ?? null,
        docNo         : i.DOC_NO?.trim()                 ?? '',
        amountLC      : parseFloat(i.LC_AMOUNT           ?? 0),
        currency      : i.CURRENCY?.trim()               ?? 'BRL',
        itemText      : i.ITEM_TEXT?.trim()              ?? '',
        notaFiscal    : i.REF_DOC_NO_LONG?.trim()        ?? '',
        companyCode   : i.COMP_CODE?.trim()              ?? '',
        customer      : i.CUSTOMER?.trim()               ?? '',
        postingDate   : fromSapDate(i.PSTNG_DATE)        ?? null,
        fiscalYear    : i.FISC_YEAR?.trim()              ?? '',
        dbCrIndicator : i.DB_CR_IND?.trim()              ?? '',
      }));
  }
};
