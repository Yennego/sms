-- Baseline (revision e4b8a1d6c3f2): full schema, generated with pg_dump from a database at that revision.
-- Do not edit; schema changes go in new migrations.

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: announcementtargettype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.announcementtargettype AS ENUM (
    'ALL',
    'STUDENTS',
    'TEACHERS',
    'PARENTS',
    'GRADE',
    'SECTION',
    'CUSTOM'
);

--
-- Name: attendancesource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendancesource AS ENUM (
    'QR',
    'MANUAL',
    'AUTO'
);

--
-- Name: attendancestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendancestatus AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'EXCUSED',
    'SICK',
    'TARDY'
);

--
-- Name: dayofweek; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.dayofweek AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);

--
-- Name: eventtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.eventtype AS ENUM (
    'ACADEMIC',
    'CULTURAL',
    'SPORTS',
    'HOLIDAY',
    'OTHER'
);

--
-- Name: excusestatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.excusestatus AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

--
-- Name: feedbackstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedbackstatus AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'RESOLVED',
    'CLOSED'
);

--
-- Name: feedbacktype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedbacktype AS ENUM (
    'GENERAL',
    'ACADEMIC',
    'FACILITY',
    'STAFF',
    'OTHER'
);

--
-- Name: gradetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gradetype AS ENUM (
    'ASSIGNMENT',
    'QUIZ',
    'TEST',
    'EXAM',
    'PROJECT',
    'PARTICIPATION',
    'OTHER',
    'ATTENDANCE'
);

--
-- Name: resourcetype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resourcetype AS ENUM (
    'DOCUMENT',
    'VIDEO',
    'AUDIO',
    'IMAGE',
    'LINK',
    'OTHER'
);

--
-- Name: submissionstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submissionstatus AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'GRADED',
    'RETURNED'
);

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_grades (
    name character varying(50) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    sequence integer NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    age_range character varying(50)
);

ALTER TABLE ONLY public.academic_grades FORCE ROW LEVEL SECURITY;

--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_years (
    name character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean,
    is_active boolean,
    description text,
    current_semester integer,
    semester_1_start date NOT NULL,
    semester_1_end date NOT NULL,
    semester_2_start date NOT NULL,
    semester_2_end date NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    is_archived boolean DEFAULT false
);

ALTER TABLE ONLY public.academic_years FORCE ROW LEVEL SECURITY;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    old_values json,
    new_values json,
    ip_address character varying(50),
    user_agent text
);

--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id uuid NOT NULL,
    department character varying(100),
    admin_level character varying(50)
);

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    title character varying(255) NOT NULL,
    content text NOT NULL,
    author_id uuid NOT NULL,
    target_type public.announcementtargettype NOT NULL,
    target_id uuid,
    is_active boolean NOT NULL,
    is_pinned boolean NOT NULL,
    publish_date timestamp with time zone NOT NULL,
    expiry_date timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.announcements FORCE ROW LEVEL SECURITY;

--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    title character varying(255) NOT NULL,
    description text,
    type public.gradetype NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    section_id uuid,
    assessment_date date NOT NULL,
    max_score double precision NOT NULL,
    is_published boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    class_id uuid,
    grading_category_id uuid
);

ALTER TABLE ONLY public.assessments FORCE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    title character varying(255) NOT NULL,
    description text,
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    section_id uuid,
    assigned_date date NOT NULL,
    due_date date NOT NULL,
    max_score double precision NOT NULL,
    weight double precision NOT NULL,
    is_published boolean NOT NULL,
    submission_type character varying(50) NOT NULL,
    attachment_url character varying(255),
    rubric jsonb,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    academic_year_id uuid
);

ALTER TABLE ONLY public.assignments FORCE ROW LEVEL SECURITY;

--
-- Name: attendance_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_documents (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    daily_attendance_id uuid NOT NULL,
    filename character varying(255) NOT NULL,
    content_type character varying(100) NOT NULL,
    size_bytes integer NOT NULL,
    data bytea NOT NULL,
    uploaded_by uuid
);

ALTER TABLE ONLY public.attendance_documents FORCE ROW LEVEL SECURITY;

--
-- Name: attendance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_events (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    daily_attendance_id uuid,
    student_id uuid,
    event_type character varying(30) NOT NULL,
    old_status character varying(20),
    new_status character varying(20),
    actor_id uuid,
    device_label character varying(100),
    reason text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.attendance_events FORCE ROW LEVEL SECURITY;

--
-- Name: attendance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_settings (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    timezone character varying(64) NOT NULL,
    school_days json NOT NULL,
    late_after time without time zone NOT NULL,
    scan_closes_at time without time zone NOT NULL,
    auto_absent_at time without time zone NOT NULL,
    allow_checkout_scan boolean NOT NULL
);

ALTER TABLE ONLY public.attendance_settings FORCE ROW LEVEL SECURITY;

--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    schedule_id uuid,
    academic_year_id uuid NOT NULL,
    date date NOT NULL,
    status public.attendancestatus NOT NULL,
    period character varying(10),
    check_in_time timestamp without time zone,
    check_out_time timestamp without time zone,
    marked_by uuid NOT NULL,
    marked_at timestamp without time zone NOT NULL,
    notes text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.attendances FORCE ROW LEVEL SECURITY;

--
-- Name: class_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_enrollments (
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    enrollment_date date NOT NULL,
    status character varying(20) NOT NULL,
    is_active boolean NOT NULL,
    drop_date date,
    completion_date date,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.class_enrollments FORCE ROW LEVEL SECURITY;

--
-- Name: class_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_subjects (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    class_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid,
    grading_schema_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.class_subjects FORCE ROW LEVEL SECURITY;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    name character varying(255),
    room character varying(50),
    is_active boolean NOT NULL,
    start_date date NOT NULL,
    end_date date,
    grade_id uuid NOT NULL,
    section_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    description text,
    capacity integer DEFAULT 30 NOT NULL,
    academic_year_id uuid,
    class_teacher_id uuid
);

ALTER TABLE ONLY public.classes FORCE ROW LEVEL SECURITY;

--
-- Name: daily_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_attendances (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    date date NOT NULL,
    status public.attendancestatus NOT NULL,
    check_in_at timestamp with time zone,
    check_out_at timestamp with time zone,
    source public.attendancesource NOT NULL,
    marked_by uuid,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    excuse_reason text,
    excuse_status public.excusestatus,
    excuse_document_url character varying(500),
    excuse_reviewed_by uuid,
    notes text
);

ALTER TABLE ONLY public.daily_attendances FORCE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    student_id uuid NOT NULL,
    academic_year character varying(20),
    grade character varying(50),
    section character varying(10),
    enrollment_date date,
    roll_number integer,
    status character varying(20),
    is_active boolean,
    withdrawal_date date,
    withdrawal_reason text,
    comments text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    academic_year_id uuid NOT NULL,
    semester integer NOT NULL,
    semester_1_status character varying(20),
    semester_2_status character varying(20),
    semester_1_completion_date date,
    semester_2_completion_date date,
    tenant_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    section_id uuid NOT NULL
);

ALTER TABLE ONLY public.enrollments FORCE ROW LEVEL SECURITY;

--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    title character varying(255) NOT NULL,
    description text,
    event_type public.eventtype NOT NULL,
    organizer_id uuid NOT NULL,
    location character varying(255),
    start_datetime timestamp with time zone NOT NULL,
    end_datetime timestamp with time zone,
    is_all_day boolean NOT NULL,
    is_recurring boolean NOT NULL,
    recurrence_pattern character varying(255),
    is_active boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.events FORCE ROW LEVEL SECURITY;

--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    title character varying(255) NOT NULL,
    description text,
    subject_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    section_id uuid,
    exam_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    max_score double precision NOT NULL,
    weight double precision NOT NULL,
    is_published boolean NOT NULL,
    location character varying(255),
    instructions text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    academic_year_id uuid
);

