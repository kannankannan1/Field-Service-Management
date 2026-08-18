package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Customer;
import com.keystone.fieldservice.domain.entity.Site;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.dto.site.SiteRequest;
import com.keystone.fieldservice.dto.site.SiteResponse;
import com.keystone.fieldservice.exception.ForbiddenException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.CustomerRepository;
import com.keystone.fieldservice.repository.SiteRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SiteService {

    private final SiteRepository siteRepository;
    private final CustomerRepository customerRepository;
    private final WorkOrderRepository workOrderRepository;
    private final CurrentUserService currentUserService;

    public SiteService(SiteRepository siteRepository,
                       CustomerRepository customerRepository,
                       WorkOrderRepository workOrderRepository,
                       CurrentUserService currentUserService) {
        this.siteRepository = siteRepository;
        this.customerRepository = customerRepository;
        this.workOrderRepository = workOrderRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public List<SiteResponse> list(Long customerId) {
        User current = currentUserService.getCurrentUser();
        Long effectiveCustomerId = customerId;
        if (current.getRole() == Role.CUSTOMER) {
            Customer own = customerRepository.findByUserId(current.getId())
                    .orElseThrow(() -> new NotFoundException("No customer profile linked to your account"));
            if (customerId != null && !own.getId().equals(customerId)) {
                throw new ForbiddenException("You cannot access this customer's sites");
            }
            effectiveCustomerId = own.getId();
        }
        if (effectiveCustomerId == null) {
            return siteRepository.findAll().stream().map(SiteResponse::from).toList();
        }
        return siteRepository.findByCustomerId(effectiveCustomerId).stream()
                .map(SiteResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SiteResponse get(Long id) {
        Site site = siteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Site not found"));
        checkCustomerAccess(site);
        return SiteResponse.from(site);
    }

    @Transactional
    public SiteResponse create(SiteRequest request) {
        Customer customer = requireManageCustomer(request.customerId());
        Site site = new Site();
        site.setCustomer(customer);
        apply(site, request);
        return SiteResponse.from(siteRepository.save(site));
    }

    @Transactional
    public SiteResponse update(Long id, SiteRequest request) {
        Site site = siteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Site not found"));
        Customer customer = requireManageCustomer(request.customerId());
        site.setCustomer(customer);
        apply(site, request);
        return SiteResponse.from(siteRepository.save(site));
    }

    @Transactional
    public void delete(Long id) {
        Site site = siteRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Site not found"));
        requireManageCustomer(site.getCustomer().getId());
        if (hasWorkOrders(site.getId())) {
            throw new com.keystone.fieldservice.exception.ConflictException(
                    "Site has work orders and cannot be deleted");
        }
        siteRepository.delete(site);
    }

    private void apply(Site site, SiteRequest request) {
        site.setName(request.name());
        site.setStreetAddress(request.streetAddress());
        site.setCity(request.city());
        site.setState(request.state());
        site.setZip(request.zip());
        site.setCountry(request.country());
        site.setContactName(request.contactName());
        site.setContactPhone(request.contactPhone());
        site.setNotes(request.notes());
    }

    private Customer requireManageCustomer(Long customerId) {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.CUSTOMER) {
            throw new ForbiddenException("Customers cannot manage sites");
        }
        return customerRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found"));
    }

    private void checkCustomerAccess(Site site) {
        User current = currentUserService.getCurrentUser();
        if (current.getRole() == Role.CUSTOMER) {
            Customer own = customerRepository.findByUserId(current.getId())
                    .orElseThrow(() -> new NotFoundException("No customer profile linked to your account"));
            if (!own.getId().equals(site.getCustomer().getId())) {
                throw new ForbiddenException("You cannot access this site");
            }
        }
    }

    private boolean hasWorkOrders(Long siteId) {
        return workOrderRepository.exists((root, query, cb) ->
                cb.equal(root.get("site").get("id"), siteId));
    }
}
