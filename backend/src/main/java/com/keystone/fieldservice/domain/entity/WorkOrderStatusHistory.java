package com.keystone.fieldservice.domain.entity;

import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
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

/**
 * Immutable audit record for every work order status change.
 * Instances are created through {@link #of(WorkOrder, WorkOrderStatus, WorkOrderStatus, User, String)}
 * and expose no mutators.
 */
@Entity
@Table(name = "work_order_status_history", indexes = {
        @Index(name = "idx_woh_work_order", columnList = "work_order_id")
})
public class WorkOrderStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "work_order_id", nullable = false)
    private WorkOrder workOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private WorkOrderStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private WorkOrderStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_id")
    private User changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt;

    @Column(length = 1000)
    private String note;

    protected WorkOrderStatusHistory() {
    }

    public static WorkOrderStatusHistory of(WorkOrder workOrder, WorkOrderStatus fromStatus,
                                            WorkOrderStatus toStatus, User changedBy, String note) {
        WorkOrderStatusHistory history = new WorkOrderStatusHistory();
        history.workOrder = workOrder;
        history.fromStatus = fromStatus;
        history.toStatus = toStatus;
        history.changedBy = changedBy;
        history.note = note;
        history.changedAt = Instant.now();
        return history;
    }

    @PrePersist
    void onCreate() {
        if (changedAt == null) {
            changedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public WorkOrder getWorkOrder() {
        return workOrder;
    }

    public WorkOrderStatus getFromStatus() {
        return fromStatus;
    }

    public WorkOrderStatus getToStatus() {
        return toStatus;
    }

    public User getChangedBy() {
        return changedBy;
    }

    public Instant getChangedAt() {
        return changedAt;
    }

    public String getNote() {
        return note;
    }
}
