package campussync.files;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "file_attachment")
public class StoredAttachment {
    @Id
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 180)
    private String filename;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "file_bytes", nullable = false, columnDefinition = "BYTEA")
    private byte[] fileBytes;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected StoredAttachment() {
    }

    public StoredAttachment(UUID ownerId, String filename, String contentType, byte[] fileBytes) {
        this.id = UUID.randomUUID();
        this.ownerId = ownerId;
        this.filename = filename;
        this.contentType = contentType;
        this.fileBytes = fileBytes;
        this.sizeBytes = fileBytes.length;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getFilename() { return filename; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public byte[] getFileBytes() { return fileBytes; }
}
