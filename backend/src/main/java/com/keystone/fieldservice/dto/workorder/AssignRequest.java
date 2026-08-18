package com.keystone.fieldservice.dto.workorder;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssignRequest(
        @NotNull(message = "Technician is required") Long technicianId,
        @Size(max = 1000, message = "Note must not exceed 1000 characters") String note
) {
}
