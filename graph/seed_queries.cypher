// Useful ops queries

// Unfinished work after a crash
// MATCH (s:Signal) WHERE s.state IN ['detected','qualified'] RETURN s ORDER BY s.detected_at;

// Evidence chain for a draft
// MATCH (d:Draft)-[:CITES]->(e:Evidence)<-[:EVIDENCED_BY]-(s:Signal)
// WHERE d.id = $draftId RETURN d, s, e;

// Who joined a watched company in last 7 days
// MATCH (seg:Segment)-[:WATCHES]->(c:Company)-[:EMPLOYS]->(p:Person)
// WHERE p.tenure_start >= datetime() - duration('P7D')
// RETURN c.name, p.name, p.title, p.tenure_start;
