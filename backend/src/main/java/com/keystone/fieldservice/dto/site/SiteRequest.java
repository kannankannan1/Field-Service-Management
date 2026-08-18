package com.keystone.fieldservice.dto.site;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SiteRequest(
        @NotNull(message = "Customer is required")
        Long customerId,

        @NotBlank(message = "Site name is required")
        @Size(max = 200, message = "Site name must not exceed 200 characters")
        String name,

        @NotBlank(message = "Street address is required")
        @Size(max = 200, message = "Street address must not exceed 200 characters")
        String streetAddress,

        @NotBlank(message = "City is required")
        @Size(max = 100, message = "City must not exceed 100 characters")
        String city,

        @Size(max = 50, message = "State must not exceed 50 characters")
        String state,

        @Size(max = 20, message = "Zip must not exceed 20 characters")
        String zip,

        @Size(max = 100, message = "Country must not exceed 100 characters")
        String country,

        @Size(max = 100, message = "Contact name must not exceed 100 characters")
        String contactName,

        @Size(max = 30, message = "Contact phone must not exceed 30 characters")
        String contactPhone,

        @Size(max = 500, message = "Notes must not exceed 500 characters")
        String notes
) {
}
