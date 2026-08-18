package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Part;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.entity.WorkOrderStatusHistory;
import com.keystone.fieldservice.domain.enums.NotificationType;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import com.keystone.fieldservice.dto.dashboard.DashboardMetricsResponse;
import com.keystone.fieldservice.dto.user.UserResponse;
import com.keystone.fieldservice.repository.NotificationRepository;
import com.keystone.fieldservice.repository.PartRepository;
import com.keystone.fieldservice.repository.TimeLogRepository;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.repository.WorkOrderStatusHistoryRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private static final List<WorkOrderStatus> OPEN_STATUSES = List.of(
            WorkOrderStatus.NEW, WorkOrderStatus.ASSIGNED,
            WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD);
    private static final List<WorkOrderStatus> DONE_STATUSES = List.of(
            WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED);

    private final WorkOrderRepository workOrderRepository;
    private final WorkOrderStatusHistoryRepository historyRepository;
    private final PartRepository partRepository;
    private final UserRepository userRepository;
    private final TimeLogRepository timeLogRepository;
    private final NotificationRepository notificationRepository;

    public DashboardService(WorkOrderRepository workOrderRepository,
                            WorkOrderStatusHistoryRepository historyRepository,
                            PartRepository partRepository,
                            UserRepository userRepository,
                            TimeLogRepository timeLogRepository,
                            NotificationRepository notificationRepository) {
        this.workOrderRepository = workOrderRepository;
        this.historyRepository = historyRepository;
        this.partRepository = partRepository;
        this.userRepository = userRepository;
        this.timeLogRepository = timeLogRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public DashboardMetricsResponse metrics() {
        long total = workOrderRepository.count();
        Map<WorkOrderStatus, Long> byStatus = new EnumMap<>(WorkOrderStatus.class);
        long open = 0;
        for (WorkOrderStatus status : WorkOrderStatus.values()) {
            long count = workOrderRepository.countByStatus(status);
            byStatus.put(status, count);
            if (OPEN_STATUSES.contains(status)) {
                open += count;
            }
        }

        long breached = workOrderRepository.countSlaBreached();
        long overdue = breached;
        double compliance = total == 0 ? 100.0
                : Math.round((1 - (double) breached / total) * 1000) / 10.0;

        Map<WorkOrderPriority, Long> openByPriority = countOpenByPriority(open);
        long urgent = openByPriority.getOrDefault(WorkOrderPriority.URGENT, 0L);
        long high = openByPriority.getOrDefault(WorkOrderPriority.HIGH, 0L);
        long medium = openByPriority.getOrDefault(WorkOrderPriority.MEDIUM, 0L);
        long low = openByPriority.getOrDefault(WorkOrderPriority.LOW, 0L);

        List<User> technicians = userRepository.findByRole(Role.TECHNICIAN);
        long busy = technicians.stream().filter(t -> isBusy(t.getId())).count();

        long lowStockCount = partRepository.findByReorderLevelGreaterThan(0).stream()
                .filter(Part::isLowStock).count();
        long stockAlerts = userRepository.findByRole(Role.MANAGER).stream()
                .map(u -> notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(u.getId()))
                .flatMap(List::stream)
                .filter(n -> n.getType() == NotificationType.STOCK_LOW)
                .count();
        long unreadDispatcher = userRepository.findByRole(Role.DISPATCHER).stream()
                .mapToLong(u -> notificationRepository.countByUserIdAndReadFalse(u.getId())).sum();

        BigDecimal avgCompletionHours = computeAverageCompletionHours();
        long doneLast30Days = workOrderRepository.countDoneSince(
                WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED,
                Instant.now().minus(30, java.time.temporal.ChronoUnit.DAYS));

        List<DashboardMetricsResponse.RecentActivity> recent = recentActivity(10);
        List<UserResponse> technicianDtos = technicians.stream().map(UserResponse::from).toList();

        return new DashboardMetricsResponse(
                total, byStatus, open, overdue, breached, compliance,
                urgent, high, medium, low,
                technicians.size(), busy, technicians.size() - busy,
                lowStockCount, stockAlerts, unreadDispatcher,
                avgCompletionHours, doneLast30Days,
                recent,
                List.of(WorkOrderPriority.values()),
                List.of(WorkOrderStatus.values()),
                technicianDtos);
    }

    private Map<WorkOrderPriority, Long> countOpenByPriority(long openTotal) {
        Map<WorkOrderPriority, Long> result = new EnumMap<>(WorkOrderPriority.class);
        for (WorkOrderPriority priority : WorkOrderPriority.values()) {
            result.put(priority, 0L);
        }
        // Query each open work order's priority via the spec (kept DB-agnostic).
        List<WorkOrder> openOrders = workOrderRepository.findAll((root, query, cb) ->
                root.get("status").in(OPEN_STATUSES));
        openOrders.forEach(wo -> result.merge(wo.getPriority(), 1L, Long::sum));
        return result;
    }

    private boolean isBusy(Long technicianId) {
        boolean hasOpenTimeLog = timeLogRepository
                .findByTechnicianIdOrderByStartTimeDesc(technicianId).stream()
                .anyMatch(t -> t.getEndTime() == null);
        boolean onActiveJob = workOrderRepository
                .findByStatusWithTechnician(WorkOrderStatus.IN_PROGRESS).stream()
                .anyMatch(w -> technicianId.equals(w.getAssignedTechnician().getId()))
                || workOrderRepository
                .findByStatusWithTechnician(WorkOrderStatus.ON_HOLD).stream()
                .anyMatch(w -> technicianId.equals(w.getAssignedTechnician().getId()));
        return hasOpenTimeLog || onActiveJob;
    }

    private BigDecimal computeAverageCompletionHours() {
        List<WorkOrder> completed = workOrderRepository.findCompletedWithTimes(DONE_STATUSES);
        if (completed.isEmpty()) {
            return BigDecimal.ZERO;
        }
        long totalMinutes = 0;
        for (WorkOrder wo : completed) {
            totalMinutes += Duration.between(wo.getActualStart(), wo.getActualEnd()).toMinutes();
        }
        double avgMinutes = (double) totalMinutes / completed.size();
        return BigDecimal.valueOf(avgMinutes)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private List<DashboardMetricsResponse.RecentActivity> recentActivity(int limit) {
        return historyRepository.findAll(
                        PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "changedAt")))
                .getContent().stream()
                .map(this::toActivity)
                .toList();
    }

    private DashboardMetricsResponse.RecentActivity toActivity(WorkOrderStatusHistory h) {
        return new DashboardMetricsResponse.RecentActivity(
                h.getWorkOrder().getId(),
                h.getWorkOrder().getWorkOrderNumber(),
                h.getWorkOrder().getTitle(),
                h.getToStatus(),
                h.getChangedBy() == null ? "System" : h.getChangedBy().getFullName(),
                h.getChangedAt(),
                h.getNote());
    }
}