ALTER TABLE ONLY public.exams FORCE ROW LEVEL SECURITY;

--
-- Name: expenditures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenditures (
    expense_category_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    date date NOT NULL,
    payee character varying(100),
    description text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.expenditures FORCE ROW LEVEL SECURITY;

--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    name character varying(100) NOT NULL,
    description text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.expense_categories FORCE ROW LEVEL SECURITY;

--
-- Name: fee_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_categories (
    name character varying(100) NOT NULL,
    description text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.fee_categories FORCE ROW LEVEL SECURITY;

--
-- Name: fee_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_installments (
    student_fee_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    status character varying(20) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.fee_installments FORCE ROW LEVEL SECURITY;

--
-- Name: fee_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_payments (
    student_fee_id uuid NOT NULL,
    amount_paid numeric(10,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    payment_date timestamp with time zone DEFAULT now() NOT NULL,
    reference_id character varying(100),
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.fee_payments FORCE ROW LEVEL SECURITY;

--
-- Name: fee_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_structures (
    category_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    grade_id uuid
);

ALTER TABLE ONLY public.fee_structures FORCE ROW LEVEL SECURITY;

--
-- Name: feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedbacks (
    subject character varying(255) NOT NULL,
    content text NOT NULL,
    feedback_type public.feedbacktype NOT NULL,
    submitter_id uuid NOT NULL,
    assignee_id uuid,
    status public.feedbackstatus NOT NULL,
    rating integer,
    submission_date timestamp with time zone NOT NULL,
    resolution_date timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.feedbacks FORCE ROW LEVEL SECURITY;

--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    student_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    assessment_type public.gradetype NOT NULL,
    assessment_id uuid,
    assessment_name character varying(255) NOT NULL,
    assessment_date date NOT NULL,
    score double precision NOT NULL,
    max_score double precision NOT NULL,
    percentage double precision NOT NULL,
    letter_grade character varying(10),
    comments text,
    graded_by uuid NOT NULL,
    graded_date date NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    period_number integer,
    semester integer,
    is_published boolean DEFAULT false NOT NULL,
    period_id uuid,
    semester_id uuid,
    grading_category_id uuid
);

ALTER TABLE ONLY public.grades FORCE ROW LEVEL SECURITY;

--
-- Name: grading_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grading_categories (
    name character varying(100) NOT NULL,
    weight double precision NOT NULL,
    description text,
    schema_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.grading_categories FORCE ROW LEVEL SECURITY;

--
-- Name: grading_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grading_schemas (
    name character varying(255) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    academic_year_id uuid
);

ALTER TABLE ONLY public.grading_schemas FORCE ROW LEVEL SECURITY;

--
-- Name: message_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_recipients (
    message_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    is_read boolean NOT NULL,
    read_at timestamp with time zone
);

--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    subject character varying(255) NOT NULL,
    content text NOT NULL,
    sender_id uuid NOT NULL,
    parent_id uuid,
    is_draft boolean NOT NULL,
    sent_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.messages FORCE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    is_read boolean NOT NULL,
    notification_metadata json,
    id uuid NOT NULL,
    created_at timestamp with time zone
);

--
-- Name: parent_student; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_student (
    parent_id uuid NOT NULL,
    student_id uuid NOT NULL
);

--
-- Name: parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parents (
    id uuid NOT NULL,
    relationship_type character varying(50) NOT NULL,
    occupation character varying(100),
    city character varying(50),
    county character varying(50),
    country character varying(50),
    whatsapp_number character varying(20),
    status character varying(20) NOT NULL,
    deactivated_date date,
    deactivation_reason character varying(255),
    parent_address character varying(255)
);

--
-- Name: COLUMN parents.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parents.status IS 'One of: active, inactive';

--
-- Name: periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periods (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    semester_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    period_number integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_published boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.periods FORCE ROW LEVEL SECURITY;

--
-- Name: permission_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_role (
    permission_id uuid NOT NULL,
    role_id uuid NOT NULL
);

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    name character varying(100) NOT NULL,
    description character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL
);

--
-- Name: promotion_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_criteria (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    academic_year_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    passing_mark integer DEFAULT 70 NOT NULL,
    min_passed_subjects integer,
    require_core_pass boolean DEFAULT true NOT NULL,
    core_subject_ids jsonb,
    weighting_schema jsonb,
    aggregate_method character varying(20) DEFAULT 'average'::character varying NOT NULL
);

ALTER TABLE ONLY public.promotion_criteria FORCE ROW LEVEL SECURITY;

--
-- Name: promotion_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_status (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    next_grade_id uuid,
    next_section_id uuid,
    next_class_id uuid,
    failed_subject_ids jsonb,
    total_score character varying(32),
    promotion_date date,
    notes text
);

ALTER TABLE ONLY public.promotion_status FORCE ROW LEVEL SECURITY;

--
-- Name: remedial_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remedial_sessions (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    student_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    scheduled_date date DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    new_score double precision,
    passed boolean
);

ALTER TABLE ONLY public.remedial_sessions FORCE ROW LEVEL SECURITY;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    day_of_week public.dayofweek NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    period integer,
    class_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.schedules FORCE ROW LEVEL SECURITY;

--
-- Name: school_calendar_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_calendar_days (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    date date NOT NULL,
    is_school_day boolean NOT NULL,
    label character varying(100)
);

ALTER TABLE ONLY public.school_calendar_days FORCE ROW LEVEL SECURITY;

--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    name character varying(50) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    capacity integer NOT NULL,
    grade_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    class_teacher_id uuid
);

ALTER TABLE ONLY public.sections FORCE ROW LEVEL SECURITY;

--
-- Name: semesters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.semesters (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    academic_year_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    semester_number integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_published boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.semesters FORCE ROW LEVEL SECURITY;

--
-- Name: student_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_fees (
    fee_structure_id uuid NOT NULL,
    student_id uuid NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) NOT NULL,
    balance numeric(10,2) NOT NULL,
    status character varying(20) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.student_fees FORCE ROW LEVEL SECURITY;

--
-- Name: student_id_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_id_sequences (
    tenant_id uuid NOT NULL,
    prefix character varying(10) NOT NULL,
    last_number integer NOT NULL
);

ALTER TABLE ONLY public.student_id_sequences FORCE ROW LEVEL SECURITY;

--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid NOT NULL,
    admission_number character varying(50) NOT NULL,
    roll_number integer,
    admission_date date,
    date_of_birth date,
    gender character varying(10),
    blood_group character varying(5),
    nationality character varying(50),
    religion character varying(50),
    city character varying(100),
    country character varying(100),
    whatsapp_number character varying(20),
    emergency_contact character varying(255),
    status character varying(20) NOT NULL,
    exit_date date,
    graduation_date date,
    withdrawal_reason character varying(255),
    county character varying(100),
    student_address character varying(255),
    photo character varying(500),
    transfer_school character varying(255),
    transfer_reason character varying(255),
    card_version integer DEFAULT 1 NOT NULL,
    card_issued_at timestamp with time zone,
    tenant_id uuid NOT NULL
);

--
-- Name: COLUMN students.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.students.status IS 'One of: active, graduated, transferred, withdrawn';

--
-- Name: COLUMN students.photo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.students.photo IS 'URL to student profile photo';

--
-- Name: COLUMN students.transfer_school; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.students.transfer_school IS 'Name of the school the student transferred to';

--
-- Name: COLUMN students.transfer_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.students.transfer_reason IS 'Reason for transfer';

--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    credits integer NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.subjects FORCE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    content text,
    attachments jsonb,
    status public.submissionstatus NOT NULL,
    submitted_at timestamp without time zone NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    attachment_url character varying,
    score double precision,
    feedback text
);

ALTER TABLE ONLY public.submissions FORCE ROW LEVEL SECURITY;

--
-- Name: super_admin_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admin_activity_logs (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid,
    target_tenant_id uuid,
    old_values json,
    new_values json,
    ip_address character varying(50),
    user_agent text,
    details text
);

--
-- Name: teacher_subject_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_subject_assignments (
    teacher_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    section_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    academic_year character varying(20) NOT NULL,
    room character varying(50),
    is_active boolean NOT NULL,
    start_date date NOT NULL,
    end_date date,
    notes text,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL
);

ALTER TABLE ONLY public.teacher_subject_assignments FORCE ROW LEVEL SECURITY;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    id uuid NOT NULL,
    employee_id character varying(50) NOT NULL,
    department character varying(100),
    qualification character varying(200),
    joining_date date,
    is_class_teacher boolean,
    city character varying(50),
    county character varying(50),
    country character varying(50),
    gender character varying(10),
    whatsapp_number character varying(20),
    status character varying(20) NOT NULL,
    exit_date date,
    retirement_date date,
    resignation_date date,
    resignation_reason character varying(255),
    teacher_address character varying(255),
    tenant_id uuid NOT NULL
);

--
-- Name: COLUMN teachers.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teachers.status IS 'One of: active, inactive, retired, resigned';

--
-- Name: tenant_notification_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_notification_configs (
    tenant_id uuid NOT NULL,
    whatsapp_enabled boolean,
    admin_whatsapp_number character varying,
    school_name character varying NOT NULL,
    teacher_welcome_template text,
    student_welcome_template text,
    parent_welcome_template text,
    notify_admin_on_user_creation boolean,
    notify_parents_on_student_creation boolean,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY public.tenant_notification_configs FORCE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_settings (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    theme character varying(20) NOT NULL,
    settings json NOT NULL,
    is_active boolean NOT NULL
);

ALTER TABLE ONLY public.tenant_settings FORCE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    is_active boolean NOT NULL,
    domain character varying(255),
    subdomain character varying(100),
    logo character varying(500),
    primary_color character varying(7),
    secondary_color character varying(7),
    plan_type character varying(20) DEFAULT 'flat_rate'::character varying NOT NULL,
    plan_amount numeric(10,2) DEFAULT 0.0 NOT NULL,
    subscription_status character varying(20) DEFAULT 'active'::character varying NOT NULL
);

--
-- Name: COLUMN tenants.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.name IS 'Name of the tenant';

--
-- Name: COLUMN tenants.code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.code IS 'Unique uppercase code for the tenant';

--
-- Name: COLUMN tenants.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.is_active IS 'Whether the tenant is active';

--
-- Name: COLUMN tenants.domain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.domain IS 'Domain for the tenant';

--
-- Name: COLUMN tenants.subdomain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.subdomain IS 'Subdomain for the tenant';

--
-- Name: COLUMN tenants.logo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.logo IS 'Logo URL for the tenant';

--
-- Name: COLUMN tenants.primary_color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.primary_color IS 'Primary color for branding (hex)';

--
-- Name: COLUMN tenants.secondary_color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.secondary_color IS 'Secondary color for branding (hex)';

--
-- Name: COLUMN tenants.plan_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.plan_type IS '''flat_rate'' or ''per_user''';

--
-- Name: COLUMN tenants.plan_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.plan_amount IS 'Monthly amount based on plan_type';

--
-- Name: COLUMN tenants.subscription_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.subscription_status IS '''active'', ''past_due'', ''canceled''';

--
-- Name: timetables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timetables (
    name character varying(255) NOT NULL,
    description text,
    is_active boolean NOT NULL,
    effective_from date NOT NULL,
    effective_until date,
    timetable_data json,
    grade_id uuid NOT NULL,
    section_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    tenant_id uuid NOT NULL,
    academic_year_id uuid NOT NULL
);

ALTER TABLE ONLY public.timetables FORCE ROW LEVEL SECURITY;

--
-- Name: user_role_association; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_association (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    name character varying(50) NOT NULL,
    description character varying(200),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    tenant_id uuid,
    is_system boolean DEFAULT false NOT NULL
);

--
-- Name: COLUMN user_roles.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_roles.name IS 'Name of the role';

--
-- Name: COLUMN user_roles.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_roles.description IS 'Description of the role';

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    profile_picture character varying(255),
    phone_number character varying(20),
    preferences json,
    type character varying(50) NOT NULL,
    is_first_login boolean DEFAULT true NOT NULL,
    password_expiry_date timestamp without time zone,
    address character varying(255)
);

--
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.email IS 'User''s email address';

--
-- Name: COLUMN users.first_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.first_name IS 'User''s first name';

--
-- Name: COLUMN users.last_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_name IS 'User''s last name';

--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_active IS 'Whether the user is active';

--
-- Name: COLUMN users.is_first_login; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_first_login IS 'Whether this is the user''s first login';

--
-- Name: COLUMN users.password_expiry_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password_expiry_date IS 'Date when the password expires';

--
-- Name: COLUMN users.address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.address IS 'User''s address';

--
-- Name: academic_grades academic_grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_grades
    ADD CONSTRAINT academic_grades_pkey PRIMARY KEY (id);

--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);

