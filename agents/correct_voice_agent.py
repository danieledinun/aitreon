#!/usr/bin/env python3

import asyncio
import logging
import os
import time
from datetime import datetime
from dotenv import load_dotenv
import re

from livekit import agents
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import openai, elevenlabs, deepgram, silero

# Import our simple memory system
from simple_memory import get_memory, cleanup_memories

# Import video tools for intelligent video suggestions
from video_tools import video_tool

# Import room session manager for collision prevention
from room_session_manager import get_room_session_manager

# Load environment variables
load_dotenv()

# Configure detailed logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Note: Session collision detection now handled by file-based room_session_manager

class VoiceMetrics:
    """Collect and track voice agent metrics including EOU latency"""
    def __init__(self, room_name: str, user_id: str):
        self.room_name = room_name
        self.user_id = user_id
        self.session_start_time = time.time()
        self.conversation_turns = 0
        
        # EOU (End of Utterance) tracking
        self.utterance_start_time = None
        self.user_speech_end_time = None
        self.ai_response_start_time = None
        self.ai_response_complete_time = None
        
        # Cumulative metrics
        self.total_response_time = 0
        self.total_user_speech_time = 0
        self.total_ai_speech_time = 0
        
        # Per-turn metrics for detailed analysis
        self.turns = []
        
        logger.info(f"📊 VoiceMetrics initialized for room {room_name}, user {user_id}")
    
    def start_user_utterance(self):
        """Mark the start of user speech"""
        self.utterance_start_time = time.time()
        logger.debug(f"📊 User utterance started at {self.utterance_start_time}")
    
    def end_user_utterance(self):
        """Mark the end of user speech (EOU detection point)"""
        self.user_speech_end_time = time.time()
        user_speech_duration = self.user_speech_end_time - self.utterance_start_time if self.utterance_start_time else 0
        self.total_user_speech_time += user_speech_duration
        logger.info(f"📊 EOU detected - User speech ended at {self.user_speech_end_time} (duration: {user_speech_duration:.2f}s)")
        
    def start_ai_response(self):
        """Mark the start of AI response generation"""
        self.ai_response_start_time = time.time()
        logger.debug(f"📊 AI response generation started at {self.ai_response_start_time}")
        
    def complete_ai_response(self):
        """Mark the completion of AI response (full turn completion)"""
        self.ai_response_complete_time = time.time()
        
        # Calculate key metrics
        eou_delay = 0
        ai_processing_time = 0
        total_turn_time = 0
        
        if self.user_speech_end_time and self.ai_response_complete_time:
            eou_delay = self.ai_response_complete_time - self.user_speech_end_time
            total_turn_time = self.ai_response_complete_time - self.utterance_start_time if self.utterance_start_time else 0
            
        if self.ai_response_start_time and self.ai_response_complete_time:
            ai_processing_time = self.ai_response_complete_time - self.ai_response_start_time
            
        # Store turn metrics
        turn_data = {
            'turn_number': self.conversation_turns + 1,
            'timestamp': datetime.now().isoformat(),
            'user_speech_duration': self.total_user_speech_time if self.utterance_start_time else 0,
            'eou_delay': eou_delay,  # Key EOU metric - time from speech end to response complete
            'ai_processing_time': ai_processing_time,
            'total_turn_time': total_turn_time,
        }
        
        self.turns.append(turn_data)
        self.conversation_turns += 1
        self.total_response_time += eou_delay
        
        logger.info(f"📊 Turn {self.conversation_turns} complete - EOU delay: {eou_delay:.2f}s, AI processing: {ai_processing_time:.2f}s")
        
        # Reset for next turn
        self.utterance_start_time = None
        self.user_speech_end_time = None
        self.ai_response_start_time = None
        self.ai_response_complete_time = None
        
    def get_session_metrics(self):
        """Get comprehensive session metrics"""
        session_duration = time.time() - self.session_start_time
        avg_eou_delay = self.total_response_time / self.conversation_turns if self.conversation_turns > 0 else 0
        
        return {
            'room_name': self.room_name,
            'user_id': self.user_id,
            'session_start': datetime.fromtimestamp(self.session_start_time).isoformat(),
            'session_duration': session_duration,
            'total_turns': self.conversation_turns,
            'average_eou_delay': avg_eou_delay,
            'total_response_time': self.total_response_time,
            'total_user_speech_time': self.total_user_speech_time,
            'total_ai_speech_time': self.total_ai_speech_time,
            'turns': self.turns
        }

class MemoryEnabledVoiceAssistant(Agent):
    def __init__(self, user_id: str = "unknown", llm=None, room_name: str = "unknown"):
        self.user_id = user_id
        self.room_name = room_name
        self.memory = get_memory(user_id)
        self.metrics = VoiceMetrics(room_name, user_id)
