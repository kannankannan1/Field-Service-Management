package com.keystone.fieldservice.exception;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.Map;

public record ApiError(
        Instant timestamp,
        HttpStatus status,
        int code,
        String message,
        Map<String, String> fieldErrors,
        String path
) {
    public static ApiError of(HttpStatus status, String message, String path) {
        return new ApiError(Instant.now(), status, status.value(), message, null, path);
    }

    public static ApiError of(HttpStatus status, String message, Map<String, String> fieldErrors, String path) {
        return new ApiError(Instant.now(), status, status.value(), message, fieldErrors, path);
    }
}
