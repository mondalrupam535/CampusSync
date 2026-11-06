package campussync.messages;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampusMessageRepository extends JpaRepository<CampusMessage, UUID> {
    List<CampusMessage> findBySenderIdOrRecipientUserIdOrderByCreatedAtDesc(UUID senderId, UUID recipientUserId);
    List<CampusMessage> findByRecipientDepartmentsJsonContainingOrderByCreatedAtDesc(String department);
    Optional<CampusMessage> findByIdAndRecipientUserId(UUID id, UUID recipientUserId);
}
