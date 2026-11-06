package campussync.auth;

import campussync.security.AuthInterceptor;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding")
public class OnboardingController {
    private final OnboardingService onboardingService;

    public OnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @GetMapping
    public JsonNode get(HttpServletRequest request) {
        return onboardingService.read(currentUser(request));
    }

    @PutMapping("/{step}")
    public JsonNode put(@PathVariable String step, @RequestBody JsonNode data, HttpServletRequest request) {
        return onboardingService.update(currentUser(request), step, data);
    }

    @PutMapping("/profile/details")
    public JsonNode updateProfileDetails(@RequestBody JsonNode data, HttpServletRequest request) {
        return onboardingService.updateProfileDetails(currentUser(request), data);
    }

    private static UserAccount currentUser(HttpServletRequest request) {
        return (UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE);
    }
}