# Removed auto-greeting for now
        
        # Build dynamic instructions with memory
        instructions = self._build_instructions()
        
        # Wrap the LLM to intercept messages for memory
        if llm:
            self.original_llm = llm
            self.wrapped_llm = self._wrap_llm_for_memory(llm)
        else:
            self.original_llm = None
            self.wrapped_llm = None
        
        # Pass the wrapped LLM instance to the parent Agent class
        super().__init__(instructions=instructions, llm=self.wrapped_llm)
        logger.info(f"🧠 Memory-enabled VoiceAssistant initialized for user: {user_id} with wrapped LLM")
    
    def _build_instructions(self) -> str:
        """Build instructions enhanced with memory context"""
        
        # Check for custom prompts first
        base_instructions = self._load_custom_or_default_prompt()
        
        # If no custom prompt, use default
        if not base_instructions:
            base_instructions = (
            "You are The Air Fryer Geek's AI assistant having a VOICE CONVERSATION with memory! "
            "This is a spoken conversation - speak naturally as if talking to a friend. "
            "IMPORTANT: If someone says 'hello', 'hi', or similar greetings, respond with: "
            "'Hey there! I'm your Air Fryer Geek assistant. What would you like to cook today? "
            "I can help you with recipes, cooking techniques, or any air fryer questions you have!' "
            "Help users with air fryer recipes, cooking tips, and copycat fast food recipes. "
            "Keep responses SHORT and conversational since this is voice chat - like a real conversation. "
            "Be enthusiastic about cooking! Use natural speech patterns with casual language. "
            "Remember this is VOICE - avoid saying 'I read' or 'I see' - say 'I hear' or 'you mentioned' instead. "
            "Keep answers brief and engaging for natural back-and-forth conversation. "
            "\n\nVIDEO SUGGESTIONS - INTELLIGENT SYSTEM: "
            "You now have access to video search tools that help you make intelligent decisions about video suggestions! "
            "IMPORTANT: Use the video tools to 'see' what videos are available and when to suggest them: "
            "\n\nUSING YOUR VIDEO TOOLS: "
            "1. FIRST - Use 'should_suggest_video' tool to analyze if the user wants to learn something "
            "2. IF YES - Use 'search_videos' tool to find relevant videos for their query "
            "3. THEN - Explain what videos you found and why you're suggesting them "
            "4. FINALLY - Only use citations [1], [2], [3] when user confirms they want to see videos "
            "\n\nINTELLIGENT VIDEO BEHAVIOR: "
            "- For casual chat ('hi', 'thanks', 'cool') → NO video suggestions "
            "- For recipe questions ('recipe for chicken nuggets') → MENTION video availability but DON'T show yet "
            "- For explicit requests ('show me how', 'let me see', 'display video') → USE citations to show videos "
            "- Always explain why you're suggesting a video: 'I have a great video that shows the exact technique!' "
            "- For recipe questions, offer videos: 'Would you like me to show you a video tutorial?' "
            "- Be transparent about alternatives: 'I don't have spicy cauliflower wings, but this chicken wing recipe uses the same spicy coating technique!' "
            "\n\nCITATION GUIDELINES - CONSERVATIVE APPROACH: "
            "Only include numbered citations [1], [2], [3] when user EXPLICITLY asks to see/show/watch videos! "
            "- For recipe questions → SUGGEST videos but DON'T use citations yet "
            "- For explicit video requests ('show me', 'let me see') → THEN use citations "
            "- DON'T auto-show videos for general recipe questions "
            "- When you use citations, explain what video will appear: "
            "  'Here's my chicken nuggets recipe [1] - you'll see the exact breading technique!' "
            "  'This video [2] shows the temperature and timing that makes them crispy!' "
            "IMPORTANT: These citation numbers [1], [2], [3] are SILENT markers - DO NOT speak them out loud! "
            "They trigger video displays, so only use them when user explicitly requests to see videos."
        )
        
        # Add memory context
        memory_context = self.memory.get_context_for_llm()
        personal_instructions = self.memory.get_personalized_instructions()
        
        instruction_parts = [base_instructions]
        
        if memory_context:
            instruction_parts.append(f"\nYour memory of this user:\n{memory_context}")
        
        if personal_instructions:
            instruction_parts.append(f"\nPersonalization notes: {personal_instructions}")
        
        return "\n".join(instruction_parts)
    
    def _load_custom_or_default_prompt(self) -> str:
        """Load custom voice prompts from admin interface if available"""
        try:
            import json
            import os
            
            # Check for custom prompts file created by admin interface
            custom_prompts_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'custom_prompts.json')
            
            if os.path.exists(custom_prompts_file):
                with open(custom_prompts_file, 'r') as f:
                    custom_prompts = json.load(f)
                
                # Check if there's a voice prompt override
                if 'voiceBaseInstructions' in custom_prompts and custom_prompts['voiceBaseInstructions'].strip():
                    logger.info(f"🎯 Loading custom voice prompt from admin interface")
                    return custom_prompts['voiceBaseInstructions'].strip()
            
            logger.info(f"🎯 Using default voice prompt")
            return None  # Use default prompt
            
        except Exception as e:
            logger.error(f"❌ Error loading custom prompts: {e}")
            return None  # Fall back to default
    
    def _wrap_llm_for_memory(self, llm):
        """Wrap the LLM to intercept conversations for memory"""
        logger.info(f"🧠 Wrapping LLM for memory integration")
        original_chat = llm.chat
        memory = self.memory
        assistant_instance = self  # Capture reference to the assistant
        
        class MemoryEnhancedChatWrapper:
            def __init__(self, *args, **kwargs):
                self.args = args
                self.kwargs = kwargs
                self.original_stream = None
                
            async def __aenter__(self):
                logger.info(f"🎤🧠 MEMORY-ENHANCED CHAT STARTING - Intercepting LLM conversation!")
                
