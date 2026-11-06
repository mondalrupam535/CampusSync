package campussync.auth;

import campussync.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contacts")
public class ContactsController {
    private final UserAccountRepository users;

    public ContactsController(UserAccountRepository users) {
        this.users = users;
    }

    @GetMapping
    public List<Map<String, String>> search(@RequestParam(defaultValue = "") String q,
                                            HttpServletRequest request) {
        String query = q.trim();
        if (query.length() < 2) return List.of();
        String currentEmail = ((UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE)).getEmail();
        return users.findTop20ByDisplayNameContainingIgnoreCaseOrDepartmentContainingIgnoreCase(query, query).stream()
                .filter(user -> !user.getEmail().equalsIgnoreCase(currentEmail))
                .map(user -> Map.of(
                        "id", user.getId().toString(),
                        "name", user.getDisplayName(),
                        "department", user.getDepartment(),
                        "email", user.getEmail()
                ))
                .toList();
    }
}
