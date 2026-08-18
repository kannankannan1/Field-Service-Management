package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.timelog.TimeLogRequest;
import com.keystone.fieldservice.dto.timelog.TimeLogResponse;
import com.keystone.fieldservice.service.TimeLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Time Logs", description = "Technician time tracking")
public class TimeLogController {

    private final TimeLogService timeLogService;

    public TimeLogController(TimeLogService timeLogService) {
        this.timeLogService = timeLogService;
    }

    @Operation(summary = "Start a running time log on a work order")
    @PostMapping("/work-orders/{id}/time-logs/start")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<TimeLogResponse> start(@PathVariable Long id,
                                                 @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(timeLogService.start(id, notes));
    }

    @Operation(summary = "List time logs for a work order")
    @GetMapping("/work-orders/{id}/time-logs")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<List<TimeLogResponse>> forWorkOrder(@PathVariable Long id) {
        return ResponseEntity.ok(timeLogService.logsForWorkOrder(id));
    }

    @Operation(summary = "List my time logs")
    @GetMapping("/time-logs/my")
    public ResponseEntity<List<TimeLogResponse>> my() {
        return ResponseEntity.ok(timeLogService.myLogs());
    }

    @Operation(summary = "Create a time log with explicit times")
    @PostMapping("/time-logs")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<TimeLogResponse> create(@Valid @RequestBody TimeLogRequest request) {
        return ResponseEntity.ok(timeLogService.create(request));
    }

    @Operation(summary = "Stop a running time log")
    @PostMapping("/time-logs/{id}/stop")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<TimeLogResponse> stop(@PathVariable Long id) {
        return ResponseEntity.ok(timeLogService.stop(id));
    }
}
