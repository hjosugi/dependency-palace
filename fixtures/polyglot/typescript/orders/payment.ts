import type { InvoiceRepository } from "../billing/invoice";

export interface PaymentPort {
  charge(request: PaymentRequest): PaymentReceipt;
}

export class PaymentService implements PaymentPort {
  private invoices: InvoiceRepository;

  charge(request: PaymentRequest): PaymentReceipt {
    return this.invoices.create(request);
  }
}
