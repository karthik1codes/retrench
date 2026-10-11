"""CLI: python -m signalscout run --config segment.yaml"""

from __future__ import annotations

import argparse
import json
import sys

from dotenv import load_dotenv


def main(argv: list[str] | None = None) -> int:
    load_dotenv(".env.local")
    load_dotenv()

    parser = argparse.ArgumentParser(prog="signalscout")
    sub = parser.add_subparsers(dest="cmd", required=True)

    run_p = sub.add_parser("run", help="Run one full cycle and exit")
    run_p.add_argument("--config", default="segment.yaml")
    run_p.add_argument("--dry-run", action="store_true")
    run_p.add_argument("--no-digest", action="store_true")

    sub.add_parser("bootstrap-graph", help="Apply Neo4j schema")

    args = parser.parse_args(argv)

    if args.cmd == "bootstrap-graph":
        from signalscout.orchestrator import connect_graph

        g = connect_graph()
        g.bootstrap_schema()
        g.close()
        print("schema ok")
        return 0

    if args.cmd == "run":
        from signalscout.orchestrator import run_cycle

        result = run_cycle(
            args.config,
            dry_run=args.dry_run,
            write_digest=not args.no_digest,
        )
        print(json.dumps(result, indent=2, default=str))
        return 0 if result.get("status") == "complete" else 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
