package campussync;

import campussync.config.CampusSyncProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    private final CampusSyncProperties properties;

    public HealthController(CampusSyncProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("service", "CampusSync Java backend", "status", "online",
                "geminiConfigured", properties.geminiApiKey() != null && !properties.geminiApiKey().isBlank());
    }

    @GetMapping("/")
    public org.springframework.web.servlet.view.RedirectView root() {
        return new org.springframework.web.servlet.view.RedirectView("/login_signup%20page/index.html");
    }
}
