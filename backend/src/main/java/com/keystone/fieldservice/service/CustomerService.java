package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Customer;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.dto.common.PageResponse;
import com.keystone.fieldservice.dto.customer.CustomerRequest;
import com.keystone.fieldservice.dto.customer.CustomerResponse;
import com.keystone.fieldservice.exception.BadRequestException;
import com.keystone.fieldservice.exception.ConflictException;
import com.keystone.fieldservice.exception.ForbiddenException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.CustomerRepository;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final WorkOrderRepository workOrderRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;

    public CustomerService(CustomerRepository customerRepository,
                           UserRepository userRepository,
                           WorkOrderRepository workOrderRepository,
                           PasswordEncoder passwordEncoder,
                           CurrentUserService currentUserService) {
        this.customerRepository = customerRepository;
        this.userRepository = userRepository;
        this.workOrderRepository = workOrderRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> list(String search, int page, int size) {
        User current = currentUserService.getCurrentUser();
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "name"));
        Page<Customer> result;
        if (current.getRole() == Role.CUSTOMER) {
            Customer own = customerRepository.findByUserId(current.getId())
                    .orElseThrow(() -> new NotFoundException("No customer profile linked to your account"));
            result = Page.empty(pageable);
            if (search == null || search.isBlank()
                    || own.getName().toLowerCase(Locale.ROOT).contains(search.toLowerCase(Locale.ROOT))) {
                result = new org.springframework.data.domain.PageImpl<>(java.util.List.of(own), pageable, 1);
            }
        } else if (search != null && !search.isBlank()) {
            result = customerRepository.findAll((root, query, cb) ->
                            cb.like(cb.lower(root.get("name")),
                                    "%" + search.toLowerCase(Locale.ROOT) + "%"), pageable);
        } else {
            result = customerRepository.findAll(pageable);
        }
        return new PageResponse<>(
                result.getContent().stream().map(CustomerResponse::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), result.isFirst(), result.isLast());
    }

    @Transactional(readOnly = true)
    public CustomerResponse get(Long id) {
        Customer customer = requireAccessibleCustomer(id);
        return CustomerResponse.from(customer);
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot create customer records");
        }
        if (customerRepository.existsByName(request.name())) {
            throw new ConflictException("A customer named '" + request.name() + "' already exists");
        }
        if (request.email() != null && !request.email().isBlank()
                && customerRepository.existsByEmail(request.email())) {
            throw new ConflictException("A customer with this email already exists");
        }
        Customer customer = new Customer(request.name(), request.contactName(),
                request.email(), request.phone(), request.address());

        if (request.portalUsername() != null && !request.portalUsername().isBlank()) {
            if (userRepository.existsByUsername(request.portalUsername())) {
                throw new ConflictException("Portal username already exists");
            }
            if (request.portalPassword() == null || request.portalPassword().isBlank()) {
                throw new BadRequestException("Portal password is required when creating a portal account");
            }
            User portalUser = new User(request.portalUsername(),
                    passwordEncoder.encode(request.portalPassword()),
                    request.contactName() != null ? firstWord(request.contactName()) : request.name(),
                    request.contactName() != null ? lastWord(request.contactName()) : "Customer",
                    request.email(), request.phone(), Role.CUSTOMER);
            userRepository.save(portalUser);
            customer.setUser(portalUser);
        }
        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public CustomerResponse update(Long id, CustomerRequest request) {
        User current = currentUserService.getCurrentUser();
        Customer customer = requireAccessibleCustomer(id);
        if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot modify their profile");
        }
        if (!customer.getName().equalsIgnoreCase(request.name())
                && customerRepository.existsByName(request.name())) {
            throw new ConflictException("A customer named '" + request.name() + "' already exists");
        }
        customer.setName(request.name());
        customer.setContactName(request.contactName());
        customer.setEmail(request.email());
        customer.setPhone(request.phone());
        customer.setAddress(request.address());
        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public void delete(Long id) {
        Customer customer = requireAccessibleCustomer(id);
        if (customer.getUser() != null) {
            throw new ConflictException(
                    "Customer has a linked portal account. Disable the user instead of deleting the customer.");
        }
        if (workOrderRepository.exists((root, query, cb) ->
                cb.equal(root.get("customer").get("id"), id))) {
            throw new ConflictException("Customer has work orders and cannot be deleted");
        }
        customerRepository.delete(customer);
    }

    private Customer requireAccessibleCustomer(Long id) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.CUSTOMER
                && (customer.getUser() == null || !customer.getUser().getId().equals(current.getId()))) {
            throw new ForbiddenException("You cannot access this customer");
        }
        return customer;
    }

    private String firstWord(String value) {
        return value.trim().split("\\s+")[0];
    }

    private String lastWord(String value) {
        String[] words = value.trim().split("\\s+");
        return words.length > 1 ? words[words.length - 1] : "";
    }
}
