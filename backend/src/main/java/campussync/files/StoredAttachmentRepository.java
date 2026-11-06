package campussync.files;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StoredAttachmentRepository extends JpaRepository<StoredAttachment, UUID> {
    Optional<StoredAttachment> findByIdAndOwnerId(UUID id, UUID ownerId);
}
