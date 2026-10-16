package com.transactionmanagement.model;

/**
 * Status of a transaction, as stored in the CSV file (column value matches
 * {@link #label}, not the Java enum constant name).
 */
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
