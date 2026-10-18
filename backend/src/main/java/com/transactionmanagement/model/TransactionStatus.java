package com.transactionmanagement.model;

/** Transaction status. The label is what's stored in the CSV and sent to clients. */
public enum TransactionStatus {
    PENDING("Pending"),
    SETTLED("Settled"),
    FAILED("Failed");

    private final String label;

    TransactionStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static TransactionStatus fromLabel(String label) {
        for (TransactionStatus status : values()) {
            if (status.label.equalsIgnoreCase(label)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown transaction status: " + label);
    }
}
