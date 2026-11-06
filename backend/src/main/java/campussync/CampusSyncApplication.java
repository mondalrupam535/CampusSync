package campussync;

import campussync.config.CampusSyncProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(CampusSyncProperties.class)
public class CampusSyncApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampusSyncApplication.class, args);
    }
}
