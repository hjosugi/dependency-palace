package com.acme.kotlinorders

interface PaymentPort {
  fun charge(request: PaymentRequest): PaymentReceipt
}

class PaymentRequest(val orderId: String) {
}

class PaymentReceipt(val id: String) {
}

class PaymentService(private val invoices: InvoiceRepository) : PaymentPort {
  override fun charge(request: PaymentRequest): PaymentReceipt {
    return invoices.create(request)
  }
}

class InvoiceRepository {
  fun create(request: PaymentRequest): PaymentReceipt = PaymentReceipt(request.orderId)
}
