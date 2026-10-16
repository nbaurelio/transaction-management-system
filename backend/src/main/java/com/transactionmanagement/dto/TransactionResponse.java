package com.transactionmanagement.dto;

import com.transactionmanagement.model.Transaction;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Shape returned to clients. Status is serialized as its display label
 * ("Pending" / "Settled" / "Failed") so the frontend can use it directly.
 */
public class TransactionResponse {

    private LocalDate transactionDate;
    private String accountNumber;
    private String accountHolderName;
    private BigDecimal amount;
    private String status;

    public static TransactionResponse fromModel(Transaction transaction) {
        TransactionResponse response = new TransactionResponse();
        response.transactionDate = transaction.getTransactionDate();
        response.accountNumber = transaction.getAccountNumber();
        response.accountHolderName = transaction.getAccountHolderName();
        response.amount = transaction.getAmount();
        response.status = transaction.getStatus().getLabel();
        return response;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public String getAccountHolderName() {
        return accountHolderName;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getStatus() {
        return status;
    }
}
