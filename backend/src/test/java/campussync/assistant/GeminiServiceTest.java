package campussync.assistant;

import campussync.config.CampusSyncProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.hamcrest.Matchers.containsString;

class GeminiServiceTest {
    private MockRestServiceServer geminiServer;
    private GeminiService geminiService;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        geminiServer = MockRestServiceServer.bindTo(builder).build();
        CampusSyncProperties properties =
                new CampusSyncProperties("../", 30, false, "", "test-api-key", "gemini-3.5-flash-lite", "", "");
        geminiService = new GeminiService(properties, builder, new ObjectMapper());
    }

    @AfterEach
    void verifyGeminiRequest() {
        geminiServer.verify();
    }

    @Test
    void reportsGeminiAuthenticationErrorWithoutExposingTheApiKey() {
        geminiServer.expect(requestTo(
                        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=test-api-key"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}
                                """));

        assertThatThrownBy(() -> geminiService.generateText("test prompt"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("HTTP 400")
                .hasMessageContaining("API key not valid")
                .hasMessageNotContaining("test-api-key");
    }

    @Test
    void retriesTemporaryGeminiOverloadAndReturnsSuccessfulResponse() {
        String endpoint =
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=test-api-key";
        geminiServer.expect(requestTo(endpoint))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {"error":{"code":503,"message":"Temporarily overloaded"}}
                                """));
        geminiServer.expect(requestTo(endpoint))
                .andRespond(withSuccess("""
                        {"candidates":[{"content":{"parts":[{"text":"{\\"reply\\":\\"Gemini is back\\"}"}]}}]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(geminiService.generateText("test prompt"))
                .isEqualTo("{\"reply\":\"Gemini is back\"}");
    }

    @Test
    void usesLowThinkingAndBoundedOutputForFastComposition() {
        geminiServer.expect(requestTo(
                        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=test-api-key"))
                .andExpect(content().string(containsString("\"thinkingLevel\":\"LOW\"")))
                .andExpect(content().string(containsString("\"maxOutputTokens\":2048")))
                .andRespond(withSuccess("""
                        {"candidates":[{"content":{"parts":[{"text":"{\\"title\\":\\"Notice\\",\\"content\\":\\"Details\\"}"}]}}]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(geminiService.generateText("short prompt", true))
                .isEqualTo("{\"title\":\"Notice\",\"content\":\"Details\"}");
    }
}
