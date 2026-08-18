package com.keystone.fieldservice;

import com.keystone.fieldservice.domain.entity.Part;
import com.keystone.fieldservice.repository.PartRepository;
import com.keystone.fieldservice.repository.StockMovementRepository;
import com.keystone.fieldservice.repository.WorkOrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StockIntegrationTest extends IntegrationTestBase {

    @Autowired
    private PartRepository partRepository;

    @Autowired
    private WorkOrderRepository workOrderRepository;

    @Autowired
    private StockMovementRepository stockMovementRepository;

    @Test
    void consumeDeductsStockAndRecordsMovement() throws Exception {
        String manager = login("manager1", "Manager@123");
        Part part = partRepository.findBySku("ELEC-CONT-100").orElseThrow();
        int initial = part.getQuantityOnHand();
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000001").orElseThrow();

        mockMvc.perform(post("/api/parts/work-orders/" + wo.getId() + "/consume")
                        .header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partId\":" + part.getId() + ",\"quantity\":3,\"note\":\"IT consume\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("OUTBOUND"))
                .andExpect(jsonPath("$.quantityChange").value(-3));

        Part after = partRepository.findById(part.getId()).orElseThrow();
        assertThat(after.getQuantityOnHand()).isEqualTo(initial - 3);
        assertThat(stockMovementRepository.findByWorkOrderIdOrderByCreatedAtDesc(wo.getId()))
                .anyMatch(m -> m.getPart().getId().equals(part.getId()) && m.getQuantityChange() == -3);
    }

    @Test
    void consumeMoreThanAvailableIsRejectedAndStockUnchanged() throws Exception {
        String manager = login("manager1", "Manager@123");
        Part part = partRepository.findBySku("PLMB-VLV-120").orElseThrow();
        int initial = part.getQuantityOnHand();
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000001").orElseThrow();

        mockMvc.perform(post("/api/parts/work-orders/" + wo.getId() + "/consume")
                        .header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partId\":" + part.getId() + ",\"quantity\":99999}"))
                .andExpect(status().isBadRequest());

        assertThat(partRepository.findById(part.getId()).orElseThrow().getQuantityOnHand())
                .isEqualTo(initial);
    }

    @Test
    void customerCannotConsumeParts() throws Exception {
        String customer = login("customer1", "Customer@123");
        Part part = partRepository.findBySku("ELEC-CONT-100").orElseThrow();
        var wo = workOrderRepository.findByWorkOrderNumber("WO-000001").orElseThrow();

        mockMvc.perform(post("/api/parts/work-orders/" + wo.getId() + "/consume")
                        .header("Authorization", "Bearer " + customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partId\":" + part.getId() + ",\"quantity\":1}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerAdjustsStock() throws Exception {
        String manager = login("manager1", "Manager@123");
        Part part = partRepository.findBySku("MISC-FLT-010").orElseThrow();
        int initial = part.getQuantityOnHand();

        mockMvc.perform(post("/api/parts/" + part.getId() + "/stock")
                        .header("Authorization", "Bearer " + manager)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"INBOUND\",\"quantity\":50,\"note\":\"restock\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantityChange").value(50));

        assertThat(partRepository.findById(part.getId()).orElseThrow().getQuantityOnHand())
                .isEqualTo(initial + 50);
    }
}
