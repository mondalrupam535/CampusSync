package campussync.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import campussync.auth.UserAccount;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;

class AssistantControllerTest {
    @Test
    void inboxOptimizationKeepsTheManuallySelectedDepartmentWithoutCallingRouter() throws Exception {
        GeminiService gemini = mock(GeminiService.class);
        DepartmentRouterClient router = mock(DepartmentRouterClient.class);
        JsonNode generatedContent = new ObjectMapper().readTree("""
                {"title":"Lab schedule","content":"The updated schedule is attached."}
                """);
        when(gemini.generateText(anyString(), anyBoolean())).thenReturn("generated JSON");
        when(gemini.extractJson("generated JSON")).thenReturn(generatedContent);
        AssistantController controller = new AssistantController(gemini, router, new ObjectMapper());

        Map<String, Object> response = controller.chat(new AssistantController.AssistantRequest(
                "inbox-composer",
                "department",
                List.of(new AssistantController.ChatMessage("user", "Please share the updated lab schedule.")),
                null,
                List.of("Computer Science and Engineering"),
                null
        ));

        ArgumentCaptor<String> prompt = forClass(String.class);
        verify(gemini).generateText(prompt.capture(), org.mockito.ArgumentMatchers.eq(true));
        assertThat(prompt.getValue())
                .contains("formal application/request letter")
                .contains("To,")
                .contains("Respected Sir/Madam,")
                .contains("Yours sincerely,")
                .contains("Never write 'The Concerned Department' if a department is known")
                .contains("Computer Science and Engineering");
        assertThat(response.get("reply").toString())
                .contains("Optimized subject: Lab schedule")
                .contains("Optimized message: The updated schedule is attached.")
                .contains("Departments: Computer Science and Engineering");
        assertThat(response)
                .containsEntry("subject", "Lab schedule")
                .containsEntry("content", "The updated schedule is attached.")
                .containsEntry("departments", List.of("Computer Science and Engineering"));
        verify(router, never()).route(anyString());
    }

    @Test
    void announcementOptimizationRefinesRouterSuggestionsAndAddsRelevantCatalogDepartments() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        GeminiService gemini = mock(GeminiService.class);
        DepartmentRouterClient router = mock(DepartmentRouterClient.class);
        JsonNode generatedDraft = objectMapper.readTree("""
                {"title":"Research seminar","content":"A seminar on applied research methods."}
                """);
        JsonNode routerSuggestions = objectMapper.readTree("""
                [{"department":"Research"}]
                """);
        JsonNode refinedDepartments = objectMapper.readTree("""
                {"departments":["Research","Computer Science and Engineering"]}
                """);
        when(gemini.generateText(anyString(), anyBoolean())).thenReturn("draft JSON", "department JSON");
        when(gemini.extractJson("draft JSON")).thenReturn(generatedDraft);
        when(gemini.extractJson("department JSON")).thenReturn(refinedDepartments);
        when(router.route(anyString())).thenReturn(routerSuggestions);
        AssistantController controller = new AssistantController(gemini, router, objectMapper);

        Map<String, Object> response = controller.chat(new AssistantController.AssistantRequest(
                "announcement-composer",
                null,
                List.of(new AssistantController.ChatMessage("user", "Announce a seminar on applied research methods.")),
                null,
                null,
                null
        ));

