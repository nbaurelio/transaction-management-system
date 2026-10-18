package com.transactionmanagement.dto;

import java.time.Instant;
import java.util.List;

/** Error body for any non-2xx response. */
public record ApiError(Instant timestamp, int status, String message, List<String> details) {

    public ApiError(int status, String message, List<String> details) {
        this(Instant.now(), status, message, details);
    }
}
