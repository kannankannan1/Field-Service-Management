package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.Customer;
import com.keystone.fieldservice.domain.entity.Site;
import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.dto.auth.LoginRequest;
import com.keystone.fieldservice.dto.auth.LoginResponse;
import com.keystone.fieldservice.dto.auth.RegisterRequest;
import com.keystone.fieldservice.dto.user.UserResponse;
import com.keystone.fieldservice.exception.BadRequestException;
import com.keystone.fieldservice.exception.ConflictException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.CustomerRepository;
import com.keystone.fieldservice.repository.SiteRepository;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.security.CurrentUserService;
import com.keystone.fieldservice.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final SiteRepository siteRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;
    private final long expirationSeconds;

    public AuthService(AuthenticationManager authenticationManager, JwtService jwtService,
                       UserRepository userRepository, CustomerRepository customerRepository,
                       SiteRepository siteRepository, CurrentUserService currentUserService,
                       PasswordEncoder passwordEncoder,
                       @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.customerRepository = customerRepository;
        this.siteRepository = siteRepository;
        this.currentUserService = currentUserService;
        this.passwordEncoder = passwordEncoder;
        this.expirationSeconds = expirationMs / 1000;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        String username = authentication.getName();
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        String token = jwtService.generateToken(user);
        return new LoginResponse(token, "Bearer", expirationSeconds, UserResponse.from(user));
    }

    @Transactional(readOnly = true)
    public UserResponse me() {
        return UserResponse.from(currentUserService.getCurrentUser());
    }

    @Transactional
    public LoginResponse register(RegisterRequest request) {
        Role role = request.role();
        if (role != Role.CUSTOMER && role != Role.TECHNICIAN) {
            throw new BadRequestException("Public signup is only allowed for CUSTOMER or TECHNICIAN accounts");
        }
        if (userRepository.existsByUsername(request.username())) {
            throw new ConflictException("Username '" + request.username() + "' is already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("An account with email '" + request.email() + "' already exists");
        }
        User user = new User(
                request.username(),
                passwordEncoder.encode(request.password()),
                request.firstName(),
                request.lastName(),
                request.email(),
                request.phone(),
                role);
        userRepository.save(user);
        if (role == Role.CUSTOMER) {
            createCustomerProfile(user, request);
        }
        String token = jwtService.generateToken(user);
        return new LoginResponse(token, "Bearer", expirationSeconds, UserResponse.from(user));
    }

    private void createCustomerProfile(User user, RegisterRequest request) {
        String fullName = (request.firstName() + " " + request.lastName()).trim();
        String customerName = fullName;
        int suffix = 1;
        while (customerRepository.existsByName(customerName)) {
            customerName = fullName + " (" + user.getUsername() + ")";
            suffix++;
            if (suffix > 3) {
                customerName = user.getUsername();
                break;
            }
        }
        Customer customer = new Customer(customerName, fullName,
                request.email(), request.phone(), null);
        customer.setUser(user);
        customerRepository.save(customer);

        Site site = new Site();
        site.setCustomer(customer);
        site.setName(fullName + " - Main Office");
        site.setStreetAddress("Main Office");
        site.setCity("City");
        site.setContactName(fullName);
        site.setContactPhone(request.phone());
        siteRepository.save(site);
    }
}
