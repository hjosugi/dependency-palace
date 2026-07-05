package com.acme.orders;

public interface OrderUseCase {
  Receipt submit(OrderRequest request);
}