# Auto-greeting removed for debugging
                
                # Extract user message from chat context
                chat_ctx = None
                if 'chat_ctx' in self.kwargs:
                    chat_ctx = self.kwargs['chat_ctx']
                elif self.args and len(self.args) > 0:
                    chat_ctx = self.args[0]
                
                user_message = None
                if chat_ctx and hasattr(chat_ctx, 'items'):
                    items = chat_ctx.items
                    logger.info(f"🧠💬 Found {len(items)} items in chat context")
                    
                    # Get the latest user message from items
                    for item in reversed(items):
                        if hasattr(item, 'role') and item.role == 'user':
                            raw_content = item.content
                            # Fix: Extract string from list if needed
                            if isinstance(raw_content, list) and len(raw_content) > 0:
                                user_message = str(raw_content[0])
                            else:
                                user_message = str(raw_content)
                            logger.info(f"🎤🧠 FOUND USER MESSAGE: {user_message[:100]}...")
                            break
                elif chat_ctx and hasattr(chat_ctx, 'messages'):
                    messages = chat_ctx.messages
                    logger.info(f"🧠💬 Found {len(messages)} messages in chat context")
                    
                    for msg in reversed(messages):
                        if hasattr(msg, 'role') and msg.role == 'user':
                            user_message = msg.content
                            logger.info(f"🎤🧠 FOUND USER MESSAGE: {user_message[:100]}...")
                            break
                
                # Store user message in memory before processing
                if user_message:
                    logger.info(f"🎤🧠 STORING USER MESSAGE IN MEMORY")
                    memory.add_user_message(user_message)
                    logger.info(f"🧠✅ USER MESSAGE STORED: {user_message[:50]}...")
                    
                    # Track EOU metrics - user finished speaking, now AI starts processing
                    if hasattr(assistant_instance, 'metrics'):
                        assistant_instance.metrics.end_user_utterance()
                        assistant_instance.metrics.start_ai_response()
                else:
                    logger.warning(f"🧠⚠️ NO USER MESSAGE FOUND IN CONVERSATION")
                
                # Call original chat method to get the stream
                logger.info(f"🧠💬 CALLING ORIGINAL LLM...")
                self.original_stream = await original_chat(*self.args, **self.kwargs).__aenter__()
                logger.info(f"🧠💬 GOT LLM STREAM: {type(self.original_stream)}")
                
                return MemoryAwareStream(self.original_stream, memory)
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                if self.original_stream:
                    try:
                        await self.original_stream.__aexit__(exc_type, exc_val, exc_tb)
                    except Exception as e:
                        logger.error(f"🧠❌ Error closing original stream: {e}")
                
                # Save memory after conversation
                try:
                    logger.info(f"🧠💾 SAVING MEMORY TO DISK")
                    memory.save_memory()
                    logger.info(f"🧠✅ MEMORY SAVED SUCCESSFULLY")
                except Exception as e:
                    logger.error(f"🧠❌ ERROR saving memory: {e}")
        
        class MemoryAwareStream:
            def __init__(self, original_stream, memory):
                self.original_stream = original_stream
                self.memory = memory
                self.collected_response = ""
            
            def __aiter__(self):
                return self
            
            async def __anext__(self):
                try:
                    chunk = await self.original_stream.__anext__()
                    
                    # Collect response chunks for memory storage
                    if hasattr(chunk, 'content') and chunk.content:
                        self.collected_response += chunk.content
                    elif hasattr(chunk, 'text') and chunk.text:
                        self.collected_response += chunk.text
                    elif hasattr(chunk, 'delta') and hasattr(chunk.delta, 'content') and chunk.delta.content:
                        self.collected_response += chunk.delta.content
                    
                    return chunk
                    
                except StopAsyncIteration:
                    # Stream ended, store complete response
                    if self.collected_response.strip():
                        logger.info(f"🎤🤖 STORING COMPLETE AI RESPONSE IN MEMORY")
                        
                        # FORCE citations for cooking responses if AI didn't include them
                        processed_response = self._force_citations_if_needed(self.collected_response)
                        if processed_response != self.collected_response:
                            logger.info(f"🎥🔧 FORCED CITATIONS ADDED - Original length: {len(self.collected_response)}, New: {len(processed_response)}")
                        
                        self.memory.add_assistant_message(processed_response)
                        logger.info(f"🧠✅ AI RESPONSE STORED: {processed_response[:50]}...")
                        
                        # Complete metrics tracking - AI response generation finished
                        if hasattr(assistant_instance, 'metrics'):
                            assistant_instance.metrics.complete_ai_response()
                    raise
            
            async def __aenter__(self):
                """Enter async context manager"""
                if hasattr(self.original_stream, '__aenter__'):
                    await self.original_stream.__aenter__()
                return self
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                """Exit async context manager"""
                if hasattr(self.original_stream, '__aexit__'):
                    await self.original_stream.__aexit__(exc_type, exc_val, exc_tb)
                elif hasattr(self.original_stream, 'aclose'):
                    try:
                        await self.original_stream.aclose()
                    except Exception as e:
                        logger.warning(f"🧠⚠️ Error closing original stream: {e}")
                return False
                    
            def _force_citations_if_needed(self, response):
                """Smart video suggestion system - NO automatic citations without explanation"""
                import re
                
                # Check if response already has citations
                if re.search(r'\[\d+\]', response):
                    logger.info(f"🎥✅ Citations already present in response")
                    return response
                
                # CRITICAL: Do NOT force citations automatically anymore
                # Let the agent decide when to suggest videos through natural conversation
                
                # Only check if this is a food-related response that might benefit from video hints
                food_keywords = ['chicken', 'nuggets', 'fries', 'wings', 'recipe', 'cauliflower', 'spicy']
                response_lower = response.lower()
                mentions_food = any(keyword in response_lower for keyword in food_keywords)
                
                # Check for explicit tutorial language (user wants to learn)
                tutorial_phrases = [
                    'here\'s how', 'let me show you', 'here\'s the recipe', 
                    'follow these steps', 'first you', 'then you', 'next you',
                    'step by step', 'I\'ll show you', 'watch how I', 'demonstrate'
                ]
                is_tutorial = any(phrase in response_lower for phrase in tutorial_phrases)
                
                if mentions_food and not is_tutorial:
                    # For food mentions without tutorial language, add gentle video availability hint
                    if 'video' not in response_lower and 'tutorial' not in response_lower:
                        enhanced_response = response + " Let me know if you'd like to see a video tutorial!"
                        logger.info(f"🎥💡 Added gentle video availability hint for food mention")
                        return enhanced_response
                
                elif is_tutorial:
                    logger.info(f"🎥🧠 Tutorial detected - but letting agent control video suggestions naturally")
                    # Don't force citations - let the agent decide based on actual video availability
                
                logger.info(f"🎥⏭️ No automatic video forcing - letting agent make intelligent decisions")
                return response
        
        # Replace the chat method
        def memory_enhanced_chat(*args, **kwargs):
            return MemoryEnhancedChatWrapper(*args, **kwargs)
        
        llm.chat = memory_enhanced_chat
        return llm
    
    async def aclose(self):
        """Override to save memory when agent closes"""
        logger.info("🧠 Saving memory before closing...")
        try:
            self.memory.save_memory()
            cleanup_memories()
        except Exception as e:
            logger.error(f"Error saving memory: {e}")
        
        logger.info("🔚 Memory-enabled VoiceAssistant closing...")
        await super().aclose()


