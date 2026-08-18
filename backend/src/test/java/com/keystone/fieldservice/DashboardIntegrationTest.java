package com.keystone.fieldservice;

import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardIntegrationTest extends IntegrationTestBase {

    @Test
    void managerGetsLiveMetrics() throws Exception {
        String manager = login("manager1", "Manager@123");
        mockMvc.perform(get("/api/dashboard/metrics")
                        .header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalWorkOrders").isNumber())
                .andExpect(jsonPath("$.openWorkOrders").isNumber())
                .andExpect(jsonPath("$.byStatus.NEW").isNumber())
                .andExpect(jsonPath("$.technicians").isArray())
                .andExpect(jsonPath("$.recentActivity").isArray());
    }

    @Test
    void technicianCannotAccessDashboard() throws Exception {
        String tech1 = login("tech1", "Tech@123");
        mockMvc.perform(get("/api/dashboard/metrics")
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isForbidden());
    }
}
