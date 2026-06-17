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
