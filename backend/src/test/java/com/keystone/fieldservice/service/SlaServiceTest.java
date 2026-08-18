package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class SlaServiceTest {

    private final SlaService slaService = new SlaService(4, 24, 72, 120);

    @Test
    void computesDueDatePerPriority() {
        LocalDateTime from = LocalDateTime.of(2026, 8, 14, 10, 0);
        assertThat(slaService.computeDueDate(WorkOrderPriority.URGENT, from))
                .isEqualTo(from.plusHours(4));
        assertThat(slaService.computeDueDate(WorkOrderPriority.HIGH, from))
                .isEqualTo(from.plusHours(24));
        assertThat(slaService.computeDueDate(WorkOrderPriority.MEDIUM, from))
                .isEqualTo(from.plusHours(72));
        assertThat(slaService.computeDueDate(WorkOrderPriority.LOW, from))
                .isEqualTo(from.plusHours(120));
    }
}
