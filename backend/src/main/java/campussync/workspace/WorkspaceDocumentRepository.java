package campussync.workspace;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WorkspaceDocumentRepository extends JpaRepository<WorkspaceDocument, UUID> {
    Optional<WorkspaceDocument> findByOwnerIdAndCollectionName(UUID ownerId, String collectionName);
}