--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);

--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);

--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);

--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);

--
-- Name: attendance_documents attendance_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_documents
    ADD CONSTRAINT attendance_documents_pkey PRIMARY KEY (id);

--
-- Name: attendance_events attendance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);

--
-- Name: attendance_settings attendance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (id);

--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);

--
-- Name: class_enrollments class_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT class_enrollments_pkey PRIMARY KEY (id);

--
-- Name: class_subjects class_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT class_subjects_pkey PRIMARY KEY (id);

--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);

--
-- Name: daily_attendances daily_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT daily_attendances_pkey PRIMARY KEY (id);

--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);

--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);

--
-- Name: expenditures expenditures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_pkey PRIMARY KEY (id);

--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);

--
-- Name: fee_categories fee_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_categories
    ADD CONSTRAINT fee_categories_pkey PRIMARY KEY (id);

--
-- Name: fee_installments fee_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_pkey PRIMARY KEY (id);

--
-- Name: fee_payments fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);

--
-- Name: fee_structures fee_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);

--
-- Name: feedbacks feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_pkey PRIMARY KEY (id);

--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);

--
-- Name: grading_categories grading_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_categories
    ADD CONSTRAINT grading_categories_pkey PRIMARY KEY (id);

--
-- Name: grading_schemas grading_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_schemas
    ADD CONSTRAINT grading_schemas_pkey PRIMARY KEY (id);

