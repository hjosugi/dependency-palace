package com.acme.orders;

public interface OrderRepository {
  Order find(OrderId id);

  Receipt save(Order order);
}
