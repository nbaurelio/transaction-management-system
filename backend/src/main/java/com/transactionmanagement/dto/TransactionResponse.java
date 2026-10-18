package com.transactionmanagement.dto;

import com.transactionmanagement.model.Transaction;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Transaction as sent to clients; status is its label ("Pending", "Settled", "Failed"). */
public record TransactionResponse(
        LocalDate transactionDate,
        String accountNumber,
        String accountHolderName,
        BigDecimal amount,
        String status) {

    public static TransactionResponse fromModel(Transaction transaction) {
        return new TransactionResponse(
                transaction.getTransactionDate(),
                transaction.getAccountNumber(),
                transaction.getAccountHolderName(),
                transaction.getAmount(),
                transaction.getStatus().getLabel());
    }
}
