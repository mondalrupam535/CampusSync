\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE demo_user_seed ON COMMIT DROP AS
WITH names AS (
    SELECT
        ARRAY[
            'Aanya', 'Aarav', 'Ananya', 'Arjun', 'Dev',
            'Diya', 'Ishaan', 'Kavya', 'Neha', 'Rohan',
            'Saanvi', 'Vihaan', 'Aditya', 'Aditi', 'Kabir',
            'Meera', 'Nikhil', 'Priya', 'Rahul', 'Sana',
            'Karan', 'Pooja', 'Yash', 'Tara', 'Zoya'
        ]::TEXT[] AS first_names,
        ARRAY[
            'Sharma', 'Reddy', 'Kumar', 'Nair', 'Iyer',
            'Rao', 'Gupta', 'Mehta', 'Singh', 'Patel',
            'Verma', 'Das', 'Menon', 'Shah', 'Joshi',
            'Kapoor', 'Bose', 'Roy', 'Jain', 'Kulkarni'
        ]::TEXT[] AS last_names,
        ARRAY[
            'Computer Science and Engineering',
            'Electrical and Electronics Engineering',
            'Electronics and Communication Engineering',
            'Mechanical Engineering',
            'Civil Engineering',
            'Mathematics and Sciences',
            'Easwari School of Liberal Arts (ESLA)',
            'Paari School of Business (PSB)',
            'Academic Affairs',
            'Library'
        ]::TEXT[] AS departments
)
SELECT
    person.number AS sequence,
    format('campussync.person%s@example.test', lpad(person.number::TEXT, 4, '0')) AS email,
    names.first_names[((person.number - 1) / 20) + 1] || ' '
        || names.last_names[((person.number - 1) % 20) + 1] AS display_name,
    names.departments[((person.number - 1) % cardinality(names.departments)) + 1] AS department,
    CASE
        WHEN person.number % 25 = 0 THEN 'staff'
        WHEN person.number % 20 = 0 THEN 'faculty'
        ELSE 'student'
    END AS role_name
FROM generate_series(1, 500) AS person(number)
CROSS JOIN names;

INSERT INTO user_account (
    id, email, display_name, password_hash, department, role_name, profile_json, onboarding_json
)
SELECT
    md5('campussync-demo-user:' || email)::UUID,
    email,
    display_name,
    NULL,
    department,
    role_name,
    jsonb_build_object(
        'name', display_name,
        'email', email,
        'username', 'person' || lpad(sequence::TEXT, 4, '0')
    )::TEXT,
    jsonb_build_object(
        'profile', jsonb_build_object(
            'name', display_name,
            'email', email,
            'username', 'person' || lpad(sequence::TEXT, 4, '0')
        ),
        'role', jsonb_build_object(
            'category', role_name,
            'dept', department,
            'designation', CASE role_name
                WHEN 'faculty' THEN 'Assistant Professor'
                WHEN 'staff' THEN 'Campus Staff'
                ELSE 'Student'
            END,
            'joining', CASE role_name WHEN 'student' THEN '2024' ELSE '2019' END,
            'specialization', CASE WHEN role_name = 'student' THEN 'Computer Science' ELSE '' END
        ),
        'student', CASE WHEN role_name = 'student' THEN jsonb_build_object(
            'reg', 'DEMO' || lpad(sequence::TEXT, 4, '0'),
            'school', CASE
                WHEN department LIKE '%Liberal Arts%' THEN 'ESLA'
                WHEN department LIKE '%Business%' THEN 'PSB'
                ELSE 'SEAS'
            END,
            'programme', 'Undergraduate',
            'spec', 'Computer Science',
            'admission', '2024',
            'acyear', 'Second Year',
            'section', 'A',
            'dept', department
        ) ELSE NULL END,
        'staff', CASE WHEN role_name = 'student' THEN NULL ELSE jsonb_build_object(
            'employeeId', 'DEMO-EMP-' || lpad(sequence::TEXT, 4, '0'),
            'office', department
        ) END,
        'completed', jsonb_build_object('step1', TRUE, 'step2', TRUE, 'step3', TRUE)
    )::TEXT
FROM demo_user_seed
ON CONFLICT (email) DO NOTHING;

CREATE TEMP TABLE demo_people ON COMMIT DROP AS
SELECT
    users.id,
    users.email,
    users.display_name,
    users.department,
    seed.sequence
FROM user_account AS users
JOIN demo_user_seed AS seed ON seed.email = users.email;

DO $$
BEGIN
    IF (SELECT count(*) FROM demo_people) <> 500 THEN
        RAISE EXCEPTION 'Expected 500 seeded sample accounts, found %.',
            (SELECT count(*) FROM demo_people);
    END IF;
END
$$;

CREATE TEMP TABLE demo_owner ON COMMIT DROP AS
SELECT id, email, department
FROM user_account
WHERE lower(email) = lower(:'owner_email');

