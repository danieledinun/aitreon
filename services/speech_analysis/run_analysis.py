#!/usr/bin/env python3
"""
Wrapper script for running speech analysis via the force-speech-analysis.js script.
This script forwards command line arguments to main.py with the proper subcommand.
"""

import sys
import os
import subprocess

def main():
    if len(sys.argv) < 3 or sys.argv[1] != '--creator-id':
        print("Usage: python run_analysis.py --creator-id <creator_id>")
        sys.exit(1)

    creator_id = sys.argv[2]

    # Call main.py with the analyze subcommand
    main_script = os.path.join(os.path.dirname(__file__), 'main.py')
    cmd = [sys.executable, main_script, 'analyze', '--creator-id', creator_id]

    # Forward environment variables and run the command
    env = os.environ.copy()
    subprocess.run(cmd, env=env)

if __name__ == '__main__':
    main()