require_relative "../billing/invoice_repository"

module Orders
  class PaymentService
    def initialize(invoices)
      @invoices = invoices
    end

    def charge(request)
      @invoices.create(request)
    end
  end
end
