package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.part.ConsumePartRequest;
import com.keystone.fieldservice.dto.part.PartRequest;
import com.keystone.fieldservice.dto.part.PartResponse;
import com.keystone.fieldservice.dto.part.StockAdjustmentRequest;
import com.keystone.fieldservice.dto.part.StockMovementResponse;
import com.keystone.fieldservice.service.PartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/parts")
@Tag(name = "Parts", description = "Parts inventory and transactional stock movements")
public class PartController {

    private final PartService partService;

    public PartController(PartService partService) {
        this.partService = partService;
    }

    @Operation(summary = "List parts with search and pagination")
    @GetMapping
    public ResponseEntity<PageResponse<PartResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(partService.list(search, page, size));
    }

    @Operation(summary = "List low-stock parts")
    @GetMapping("/low")
    public ResponseEntity<List<PartResponse>> lowStock() {
        return ResponseEntity.ok(partService.lowStock());
    }

    @Operation(summary = "Get a part")
    @GetMapping("/{id}")
    public ResponseEntity<PartResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(partService.get(id));
    }

    @Operation(summary = "Create a part")
    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PartResponse> create(@Valid @RequestBody PartRequest request) {
        return ResponseEntity.ok(partService.create(request));
    }

    @Operation(summary = "Update a part")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<PartResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody PartRequest request) {
        return ResponseEntity.ok(partService.update(id, request));
    }

    @Operation(summary = "Adjust stock (inbound / outbound / adjustment)")
    @PostMapping("/{id}/stock")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<StockMovementResponse> adjustStock(@PathVariable Long id,
                                                             @Valid @RequestBody StockAdjustmentRequest request) {
        return ResponseEntity.ok(partService.adjustStock(id, request));
    }

    @Operation(summary = "Stock movements for a part")
    @GetMapping("/{id}/movements")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<StockMovementResponse>> movements(@PathVariable Long id) {
        return ResponseEntity.ok(partService.movementsForPart(id));
    }

    @Operation(summary = "Consume parts on a work order (transactional stock deduction)")
    @PostMapping("/work-orders/{workOrderId}/consume")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<StockMovementResponse> consume(@PathVariable Long workOrderId,
                                                         @Valid @RequestBody ConsumePartRequest request) {
        return ResponseEntity.ok(partService.consume(workOrderId, request));
    }

    @Operation(summary = "Parts used on a work order")
    @GetMapping("/work-orders/{workOrderId}")
    @PreAuthorize("hasAnyRole('TECHNICIAN', 'DISPATCHER', 'MANAGER')")
    public ResponseEntity<List<StockMovementResponse>> forWorkOrder(@PathVariable Long workOrderId) {
        return ResponseEntity.ok(partService.movementsForWorkOrder(workOrderId));
    }
}
