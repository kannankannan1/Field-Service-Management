package com.keystone.fieldservice.dto.workorder;

import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;

import java.time.LocalDateTime;

/**
 * Compact representation used for the Kanban board and list views.
 */
public record WorkOrderCard(
        Long id,
        String workOrderNumber,
        String title,
        WorkOrderPriority priority,
        WorkOrderStatus status,
        Long customerId,
        String customerName,
        String siteName,
        Long assignedTechnicianId,
        String assignedTechnicianName,
        LocalDateTime scheduledStart,
        LocalDateTime scheduledEnd,
        LocalDateTime slaDueAt,
        boolean slaBreached
) {
    public static WorkOrderCard from(WorkOrder wo) {
        return new WorkOrderCard(
                wo.getId(),
                wo.getWorkOrderNumber(),
                wo.getTitle(),
                wo.getPriority(),
                wo.getStatus(),
                wo.getCustomer().getId(),
                wo.getCustomer().getName(),
                wo.getSite().getName(),
                wo.getAssignedTechnician() == null ? null : wo.getAssignedTechnician().getId(),
                wo.getAssignedTechnician() == null ? null : wo.getAssignedTechnician().getFullName(),
                wo.getScheduledStart(),
                wo.getScheduledEnd(),
                wo.getSlaDueAt(),
                wo.isSlaBreached());
    }
}
