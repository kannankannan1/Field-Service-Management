package com.keystone.fieldservice.repository;

import com.keystone.fieldservice.domain.entity.Part;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long>, JpaSpecificationExecutor<Part> {

    Optional<Part> findBySku(String sku);

    boolean existsBySku(String sku);

    List<Part> findByQuantityOnHandLessThanEqual(Integer threshold);

    List<Part> findByReorderLevelGreaterThan(int min);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Part p where p.id = :id")
    @QueryHints({@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")})
    Optional<Part> findByIdForUpdate(@Param("id") Long id);
}
