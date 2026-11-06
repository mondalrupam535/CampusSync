package campussync.auth;

import campussync.config.CampusSyncProperties;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final UserAccountRepository users;
    private final LoginSessionRepository sessions;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final CampusSyncProperties properties;
    private final RestClient restClient;

    public AuthService(UserAccountRepository users, LoginSessionRepository sessions,
                       org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
                       CampusSyncProperties properties, RestClient.Builder restClientBuilder) {
        this.users = users;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
        this.restClient = restClientBuilder.build();
    }

    @Transactional
    public AuthResult register(String name, String email, String password) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedName = requireText(name, "Name", 160);
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain 8 to 72 characters.");
        }
        if (users.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account already exists for this email.");
        }
        UserAccount user = users.save(new UserAccount(normalizedEmail, normalizedName, passwordEncoder.encode(password)));
        return createSession(user);
    }

    @Transactional
    public AuthResult login(String email, String password) {
        UserAccount user = users.findByEmailIgnoreCase(normalizeEmail(email))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
        if (user.getPasswordHash() == null || password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }
        return createSession(user);
    }

    @Transactional
    public AuthResult googleLogin(String accessToken) {
        return googleAuthentication(accessToken, null);
    }

    @Transactional
    public AuthResult googleRegister(String accessToken, String password) {
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain 8 to 72 characters.");
        }
        return googleAuthentication(accessToken, password);
    }

    private AuthResult googleAuthentication(String accessToken, String registrationPassword) {
        if (accessToken == null || accessToken.isBlank() || accessToken.length() > 8192) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid Google access token is required.");
        }
        Map<?, ?> userInfo;
        try {
            userInfo = restClient.get()
                    .uri("https://openidconnect.googleapis.com/v1/userinfo")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(Map.class);
        } catch (RuntimeException error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google could not verify this sign-in.", error);
        }
        if (userInfo == null || !Boolean.TRUE.equals(userInfo.get("email_verified"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google must provide a verified email address.");
        }
        String email = normalizeEmail(String.valueOf(userInfo.get("email")));
        Object nameValue = userInfo.get("name");
        String name = requireText(nameValue == null ? email : nameValue.toString(), "Google account name", 160);
        Object subjectValue = userInfo.get("sub");
        if (subjectValue == null || subjectValue.toString().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google did not provide an account identifier.");
        }
        String subject = subjectValue.toString();

        UserAccount user = users.findByGoogleSubject(subject).orElseGet(() -> {
            UserAccount existing = users.findByEmailIgnoreCase(email).orElse(null);
            if (existing != null) {
                if (existing.getGoogleSubject() == null) existing.attachGoogleSubject(subject);
                return users.save(existing);
            }
            if (registrationPassword == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No CampusSync account exists for this Google account. Please sign up first.");
            }
            String passwordHash = passwordEncoder.encode(registrationPassword);
            return users.save(UserAccount.fromGoogle(email, name, subject, passwordHash));
        });
        return createSession(user);
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) sessions.deleteById(hashToken(rawToken));
    }

    @Transactional
    public String createSessionToken(UserAccount user) {
        return createSession(user).rawToken();
    }

    private AuthResult createSession(UserAccount user) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.save(new LoginSession(hashToken(token), user.getId(),
                OffsetDateTime.now().plusDays(Math.max(1, properties.sessionDays()))));
        return new AuthResult(token, user);
    }

    public static String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception error) {
            throw new IllegalStateException("SHA-256 is required by this runtime.", error);
        }
    }

    public static String normalizeEmail(String email) {
        if (email == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        String value = email.trim().toLowerCase(java.util.Locale.ROOT);
        if (value.length() > 320 || !value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        }
        return value;
    }

    private static String requireText(String value, String label, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, label + " is required and must be at most " + maxLength + " characters.");
        }
        return normalized;
    }

    public record AuthResult(String rawToken, UserAccount user) {}
}
