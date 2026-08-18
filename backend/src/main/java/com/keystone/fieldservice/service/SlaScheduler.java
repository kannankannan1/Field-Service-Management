package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.NotificationType;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@ConditionalOnProperty(name = "app.sla.scheduler.enabled", havingValue = "true", matchIfMissing = true)
public class SlaScheduler {

    private static final Logger log = LoggerFactory.getLogger(SlaScheduler.class);
    private static final List<WorkOrderStatus> OPEN_STATUSES = List.of(
            WorkOrderStatus.NEW, WorkOrderStatus.ASSIGNED,
            WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD);

    private final WorkOrderRepository workOrderRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public SlaScheduler(WorkOrderRepository workOrderRepository,
                        NotificationService notificationService,
                        UserRepository userRepository) {
        this.workOrderRepository = workOrderRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @Scheduled(fixedDelayString = "${app.sla.breach-check-ms:60000}",
            initialDelayString = "${app.sla.initial-delay-ms:10000}")
    @Transactional
    public void detectBreaches() {
        LocalDateTime now = LocalDateTime.now();

        List<WorkOrder> breaching = workOrderRepository.findBreaching(OPEN_STATUSES, now);
        if (!breaching.isEmpty()) {
            log.info("SLA breach check found {} overdue work orders", breaching.size());
        }
        for (WorkOrder workOrder : breaching) {
            workOrder.setSlaBreached(true);
            workOrderRepository.save(workOrder);
            notifyBreach(workOrder);
        }

        List<WorkOrder> atRisk = workOrderRepository.findNearBreach(OPEN_STATUSES, now, now.plusHours(4));
        for (WorkOrder workOrder : atRisk) {
            notifyReminder(workOrder);
        }
    }

    private void notifyBreach(WorkOrder workOrder) {
        String message = "SLA breached for " + workOrder.getWorkOrderNumber()
                + " (" + workOrder.getTitle() + "). Due at " + workOrder.getSlaDueAt() + ".";
        notifyRoles(message, NotificationType.SLA_BREACH, workOrder);
    }

    private void notifyReminder(WorkOrder workOrder) {
        String message = "SLA at risk for " + workOrder.getWorkOrderNumber()
                + " (" + workOrder.getTitle() + "). Due at " + workOrder.getSlaDueAt() + ".";
        notifyRoles(message, NotificationType.SLA_REMINDER, workOrder);
    }

    private void notifyRoles(String message, NotificationType type, WorkOrder workOrder) {
        userRepository.findByRole(Role.MANAGER).forEach(u ->
                notificationService.notify(u, label(type), message, type));
        userRepository.findByRole(Role.DISPATCHER).forEach(u ->
                notificationService.notify(u, label(type), message, type));
        if (workOrder.getAssignedTechnician() != null) {
            notificationService.notify(workOrder.getAssignedTechnician(),
                    label(type), message, type);
        }
    }

    private String label(NotificationType type) {
        return switch (type) {
            case SLA_BREACH -> "SLA breach";
            case SLA_REMINDER -> "SLA reminder";
            default -> "Notification";
        };
    }
}