--
-- Name: message_recipients message_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_recipients
    ADD CONSTRAINT message_recipients_pkey PRIMARY KEY (message_id, recipient_id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: parent_student parent_student_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student
    ADD CONSTRAINT parent_student_pkey PRIMARY KEY (parent_id, student_id);

--
-- Name: parents parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_pkey PRIMARY KEY (id);

--
-- Name: periods periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_pkey PRIMARY KEY (id);

--
-- Name: permission_role permission_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_pkey PRIMARY KEY (permission_id, role_id);

--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);

--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

--
-- Name: promotion_criteria promotion_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_criteria
    ADD CONSTRAINT promotion_criteria_pkey PRIMARY KEY (id);

--
-- Name: promotion_status promotion_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT promotion_status_pkey PRIMARY KEY (id);

--
-- Name: remedial_sessions remedial_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT remedial_sessions_pkey PRIMARY KEY (id);

--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);

--
-- Name: school_calendar_days school_calendar_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_calendar_days
    ADD CONSTRAINT school_calendar_days_pkey PRIMARY KEY (id);

--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);

--
-- Name: semesters semesters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);

--
-- Name: student_fees student_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_pkey PRIMARY KEY (id);

--
-- Name: student_id_sequences student_id_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_id_sequences
    ADD CONSTRAINT student_id_sequences_pkey PRIMARY KEY (tenant_id, prefix);

--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);

--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);

--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);

--
-- Name: super_admin_activity_logs super_admin_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_pkey PRIMARY KEY (id);

--
-- Name: teacher_subject_assignments teacher_subject_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT teacher_subject_assignments_pkey PRIMARY KEY (id);

--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);

--
-- Name: tenant_notification_configs tenant_notification_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_notification_configs
    ADD CONSTRAINT tenant_notification_configs_pkey PRIMARY KEY (id);

--
-- Name: tenant_settings tenant_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_pkey PRIMARY KEY (id);

--
-- Name: tenants tenants_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);

--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

--
-- Name: timetables timetables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetables
    ADD CONSTRAINT timetables_pkey PRIMARY KEY (id);

--
-- Name: class_subjects unique_class_subject; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT unique_class_subject UNIQUE (class_id, subject_id);

--
-- Name: enrollments unique_enrollment_student_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT unique_enrollment_student_year UNIQUE (tenant_id, student_id, academic_year_id);

--
-- Name: class_enrollments unique_student_class_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT unique_student_class_year UNIQUE (student_id, class_id, academic_year_id);

--
-- Name: attendance_documents uq_attendance_document_record; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_documents
    ADD CONSTRAINT uq_attendance_document_record UNIQUE (tenant_id, daily_attendance_id);

--
-- Name: attendance_settings uq_attendance_settings_tenant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT uq_attendance_settings_tenant UNIQUE (tenant_id);

--
-- Name: daily_attendances uq_daily_attendance_student_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT uq_daily_attendance_student_date UNIQUE (tenant_id, student_id, date);

--
-- Name: grading_categories uq_grading_category_schema_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_categories
    ADD CONSTRAINT uq_grading_category_schema_name UNIQUE (schema_id, name);

--
-- Name: grading_schemas uq_grading_schema_tenant_ay_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_schemas
    ADD CONSTRAINT uq_grading_schema_tenant_ay_name UNIQUE (tenant_id, academic_year_id, name);

--
-- Name: promotion_criteria uq_promotion_criteria_tenant_year_grade; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_criteria
    ADD CONSTRAINT uq_promotion_criteria_tenant_year_grade UNIQUE (tenant_id, academic_year_id, grade_id);

--
-- Name: promotion_status uq_promotion_status_tenant_enrollment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT uq_promotion_status_tenant_enrollment UNIQUE (tenant_id, enrollment_id);

--
-- Name: school_calendar_days uq_school_calendar_day; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_calendar_days
    ADD CONSTRAINT uq_school_calendar_day UNIQUE (tenant_id, date);

--
-- Name: students uq_students_tenant_admission_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT uq_students_tenant_admission_number UNIQUE (tenant_id, admission_number);

--
-- Name: subjects uq_subject_tenant_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT uq_subject_tenant_name UNIQUE (tenant_id, name);

--
-- Name: teacher_subject_assignments uq_teacher_subject_assign; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT uq_teacher_subject_assign UNIQUE (tenant_id, grade_id, section_id, subject_id, academic_year);

--
-- Name: teachers uq_teachers_tenant_employee_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT uq_teachers_tenant_employee_id UNIQUE (tenant_id, employee_id);

--
-- Name: tenant_settings uq_tenant_settings_tenant_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT uq_tenant_settings_tenant_id UNIQUE (tenant_id);

--
-- Name: academic_grades uq_tn_academic_grades; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_grades
    ADD CONSTRAINT uq_tn_academic_grades UNIQUE (tenant_id, id);

--
-- Name: academic_years uq_tn_academic_years; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT uq_tn_academic_years UNIQUE (tenant_id, id);

--
-- Name: assignments uq_tn_assignments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT uq_tn_assignments UNIQUE (tenant_id, id);

--
-- Name: class_subjects uq_tn_class_subjects; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT uq_tn_class_subjects UNIQUE (tenant_id, id);

--
-- Name: classes uq_tn_classes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT uq_tn_classes UNIQUE (tenant_id, id);

--
-- Name: daily_attendances uq_tn_daily_attendances; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT uq_tn_daily_attendances UNIQUE (tenant_id, id);

--
-- Name: enrollments uq_tn_enrollments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT uq_tn_enrollments UNIQUE (tenant_id, id);

--
-- Name: expense_categories uq_tn_expense_categories; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT uq_tn_expense_categories UNIQUE (tenant_id, id);

--
-- Name: fee_categories uq_tn_fee_categories; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_categories
    ADD CONSTRAINT uq_tn_fee_categories UNIQUE (tenant_id, id);

--
-- Name: fee_structures uq_tn_fee_structures; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT uq_tn_fee_structures UNIQUE (tenant_id, id);

--
-- Name: grading_categories uq_tn_grading_categories; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_categories
    ADD CONSTRAINT uq_tn_grading_categories UNIQUE (tenant_id, id);

--
-- Name: grading_schemas uq_tn_grading_schemas; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_schemas
    ADD CONSTRAINT uq_tn_grading_schemas UNIQUE (tenant_id, id);

--
-- Name: messages uq_tn_messages; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT uq_tn_messages UNIQUE (tenant_id, id);

--
-- Name: periods uq_tn_periods; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT uq_tn_periods UNIQUE (tenant_id, id);

--
-- Name: schedules uq_tn_schedules; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT uq_tn_schedules UNIQUE (tenant_id, id);

--
-- Name: sections uq_tn_sections; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT uq_tn_sections UNIQUE (tenant_id, id);

--
-- Name: semesters uq_tn_semesters; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT uq_tn_semesters UNIQUE (tenant_id, id);

--
-- Name: student_fees uq_tn_student_fees; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT uq_tn_student_fees UNIQUE (tenant_id, id);

--
-- Name: students uq_tn_students; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT uq_tn_students UNIQUE (tenant_id, id);

--
-- Name: subjects uq_tn_subjects; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT uq_tn_subjects UNIQUE (tenant_id, id);

--
-- Name: teachers uq_tn_teachers; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT uq_tn_teachers UNIQUE (tenant_id, id);

--
-- Name: user_roles uq_user_roles_tenant_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT uq_user_roles_tenant_name UNIQUE NULLS NOT DISTINCT (tenant_id, name);

