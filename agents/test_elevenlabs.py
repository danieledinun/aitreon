#!/usr/bin/env python3

import os
from dotenv import load_dotenv
from livekit.plugins import elevenlabs

# Load environment variables
load_dotenv()

async def test_elevenlabs():
    """Test ElevenLabs TTS configuration"""
    
    print("🔧 Testing ElevenLabs TTS...")
    
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "sk_c874984cef2885f92ae15e21aa103b9459a9e7639093ee68")
    print(f"🔑 API Key: {elevenlabs_key[:30]}...")
    
    try:
        tts = elevenlabs.TTS(
            voice_id="50UFKf9NJ8SnfBjOKtlv",  # The Air Fryer Geek's cloned voice
            model="eleven_turbo_v2_5",
            api_key=elevenlabs_key
        )
        print("✅ ElevenLabs TTS initialized")
        
        # Test basic TTS generation
        test_text = "Hello, this is a test message."
        print(f"🎵 Testing TTS with: {test_text}")
        
        audio_data = await tts.synthesize(test_text)
        print(f"🔊 Generated {len(audio_data.audio) if audio_data.audio else 0} bytes of audio")
        
        if audio_data.audio and len(audio_data.audio) > 0:
            print("✅ ElevenLabs TTS test successful!")
            return True
        else:
            print("❌ No audio data generated")
            return False
        
    except Exception as e:
        print(f"❌ ElevenLabs TTS test failed: {e}")
        return False

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_elevenlabs())