DO $$
BEGIN
    IF (SELECT count(*) FROM demo_owner) <> 1 THEN
        RAISE EXCEPTION 'The requested CampusSync account was not found; no demo data was committed.';
    END IF;
END
$$;

INSERT INTO campus_message (
    id, sender_id, recipient_user_id, recipient_departments_json,
    subject, body_text, important, action_required, recipient_read, created_at
)
SELECT
    md5('campussync-demo-person-message:' || sender.sequence)::UUID,
    sender.id,
    recipient.id,
    '[]',
    CASE sender.sequence % 5
        WHEN 0 THEN 'Study group coordination'
        WHEN 1 THEN 'Campus technology workshop'
        WHEN 2 THEN 'Library and assessment week'
        WHEN 3 THEN 'Student club meeting'
        ELSE 'Department project update'
    END,
    format(
        'Hi %s, sharing an update from %s. Let us coordinate through CampusSync and keep the campus project moving.',
        recipient.display_name,
        sender.department
    ),
    sender.sequence % 7 = 0,
    sender.sequence % 13 = 0,
    sender.sequence % 4 <> 0,
    CURRENT_TIMESTAMP - make_interval(
        days => (sender.sequence * 7) % 29,
        hours => (sender.sequence * 11) % 24
    )
FROM demo_people AS sender
JOIN demo_people AS recipient
    ON recipient.sequence = CASE WHEN sender.sequence = 500 THEN 1 ELSE sender.sequence + 1 END
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE demo_departments ON COMMIT DROP AS
SELECT department
FROM unnest(ARRAY[
    'Computer Science and Engineering',
    'Electrical and Electronics Engineering',
    'Electronics and Communication Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Mathematics and Sciences',
    'Easwari School of Liberal Arts (ESLA)',
    'Paari School of Business (PSB)',
    'Academic Affairs',
    'Library'
]::TEXT[]) AS departments(department);

INSERT INTO campus_message (
    id, sender_id, recipient_user_id, recipient_departments_json,
    subject, body_text, important, action_required, recipient_read, created_at
)
SELECT
    md5('campussync-demo-department-message:' || department.department)::UUID,
    sender.id,
    NULL,
    jsonb_build_array(department.department)::TEXT,
    CASE department.department
        WHEN 'Academic Affairs' THEN 'Hackathon 2026 Phase 1 registrations'
        WHEN 'Library' THEN 'Library hours during assessment week'
        ELSE 'Campus and department updates'
    END,
    format(
        'Campus update for %s: please review the latest schedule, upcoming activities, and department notices.',
        department.department
    ),
    department.department IN ('Academic Affairs', 'Library'),
    department.department = 'Academic Affairs',
    FALSE,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
FROM demo_departments AS department
JOIN LATERAL (
    SELECT id
    FROM demo_people
    WHERE demo_people.department = department.department
    ORDER BY sequence
    LIMIT 1
) AS sender ON TRUE
ON CONFLICT (id) DO NOTHING;

INSERT INTO campus_message_receipt (id, message_id, recipient_user_id, read_at)
SELECT
    md5('campussync-demo-read:' || person.id::TEXT || ':' || department.department)::UUID,
    md5('campussync-demo-department-message:' || department.department)::UUID,
    person.id,
    CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM demo_people AS person
JOIN demo_departments AS department ON department.department = person.department
WHERE person.sequence % 5 <> 0
ON CONFLICT (message_id, recipient_user_id) DO NOTHING;

INSERT INTO campus_message (
    id, sender_id, recipient_user_id, recipient_departments_json,
    subject, body_text, important, action_required, recipient_read, created_at
)
SELECT
    md5('campussync-demo-owner-message:' || owner.id::TEXT || ':' || message.number)::UUID,
    sender.id,
    owner.id,
    '[]',
    CASE message.number
        WHEN 1 THEN 'Hackathon 2026 registration reminder'
        WHEN 2 THEN 'CSE lab schedule maintenance notice'
        WHEN 3 THEN 'Please review the semester event calendar'
        WHEN 4 THEN 'Library assessment week hours'
        WHEN 5 THEN 'Student club coordination update'
        WHEN 6 THEN 'Department workshop invitation'
        WHEN 7 THEN 'Project group meeting follow-up'
        ELSE 'Campus services weekly update'
    END,
    format(
        'Hello, this is a simulated CampusSync message from %s. Please review the update and coordinate with your campus community.',
        sender.display_name
    ),
    message.number IN (1, 3, 6),
    message.number <= 3,
    message.number > 4,
    CURRENT_TIMESTAMP - CASE message.number
        WHEN 1 THEN INTERVAL '2 hours'
        WHEN 2 THEN INTERVAL '7 hours'
        WHEN 3 THEN INTERVAL '20 hours'
        WHEN 4 THEN INTERVAL '2 days'
        WHEN 5 THEN INTERVAL '4 days'
        WHEN 6 THEN INTERVAL '8 days'
        WHEN 7 THEN INTERVAL '14 days'
        ELSE INTERVAL '24 days'
    END
