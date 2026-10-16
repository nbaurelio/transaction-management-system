package com.transactionmanagement.exception;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.transactionmanagement.dto.ApiError;
import com.transactionmanagement.service.TransactionService.TransactionStorageException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<String> details = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), "Validation failed", details);
        return ResponseEntity.badRequest().body(body);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ApiError body = new ApiError(HttpStatus.BAD_REQUEST.value(), describeParseFailure(ex), List.of());
        return ResponseEntity.badRequest().body(body);
    }

    /**
     * Gives a specific message for the two Consistency-critical fields
     * (transactionDate, amount) when their JSON value doesn't fit the type
     * Jackson expects, instead of a generic "malformed body" for everything.
     */
    private String describeParseFailure(HttpMessageNotReadableException ex) {
        if (ex.getCause() instanceof InvalidFormatException ife) {
            if (ife.getTargetType() == LocalDate.class) {
                return "transactionDate must be in YYYY-MM-DD format";
            }
            if (ife.getTargetType() == BigDecimal.class) {
                return "amount must be a valid decimal number";
            }
        }
        return "Malformed request body";
    }

    @ExceptionHandler(TransactionStorageException.class)
    public ResponseEntity<ApiError> handleStorageException(TransactionStorageException ex) {
        ApiError body = new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Unable to access transaction data: " + ex.getMessage(),
                List.of()
        );
        return ResponseEntity.internalServerError().body(body);
    }
}
