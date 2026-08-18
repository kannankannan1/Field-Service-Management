package com.keystone.fieldservice;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIntegrationTest extends IntegrationTestBase {

    @Test
    void loginReturnsJwtForValidManagerCredentials() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"manager1\",\"password\":\"Manager@123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.username").value("manager1"))
                .andExpect(jsonPath("$.user.role").value("MANAGER"));
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"manager1\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void loginRejectsUnknownUser() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"nobody\",\"password\":\"Manager@123\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointRejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsCurrentUserWithToken() throws Exception {
        String token = login("dispatcher1", "Dispatcher@123");
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("dispatcher1"))
                .andExpect(jsonPath("$.role").value("DISPATCHER"));
    }

    @Test
    void technicianUserCanLogin() throws Exception {
        String token = login("tech1", "Tech@123");
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TECHNICIAN"));
    }

    @Test
    void registerCreatesCustomerAndReturnsJwt() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newcustomer\",\"password\":\"Password@123\","
                                + "\"firstName\":\"New\",\"lastName\":\"Customer\","
                                + "\"email\":\"new.customer@keystone.test\",\"phone\":\"555-9999\","
                                + "\"role\":\"CUSTOMER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.username").value("newcustomer"))
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newcustomer\",\"password\":\"Password@123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("CUSTOMER"));
    }

    @Test
    void registerCreatesCustomerProfileAndDefaultSite() throws Exception {
        String body = "{\"username\":\"newwhsmith\",\"password\":\"Password@123\","
                + "\"firstName\":\"Sara\",\"lastName\":\"Smith\","
                + "\"email\":\"sara.smith@keystone.test\",\"phone\":\"555-0002\","
                + "\"role\":\"CUSTOMER\"}";

        var result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();

        mockMvc.perform(get("/api/customers?size=1").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].name").value("Sara Smith"))
                .andExpect(jsonPath("$.content[0].email").value("sara.smith@keystone.test"));

        mockMvc.perform(get("/api/sites").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Sara Smith - Main Office"));
    }

    @Test
    void registerRejectsDuplicateUsername() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"tech1\",\"password\":\"Password@123\","
                                + "\"firstName\":\"Dup\",\"lastName\":\"User\","
                                + "\"email\":\"dup.user@keystone.test\",\"role\":\"TECHNICIAN\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void registerRejectsManagerRole() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"wannaboss\",\"password\":\"Password@123\","
                                + "\"firstName\":\"Bad\",\"lastName\":\"Role\","
                                + "\"email\":\"bad.role@keystone.test\",\"role\":\"MANAGER\"}"))
                .andExpect(status().isBadRequest());
    }
}
