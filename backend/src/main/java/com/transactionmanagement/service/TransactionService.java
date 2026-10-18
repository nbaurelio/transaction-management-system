package com.transactionmanagement.service;

import com.opencsv.CSVReader;
import com.opencsv.CSVWriter;
import com.opencsv.exceptions.CsvValidationException;
import com.transactionmanagement.dto.TransactionRequest;
import com.transactionmanagement.model.Transaction;
import com.transactionmanagement.model.TransactionStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Reads and writes transactions.csv safely:
 * <ul>
 *   <li>Atomic: each row is built in memory, then appended in one write.</li>
 *   <li>Consistent: requests are validated first; unreadable rows raise an error.</li>
 *   <li>Isolated: {@code synchronized} plus an OS file lock (shared for reads, exclusive for writes).</li>
 *   <li>Durable: the write is flushed to disk before returning.</li>
 * </ul>
 */
@Service
public class TransactionService {

    private static final String[] CSV_HEADER = {
            "Transaction Date", "Account Number", "Account Holder Name", "Amount", "Status"
    };

    private final Path csvPath;
    private final Random random = new Random();

    public TransactionService(@Value("${transactions.csv.path}") String csvPath) {
        this.csvPath = Path.of(csvPath);
    }

    public synchronized List<Transaction> getAllTransactions() {
        ensureFileExists();
        List<Transaction> transactions = new ArrayList<>();
        try (CSVReader reader = new CSVReader(new StringReader(readFileWithSharedLock()))) {
            reader.skip(1); // header
            int lineNumber = 1;
            String[] row;
            while ((row = reader.readNext()) != null) {
                lineNumber++;
                if (row.length >= 5) {
                    transactions.add(toTransaction(row, lineNumber));
                }
            }
        } catch (IOException | CsvValidationException e) {
            throw new TransactionStorageException("Failed to parse transactions CSV file", e);
        }
        return transactions;
    }

    /** Appends a transaction with a random status and returns it. */
    public synchronized Transaction addTransaction(TransactionRequest request) {
        ensureFileExists();
        Transaction transaction = new Transaction(
                request.getTransactionDate(),
                normalizeAccountNumber(request.getAccountNumber()),
                request.getAccountHolderName().trim(),
                withAtLeastTwoDecimals(request.getAmount()),
                randomStatus()
        );
        appendLineAtomically(toCsvLine(toRow(transaction)));
        return transaction;
    }

    /** 121 -> 121.00 and 12.5 -> 12.50; extra decimals are kept, never rounded. */
    private BigDecimal withAtLeastTwoDecimals(BigDecimal amount) {
        return amount.scale() < 2 ? amount.setScale(2, RoundingMode.UNNECESSARY) : amount;
    }

    private TransactionStatus randomStatus() {
        TransactionStatus[] statuses = TransactionStatus.values();
        return statuses[random.nextInt(statuses.length)];
    }

    /** "111122223333" or "1111-2222-3333" -> "1111-2222-3333". */
    private String normalizeAccountNumber(String raw) {
        return raw.replaceAll("\\D", "").replaceAll("(\\d{4})(?=\\d)", "$1-");
    }

    private Transaction toTransaction(String[] row, int lineNumber) {
        try {
            return new Transaction(
                    LocalDate.parse(row[0].trim()),
                    row[1].trim(),
                    row[2].trim(),
                    new BigDecimal(row[3].trim()),
                    TransactionStatus.fromLabel(row[4].trim()));
        } catch (DateTimeParseException | IllegalArgumentException e) {
            throw new TransactionStorageException(
                    "Malformed transaction data at CSV line " + lineNumber + ": " + e.getMessage(), e);
        }
    }

    private String[] toRow(Transaction transaction) {
        return new String[]{
                transaction.getTransactionDate().toString(),
                transaction.getAccountNumber(),
                transaction.getAccountHolderName(),
                transaction.getAmount().toPlainString(),
                transaction.getStatus().getLabel()
        };
    }

    /** One CSV line; fields are quoted only when needed, like the sample file. */
    private String toCsvLine(String[] row) {
        StringWriter buffer = new StringWriter();
        try (CSVWriter writer = new CSVWriter(buffer)) {
            writer.writeNext(row, false);
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to format CSV row", e);
        }
        return buffer.toString();
    }

    /** Appends a full line under an exclusive lock in one write, then flushes to disk. */
    private void appendLineAtomically(String line) {
        ByteBuffer src = ByteBuffer.wrap(line.getBytes(StandardCharsets.UTF_8));
        try (FileChannel channel = FileChannel.open(
                csvPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND);
             FileLock ignored = channel.lock()) {
            while (src.hasRemaining()) {
                channel.write(src);
            }
            channel.force(true);
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to write transaction to CSV file", e);
        }
    }

    /** Reads the whole file under a shared lock, so a write is never seen half-done. */
    private String readFileWithSharedLock() {
        try (FileChannel channel = FileChannel.open(csvPath, StandardOpenOption.READ);
             FileLock ignored = channel.lock(0, Long.MAX_VALUE, true)) {
            ByteBuffer buffer = ByteBuffer.allocate((int) channel.size());
            while (buffer.hasRemaining() && channel.read(buffer) != -1) {
                // read until full or EOF
            }
            buffer.flip();
            return StandardCharsets.UTF_8.decode(buffer).toString();
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to read transactions CSV file", e);
        }
    }

    /** Creates the CSV with a header row if it doesn't exist yet. */
    private void ensureFileExists() {
        try {
            if (csvPath.getParent() != null) {
                Files.createDirectories(csvPath.getParent());
            }
            if (!Files.exists(csvPath)) {
                Files.write(csvPath, toCsvLine(CSV_HEADER).getBytes(StandardCharsets.UTF_8),
                        StandardOpenOption.CREATE, StandardOpenOption.WRITE);
            }
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to initialize transactions CSV file", e);
        }
    }

    public static class TransactionStorageException extends RuntimeException {
        public TransactionStorageException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
