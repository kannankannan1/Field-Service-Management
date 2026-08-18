package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.dashboard.DashboardMetricsResponse;
import com.keystone.fieldservice.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@Tag(name = "Dashboard", description = "Live operational metrics for managers and dispatchers")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @Operation(summary = "Live dashboard metrics computed from PostgreSQL")
    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('MANAGER', 'DISPATCHER')")
    public ResponseEntity<DashboardMetricsResponse> metrics() {
        return ResponseEntity.ok(dashboardService.metrics());
    }
}
