package com.acme.orders;

import com.acme.billing.InvoiceRepository;
import com.acme.identity.UserContext;

public class PaymentService implements PaymentPort {
  private InvoiceRepository invoices;
  private UserContext context;

  public PaymentReceipt charge(PaymentRequest request) {
    return invoices.create(request);
  }
}

interface PaymentPort {
  PaymentReceipt charge(PaymentRequest request);
}
