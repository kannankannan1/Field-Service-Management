package com.keystone.fieldservice.dto.user;

import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String firstName,
        String lastName,
        String fullName,
        String email,
        String phone,
        Role role,
        boolean enabled,
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFirstName(),
                user.getLastName(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.isEnabled(),
                user.getCreatedAt());
    }
}
