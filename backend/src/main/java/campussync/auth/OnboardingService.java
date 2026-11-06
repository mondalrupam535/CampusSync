package campussync.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;

@Service
public class OnboardingService {
    private final ObjectMapper objectMapper;
    private final UserAccountRepository users;

    public OnboardingService(ObjectMapper objectMapper, UserAccountRepository users) {
        this.objectMapper = objectMapper;
        this.users = users;
    }

    public ObjectNode read(UserAccount user) {
        ObjectNode data;
        try {
            JsonNode parsed = objectMapper.readTree(user.getOnboardingJson());
            data = parsed != null && parsed.isObject() ? (ObjectNode) parsed : objectMapper.createObjectNode();
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Saved onboarding data is invalid.", error);
        }
        if (!data.has("profile")) {
            try {
                data.set("profile", objectMapper.readTree(user.getProfileJson()));
            } catch (JsonProcessingException error) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Saved profile data is invalid.", error);
            }
        }
        ObjectNode completed = data.with("completed");
        if (!completed.has("step1")) completed.put("step1", false);
        if (!completed.has("step2")) completed.put("step2", false);
        if (!completed.has("step3")) completed.put("step3", false);
        return data;
    }

    @Transactional
    public ObjectNode update(UserAccount user, String step, JsonNode value) {
        return update(user, step, value, false);
    }

    @Transactional
    public ObjectNode updateCampusRoleByAdmin(UserAccount user, JsonNode value) {
        return update(user, "role", value, true);
    }

    private ObjectNode update(UserAccount user, String step, JsonNode value, boolean adminOverride) {
        if (!value.isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Onboarding data must be a JSON object.");
        }
        ObjectNode onboarding = read(user);
        ObjectNode completed = onboarding.with("completed");
        switch (step) {
            case "profile" -> {
                String name = text(value, "name", 160, true);
                ObjectNode profile = value.deepCopy();
                profile.put("name", name);
                profile.put("email", user.getEmail());
                onboarding.set("profile", profile);
                completed.put("step1", true);
            }
            case "role" -> {
                if (!adminOverride && completed.path("step2").asBoolean()) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Only an administrator can change a completed account's campus role.");
                }
                String category = text(value, "category", 40, true);
                if (!category.equalsIgnoreCase("student") && !category.equalsIgnoreCase("faculty")
                        && !category.equalsIgnoreCase("staff")) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid role.");
                }
                String department = text(value, "dept", 180, true);
                text(value, "designation", 120, false);
                text(value, "specialization", 180, category.equalsIgnoreCase("student"));
                String joining = text(value, "joining", 4, true);
                int currentYear = java.time.Year.now().getValue();
                if (!joining.matches("\\d{4}") || Integer.parseInt(joining) < 1990
                        || Integer.parseInt(joining) > currentYear + 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid four-digit joining year.");
                }
                JsonNode previous = onboarding.get("role");
                if (previous != null && !previous.path("category").asText().equalsIgnoreCase(category)) {
                    completed.put("step3", false);
                    onboarding.remove("student");
                    onboarding.remove("staff");
                }
                onboarding.set("role", value.deepCopy());
                completed.put("step2", true);
                user.updateProfile(user.getDisplayName(), department, category, user.getProfileJson());
            }
            case "student" -> {
                if (!onboarding.path("role").path("category").asText().equalsIgnoreCase("student")) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Student details require the student role.");
                }
                onboarding.set("student", value.deepCopy());
                completed.put("step3", true);
            }
            case "staff" -> {
                if (onboarding.path("role").path("category").asText().equalsIgnoreCase("student")
                        || onboarding.path("role").isMissingNode()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Employment details require a faculty or staff role.");
                }
                onboarding.set("staff", value.deepCopy());
                completed.put("step3", true);
            }
            default -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Onboarding step was not found.");
        }

        JsonNode profile = onboarding.path("profile");
        JsonNode role = onboarding.path("role");
        String name = profile.path("name").asText(user.getDisplayName());
        String department = role.path("dept").asText(user.getDepartment());
        String roleName = role.path("category").asText(user.getRoleName());
        try {
            user.updateOnboarding(objectMapper.writeValueAsString(onboarding), department, roleName,
                    objectMapper.writeValueAsString(profile), name);
            users.save(user);
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Onboarding data could not be saved.", error);
        }
        return read(user);
    }

    @Transactional
    public ObjectNode updateProfileDetails(UserAccount user, JsonNode value) {
        if (!value.isObject() || !value.path("profile").isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile details are required.");
        }

        JsonNode profile = value.path("profile");
        text(profile, "name", 160, true);
        text(profile, "username", 80, false);
        text(profile, "phone", 40, false);
        text(profile, "bio", 500, false);
        String photo = text(profile, "photo", 2_800_000, false);
        if (!photo.isEmpty()) {
            String prefix = "^data:image/(?:avif|bmp|gif|jpeg|png|webp);base64,";
            if (!photo.matches(prefix + "[A-Za-z0-9+/]*={0,2}$")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported image file.");
            }
            try {
                Base64.getDecoder().decode(photo.substring(photo.indexOf(',') + 1));
            } catch (IllegalArgumentException error) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected profile image is invalid.", error);
            }
        }

        ObjectNode onboarding = read(user);
        String category = onboarding.path("role").path("category").asText(user.getRoleName());
        if (category.equalsIgnoreCase("student")) {
            if (!value.path("student").isObject()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student details are required for this role.");
            }
            update(user, "student", value.path("student"));
        } else {
            if (!value.path("staff").isObject()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employment details are required for this role.");
            }
            update(user, "staff", value.path("staff"));
        }
        return update(user, "profile", profile);
    }

    private static String text(JsonNode value, String key, int maxLength, boolean required) {
        String text = value.path(key).asText("").trim();
        if (required && text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " is required.");
        }
        if (text.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " exceeds the allowed length.");
        }
        return text;
    }
}
