package com.acme.orders;

public final class OrderService implements OrderUseCase {
  private final OrderRepository repository;
  private final FraudPolicy fraudPolicy;

  public OrderService(OrderRepository repository, FraudPolicy fraudPolicy) {
    this.repository = repository;
    this.fraudPolicy = fraudPolicy;
  }

  @Override
  public Receipt submit(OrderRequest request) {
    Order order = repository.find(request.orderId());
    fraudPolicy.verify(order);
    return repository.save(order);
  }
}
