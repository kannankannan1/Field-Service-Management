package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Customer;
import com.keystone.fieldservice.domain.entity.Site;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.entity.WorkOrder;
import com.keystone.fieldservice.domain.entity.WorkOrderStatusHistory;
import com.keystone.fieldservice.domain.enums.NotificationType;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.domain.enums.WorkOrderPriority;
import com.keystone.fieldservice.domain.enums.WorkOrderStatus;
import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.workorder.AssignRequest;
import com.keystone.fieldservice.dto.workorder.StatusChangeRequest;
import com.keystone.fieldservice.dto.workorder.WorkOrderCard;
import com.keystone.fieldservice.dto.workorder.WorkOrderHistoryResponse;
import com.keystone.fieldservice.dto.workorder.WorkOrderRequest;
import com.keystone.fieldservice.dto.workorder.WorkOrderResponse;
import com.keystone.fieldservice.exception.BadRequestException;
import com.keystone.fieldservice.exception.ForbiddenException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.CustomerRepository;
import com.keystone.fieldservice.repository.SiteRepository;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.repository.WorkOrderStatusHistoryRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class WorkOrderService {

    private static final Map<WorkOrderStatus, Set<WorkOrderStatus>> VALID_TRANSITIONS = new EnumMap<>(WorkOrderStatus.class);
    private static final Set<WorkOrderStatus> TECHNICIAN_TRANSITIONS = Set.of(
            WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED);
    private static final List<String> ALLOWED_SORT_FIELDS =
            List.of("id", "workOrderNumber", "title", "priority", "status",
                    "createdAt", "updatedAt", "slaDueAt", "scheduledStart");

    static {
        VALID_TRANSITIONS.put(WorkOrderStatus.NEW, Set.of(WorkOrderStatus.ASSIGNED));
        VALID_TRANSITIONS.put(WorkOrderStatus.ASSIGNED, Set.of(WorkOrderStatus.IN_PROGRESS));
        VALID_TRANSITIONS.put(WorkOrderStatus.IN_PROGRESS, Set.of(WorkOrderStatus.ON_HOLD, WorkOrderStatus.COMPLETED));
        VALID_TRANSITIONS.put(WorkOrderStatus.ON_HOLD, Set.of(WorkOrderStatus.IN_PROGRESS));
        VALID_TRANSITIONS.put(WorkOrderStatus.COMPLETED, Set.of(WorkOrderStatus.CLOSED));
        VALID_TRANSITIONS.put(WorkOrderStatus.CLOSED, Set.of());
    }

    private final WorkOrderRepository workOrderRepository;
    private final WorkOrderStatusHistoryRepository historyRepository;
    private final CustomerRepository customerRepository;
    private final SiteRepository siteRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SlaService slaService;
    private final CurrentUserService currentUserService;

    public WorkOrderService(WorkOrderRepository workOrderRepository,
                            WorkOrderStatusHistoryRepository historyRepository,
                            CustomerRepository customerRepository,
                            SiteRepository siteRepository,
                            UserRepository userRepository,
                            NotificationService notificationService,
                            SlaService slaService,
                            CurrentUserService currentUserService) {
        this.workOrderRepository = workOrderRepository;
        this.historyRepository = historyRepository;
        this.customerRepository = customerRepository;
        this.siteRepository = siteRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.slaService = slaService;
        this.currentUserService = currentUserService;
    }

    // ------------------------------------------------------------------
    // Read operations
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public WorkOrderResponse get(Long id) {
        WorkOrder workOrder = requireAccessibleWorkOrder(id);
        return WorkOrderResponse.from(workOrder);
    }

    @Transactional(readOnly = true)
    public PageResponse<WorkOrderResponse> list(String search, WorkOrderStatus status,
                                                WorkOrderPriority priority, Long technicianId,
                                                Long customerId, Long siteId, Boolean slaBreached,
                                                int page, int size, String sort) {
        User current = currentUserService.getCurrentUser();
        Specification<WorkOrder> spec = buildSpecification(current, search, status, priority,
                technicianId, customerId, siteId, slaBreached);
        PageRequest pageable = buildPageRequest(page, size, sort);
        Page<WorkOrder> result = workOrderRepository.findAll(spec, pageable);
        return new PageResponse<>(
                result.getContent().stream().map(WorkOrderResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), result.isFirst(), result.isLast());
    }

    @Transactional(readOnly = true)
    public Map<WorkOrderStatus, List<WorkOrderCard>> kanban(String search, WorkOrderPriority priority,
                                                            Long technicianId, Long customerId,
                                                            Long siteId, Boolean slaBreached) {
        User current = currentUserService.getCurrentUser();
        Specification<WorkOrder> spec = buildSpecification(current, search, null, priority,
                technicianId, customerId, siteId, slaBreached);
        List<WorkOrder> workOrders = workOrderRepository.findAll(spec, Sort.by(Sort.Direction.ASC, "workOrderNumber"));
        Map<WorkOrderStatus, List<WorkOrderCard>> board = new EnumMap<>(WorkOrderStatus.class);
        for (WorkOrderStatus status : WorkOrderStatus.values()) {
            board.put(status, java.util.Collections.emptyList());
        }
        for (WorkOrder workOrder : workOrders) {
            List<WorkOrderCard> cards = new java.util.ArrayList<>(board.getOrDefault(workOrder.getStatus(), List.of()));
            cards.add(WorkOrderCard.from(workOrder));
            board.put(workOrder.getStatus(), cards);
        }
        return board;
    }

    @Transactional(readOnly = true)
    public List<WorkOrderHistoryResponse> history(Long id) {
        WorkOrder workOrder = requireAccessibleWorkOrder(id);
        return historyRepository.findByWorkOrderIdOrderByChangedAtDesc(workOrder.getId()).stream()
                .map(WorkOrderHistoryResponse::from).toList();
    }

    // ------------------------------------------------------------------
    // Write operations
    // ------------------------------------------------------------------

    @Transactional
    public WorkOrderResponse create(WorkOrderRequest request) {
        User current = currentUserService.getCurrentUser();
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Site site = siteRepository.findById(request.siteId())
                .orElseThrow(() -> new NotFoundException("Site not found"));

        if (current.getRole() == Role.CUSTOMER) {
            Customer own = ownCustomer();
            if (!own.getId().equals(customer.getId()) || !customer.getId().equals(site.getCustomer().getId())) {
                throw new ForbiddenException("You can only create work orders for your own sites");
            }
        } else if (current.getRole() == Role.TECHNICIAN) {
            throw new ForbiddenException("Technicians cannot create work orders");
        }
        if (!customer.getId().equals(site.getCustomer().getId())) {
            throw new BadRequestException("The selected site does not belong to the selected customer");
        }

        WorkOrder workOrder = new WorkOrder();
        workOrder.setCustomer(customer);
        workOrder.setSite(site);
        workOrder.setTitle(request.title());
        workOrder.setDescription(request.description());
        workOrder.setPriority(request.priority());
        workOrder.setStatus(WorkOrderStatus.NEW);
        workOrder.setCreatedBy(current);
        workOrder.setScheduledStart(request.scheduledStart());
        workOrder.setScheduledEnd(request.scheduledEnd());
        LocalDateTime now = LocalDateTime.now();
        workOrder.setSlaDueAt(slaService.computeDueDate(request.priority(), now));
        workOrder.setWorkOrderNumber("WO-" + String.format("%06d", workOrderRepository.nextWorkOrderNumberValue()));
        WorkOrder finalSaved = workOrderRepository.save(workOrder);

        recordHistory(finalSaved, null, WorkOrderStatus.NEW, current,
                request.description() != null && !request.description().isBlank()
                        ? "Created: " + abbreviate(request.description()) : "Work order created");

        autoAssign(finalSaved, current);

        if (current.getRole() != Role.CUSTOMER) {
            User portalUser = customer.getUser();
            if (portalUser != null) {
                notificationService.notify(portalUser, "New work order",
                        "A new work order " + finalSaved.getWorkOrderNumber()
                                + " has been created for your account.", NotificationType.INFO);
            }
        }
        return WorkOrderResponse.from(finalSaved);
    }

    private void autoAssign(WorkOrder workOrder, User creator) {
        List<User> technicians = userRepository.findByRole(Role.TECHNICIAN)
                .stream().filter(User::isEnabled).toList();
        if (technicians.isEmpty()) {
            return;
        }
        List<WorkOrderStatus> closed = List.of(WorkOrderStatus.CLOSED);
        User best = technicians.stream()
                .min(Comparator.comparingLong(t ->
                        workOrderRepository.countByAssignedTechnicianIdAndStatusNotIn(t.getId(), closed)))
                .orElse(technicians.get(0));

        WorkOrderStatus from = workOrder.getStatus();
        workOrder.setAssignedTechnician(best);
        if (from == WorkOrderStatus.NEW) {
            workOrder.setStatus(WorkOrderStatus.ASSIGNED);
        }
        workOrderRepository.save(workOrder);
        recordHistory(workOrder, from, workOrder.getStatus(), creator,
                "Auto-assigned to " + best.getFullName());
        notificationService.notify(best, "New assignment",
                workOrder.getWorkOrderNumber() + " (" + workOrder.getTitle()
                        + ") has been assigned to you.", NotificationType.ASSIGNMENT);
    }

    @Transactional
    public WorkOrderResponse update(Long id, WorkOrderRequest request) {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() != Role.DISPATCHER && current.getRole() != Role.MANAGER) {
            throw new ForbiddenException("Only dispatchers and managers can update work orders");
        }
        WorkOrder workOrder = workOrderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        Site site = siteRepository.findById(request.siteId())
                .orElseThrow(() -> new NotFoundException("Site not found"));
        if (!customer.getId().equals(site.getCustomer().getId())) {
            throw new BadRequestException("The selected site does not belong to the selected customer");
        }
        if (workOrder.getStatus() == WorkOrderStatus.CLOSED) {
            throw new BadRequestException("Closed work orders cannot be edited");
        }
        workOrder.setCustomer(customer);
        workOrder.setSite(site);
        workOrder.setTitle(request.title());
        workOrder.setDescription(request.description());
        workOrder.setPriority(request.priority());
        workOrder.setScheduledStart(request.scheduledStart());
        workOrder.setScheduledEnd(request.scheduledEnd());
        if (workOrder.getSlaDueAt() == null) {
            workOrder.setSlaDueAt(slaService.computeDueDate(request.priority(), LocalDateTime.now()));
        }
        return WorkOrderResponse.from(workOrderRepository.save(workOrder));
    }

    @Transactional
    public WorkOrderResponse assign(Long id, AssignRequest request) {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() != Role.DISPATCHER && current.getRole() != Role.MANAGER) {
            throw new ForbiddenException("Only dispatchers and managers can assign technicians");
        }
        WorkOrder workOrder = workOrderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        if (workOrder.getStatus() == WorkOrderStatus.CLOSED) {
            throw new BadRequestException("Closed work orders cannot be reassigned");
        }
        User technician = userRepository.findById(request.technicianId())
                .filter(u -> u.getRole() == Role.TECHNICIAN && u.isEnabled())
                .orElseThrow(() -> new NotFoundException("Technician not found"));

        WorkOrderStatus previousStatus = workOrder.getStatus();
        workOrder.setAssignedTechnician(technician);
        if (previousStatus == WorkOrderStatus.NEW) {
            workOrder.setStatus(WorkOrderStatus.ASSIGNED);
        }
        workOrderRepository.save(workOrder);
        String note = "Assigned to " + technician.getFullName();
        if (previousStatus == WorkOrderStatus.NEW) {
            recordHistory(workOrder, WorkOrderStatus.NEW, WorkOrderStatus.ASSIGNED, current,
                    request.note() != null ? note + ". " + request.note() : note);
        } else {
            recordHistory(workOrder, WorkOrderStatus.ASSIGNED, WorkOrderStatus.ASSIGNED, current,
                    request.note() != null ? note + ". " + request.note() : note);
        }
        notificationService.notify(technician, "New assignment",
                workOrder.getWorkOrderNumber() + " (" + workOrder.getTitle() + ") has been assigned to you.",
                NotificationType.ASSIGNMENT);
        return WorkOrderResponse.from(workOrder);
    }

    @Transactional
    public WorkOrderResponse changeStatus(Long id, StatusChangeRequest request) {
        User current = currentUserService.getCurrentUser();
        WorkOrder workOrder = workOrderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        WorkOrderStatus target = request.status();

        if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot change work order status");
        }
        if (target == workOrder.getStatus()) {
            throw new BadRequestException("Work order is already " + target);
        }
        if (!VALID_TRANSITIONS.getOrDefault(workOrder.getStatus(), Set.of()).contains(target)) {
            throw new BadRequestException("Invalid transition from " + workOrder.getStatus()
                    + " to " + target);
        }

        boolean isDispatcherManager = current.getRole() == Role.DISPATCHER
                || current.getRole() == Role.MANAGER;
        if (current.getRole() == Role.TECHNICIAN) {
            if (workOrder.getAssignedTechnician() == null
                    || !workOrder.getAssignedTechnician().getId().equals(current.getId())) {
                throw new ForbiddenException("You can only update status on work orders assigned to you");
            }
            if (!TECHNICIAN_TRANSITIONS.contains(target)) {
                throw new ForbiddenException("Technicians cannot move work orders to " + target);
            }
            if (target == WorkOrderStatus.IN_PROGRESS
                    && workOrder.getStatus() != WorkOrderStatus.ASSIGNED
                    && workOrder.getStatus() != WorkOrderStatus.ON_HOLD) {
                throw new BadRequestException("Work order must be ASSIGNED or ON_HOLD to start work");
            }
        }
        if (!isDispatcherManager && current.getRole() != Role.TECHNICIAN) {
            throw new ForbiddenException("You do not have permission to change work order status");
        }

        WorkOrderStatus from = workOrder.getStatus();
        applyTransitionSideEffects(workOrder, target);
        workOrder.setStatus(target);
        if (target == WorkOrderStatus.CLOSED) {
            workOrder.setClosedAt(Instant.now());
        }
        WorkOrder saved = workOrderRepository.save(workOrder);
        recordHistory(saved, from, target, current,
                StringUtils.hasText(request.note()) ? request.note() : null);
        notifyStatusChange(saved, from, target, current);
        return WorkOrderResponse.from(saved);
    }

    private void applyTransitionSideEffects(WorkOrder workOrder, WorkOrderStatus target) {
        LocalDateTime now = LocalDateTime.now();
        if (target == WorkOrderStatus.IN_PROGRESS && workOrder.getActualStart() == null) {
            workOrder.setActualStart(now);
        }
        if (target == WorkOrderStatus.COMPLETED && workOrder.getActualEnd() == null) {
            workOrder.setActualEnd(now);
        }
    }

    private void notifyStatusChange(WorkOrder workOrder, WorkOrderStatus from,
                                    WorkOrderStatus to, User actor) {
        String title = "Status change";
        String message = workOrder.getWorkOrderNumber() + " (" + workOrder.getTitle()
                + ") moved from " + from + " to " + to + ".";
        List<User> recipients = new java.util.ArrayList<>();
        userRepository.findByRole(Role.DISPATCHER).forEach(recipients::add);
        if (workOrder.getAssignedTechnician() != null) {
            recipients.add(workOrder.getAssignedTechnician());
        }
        if (workOrder.getCustomer().getUser() != null) {
            recipients.add(workOrder.getCustomer().getUser());
        }
        recipients.stream()
                .filter(u -> !u.getId().equals(actor.getId()))
                .distinct()
                .forEach(u -> notificationService.notify(u, title, message,
                        to == WorkOrderStatus.CLOSED ? NotificationType.SYSTEM : NotificationType.STATUS_CHANGE));
    }

    private void recordHistory(WorkOrder workOrder, WorkOrderStatus from, WorkOrderStatus to,
                               User changedBy, String note) {
        historyRepository.save(WorkOrderStatusHistory.of(workOrder, from, to, changedBy, note));
    }

    // ------------------------------------------------------------------
    // Scoping / spec helpers
    // ------------------------------------------------------------------

    private WorkOrder requireAccessibleWorkOrder(Long id) {
        WorkOrder workOrder = workOrderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work order not found"));
        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.TECHNICIAN
                && (workOrder.getAssignedTechnician() == null
                || !workOrder.getAssignedTechnician().getId().equals(current.getId()))) {
            throw new ForbiddenException("You can only access work orders assigned to you");
        }
        if (current.getRole() == Role.CUSTOMER) {
            Customer own = ownCustomer();
            if (!workOrder.getCustomer().getId().equals(own.getId())) {
                throw new ForbiddenException("You can only access your own work orders");
            }
        }
        return workOrder;
    }

    private Customer ownCustomer() {
        return customerRepository.findByUserId(currentUserService.getCurrentUserId())
                .orElseThrow(() -> new NotFoundException("No customer profile linked to your account"));
    }

    private Specification<WorkOrder> buildSpecification(User current, String search,
                                                        WorkOrderStatus status,
                                                        WorkOrderPriority priority,
                                                        Long technicianId, Long customerId,
                                                        Long siteId, Boolean slaBreached) {
        Specification<WorkOrder> spec = (root, query, cb) -> cb.conjunction();

        if (StringUtils.hasText(search)) {
            String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), like),
                    cb.like(cb.lower(root.get("description")), like),
                    cb.like(cb.lower(root.get("workOrderNumber")), like)));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (priority != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("priority"), priority));
        }
        if (technicianId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("assignedTechnician").get("id"), technicianId));
        }
        if (customerId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("customer").get("id"), customerId));
        }
        if (siteId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("site").get("id"), siteId));
        }
        if (slaBreached != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("slaBreached"), slaBreached));
        }
        if (current.getRole() == Role.TECHNICIAN) {
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("assignedTechnician").get("id"), current.getId()));
        }
        if (current.getRole() == Role.CUSTOMER) {
            Customer own = ownCustomer();
            spec = spec.and((root, query, cb) ->
                    cb.equal(root.get("customer").get("id"), own.getId()));
        }
        return spec;
    }

    private PageRequest buildPageRequest(int page, int size, String sort) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        if (StringUtils.hasText(sort) && sort.contains(",")) {
            String[] parts = sort.split(",");
            String field = parts[0].trim();
            Sort.Direction direction = parts.length > 1
                    && "asc".equalsIgnoreCase(parts[1].trim()) ? Sort.Direction.ASC : Sort.Direction.DESC;
            if (ALLOWED_SORT_FIELDS.contains(field)) {
                return PageRequest.of(safePage, safeSize, Sort.by(direction, field));
            }
        }
        return PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private String abbreviate(String value) {
        return value.length() > 100 ? value.substring(0, 100) + "..." : value;
    }
}
