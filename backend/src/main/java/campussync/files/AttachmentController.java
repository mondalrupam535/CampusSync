package campussync.files;

import campussync.auth.UserAccount;
import campussync.security.AuthInterceptor;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE;

@RestController
@RequestMapping("/api/files")
public class AttachmentController {
    private static final long MAX_FILE_BYTES = 15L * 1024 * 1024;
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\p{Cntrl}]");
    private final StoredAttachmentRepository attachments;

    public AttachmentController(StoredAttachmentRepository attachments) {
        this.attachments = attachments;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file, HttpServletRequest request) throws Exception {
        if (file.isEmpty()) throw new ResponseStatusException(BAD_REQUEST, "Choose a file to upload.");
        if (file.getSize() > MAX_FILE_BYTES) throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "Attachments must be 15 MB or smaller.");
        String originalName = file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename();
        String filename = CONTROL_CHARS.matcher(originalName).replaceAll("").replaceAll("[\\\\/]", "_");
        filename = filename.substring(Math.max(0, filename.length() - 180));
        if (filename.isBlank()) filename = "attachment";
        String contentType = file.getContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : file.getContentType();
        StoredAttachment saved = attachments.save(new StoredAttachment(currentUser(request).getId(),
                filename, contentType, file.getBytes()));
        return Map.of("id", saved.getId().toString(), "filename", saved.getFilename(),
                "contentType", saved.getContentType(), "size", saved.getSizeBytes(),
                "url", "/api/files/" + saved.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ByteArrayResource> download(@PathVariable UUID id, HttpServletRequest request) {
        StoredAttachment attachment = attachments.findByIdAndOwnerId(id, currentUser(request).getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Attachment was not found."));
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(attachment.getFilename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .contentLength(attachment.getSizeBytes())
                .body(new ByteArrayResource(attachment.getFileBytes()));
    }

    private static UserAccount currentUser(HttpServletRequest request) {
        return (UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE);
    }
}
