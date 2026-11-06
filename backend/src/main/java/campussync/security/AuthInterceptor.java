package campussync.security;

import campussync.auth.AuthController;
import campussync.auth.AuthService;
import campussync.auth.LoginSession;
import campussync.auth.LoginSessionRepository;
import campussync.auth.UserAccount;
import campussync.auth.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.OffsetDateTime;
import java.util.Map;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    public static final String USER_ATTRIBUTE = "campussync.authenticatedUser";
    private final LoginSessionRepository sessions;
    private final UserAccountRepository users;
    private final ObjectMapper objectMapper;

    public AuthInterceptor(LoginSessionRepository sessions, UserAccountRepository users, ObjectMapper objectMapper) {
        this.sessions = sessions;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) return true;

        String path = request.getRequestURI();
        boolean publicEndpoint = path.equals("/health")
                || path.equals("/api/auth/register") && request.getMethod().equals("POST")
                || path.equals("/api/auth/login") && request.getMethod().equals("POST")
                || (path.equals("/api/auth/google") || path.equals("/api/auth/google/register"))
                && request.getMethod().equals("POST");
        if (publicEndpoint) return true;

        if (!HttpMethod.GET.matches(request.getMethod()) &&
                !"1".equals(request.getHeader("X-CampusSync-Request"))) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            objectMapper.writeValue(response.getWriter(), Map.of("error", "A same-origin request header is required."));
            return false;
        }

        String token = AuthController.readCookie(request, AuthController.COOKIE_NAME);
        if (token == null || token.length() > 128) {
            writeUnauthorized(response);
            return false;
        }
        String tokenHash = AuthService.hashToken(token);
        LoginSession session = sessions.findByTokenHashAndExpiresAtAfter(tokenHash, OffsetDateTime.now()).orElse(null);
        if (session == null) {
            writeUnauthorized(response);
            return false;
        }
        UserAccount user = users.findById(session.getUserId()).orElse(null);
        if (user == null) {
            sessions.deleteById(tokenHash);
            writeUnauthorized(response);
            return false;
        }
        request.setAttribute(USER_ATTRIBUTE, user);
        return true;
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), Map.of("error", "Sign in to continue."));
    }
}
