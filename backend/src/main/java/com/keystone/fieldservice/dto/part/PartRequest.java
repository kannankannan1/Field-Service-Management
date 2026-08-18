package com.keystone.fieldservice.dto.part;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PartRequest(
        @NotBlank(message = "SKU is required")
        @Size(max = 50, message = "SKU must not exceed 50 characters")
        String sku,

        @NotBlank(message = "Name is required")
        @Size(max = 200, message = "Name must not exceed 200 characters")
        String name,

        @Size(max = 1000, message = "Description must not exceed 1000 characters")
        String description,

        @NotNull(message = "Unit price is required")
        @DecimalMin(value = "0.00", message = "Unit price must be positive")
        BigDecimal unitPrice,

        @NotNull(message = "Quantity is required")
        @Min(value = 0, message = "Quantity must not be negative")
        Integer quantityOnHand,

        @NotNull(message = "Reorder level is required")
        @Min(value = 0, message = "Reorder level must not be negative")
        Integer reorderLevel
) {
}
