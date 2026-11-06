package campussync.auth;

import campussync.config.CampusSyncProperties;
import campussync.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public static final String COOKIE_NAME = "CAMPUSSYNC_SESSION";
    private final AuthService authService;
    private final CampusSyncProperties properties;

    public AuthController(AuthService authService, CampusSyncProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@Valid @RequestBody Credentials request, HttpServletResponse response) {
        AuthService.AuthResult result = authService.register(request.name(), request.email(), request.password());
        setCookie(response, result.rawToken());
        return responseBody(result.user());
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthService.AuthResult result = authService.login(request.email(), request.password());
        setCookie(response, result.rawToken());
        return responseBody(result.user());
    }

    @PostMapping("/google")
    public Map<String, Object> google(@Valid @RequestBody GoogleLoginRequest request, HttpServletResponse response) {
        AuthService.AuthResult result = authService.googleLogin(request.accessToken());
        setCookie(response, result.rawToken());
        return responseBody(result.user());
    }

    @PostMapping("/google/register")
    public Map<String, Object> googleRegister(@Valid @RequestBody GoogleRegistrationRequest request,
                                             HttpServletResponse response) {
        AuthService.AuthResult result = authService.googleRegister(request.accessToken(), request.password());
        setCookie(response, result.rawToken());
        return responseBody(result.user());
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        return responseBody((UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE));
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(readCookie(request, COOKIE_NAME));
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Lax").path("/")
                .maxAge(Duration.ZERO).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return Map.of("status", "signed_out");
    }

    private void setCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true).secure(properties.cookieSecure()).sameSite("Lax").path("/")
                .maxAge(Duration.ofDays(Math.max(1, properties.sessionDays()))).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private Map<String, Object> responseBody(UserAccount user) {
        return Map.of("user", Map.of(
                "id", user.getId().toString(),
                "name", user.getDisplayName(),
                "email", user.getEmail(),
                "department", user.getDepartment(),
                "role", user.getRoleName(),
                "isAdmin", isConfiguredAdmin(user)
        ));
    }

    public boolean isConfiguredAdmin(UserAccount user) {
        return properties.adminEmails() != null && java.util.Arrays.stream(properties.adminEmails().split(","))
                .map(String::trim)
                .anyMatch(email -> !email.isEmpty() && email.equalsIgnoreCase(user.getEmail()));
    }

    public static String readCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    public record Credentials(@NotBlank @Size(max = 160) String name,
                              @NotBlank @Email @Size(max = 320) String email,
                              @NotBlank @Size(min = 8, max = 72) String password) {}
    public record LoginRequest(@NotBlank @Email @Size(max = 320) String email,
                               @NotBlank @Size(max = 72) String password) {}
    public record GoogleLoginRequest(@NotBlank @Size(max = 8192) String accessToken) {}
    public record GoogleRegistrationRequest(@NotBlank @Size(max = 8192) String accessToken,
                                            @NotBlank @Size(min = 8, max = 72) String password) {}
}
