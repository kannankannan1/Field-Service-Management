package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.workorder.AssignRequest;
import com.keystone.fieldservice.dto.workorder.StatusChangeRequest;
import com.keystone.fieldservice.dto.workorder.WorkOrderCard;
import com.keystone.fieldservice.dto.workorder.WorkOrderHistoryResponse;
import com.keystone.fieldservice.dto.workorder.WorkOrderRequest;
import com.keystone.fieldservice.dto.workorder.WorkOrderResponse;
import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import com.keystone.fieldservice.service.WorkOrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/work-orders")
@Tag(name = "Work Orders", description = "Work order lifecycle, assignment, search and Kanban")
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    public WorkOrderController(WorkOrderService workOrderService) {
        this.workOrderService = workOrderService;
    }

    @Operation(summary = "Search work orders with filters and pagination")
    @GetMapping
    public ResponseEntity<PageResponse<WorkOrderResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) WorkOrderStatus status,
            @RequestParam(required = false) WorkOrderPriority priority,
            @RequestParam(required = false) Long technicianId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long siteId,
            @RequestParam(required = false) Boolean slaBreached,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        return ResponseEntity.ok(workOrderService.list(search, status, priority,
                technicianId, customerId, siteId, slaBreached, page, size, sort));
    }

    @Operation(summary = "Kanban board grouped by status")
    @GetMapping("/kanban")
    public ResponseEntity<Map<WorkOrderStatus, List<WorkOrderCard>>> kanban(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) WorkOrderPriority priority,
            @RequestParam(required = false) Long technicianId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) Long siteId,
            @RequestParam(required = false) Boolean slaBreached) {
        return ResponseEntity.ok(workOrderService.kanban(search, priority,
                technicianId, customerId, siteId, slaBreached));
    }

    @Operation(summary = "Get a work order")
    @GetMapping("/{id}")
    public ResponseEntity<WorkOrderResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(workOrderService.get(id));
    }

    @Operation(summary = "Get immutable status history of a work order")
    @GetMapping("/{id}/history")
    public ResponseEntity<List<WorkOrderHistoryResponse>> history(@PathVariable Long id) {
        return ResponseEntity.ok(workOrderService.history(id));
    }

    @Operation(summary = "Create a work order")
    @PostMapping
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER', 'CUSTOMER')")
    public ResponseEntity<WorkOrderResponse> create(@Valid @RequestBody WorkOrderRequest request) {
        return ResponseEntity.ok(workOrderService.create(request));
    }

    @Operation(summary = "Update a work order")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER')")
    public ResponseEntity<WorkOrderResponse> update(@PathVariable Long id,
                                                    @Valid @RequestBody WorkOrderRequest request) {
        return ResponseEntity.ok(workOrderService.update(id, request));
    }

    @Operation(summary = "Assign a technician to a work order")
    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER')")
    public ResponseEntity<WorkOrderResponse> assign(@PathVariable Long id,
                                                    @Valid @RequestBody AssignRequest request) {
        return ResponseEntity.ok(workOrderService.assign(id, request));
    }

    @Operation(summary = "Transition a work order to the next lifecycle status")
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER', 'TECHNICIAN')")
    public ResponseEntity<WorkOrderResponse> changeStatus(@PathVariable Long id,
                                                          @Valid @RequestBody StatusChangeRequest request) {
        return ResponseEntity.ok(workOrderService.changeStatus(id, request));
    }
}
