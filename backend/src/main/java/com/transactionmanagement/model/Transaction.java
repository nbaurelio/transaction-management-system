package com.transactionmanagement.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One row of the CSV file. Immutable. */
public class Transaction {

    private final LocalDate transactionDate;
    private final String accountNumber;
    private final String accountHolderName;
    private final BigDecimal amount;
    private final TransactionStatus status;

    public Transaction(LocalDate transactionDate, String accountNumber, String accountHolderName,
                       BigDecimal amount, TransactionStatus status) {
        this.transactionDate = transactionDate;
        this.accountNumber = accountNumber;
        this.accountHolderName = accountHolderName;
        this.amount = amount;
        this.status = status;
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

    public TransactionStatus getStatus() {
        return status;
    }
}
