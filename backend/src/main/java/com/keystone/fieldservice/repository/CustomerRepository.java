package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {

    boolean existsByName(String name);

    Optional<Customer> findByUserId(Long userId);

    boolean existsByEmail(String email);
}
