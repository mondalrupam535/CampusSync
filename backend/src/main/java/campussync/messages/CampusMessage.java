package campussync.messages;

import campussync.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "campus_message")
public class CampusMessage {
    @Id
    private UUID id;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "recipient_departments_json", nullable = false, columnDefinition = "TEXT")
    private String recipientDepartmentsJson;

    @Column(nullable = false, length = 240)
    private String subject;

    @Column(name = "body_text", nullable = false, columnDefinition = "TEXT")
    private String bodyText;

    @Column(nullable = false)
    private boolean important;

    @Column(name = "action_required", nullable = false)
    private boolean actionRequired;

    @Column(name = "recipient_read", nullable = false)
    private boolean recipientRead;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected CampusMessage() {
    }

    public CampusMessage(UserAccount sender, UserAccount recipient, String departments, String subject,
                         String bodyText, boolean important, boolean actionRequired) {
        this.id = UUID.randomUUID();
        this.senderId = sender.getId();
        this.recipientUserId = recipient == null ? null : recipient.getId();
        this.recipientDepartmentsJson = departments;
        this.subject = subject;
        this.bodyText = bodyText;
        this.important = important;
        this.actionRequired = actionRequired;
        this.recipientRead = false;
        this.createdAt = OffsetDateTime.now();
    }

    public void markRead() { this.recipientRead = true; }
    public void markUnread() { this.recipientRead = false; }
    public UUID getId() { return id; }
    public UUID getSenderId() { return senderId; }
    public UUID getRecipientUserId() { return recipientUserId; }
    public String getRecipientDepartmentsJson() { return recipientDepartmentsJson; }
    public String getSubject() { return subject; }
    public String getBodyText() { return bodyText; }
    public boolean isImportant() { return important; }
    public boolean isActionRequired() { return actionRequired; }
    public boolean isRecipientRead() { return recipientRead; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
