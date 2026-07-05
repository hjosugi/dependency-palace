<?php

namespace Acme\Orders;

use Acme\Billing\InvoiceRepository;

interface PaymentPort
{
    public function charge(PaymentRequest $request): PaymentReceipt;
}

final class PaymentService implements PaymentPort
{
    private InvoiceRepository $invoices;

    public function __construct(InvoiceRepository $invoices)
    {
        $this->invoices = $invoices;
    }

    public function charge(PaymentRequest $request): PaymentReceipt
    {
        return $this->invoices->create($request);
    }
}

final class PaymentReceipt
{
    public function __construct(public string $id) {}
}

final class PaymentRequest
{
    public function __construct(public string $orderId) {}
}
