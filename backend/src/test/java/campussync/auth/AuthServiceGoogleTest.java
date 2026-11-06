package campussync.auth;

import campussync.config.CampusSyncProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AuthServiceGoogleTest {
    private static final String ACCESS_TOKEN = "google-access-token";
    private static final String EMAIL = "new.user@example.com";
    private static final String SUBJECT = "google-subject";

    private UserAccountRepository users;
    private LoginSessionRepository sessions;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder =
            mock(org.springframework.security.crypto.password.PasswordEncoder.class);
    private final CampusSyncProperties properties =
            new CampusSyncProperties("../", 30, false, "", "", "", "", "");
    private MockRestServiceServer googleServer;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepository.class);
        sessions = mock(LoginSessionRepository.class);
        RestClient.Builder restClientBuilder = RestClient.builder();
        googleServer = MockRestServiceServer.bindTo(restClientBuilder).build();
        authService = new AuthService(users, sessions, passwordEncoder, properties, restClientBuilder);
        when(users.findByGoogleSubject(SUBJECT)).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.empty());
    }

    private void expectGoogleIdentity() {
        googleServer.expect(requestTo("https://openidconnect.googleapis.com/v1/userinfo"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer " + ACCESS_TOKEN))
                .andRespond(withSuccess("""
                        {"email":"new.user@example.com","email_verified":true,"name":"New User","sub":"google-subject"}
                        """, MediaType.APPLICATION_JSON));
    }

    @AfterEach
    void verifyGoogleRequest() {
        googleServer.verify();
    }

    @Test
    void googleSignInRejectsUnknownAccountWithoutCreatingIt() {
        expectGoogleIdentity();
        assertThatThrownBy(() -> authService.googleLogin(ACCESS_TOKEN))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Please sign up first.");

        verify(users, never()).save(any(UserAccount.class));
        verify(sessions, never()).save(any(LoginSession.class));
    }

    @Test
    void googleRegistrationCreatesAnAccountForVerifiedIdentity() {
        expectGoogleIdentity();
        when(passwordEncoder.encode("StrongPassword123!")).thenReturn("encoded-google-password");
        when(users.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthService.AuthResult result = authService.googleRegister(ACCESS_TOKEN, "StrongPassword123!");

        assertThat(result.user().getEmail()).isEqualTo(EMAIL);
        assertThat(result.user().getGoogleSubject()).isEqualTo(SUBJECT);
        assertThat(result.user().getPasswordHash()).isEqualTo("encoded-google-password");
        verify(users).save(any(UserAccount.class));
        verify(sessions).save(any(LoginSession.class));
    }

    @Test
    void googleRegistrationRejectsShortPasswords() {
        assertThatThrownBy(() -> authService.googleRegister(ACCESS_TOKEN, "short"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Password must contain 8 to 72 characters.");

        verify(users, never()).save(any(UserAccount.class));
        verify(sessions, never()).save(any(LoginSession.class));
    }
}
