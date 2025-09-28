#!/usr/bin/env python3
"""
Test script to verify room collision detection is working
Simulates multiple agents trying to join the same room
"""

import asyncio
import logging
from room_session_manager import get_room_session_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def simulate_agent(agent_id: str, room_name: str):
    """Simulate an agent trying to join a room"""
    logger.info(f"🤖 Agent {agent_id} attempting to join room: {room_name}")
    
    room_manager = get_room_session_manager()
    
    # Try to acquire lock
    success = await room_manager.acquire_room_lock(
        room_name=room_name,
        job_id=f"job_{agent_id}",
        user_id=f"user_{agent_id}",
        timeout=2
    )
    
    if success:
        logger.info(f"🤖✅ Agent {agent_id} successfully acquired room lock!")
        
        # Hold the lock for a bit
        await asyncio.sleep(3)
        
        # Release the lock
        await room_manager.release_room_lock(room_name, f"user_{agent_id}")
        logger.info(f"🤖🔓 Agent {agent_id} released room lock")
        
    else:
        logger.warning(f"🤖❌ Agent {agent_id} FAILED to acquire room lock (room is busy)")

async def main():
    """Test collision detection with multiple concurrent agents"""
    logger.info("🧪 Testing Room Collision Detection")
    
    test_room = "test_voice_room_123"
    
    # Simulate 3 agents trying to join the same room simultaneously
    tasks = []
    for i in range(1, 4):
        task = asyncio.create_task(simulate_agent(f"agent_{i}", test_room))
        tasks.append(task)
    
    # Wait for all agents to complete
    await asyncio.gather(*tasks)
    
    logger.info("🧪 Test completed!")

if __name__ == "__main__":
    asyncio.run(main())