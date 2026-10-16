package com.transactionmanagement.controller;

import com.transactionmanagement.model.Transaction;
import com.transactionmanagement.model.TransactionStatus;
import com.transactionmanagement.service.TransactionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Consistency: the API must reject malformed payloads before they ever
 * reach the CSV file. TransactionService is mocked out here — these tests
 * are purely about what the controller lets through.
 */
@WebMvcTest(TransactionController.class)
class TransactionControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionService transactionService;

    @Test
    void rejectsNonIsoDateFormat() throws Exception {
        performPost("""
                {"transactionDate":"15-03-2025","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":10.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsCalendarInvalidDate() throws Exception {
        performPost("""
                {"transactionDate":"2025-02-30","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":10.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsNonNumericAmount() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":"abc"}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsNegativeAmount() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":-5.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsZeroAmount() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":0}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsFutureDate() throws Exception {
        String tomorrow = LocalDate.now().plusDays(1).toString();
        performPost("""
                {"transactionDate":"%s","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":10.00}
                """.formatted(tomorrow)).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAccountNumberWithLetters() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"abcd-5678-9012","accountHolderName":"Jane Doe","amount":10.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAccountNumberWithWrongDigitCount() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"123-456-789","accountHolderName":"Jane Doe","amount":10.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAccountHolderNameWithDigits() throws Exception {
        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane123","amount":10.00}
                """).andExpect(status().isBadRequest());
    }

    @Test
    void acceptsWellFormedPayload() throws Exception {
        when(transactionService.addTransaction(any())).thenReturn(new Transaction(
                LocalDate.of(2025, 3, 15), "1234-5678-9012", "Jane Doe",
                new BigDecimal("10.00"), TransactionStatus.PENDING));

        performPost("""
                {"transactionDate":"2025-03-15","accountNumber":"1234-5678-9012","accountHolderName":"Jane Doe","amount":10.00}
                """).andExpect(status().isCreated());
    }

    private org.springframework.test.web.servlet.ResultActions performPost(String json) throws Exception {
        return mockMvc.perform(post("/transactions").contentType(MediaType.APPLICATION_JSON).content(json));
    }
}
