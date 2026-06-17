namespace my.company;

entity CreditItems {
  key ID           : UUID;
  clearingDocNo    : String(10);               // CLR_DOC_NO      — No. Doc. Compensação
  docType          : String(2);                // DOC_TYPE        — Tipo
  paymentMethod    : String(1);                // PYMNT_METH      — MP
  clearingDate     : Date;                     // CLEAR_DATE      — Data da Compensação
  docNo            : String(10);               // DOC_NO          — Número do Documento
  amountLC         : Decimal(15, 2);           // LC_AMOUNT       — Valor R$
  currency         : String(5) default 'BRL';  // CURRENCY
  itemText         : String(50);               // ITEM_TEXT       — Pedido
  notaFiscal       : String(35);               // REF_DOC_NO_LONG — Nota Fiscal
  companyCode      : String(4);                // COMP_CODE
  customer         : String(10);               // CUSTOMER
  postingDate      : Date;                     // PSTNG_DATE
  fiscalYear       : String(4);                // FISC_YEAR
  dbCrIndicator    : String(1);                // DB_CR_IND
}
