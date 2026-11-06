package campussync.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;


@Entity
@Table(name = "user_account")
public class UserAccount {
    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(name = "google_subject", unique = true)
    private String googleSubject;

    @Column(name = "department", nullable = false, length = 180)
    private String department = "";

    @Column(name = "role_name", nullable = false, length = 80)
    private String roleName = "student";

    @Column(name = "profile_json", nullable = false, columnDefinition = "TEXT")
    private String profileJson = "{}";

    @Column(name = "onboarding_json", nullable = false, columnDefinition = "TEXT")
    private String onboardingJson = "{}";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected UserAccount() {
    }

    public UserAccount(String email, String displayName, String passwordHash) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.displayName = displayName;
        this.passwordHash = passwordHash;
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
        this.profileJson = "{\"name\":\"" + displayName.replace("\\", "\\\\").replace("\"", "\\\"")
                + "\",\"email\":\"" + email.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}";
    }

    public static UserAccount fromGoogle(String email, String displayName, String subject, String passwordHash) {
        UserAccount account = new UserAccount(email, displayName, passwordHash);
        account.googleSubject = subject;
        return account;
    }

    public void updateProfile(String displayName, String department, String roleName, String profileJson) {
        this.displayName = displayName;
        this.department = department;
        this.roleName = roleName;
        this.profileJson = profileJson;
        this.updatedAt = OffsetDateTime.now();
    }

    public void updateOnboarding(String onboardingJson, String department, String roleName, String profileJson,
                                 String displayName) {
        this.onboardingJson = onboardingJson;
        updateProfile(displayName, department, roleName, profileJson);
    }

    public void attachGoogleSubject(String googleSubject) {
        this.googleSubject = googleSubject;
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getDisplayName() { return displayName; }
    public String getPasswordHash() { return passwordHash; }
    public String getGoogleSubject() { return googleSubject; }
    public String getDepartment() { return department; }
    public String getRoleName() { return roleName; }
    public String getProfileJson() { return profileJson; }
    public String getOnboardingJson() { return onboardingJson; }
}
