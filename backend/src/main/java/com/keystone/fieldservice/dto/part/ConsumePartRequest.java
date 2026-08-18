package com.keystone.fieldservice.dto.part;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ConsumePartRequest(
        @NotNull(message = "Part is required") Long partId,
        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        Integer quantity,
        @Size(max = 500, message = "Note must not exceed 500 characters") String note
) {
}
