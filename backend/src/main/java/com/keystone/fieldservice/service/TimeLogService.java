package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.TimeLog;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.dto.timelog.TimeLogRequest;
import com.keystone.fieldservice.dto.timelog.TimeLogResponse;
import com.keystone.fieldservice.exception.BadRequestException;
import com.keystone.fieldservice.exception.ForbiddenException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.TimeLogRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class TimeLogService {

    private final TimeLogRepository timeLogRepository;
    private final WorkOrderRepository workOrderRepository;
    private final CurrentUserService currentUserService;

    public TimeLogService(TimeLogRepository timeLogRepository,
                          WorkOrderRepository workOrderRepository,
                          CurrentUserService currentUserService) {
        this.timeLogRepository = timeLogRepository;
        this.workOrderRepository = workOrderRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public TimeLogResponse start(Long workOrderId, String notes) {
        User current = currentUserService.getCurrentUser();
        WorkOrder workOrder = workOrderRepository.findById(workOrderId)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        requireWorkOrderAccess(current, workOrder);

        timeLogRepository.findFirstByWorkOrderIdAndEndTimeIsNullOrderByStartTimeDesc(workOrderId)
                .ifPresent(t -> {
                    throw new BadRequestException("A time log is already running for this work order");
                });
        TimeLog log = new TimeLog();
        log.setWorkOrder(workOrder);
        log.setTechnician(current);
        log.setStartTime(LocalDateTime.now());
        log.setNotes(notes);
        return TimeLogResponse.from(timeLogRepository.save(log));
    }

    @Transactional
    public TimeLogResponse stop(Long timeLogId) {
        User current = currentUserService.getCurrentUser();
        TimeLog log = timeLogRepository.findById(timeLogId)
                .orElseThrow(() -> new NotFoundException("Time log not found"));
        if (current.getRole() == Role.TECHNICIAN
                && !log.getTechnician().getId().equals(current.getId())) {
            throw new ForbiddenException("You can only stop your own time logs");
        }
        if (log.getEndTime() != null) {
            throw new BadRequestException("Time log is already stopped");
        }
        LocalDateTime end = LocalDateTime.now();
        log.setEndTime(end);
        long minutes = Duration.between(log.getStartTime(), end).toMinutes();
        BigDecimal hours = BigDecimal.valueOf(minutes)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        log.setHoursWorked(hours);
        return TimeLogResponse.from(timeLogRepository.save(log));
    }

    @Transactional
    public TimeLogResponse create(TimeLogRequest request) {
        if (request.workOrderId() == null) {
            throw new BadRequestException("Work order is required");
        }
        User current = currentUserService.getCurrentUser();
        WorkOrder workOrder = workOrderRepository.findById(request.workOrderId())
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        if (current.getRole() == Role.TECHNICIAN) {
            requireWorkOrderAccess(current, workOrder);
        } else if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot log time");
        }
        LocalDateTime start = request.startTime() != null ? request.startTime() : LocalDateTime.now();
        LocalDateTime end = request.endTime();
        TimeLog log = new TimeLog();
        log.setWorkOrder(workOrder);
        log.setTechnician(current);
        log.setStartTime(start);
        if (end != null) {
            if (!end.isAfter(start)) {
                throw new BadRequestException("End time must be after start time");
            }
            log.setEndTime(end);
            long minutes = Duration.between(start, end).toMinutes();
            log.setHoursWorked(BigDecimal.valueOf(minutes)
                    .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
        }
        log.setNotes(request.notes());
        return TimeLogResponse.from(timeLogRepository.save(log));
    }

    @Transactional(readOnly = true)
    public List<TimeLogResponse> myLogs() {
        User current = currentUserService.getCurrentUser();
        return timeLogRepository.findByTechnicianIdOrderByStartTimeDesc(current.getId()).stream()
                .map(TimeLogResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TimeLogResponse> logsForWorkOrder(Long workOrderId) {
        User current = currentUserService.getCurrentUser();
        WorkOrder workOrder = workOrderRepository.findById(workOrderId)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        if (current.getRole() == Role.TECHNICIAN) {
            requireWorkOrderAccess(current, workOrder);
        } else if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot view time logs");
        }
        return timeLogRepository.findByWorkOrderIdOrderByStartTimeDesc(workOrderId).stream()
                .map(TimeLogResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal totalHoursForWorkOrder(Long workOrderId) {
        return timeLogRepository.sumHoursByWorkOrderId(workOrderId);
    }

    private void requireWorkOrderAccess(User current, WorkOrder workOrder) {
        if (current.getRole() == Role.TECHNICIAN
                && (workOrder.getAssignedTechnician() == null
                || !workOrder.getAssignedTechnician().getId().equals(current.getId()))) {
            throw new ForbiddenException("You can only log time on work orders assigned to you");
        }
    }
}