--
-- Name: users uq_users_tenant_id_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_tenant_id_id UNIQUE (tenant_id, id);

--
-- Name: user_role_association user_role_association_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_association
    ADD CONSTRAINT user_role_association_pkey PRIMARY KEY (user_id, role_id);

--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: idx_att_events_tenant_daily; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_att_events_tenant_daily ON public.attendance_events USING btree (tenant_id, daily_attendance_id);

--
-- Name: idx_class_enrollments_class_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_enrollments_class_id ON public.class_enrollments USING btree (class_id);

--
-- Name: idx_class_enrollments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_enrollments_student_id ON public.class_enrollments USING btree (student_id);

--
-- Name: idx_classes_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_tenant_active ON public.classes USING btree (tenant_id, is_active);

--
-- Name: idx_daily_att_tenant_class_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_att_tenant_class_date ON public.daily_attendances USING btree (tenant_id, class_id, date);

--
-- Name: idx_enrollments_perf_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_perf_lookup ON public.enrollments USING btree (tenant_id, academic_year_id, grade_id, is_active, status);

--
-- Name: idx_enrollments_section_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_section_lookup ON public.enrollments USING btree (tenant_id, academic_year_id, section_id, is_active, status);

--
-- Name: idx_grades_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_assessment_id ON public.grades USING btree (assessment_id);

--
-- Name: idx_grades_assessment_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_assessment_type ON public.grades USING btree (assessment_type);

--
-- Name: idx_grades_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_student_id ON public.grades USING btree (student_id);

--
-- Name: idx_grades_tenant_id_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_tenant_id_student_id ON public.grades USING btree (tenant_id, student_id);

--
-- Name: idx_students_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_status ON public.students USING btree (status);

--
-- Name: idx_subjects_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subjects_tenant ON public.subjects USING btree (tenant_id);

--
-- Name: idx_teachers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_status ON public.teachers USING btree (status);

--
-- Name: idx_users_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_active ON public.users USING btree (tenant_id, is_active);

--
-- Name: idx_users_tenant_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_login ON public.users USING btree (tenant_id, last_login);

--
-- Name: idx_users_tenant_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_type ON public.users USING btree (tenant_id, type);

--
-- Name: ix_academic_grades_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_academic_grades_tenant_id ON public.academic_grades USING btree (tenant_id);

--
-- Name: ix_academic_grades_tenant_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_academic_grades_tenant_sequence ON public.academic_grades USING btree (tenant_id, sequence);

--
-- Name: ix_academic_years_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_academic_years_tenant_id ON public.academic_years USING btree (tenant_id);

--
-- Name: ix_activity_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_activity_logs_tenant_id ON public.activity_logs USING btree (tenant_id);

--
-- Name: ix_announcements_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_announcements_tenant_id ON public.announcements USING btree (tenant_id);

--
-- Name: ix_assessments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assessments_tenant_id ON public.assessments USING btree (tenant_id);

--
-- Name: ix_assignments_tenant_academic_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_academic_year ON public.assignments USING btree (tenant_id, academic_year_id);

--
-- Name: ix_assignments_tenant_grade_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_grade_section ON public.assignments USING btree (tenant_id, grade_id, section_id);

--
-- Name: ix_assignments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_id ON public.assignments USING btree (tenant_id);

--
-- Name: ix_assignments_tenant_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_published ON public.assignments USING btree (tenant_id, is_published);

--
-- Name: ix_assignments_tenant_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_subject ON public.assignments USING btree (tenant_id, subject_id);

--
-- Name: ix_assignments_tenant_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_assignments_tenant_teacher ON public.assignments USING btree (tenant_id, teacher_id);

--
-- Name: ix_attendance_documents_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attendance_documents_tenant_id ON public.attendance_documents USING btree (tenant_id);

--
-- Name: ix_attendance_events_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attendance_events_tenant_id ON public.attendance_events USING btree (tenant_id);

--
-- Name: ix_attendance_settings_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attendance_settings_tenant_id ON public.attendance_settings USING btree (tenant_id);

--
-- Name: ix_attendances_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attendances_date ON public.attendances USING btree (date);

--
-- Name: ix_attendances_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attendances_tenant_id ON public.attendances USING btree (tenant_id);

--
-- Name: ix_class_enrollments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_class_enrollments_tenant_id ON public.class_enrollments USING btree (tenant_id);

--
-- Name: ix_classes_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_classes_tenant_id ON public.classes USING btree (tenant_id);

--
-- Name: ix_daily_attendances_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_attendances_date ON public.daily_attendances USING btree (date);

--
-- Name: ix_daily_attendances_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_attendances_tenant_id ON public.daily_attendances USING btree (tenant_id);

--
-- Name: ix_enrollments_academic_year_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_academic_year_id ON public.enrollments USING btree (academic_year_id);

--
-- Name: ix_enrollments_active_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_active_student ON public.enrollments USING btree (tenant_id, student_id, is_active, status);

--
-- Name: ix_enrollments_grade_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_grade_id ON public.enrollments USING btree (grade_id);

--
-- Name: ix_enrollments_section_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_section_id ON public.enrollments USING btree (section_id);

--
-- Name: ix_enrollments_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_student_id ON public.enrollments USING btree (student_id);

--
-- Name: ix_enrollments_tenant_grade_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_tenant_grade_active ON public.enrollments USING btree (tenant_id, grade_id, is_active);

--
-- Name: ix_enrollments_tenant_grade_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_tenant_grade_year ON public.enrollments USING btree (tenant_id, grade_id, academic_year_id);

--
-- Name: ix_enrollments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_tenant_id ON public.enrollments USING btree (tenant_id);

--
-- Name: ix_enrollments_tenant_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_enrollments_tenant_section ON public.enrollments USING btree (tenant_id, section_id);

--
-- Name: ix_events_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_events_tenant_id ON public.events USING btree (tenant_id);

--
-- Name: ix_exams_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_exams_tenant_id ON public.exams USING btree (tenant_id);

--
-- Name: ix_expenditures_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_expenditures_tenant_id ON public.expenditures USING btree (tenant_id);

--
-- Name: ix_expense_categories_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_expense_categories_tenant_id ON public.expense_categories USING btree (tenant_id);

--
-- Name: ix_fee_categories_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fee_categories_tenant_id ON public.fee_categories USING btree (tenant_id);

--
-- Name: ix_fee_installments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fee_installments_tenant_id ON public.fee_installments USING btree (tenant_id);

--
-- Name: ix_fee_payments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fee_payments_tenant_id ON public.fee_payments USING btree (tenant_id);

--
-- Name: ix_fee_structures_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fee_structures_tenant_id ON public.fee_structures USING btree (tenant_id);

--
-- Name: ix_feedbacks_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_feedbacks_tenant_id ON public.feedbacks USING btree (tenant_id);

--
-- Name: ix_grades_assessment_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grades_assessment_lookup ON public.grades USING btree (tenant_id, assessment_id, assessment_type);

--
-- Name: ix_grades_student_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grades_student_subject ON public.grades USING btree (tenant_id, student_id, subject_id);

--
-- Name: ix_grades_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grades_tenant_id ON public.grades USING btree (tenant_id);

--
-- Name: ix_grading_categories_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grading_categories_tenant_id ON public.grading_categories USING btree (tenant_id);

--
-- Name: ix_grading_schemas_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grading_schemas_tenant_id ON public.grading_schemas USING btree (tenant_id);

--
-- Name: ix_messages_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_messages_tenant_id ON public.messages USING btree (tenant_id);

