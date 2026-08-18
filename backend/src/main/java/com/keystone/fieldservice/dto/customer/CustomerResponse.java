package com.keystone.fieldservice.dto.customer;

import com.keystone.fieldservice.domain.entity.Customer;

import java.time.Instant;

public record CustomerResponse(
        Long id,
        String name,
        String contactName,
        String email,
        String phone,
        String address,
        Long userId,
        String portalUsername,
        Instant createdAt,
        Instant updatedAt
) {
    public static CustomerResponse from(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getName(),
                customer.getContactName(),
                customer.getEmail(),
                customer.getPhone(),
                customer.getAddress(),
                customer.getUser() == null ? null : customer.getUser().getId(),
                customer.getUser() == null ? null : customer.getUser().getUsername(),
                customer.getCreatedAt(),
                customer.getUpdatedAt());
    }
}
