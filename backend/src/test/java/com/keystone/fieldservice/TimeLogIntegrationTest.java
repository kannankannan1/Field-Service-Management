package com.keystone.fieldservice;

import com.keystone.fieldservice.repository.WorkOrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TimeLogIntegrationTest extends IntegrationTestBase {

    @Autowired
    private WorkOrderRepository workOrderRepository;

    @Test
    void technicianStartsAndStopsTimer() throws Exception {
        String tech1 = login("tech1", "Tech@123");
        // WO-000002 is assigned to tech1 and has no running timer
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000002").orElseThrow();

        var start = mockMvc.perform(post("/api/work-orders/" + wo.getId() + "/time-logs/start")
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startTime").isNotEmpty())
                .andReturn();
        long timeLogId = objectMapper.readTree(start.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/time-logs/" + timeLogId + "/stop")
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.endTime").isNotEmpty())
                .andExpect(jsonPath("$.hoursWorked").isNumber());
    }

    @Test
    void technicianCannotLogTimeOnUnassignedWorkOrder() throws Exception {
        String tech1 = login("tech1", "Tech@123");
        // WO-000005 is assigned to tech2
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000005").orElseThrow();

        mockMvc.perform(post("/api/work-orders/" + wo.getId() + "/time-logs/start")
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isForbidden());
    }

    @Test
    void dispatcherSeesWorkOrderTimeLogs() throws Exception {
        String dispatcher = login("dispatcher1", "Dispatcher@123");
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000006").orElseThrow();

        mockMvc.perform(get("/api/work-orders/" + wo.getId() + "/time-logs")
                        .header("Authorization", "Bearer " + dispatcher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}
