package com.keystone.fieldservice.dto.timelog;

import com.keystone.fieldservice.domain.entity.TimeLog;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

public record TimeLogResponse(
        Long id,
        Long workOrderId,
        String workOrderNumber,
        Long technicianId,
        String technicianName,
        LocalDateTime startTime,
        LocalDateTime endTime,
        BigDecimal hoursWorked,
        String notes,
        Instant createdAt
) {
    public static TimeLogResponse from(TimeLog log) {
        return new TimeLogResponse(
                log.getId(),
                log.getWorkOrder().getId(),
                log.getWorkOrder().getWorkOrderNumber(),
                log.getTechnician().getId(),
                log.getTechnician().getFullName(),
                log.getStartTime(),
                log.getEndTime(),
                log.getHoursWorked(),
                log.getNotes(),
                log.getCreatedAt());
    }
}
