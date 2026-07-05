package com.acme.orders;

public interface FraudPolicy {
  void verify(Order order);
}
