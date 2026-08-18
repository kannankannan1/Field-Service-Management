package com.keystone.fieldservice.domain.entity;

import com.keystone.fieldservice.domain.enums.StockMovementType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "stock_movements", indexes = {
        @Index(name = "idx_sm_part", columnList = "part_id"),
        @Index(name = "idx_sm_work_order", columnList = "work_order_id")
})
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "part_id", nullable = false)
    private Part part;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_order_id")
    private WorkOrder workOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockMovementType type;

    @Column(name = "quantity_change", nullable = false)
    private Integer quantityChange;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StockMovement() {
    }

    public static StockMovement of(Part part, WorkOrder workOrder, StockMovementType type,
                                   Integer quantityChange, String note) {
        StockMovement movement = new StockMovement();
        movement.part = part;
        movement.workOrder = workOrder;
        movement.type = type;
        movement.quantityChange = quantityChange;
        movement.note = note;
        return movement;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Part getPart() {
        return part;
    }

    public WorkOrder getWorkOrder() {
        return workOrder;
    }

    public StockMovementType getType() {
        return type;
    }

    public Integer getQuantityChange() {
        return quantityChange;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
