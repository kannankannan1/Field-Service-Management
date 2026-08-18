package com.keystone.fieldservice.security;

import com.keystone.fieldservice.domain.entity.User;
import com.keystone.fieldservice.domain.enums.Role;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private final JwtService jwtService =
            new JwtService("test-secret-key-that-is-at-least-32-bytes-long!", 3600000);

    @Test
    void generatesTokenThatCanBeParsedBack() {
        User user = new User("tech1", "x", "Jordan", "Lee", "j@t.test", "555", Role.TECHNICIAN);

        String token = jwtService.generateToken(user);

        assertThat(jwtService.isValid(token)).isTrue();
        assertThat(jwtService.extractUsername(token)).isEqualTo("tech1");
        assertThat(jwtService.extractRole(token)).isEqualTo(Role.TECHNICIAN);
    }

    @Test
    void rejectsGarbageToken() {
        assertThat(jwtService.isValid("not-a-token")).isFalse();
        assertThat(jwtService.isValid(null)).isFalse();
    }
}
