package com.keystone.fieldservice.dto.timelog;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record TimeLogRequest(
        Long workOrderId,
        LocalDateTime startTime,
        LocalDateTime endTime,
        @Size(max = 1000, message = "Notes must not exceed 1000 characters") String notes
) {
}
