package campussync.auth;

import campussync.security.AuthInterceptor;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Year;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
public class AdminController {
    private final AuthController authController;
    private final OnboardingService onboardingService;
    private final UserAccountRepository users;

    public AdminController(AuthController authController, OnboardingService onboardingService,
                           UserAccountRepository users) {
        this.authController = authController;
        this.onboardingService = onboardingService;
        this.users = users;
    }

    @GetMapping
    public List<Map<String, String>> list(HttpServletRequest request) {
        requireAdmin(request);
        return users.findAll(Sort.by(Sort.Direction.ASC, "displayName")).stream()
                .map(user -> Map.of(
                        "id", user.getId().toString(),
                        "name", user.getDisplayName(),
                        "email", user.getEmail(),
                        "department", user.getDepartment(),
                        "role", user.getRoleName()
                ))
                .toList();
    }

    @PutMapping("/{id}/role")
    public Map<String, String> updateRole(@PathVariable UUID id, @Valid @RequestBody RoleUpdateRequest input,
                                          HttpServletRequest request) {
        requireAdmin(request);
        UserAccount target = users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found."));
        var saved = onboardingService.read(target);
        var existingRole = saved.path("role");
        ObjectNode role = JsonNodeFactory.instance.objectNode();
        role.put("category", input.role().trim().toLowerCase(java.util.Locale.ROOT));
        role.put("dept", input.department().trim());
        role.put("designation", existingRole.path("designation").asText(""));
        role.put("specialization", role.path("category").asText().equals("student")
                ? existingRole.path("specialization").asText("") : "");
        role.put("joining", existingRole.path("joining").asText(Integer.toString(Year.now().getValue())));
        onboardingService.updateCampusRoleByAdmin(target, role);
        return Map.of("status", "updated", "id", id.toString());
    }

    private void requireAdmin(HttpServletRequest request) {
        UserAccount current = (UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE);
        if (current == null || !authController.isConfiguredAdmin(current)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Administrator access is required.");
        }
    }

    public record RoleUpdateRequest(
            @NotBlank @Size(max = 40) String role,
            @NotBlank @Size(max = 180) String department
    ) {}
}
