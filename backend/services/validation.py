"""Server-side citation validation: never trust model-supplied IDs or quotes."""
def validate_citations(output, chunk_map):
    """chunk_map: {str(chunk_id): chunk}. Returns (ok, errors). Mutates nothing."""
    errors = []
    for f in output.get("findings", []):
        for ev in f.get("evidence", []):
            cid = str(ev.get("document_chunk_id"))
            if cid not in chunk_map:
                errors.append(f"Finding {f.get('finding_id')}: invented/unknown chunk id {cid}")
                continue
            chunk = chunk_map[cid]
            if ev.get("page_number") != chunk.page_number:
                errors.append(f"Finding {f.get('finding_id')}: page mismatch for chunk {cid}")
            quoted = " ".join(str(ev.get("quoted_text","")).split())
            source = " ".join(chunk.text.split())
            if quoted and quoted[:80] not in source and source[:80] not in quoted:
                # allow short quotes that are a substring check on normalized text
                if quoted not in source:
                    errors.append(f"Finding {f.get('finding_id')}: quoted text not found in chunk {cid}")
    return (len(errors) == 0), errors
