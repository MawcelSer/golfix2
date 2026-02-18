CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."course_role" AS ENUM('owner', 'admin', 'marshal', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."hazard_type" AS ENUM('bunker', 'water', 'ob', 'lateral', 'tree_line');--> statement-breakpoint
CREATE TYPE "public"."pace_event_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."pace_event_type" AS ENUM('behind_pace', 'gap_compression', 'gap_severe', 'bottleneck', 'reminder_sent');--> statement-breakpoint
CREATE TYPE "public"."pace_status" AS ENUM('ahead', 'on_pace', 'attention', 'behind');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'finished', 'abandoned');--> statement-breakpoint
CREATE TABLE "course_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"role" "course_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_roles_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"boundary" geometry(Polygon, 4326),
	"address" varchar(500),
	"city" varchar(100),
	"country" varchar(2) DEFAULT 'FR' NOT NULL,
	"holes_count" smallint NOT NULL,
	"par" smallint NOT NULL,
	"pace_target_minutes" smallint NOT NULL,
	"tee_interval_minutes" smallint DEFAULT 8 NOT NULL,
	"timezone" varchar(50) DEFAULT 'Europe/Paris' NOT NULL,
	"data_version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hazards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hole_id" uuid NOT NULL,
	"type" "hazard_type" NOT NULL,
	"name" varchar(100),
	"geometry" geometry(Polygon, 4326),
	"carry_point" geometry(Point, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"hole_number" smallint NOT NULL,
	"par" smallint NOT NULL,
	"stroke_index" smallint NOT NULL,
	"distance_meters" smallint NOT NULL,
	"geofence" geometry(Polygon, 4326),
	"tee_position" geometry(Point, 4326),
	"green_center" geometry(Point, 4326),
	"green_front" geometry(Point, 4326),
	"green_back" geometry(Point, 4326),
	"pace_target_minutes" smallint,
	"transition_minutes" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holes_course_number_unique" UNIQUE("course_id","hole_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"display_name" varchar(100) NOT NULL,
	"password_hash" varchar(255),
	"device_id" varchar(100),
	"handicap_index" numeric(3, 1),
	"push_token" varchar(500),
	"push_subscription" jsonb,
	"notification_prefs" jsonb DEFAULT '{"pace_reminders": true}'::jsonb NOT NULL,
	"gdpr_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_identity_check" CHECK ("users"."email" IS NOT NULL OR "users"."device_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"tee_time_id" uuid,
	"date" date NOT NULL,
	"group_number" smallint NOT NULL,
	"current_hole" smallint,
	"pace_status" "pace_status" DEFAULT 'on_pace' NOT NULL,
	"pace_start_time" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pace_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"group_id" uuid,
	"type" "pace_event_type" NOT NULL,
	"severity" "pace_event_severity" NOT NULL,
	"hole_number" smallint,
	"details" jsonb NOT NULL,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"accuracy" real NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"course_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"total_score" smallint,
	"total_putts" smallint,
	"status" "round_status" DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"hole_number" smallint NOT NULL,
	"strokes" smallint NOT NULL,
	"putts" smallint,
	"fairway_hit" boolean,
	"green_in_regulation" boolean,
	CONSTRAINT "scores_round_hole_unique" UNIQUE("round_id","hole_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"group_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"current_hole" smallint,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tee_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"players_count" smallint DEFAULT 4 NOT NULL,
	"notes" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_roles" ADD CONSTRAINT "course_roles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazards" ADD CONSTRAINT "hazards_hole_id_holes_id_fk" FOREIGN KEY ("hole_id") REFERENCES "public"."holes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holes" ADD CONSTRAINT "holes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_tee_time_id_tee_times_id_fk" FOREIGN KEY ("tee_time_id") REFERENCES "public"."tee_times"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_events" ADD CONSTRAINT "pace_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_events" ADD CONSTRAINT "pace_events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_events" ADD CONSTRAINT "pace_events_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_roles_user" ON "course_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_course_roles_course" ON "course_roles" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_courses_boundary" ON "courses" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "idx_hazards_geometry" ON "hazards" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "idx_holes_geofence" ON "holes" USING gist ("geofence");--> statement-breakpoint
CREATE INDEX "idx_holes_green_center" ON "holes" USING gist ("green_center");--> statement-breakpoint
CREATE INDEX "idx_groups_course_date" ON "groups" USING btree ("course_id","date");--> statement-breakpoint
CREATE INDEX "idx_pace_events_course_date" ON "pace_events" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_positions_session" ON "positions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_rounds_user" ON "rounds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rounds_course" ON "rounds" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "idx_scores_round" ON "scores" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_course_status" ON "sessions" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "idx_tee_times_course_date" ON "tee_times" USING btree ("course_id","scheduled_at");