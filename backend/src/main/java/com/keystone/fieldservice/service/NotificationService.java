package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Notification;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.NotificationType;
import com.keystone.fieldservice.dto.notification.NotificationResponse;
import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationService(NotificationRepository notificationRepository,
                               SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public NotificationResponse notify(User user, String title, String message, NotificationType type) {
        Notification notification = notificationRepository.save(Notification.of(user, title, message, type));
        messagingTemplate.convertAndSendToUser(
                user.getUsername(), "/queue/notifications", NotificationResponse.from(notification));
        return NotificationResponse.from(notification);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> myNotifications(Long userId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Notification> result = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return new PageResponse<>(
                result.getContent().stream().map(NotificationResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), result.isFirst(), result.isLast());
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        if (!notification.getUser().getId().equals(userId)) {
            throw new com.keystone.fieldservice.exception.ForbiddenException("You cannot access this notification");
        }
        notification.markRead();
        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Transactional
    public void markAllRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        unread.forEach(Notification::markRead);
        notificationRepository.saveAll(unread);
    }
}
