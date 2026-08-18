package com.keystone.fieldservice.dto.site;

import com.keystone.fieldservice.domain.entity.Site;

import java.time.Instant;

public record SiteResponse(
        Long id,
        Long customerId,
        String customerName,
        String name,
        String streetAddress,
        String city,
        String state,
        String zip,
        String country,
        String contactName,
        String contactPhone,
        String notes,
        String fullAddress,
        Instant createdAt,
        Instant updatedAt
) {
    public static SiteResponse from(Site site) {
        return new SiteResponse(
                site.getId(),
                site.getCustomer().getId(),
                site.getCustomer().getName(),
                site.getName(),
                site.getStreetAddress(),
                site.getCity(),
                site.getState(),
                site.getZip(),
                site.getCountry(),
                site.getContactName(),
                site.getContactPhone(),
                site.getNotes(),
                site.getFullAddress(),
                site.getCreatedAt(),
                site.getUpdatedAt());
    }
}