--
-- Name: ix_promotion_criteria_tenant_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_criteria_tenant_grade ON public.promotion_criteria USING btree (tenant_id, grade_id);

--
-- Name: ix_promotion_criteria_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_criteria_tenant_id ON public.promotion_criteria USING btree (tenant_id);

--
-- Name: ix_promotion_status_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_status_tenant_id ON public.promotion_status USING btree (tenant_id);

--
-- Name: ix_promotion_status_tenant_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_promotion_status_tenant_student ON public.promotion_status USING btree (tenant_id, student_id);

--
-- Name: ix_remedial_sessions_tenant_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_remedial_sessions_tenant_enrollment ON public.remedial_sessions USING btree (tenant_id, enrollment_id);

--
-- Name: ix_remedial_sessions_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_remedial_sessions_tenant_id ON public.remedial_sessions USING btree (tenant_id);

--
-- Name: ix_schedules_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_schedules_tenant_id ON public.schedules USING btree (tenant_id);

--
-- Name: ix_school_calendar_days_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_school_calendar_days_tenant_id ON public.school_calendar_days USING btree (tenant_id);

--
-- Name: ix_sections_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sections_tenant_id ON public.sections USING btree (tenant_id);

--
-- Name: ix_student_fees_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_student_fees_tenant_id ON public.student_fees USING btree (tenant_id);

--
-- Name: ix_students_admission_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_students_admission_number ON public.students USING btree (admission_number);

--
-- Name: ix_subject_tenant_active_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subject_tenant_active_name ON public.subjects USING btree (tenant_id, is_active, name);

--
-- Name: ix_subjects_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subjects_tenant_id ON public.subjects USING btree (tenant_id);

--
-- Name: ix_submissions_assignment_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_submissions_assignment_student ON public.submissions USING btree (assignment_id, student_id);

--
-- Name: ix_submissions_tenant_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_submissions_tenant_assignment ON public.submissions USING btree (tenant_id, assignment_id);

--
-- Name: ix_submissions_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_submissions_tenant_id ON public.submissions USING btree (tenant_id);

--
-- Name: ix_teacher_subject_assignments_academic_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_teacher_subject_assignments_academic_year ON public.teacher_subject_assignments USING btree (academic_year);

--
-- Name: ix_teacher_subject_assignments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_teacher_subject_assignments_tenant_id ON public.teacher_subject_assignments USING btree (tenant_id);

--
-- Name: ix_teachers_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_teachers_employee_id ON public.teachers USING btree (employee_id);

--
-- Name: ix_timetables_academic_year_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_timetables_academic_year_id ON public.timetables USING btree (academic_year_id);

--
-- Name: ix_timetables_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_timetables_tenant_id ON public.timetables USING btree (tenant_id);

--
-- Name: ix_user_roles_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_roles_tenant_id ON public.user_roles USING btree (tenant_id);

--
-- Name: ix_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_email_lower ON public.users USING btree (lower((email)::text));

--
-- Name: ix_users_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_tenant_id ON public.users USING btree (tenant_id);

--
-- Name: uq_attendance_student_class_date_period; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_attendance_student_class_date_period ON public.attendances USING btree (tenant_id, student_id, class_id, date, COALESCE((schedule_id)::character varying, period, 'day'::character varying));

--
-- Name: uq_users_tenant_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_users_tenant_email ON public.users USING btree (tenant_id, lower((email)::text));

--
-- Name: academic_grades academic_grades_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_grades
    ADD CONSTRAINT academic_grades_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: academic_years academic_years_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: admins admins_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);

--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);

--
-- Name: announcements announcements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: assessments assessments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: assignments assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: attendance_documents attendance_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_documents
    ADD CONSTRAINT attendance_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: attendance_documents attendance_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_documents
    ADD CONSTRAINT attendance_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);

--
-- Name: attendance_events attendance_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);

--
-- Name: attendance_events attendance_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: attendance_settings attendance_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_settings
    ADD CONSTRAINT attendance_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: attendances attendances_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id);

--
-- Name: classes classes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: daily_attendances daily_attendances_excuse_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT daily_attendances_excuse_reviewed_by_fkey FOREIGN KEY (excuse_reviewed_by) REFERENCES public.users(id);

--
-- Name: daily_attendances daily_attendances_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT daily_attendances_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id);

--
-- Name: daily_attendances daily_attendances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT daily_attendances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: enrollments enrollments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: events events_organizer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.users(id);

--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: exams exams_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: expenditures expenditures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT expenditures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: expense_categories expense_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: fee_categories fee_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_categories
    ADD CONSTRAINT fee_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: fee_installments fee_installments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: fee_payments fee_payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: fee_structures fee_structures_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: feedbacks feedbacks_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id);

--
-- Name: feedbacks feedbacks_submitter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_submitter_id_fkey FOREIGN KEY (submitter_id) REFERENCES public.users(id);

--
-- Name: feedbacks feedbacks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedbacks
    ADD CONSTRAINT feedbacks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: students fk_students_tenant_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_tenant_user FOREIGN KEY (tenant_id, id) REFERENCES public.users(tenant_id, id) ON UPDATE CASCADE;

--
-- Name: teachers fk_teachers_tenant_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT fk_teachers_tenant_user FOREIGN KEY (tenant_id, id) REFERENCES public.users(tenant_id, id) ON UPDATE CASCADE;

