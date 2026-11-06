package campussync.calendar;

import campussync.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "university_calendar")
public class UniversityCalendar {
    @Id
    private UUID id;

    @Column(name = "owner_id", nullable = false, unique = true)
    private UUID ownerId;

    @Column(nullable = false, length = 180)
    private String filename;

    @Column(name = "pdf_bytes", nullable = false, columnDefinition = "BYTEA")
    private byte[] pdfBytes;

    @Column(name = "events_json", nullable = false, columnDefinition = "TEXT")
    private String eventsJson;

    @Column(name = "uploaded_at", nullable = false)
    private OffsetDateTime uploadedAt;

    protected UniversityCalendar() {
    }

    public UniversityCalendar(UserAccount owner, String filename, byte[] pdfBytes, String eventsJson) {
        this.id = UUID.randomUUID();
        this.ownerId = owner.getId();
        this.filename = filename;
        this.pdfBytes = pdfBytes;
        this.eventsJson = eventsJson;
        this.uploadedAt = OffsetDateTime.now();
    }

    public void update(String filename, byte[] pdfBytes, String eventsJson) {
        this.filename = filename;
        this.pdfBytes = pdfBytes;
        this.eventsJson = eventsJson;
        this.uploadedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public String getFilename() { return filename; }
    public String getEventsJson() { return eventsJson; }
    public OffsetDateTime getUploadedAt() { return uploadedAt; }
}
