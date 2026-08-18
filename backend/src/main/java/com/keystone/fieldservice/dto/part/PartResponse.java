package com.keystone.fieldservice.dto.part;

import com.keystone.fieldservice.domain.entity.Part;

import java.math.BigDecimal;
import java.time.Instant;

public record PartResponse(
        Long id,
        String sku,
        String name,
        String description,
        BigDecimal unitPrice,
        Integer quantityOnHand,
        Integer reorderLevel,
        boolean lowStock,
        Instant createdAt,
        Instant updatedAt
) {
    public static PartResponse from(Part part) {
        return new PartResponse(
                part.getId(),
                part.getSku(),
                part.getName(),
                part.getDescription(),
                part.getUnitPrice(),
                part.getQuantityOnHand(),
                part.getReorderLevel(),
                part.isLowStock(),
                part.getCreatedAt(),
                part.getUpdatedAt());
    }
}