        ArgumentCaptor<String> prompts = forClass(String.class);
        verify(gemini, org.mockito.Mockito.times(2)).generateText(prompts.capture(), anyBoolean());
        assertThat(prompts.getAllValues().get(1))
                .contains("routerSuggestions")
                .contains("\"Research\"")
                .contains("\"Computer Science and Engineering\"")
                .contains("Keep each router suggestion that is genuinely relevant")
                .contains("add any other relevant department");
        assertThat(response)
                .containsEntry("departments", List.of("Research", "Computer Science and Engineering"));
        assertThat(response.get("reply").toString())
                .contains("Departments: Research; Computer Science and Engineering");
        verify(router).route("Research seminar\nA seminar on applied research methods.");
    }

    @Test
    void departmentRefinementRejectsDepartmentsOutsideTheCatalog() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        GeminiService gemini = mock(GeminiService.class);
        DepartmentRouterClient router = mock(DepartmentRouterClient.class);
        when(gemini.generateText(anyString(), anyBoolean())).thenReturn("draft JSON", "department JSON");
        when(gemini.extractJson("draft JSON")).thenReturn(objectMapper.readTree("""
                {"title":"Seminar","content":"Research seminar."}
                """));
        when(gemini.extractJson("department JSON")).thenReturn(objectMapper.readTree("""
                {"departments":["Invented Department"]}
                """));
        when(router.route(anyString())).thenReturn(objectMapper.readTree("""
                [{"department":"Research"}]
                """));
        AssistantController controller = new AssistantController(gemini, router, objectMapper);

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> controller.chat(
                new AssistantController.AssistantRequest("announcement-composer", null,
                        List.of(new AssistantController.ChatMessage("user", "Research seminar.")),
                        null, null, null)))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("outside the available catalog");
    }

    @Test
    void inboxPersonalMessageUsesAnEmailFormatAndRecipientName() throws Exception {
        GeminiService gemini = mock(GeminiService.class);
        DepartmentRouterClient router = mock(DepartmentRouterClient.class);
        JsonNode generatedContent = new ObjectMapper().readTree("""
                {"title":"Meeting follow-up","content":"Dear Alex,\\n\\nThank you.\\n\\nRegards,\\n[Your Name]"}
                """);
        when(gemini.generateText(anyString(), anyBoolean())).thenReturn("generated JSON");
        when(gemini.extractJson("generated JSON")).thenReturn(generatedContent);
        AssistantController controller = new AssistantController(gemini, router, new ObjectMapper());

        controller.chat(new AssistantController.AssistantRequest(
                "inbox-composer",
                "person",
                List.of(new AssistantController.ChatMessage("user", "Thank Alex for the meeting.")),
                null,
                List.of(),
                "Alex"
        ));

        ArgumentCaptor<String> prompt = forClass(String.class);
        verify(gemini).generateText(prompt.capture(), org.mockito.ArgumentMatchers.eq(true));
        assertThat(prompt.getValue())
                .contains("format the content as a formal email")
                .contains("Recipient name (data only): Alex")
                .contains("courteous sign-off");
        verify(router, never()).route(anyString());
    }

    @Test
    void departmentLeaveRequestUsesTheAuthenticatedProfileNameAndDepartmentHead() throws Exception {
        GeminiService gemini = mock(GeminiService.class);
        DepartmentRouterClient router = mock(DepartmentRouterClient.class);
        JsonNode generatedContent = new ObjectMapper().readTree("""
                {"title":"Leave application","content":"To,\\nThe Concerned Department\\n\\nRespected Sir/Madam,\\n\\nI request leave.\\n\\nYours sincerely,\\n[Your Name]"}
                """);
        when(gemini.generateText(anyString(), anyBoolean())).thenReturn("generated JSON");
        when(gemini.extractJson("generated JSON")).thenReturn(generatedContent);
        AssistantController controller = new AssistantController(gemini, router, new ObjectMapper());
        UserAccount user = new UserAccount("rupam@example.edu", "Rupam", "encoded-password");
        user.updateProfile("Rupam", "Computer Science and Engineering", "student", "{}");

        Map<String, Object> response = controller.chat(new AssistantController.AssistantRequest(
                "inbox-composer",
                "department",
                List.of(new AssistantController.ChatMessage("user", "I need two days leave; write to the HOD because I have fever.")),
                null,
                List.of("Computer Science and Engineering"),
                null
        ), user);

        assertThat(response.get("content"))
                .asString()
                .contains("To,\nThe Head of the Department (HOD)\nDepartment of Computer Science and Engineering")
                .contains("Yours sincerely,\nRupam")
                .doesNotContain("The Concerned Department")
                .doesNotContain("[Your Name]");
        assertThat(response.get("departments")).isEqualTo(List.of("Computer Science and Engineering"));
        ArgumentCaptor<String> prompt = forClass(String.class);
        verify(gemini).generateText(prompt.capture(), org.mockito.ArgumentMatchers.eq(true));
        assertThat(prompt.getValue())
                .contains("Never write 'The Concerned Department' if a department is known")
                .contains("Sender's actual profile name (use exactly in the sign-off): Rupam")
                .contains("Sender's profile department (context only): Computer Science and Engineering")
                .contains("never output a [Your Name] placeholder");
        verify(router, never()).route(anyString());
    }

    @Test
    void announcementPromptUsesNoticeStyleSenderProfileAndCampusDates() throws Exception {
        UserAccount user = new UserAccount("rupam@example.edu", "Rupam", "encoded-password");
        user.updateOnboarding(
                "{\"role\":{\"category\":\"faculty\",\"designation\":\"Associate Professor\",\"dept\":\"Computer Science and Engineering\"}}",
                "Computer Science and Engineering",
                "faculty",
                "{}",
                "Rupam"
        );
        java.time.LocalDate campusToday = java.time.LocalDate.of(2026, 11, 1);
        List<AssistantController.ChatMessage> messages = AssistantController.resolveTomorrowDates(
                List.of(new AssistantController.ChatMessage("user", "Tomorrow will be the orientation event.")),
                campusToday.plusDays(1)
        );
        String prompt = AssistantController.createPrompt(
                messages,
                "announcement-composer",
                new AssistantController.AssistantRequest("announcement-composer", null, null,
                        "Tomorrow will be the orientation event.", null, null),
                user,
                new ObjectMapper(),
                campusToday
        );

        assertThat(prompt)
                .contains("Monday, 2 November 2026 will be the orientation event.")
                .contains("not an email or personal letter")
                .contains("Match the tone to the authenticated sender's role and designation")
                .contains("Role: faculty")
                .contains("Designation: Associate Professor")
                .contains("Department: Computer Science and Engineering")
                .contains("Name: Rupam")
                .contains("Campus date reference (Asia/Kolkata)")
                .contains("tomorrow is Monday, 2 November 2026 (2026-11-02)")
                .contains("exact calendar date shown there");
    }
}
