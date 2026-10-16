package com.transactionmanagement.dto;

import java.time.Instant;
import java.util.List;

/**
 * Standard error body returned for any non-2xx response.
 */
public class ApiError {

    private final Instant timestamp = Instant.now();
    private final int status;
    private final String message;
    private final List<String> details;

    public ApiError(int status, String message, List<String> details) {
        this.status = status;
        this.message = message;
        this.details = details;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public int getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }

    public List<String> getDetails() {
        return details;
    }
}
