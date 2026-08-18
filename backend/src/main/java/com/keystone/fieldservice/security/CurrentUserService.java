package com.keystone.fieldservice.security;

import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            throw new UnauthorizedException("Not authenticated");
        }
        return user;
    }

    public Long getCurrentUserId() {
        return getCurrentUser().getId();
    }
}
