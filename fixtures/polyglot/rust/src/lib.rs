use crate::storage::InvoiceStore;

pub struct PaymentService {
    pub store: InvoiceStore,
    current_user: String,
}

pub trait PaymentPort {
    fn charge(&self, amount: u64) -> Receipt;
}

impl PaymentPort for PaymentService {
    fn charge(&self, amount: u64) -> Receipt {
        Receipt { amount }
    }
}

pub struct Receipt {
    pub amount: u64,
}
