package campussync.workspace;

import campussync.auth.UserAccount;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Service
public class WorkspaceService {
    private static final Set<String> COLLECTIONS = Set.of("inbox", "announcements", "events", "rooms");
    private static final int MAX_PAYLOAD_LENGTH = 8_000_000;
    private final WorkspaceDocumentRepository documents;
    private final ObjectMapper objectMapper;

    public WorkspaceService(WorkspaceDocumentRepository documents, ObjectMapper objectMapper) {
        this.documents = documents;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public JsonNode read(UserAccount user, String collection) {
        validateCollection(collection);
        return documents.findByOwnerIdAndCollectionName(user.getId(), collection)
                .map(document -> parse(document.getPayload()))
                .orElse(null);
    }

    @Transactional
    public JsonNode write(UserAccount user, String collection, JsonNode payload) {
        validateCollection(collection);
        if (payload == null || payload.isNull() || !payload.isContainerNode()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workspace data must be a JSON object or array.");
        }
        String serialized;
        try {
            serialized = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workspace data could not be serialized.", error);
        }
        if (serialized.length() > MAX_PAYLOAD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Workspace data exceeds the 8 MB limit.");
        }
        WorkspaceDocument document = documents.findByOwnerIdAndCollectionName(user.getId(), collection)
                .orElseGet(() -> new WorkspaceDocument(user, collection, serialized));
        document.updatePayload(serialized);
        documents.save(document);
        return payload;
    }

    @Transactional
    public void delete(UserAccount user, String collection) {
        validateCollection(collection);
        documents.findByOwnerIdAndCollectionName(user.getId(), collection)
                .ifPresent(documents::delete);
    }

    private JsonNode parse(String payload) {
        try {
            return objectMapper.readTree(payload);
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Saved workspace data is invalid.", error);
        }
    }

    private void validateCollection(String collection) {
        if (!COLLECTIONS.contains(collection)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace collection was not found.");
        }
    }
}
