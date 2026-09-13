"""
Convenient runner script to launch the EV Route Planner web app.
Usage: python run_server.py
"""

import uvicorn
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print("==========================================================")
    print("Starting EV Route Planner (Two-Wheeler Fast Charging)")
    print("Target: Kerala & Tamil Nadu | Bolt.Earth Type-6 DC")
    print("Open in browser: http://localhost:8000")
    print("==========================================================")
    uvicorn.run("src.app:app", host="0.0.0.0", port=8000, reload=False)
