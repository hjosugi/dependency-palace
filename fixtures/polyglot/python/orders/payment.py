from billing.invoice import InvoiceRepository

class PaymentService(PaymentPort):
    def __init__(self, invoices: InvoiceRepository):
        self.invoices = invoices
        self.current_user = None

    def charge(self, request):
        return self.invoices.create(request)
