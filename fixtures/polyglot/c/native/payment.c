#include "payment.h"

struct PaymentReceipt {
  long amount;
};

struct PaymentService {
  struct PaymentReceipt last_receipt;
};
