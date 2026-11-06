package campussync.messages;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "campus_message_receipt", uniqueConstraints = @UniqueConstraint(
        name = "campus_message_receipt_unique", columnNames = {"message_id", "recipient_user_id"}))
public class CampusMessageReceipt {
    @Id
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    @Column(name = "recipient_user_id", nullable = false)
    private UUID recipientUserId;

    @Column(name = "read_at", nullable = false)
    private OffsetDateTime readAt;

    protected CampusMessageReceipt() {
    }

    public CampusMessageReceipt(UUID messageId, UUID recipientUserId) {
        this.id = UUID.randomUUID();
        this.messageId = messageId;
        this.recipientUserId = recipientUserId;
        this.readAt = OffsetDateTime.now();
    }

    public UUID getMessageId() {
        return messageId;
    }
}
