package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    List<StockMovement> findByWorkOrderIdOrderByCreatedAtDesc(Long workOrderId);

    List<StockMovement> findByPartIdOrderByCreatedAtDesc(Long partId);
}
