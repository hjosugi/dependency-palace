module Payment where

import Control.Monad ((>=>))
import Data.Text (Text)

data PaymentRequest = PaymentRequest
  { requestUser :: Text
  , requestAmount :: Money
  } deriving (Eq, Show)

newtype Money = Money Int deriving (Eq, Ord, Show)

class Monad m => PaymentPort m where
  charge :: PaymentRequest -> m PaymentReceipt

data PaymentReceipt = PaymentReceipt
  { receiptId :: Text
  , receiptAmount :: Money
  }

validate :: PaymentRequest -> Either Text PaymentRequest
validate request = Right request

authorize :: PaymentRequest -> Either Text PaymentRequest
authorize request = Right request

persist :: PaymentRequest -> Either Text PaymentReceipt
persist request = Right (PaymentReceipt "ok" (requestAmount request))

pipeline :: PaymentRequest -> Either Text PaymentReceipt
pipeline = validate >=> authorize >=> persist
