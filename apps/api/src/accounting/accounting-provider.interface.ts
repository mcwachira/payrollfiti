/**
 * Extension point for syncing invoices/payroll expense to an external
 * accounting system (QuickBooks, Zoho Books, ...).
 *
 * Explicit limitation: no real QuickBooks/Zoho Books implementation is
 * attempted here — this project has no OAuth app registration or API
 * credentials for either, so any code calling their real APIs would be
 * untestable/unverifiable. A future `QuickBooksAccountingProvider implements
 * AccountingProvider` is added later and swapped in via the
 * `ACCOUNTING_PROVIDER` DI token once real credentials exist; nothing else
 * in the codebase needs to change.
 */
export interface AccountingSyncResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface AccountingProvider {
  readonly name: string;
  syncInvoice(invoice: {
    id: string;
    tenantId: string;
    amount: number;
    currency: string;
    status: string;
  }): Promise<AccountingSyncResult>;
  syncPayrollExpense(run: {
    id: string;
    tenantId: string;
    companyId: string;
    period: string;
    totals: unknown;
  }): Promise<AccountingSyncResult>;
}

export const ACCOUNTING_PROVIDER = Symbol('ACCOUNTING_PROVIDER');
