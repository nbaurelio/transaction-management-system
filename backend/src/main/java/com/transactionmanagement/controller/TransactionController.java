package com.transactionmanagement.controller;

import com.transactionmanagement.dto.TransactionRequest;
import com.transactionmanagement.dto.TransactionResponse;
import com.transactionmanagement.service.TransactionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** GET lists all transactions; POST adds one. */
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
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse addTransaction(@Valid @RequestBody TransactionRequest request) {
        return TransactionResponse.fromModel(transactionService.addTransaction(request));
    }
}
