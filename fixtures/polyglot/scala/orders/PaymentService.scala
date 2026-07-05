package com.acme.scalaorders

trait PaymentPort {
  def charge(request: PaymentRequest): PaymentReceipt
}

final class PaymentRequest(val orderId: String) {
}

final class PaymentReceipt(val id: String) {
}

final class PaymentService(invoices: InvoiceRepository) extends PaymentPort {
  def charge(request: PaymentRequest): PaymentReceipt = invoices.create(request)
}

final class InvoiceRepository {
  def create(request: PaymentRequest): PaymentReceipt = PaymentReceipt(request.orderId)
}
