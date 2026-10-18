package com.transactionmanagement.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Body of POST /transactions. Status isn't included: the server assigns it.
 * Date and amount are typed, so malformed values are rejected while parsing.
 */
public class TransactionRequest {

    @NotNull(message = "transactionDate is required")
    @PastOrPresent(message = "transactionDate can't be in the future")
    private LocalDate transactionDate;

    @NotBlank(message = "accountNumber is required")
    @Pattern(
            regexp = "\\d{4}-\\d{4}-\\d{4}|\\d{12}",
            message = "accountNumber must be a 12-digit number, formatted as XXXX-XXXX-XXXX or 12 plain digits"
    )
    private String accountNumber;

    @NotBlank(message = "accountHolderName is required")
    @Pattern(
            regexp = "[A-Za-z]+( +[A-Za-z]+)*",
            message = "accountHolderName must contain only letters and spaces"
    )
    private String accountHolderName;

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "amount must be greater than zero")
    // Limits whole digits to 13; any number of decimals is allowed.
    @Digits(integer = 13, fraction = Integer.MAX_VALUE, message = "amount must have at most 13 digits before the decimal point")
    private BigDecimal amount;

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getAccountHolderName() {
        return accountHolderName;
    }

    public void setAccountHolderName(String accountHolderName) {
        this.accountHolderName = accountHolderName;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
