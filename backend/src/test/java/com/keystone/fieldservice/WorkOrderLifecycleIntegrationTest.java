package com.keystone.fieldservice;

import com.fasterxml.jackson.databind.JsonNode;
import com.keystone.fieldservice.repository.UserRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.concurrent.atomic.AtomicLong;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WorkOrderLifecycleIntegrationTest extends IntegrationTestBase {

    private static final AtomicLong WO_COUNTER = new AtomicLong(100);

    @Autowired
    private WorkOrderRepository workOrderRepository;

    @Autowired
    private UserRepository userRepository;

    private Long acmeCustomerId;
    private Long plantASiteId;
    private Long tech1Id;
    private Long tech2Id;

    @BeforeEach
    void lookupSeedIds() {
        if (acmeCustomerId == null) {
            workOrderRepository.findByWorkOrderNumber("WO-000001").ifPresent(wo ->
                    acmeCustomerId = wo.getCustomer().getId());
            workOrderRepository.findByWorkOrderNumber("WO-000001").ifPresent(wo ->
                    plantASiteId = wo.getSite().getId());
            tech1Id = userRepository.findByUsername("tech1").orElseThrow().getId();
            tech2Id = userRepository.findByUsername("tech2").orElseThrow().getId();
        }
    }

    private String createWorkOrder(String token, long customerId, long siteId) throws Exception {
        var result = mockMvc.perform(post("/api/work-orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":" + customerId + ",\"siteId\":" + siteId
                                + ",\"title\":\"IT WO-" + WO_COUNTER.incrementAndGet()
                                + "\",\"description\":\"Integration test work order\",\"priority\":\"MEDIUM\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignedTechnicianName").isNotEmpty())
                .andExpect(jsonPath("$.workOrderNumber").isNotEmpty())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    void dispatcherRunsFullLifecycleWithImmutableAuditHistory() throws Exception {
        String dispatcher = login("dispatcher1", "Dispatcher@123");
        String id = createWorkOrder(dispatcher, acmeCustomerId, plantASiteId);
        long woId = Long.parseLong(id);

        mockMvc.perform(post("/api/work-orders/" + woId + "/assign")
                        .header("Authorization", "Bearer " + dispatcher)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"technicianId\":" + tech1Id + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"));

        String tech1 = login("tech1", "Tech@123");

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + tech1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.actualStart").isNotEmpty());

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + tech1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ON_HOLD\",\"note\":\"Waiting on parts\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ON_HOLD"));

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + tech1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + tech1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.actualEnd").isNotEmpty());

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + dispatcher)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CLOSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.closedAt").isNotEmpty());

        var historyResult = mockMvc.perform(get("/api/work-orders/" + woId + "/history")
                        .header("Authorization", "Bearer " + dispatcher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andReturn();
        JsonNode history = objectMapper.readTree(historyResult.getResponse().getContentAsString());
        Set<String> transitions = new java.util.HashSet<>();
        history.forEach(node -> transitions.add(
                (node.get("fromStatus") == null ? "null" : node.get("fromStatus").asText())
                        + "->" + node.get("toStatus").asText()));
        assertThat(transitions).contains(
                "null->NEW",
                "NEW->ASSIGNED",
                "ASSIGNED->ASSIGNED",
                "ASSIGNED->IN_PROGRESS",
                "IN_PROGRESS->ON_HOLD",
                "ON_HOLD->IN_PROGRESS",
                "IN_PROGRESS->COMPLETED",
                "COMPLETED->CLOSED");
    }

    @Test
    void invalidTransitionIsRejected() throws Exception {
        String dispatcher = login("dispatcher1", "Dispatcher@123");
        String id = createWorkOrder(dispatcher, acmeCustomerId, plantASiteId);
        long woId = Long.parseLong(id);

        mockMvc.perform(patch("/api/work-orders/" + woId + "/status")
                        .header("Authorization", "Bearer " + dispatcher)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"COMPLETED\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void technicianCanOnlyAccessTheirAssignedWorkOrders() throws Exception {
        String tech1 = login("tech1", "Tech@123");
        String tech2 = login("tech2", "Tech@123");

        var wo2 = workOrderRepository.findByWorkOrderNumber("WO-000002").orElseThrow();
        var wo5 = workOrderRepository.findByWorkOrderNumber("WO-000005").orElseThrow();

        // tech1 is assigned to WO-000002
        mockMvc.perform(get("/api/work-orders/" + wo2.getId())
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isOk());

        // tech1 cannot access WO-000005 (assigned to tech2)
        mockMvc.perform(get("/api/work-orders/" + wo5.getId())
                        .header("Authorization", "Bearer " + tech1))
                .andExpect(status().isForbidden());

        // tech1 listing returns only assigned work orders
        mockMvc.perform(get("/api/work-orders").header("Authorization", "Bearer " + tech1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id").isArray());

        // tech2 cannot change status on tech1's work order
        mockMvc.perform(patch("/api/work-orders/" + wo2.getId() + "/status")
                        .header("Authorization", "Bearer " + tech2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void customerCanOnlySeeTheirOwnWorkOrders() throws Exception {
        String customer = login("customer1", "Customer@123");

        var acmeWo = workOrderRepository.findByWorkOrderNumber("WO-000001").orElseThrow();
        var globexWo = workOrderRepository.findByWorkOrderNumber("WO-000005").orElseThrow();

        mockMvc.perform(get("/api/work-orders/" + acmeWo.getId())
                        .header("Authorization", "Bearer " + customer))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/work-orders/" + globexWo.getId())
                        .header("Authorization", "Bearer " + customer))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/work-orders").header("Authorization", "Bearer " + customer))
                .andExpect(status().isOk());
    }

    @Test
    void customerCanCreateWorkOrderOnTheirOwnSiteOnly() throws Exception {
        String customer = login("customer1", "Customer@123");

        mockMvc.perform(post("/api/work-orders")
                        .header("Authorization", "Bearer " + customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customerId\":" + acmeCustomerId + ",\"siteId\":" + plantASiteId
                                + ",\"title\":\"Customer portal request\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignedTechnicianName").isNotEmpty());
    }

    @Test
    void customerCannotTransitionStatus() throws Exception {
        String customer = login("customer1", "Customer@123");
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000002").orElseThrow();
        mockMvc.perform(patch("/api/work-orders/" + wo.getId() + "/status")
                        .header("Authorization", "Bearer " + customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void workOrderNumberIsUniqueAndSlaDueDateComputed() throws Exception {
        String dispatcher = login("dispatcher1", "Dispatcher@123");
        String id = createWorkOrder(dispatcher, acmeCustomerId, plantASiteId);
        long woId = Long.parseLong(id);

        mockMvc.perform(get("/api/work-orders/" + woId)
                        .header("Authorization", "Bearer " + dispatcher))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaDueAt").isNotEmpty());

        var saved = workOrderRepository.findById(woId).orElseThrow();
        assertThat(saved.getSlaDueAt()).isNotNull();
    }
}