--
-- Name: assessments fk_tn_assessments_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.classes(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_grading_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_grading_category_id FOREIGN KEY (tenant_id, grading_category_id) REFERENCES public.grading_categories(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: assessments fk_tn_assessments_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT fk_tn_assessments_teacher_id FOREIGN KEY (tenant_id, teacher_id) REFERENCES public.users(tenant_id, id);

--
-- Name: assignments fk_tn_assignments_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_tn_assignments_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: assignments fk_tn_assignments_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_tn_assignments_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: assignments fk_tn_assignments_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_tn_assignments_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: assignments fk_tn_assignments_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_tn_assignments_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: assignments fk_tn_assignments_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT fk_tn_assignments_teacher_id FOREIGN KEY (tenant_id, teacher_id) REFERENCES public.users(tenant_id, id);

--
-- Name: attendance_documents fk_tn_attendance_documents_daily_attendance_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_documents
    ADD CONSTRAINT fk_tn_attendance_documents_daily_attendance_id FOREIGN KEY (tenant_id, daily_attendance_id) REFERENCES public.daily_attendances(tenant_id, id) ON DELETE CASCADE;

--
-- Name: attendance_events fk_tn_attendance_events_daily_attendance_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT fk_tn_attendance_events_daily_attendance_id FOREIGN KEY (tenant_id, daily_attendance_id) REFERENCES public.daily_attendances(tenant_id, id);

--
-- Name: attendance_events fk_tn_attendance_events_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT fk_tn_attendance_events_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: attendances fk_tn_attendances_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_tn_attendances_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: attendances fk_tn_attendances_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_tn_attendances_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.classes(tenant_id, id);

--
-- Name: attendances fk_tn_attendances_schedule_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_tn_attendances_schedule_id FOREIGN KEY (tenant_id, schedule_id) REFERENCES public.schedules(tenant_id, id);

--
-- Name: attendances fk_tn_attendances_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_tn_attendances_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: attendances fk_tn_attendances_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT fk_tn_attendances_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: class_enrollments fk_tn_class_enrollments_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT fk_tn_class_enrollments_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: class_enrollments fk_tn_class_enrollments_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT fk_tn_class_enrollments_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.classes(tenant_id, id);

--
-- Name: class_enrollments fk_tn_class_enrollments_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT fk_tn_class_enrollments_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: class_enrollments fk_tn_class_enrollments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_enrollments
    ADD CONSTRAINT fk_tn_class_enrollments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: class_subjects fk_tn_class_subjects_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT fk_tn_class_subjects_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.classes(tenant_id, id) ON DELETE CASCADE;

--
-- Name: class_subjects fk_tn_class_subjects_grading_schema_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT fk_tn_class_subjects_grading_schema_id FOREIGN KEY (tenant_id, grading_schema_id) REFERENCES public.grading_schemas(tenant_id, id) ON DELETE SET NULL (grading_schema_id);

--
-- Name: class_subjects fk_tn_class_subjects_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT fk_tn_class_subjects_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id) ON DELETE CASCADE;

--
-- Name: class_subjects fk_tn_class_subjects_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT fk_tn_class_subjects_teacher_id FOREIGN KEY (tenant_id, teacher_id) REFERENCES public.teachers(tenant_id, id) ON DELETE SET NULL (teacher_id);

--
-- Name: class_subjects fk_tn_class_subjects_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT fk_tn_class_subjects_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: classes fk_tn_classes_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_tn_classes_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: classes fk_tn_classes_class_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_tn_classes_class_teacher_id FOREIGN KEY (tenant_id, class_teacher_id) REFERENCES public.teachers(tenant_id, id);

--
-- Name: classes fk_tn_classes_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_tn_classes_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: classes fk_tn_classes_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_tn_classes_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: daily_attendances fk_tn_daily_attendances_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT fk_tn_daily_attendances_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: daily_attendances fk_tn_daily_attendances_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT fk_tn_daily_attendances_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.classes(tenant_id, id);

--
-- Name: daily_attendances fk_tn_daily_attendances_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendances
    ADD CONSTRAINT fk_tn_daily_attendances_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: enrollments fk_tn_enrollments_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT fk_tn_enrollments_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: enrollments fk_tn_enrollments_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT fk_tn_enrollments_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: enrollments fk_tn_enrollments_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT fk_tn_enrollments_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: enrollments fk_tn_enrollments_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT fk_tn_enrollments_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: exams fk_tn_exams_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_tn_exams_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: exams fk_tn_exams_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_tn_exams_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: exams fk_tn_exams_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_tn_exams_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: exams fk_tn_exams_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_tn_exams_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: exams fk_tn_exams_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_tn_exams_teacher_id FOREIGN KEY (tenant_id, teacher_id) REFERENCES public.users(tenant_id, id);

--
-- Name: expenditures fk_tn_expenditures_expense_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenditures
    ADD CONSTRAINT fk_tn_expenditures_expense_category_id FOREIGN KEY (tenant_id, expense_category_id) REFERENCES public.expense_categories(tenant_id, id);

--
-- Name: fee_installments fk_tn_fee_installments_student_fee_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fk_tn_fee_installments_student_fee_id FOREIGN KEY (tenant_id, student_fee_id) REFERENCES public.student_fees(tenant_id, id);

--
-- Name: fee_payments fk_tn_fee_payments_student_fee_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fk_tn_fee_payments_student_fee_id FOREIGN KEY (tenant_id, student_fee_id) REFERENCES public.student_fees(tenant_id, id);

--
-- Name: fee_structures fk_tn_fee_structures_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fk_tn_fee_structures_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: fee_structures fk_tn_fee_structures_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fk_tn_fee_structures_category_id FOREIGN KEY (tenant_id, category_id) REFERENCES public.fee_categories(tenant_id, id);

--
-- Name: fee_structures fk_tn_fee_structures_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fk_tn_fee_structures_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: grades fk_tn_grades_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_enrollment_id FOREIGN KEY (tenant_id, enrollment_id) REFERENCES public.enrollments(tenant_id, id);

--
-- Name: grades fk_tn_grades_grading_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_grading_category_id FOREIGN KEY (tenant_id, grading_category_id) REFERENCES public.grading_categories(tenant_id, id);

--
-- Name: grades fk_tn_grades_period_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_period_id FOREIGN KEY (tenant_id, period_id) REFERENCES public.periods(tenant_id, id) ON DELETE SET NULL (period_id);

--
-- Name: grades fk_tn_grades_semester_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_semester_id FOREIGN KEY (tenant_id, semester_id) REFERENCES public.semesters(tenant_id, id) ON DELETE SET NULL (semester_id);

--
-- Name: grades fk_tn_grades_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: grades fk_tn_grades_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT fk_tn_grades_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: grading_categories fk_tn_grading_categories_schema_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_categories
    ADD CONSTRAINT fk_tn_grading_categories_schema_id FOREIGN KEY (tenant_id, schema_id) REFERENCES public.grading_schemas(tenant_id, id);

--
-- Name: grading_schemas fk_tn_grading_schemas_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_schemas
    ADD CONSTRAINT fk_tn_grading_schemas_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: messages fk_tn_messages_parent_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_tn_messages_parent_id FOREIGN KEY (tenant_id, parent_id) REFERENCES public.messages(tenant_id, id);

--
-- Name: periods fk_tn_periods_semester_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT fk_tn_periods_semester_id FOREIGN KEY (tenant_id, semester_id) REFERENCES public.semesters(tenant_id, id) ON DELETE CASCADE;

--
-- Name: periods fk_tn_periods_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT fk_tn_periods_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: promotion_criteria fk_tn_promotion_criteria_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_criteria
    ADD CONSTRAINT fk_tn_promotion_criteria_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: promotion_criteria fk_tn_promotion_criteria_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_criteria
    ADD CONSTRAINT fk_tn_promotion_criteria_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_enrollment_id FOREIGN KEY (tenant_id, enrollment_id) REFERENCES public.enrollments(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_next_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_next_class_id FOREIGN KEY (tenant_id, next_class_id) REFERENCES public.classes(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_next_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_next_grade_id FOREIGN KEY (tenant_id, next_grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_next_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_next_section_id FOREIGN KEY (tenant_id, next_section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: promotion_status fk_tn_promotion_status_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT fk_tn_promotion_status_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: remedial_sessions fk_tn_remedial_sessions_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT fk_tn_remedial_sessions_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: remedial_sessions fk_tn_remedial_sessions_enrollment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT fk_tn_remedial_sessions_enrollment_id FOREIGN KEY (tenant_id, enrollment_id) REFERENCES public.enrollments(tenant_id, id);

--
-- Name: remedial_sessions fk_tn_remedial_sessions_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT fk_tn_remedial_sessions_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: remedial_sessions fk_tn_remedial_sessions_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT fk_tn_remedial_sessions_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: schedules fk_tn_schedules_class_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT fk_tn_schedules_class_id FOREIGN KEY (tenant_id, class_id) REFERENCES public.class_subjects(tenant_id, id) ON DELETE CASCADE;

--
-- Name: sections fk_tn_sections_class_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT fk_tn_sections_class_teacher_id FOREIGN KEY (tenant_id, class_teacher_id) REFERENCES public.teachers(tenant_id, id);

--
-- Name: sections fk_tn_sections_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT fk_tn_sections_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: semesters fk_tn_semesters_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT fk_tn_semesters_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id) ON DELETE CASCADE;

--
-- Name: semesters fk_tn_semesters_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.semesters
    ADD CONSTRAINT fk_tn_semesters_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: student_fees fk_tn_student_fees_fee_structure_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT fk_tn_student_fees_fee_structure_id FOREIGN KEY (tenant_id, fee_structure_id) REFERENCES public.fee_structures(tenant_id, id);

--
-- Name: student_fees fk_tn_student_fees_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT fk_tn_student_fees_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.users(tenant_id, id);

--
-- Name: student_id_sequences fk_tn_student_id_sequences_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_id_sequences
    ADD CONSTRAINT fk_tn_student_id_sequences_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: students fk_tn_students_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_tn_students_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: submissions fk_tn_submissions_assignment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT fk_tn_submissions_assignment_id FOREIGN KEY (tenant_id, assignment_id) REFERENCES public.assignments(tenant_id, id);

--
-- Name: submissions fk_tn_submissions_student_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT fk_tn_submissions_student_id FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id);

--
-- Name: teacher_subject_assignments fk_tn_teacher_subject_assignments_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT fk_tn_teacher_subject_assignments_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: teacher_subject_assignments fk_tn_teacher_subject_assignments_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT fk_tn_teacher_subject_assignments_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: teacher_subject_assignments fk_tn_teacher_subject_assignments_subject_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT fk_tn_teacher_subject_assignments_subject_id FOREIGN KEY (tenant_id, subject_id) REFERENCES public.subjects(tenant_id, id);

--
-- Name: teacher_subject_assignments fk_tn_teacher_subject_assignments_teacher_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT fk_tn_teacher_subject_assignments_teacher_id FOREIGN KEY (tenant_id, teacher_id) REFERENCES public.teachers(tenant_id, id);

--
-- Name: teacher_subject_assignments fk_tn_teacher_subject_assignments_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_subject_assignments
    ADD CONSTRAINT fk_tn_teacher_subject_assignments_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: teachers fk_tn_teachers_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT fk_tn_teachers_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: tenant_notification_configs fk_tn_tenant_notification_configs_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_notification_configs
    ADD CONSTRAINT fk_tn_tenant_notification_configs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: timetables fk_tn_timetables_academic_year_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetables
    ADD CONSTRAINT fk_tn_timetables_academic_year_id FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id);

--
-- Name: timetables fk_tn_timetables_grade_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetables
    ADD CONSTRAINT fk_tn_timetables_grade_id FOREIGN KEY (tenant_id, grade_id) REFERENCES public.academic_grades(tenant_id, id);

--
-- Name: timetables fk_tn_timetables_section_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetables
    ADD CONSTRAINT fk_tn_timetables_section_id FOREIGN KEY (tenant_id, section_id) REFERENCES public.sections(tenant_id, id);

--
-- Name: user_roles fk_user_roles_tenant_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_tenant_id FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: users fk_users_tenant_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_tenant_id FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: grades grades_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id);

--
-- Name: grades grades_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: grading_categories grading_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_categories
    ADD CONSTRAINT grading_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: grading_schemas grading_schemas_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_schemas
    ADD CONSTRAINT grading_schemas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: message_recipients message_recipients_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_recipients
    ADD CONSTRAINT message_recipients_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id);