FROM demo_owner AS owner
CROSS JOIN generate_series(1, 8) AS message(number)
JOIN demo_people AS sender ON sender.sequence = message.number
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    v_owner_id UUID;
    v_workspace_id UUID;
    v_payload JSONB;
    v_notice JSONB;
    v_next_id INTEGER;
BEGIN
    SELECT id INTO v_owner_id FROM demo_owner;
    SELECT document.id, document.payload::JSONB
    INTO v_workspace_id, v_payload
    FROM workspace_document AS document
    WHERE document.owner_id = v_owner_id AND document.collection_name = 'announcements';

    IF v_workspace_id IS NULL THEN
        v_workspace_id := md5('campussync-demo-announcements:' || v_owner_id::TEXT)::UUID;
        v_payload := '[]'::JSONB;
        INSERT INTO workspace_document (id, owner_id, collection_name, payload)
        VALUES (v_workspace_id, v_owner_id, 'announcements', v_payload::TEXT);
    END IF;

    IF jsonb_typeof(v_payload) <> 'array' THEN
        RAISE EXCEPTION 'The existing announcements workspace is not a JSON array; refusing to overwrite it.';
    END IF;

    SELECT COALESCE(MAX((item.value ->> 'id')::INTEGER), 0)
    INTO v_next_id
    FROM jsonb_array_elements(v_payload) AS item(value)
    WHERE (item.value ->> 'id') ~ '^[0-9]+$';

    FOR v_notice IN
        SELECT jsonb_build_object(
            'title', sample.title,
            'dept', sample.department,
            'issuer', sample.issuer,
            'initials', sample.initials,
            'date', to_char(CURRENT_DATE, 'Mon DD, YYYY'),
            'status', 'Published',
            'needsAction', sample.needs_action,
            'archived', FALSE,
            'category', sample.category,
            'priority', sample.priority,
            'ackRequired', sample.needs_action,
            'attachment', '',
            'body', sample.body,
            'totalRecipients', NULL,
            'delivered', NULL,
            'read', NULL,
            'acknowledged', NULL
        )
        FROM (VALUES
            (
                'Hackathon 2026 Phase 1 Registrations Open',
                'Academic Affairs', 'Academic Affairs', 'AA',
                'University', 'Important', FALSE,
                'Registration is open for Phase 1 of Hackathon 2026. Students can form teams and submit ideas through the event portal.'
            ),
            (
                'CSE Lab Schedule Maintenance Notice',
                'Computer Science and Engineering', 'ITKM', 'IT',
                'Department', 'Normal', FALSE,
                'Please review the updated laboratory schedule and coordinate with the department before your next lab session.'
            ),
            (
                'Library Extended Hours during Exams',
                'Library', 'University Librarian', 'UL',
                'University', 'Normal', TRUE,
                'The library will extend its opening hours during the examination period. Please check the library desk for the current schedule.'
            ),
            (
                'Semester Review Meeting',
                'Registrar''s Office', 'Registrar''s Office', 'RO',
                'University', 'Important', FALSE,
                'The semester review meeting will cover academic progress, upcoming dates, and campus-wide coordination.'
            )
        ) AS sample(title, department, issuer, initials, category, priority, needs_action, body)
    LOOP
        IF NOT EXISTS (
            SELECT 1
        FROM jsonb_array_elements(v_payload) AS existing(value)
        WHERE existing.value ->> 'title' = v_notice ->> 'title'
              AND COALESCE((existing.value ->> 'archived')::BOOLEAN, FALSE) = FALSE
        ) THEN
        v_next_id := v_next_id + 1;
        v_notice := jsonb_set(v_notice, '{id}', to_jsonb(v_next_id), TRUE);
        v_payload := v_payload || jsonb_build_array(v_notice);
        END IF;
    END LOOP;

    UPDATE workspace_document
    SET payload = v_payload::TEXT, updated_at = CURRENT_TIMESTAMP
    WHERE workspace_document.id = v_workspace_id;
END
$$;

SELECT
    (SELECT count(*) FROM demo_people) AS sample_accounts,
    (SELECT count(*) FROM campus_message AS message
        JOIN demo_people AS sender
          ON message.id = md5('campussync-demo-person-message:' || sender.sequence)::UUID) AS person_to_person_messages,
    (SELECT count(*) FROM campus_message_receipt AS receipt
        JOIN demo_departments AS department
          ON receipt.message_id = md5('campussync-demo-department-message:' || department.department)::UUID) AS simulated_read_receipts;

COMMIT;
