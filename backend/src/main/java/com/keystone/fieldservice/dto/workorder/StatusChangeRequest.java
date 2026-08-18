package com.keystone.fieldservice.dto.workorder;

import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StatusChangeRequest(
        @NotNull(message = "Target status is required") WorkOrderStatus status,
        @Size(max = 1000, message = "Note must not exceed 1000 characters") String note
) {
}
