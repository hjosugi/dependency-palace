const { InvoiceRepository } = require("../billing/invoice");

class PaymentService {
  constructor(invoices = new InvoiceRepository()) {
    this.invoices = invoices;
  }

  charge(request) {
    return this.invoices.create(request);
  }
}

module.exports = { PaymentService };
