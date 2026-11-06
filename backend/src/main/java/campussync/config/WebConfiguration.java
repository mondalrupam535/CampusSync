package campussync.config;

import campussync.security.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final AuthInterceptor authInterceptor;
    private final CampusSyncProperties properties;

    public WebConfiguration(AuthInterceptor authInterceptor, CampusSyncProperties properties) {
        this.authInterceptor = authInterceptor;
        this.properties = properties;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor).addPathPatterns("/api/**", "/assistant-chat", "/university-calendar");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path frontendRoot = Path.of(properties.frontendRoot()).toAbsolutePath().normalize();
        registry.addResourceHandler("/**")
                .addResourceLocations(frontendRoot.toUri().toString());
    }
}
