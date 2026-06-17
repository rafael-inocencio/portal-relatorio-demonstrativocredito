using CreditService as service from '../../srv/credit-service';

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

annotate service.CreditItems with @(

  UI.HeaderInfo: {
    TypeName       : 'Demonstrativo de Crédito',
    TypeNamePlural : 'Demonstrativo de Crédito',
    Title          : { $Type: 'UI.DataField', Value: clearingDocNo }
  },

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

  UI.SelectionFields: [
    clearingDate,
    notaFiscal
  ],

);
