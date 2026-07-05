module Domain where

data Customer = Customer
  { customerId :: String
  , customerTier :: Tier
  }
  deriving (Eq, Show)

data Tier = Standard | Premium
  deriving (Eq, Show)

data Order = Order
  { orderCustomer :: Customer
  , orderTotal :: Amount
  }
  deriving (Eq, Show)

newtype Amount = Amount Int
  deriving (Eq, Ord, Show)

data Receipt = Receipt
  { receiptOrder :: Order
  , receiptCustomer :: Customer
  }
  deriving (Eq, Show)

class Monad m => Repository m where
  lookupCustomer :: Order -> m Customer
  persistReceipt :: Receipt -> m Receipt

instance Repository IO where
  lookupCustomer order = pure (orderCustomer order)
  persistReceipt receipt = pure receipt

createReceipt :: Customer -> Order -> Receipt
createReceipt customer order = Receipt order customer

validateOrder :: Repository m => Order -> m Receipt
validateOrder = lookupCustomer >=> createReceipt >=> persistReceipt
