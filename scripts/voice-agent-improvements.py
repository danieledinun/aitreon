#!/usr/bin/env python3
"""
Improved Voice Agent Session Management
Fixes for stuck agent issues
"""

import asyncio
import logging
from datetime import datetime, timedelta

# Improved session management code to replace the existing infinite loop

async def improved_session_management(ctx, session, user_id, active_user_sessions):
    """
    Improved session management with proper timeout and cleanup
    """
    logger = logging.getLogger(__name__)
    session_start_time = datetime.now()
    max_session_duration = timedelta(hours=2)  # Max 2 hours per session
    heartbeat_count = 0
    consecutive_errors = 0
    max_consecutive_errors = 5
    
    logger.info("🔄 Starting improved session management...")
    
    try:
        while True:
            await asyncio.sleep(5)  # Check every 5 seconds
            heartbeat_count += 1
            
            # Log heartbeat every 3rd iteration (15 seconds)
            if heartbeat_count % 3 == 0:
                logger.debug(f"💓 Heartbeat #{heartbeat_count//3} - Session active for {datetime.now() - session_start_time}")
            
            # Check session duration timeout
            if datetime.now() - session_start_time > max_session_duration:
                logger.info(f"⏰ Session exceeded maximum duration ({max_session_duration})")
                logger.info("🛑 Terminating agent session due to timeout")
                break
            
            try:
                # Check if room is still connected
                from livekit import rtc
                if ctx.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
                    logger.info(f"🔌 Room disconnected (state: {ctx.room.connection_state})")
                    logger.info("🛑 Terminating agent session due to disconnection")
                    break
                
                # Check if room has any participants
                if len(ctx.room.participants) == 0:
                    logger.info("👤 No participants in room")
                    logger.info("🛑 Terminating agent session - empty room")
                    break
                
                # Check for stale session (no activity)
                # This is a more robust check than just connection state
                if hasattr(session, '_room_input') and session._room_input:
                    logger.debug("📡 Audio stream is active")
                    consecutive_errors = 0  # Reset error count on success
                else:
                    consecutive_errors += 1
                    logger.warning(f"⚠️ Audio stream not active (error {consecutive_errors}/{max_consecutive_errors})")
                    
                    if consecutive_errors >= max_consecutive_errors:
                        logger.error("❌ Too many consecutive errors - terminating session")
                        break
                
            except Exception as check_error:
                consecutive_errors += 1
                logger.error(f"❌ Error checking session status: {check_error} (error {consecutive_errors}/{max_consecutive_errors})")
                
                if consecutive_errors >= max_consecutive_errors:
                    logger.error("❌ Too many consecutive errors - terminating session")
                    break
                    
    except asyncio.CancelledError:
        logger.info("📴 Session cancelled - shutting down gracefully")
    except Exception as e:
        logger.error(f"❌ Fatal error in session management: {e}")
    finally:
        await cleanup_session(ctx, session, user_id, active_user_sessions, logger)

async def cleanup_session(ctx, session, user_id, active_user_sessions, logger):
    """
    Improved cleanup with better error handling
    """
    logger.info("🔚 Starting session cleanup...")
    session_key = f"{user_id}:{ctx.room.name}"
    
    # Clean up session tracking
    try:
        if session_key in active_user_sessions:
            session_info = active_user_sessions.pop(session_key)
            duration = datetime.now() - session_info['started_at']
            logger.info(f"🔐 Unregistered session for room {ctx.room.name}")
            logger.info(f"📊 Session duration: {duration}")
            logger.info(f"📊 Remaining active sessions: {len(active_user_sessions)}")
    except Exception as cleanup_error:
        logger.error(f"❌ Error cleaning up session tracking: {cleanup_error}")
    
    # Close session with timeout
    try:
        logger.info("🔄 Closing agent session...")
        await asyncio.wait_for(session.aclose(), timeout=10.0)
        logger.info("✅ Session closed successfully")
    except asyncio.TimeoutError:
        logger.error("⏰ Session close timed out - forcing closure")
    except Exception as close_error:
        logger.error(f"❌ Error closing session: {close_error}")
    
    # Disconnect from room with timeout
    try:
        logger.info("🔄 Disconnecting from room...")
        await asyncio.wait_for(ctx.room.disconnect(), timeout=10.0)
        logger.info("🔌 Disconnected from room successfully")
    except asyncio.TimeoutError:
        logger.error("⏰ Room disconnect timed out")
    except Exception as disconnect_error:
        logger.error(f"❌ Error disconnecting from room: {disconnect_error}")
    
    logger.info("✅ Session cleanup completed")

# Additional utility functions for monitoring

def log_active_sessions(active_user_sessions):
    """Log information about currently active sessions"""
    logger = logging.getLogger(__name__)
    
    if not active_user_sessions:
        logger.info("📊 No active voice sessions")
        return
    
    logger.info(f"📊 Active voice sessions: {len(active_user_sessions)}")
    for session_key, info in active_user_sessions.items():
        duration = datetime.now() - info['started_at']
        logger.info(f"   - {session_key}: {duration} (job: {info['job_id']})")

async def monitor_and_cleanup_stale_sessions(active_user_sessions, max_age_hours=2):
    """
    Background task to monitor and cleanup stale sessions
    """
    logger = logging.getLogger(__name__)
    
    while True:
        try:
            await asyncio.sleep(300)  # Check every 5 minutes
            
            current_time = datetime.now()
            stale_sessions = []
            
            for session_key, info in active_user_sessions.items():
                age = current_time - info['started_at']
                if age > timedelta(hours=max_age_hours):
                    stale_sessions.append(session_key)
            
            if stale_sessions:
                logger.warning(f"🧹 Found {len(stale_sessions)} stale sessions to cleanup")
                for session_key in stale_sessions:
                    try:
                        info = active_user_sessions.pop(session_key)
                        logger.warning(f"🗑️ Removed stale session: {session_key} (age: {current_time - info['started_at']})")
                    except KeyError:
                        pass  # Already removed
            
            log_active_sessions(active_user_sessions)
            
        except Exception as monitor_error:
            logger.error(f"❌ Error in session monitor: {monitor_error}")
            await asyncio.sleep(60)  # Wait before retrying