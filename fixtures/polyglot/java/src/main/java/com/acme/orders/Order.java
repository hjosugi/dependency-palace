package com.acme.orders;

public record Order(OrderId id, String customerId, long totalCents) {
}
