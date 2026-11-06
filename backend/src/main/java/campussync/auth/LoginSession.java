package campussync.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "login_session")
public class LoginSession {
    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected LoginSession() {
    }

    public LoginSession(String tokenHash, UUID userId, OffsetDateTime expiresAt) {
        this.tokenHash = tokenHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.createdAt = OffsetDateTime.now();
    }

    public String getTokenHash() { return tokenHash; }
    public UUID getUserId() { return userId; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
}
