#!/usr/bin/env python3
"""
Test script to verify room name consistency between frontend and backend
Simulates the room naming behavior and tests collision detection
"""

import asyncio
import logging
from room_session_manager import get_room_session_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def simulate_frontend_room_generation(user_id: str, creator_id: str, timestamp: int) -> str:
    """Simulate how the frontend generates room names"""
    return f"voice_call_{user_id}_{creator_id}_{timestamp}"

async def test_room_name_consistency():
    """Test that using the same room name prevents collisions"""
    logger.info("🧪 Testing Room Name Consistency")
    
    # Simulate same user and creator with same timestamp (what should happen now)
    user_id = "test_user_123"
    creator_id = "creator_456" 
    timestamp = 1757079300000  # Fixed timestamp
    
    # Generate the same room name (as would happen with our fix)
    room_name = simulate_frontend_room_generation(user_id, creator_id, timestamp)
    logger.info(f"📛 Generated room name: {room_name}")
    
    room_manager = get_room_session_manager()
    await room_manager.cleanup_expired_locks()
    
    # Test 1: First agent should acquire lock successfully
    logger.info("🤖 Testing first agent...")
    success1 = await room_manager.acquire_room_lock(
        room_name=room_name,
        job_id="job_agent_1",
        user_id="agent_user_1",
        timeout=2
    )
    
    if success1:
        logger.info("🤖✅ First agent acquired lock successfully")
        
        # Test 2: Second agent should fail to acquire the same lock
        logger.info("🤖 Testing second agent...")
        success2 = await room_manager.acquire_room_lock(
            room_name=room_name,
            job_id="job_agent_2", 
            user_id="agent_user_2",
            timeout=2
        )
        
        if not success2:
            logger.info("🤖❌ Second agent correctly FAILED to acquire lock (collision detected!)")
            logger.info("🎉 ROOM NAME CONSISTENCY TEST PASSED!")
        else:
            logger.error("🤖⚠️ Second agent incorrectly acquired lock - COLLISION DETECTION FAILED!")
        
        # Release the first lock
        await room_manager.release_room_lock(room_name, "agent_user_1")
        logger.info("🤖🔓 First agent released lock")
        
        # Test 3: Second agent should now succeed
        logger.info("🤖 Testing second agent after release...")
        success3 = await room_manager.acquire_room_lock(
            room_name=room_name,
            job_id="job_agent_2",
            user_id="agent_user_2", 
            timeout=2
        )
        
        if success3:
            logger.info("🤖✅ Second agent successfully acquired lock after release")
            await room_manager.release_room_lock(room_name, "agent_user_2")
            logger.info("🤖🔓 Second agent released lock")
        else:
            logger.error("🤖❌ Second agent failed to acquire lock after release")
            
    else:
        logger.error("🤖❌ First agent failed to acquire lock - basic locking not working")

async def test_different_room_names():
    """Test that different room names allow concurrent agents"""
    logger.info("🧪 Testing Different Room Names (Should Allow Concurrency)")
    
    user_id = "test_user_123"
    creator_id = "creator_456"
    
    # Generate different room names (different timestamps)
    room_name1 = simulate_frontend_room_generation(user_id, creator_id, 1757079300001)
    room_name2 = simulate_frontend_room_generation(user_id, creator_id, 1757079300002)
    
    logger.info(f"📛 Room 1: {room_name1}")
    logger.info(f"📛 Room 2: {room_name2}")
    
    room_manager = get_room_session_manager()
    
    # Both agents should acquire locks successfully (different rooms)
    success1 = await room_manager.acquire_room_lock(
        room_name=room_name1,
        job_id="job_agent_1", 
        user_id="agent_user_1",
        timeout=2
    )
    
    success2 = await room_manager.acquire_room_lock(
        room_name=room_name2,
        job_id="job_agent_2",
        user_id="agent_user_2", 
        timeout=2
    )
    
    if success1 and success2:
        logger.info("🎉 DIFFERENT ROOM NAMES TEST PASSED! Both agents acquired locks")
        
        # Clean up
        await room_manager.release_room_lock(room_name1, "agent_user_1")
        await room_manager.release_room_lock(room_name2, "agent_user_2")
        logger.info("🧹 Cleaned up both locks")
    else:
        logger.error(f"❌ Different room names test failed: success1={success1}, success2={success2}")

async def main():
    """Run all tests"""
    await test_room_name_consistency()
    print()
    await test_different_room_names()
    
    logger.info("✅ All collision detection tests completed!")

if __name__ == "__main__":
    asyncio.run(main())