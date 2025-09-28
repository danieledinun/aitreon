#!/usr/bin/env python3

import asyncio
import os
from dotenv import load_dotenv
from livekit import api

# Load environment variables
load_dotenv()

async def test_livekit_connection():
    """Test LiveKit connection and room creation"""
    
    try:
        # Get credentials from environment
        livekit_url = os.getenv("LIVEKIT_URL")
        api_key = os.getenv("LIVEKIT_API_KEY") 
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        
        print(f"🔧 Testing LiveKit connection...")
        print(f"   URL: {livekit_url}")
        print(f"   API Key: {api_key[:10]}...")
        
        # Create LiveKit API client
        client = api.LiveKitAPI(livekit_url, api_key, api_secret)
        
        # Test room creation
        test_room_name = "test-voice-agent-connection"
        print(f"🏠 Creating test room: {test_room_name}")
        
        room = await client.room.create_room(
            api.CreateRoomRequest(name=test_room_name)
        )
        
        print(f"✅ Room created successfully: {room.name}")
        
        # List rooms to verify
        rooms = await client.room.list_rooms(api.ListRoomsRequest())
        print(f"📋 Found {len(rooms.rooms)} rooms:")
        for room in rooms.rooms:
            print(f"   - {room.name} (participants: {room.num_participants})")
        
        print("✅ LiveKit connection test successful!")
        return True
        
    except Exception as e:
        print(f"❌ LiveKit connection test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_livekit_connection())
    exit(0 if success else 1)