package orders

import "billing/invoice"

type PaymentService struct {
  Repo invoice.Repository
  CurrentUser string
}

type PaymentPort interface {
  Charge(amount int) Receipt
}

func (p *PaymentService) Charge(amount int) Receipt {
  return Receipt{}
}

type Receipt struct {
  Amount int
}