# Memory integration wrapper for AgentSession
class MemoryEnabledSession:
    """Wrapper to integrate memory with AgentSession"""
    
    def __init__(self, session: AgentSession, user_id: str):
        self.session = session
        self.user_id = user_id
        self.memory = get_memory(user_id)
        
        # Try to hook into the LLM to intercept messages
        # The LiveKit AgentSession API might have different internal structure
        logger.info(f"🧠 DEBUGGING SESSION STRUCTURE:")
        logger.info(f"🧠 Session type: {type(session)}")
        logger.info(f"🧠 Session has _agent: {hasattr(session, '_agent')}")
        
        try:
            if hasattr(session, '_agent') and session._agent:
                logger.info(f"🧠 Agent found: {type(session._agent)}")
                logger.info(f"🧠 Agent has _llm: {hasattr(session._agent, '_llm')}")
                
                if hasattr(session._agent, '_llm'):
                    original_llm = session._agent._llm
                    logger.info(f"🧠 LLM found: {type(original_llm)}")
                    logger.info(f"🧠 LLM has chat method: {hasattr(original_llm, 'chat')}")
                    
                    if hasattr(original_llm, 'chat'):
                        self._wrap_llm_chat(original_llm)
                        logger.info(f"🧠✅ SUCCESSFULLY HOOKED INTO LLM - Memory interception active!")
                        self.llm_hooked = True
                    else:
                        logger.warning("🧠❌ LLM has no chat method")
                        self.llm_hooked = False
                else:
                    logger.warning("🧠❌ Agent has no _llm attribute")
                    self.llm_hooked = False
            else:
                logger.warning("🧠❌ Session has no _agent or _agent is None")
                self.llm_hooked = False
        except Exception as e:
            logger.error(f"🧠❌ ERROR hooking into LLM: {e}")
            self.llm_hooked = False
        
        logger.info(f"🧠 Memory integration {'FULLY ACTIVE' if self.llm_hooked else 'PARTIALLY ACTIVE'} for session: {user_id}")
    
    def _wrap_llm_chat(self, llm):
        """Wrap the LLM chat method to add memory"""
        original_chat = llm.chat
        memory = self.memory
        
        class MemoryEnhancedChatWrapper:
            def __init__(self, *args, **kwargs):
                self.args = args
                self.kwargs = kwargs
                self.original_stream = None
                
            async def __aenter__(self):
                logger.info(f"🧠💬 MEMORY-ENHANCED CHAT STARTING - Intercepting LLM conversation!")
                
                # Extract user message from chat context - fix the access pattern
                chat_ctx = None
                if 'chat_ctx' in self.kwargs:
                    chat_ctx = self.kwargs['chat_ctx']
                elif self.args and len(self.args) > 0:
                    # First argument should be the ChatContext
                    chat_ctx = self.args[0]
                
                user_message = None
                if chat_ctx and hasattr(chat_ctx, 'items'):
                    # LiveKit uses 'items' not 'messages' - this was the bug!
                    items = chat_ctx.items
                    logger.info(f"🧠💬 Found {len(items)} items in chat context")
                    
                    # Get the latest user message from items
                    for item in reversed(items):
                        if hasattr(item, 'role') and item.role == 'user':
                            raw_content = item.content
                            # Fix: Extract string from list if needed
                            if isinstance(raw_content, list) and len(raw_content) > 0:
                                user_message = str(raw_content[0])
                            else:
                                user_message = str(raw_content)
                            logger.info(f"🧠💬 FOUND USER MESSAGE: {user_message[:100]}...")
                            break
                elif chat_ctx and hasattr(chat_ctx, 'messages'):
                    # Fallback for older versions
                    messages = chat_ctx.messages
                    logger.info(f"🧠💬 Found {len(messages)} messages in chat context")
                    
                    for msg in reversed(messages):
                        if hasattr(msg, 'role') and msg.role == 'user':
                            raw_content = msg.content
                            # Fix: Extract string from list if needed
                            if isinstance(raw_content, list) and len(raw_content) > 0:
                                user_message = str(raw_content[0])
                            else:
                                user_message = str(raw_content)
                            logger.info(f"🧠💬 FOUND USER MESSAGE: {user_message[:100]}...")
                            break
                elif chat_ctx:
                    logger.warning(f"🧠💬 Chat context exists but no items/messages. Type: {type(chat_ctx)}")
                    logger.warning(f"🧠💬 Chat context attributes: {dir(chat_ctx)}")
                else:
                    logger.warning(f"🧠💬 No chat context found. Args: {len(self.args)}, Kwargs: {list(self.kwargs.keys())}")
                
                # Store user message in memory before processing
                if user_message:
                    logger.info(f"🧠💾 STORING USER MESSAGE IN MEMORY")
                    memory.add_user_message(user_message)
                    logger.info(f"🧠✅ USER MESSAGE STORED: {user_message[:50]}...")
                    
                    # Track metrics if available (fallback method)
                    logger.debug(f"📊 Metrics tracking in session wrapper (user utterance end)")
                else:
                    logger.warning(f"🧠⚠️ NO USER MESSAGE FOUND IN CONVERSATION")
                
                # Call original chat method to get the stream
                logger.info(f"🧠💬 CALLING ORIGINAL LLM...")
                self.original_stream = await original_chat(*self.args, **self.kwargs).__aenter__()
                logger.info(f"🧠💬 GOT LLM STREAM: {type(self.original_stream)}")
                
                return MemoryAwareStream(self.original_stream, memory)
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                if self.original_stream:
                    try:
                        await self.original_stream.__aexit__(exc_type, exc_val, exc_tb)
                    except Exception as e:
                        logger.error(f"🧠❌ Error closing original stream: {e}")
                
                # Save memory after conversation
                try:
                    logger.info(f"🧠💾 SAVING MEMORY TO DISK")
                    memory.save_memory()
                    logger.info(f"🧠✅ MEMORY SAVED SUCCESSFULLY")
                except Exception as e:
                    logger.error(f"🧠❌ ERROR saving memory: {e}")
        
        class MemoryAwareStream:
            def __init__(self, original_stream, memory):
                self.original_stream = original_stream
                self.memory = memory
                self.collected_response = ""
            
            def __aiter__(self):
                return self
            
            async def __anext__(self):
                try:
                    chunk = await self.original_stream.__anext__()
                    
                    # Collect response chunks for memory storage
                    if hasattr(chunk, 'content') and chunk.content:
                        self.collected_response += chunk.content
                    elif hasattr(chunk, 'text') and chunk.text:
                        self.collected_response += chunk.text
                    elif hasattr(chunk, 'delta') and hasattr(chunk.delta, 'content') and chunk.delta.content:
                        self.collected_response += chunk.delta.content
                    
                    return chunk
                    
                except StopAsyncIteration:
                    # Stream ended, store complete response
                    if self.collected_response.strip():
                        logger.info(f"🧠💾 STORING COMPLETE AI RESPONSE IN MEMORY")
                        
                        # FORCE citations for cooking responses if AI didn't include them
                        processed_response = self._force_citations_if_needed(self.collected_response)
                        if processed_response != self.collected_response:
                            logger.info(f"🎥🔧 FORCED CITATIONS ADDED - Original length: {len(self.collected_response)}, New: {len(processed_response)}")
                        
                        self.memory.add_assistant_message(processed_response)
                        logger.info(f"🧠✅ AI RESPONSE STORED: {processed_response[:50]}...")
                        
                        # Complete metrics tracking (fallback method)
                        logger.debug(f"📊 Metrics tracking in session wrapper (AI response complete)")
                    raise
            
            async def __aenter__(self):
                """Enter async context manager"""
                if hasattr(self.original_stream, '__aenter__'):
                    await self.original_stream.__aenter__()
                return self
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                """Exit async context manager"""
                if hasattr(self.original_stream, '__aexit__'):
                    await self.original_stream.__aexit__(exc_type, exc_val, exc_tb)
                elif hasattr(self.original_stream, 'aclose'):
                    try:
                        await self.original_stream.aclose()
                    except Exception as e:
                        logger.warning(f"🧠⚠️ Error closing original stream: {e}")
                return False
                    
            def _force_citations_if_needed(self, response):
                """Smart video suggestion system - NO automatic citations without explanation"""
                import re
                
                # Check if response already has citations
                if re.search(r'\[\d+\]', response):
                    logger.info(f"🎥✅ Citations already present in response")
                    return response
                
                # CRITICAL: Do NOT force citations automatically anymore
                # Let the agent decide when to suggest videos through natural conversation
                
                # Only check if this is a food-related response that might benefit from video hints
                food_keywords = ['chicken', 'nuggets', 'fries', 'wings', 'recipe', 'cauliflower', 'spicy']
                response_lower = response.lower()
                mentions_food = any(keyword in response_lower for keyword in food_keywords)
                
                # Check for explicit tutorial language (user wants to learn)
                tutorial_phrases = [
                    'here\'s how', 'let me show you', 'here\'s the recipe', 
                    'follow these steps', 'first you', 'then you', 'next you',
                    'step by step', 'I\'ll show you', 'watch how I', 'demonstrate'
                ]
                is_tutorial = any(phrase in response_lower for phrase in tutorial_phrases)
                
                if mentions_food and not is_tutorial:
                    # For food mentions without tutorial language, add gentle video availability hint
                    if 'video' not in response_lower and 'tutorial' not in response_lower:
                        enhanced_response = response + " Let me know if you'd like to see a video tutorial!"
                        logger.info(f"🎥💡 Added gentle video availability hint for food mention")
                        return enhanced_response
                
                elif is_tutorial:
                    logger.info(f"🎥🧠 Tutorial detected - but letting agent control video suggestions naturally")
                    # Don't force citations - let the agent decide based on actual video availability
                
                logger.info(f"🎥⏭️ No automatic video forcing - letting agent make intelligent decisions")
                return response
        
        # Replace the chat method
        def memory_enhanced_chat(*args, **kwargs):
            return MemoryEnhancedChatWrapper(*args, **kwargs)
        
        llm.chat = memory_enhanced_chat

