package com.keystone.fieldservice.service;

import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;
import com.keystone.fieldservice.dto.user.UserResponse;
import com.keystone.fieldservice.exception.ConflictException;
import com.keystone.fieldservice.exception.NotFoundException;
import com.keystone.fieldservice.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listTechnicians() {
        return userRepository.findByRole(Role.TECHNICIAN).stream()
                .map(UserResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listStaff() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() != Role.CUSTOMER)
                .map(UserResponse::from).toList();
    }

    @Transactional
    public UserResponse createStaffUser(String username, String rawPassword, String firstName,
                                        String lastName, String email, String phone, Role role) {
        if (role == Role.CUSTOMER) {
            throw new com.keystone.fieldservice.exception.BadRequestException(
                    "Use the customer endpoint to create customer portal accounts");
        }
        if (userRepository.existsByUsername(username)) {
            throw new ConflictException("Username already exists");
        }
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email already exists");
        }
        User user = new User(username, passwordEncoder.encode(rawPassword),
                firstName, lastName, email, phone, role);
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse setEnabled(Long userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        user.setEnabled(enabled);
        return UserResponse.from(userRepository.save(user));
    }
}
