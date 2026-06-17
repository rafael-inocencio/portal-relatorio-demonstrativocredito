'use strict';
const cds = require('@sap/cds');

describe('CreditService — Mock Tests', () => {

  const { GET } = cds.test(__dirname + '/..');

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
    const res = await GET(
      `/odata/v4/credit/getItems(dateTo='2026-12-31')`,
      { validateStatus: () => true }
    );
    expect(res.status).toBe(400);
  });

  it('retorna erro 400 quando dateFrom maior que dateTo', async () => {
    const res = await GET(
      `/odata/v4/credit/getItems(dateFrom='2026-12-31',dateTo='2026-01-01')`,
      { validateStatus: () => true }
    );
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
