package com.transactionmanagement.service;

import com.transactionmanagement.dto.TransactionRequest;
import com.transactionmanagement.model.Transaction;
import com.transactionmanagement.model.TransactionStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionServiceTest {

    @TempDir
    Path tempDir;

    private TransactionService newService() {
        return new TransactionService(tempDir.resolve("transactions.csv").toString());
    }

    @Test
    void getAllTransactions_returnsEmptyList_whenFileDoesNotExistYet() {
        TransactionService service = newService();

        List<Transaction> transactions = service.getAllTransactions();

        assertThat(transactions).isEmpty();
    }

    @Test
    void addTransaction_persistsAndIsReturnedByGetAll() {
        TransactionService service = newService();
        TransactionRequest request = new TransactionRequest();
        request.setTransactionDate(LocalDate.of(2025, 3, 20));
        request.setAccountNumber("9999-8888-7777");
        request.setAccountHolderName("Test User");
        request.setAmount(new BigDecimal("42.50"));

        Transaction created = service.addTransaction(request);

        assertThat(created.getStatus()).isIn((Object[]) TransactionStatus.values());

        List<Transaction> all = service.getAllTransactions();
        assertThat(all).hasSize(1);
        Transaction stored = all.get(0);
        assertThat(stored.getTransactionDate()).isEqualTo(LocalDate.of(2025, 3, 20));
        assertThat(stored.getAccountNumber()).isEqualTo("9999-8888-7777");
        assertThat(stored.getAccountHolderName()).isEqualTo("Test User");
        assertThat(stored.getAmount()).isEqualByComparingTo("42.50");
        assertThat(stored.getStatus()).isEqualTo(created.getStatus());
    }

    @Test
    void addTransaction_storesAmountWithTwoDecimalPlaces() throws Exception {
        TransactionService service = newService();
        TransactionRequest request = sampleRequest("3333-3333-3333", "Whole Amount");
        request.setAmount(new BigDecimal("121"));

        Transaction created = service.addTransaction(request);

        assertThat(created.getAmount().toPlainString()).isEqualTo("121.00");
        assertThat(Files.readString(tempDir.resolve("transactions.csv")))
                .contains("3333-3333-3333,Whole Amount,121.00,");
    }

    @Test
    void addTransaction_keepsExtraDecimalPlacesWithoutRounding() throws Exception {
        TransactionService service = newService();
        TransactionRequest request = sampleRequest("4444-4444-4444", "Precise Amount");
        request.setAmount(new BigDecimal("12.579"));

        Transaction created = service.addTransaction(request);

        assertThat(created.getAmount().toPlainString()).isEqualTo("12.579");
        assertThat(Files.readString(tempDir.resolve("transactions.csv")))
                .contains("4444-4444-4444,Precise Amount,12.579,");
    }

    @Test
    void addTransaction_appendsWithoutOverwritingExistingRows() {
        TransactionService service = newService();
        service.addTransaction(sampleRequest("1111-1111-1111", "First Person"));
        service.addTransaction(sampleRequest("2222-2222-2222", "Second Person"));

        List<Transaction> all = service.getAllTransactions();

        assertThat(all).hasSize(2);
        assertThat(all).extracting(Transaction::getAccountHolderName)
                .containsExactly("First Person", "Second Person");
    }

    /** 20 threads add at the same moment; every row must survive, intact and distinct. */
    @Test
    void addTransaction_isSafeUnderConcurrentWrites() throws InterruptedException {
        TransactionService service = newService();
        int threadCount = 20;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch go = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {
            int index = i;
            executor.submit(() -> {
                try {
                    ready.countDown();
                    go.await();
                    String acct = String.format("%04d-%04d-%04d", index, index, index);
                    service.addTransaction(sampleRequest(acct, "Person" + index));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            });
        }

        ready.await();
        go.countDown();
        assertThat(done.await(30, TimeUnit.SECONDS)).as("all writer threads finished").isTrue();
        executor.shutdown();

        List<Transaction> all = service.getAllTransactions();
        assertThat(all).hasSize(threadCount);
        assertThat(all).extracting(Transaction::getAccountHolderName).doesNotHaveDuplicates();
        assertThat(all).extracting(Transaction::getAccountNumber).doesNotHaveDuplicates();
    }

    private TransactionRequest sampleRequest(String accountNumber, String accountHolderName) {
        TransactionRequest request = new TransactionRequest();
        request.setTransactionDate(LocalDate.of(2025, 3, 1));
        request.setAccountNumber(accountNumber);
        request.setAccountHolderName(accountHolderName);
        request.setAmount(new BigDecimal("10.00"));
        return request;
    }
}
