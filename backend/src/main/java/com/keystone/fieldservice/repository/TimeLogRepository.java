package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.TimeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface TimeLogRepository extends JpaRepository<TimeLog, Long> {

    List<TimeLog> findByWorkOrderIdOrderByStartTimeDesc(Long workOrderId);

    List<TimeLog> findByTechnicianIdOrderByStartTimeDesc(Long technicianId);

    Optional<TimeLog> findFirstByWorkOrderIdAndEndTimeIsNullOrderByStartTimeDesc(Long workOrderId);

    @Query("select coalesce(sum(t.hoursWorked), 0) from TimeLog t where t.workOrder.id = :workOrderId")
    BigDecimal sumHoursByWorkOrderId(@Param("workOrderId") Long workOrderId);
}
