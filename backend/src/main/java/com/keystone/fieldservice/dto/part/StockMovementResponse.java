package com.keystone.fieldservice.dto.part;

import com.keystone.fieldservice.domain.entity.StockMovement;
import com.keystone.fieldservice.domain.enums.StockMovementType;

import java.time.Instant;

public record StockMovementResponse(
        Long id,
        Long partId,
        String partSku,
        String partName,
        Long workOrderId,
        String workOrderNumber,
        StockMovementType type,
        Integer quantityChange,
        String note,
        Instant createdAt
) {
    public static StockMovementResponse from(StockMovement movement) {
        return new StockMovementResponse(
                movement.getId(),
                movement.getPart().getId(),
                movement.getPart().getSku(),
                movement.getPart().getName(),
                movement.getWorkOrder() == null ? null : movement.getWorkOrder().getId(),
                movement.getWorkOrder() == null ? null : movement.getWorkOrder().getWorkOrderNumber(),
                movement.getType(),
                movement.getQuantityChange(),
                movement.getNote(),
                movement.getCreatedAt());
    }
}
