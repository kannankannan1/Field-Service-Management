package com.keystone.fieldservice.dto.workorder;

import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;

import java.time.Instant;
import java.time.LocalDateTime;

public record WorkOrderResponse(
        Long id,
        String workOrderNumber,
        Long customerId,
        String customerName,
        Long siteId,
        String siteName,
        String siteAddress,
        String title,
        String description,
        WorkOrderPriority priority,
        WorkOrderStatus status,
        Long assignedTechnicianId,
        String assignedTechnicianName,
        Long createdById,
        String createdByName,
        LocalDateTime scheduledStart,
        LocalDateTime scheduledEnd,
        LocalDateTime actualStart,
        LocalDateTime actualEnd,
        LocalDateTime slaDueAt,
        boolean slaBreached,
        Instant createdAt,
        Instant updatedAt,
        Instant closedAt
) {
    public static WorkOrderResponse from(WorkOrder wo) {
        return new WorkOrderResponse(
                wo.getId(),
                wo.getWorkOrderNumber(),
                wo.getCustomer().getId(),
                wo.getCustomer().getName(),
                wo.getSite().getId(),
                wo.getSite().getName(),
                wo.getSite().getFullAddress(),
                wo.getTitle(),
                wo.getDescription(),
                wo.getPriority(),
                wo.getStatus(),
                wo.getAssignedTechnician() == null ? null : wo.getAssignedTechnician().getId(),
                wo.getAssignedTechnician() == null ? null : wo.getAssignedTechnician().getFullName(),
                wo.getCreatedBy() == null ? null : wo.getCreatedBy().getId(),
                wo.getCreatedBy() == null ? null : wo.getCreatedBy().getFullName(),
                wo.getScheduledStart(),
                wo.getScheduledEnd(),
                wo.getActualStart(),
                wo.getActualEnd(),
                wo.getSlaDueAt(),
                wo.isSlaBreached(),
                wo.getCreatedAt(),
                wo.getUpdatedAt(),
                wo.getClosedAt());
    }
}
