import type { InvoiceRepository } from "../billing/invoice";

export interface PaymentPort {
  charge(request: PaymentRequest): PaymentReceipt;
}

export class PaymentService implements PaymentPort {
  private invoices: InvoiceRepository;

  constructor(invoices: InvoiceRepository) {
    this.invoices = invoices;
  }

  charge(request: PaymentRequest): PaymentReceipt {
    return this.invoices.create(request);
  }
}

export type PaymentRequest = { orderId: string };
export type PaymentReceipt = { id: string };
