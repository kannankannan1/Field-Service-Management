package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.site.SiteRequest;
import com.keystone.fieldservice.dto.site.SiteResponse;
import com.keystone.fieldservice.service.SiteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/sites")
@Tag(name = "Sites", description = "Customer site management")
public class SiteController {

    private final SiteService siteService;

    public SiteController(SiteService siteService) {
        this.siteService = siteService;
    }

    @Operation(summary = "List sites, optionally filtered by customer")
    @GetMapping
    public ResponseEntity<List<SiteResponse>> list(@RequestParam(required = false) Long customerId) {
        return ResponseEntity.ok(siteService.list(customerId));
    }

    @Operation(summary = "Get a site")
    @GetMapping("/{id}")
    public ResponseEntity<SiteResponse> get(@PathVariable Long id) {
        return ResponseEntity.ok(siteService.get(id));
    }

    @Operation(summary = "Create a site")
    @PostMapping
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER')")
    public ResponseEntity<SiteResponse> create(@Valid @RequestBody SiteRequest request) {
        return ResponseEntity.ok(siteService.create(request));
    }

    @Operation(summary = "Update a site")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER')")
    public ResponseEntity<SiteResponse> update(@PathVariable Long id,
                                               @Valid @RequestBody SiteRequest request) {
        return ResponseEntity.ok(siteService.update(id, request));
    }

    @Operation(summary = "Delete a site")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        siteService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
