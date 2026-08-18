package com.keystone.fieldservice.controller;

import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.notification.NotificationResponse;
import com.keystone.fieldservice.security.CurrentUserService;
import com.keystone.fieldservice.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "User notifications (also delivered in real time over WebSocket)")
public class NotificationController {

    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationService notificationService,
                                  CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    @Operation(summary = "List my notifications")
    @GetMapping
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(notificationService.myNotifications(currentUserService.getCurrentUserId(), page, size));
    }

    @Operation(summary = "Unread notification count")
    @GetMapping("/unread-count")
    public ResponseEntity<Long> unreadCount() {
        return ResponseEntity.ok(notificationService.unreadCount(currentUserService.getCurrentUserId()));
    }

    @Operation(summary = "Mark a notification as read")
    @PostMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markRead(id, currentUserService.getCurrentUserId()));
    }

    @Operation(summary = "Mark all notifications as read")
    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        notificationService.markAllRead(currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
