package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WorkOrderRepository extends JpaRepository<WorkOrder, Long>,
        JpaSpecificationExecutor<WorkOrder> {

    java.util.Optional<WorkOrder> findByWorkOrderNumber(String workOrderNumber);    Page<WorkOrder> findByCustomerId(Long customerId, Pageable pageable);

    Page<WorkOrder> findByAssignedTechnicianId(Long technicianId, Pageable pageable);

    long countByStatus(WorkOrderStatus status);

    long countByAssignedTechnicianIdAndStatusNotIn(Long technicianId,
                                                   java.util.Collection<WorkOrderStatus> statuses);

    @Query("select count(w) from WorkOrder w where w.status <> :open1 and w.status <> :open2 and w.status <> :open3 and w.status <> :open4")
    long countClosed(@Param("open1") WorkOrderStatus s1, @Param("open2") WorkOrderStatus s2,
                     @Param("open3") WorkOrderStatus s3, @Param("open4") WorkOrderStatus s4);

    @Query("select count(w) from WorkOrder w where w.slaBreached = true")
    long countSlaBreached();

    @Query(value = "select nextval('work_order_number_seq')", nativeQuery = true)
    Long nextWorkOrderNumberValue();

    @Query("select w from WorkOrder w where w.status in :openStatuses and w.slaDueAt < :now and w.slaBreached = false")
    List<WorkOrder> findBreaching(@Param("openStatuses") List<WorkOrderStatus> openStatuses,
                                  @Param("now") LocalDateTime now);

    @Query("select w from WorkOrder w where w.status in :openStatuses and w.slaDueAt between :from and :to and w.slaBreached = false")
    List<WorkOrder> findNearBreach(@Param("openStatuses") List<WorkOrderStatus> openStatuses,
                                   @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    @Query("select w from WorkOrder w where w.status in :statuses and w.actualEnd is not null and w.actualStart is not null")
    List<WorkOrder> findCompletedWithTimes(@Param("statuses") List<WorkOrderStatus> statuses);

    @Query("select count(w) from WorkOrder w where (w.status = :completed or w.status = :closed) and w.updatedAt >= :since")
    long countDoneSince(@Param("completed") WorkOrderStatus completed,
                        @Param("closed") WorkOrderStatus closed,
                        @Param("since") Instant since);

    @Query("select w from WorkOrder w where w.status = :status and w.assignedTechnician is not null")
    List<WorkOrder> findByStatusWithTechnician(@Param("status") WorkOrderStatus status);
}