async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent using correct API"""
    
    logger.info("🧠🚀 Starting Memory-Enhanced Voice Agent...")
    logger.info(f"📍 Job ID: {ctx.job.id}")
    logger.info(f"📍 Room name: {ctx.room.name}")
    print(f"🔥 VOICE AGENT TRIGGERED! Room: {ctx.room.name} Job: {ctx.job.id}")  # Force print to console
    print(f"🟢 AFTER VOICE AGENT TRIGGERED - Job: {ctx.job.id}")
    
    # Extract user ID from room name 
    # New format: voice_call_{user_id}_{creator_id}_{timestamp}
    # Old format: voice-call-{creator_id}-{timestamp}
    user_id = "unknown"
    print(f"🔍 STARTING USER ID EXTRACTION - Room: {ctx.room.name} Job: {ctx.job.id}")
    
    try:
        room_name = ctx.room.name
        if "_" in room_name:
            # New format with underscores
            room_parts = room_name.split("_")
            if len(room_parts) >= 4 and room_parts[0] == "voice" and room_parts[1] == "call":
                user_id = room_parts[2]  # user_id is the 3rd part
                logger.info(f"🧠 Extracted user ID (new format): {user_id}")
                print(f"🔍✅ USER ID EXTRACTED: {user_id} - Job: {ctx.job.id}")
            else:
                logger.warning(f"🧠 Unexpected underscore format: {room_name}")
                print(f"🔍❌ UNEXPECTED UNDERSCORE FORMAT - Job: {ctx.job.id}")
        else:
            # Old format with hyphens (fallback)
            room_parts = room_name.split("-")
            if len(room_parts) >= 3:
                user_id = room_parts[2]  # creator_id in old format
                logger.warning(f"🧠 Using fallback user ID extraction (old format): {user_id}")
                print(f"🔍⚠️ FALLBACK USER ID: {user_id} - Job: {ctx.job.id}")
            else:
                logger.warning(f"🧠 Unexpected hyphen format: {room_name}")
                print(f"🔍❌ UNEXPECTED HYPHEN FORMAT - Job: {ctx.job.id}")
            
    except Exception as e:
        logger.warning(f"Could not extract user ID from room name: {e}")
        print(f"🔍💥 EXCEPTION IN USER ID EXTRACTION: {e} - Job: {ctx.job.id}")
    
    print(f"🔍 GETTING ROOM MANAGER - Job: {ctx.job.id}")
    room_manager = get_room_session_manager()
    print(f"🔍 GOT ROOM MANAGER - Job: {ctx.job.id}")
    
    print(f"🔐🚨 ABOUT TO ATTEMPT COLLISION DETECTION - Room: {ctx.room.name} Job: {ctx.job.id} User: {user_id}")
    
    # Try to acquire exclusive lock for this room
    lock_acquired = await room_manager.acquire_room_lock(
        room_name=ctx.room.name,
        job_id=ctx.job.id,
        user_id=user_id,
        timeout=5
    )
    
    print(f"🔐📋 COLLISION DETECTION RESULT: {lock_acquired} - Room: {ctx.room.name} Job: {ctx.job.id}")
    
    if not lock_acquired:
        logger.warning(f"🔐❌ Could not acquire lock for room {ctx.room.name} - another agent is already active (job: {ctx.job.id})")
        print(f"🔐🚫 AGENT TERMINATING DUE TO COLLISION - Room: {ctx.room.name} Job: {ctx.job.id}")
        await asyncio.sleep(1)  # Brief delay before exit
        return
    
    logger.info(f"🔐✅ Successfully acquired room lock: {ctx.room.name} (job: {ctx.job.id})")
    print(f"🔐🎯 AGENT PROCEEDING WITH LOCK - Room: {ctx.room.name} Job: {ctx.job.id}")
    
    # Connect to room first
    await ctx.connect()
    logger.info("✅ Successfully connected to LiveKit room!")
    
    try:
        logger.info("🔧 Initializing all voice providers...")
        
        # STT Provider (Deepgram)
        deepgram_key = os.getenv("DEEPGRAM_API_KEY", "e2396a8db16575976749d429dcdcb4d4881d89f5")
        stt = deepgram.STT(
            model="nova-3",
            language="en-US", 
            api_key=deepgram_key
        )
        logger.info("✅ Deepgram STT initialized")
        
        # LLM Provider (OpenAI)
        llm = openai.LLM(
            model="gpt-3.5-turbo",
            temperature=0.7
        )
        logger.info("✅ OpenAI LLM initialized")
        
        # TTS Provider (Fallback to OpenAI due to ElevenLabs API issues)
        elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "sk_c874984cef2885f92ae15e21aa103b9459a9e7639093ee68")
        try:
            tts = elevenlabs.TTS(
                voice_id="50UFKf9NJ8SnfBjOKtlv",  # The Air Fryer Geek's cloned voice
                model="eleven_flash_v2_5",
                api_key=elevenlabs_key
            )
            logger.info("✅ ElevenLabs TTS initialized with Air Fryer Geek's voice")
        except Exception as e:
            logger.warning(f"⚠️ ElevenLabs TTS failed, using OpenAI fallback: {e}")
            tts = openai.TTS(
                model="tts-1",
                voice="nova"
            )
            logger.info("✅ OpenAI TTS fallback initialized")
        
        # VAD Provider (Silero) - using default settings for stability
        vad = silero.VAD.load()
        logger.info("✅ Silero VAD initialized")
        
        logger.info("🎤 Creating AgentSession with all providers...")
        
        # Create memory-enhanced assistant with user ID and LLM instance
        logger.info("🧠 Creating memory-enhanced assistant with LLM integration...")
        memory_assistant = MemoryEnabledVoiceAssistant(user_id=user_id, llm=llm, room_name=ctx.room.name)
        
        # Create AgentSession with all providers
        session = AgentSession(
            stt=stt,
            llm=llm,  # Use original LLM here, memory wrapper is handled in the agent
            tts=tts,
            vad=vad,
            # Note: tools parameter removed as it's not supported by AgentSession
        )
        
        logger.info("🎉 AgentSession created successfully!")
        
        # Start the session with optimized configuration
        logger.info("🚀 Starting AgentSession...")
        room_input_options = RoomInputOptions(
            close_on_disconnect=True,        # Clean session management
            pre_connect_audio=True           # Enable pre-connect for better reliability
        )
        
        await session.start(
            room=ctx.room,
            agent=memory_assistant,
            room_input_options=room_input_options
        )
        
        # Set room name in memory for transcription tracking
        memory = get_memory(user_id)
        memory.set_room_name(ctx.room.name)
        logger.info(f"🧠 Set room name in memory: {ctx.room.name}")
        
        logger.info("🎧 Voice agent session is now active!")
        
        logger.info("💬 Voice agent ready - waiting for user to speak...")
        logger.info("✅ Voice agent ready for conversations!")
        
        # Keep the session running indefinitely
        # Don't close the session - let it run until manually stopped
        logger.info("🔄 Keeping session alive...")
        
        # Monitor session health and handle disconnections properly
        try:
            # Use asyncio.Event for clean shutdown signaling
            shutdown_event = asyncio.Event()
            heartbeat_count = 0
            max_heartbeats = 60  # Maximum 5 minutes (5 sec * 60 = 300 sec)
            empty_room_count = 0  # Track consecutive empty room checks
            
            while not shutdown_event.is_set() and heartbeat_count < max_heartbeats:
                await asyncio.sleep(5)  # Check every 5 seconds
                heartbeat_count += 1
                
                # Log heartbeat every 12th iteration (60 seconds)
                if heartbeat_count % 12 == 0:
                    minutes_elapsed = (heartbeat_count * 5) // 60
                    logger.info(f"💓 Session active for {minutes_elapsed} minutes - Room: {ctx.room.name}")
                
                # Check room connection status
                try:
                    from livekit import rtc
                    if ctx.room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
                        logger.info(f"🔌 Room disconnected (state: {ctx.room.connection_state})")
                        logger.info("🛑 Terminating agent session due to disconnection")
                        break
                except Exception as connection_check_error:
                    logger.warning(f"⚠️ Error checking connection state: {connection_check_error}")
                    # Continue anyway - don't break on connection check errors
                
                # Check for participant count - exit if room is empty for more than 15 seconds
                if ctx.room.num_participants <= 1:  # Only agent left (agents count as participants)
                    empty_room_count += 1
                    logger.info(f"👥 No user participants in room (empty count: {empty_room_count}/3)")
                    
                    if empty_room_count >= 3:  # 15 seconds of empty room
                        logger.info("👥 Room empty for 15+ seconds - terminating session to save resources")
                        logger.info("🛑 User disconnected - ending voice agent session immediately")
                        break
                else:
                    empty_room_count = 0  # Reset counter if users rejoin
            
            if heartbeat_count >= max_heartbeats:
                logger.info(f"⏰ Session reached maximum duration ({max_heartbeats * 5 // 60} minutes) - ending gracefully")
                    
        except asyncio.CancelledError:
            logger.info("📴 Session cancelled - shutting down gracefully")
        except Exception as e:
            logger.warning(f"⚠️ Session loop ended: {e}")
        finally:
            logger.info("🔚 Closing session...")
            
            # Save metrics before cleanup
            try:
                if hasattr(memory_assistant, 'metrics'):
                    metrics_data = memory_assistant.metrics.get_session_metrics()
                    logger.info(f"📊 Final session metrics: {metrics_data['total_turns']} turns, avg EOU delay: {metrics_data['average_eou_delay']:.2f}s")
                    
                    # Save metrics to a file for persistence
                    import json
                    metrics_file = f"/tmp/voice_metrics_{ctx.room.name}_{int(time.time())}.json"
                    with open(metrics_file, 'w') as f:
                        json.dump(metrics_data, f, indent=2)
                    logger.info(f"📊 Metrics saved to: {metrics_file}")
            except Exception as metrics_error:
                logger.error(f"❌ Error saving metrics: {metrics_error}")
            
            # Clean up session tracking - release file-based lock
            try:
                room_manager = get_room_session_manager()
                await room_manager.release_room_lock(ctx.room.name, user_id)
                logger.info(f"🔐 Released file-based room lock: {ctx.room.name}")
            except Exception as cleanup_error:
                logger.error(f"❌ Error releasing room lock: {cleanup_error}")
            
            try:
                await session.aclose()
                logger.info("✅ Session closed successfully")
            except Exception as close_error:
                logger.error(f"❌ Error closing session: {close_error}")
            
            # Ensure we disconnect from the room
            try:
                await ctx.room.disconnect()
                logger.info("🔌 Disconnected from room")
            except Exception as disconnect_error:
                logger.error(f"❌ Error disconnecting from room: {disconnect_error}")
        
    except Exception as e:
        logger.error(f"❌ FATAL ERROR in voice agent: {e}")
        logger.exception("Full exception details:")
        raise
    finally:
        # Always release the file-based room lock, even if there was an error
        try:
            room_manager = get_room_session_manager()
            await room_manager.release_room_lock(ctx.room.name, user_id)
            logger.info(f"🔐 [FINAL CLEANUP] Released room lock: {ctx.room.name}")
        except Exception as final_cleanup_error:
            logger.error(f"❌ Error in final cleanup: {final_cleanup_error}")

if __name__ == "__main__":
    logger.info("🚀 Starting Correct Voice Agent worker...")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))