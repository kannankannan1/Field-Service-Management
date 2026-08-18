package com.keystone.fieldservice.dto.dashboard;

import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import com.keystone.fieldservice.dto.user.UserResponse;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record DashboardMetricsResponse(
        long totalWorkOrders,
        Map<WorkOrderStatus, Long> byStatus,
        long openWorkOrders,
        long overdueWorkOrders,
        long slaBreached,
        double slaComplianceRate,
        long openUrgent,
        long openHigh,
        long openMedium,
        long openLow,
        long totalTechnicians,
        long busyTechnicians,
        long idleTechnicians,
        long lowStockParts,
        long lowStockAlerts,
        long unreadDispatcherNotifications,
        BigDecimal averageCompletionHours,
        long completedLast30Days,
        List<RecentActivity> recentActivity,
        List<WorkOrderPriority> priorityOrder,
        List<WorkOrderStatus> statusOrder,
        List<UserResponse> technicians
) {
    public record RecentActivity(
            Long workOrderId,
            String workOrderNumber,
            String title,
            com.keystone.fieldservice.domain.enums.WorkOrderStatus toStatus,
            String actorName,
            java.time.Instant changedAt,
            String note
    ) {
    }
}
