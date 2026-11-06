package campussync;

import campussync.auth.UserAccount;
import campussync.auth.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockCookie;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "campussync.admin-emails=campus-admin@example.edu")
@AutoConfigureMockMvc
class BackendIntegrationTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private UserAccountRepository users;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void registrationOnboardingWorkspaceAndDirectMessagingPersistInDatabase() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String senderEmail = "sender-" + suffix + "@example.edu";
        String recipientEmail = "recipient-" + suffix + "@example.edu";
        String colleagueEmail = "colleague-" + suffix + "@example.edu";
        MockCookie senderCookie = register(senderEmail, "Sender Example");
        MockCookie recipientCookie = register(recipientEmail, "Recipient Example");
        MockCookie colleagueCookie = register(colleagueEmail, "Colleague Example");

        mockMvc.perform(get("/api/contacts").param("q", "recipient").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value(recipientEmail));
        mockMvc.perform(get("/api/contacts").param("q", "sender").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(senderEmail));
        mockMvc.perform(get("/api/workspace/events").cookie(recipientCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.nullValue()));

        UserAccount savedSender = users.findByEmailIgnoreCase(senderEmail).orElseThrow();
        assertThat(savedSender.getPasswordHash()).isNotBlank().doesNotContain("StrongPassword123!");

        mockMvc.perform(put("/api/onboarding/profile")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sender Example\",\"email\":\"" + senderEmail
                                + "\",\"photo\":\"data:image/png;base64,dGVzdA==\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed.step1").value(true))
                .andExpect(jsonPath("$.profile.photo").value("data:image/png;base64,dGVzdA=="));
        mockMvc.perform(put("/api/onboarding/role")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"student\",\"dept\":\"Computer Science and Engineering\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/onboarding/role")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"student\",\"dept\":\"Computer Science and Engineering\",\"designation\":\"Student\",\"joining\":\"2025\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/onboarding/role")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"student\",\"dept\":\"Computer Science and Engineering\",\"designation\":\"\",\"specialization\":\"Artificial Intelligence and Machine Learning (AI/ML)\",\"joining\":\"2025\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed.step2").value(true));
        mockMvc.perform(put("/api/onboarding/student")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reg\":\"TEST-1\",\"school\":\"SEAS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed.step3").value(true));
        mockMvc.perform(get("/api/onboarding").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.student.reg").value("TEST-1"));

        mockMvc.perform(put("/api/workspace/events")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"events\":[],\"attention\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.events").isArray());
        mockMvc.perform(get("/api/workspace/events").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.attention").isArray());

        mockMvc.perform(post("/api/messages")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Hello\",\"content\":\"A <safe> message\",\"recipientEmail\":\""
                                + recipientEmail + "\",\"important\":false,\"actionRequired\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.folder").value("sent"));
        mockMvc.perform(get("/api/messages").cookie(recipientCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].folder").value("inbox"))
                .andExpect(jsonPath("$[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$[0].body").value("A &lt;safe&gt; message"));

        saveStudentDepartment(recipientCookie);
        saveStudentDepartment(colleagueCookie);
        MvcResult departmentSend = mockMvc.perform(post("/api/messages")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"subject\":\"Department update\",\"content\":\"Read receipts are per person.\","
                                + "\"recipientDepartments\":[\"Computer Science and Engineering\"],"
                                + "\"important\":false,\"actionRequired\":false}"))
                .andExpect(status().isOk())
                .andReturn();
        String departmentMessageId = objectMapper.readTree(departmentSend.getResponse().getContentAsString())
                .path("id").asText();
        mockMvc.perform(get("/api/messages").cookie(recipientCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(departmentMessageId))
                .andExpect(jsonPath("$[0].unread").value(true));
        mockMvc.perform(put("/api/messages/" + departmentMessageId + "/read")
                        .cookie(recipientCookie).header("X-CampusSync-Request", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/messages").cookie(recipientCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unread").value(false));
        mockMvc.perform(get("/api/messages").cookie(colleagueCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unread").value(true));
        mockMvc.perform(put("/api/messages/" + departmentMessageId + "/unread")
                        .cookie(recipientCookie).header("X-CampusSync-Request", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/messages").cookie(recipientCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].unread").value(true));

        mockMvc.perform(post("/api/auth/login")
                        .header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + senderEmail + "\",\"password\":\"StrongPassword123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Sender Example"));

        mockMvc.perform(put("/api/onboarding/profile/details")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"profile\":{\"name\":\"Sender Example\",\"username\":\"sender-example\","
                                + "\"phone\":\"+1 555 0100\",\"bio\":\"Campus project coordinator\","
                                + "\"photo\":\"data:image/png;base64,dGVzdA==\"},"
                                + "\"role\":{\"category\":\"admin\",\"dept\":\"Everything\","
                                + "\"designation\":\"Student\",\"specialization\":\"Computer Science\",\"joining\":\"2025\"},"
                                + "\"student\":{\"reg\":\"TEST-1\",\"school\":\"SEAS\",\"programme\":\"B.Tech\","
                                + "\"spec\":\"Computer Science\",\"admission\":\"2025\",\"acyear\":\"Second Year\","
                                + "\"section\":\"A\"},\"staff\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.username").value("sender-example"))
                .andExpect(jsonPath("$.profile.phone").value("+1 555 0100"))
                .andExpect(jsonPath("$.profile.bio").value("Campus project coordinator"))
                .andExpect(jsonPath("$.student.programme").value("B.Tech"));
        assertThat(users.findByEmailIgnoreCase(senderEmail).orElseThrow().getDisplayName())
                .isEqualTo("Sender Example");
        mockMvc.perform(get("/api/auth/me").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("student"))
                .andExpect(jsonPath("$.user.isAdmin").value(false));
        mockMvc.perform(get("/api/admin/users").cookie(senderCookie))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/onboarding/role")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"faculty\",\"dept\":\"Computer Science and Engineering\","
                                + "\"designation\":\"Faculty\",\"specialization\":\"\",\"joining\":\"2025\"}"))
                .andExpect(status().isForbidden());

        MockCookie adminCookie = register("campus-admin@example.edu", "Campus Admin");
        mockMvc.perform(get("/api/auth/me").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.isAdmin").value(true));
        mockMvc.perform(get("/api/admin/users").cookie(adminCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").exists());
        mockMvc.perform(put("/api/admin/users/" + users.findByEmailIgnoreCase(senderEmail).orElseThrow().getId() + "/role")
                        .cookie(adminCookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"faculty\",\"department\":\"Academic Affairs\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(senderCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("faculty"))
                .andExpect(jsonPath("$.user.department").value("Academic Affairs"));

        mockMvc.perform(post("/api/auth/logout")
                        .cookie(senderCookie).header("X-CampusSync-Request", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(senderCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void frontendIsServedAndAttachmentsAreAccountOwned() throws Exception {
        mockMvc.perform(get("/"))
                .andExpect(status().is3xxRedirection())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .redirectedUrl("/login_signup%20page/index.html"));
        mockMvc.perform(get("/dashboard/api-client.js"))
                .andExpect(status().isOk());

        MockCookie owner = register("file-owner-" + UUID.randomUUID().toString().substring(0, 8) + "@example.edu", "File Owner");
        MockCookie other = register("file-other-" + UUID.randomUUID().toString().substring(0, 8) + "@example.edu", "Other User");
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "private file".getBytes());
        MvcResult upload = mockMvc.perform(multipart("/api/files")
                        .file(file).cookie(owner).header("X-CampusSync-Request", "1"))
                .andExpect(status().isOk())
                .andReturn();
        String fileId = objectMapper.readTree(upload.getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(get("/api/files/" + fileId).cookie(owner))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().bytes("private file".getBytes()));
        mockMvc.perform(get("/api/files/" + fileId).cookie(other))
                .andExpect(status().isNotFound());
    }

    private MockCookie register(String email, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"email\":\"" + email
                                + "\",\"password\":\"StrongPassword123!\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return (MockCookie) result.getResponse().getCookie("CAMPUSSYNC_SESSION");
    }

    private void saveStudentDepartment(MockCookie cookie) throws Exception {
        mockMvc.perform(put("/api/onboarding/role")
                        .cookie(cookie).header("X-CampusSync-Request", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"category\":\"student\",\"dept\":\"Computer Science and Engineering\",\"designation\":\"\",\"specialization\":\"Artificial Intelligence and Machine Learning (AI/ML)\",\"joining\":\"2025\"}"))
                .andExpect(status().isOk());
    }
}
