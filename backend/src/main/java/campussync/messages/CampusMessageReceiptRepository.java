package campussync.messages;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampusMessageReceiptRepository extends JpaRepository<CampusMessageReceipt, UUID> {
    List<CampusMessageReceipt> findByMessageIdInAndRecipientUserId(Collection<UUID> messageIds, UUID recipientUserId);
    Optional<CampusMessageReceipt> findByMessageIdAndRecipientUserId(UUID messageId, UUID recipientUserId);
}
