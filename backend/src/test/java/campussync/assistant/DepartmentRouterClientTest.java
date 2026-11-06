package campussync.assistant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class DepartmentRouterClientTest {
    @TempDir
    Path temporaryDirectory;

    @Test
    void resolvesRouterJarFromAnAncestorWhenProjectIsNested() throws IOException {
        Path workingDirectory = temporaryDirectory.resolve("clone/Java Project/backend");
        Files.createDirectories(workingDirectory);
        Path routerJar = temporaryDirectory.resolve("dept/target/department-router-1.0-shaded.jar");
        Files.createDirectories(routerJar.getParent());
        Files.createFile(routerJar);

        Path resolved = DepartmentRouterClient.resolveJar(
                "../../dept/target/department-router-1.0-shaded.jar",
                workingDirectory
        );

        assertThat(resolved).isEqualTo(routerJar);
    }
}
