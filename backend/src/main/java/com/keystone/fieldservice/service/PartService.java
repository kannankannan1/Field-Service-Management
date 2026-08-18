package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Part;
import com.keystone.fieldservice.domain.entity.StockMovement;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.enums.NotificationType;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.domain.enums.StockMovementType;
import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.part.ConsumePartRequest;
import com.keystone.fieldservice.dto.part.PartRequest;
import com.keystone.fieldservice.dto.part.PartResponse;
import com.keystone.fieldservice.dto.part.StockAdjustmentRequest;
import com.keystone.fieldservice.dto.part.StockMovementResponse;
import com.keystone.fieldservice.exception.BadRequestException;
import com.keystone.fieldservice.exception.ConflictException;
import com.keystone.fieldservice.exception.ForbiddenException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.PartRepository;
import com.keystone.fieldservice.repository.StockMovementRepository;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

@Service
public class PartService {

    private final PartRepository partRepository;
    private final StockMovementRepository stockMovementRepository;
    private final WorkOrderRepository workOrderRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;

    public PartService(PartRepository partRepository,
                       StockMovementRepository stockMovementRepository,
                       WorkOrderRepository workOrderRepository,
                       UserRepository userRepository,
                       NotificationService notificationService,
                       CurrentUserService currentUserService) {
        this.partRepository = partRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.workOrderRepository = workOrderRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public PageResponse<PartResponse> list(String search, int page, int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.ASC, "sku"));
        Page<Part> result;
        if (StringUtils.hasText(search)) {
            String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
            result = partRepository.findAll((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("sku")), like),
                    cb.like(cb.lower(root.get("name")), like)), pageable);
        } else {
            result = partRepository.findAll(pageable);
        }
        return new PageResponse<>(
                result.getContent().stream().map(PartResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), result.isFirst(), result.isLast());
    }

    @Transactional(readOnly = true)
    public List<PartResponse> lowStock() {
        List<Part> low = partRepository.findByReorderLevelGreaterThan(0).stream()
                .filter(Part::isLowStock).toList();
        return low.stream().map(PartResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PartResponse get(Long id) {
        return PartResponse.from(findPart(id));
    }

    @Transactional
    public PartResponse create(PartRequest request) {
        requireManager();
        if (partRepository.existsBySku(request.sku())) {
            throw new ConflictException("A part with SKU '" + request.sku() + "' already exists");
        }
        Part part = new Part(request.sku(), request.name(), request.description(),
                request.unitPrice(), request.quantityOnHand(), request.reorderLevel());
        Part saved = partRepository.save(part);
        if (saved.getQuantityOnHand() > 0) {
            stockMovementRepository.save(StockMovement.of(saved, null, StockMovementType.INBOUND,
                    saved.getQuantityOnHand(), "Initial stock"));
        }
        return PartResponse.from(saved);
    }

    @Transactional
    public PartResponse update(Long id, PartRequest request) {
        requireManager();
        Part part = findPart(id);
        partRepository.findBySku(request.sku()).filter(p -> !p.getId().equals(id))
                .ifPresent(p -> {
                    throw new ConflictException("A part with SKU '" + request.sku() + "' already exists");
                });
        part.setSku(request.sku());
        part.setName(request.name());
        part.setDescription(request.description());
        part.setUnitPrice(request.unitPrice());
        part.setReorderLevel(request.reorderLevel());
        return PartResponse.from(partRepository.save(part));
    }

    @Transactional
    public StockMovementResponse adjustStock(Long partId, StockAdjustmentRequest request) {
        requireManager();
        Part part = findPart(partId);
        int delta = switch (request.type()) {
            case INBOUND -> Math.abs(request.quantity());
            case OUTBOUND -> -Math.abs(request.quantity());
            case ADJUSTMENT -> request.quantity();
        };
        return applyDelta(part, null, request.type(), delta, request.note());
    }

    @Transactional
    public StockMovementResponse consume(Long workOrderId, ConsumePartRequest request) {
        User current = currentUserService.getCurrentUser();
        WorkOrder workOrder = workOrderRepository.findById(workOrderId)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        if (current.getRole() == Role.TECHNICIAN
                && (workOrder.getAssignedTechnician() == null
                || !workOrder.getAssignedTechnician().getId().equals(current.getId()))) {
            throw new ForbiddenException("You can only use parts on work orders assigned to you");
        }
        if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot consume parts");
        }
        Part part = partRepository.findByIdForUpdate(request.partId())
                .orElseThrow(() -> new NotFoundException("Part not found"));
        if (part.getQuantityOnHand() < request.quantity()) {
            throw new BadRequestException("Insufficient stock for " + part.getSku()
                    + " (available: " + part.getQuantityOnHand() + ", requested: " + request.quantity() + ")");
        }
        return applyDelta(part, workOrder, StockMovementType.OUTBOUND,
                -request.quantity(), request.note() != null
                        ? request.note() : "Consumed on " + workOrder.getWorkOrderNumber());
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> movementsForWorkOrder(Long workOrderId) {
        workOrderRepository.findById(workOrderId)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        return stockMovementRepository.findByWorkOrderIdOrderByCreatedAtDesc(workOrderId).stream()
                .map(StockMovementResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<StockMovementResponse> movementsForPart(Long partId) {
        requireManager();
        findPart(partId);
        return stockMovementRepository.findByPartIdOrderByCreatedAtDesc(partId).stream()
                .map(StockMovementResponse::from).toList();
    }

    private StockMovementResponse applyDelta(Part part, WorkOrder workOrder, StockMovementType type,
                                             int delta, String note) {
        int newQuantity = part.getQuantityOnHand() + delta;
        if (newQuantity < 0) {
            throw new BadRequestException("Stock cannot go below zero for " + part.getSku());
        }
        part.setQuantityOnHand(newQuantity);
        partRepository.save(part);
        StockMovement movement = stockMovementRepository.save(
                StockMovement.of(part, workOrder, type, delta, note));
        if (part.isLowStock()) {
            notifyLowStock(part);
        }
        return StockMovementResponse.from(movement);
    }

    private void notifyLowStock(Part part) {
        String message = "Part " + part.getSku() + " (" + part.getName()
                + ") is at " + part.getQuantityOnHand() + " units, reorder level "
                + part.getReorderLevel() + ".";
        userRepository.findByRole(Role.MANAGER).forEach(u ->
                notificationService.notify(u, "Low stock alert", message, NotificationType.STOCK_LOW));
        userRepository.findByRole(Role.DISPATCHER).forEach(u ->
                notificationService.notify(u, "Low stock alert", message, NotificationType.STOCK_LOW));
    }

    private Part findPart(Long id) {
        return partRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Part not found"));
    }

    private void requireManager() {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() != Role.MANAGER) {
            throw new ForbiddenException("Only managers can perform this action");
        }
    }
}
