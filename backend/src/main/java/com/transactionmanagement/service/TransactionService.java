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
 * Reads and writes {@code transactions.csv}. Since a flat file has none of a
 * real database's transactional guarantees, this class enforces them by hand:
 *
 * <ul>
 *   <li><b>Atomicity</b> — a new row is fully formatted in memory ({@link #toCsvLine})
 *       before anything touches disk, and appended with a single {@code write()}
 *       call ({@link #appendLineAtomically}). A crash before that call leaves the
 *       file untouched; a crash after it either way never leaves a half-written row.</li>
 *   <li><b>Consistency</b> — {@link TransactionRequest}'s bean-validation annotations
 *       (checked before this class is ever called) plus {@link TransactionStatus}
 *       being a closed enum mean only well-formed rows can be written. Reading back
 *       a row that still fails to parse (e.g. a hand-edited CSV) raises a clear
 *       {@link TransactionStorageException} instead of a corrupt in-memory result.</li>
 *   <li><b>Isolation</b> — {@code synchronized} serializes concurrent calls within
 *       this process, and an OS-level {@link FileLock} (exclusive for writes, shared
 *       for reads) does the same across processes, so two simultaneous
 *       "Add Transaction" clicks can never interleave or overwrite each other.</li>
 *   <li><b>Durability</b> — {@link FileChannel#force(boolean)} forces the written
 *       bytes to physical disk before {@link #addTransaction} returns, so a 200
 *       response is only ever sent after the row is actually persisted.</li>
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

    /**
     * Reads every transaction currently stored in the CSV file.
     */
    public synchronized List<Transaction> getAllTransactions() {
        ensureFileExists();

        String content = readFileWithSharedLock();
        List<Transaction> transactions = new ArrayList<>();
        try (CSVReader reader = new CSVReader(new StringReader(content))) {
            String[] row;
            boolean isHeaderRow = true;
            int lineNumber = 1;
            while ((row = reader.readNext()) != null) {
                lineNumber++;
                if (isHeaderRow) {
                    isHeaderRow = false;
                    continue;
                }
                if (row.length < 5) {
                    continue;
                }
                transactions.add(toTransaction(row, lineNumber));
            }
        } catch (IOException | CsvValidationException e) {
            throw new TransactionStorageException("Failed to parse transactions CSV file", e);
        }
        return transactions;
    }

    /**
     * Appends a new transaction to the CSV file with a randomly assigned
     * status, and returns the stored transaction. See the class Javadoc for
     * how this satisfies atomicity, isolation and durability.
     */
    public synchronized Transaction addTransaction(TransactionRequest request) {
        ensureFileExists();

        Transaction transaction = new Transaction(
                request.getTransactionDate(),
                normalizeAccountNumber(request.getAccountNumber()),
                request.getAccountHolderName().trim(),
                request.getAmount(),
                randomStatus()
        );

        // Atomicity: the row is fully built in memory before anything is written.
        String line = toCsvLine(toRow(transaction));

        // Isolation + Atomicity + Durability: single locked write, fsynced to disk.
        appendLineAtomically(line);

        return transaction;
    }

    private TransactionStatus randomStatus() {
        TransactionStatus[] statuses = TransactionStatus.values();
        return statuses[random.nextInt(statuses.length)];
    }

    /**
     * Client-supplied account numbers may arrive as either "XXXX-XXXX-XXXX" or
     * 12 raw digits (both accepted by {@code TransactionRequest}'s pattern);
     * this normalizes either into the canonical hyphenated form so the CSV
     * never ends up with two different representations of the same shape.
     */
    private String normalizeAccountNumber(String raw) {
        String digits = raw.replaceAll("\\D", "");
        return digits.replaceAll("(\\d{4})(?=\\d)", "$1-");
    }

    private Transaction toTransaction(String[] row, int lineNumber) {
        try {
            LocalDate date = LocalDate.parse(row[0].trim());
            String accountNumber = row[1].trim();
            String accountHolderName = row[2].trim();
            BigDecimal amount = new BigDecimal(row[3].trim());
            TransactionStatus status = TransactionStatus.fromLabel(row[4].trim());
            return new Transaction(date, accountNumber, accountHolderName, amount, status);
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

    /** Formats a single CSV row as a complete, self-contained string (header included). */
    private String toCsvLine(String[] row) {
        StringWriter buffer = new StringWriter();
        try (CSVWriter writer = new CSVWriter(buffer)) {
            // applyQuotesToAll=false: only quote a field if it actually needs it
            // (e.g. contains a comma), matching the plain, unquoted sample CSV format.
            writer.writeNext(row, false);
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to format CSV row", e);
        }
        return buffer.toString();
    }

    /**
     * Appends an already-fully-formed line to the CSV file under an exclusive
     * OS-level lock, as one {@code write()} call, then fsyncs before returning.
     * This is where isolation, atomicity and durability actually happen.
     */
    private void appendLineAtomically(String line) {
        byte[] bytes = line.getBytes(StandardCharsets.UTF_8);
        try (FileChannel channel = FileChannel.open(
                csvPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND)) {
            try (FileLock ignored = channel.lock()) {
                ByteBuffer src = ByteBuffer.wrap(bytes);
                while (src.hasRemaining()) {
                    channel.write(src);
                }
                channel.force(true);
            }
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to write transaction to CSV file", e);
        }
    }

    /** Reads the whole file under a shared OS-level lock, so it never sees a write mid-flight. */
    private String readFileWithSharedLock() {
        try (FileChannel channel = FileChannel.open(csvPath, StandardOpenOption.READ)) {
            try (FileLock ignored = channel.lock(0, Long.MAX_VALUE, true)) {
                ByteBuffer buffer = ByteBuffer.allocate((int) channel.size());
                while (buffer.hasRemaining() && channel.read(buffer) != -1) {
                    // keep reading until the buffer is full or EOF
                }
                buffer.flip();
                return StandardCharsets.UTF_8.decode(buffer).toString();
            }
        } catch (IOException e) {
            throw new TransactionStorageException("Failed to read transactions CSV file", e);
        }
    }

    private void ensureFileExists() {
        try {
            if (csvPath.getParent() != null) {
                Files.createDirectories(csvPath.getParent());
            }
            if (!Files.exists(csvPath)) {
                String headerLine = toCsvLine(CSV_HEADER);
                Files.write(csvPath, headerLine.getBytes(StandardCharsets.UTF_8),
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
