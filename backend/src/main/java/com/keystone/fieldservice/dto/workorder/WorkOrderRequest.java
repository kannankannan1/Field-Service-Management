package com.keystone.fieldservice.dto.workorder;

import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record WorkOrderRequest(
        @NotNull(message = "Customer is required") Long customerId,
        @NotNull(message = "Site is required") Long siteId,
        @NotBlank(message = "Title is required")
        @Size(max = 200, message = "Title must not exceed 200 characters") String title,
        @Size(max = 2000, message = "Description must not exceed 2000 characters") String description,
        @NotNull(message = "Priority is required") WorkOrderPriority priority,
        LocalDateTime scheduledStart,
        LocalDateTime scheduledEnd
) {
}
