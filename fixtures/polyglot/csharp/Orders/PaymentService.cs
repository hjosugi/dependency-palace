namespace Acme.Orders;

public interface IPaymentPort
{
    PaymentReceipt Charge(PaymentRequest request);
}

public sealed class PaymentService : IPaymentPort
{
    private readonly InvoiceRepository invoices;

    public PaymentService(InvoiceRepository invoices)
    {
        this.invoices = invoices;
    }

    public PaymentReceipt Charge(PaymentRequest request)
    {
        return invoices.Create(request);
    }
}

public sealed record PaymentReceipt(string Id);
public sealed record PaymentRequest(string OrderId);
public sealed class InvoiceRepository
{
    public PaymentReceipt Create(PaymentRequest request) => new PaymentReceipt(request.OrderId);
}
