package com.keystone.fieldservice.dto.part;

import com.keystone.fieldservice.domain.enums.StockMovementType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StockAdjustmentRequest(
        @NotNull(message = "Type is required") StockMovementType type,
        @NotNull(message = "Quantity is required") Integer quantity,
        @Size(max = 500, message = "Note must not exceed 500 characters") String note
) {
}