--
-- Name: message_recipients message_recipients_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_recipients
    ADD CONSTRAINT message_recipients_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id);

--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);

--
-- Name: messages messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: parent_student parent_student_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student
    ADD CONSTRAINT parent_student_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id);

--
-- Name: parent_student parent_student_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_student
    ADD CONSTRAINT parent_student_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);

--
-- Name: parents parents_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);

--
-- Name: permission_role permission_role_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);

--
-- Name: permission_role permission_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_role
    ADD CONSTRAINT permission_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id);

--
-- Name: promotion_criteria promotion_criteria_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_criteria
    ADD CONSTRAINT promotion_criteria_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: promotion_status promotion_status_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_status
    ADD CONSTRAINT promotion_status_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: remedial_sessions remedial_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remedial_sessions
    ADD CONSTRAINT remedial_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: schedules schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: school_calendar_days school_calendar_days_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_calendar_days
    ADD CONSTRAINT school_calendar_days_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: sections sections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: student_fees student_fees_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fees
    ADD CONSTRAINT student_fees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: students students_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);

--
-- Name: subjects subjects_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: submissions submissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: super_admin_activity_logs super_admin_activity_logs_target_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_target_tenant_id_fkey FOREIGN KEY (target_tenant_id) REFERENCES public.tenants(id);

--
-- Name: super_admin_activity_logs super_admin_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

--
-- Name: teachers teachers_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_id_fkey FOREIGN KEY (id) REFERENCES public.users(id);

--
-- Name: tenant_settings tenant_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_settings
    ADD CONSTRAINT tenant_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

--
-- Name: timetables timetables_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timetables
    ADD CONSTRAINT timetables_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

--
-- Name: user_role_association user_role_association_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_association
    ADD CONSTRAINT user_role_association_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;

--
-- Name: user_role_association user_role_association_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_association
    ADD CONSTRAINT user_role_association_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: academic_grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academic_grades ENABLE ROW LEVEL SECURITY;

--
-- Name: academic_years; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: attendances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: class_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: class_subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_attendances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

--
-- Name: expenditures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenditures ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_structures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

--
-- Name: feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

--
-- Name: grading_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grading_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: grading_schemas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grading_schemas ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_criteria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_criteria ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_status ENABLE ROW LEVEL SECURITY;

--
-- Name: remedial_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.remedial_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: school_calendar_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_calendar_days ENABLE ROW LEVEL SECURITY;

--
-- Name: sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

--
-- Name: semesters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

--
-- Name: student_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: student_id_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_id_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_subject_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_subject_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: academic_grades tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.academic_grades USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: academic_years tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.academic_years USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: announcements tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.announcements USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: assessments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.assessments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: assignments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.assignments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: attendance_documents tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.attendance_documents USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: attendance_events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.attendance_events USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: attendance_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.attendance_settings USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: attendances tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.attendances USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: class_enrollments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.class_enrollments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: class_subjects tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.class_subjects USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: classes tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.classes USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: daily_attendances tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.daily_attendances USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: enrollments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.enrollments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: events tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.events USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: exams tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.exams USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: expenditures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.expenditures USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: expense_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.expense_categories USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: fee_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fee_categories USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: fee_installments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fee_installments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: fee_payments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fee_payments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: fee_structures tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.fee_structures USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: feedbacks tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.feedbacks USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: grades tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.grades USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: grading_categories tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.grading_categories USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: grading_schemas tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.grading_schemas USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: messages tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.messages USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: periods tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.periods USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: promotion_criteria tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.promotion_criteria USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: promotion_status tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.promotion_status USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: remedial_sessions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.remedial_sessions USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: schedules tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.schedules USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: school_calendar_days tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.school_calendar_days USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: sections tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.sections USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: semesters tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.semesters USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: student_fees tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.student_fees USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: student_id_sequences tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.student_id_sequences USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: subjects tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.subjects USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: submissions tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.submissions USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: teacher_subject_assignments tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.teacher_subject_assignments USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: tenant_notification_configs tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tenant_notification_configs USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: tenant_settings tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.tenant_settings USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: timetables tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation ON public.timetables USING (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true)))) WITH CHECK (((current_setting('app.bypass_rls'::text, true) = 'on'::text) OR ((tenant_id)::text = current_setting('app.tenant_id'::text, true))));

--
-- Name: tenant_notification_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_notification_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: timetables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

