package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.Site;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SiteRepository extends JpaRepository<Site, Long> {

    List<Site> findByCustomerId(Long customerId);

    long countByCustomerId(Long customerId);
}
