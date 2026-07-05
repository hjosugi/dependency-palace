#pragma once

#include "invoice_repository.hpp"

namespace orders {

struct PaymentReceipt {
  long amount;
};

class PaymentPort {
 public:
  virtual PaymentReceipt charge(long amount) = 0;
};

class PaymentService : public PaymentPort {
 public:
  explicit PaymentService(InvoiceRepository repository);
  PaymentReceipt charge(long amount);

 private:
  InvoiceRepository repository;
};

}  // namespace orders
