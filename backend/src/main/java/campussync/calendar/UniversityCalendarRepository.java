package campussync.calendar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UniversityCalendarRepository extends JpaRepository<UniversityCalendar, UUID> {
    Optional<UniversityCalendar> findByOwnerId(UUID ownerId);
}
