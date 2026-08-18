package com.keystone.fieldservice.dto.workorder;

import com.keystone.fieldservice.domain.entity.WorkOrderStatusHistory;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;

import java.time.Instant;

public record WorkOrderHistoryResponse(
        Long id,
        Long workOrderId,
        WorkOrderStatus fromStatus,
        WorkOrderStatus toStatus,
        Long changedById,
        String changedByName,
        Instant changedAt,
        String note
) {
    public static WorkOrderHistoryResponse from(WorkOrderStatusHistory history) {
        return new WorkOrderHistoryResponse(
                history.getId(),
                history.getWorkOrder().getId(),
                history.getFromStatus(),
                history.getToStatus(),
                history.getChangedBy() == null ? null : history.getChangedBy().getId(),
                history.getChangedBy() == null ? null : history.getChangedBy().getFullName(),
                history.getChangedAt(),
                history.getNote());
    }
}
