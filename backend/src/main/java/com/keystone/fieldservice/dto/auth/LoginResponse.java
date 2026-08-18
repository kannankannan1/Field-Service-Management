package com.keystone.fieldservice.dto.auth;

import com.keystone.fieldservice.dto.user.UserResponse;

public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresInSeconds,
        UserResponse user
) {
}
