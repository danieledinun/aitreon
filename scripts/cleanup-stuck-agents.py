#!/usr/bin/env python3
"""
Voice Agent Cleanup Script
Detects and terminates stuck voice agent processes
"""

import subprocess
import signal
import time
import re
from datetime import datetime, timedelta

def get_voice_agent_processes():
    """Get all running voice agent processes"""
    try:
        result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
        lines = result.stdout.split('\n')
        
        agent_processes = []
        for line in lines:
            if 'correct_voice_agent.py' in line and 'grep' not in line:
                parts = line.split()
                if len(parts) >= 11:
                    pid = int(parts[1])
                    # Extract start time (parts[8])
                    start_time = parts[8]
                    
                    agent_processes.append({
                        'pid': pid,
                        'start_time': start_time,
                        'full_line': line
                    })
        
        return agent_processes
    except Exception as e:
        print(f"Error getting processes: {e}")
        return []

def is_process_stuck(process_info, max_age_minutes=30):
    """Check if a process has been running too long"""
    try:
        start_time = process_info['start_time']
        
        # If start time contains day (like "Sat04PM"), it's been running since yesterday
        if any(day in start_time for day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']):
            print(f"⚠️  Process {process_info['pid']} started on {start_time} - definitely stuck")
            return True
        
        # For time format like "07:08PM", check if it's older than max_age_minutes
        # This is a simplified check - in production you'd parse actual timestamps
        
        return False  # For now, let manual inspection handle this
        
    except Exception as e:
        print(f"Error checking process age: {e}")
        return False

def cleanup_stuck_agents(dry_run=True):
    """Cleanup stuck voice agent processes"""
    print("🔍 Scanning for voice agent processes...")
    
    processes = get_voice_agent_processes()
    
    if not processes:
        print("✅ No voice agent processes found")
        return
    
    print(f"📊 Found {len(processes)} voice agent process(es)")
    
    for proc in processes:
        print(f"\n🔍 Process {proc['pid']}:")
        print(f"   Start time: {proc['start_time']}")
        print(f"   Command: {proc['full_line']}")
        
        if is_process_stuck(proc):
            print(f"⚠️  Process {proc['pid']} appears to be stuck")
            
            if dry_run:
                print(f"🔄 DRY RUN: Would kill process {proc['pid']}")
            else:
                print(f"💀 Killing stuck process {proc['pid']}")
                try:
                    subprocess.run(['kill', '-9', str(proc['pid'])], check=True)
                    print(f"✅ Process {proc['pid']} terminated")
                except subprocess.CalledProcessError as e:
                    print(f"❌ Failed to kill process {proc['pid']}: {e}")
        else:
            print(f"✅ Process {proc['pid']} seems normal")

def main():
    print("🧹 Voice Agent Cleanup Script")
    print("=" * 40)
    
    # First, do a dry run
    cleanup_stuck_agents(dry_run=True)
    
    print("\n" + "=" * 40)
    response = input("Do you want to kill the stuck processes? (y/N): ")
    
    if response.lower() == 'y':
        print("\n💀 Killing stuck processes...")
        cleanup_stuck_agents(dry_run=False)
    else:
        print("🔄 Cleanup cancelled")

if __name__ == "__main__":
    main()