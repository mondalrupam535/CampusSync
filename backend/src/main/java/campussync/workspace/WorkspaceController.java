package campussync.workspace;

import campussync.auth.UserAccount;
import campussync.security.AuthInterceptor;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceController {
    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @GetMapping("/{collection}")
    public Map<String, JsonNode> get(@PathVariable String collection, HttpServletRequest request) {
        JsonNode data = workspaceService.read(currentUser(request), collection);
        return Map.of("data", data == null ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : data);
    }

    @PutMapping("/{collection}")
    public Map<String, JsonNode> put(@PathVariable String collection, @RequestBody JsonNode payload,
                                    HttpServletRequest request) {
        return Map.of("data", workspaceService.write(currentUser(request), collection, payload));
    }

    @DeleteMapping("/{collection}")
    public Map<String, String> delete(@PathVariable String collection, HttpServletRequest request) {
        workspaceService.delete(currentUser(request), collection);
        return Map.of("status", "deleted");
    }

    private static UserAccount currentUser(HttpServletRequest request) {
        return (UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE);
    }
}
