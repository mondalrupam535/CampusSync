CREATE TABLE user_account (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    password_hash VARCHAR(100),
    google_subject VARCHAR(255) UNIQUE,
    department VARCHAR(180) NOT NULL DEFAULT '',
    role_name VARCHAR(80) NOT NULL DEFAULT 'student',
    profile_json TEXT NOT NULL DEFAULT '{}',
    onboarding_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE login_session (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX login_session_user_id_idx ON login_session(user_id);
CREATE INDEX login_session_expiration_idx ON login_session(expires_at);

CREATE TABLE workspace_document (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    collection_name VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workspace_document_owner_collection_unique UNIQUE (owner_id, collection_name)
);

CREATE TABLE university_calendar (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL UNIQUE REFERENCES user_account(id) ON DELETE CASCADE,
    filename VARCHAR(180) NOT NULL,
    pdf_bytes BYTEA NOT NULL,
    events_json TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE file_attachment (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    filename VARCHAR(180) NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_bytes BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX file_attachment_owner_id_idx ON file_attachment(owner_id);

CREATE TABLE campus_message (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES user_account(id) ON DELETE CASCADE,
    recipient_departments_json TEXT NOT NULL DEFAULT '[]',
    subject VARCHAR(240) NOT NULL,
    body_text TEXT NOT NULL,
    important BOOLEAN NOT NULL DEFAULT FALSE,
    action_required BOOLEAN NOT NULL DEFAULT FALSE,
    recipient_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT campus_message_has_recipient CHECK (
        recipient_user_id IS NOT NULL OR recipient_departments_json <> '[]'
    )
);
CREATE INDEX campus_message_sender_idx ON campus_message(sender_id, created_at);
CREATE INDEX campus_message_recipient_idx ON campus_message(recipient_user_id, created_at);

CREATE TABLE campus_message_receipt (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES campus_message(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT campus_message_receipt_unique UNIQUE (message_id, recipient_user_id)
);
CREATE INDEX campus_message_receipt_recipient_idx ON campus_message_receipt(recipient_user_id, message_id);
