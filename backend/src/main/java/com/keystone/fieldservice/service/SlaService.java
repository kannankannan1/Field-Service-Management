package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class SlaService {

    private final int urgentHours;
    private final int highHours;
    private final int mediumHours;
    private final int lowHours;

    public SlaService(@Value("${app.sla.urgent-hours:4}") int urgentHours,
                      @Value("${app.sla.high-hours:24}") int highHours,
                      @Value("${app.sla.medium-hours:72}") int mediumHours,
                      @Value("${app.sla.low-hours:120}") int lowHours) {
        this.urgentHours = urgentHours;
        this.highHours = highHours;
        this.mediumHours = mediumHours;
        this.lowHours = lowHours;
    }

    public LocalDateTime computeDueDate(WorkOrderPriority priority, LocalDateTime from) {
        return from.plusHours(hoursFor(priority));
    }

    public int hoursFor(WorkOrderPriority priority) {
        return switch (priority) {
            case URGENT -> urgentHours;
            case HIGH -> highHours;
            case MEDIUM -> mediumHours;
            case LOW -> lowHours;
        };
    }
}
