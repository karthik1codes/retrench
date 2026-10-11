// Signal Scout Neo4j 5 schema — constraints + indexes
// Idempotent: safe to re-run

CREATE CONSTRAINT segment_id IF NOT EXISTS
FOR (s:Segment) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT company_cd_id IF NOT EXISTS
FOR (c:Company) REQUIRE c.crustdata_id IS UNIQUE;

CREATE CONSTRAINT person_cd_id IF NOT EXISTS
FOR (p:Person) REQUIRE p.crustdata_id IS UNIQUE;

CREATE CONSTRAINT job_ext_id IF NOT EXISTS
FOR (j:JobPosting) REQUIRE j.external_id IS UNIQUE;

CREATE CONSTRAINT signal_id IF NOT EXISTS
FOR (s:Signal) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT draft_id IF NOT EXISTS
FOR (d:Draft) REQUIRE d.id IS UNIQUE;

CREATE CONSTRAINT evidence_hash IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.payload_hash IS UNIQUE;

CREATE CONSTRAINT run_id IF NOT EXISTS
FOR (r:Run) REQUIRE r.id IS UNIQUE;

CREATE INDEX company_domain IF NOT EXISTS FOR (c:Company) ON (c.domain);
CREATE INDEX signal_state IF NOT EXISTS FOR (s:Signal) ON (s.state);
CREATE INDEX signal_detected IF NOT EXISTS FOR (s:Signal) ON (s.detected_at);
CREATE INDEX run_status IF NOT EXISTS FOR (r:Run) ON (r.status);
