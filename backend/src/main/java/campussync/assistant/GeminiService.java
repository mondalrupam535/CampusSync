package campussync.assistant;

import campussync.config.CampusSyncProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;

@Service
public class GeminiService {
    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiService.class);
    private static final int GEMINI_MAX_ATTEMPTS = 3;
    private final CampusSyncProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GeminiService(CampusSyncProperties properties, RestClient.Builder builder, ObjectMapper objectMapper) {
        this.properties = properties;
        this.restClient = builder.build();
        this.objectMapper = objectMapper;
    }

    public String generateText(String prompt) {
        return generate(prompt, null, false);
    }

    public String generateText(String prompt, boolean lowLatency) {
        return generate(prompt, null, lowLatency);
    }

    public String generatePdfText(String prompt, byte[] pdf) {
        return generate(prompt, pdf, false);
    }

    private String generate(String prompt, byte[] pdf, boolean lowLatency) {
        if (properties.geminiApiKey() == null || properties.geminiApiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Gemini is not configured. Set GEMINI_API_KEY and restart the Java backend.");
        }
        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode contents = body.putArray("contents");
        ArrayNode parts = contents.addObject().putArray("parts");
        if (pdf != null) {
            ObjectNode inlineData = parts.addObject().putObject("inlineData");
            inlineData.put("mimeType", "application/pdf");
            inlineData.put("data", Base64.getEncoder().encodeToString(pdf));
        }
        parts.addObject().put("text", prompt);
        ObjectNode generationConfig = body.putObject("generationConfig");
        generationConfig.put("responseMimeType", "application/json");
        if (lowLatency) {
            generationConfig.put("maxOutputTokens", 2048);
            generationConfig.putObject("thinkingConfig").put("thinkingLevel", "LOW");
        }
        try {
            JsonNode response = requestGemini(body);
            String text = response == null ? "" : response.path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text").asText("");
            if (text.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned an empty response.");
            }
            return text;
        } catch (ResponseStatusException error) {
            throw error;
        } catch (RestClientResponseException error) {
            String upstreamMessage = upstreamErrorMessage(error.getResponseBodyAsString());
            LOGGER.warn("Gemini rejected a request with HTTP {}.", error.getStatusCode().value());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Gemini rejected the request (HTTP " + error.getStatusCode().value() + "): "
                            + upstreamMessage);
        } catch (ResourceAccessException error) {
            LOGGER.warn("Could not connect to the Gemini API ({}).",
                    error.getMostSpecificCause().getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not connect to Gemini. Check your internet connection, firewall, or proxy settings.", error);
        } catch (Exception error) {
            LOGGER.error("Unexpected Gemini request failure ({}).", error.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "The Gemini request failed.", error);
        }
    }

    private JsonNode requestGemini(ObjectNode body) {
        for (int attempt = 1; ; attempt++) {
            try {
                return restClient.post()
                        .uri("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                                properties.geminiModel(), properties.geminiApiKey())
                        .body(body)
                        .retrieve()
                        .body(JsonNode.class);
            } catch (RestClientResponseException error) {
                int status = error.getStatusCode().value();
                if ((status != 429 && status != 503) || attempt >= GEMINI_MAX_ATTEMPTS) throw error;
                LOGGER.info("Gemini returned HTTP {}; retrying transient failure (attempt {}/{}).",
                        status, attempt + 1, GEMINI_MAX_ATTEMPTS);
                try {
                    Thread.sleep(500L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                            "Gemini retry was interrupted. Please try again.", interrupted);
                }
            }
        }
    }

    private String upstreamErrorMessage(String responseBody) {
        try {
            JsonNode error = objectMapper.readTree(responseBody).path("error");
            String message = error.path("message").asText("").trim();
            if (!message.isEmpty()) return message;
            String status = error.path("status").asText("").trim();
            if (!status.isEmpty()) return status;
        } catch (Exception error) {
            LOGGER.debug("Gemini returned a non-JSON error response.");
        }
        return "Check that the API key is valid, the model is available, and your project has Gemini API access.";
    }

    public JsonNode extractJson(String text) {
        String cleaned = text.replaceAll("(?is)^\\s*```(?:json)?\\s*", "")
                .replaceAll("(?is)\\s*```\\s*$", "").trim();
        try {
            return objectMapper.readTree(cleaned);
        } catch (Exception ignored) {
            int first = cleaned.indexOf('{');
            int last = cleaned.lastIndexOf('}');
            if (first < 0 || last <= first) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned invalid JSON.");
            }
            try {
                return objectMapper.readTree(cleaned.substring(first, last + 1));
            } catch (Exception error) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Gemini returned invalid JSON.", error);
            }
        }
    }
}
