import Foundation

protocol PaymentPort {
  func charge(request: PaymentRequest) -> PaymentReceipt
}

struct PaymentRequest {
  let orderId: String
}

struct PaymentReceipt {
  let id: String
}

final class PaymentService: PaymentPort {
  private let invoices: InvoiceRepository

  init(invoices: InvoiceRepository) {
    self.invoices = invoices
  }

  func charge(request: PaymentRequest) -> PaymentReceipt {
    return invoices.create(request: request)
  }
}

final class InvoiceRepository {
  func create(request: PaymentRequest) -> PaymentReceipt {
    return PaymentReceipt(id: request.orderId)
  }
}
