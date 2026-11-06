package campussync.workspace;

import campussync.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "workspace_document", uniqueConstraints =
        @UniqueConstraint(name = "workspace_document_owner_collection_unique",
                columnNames = {"owner_id", "collection_name"}))
public class WorkspaceDocument {
    @Id
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "collection_name", nullable = false, length = 64)
    private String collectionName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected WorkspaceDocument() {
    }

    public WorkspaceDocument(UserAccount owner, String collectionName, String payload) {
        this.id = UUID.randomUUID();
        this.ownerId = owner.getId();
        this.collectionName = collectionName;
        this.payload = payload;
        this.updatedAt = OffsetDateTime.now();
    }

    public void updatePayload(String payload) {
        this.payload = payload;
        this.updatedAt = OffsetDateTime.now();
    }

    public String getPayload() { return payload; }
}
