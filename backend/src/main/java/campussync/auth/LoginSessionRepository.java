package campussync.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LoginSessionRepository extends JpaRepository<LoginSession, String> {
    Optional<LoginSession> findByTokenHashAndExpiresAtAfter(String tokenHash, OffsetDateTime now);
    List<LoginSession> findByUserId(UUID userId);
}
