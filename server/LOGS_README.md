Viewing and pretty-printing logs

Logs are written in JSON to the `logs/` folder (daily rotated). The console output is colorized and human-friendly in non-production.

Quick commands:

- List log files:

```bash
ls -lah logs/
```

- Tail today's log file (raw JSON lines):

```bash
tail -f logs/trash2cash-$(date +%F).log
```

- Pretty-print JSON stream with `jq`:

```bash
tail -f logs/trash2cash-$(date +%F).log | jq '.'
```

- Tail and show a compact human line (timestamp, level, message, traceId):

```bash
tail -f logs/trash2cash-$(date +%F).log | jq -r '"\(.timestamp) \(.level) \(.message) trace:\(.traceId // "-") ctx:\(.context // "-")"'
```

- Show only booking events:

```bash
jq 'select(.event == "booking.create" or (.event | test("^booking\\.")))' logs/trash2cash-$(date +%F).log
```

- Search for a traceId across logs:

```bash
jq --arg id "<TRACE_ID>" 'select(.traceId==$id)' logs/*.log
```

Notes:

- Production: the console switches to JSON to make logs machine-parseable. File logs remain JSON so they can be shipped to ELK/Loki/CloudWatch.
- For a more feature-rich viewer, consider installing `lnav` or shipping logs to Loki + Grafana for query/UI.
