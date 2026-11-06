package campussync.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    Optional<UserAccount> findByGoogleSubject(String googleSubject);
    List<UserAccount> findTop20ByDisplayNameContainingIgnoreCaseOrDepartmentContainingIgnoreCase(
            String name, String department);
}
