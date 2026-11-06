package campussync.assistant;

import campussync.config.CampusSyncProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Component
public class DepartmentRouterClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(DepartmentRouterClient.class);
    private final CampusSyncProperties properties;
    private final ObjectMapper objectMapper;
    private Process process;
    private BufferedWriter writer;
    private BufferedReader reader;

    public DepartmentRouterClient(CampusSyncProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    static Path resolveJar(String configuredPath, Path workingDirectory) {
        Path configured = Path.of(configuredPath);
        if (configured.isAbsolute()) return configured.normalize();

        Path directory = workingDirectory.toAbsolutePath().normalize();
        while (directory != null) {
            Path candidate = directory.resolve(configured).normalize();
            if (Files.isRegularFile(candidate)) return candidate;
            directory = directory.getParent();
        }
        return workingDirectory.resolve(configured).toAbsolutePath().normalize();
    }

    public synchronized JsonNode route(String message) {
        try {
            ensureStarted();
            String id = UUID.randomUUID().toString();
            ObjectNode request = objectMapper.createObjectNode();
            request.put("id", id);
            request.put("message", message);
            writer.write(objectMapper.writeValueAsString(request));
            writer.newLine();
            writer.flush();
            String line = reader.readLine();
            if (line == null) throw new IllegalStateException("The department router stopped unexpectedly.");
            JsonNode response = objectMapper.readTree(line);
            if (response.hasNonNull("error")) {
                throw new IllegalStateException(response.path("error").asText());
            }
            if (!id.equals(response.path("id").asText()) || !response.path("departments").isArray()) {
                throw new IllegalStateException("The department router returned an invalid response.");
            }
            return response.path("departments");
        } catch (Exception error) {
            stopProcess();
            LOGGER.error("Department routing failed.", error);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Department routing is unavailable. Build the department-router JAR and try again.", error);
        }
    }

    private void ensureStarted() throws Exception {
        if (process != null && process.isAlive()) return;
        Path jar = resolveJar(properties.departmentRouterJar(), Path.of(""));
        if (!Files.isRegularFile(jar)) {
            throw new IllegalStateException("Department router JAR not found at " + jar);
        }
        ProcessBuilder builder = new ProcessBuilder("java", "-jar", jar.toString(), "--json-lines")
                .directory(jar.getParent().toFile());
        process = builder.start();
        writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8));
        reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        Thread errorReader = new Thread(() -> {
            try (BufferedReader errors = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = errors.readLine()) != null) LOGGER.info("[department-router] {}", line);
            } catch (Exception error) {
                LOGGER.debug("Department router log stream ended.", error);
            }
        }, "department-router-stderr");
        errorReader.setDaemon(true);
        errorReader.start();
    }

    @PreDestroy
    public synchronized void stopProcess() {
        if (process != null) {
            process.destroy();
            process = null;
        }
        writer = null;
        reader = null;
    }
}
