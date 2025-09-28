#!/usr/bin/env python3
"""
Room Session Manager - Prevents multiple voice agents in the same room
Implements distributed locking mechanism using file-based coordination
"""

import asyncio
import fcntl
import json
import logging
import os
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class RoomSessionManager:
    """
    Thread-safe, process-safe room session manager using file locking
    Prevents multiple voice agents from joining the same room
    """
    
    def __init__(self, lock_dir: Optional[str] = None):
        """Initialize the room session manager"""
        self.lock_dir = Path(lock_dir) if lock_dir else Path(tempfile.gettempdir()) / "livekit_room_locks"
        self.lock_dir.mkdir(exist_ok=True)
        
        # In-memory session tracking (per process)
        self._local_sessions: Dict[str, Dict] = {}
        
        # File handles for active locks
        self._lock_handles: Dict[str, object] = {}
        
        logger.info(f"🔐 RoomSessionManager initialized with lock_dir: {self.lock_dir}")
    
    def _get_lock_file_path(self, room_name: str) -> Path:
        """Get the lock file path for a room"""
        # Use room name hash to create safe filename
        safe_room_name = room_name.replace("/", "_").replace(":", "_")
        return self.lock_dir / f"room_{safe_room_name}.lock"
    
    async def acquire_room_lock(self, room_name: str, job_id: str, user_id: str, timeout: int = 5) -> bool:
        """
        Try to acquire exclusive lock for a room
        Returns True if successfully acquired, False if room is already locked
        """
        lock_file_path = self._get_lock_file_path(room_name)
        session_key = f"{user_id}:{room_name}"
        
        logger.info(f"🔐 Attempting to acquire lock for room: {room_name} (job: {job_id})")
        
        try:
            # Check if we already have this session (shouldn't happen, but safety check)
            if session_key in self._local_sessions:
                logger.warning(f"⚠️ Local session already exists for {session_key} - cleaning up")
                await self.release_room_lock(room_name, user_id)
            
            # Try to acquire file lock with robust error handling
            try:
                lock_file = open(lock_file_path, 'w')
            except Exception as open_error:
                logger.error(f"🔐❌ Could not open lock file {lock_file_path}: {open_error}")
                return False
            
            # Use non-blocking lock with timeout
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    # Try to acquire exclusive lock (non-blocking)
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    
                    # Successfully acquired lock - write session info atomically
                    session_info = {
                        'room_name': room_name,
                        'job_id': job_id,
                        'user_id': user_id,
                        'pid': os.getpid(),
                        'acquired_at': datetime.now().isoformat(),
                        'expires_at': (datetime.now() + timedelta(hours=1)).isoformat()
                    }
                    
                    # Write atomically to prevent corruption
                    try:
                        # Clear the file first
                        lock_file.seek(0)
                        lock_file.truncate()
                        
                        # Write JSON data
                        json_data = json.dumps(session_info, indent=2)
                        lock_file.write(json_data)
                        lock_file.flush()
                        
                        # Force sync to disk to prevent corruption
                        os.fsync(lock_file.fileno())
                        
                    except Exception as write_error:
                        logger.error(f"🔐❌ Error writing lock file data: {write_error}")
                        try:
                            lock_file.close()
                        except:
                            pass
                        return False
                    
                    # Store in local tracking
                    self._local_sessions[session_key] = session_info
                    self._lock_handles[session_key] = lock_file
                    
                    logger.info(f"🔐✅ Successfully acquired room lock: {room_name} (job: {job_id})")
                    return True
                    
                except BlockingIOError:
                    # Lock is held by another process - wait and retry
                    await asyncio.sleep(0.1)
                    continue
                    
            # Timeout reached
            lock_file.close()
            logger.warning(f"🔐❌ Failed to acquire room lock: {room_name} (timeout after {timeout}s)")
            
            # Try to read existing lock info for debugging with better error handling
            try:
                if lock_file_path.exists():
                    if lock_file_path.stat().st_size == 0:
                        logger.warning(f"🔐🧹 Existing lock file is empty - cleaning it up")
                        try:
                            lock_file_path.unlink()
                        except:
                            pass
                    else:
                        content = lock_file_path.read_text().strip()
                        if content:
                            existing_info = json.loads(content)
                            logger.warning(f"🔐📋 Existing lock held by job {existing_info.get('job_id')} (pid: {existing_info.get('pid')})")
                        else:
                            logger.warning(f"🔐🧹 Existing lock file has empty content - cleaning it up")
                            try:
                                lock_file_path.unlink()
                            except:
                                pass
            except json.JSONDecodeError as je:
                logger.warning(f"🔐🧹 Corrupted lock file detected - cleaning it up (JSON error: {str(je)[:50]})")
                try:
                    lock_file_path.unlink()
                except:
                    pass
            except Exception as e:
                logger.warning(f"🔐❌ Could not process existing lock info: {e}")
            
            return False
            
        except Exception as e:
            logger.error(f"🔐❌ Error acquiring room lock for {room_name}: {e}")
            return False
    
    async def release_room_lock(self, room_name: str, user_id: str):
        """Release the room lock"""
        session_key = f"{user_id}:{room_name}"
        lock_file_path = self._get_lock_file_path(room_name)
        
        logger.info(f"🔐 Releasing lock for room: {room_name}")
        
        try:
            # Close and remove lock handle
            if session_key in self._lock_handles:
                lock_handle = self._lock_handles[session_key]
                try:
                    fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
                    lock_handle.close()
                except Exception as e:
                    logger.warning(f"🔐❌ Error releasing file lock: {e}")
                
                del self._lock_handles[session_key]
            
            # Remove from local tracking
            if session_key in self._local_sessions:
                del self._local_sessions[session_key]
            
            # Clean up lock file
            try:
                if lock_file_path.exists():
                    lock_file_path.unlink()
            except Exception as e:
                logger.warning(f"🔐❌ Error removing lock file: {e}")
            
            logger.info(f"🔐✅ Successfully released room lock: {room_name}")
            
        except Exception as e:
            logger.error(f"🔐❌ Error releasing room lock for {room_name}: {e}")
    
    async def is_room_locked(self, room_name: str) -> bool:
        """Check if a room is currently locked by another process"""
        lock_file_path = self._get_lock_file_path(room_name)
        
        if not lock_file_path.exists():
            return False
        
        try:
            # Check if lock file is empty or corrupted
            if lock_file_path.stat().st_size == 0:
                logger.warning(f"🔐🧹 Removing empty lock file for room: {room_name}")
                try:
                    lock_file_path.unlink()
                except:
                    pass
                return False
            
            # Try to read and parse lock file
            content = lock_file_path.read_text().strip()
            if not content:
                logger.warning(f"🔐🧹 Removing lock file with empty content for room: {room_name}")
                try:
                    lock_file_path.unlink()
                except:
                    pass
                return False
            
            try:
                lock_info = json.loads(content)
            except json.JSONDecodeError:
                logger.warning(f"🔐🧹 Removing corrupted lock file for room: {room_name}")
                try:
                    lock_file_path.unlink()
                except:
                    pass
                return False
            
            # Check if lock has expired
            expires_at = datetime.fromisoformat(lock_info.get('expires_at', '1970-01-01'))
            if datetime.now() > expires_at:
                logger.warning(f"🔐🧹 Cleaning up expired lock for room: {room_name}")
                try:
                    lock_file_path.unlink()
                except:
                    pass
                return False
            
            # Check if the process that created the lock is still alive
            pid = lock_info.get('pid')
            if pid and not self._is_process_alive(pid):
                logger.warning(f"🔐🧹 Cleaning up lock from dead process {pid} for room: {room_name}")
                try:
                    lock_file_path.unlink()
                except:
                    pass
                return False
            
            # Lock is still valid
            return True
            
        except Exception as e:
            logger.warning(f"🔐❌ Error checking room lock status, cleaning up: {e}")
            try:
                lock_file_path.unlink()
            except:
                pass
            return False
    
    async def get_active_sessions(self) -> Dict[str, Dict]:
        """Get all currently active sessions"""
        return self._local_sessions.copy()
    
    async def cleanup_expired_locks(self):
        """Clean up any expired or corrupted lock files with smart recovery"""
        logger.info(f"🔐🧹 Cleaning up expired locks in {self.lock_dir}")
        
        cleaned_count = 0
        corrupted_count = 0
        
        try:
            for lock_file in self.lock_dir.glob("room_*.lock"):
                should_remove = False
                removal_reason = ""
                
                try:
                    # Check if file is empty or has no content
                    if lock_file.stat().st_size == 0:
                        should_remove = True
                        removal_reason = "empty file"
                        corrupted_count += 1
                    else:
                        # Try to parse the JSON content
                        content = lock_file.read_text().strip()
                        if not content:
                            should_remove = True
                            removal_reason = "empty content"
                            corrupted_count += 1
                        else:
                            try:
                                lock_info = json.loads(content)
                                
                                # Check if lock has expired
                                expires_at_str = lock_info.get('expires_at', '1970-01-01')
                                expires_at = datetime.fromisoformat(expires_at_str)
                                
                                if datetime.now() > expires_at:
                                    should_remove = True
                                    removal_reason = f"expired at {expires_at_str}"
                                    cleaned_count += 1
                                else:
                                    # Check if the process that created the lock is still alive
                                    pid = lock_info.get('pid')
                                    if pid and not self._is_process_alive(pid):
                                        should_remove = True
                                        removal_reason = f"process {pid} no longer exists"
                                        cleaned_count += 1
                                        
                            except json.JSONDecodeError as je:
                                should_remove = True
                                removal_reason = f"JSON parse error: {str(je)[:50]}"
                                corrupted_count += 1
                            except (KeyError, ValueError) as ve:
                                should_remove = True
                                removal_reason = f"invalid lock format: {str(ve)[:50]}"
                                corrupted_count += 1
                                
                except Exception as file_error:
                    should_remove = True
                    removal_reason = f"file access error: {str(file_error)[:50]}"
                    corrupted_count += 1
                
                # Remove the lock file if needed
                if should_remove:
                    try:
                        logger.info(f"🔐🧹 Removing lock: {lock_file.name} ({removal_reason})")
                        lock_file.unlink()
                    except Exception as remove_error:
                        logger.error(f"🔐❌ Could not remove lock file {lock_file.name}: {remove_error}")
                        
            # Log cleanup summary
            if cleaned_count > 0 or corrupted_count > 0:
                logger.info(f"🔐✅ Cleanup complete: {cleaned_count} expired, {corrupted_count} corrupted files removed")
            else:
                logger.info("🔐✅ No cleanup needed - all lock files are valid")
                    
        except Exception as e:
            logger.error(f"🔐❌ Error during cleanup: {e}")
    
    def _is_process_alive(self, pid: int) -> bool:
        """Check if a process with given PID is still running"""
        try:
            import os
            import signal
            # Send signal 0 to check if process exists without actually sending a signal
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError, TypeError):
            return False

# Global instance
_room_manager = None

def get_room_session_manager() -> RoomSessionManager:
    """Get global room session manager instance"""
    global _room_manager
    if _room_manager is None:
        _room_manager = RoomSessionManager()
    return _room_manager