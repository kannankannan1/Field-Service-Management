package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.user.CreateUserRequest;
import com.keystone.fieldservice.dto.user.UserResponse;
import com.keystone.fieldservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Users", description = "User and technician administration")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "List technicians (for assignment)")
    @GetMapping("/technicians")
    @PreAuthorize("hasAnyRole('DISPATCHER', 'MANAGER')")
    public ResponseEntity<List<UserResponse>> technicians() {
        return ResponseEntity.ok(userService.listTechnicians());
    }

    @Operation(summary = "List all staff users")
    @GetMapping("/staff")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<List<UserResponse>> staff() {
        return ResponseEntity.ok(userService.listStaff());
    }

    @Operation(summary = "Create a staff user (dispatcher, technician or manager)")
    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<UserResponse> createStaff(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(userService.createStaffUser(
                request.username(), request.password(), request.firstName(),
                request.lastName(), request.email(), request.phone(), request.role()));
    }

    @Operation(summary = "Enable or disable a user account")
    @PatchMapping("/{id}/enabled")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<UserResponse> setEnabled(@PathVariable Long id,
                                                   @RequestParam boolean enabled) {
        return ResponseEntity.ok(userService.setEnabled(id, enabled));
    }
}
