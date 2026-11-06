package campussync.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "campussync")
public record CampusSyncProperties(
        String frontendRoot,
        int sessionDays,
        boolean cookieSecure,
        String googleClientId,
        String geminiApiKey,
        String geminiModel,
        String departmentRouterJar,
        String adminEmails
) {
}
