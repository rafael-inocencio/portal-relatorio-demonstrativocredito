using CreditService as service from '../../srv/credit-service';

// ─── Labels dos campos ────────────────────────────────────────────────────
annotate service.CreditItems with {
  ID             @UI.Hidden;
  clearingDocNo  @title: 'No. Documento de Compensação';
  docType        @title: 'Tipo';
  paymentMethod  @title: 'MP';
  clearingDate   @title: 'Data da Compensação';
  docNo          @title: 'Número do Documento';
  amountLC       @title: 'Valor R$'
                 @Measures.ISOCurrency: currency;
  currency       @UI.Hidden;
  itemText       @title: 'Pedido';
  notaFiscal     @title: 'Nota Fiscal';
  companyCode    @UI.Hidden;
  customer       @UI.Hidden;
  postingDate    @UI.Hidden;
  fiscalYear     @UI.Hidden;
  dbCrIndicator  @UI.Hidden;
}

// ─── List Report ──────────────────────────────────────────────────────────
annotate service.CreditItems with @(
  Capabilities.InsertRestrictions: { Insertable: false },
  Capabilities.UpdateRestrictions: { Updatable: false },
  Capabilities.DeleteRestrictions: { Deletable: false },
) {}; // bloqueia botões Create/Edit/Delete — tabela somente leitura

annotate service.CreditItems with @(

  UI.HeaderInfo: {
    TypeName       : 'Demonstrativo de Crédito',
    TypeNamePlural : 'Demonstrativo de Crédito',
    Title          : { $Type: 'UI.DataField', Value: clearingDocNo }
  },

  // Colunas da tabela (ordem = tela legada)
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

  // Filtros da barra de busca — clearingDate renderiza como intervalo (De/Até) automaticamente
  UI.SelectionFields: [
    clearingDate,
    notaFiscal
  ],

);
