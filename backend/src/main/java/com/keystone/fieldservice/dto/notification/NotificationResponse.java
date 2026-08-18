package com.keystone.fieldservice.dto.notification;

import com.keystone.fieldservice.domain.entity.Notification;
import com.keystone.fieldservice.domain.enums.NotificationType;

import java.time.Instant;

public record NotificationResponse(
        Long id,
        String title,
        String message,
        NotificationType type,
        boolean read,
        Instant createdAt
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getType(),
                notification.isRead(),
                notification.getCreatedAt());
    }
}
