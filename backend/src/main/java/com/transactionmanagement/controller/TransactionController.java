package com.transactionmanagement.controller;

import com.transactionmanagement.dto.TransactionRequest;
import com.transactionmanagement.dto.TransactionResponse;
import com.transactionmanagement.model.Transaction;
import com.transactionmanagement.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Thin HTTP layer over {@link TransactionService}: GET lists everything,
 * POST adds one row. All validation (@Valid) and business logic (status
 * assignment, CSV persistence) live below this layer — the controller's
 * only job is translating between HTTP and {@link TransactionRequest}/
 * {@link TransactionResponse}.
 */
@RestController
@RequestMapping("/transactions")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    public List<TransactionResponse> getAllTransactions() {
        return transactionService.getAllTransactions().stream()
                .map(TransactionResponse::fromModel)
                .toList();
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> addTransaction(@Valid @RequestBody TransactionRequest request) {
        Transaction created = transactionService.addTransaction(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(TransactionResponse.fromModel(created));
    }
}
