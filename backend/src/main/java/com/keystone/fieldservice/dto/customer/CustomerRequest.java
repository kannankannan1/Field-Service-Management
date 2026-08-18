package com.keystone.fieldservice.dto.customer;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerRequest(
        @NotBlank(message = "Customer name is required")
        @Size(max = 200, message = "Customer name must not exceed 200 characters")
        String name,

        @Size(max = 100, message = "Contact name must not exceed 100 characters")
        String contactName,

        @Email(message = "Email must be valid")
        @Size(max = 150, message = "Email must not exceed 150 characters")
        String email,

        @Size(max = 30, message = "Phone must not exceed 30 characters")
        String phone,

        @Size(max = 300, message = "Address must not exceed 300 characters")
        String address,

        @Size(max = 100, message = "Portal username must not exceed 100 characters")
        String portalUsername,

        @Size(min = 8, max = 100, message = "Portal password must be between 8 and 100 characters")
        String portalPassword
) {
}
