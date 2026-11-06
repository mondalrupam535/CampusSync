package campussync.messages;

import campussync.auth.UserAccount;
import campussync.auth.UserAccountRepository;
import campussync.security.AuthInterceptor;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/messages")
public class MessageController {
    private final CampusMessageRepository messages;
    private final CampusMessageReceiptRepository receipts;
    private final UserAccountRepository users;
    private final ObjectMapper objectMapper;

    public MessageController(CampusMessageRepository messages, CampusMessageReceiptRepository receipts,
                             UserAccountRepository users, ObjectMapper objectMapper) {
        this.messages = messages;
        this.receipts = receipts;
        this.users = users;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(HttpServletRequest request) {
        UserAccount current = currentUser(request);
        Map<UUID, CampusMessage> unique = new LinkedHashMap<>();
        messages.findBySenderIdOrRecipientUserIdOrderByCreatedAtDesc(current.getId(), current.getId())
                .forEach(message -> unique.put(message.getId(), message));
        if (!current.getDepartment().isBlank()) {
            messages.findByRecipientDepartmentsJsonContainingOrderByCreatedAtDesc(current.getDepartment())
                    .stream()
                    .filter(message -> targetsDepartment(message, current.getDepartment()))
                    .forEach(message -> unique.put(message.getId(), message));
        }
        List<CampusMessage> orderedMessages = unique.values().stream()
                .sorted(Comparator.comparing(CampusMessage::getCreatedAt).reversed())
                .toList();
        List<UUID> departmentMessageIds = orderedMessages.stream()
                .filter(message -> message.getRecipientUserId() == null)
                .map(CampusMessage::getId).toList();
        Set<UUID> readDepartmentMessageIds = departmentMessageIds.isEmpty() ? Set.of()
                : receipts.findByMessageIdInAndRecipientUserId(departmentMessageIds, current.getId())
                        .stream().map(CampusMessageReceipt::getMessageId).collect(Collectors.toSet());
        return orderedMessages.stream()
                .map(message -> toView(message, current, readDepartmentMessageIds))
                .toList();
    }

    @PostMapping
    @Transactional
    public Map<String, Object> send(@Valid @RequestBody SendMessageRequest request, HttpServletRequest servletRequest)
            throws JsonProcessingException {
        UserAccount sender = currentUser(servletRequest);
        String subject = request.subject().trim();
        String body = request.content().trim();
        if (subject.isBlank() || body.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Subject and message body are required.");
        }

        UserAccount recipient = null;
        List<String> departments = request.recipientDepartments() == null
                ? List.of() : request.recipientDepartments().stream().map(String::trim).filter(value -> !value.isBlank()).distinct().toList();
        if (request.recipientEmail() != null && !request.recipientEmail().isBlank()) {
            if (!departments.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose either a person or departments.");
            recipient = users.findByEmailIgnoreCase(request.recipientEmail().trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "The selected recipient does not have a CampusSync account."));
            if (recipient.getId().equals(sender.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot send a personal message to yourself.");
            }
        } else if (departments.isEmpty() || departments.size() > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose between 1 and 10 recipient departments.");
        }

        String encodedDepartments = objectMapper.writeValueAsString(departments);
        CampusMessage saved = messages.save(new CampusMessage(sender, recipient, encodedDepartments,
                subject.substring(0, Math.min(subject.length(), 240)), body, request.important(), request.actionRequired()));
        return toView(saved, sender, Set.of());
    }

    @PutMapping("/{id}/read")
    @Transactional
    public Map<String, Object> markRead(@PathVariable UUID id, HttpServletRequest request) {
        UserAccount user = currentUser(request);
        CampusMessage message = messages.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message was not found."));
        boolean personalRecipient = user.getId().equals(message.getRecipientUserId());
        if (!personalRecipient && !targetsDepartment(message, user.getDepartment())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message was not found.");
        }
        if (personalRecipient) {
            message.markRead();
            messages.save(message);
        } else {
            receipts.findByMessageIdAndRecipientUserId(id, user.getId())
                    .orElseGet(() -> receipts.save(new CampusMessageReceipt(id, user.getId())));
        }
        return Map.of("status", "read");
    }

    @PutMapping("/{id}/unread")
    @Transactional
    public Map<String, Object> markUnread(@PathVariable UUID id, HttpServletRequest request) {
        UserAccount user = currentUser(request);
        CampusMessage message = messages.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message was not found."));
        boolean personalRecipient = user.getId().equals(message.getRecipientUserId());
        if (!personalRecipient && !targetsDepartment(message, user.getDepartment())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Message was not found.");
        }
        if (personalRecipient) {
            message.markUnread();
            messages.save(message);
        } else {
            receipts.findByMessageIdAndRecipientUserId(id, user.getId()).ifPresent(receipts::delete);
        }
        return Map.of("status", "unread");
    }

    private Map<String, Object> toView(CampusMessage message, UserAccount current, Set<UUID> readDepartmentMessageIds) {
        boolean sent = message.getSenderId().equals(current.getId());
        UserAccount sender = sent ? current : users.findById(message.getSenderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Message sender is unavailable."));
        String senderName = sent ? "You" : sender.getDisplayName();
        String senderMeta = sent ? "Sent message" : sender.getDepartment();
        String plain = message.getBodyText();
        String htmlBody = escapeHtml(plain).replace("\r\n", "\n").replace("\n", "<br>");
        List<String> departments;
        try {
            departments = objectMapper.readValue(message.getRecipientDepartmentsJson(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Message recipient data is invalid.", error);
        }
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", message.getId().toString());
        view.put("sender", sent ? "You" : sender.getDepartment().isBlank() ? senderName : sender.getDepartment());
        view.put("senderName", senderName);
        view.put("senderMeta", senderMeta);
        view.put("initials", initials(senderName));
        view.put("subject", message.getSubject());
        view.put("snippet", plain.length() > 100 ? plain.substring(0, 100) : plain);
        view.put("time", message.getCreatedAt().format(DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)));
        view.put("createdAt", message.getCreatedAt().toString());
        boolean unread = !sent && (message.getRecipientUserId() == null
                ? !readDepartmentMessageIds.contains(message.getId()) : !message.isRecipientRead());
        view.put("unread", unread);
        view.put("important", message.isImportant());
        view.put("actionReq", message.isActionRequired());
        view.put("body", htmlBody);
        view.put("hasAttachment", false);
        view.put("folder", sent ? "sent" : "inbox");
        view.put("recipientEmail", message.getRecipientUserId() == null ? "" :
                users.findById(message.getRecipientUserId()).map(UserAccount::getEmail).orElse(""));
        view.put("departments", departments);
        return view;
    }

    private static String initials(String value) {
        String[] parts = value.trim().split("\\s+");
        String first = parts.length > 0 && !parts[0].isBlank() ? parts[0].substring(0, 1) : "C";
        String last = parts.length > 1 ? parts[parts.length - 1].substring(0, 1) : "S";
        return (first + last).toUpperCase(Locale.ROOT);
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private boolean targetsDepartment(CampusMessage message, String department) {
        if (department == null || department.isBlank()) return false;
        try {
            List<String> departments = objectMapper.readValue(message.getRecipientDepartmentsJson(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            return departments.contains(department);
        } catch (JsonProcessingException error) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Message recipient data is invalid.", error);
        }
    }

    private static UserAccount currentUser(HttpServletRequest request) {
        return (UserAccount) request.getAttribute(AuthInterceptor.USER_ATTRIBUTE);
    }

    public record SendMessageRequest(@NotBlank @Size(max = 240) String subject,
                                     @NotBlank @Size(max = 100000) String content,
                                     @Size(max = 320) String recipientEmail,
                                     @Size(max = 10) List<@Size(max = 180) String> recipientDepartments,
                                     boolean important,
                                     boolean actionRequired) {}
}
