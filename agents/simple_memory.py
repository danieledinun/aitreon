#!/usr/bin/env python3
"""
Simple Memory System for Voice Agent
Lightweight memory that works with the current agent
"""

import json
import logging
import aiohttp
import openai
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import deque
import os

logger = logging.getLogger(__name__)

class SimpleMemory:
    """Simple memory system for voice conversations"""
    
    def __init__(self, user_id: str, max_history: int = 10):
        self.user_id = user_id
        self.max_history = max_history
        self.creator_id = "cmeggjlxp0015wvebg2952wcq"  # The Air Fryer Geek (correct creator ID)
        self.room_name = None  # Will be set by voice agent
        self.current_user_message = None  # Store for transcription
        self.current_ai_response = None   # Store for transcription
        
        # Conversation history (short-term memory)
        self.conversation_history: deque = deque(maxlen=max_history)
        
        # User context (long-term memory) - Channel agnostic
        self.user_context = {
            "preferences": [],  # User likes/dislikes extracted by AI
            "mentioned_topics": [],  # Topics/subjects discussed (replaces recipes)
            "user_level": "unknown",  # User expertise level in this domain (replaces cooking_level) 
            "constraints": [],  # User constraints/restrictions (replaces dietary_restrictions)
            "past_topics": [],
            "interaction_count": 0
        }
        
        # Working memory for current conversation
        self.working_memory = {
            "current_topic": None,
            "user_mood": "neutral", 
            "last_topic_discussed": None,  # Last main topic discussed (replaces last_recipe_discussed)
            "conversation_started": datetime.now()
        }
        
        # Load existing memory if available
        self._load_memory()
    
    def set_room_name(self, room_name: str):
        """Set the room name for transcription tracking"""
        self.room_name = room_name
        logger.debug(f"🧠 Set room name for transcription: {room_name}")

    def add_user_message(self, message):
        """Add user message to memory"""
        try:
            # Fix: Handle list or string input
            if isinstance(message, list) and len(message) > 0:
                message_str = str(message[0])
            else:
                message_str = str(message)
            
            logger.info(f"🎤🧠 VOICE AGENT RECEIVED USER MESSAGE: '{message_str}'")
            entry = {
                "role": "user",
                "content": message_str,
                "timestamp": datetime.now().isoformat()
            }
            
            self.conversation_history.append(entry)
            self.user_context["interaction_count"] += 1
            
            # Store for transcription
            self.current_user_message = message_str
            
            # Extract insights from user message
            self._extract_insights(message_str)
            
            logger.info(f"🧠 Added user message to memory: {message_str[:50]}...")
            
        except Exception as e:
            logger.error(f"Error adding user message to memory: {e}")
    
    def add_assistant_message(self, message: str):
        """Add assistant response to memory and fetch proper video citations"""
        try:
            logger.info(f"🎤🤖 VOICE AGENT PROCESSING ASSISTANT MESSAGE: '{message[:100]}...'")
            # Store the original message with citations for system processing
            original_message = message
            
            # Remove citation numbers for voice output (so TTS doesn't speak them)
            import re
            clean_message_for_voice = re.sub(r'\[(\d+)\]', '', message)
            
            entry = {
                "role": "assistant", 
                "content": clean_message_for_voice,  # Store clean version in memory
                "timestamp": datetime.now().isoformat()
            }
            
            self.conversation_history.append(entry)
            
            # Store clean version for transcription (what user actually hears)
            self.current_ai_response = clean_message_for_voice
            
            # Check for video citations using the ORIGINAL message (with citation numbers) 
            self._check_and_display_videos(original_message)
            
            # Save transcription to database if we have both messages
            if self.current_user_message and self.current_ai_response:
                self._save_transcription_async()
                # DON'T clear current_user_message yet - video system needs it for intelligent analysis
                # Only clear the AI response
                self.current_ai_response = None
            
            # Update working memory based on response
            self._update_working_memory(clean_message_for_voice)
            
            logger.debug(f"🧠 Added assistant message to memory: {clean_message_for_voice[:50]}...")
            logger.debug(f"🎥 Processing citations from original: {original_message[:50]}...")
            
        except Exception as e:
            logger.error(f"Error adding assistant message to memory: {e}")
    
    def get_context_for_llm(self) -> str:
        """Get formatted context for the LLM"""
        try:
            logger.info(f"🧠📝 BUILDING CONTEXT FOR LLM - User: {self.user_id}")
            logger.info(f"🧠📊 Current interaction count: {self.user_context.get('interaction_count', 0)}")
            logger.info(f"🧠👤 User preferences: {self.user_context.get('preferences', [])}")
            logger.info(f"🧠📝 Mentioned topics: {self.user_context.get('mentioned_topics', [])}")
            logger.info(f"🧠🍳 Legacy mentioned recipes: {self.user_context.get('mentioned_recipes', [])}")
            logger.info(f"🧠📊 User level: {self.user_context.get('user_level', self.user_context.get('cooking_level', 'unknown'))}")
            logger.info(f"🧠💬 Conversation history length: {len(self.conversation_history)}")
            
            context_parts = []
            
            # Add user profile info
            if self.user_context["preferences"]:
                prefs = ", ".join(self.user_context["preferences"][:3])
                context_parts.append(f"User preferences: {prefs}")
                logger.info(f"🧠✅ Added preferences to context: {prefs}")
            
            # Channel-agnostic topics (new) + backward compatibility with recipes (legacy)
            all_topics = []
            if self.user_context.get("mentioned_topics"):
                all_topics.extend(self.user_context["mentioned_topics"][-3:])
            if self.user_context.get("mentioned_recipes"):
                all_topics.extend(self.user_context["mentioned_recipes"][-3:])
            
            if all_topics:
                topics_str = ", ".join(all_topics[-3:])  # Keep last 3 total
                context_parts.append(f"Previously discussed topics: {topics_str}")
                logger.info(f"🧠✅ Added topics to context: {topics_str}")
            
            # Channel-agnostic user level (new) + backward compatibility (legacy)
            user_level = self.user_context.get("user_level", self.user_context.get("cooking_level", "unknown"))
            if user_level != "unknown":
                context_parts.append(f"User expertise level: {user_level}")
                logger.info(f"🧠✅ Added user level to context: {user_level}")
            
            # Channel-agnostic constraints (new) + backward compatibility with dietary restrictions (legacy)
            all_constraints = []
            if self.user_context.get("constraints"):
                all_constraints.extend(self.user_context["constraints"])
            if self.user_context.get("dietary_restrictions"):
                all_constraints.extend(self.user_context["dietary_restrictions"])
            
            if all_constraints:
                constraints_str = ", ".join(all_constraints)
                context_parts.append(f"User constraints/restrictions: {constraints_str}")
                logger.info(f"🧠✅ Added constraints to context: {constraints_str}")
            
            # Add recent conversation
            if len(self.conversation_history) > 1:
                recent_context = "Recent conversation:\n"
                for entry in list(self.conversation_history)[-4:]:  # Last 4 exchanges
                    role = "User" if entry["role"] == "user" else "Assistant"
                    recent_context += f"{role}: {entry['content']}\n"
                context_parts.append(recent_context)
                logger.info(f"🧠✅ Added conversation history to context ({len(self.conversation_history)} messages)")
            
            # Add interaction stats and conversation continuity
            interaction_count = self.user_context["interaction_count"]
            if interaction_count > 5:
                context_parts.append(f"This user has had {interaction_count} interactions - they're familiar with you.")
                # Add conversation continuity for returning users - channel agnostic
                if len(self.conversation_history) == 0:
                    # Get last discussed topic from either new or legacy fields
                    last_topic = None
                    if self.user_context.get("mentioned_topics"):
                        last_topic = self.user_context["mentioned_topics"][-1]
                    elif self.user_context.get("mentioned_recipes"):
                        last_topic = self.user_context["mentioned_recipes"][-1]
                    
                    if last_topic:
                        context_parts.append(f"IMPORTANT: This is a returning user. Start the conversation by referencing their previous interests, like: 'Hey! How did that {last_topic} topic work out for you?' or 'Did you get to try that {last_topic} we discussed?' or similar casual greeting that shows you remember them.")
                logger.info(f"🧠✅ Added returning user context (interactions: {interaction_count})")
            elif interaction_count <= 2:
                context_parts.append("This is a new user - be welcoming and introduce yourself.")
                logger.info(f"🧠✅ Added new user context (interactions: {interaction_count})")
            
            final_context = "\n\n".join(context_parts)
            logger.info(f"🧠📝 FINAL CONTEXT GENERATED ({len(final_context)} chars):")
            logger.info(f"🧠📝 {final_context}")
            
            return final_context
            
        except Exception as e:
            logger.error(f"🧠❌ Error generating LLM context: {e}")
            logger.exception("Full context generation error:")
            return ""
    
    def _extract_insights(self, message: str):
        """Extract insights from user message - channel agnostic"""
        try:
            # Try AI extraction first, fallback to basic if needed
            import asyncio
            try:
                # Run AI extraction in background
                asyncio.create_task(self._extract_insights_ai(message))
            except:
                # If async fails, use fallback
                self._extract_insights_fallback(message)
                
        except Exception as e:
            logger.error(f"Error extracting insights: {e}")
    
    async def _extract_insights_ai(self, message: str):
        """Extract insights from user message using AI - channel agnostic"""
        try:
            logger.info(f"🧠🤖 AI analyzing message for insights: {message[:50]}...")
            
            # Use OpenAI to extract insights
            client = openai.OpenAI()
            
            extraction_prompt = f"""
Analyze this user message for a YouTube channel AI assistant and extract:
1. Preferences: What does the user like/dislike/prefer?
2. Topics: What main topics/subjects are mentioned?
3. User Level: Is the user a beginner, intermediate, or advanced in this domain?
4. Constraints: Any limitations/restrictions mentioned?

User message: "{message}"

Return JSON format:
{{
  "preferences": ["preference1", "preference2"],
  "topics": ["topic1", "topic2"],
  "user_level": "beginner|intermediate|advanced|unknown",
  "constraints": ["constraint1", "constraint2"]
}}

Only include items that are explicitly mentioned. Return empty arrays if nothing found.
            """
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": extraction_prompt}],
                temperature=0.1,
                max_tokens=300
            )
            
            # Parse AI response
            ai_response = response.choices[0].message.content
            logger.info(f"🧠🤖 AI extraction response: {ai_response}")
            
            try:
                insights = json.loads(ai_response)
                
                # Add preferences
                for pref in insights.get("preferences", []):
                    if pref and pref.strip():
                        self._add_preference(pref.strip())
                        logger.info(f"🧠✅ AI DETECTED PREFERENCE: {pref}")
                
                # Add topics
                for topic in insights.get("topics", []):
                    if topic and topic.strip():
                        self._add_topic(topic.strip())
                        self.working_memory["last_topic_discussed"] = topic.strip()
                        logger.info(f"🧠📝 AI DETECTED TOPIC: {topic}")
                
                # Update user level
                level = insights.get("user_level", "unknown")
                if level != "unknown":
                    self.user_context["user_level"] = level
                    logger.info(f"🧠📊 AI DETECTED USER LEVEL: {level}")
                
                # Add constraints
                for constraint in insights.get("constraints", []):
                    if constraint and constraint.strip():
                        if constraint not in self.user_context["constraints"]:
                            self.user_context["constraints"].append(constraint.strip())
                            logger.info(f"🧠⚠️ AI DETECTED CONSTRAINT: {constraint}")
                
            except json.JSONDecodeError as e:
                logger.error(f"🧠❌ Failed to parse AI insights JSON: {e}")
                logger.error(f"🧠❌ Raw AI response: {ai_response}")
                
        except Exception as e:
            logger.error(f"🧠❌ Error in AI insight extraction: {e}")
            # Fallback to basic keyword detection
            self._extract_insights_fallback(message)
    
    def _extract_insights_fallback(self, message: str):
        """Fallback basic extraction when AI fails"""
        try:
            message_lower = message.lower()
            logger.info(f"🧠⚡ Using fallback extraction for: {message_lower[:50]}...")
            
            # Basic preference detection
            if any(word in message_lower for word in ["like", "love", "prefer", "favorite", "enjoy"]):
                # Extract the general preference
                self._add_preference(message[:80])  # Store more context
                logger.info(f"🧠✅ FALLBACK DETECTED PREFERENCE: {message[:80]}")
            
            # Basic level detection
            if any(phrase in message_lower for phrase in ["new", "beginner", "just started", "don't know"]):
                self.user_context["user_level"] = "beginner"
            elif any(phrase in message_lower for phrase in ["experienced", "advanced", "expert", "professional"]):
                self.user_context["user_level"] = "advanced"
            elif any(phrase in message_lower for phrase in ["intermediate", "some experience", "familiar"]):
                self.user_context["user_level"] = "intermediate"
                
        except Exception as e:
            logger.error(f"Error in fallback extraction: {e}")
    
    def _add_preference(self, preference: str):
        """Add user preference"""
        if preference not in self.user_context["preferences"]:
            self.user_context["preferences"].append(preference)
            # Keep only last 10 preferences
            if len(self.user_context["preferences"]) > 10:
                self.user_context["preferences"] = self.user_context["preferences"][-10:]
    
    def _add_topic(self, topic: str):
        """Add mentioned topic (replaces _add_recipe for channel agnosticism)"""
        if topic not in self.user_context["mentioned_topics"]:
            self.user_context["mentioned_topics"].append(topic)
            # Keep only last 15 topics
            if len(self.user_context["mentioned_topics"]) > 15:
                self.user_context["mentioned_topics"] = self.user_context["mentioned_topics"][-15:]
    
    def _add_recipe(self, recipe: str):
        """Add mentioned recipe"""
        if recipe not in self.user_context["mentioned_recipes"]:
            self.user_context["mentioned_recipes"].append(recipe)
            # Keep only last 15 recipes
            if len(self.user_context["mentioned_recipes"]) > 15:
                self.user_context["mentioned_recipes"] = self.user_context["mentioned_recipes"][-15:]
    
    def _update_working_memory(self, assistant_message: str):
        """Update working memory based on assistant response"""
        try:
            message_lower = assistant_message.lower()
            
            # Update current topic based on response
            if "recipe" in message_lower:
                self.working_memory["current_topic"] = "recipe"
            elif "cook" in message_lower or "cooking" in message_lower:
                self.working_memory["current_topic"] = "cooking"
            elif "ingredient" in message_lower:
                self.working_memory["current_topic"] = "ingredients"
            
            # Track recipes mentioned in AI responses (for continuity)
            recipe_keywords = [
                "chicken", "beef", "pasta", "pizza", "burger", "fries", "wings", "salad",
                "cauliflower", "brussels sprouts", "potatoes", "onion rings", "fish",
                "shrimp", "bacon", "pork chops", "steak", "vegetables", "broccoli",
                "bites", "tots", "rolls"
            ]
            for keyword in recipe_keywords:
                if keyword in message_lower:
                    self._add_recipe(keyword)
                    self.working_memory["last_recipe_discussed"] = keyword
                    logger.info(f"🧠🤖 AI MENTIONED RECIPE: {keyword}")
        
        except Exception as e:
            logger.error(f"Error updating working memory: {e}")
    
    def _load_memory(self):
        """Load memory from file"""
        try:
            memory_file = f"/tmp/voice_memory_{self.user_id}.json"
            logger.info(f"🧠 ATTEMPTING TO LOAD MEMORY from: {memory_file}")
            
            if os.path.exists(memory_file):
                logger.info(f"🧠 MEMORY FILE EXISTS - Loading data for user: {self.user_id}")
                with open(memory_file, 'r') as f:
                    data = json.load(f)
                    old_context = dict(self.user_context)
                    logger.info(f"🧠 RAW DATA FROM FILE: {data}")
                    logger.info(f"🧠 OLD CONTEXT BEFORE UPDATE: {old_context}")
                    self.user_context.update(data.get("user_context", {}))
                    logger.info(f"🧠 NEW CONTEXT AFTER UPDATE: {self.user_context}")
                    # Don't load conversation history - it's session-specific
                
                logger.info(f"🧠 SUCCESSFULLY LOADED MEMORY - Old interaction count: {old_context.get('interaction_count', 0)}, New: {self.user_context.get('interaction_count', 0)}")
                logger.info(f"🧠 USER PREFERENCES LOADED: {self.user_context.get('preferences', [])}")
                logger.info(f"🧠 USER RECIPES LOADED: {self.user_context.get('mentioned_recipes', [])}")
                logger.info(f"🧠 USER COOKING LEVEL: {self.user_context.get('cooking_level', 'unknown')}")
            else:
                logger.info(f"🧠 NO EXISTING MEMORY FILE - This is truly a new user: {self.user_id}")
        
        except Exception as e:
            logger.error(f"❌ ERROR LOADING MEMORY: {e}")
    
    def save_memory(self):
        """Save memory to file"""
        try:
            memory_file = f"/tmp/voice_memory_{self.user_id}.json"
            
            # Convert working_memory datetime objects to strings
            working_memory_serializable = dict(self.working_memory)
            if 'conversation_started' in working_memory_serializable:
                if isinstance(working_memory_serializable['conversation_started'], datetime):
                    working_memory_serializable['conversation_started'] = working_memory_serializable['conversation_started'].isoformat()
            
            data = {
                "user_context": self.user_context,
                "working_memory": working_memory_serializable,
                "last_saved": datetime.now().isoformat()
            }
            
            with open(memory_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)  # Add default=str to handle any remaining datetime objects
            
            logger.info(f"🧠✅ Successfully saved memory to {memory_file}")
        
        except Exception as e:
            logger.error(f"Error saving memory: {e}")
    
    def get_personalized_instructions(self) -> str:
        """Get personalized instructions for the LLM"""
        try:
            instructions = []
            
            # Cooking level adaptation
            if self.user_context["cooking_level"] == "beginner":
                instructions.append("Explain cooking steps simply and clearly for a beginner.")
            elif self.user_context["cooking_level"] == "advanced":
                instructions.append("You can use more advanced cooking terminology and techniques.")
            
            # Dietary restrictions
            if self.user_context["dietary_restrictions"]:
                restrictions = ", ".join(self.user_context["dietary_restrictions"])
                instructions.append(f"Remember this user has dietary restrictions: {restrictions}")
            
            # Preferences
            if self.user_context["preferences"]:
                prefs = ", ".join(self.user_context["preferences"][:2])
                instructions.append(f"Keep in mind the user likes: {prefs}")
            
            # Interaction history
            if self.user_context["interaction_count"] > 10:
                instructions.append("This is a regular user - be more casual and reference past conversations.")
            
            return " ".join(instructions)
        
        except Exception as e:
            logger.error(f"Error generating personalized instructions: {e}")
            return ""
    
    def cleanup_old_data(self):
        """Clean up old data"""
        try:
            # Remove old topics (keep only recent ones)
            if len(self.user_context["past_topics"]) > 10:
                self.user_context["past_topics"] = self.user_context["past_topics"][-10:]
            
        except Exception as e:
            logger.error(f"Error cleaning up memory: {e}")
    
    def _save_transcription_async(self):
        """Save transcription to database (non-blocking)"""
        try:
            import asyncio
            # Run in background without blocking the agent
            asyncio.create_task(self._save_transcription())
        except Exception as e:
            logger.error(f"Error starting transcription save task: {e}")
    
    async def _save_transcription(self):
        """Save voice transcription to database"""
        try:
            if not self.current_user_message or not self.current_ai_response or not self.room_name:
                logger.warning("🎤 Missing data for transcription save - skipping")
                return
                
            logger.info(f"🎤💾 Saving voice transcription to database...")
            
            # Determine API URL - try localhost first
            api_url = "http://localhost:3000/api/voice/transcription"
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "userId": self.user_id,
                    "creatorId": self.creator_id,
                    "userMessage": self.current_user_message,
                    "aiResponse": self.current_ai_response,
                    "roomName": self.room_name
                }
                
                async with session.post(api_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Voice transcription saved successfully: session {result.get('sessionId')}")
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Failed to save transcription: {response.status} - {error_text}")
                        
        except Exception as e:
            logger.error(f"❌ Error saving voice transcription: {e}")
            logger.exception("Full transcription save error:")
    
    def _get_video_id_for_recipe(self, recipe_context: str) -> str:
        """Get a real video ID for a given recipe context"""
        # Mapping of recipe keywords to popular air fryer recipe YouTube video IDs
        # These are real video IDs for demonstration - should be updated with actual channel videos
        recipe_video_mapping = {
            "cauliflower": "SRMuNqYSHdI",  # Air Fryer Cauliflower recipe
            "chicken": "fNFzfwLM72c",     # Air Fryer Chicken recipe
            "wings": "BDN5oGoNnSI",       # Air Fryer Wings recipe
            "brussels sprouts": "qZHrKWLgU-o", # Air Fryer Brussels Sprouts
            "fries": "U7HVzWvfvVI",       # Air Fryer French Fries
            "bacon": "l5f5cKfhGQU",       # Air Fryer Bacon recipe
            "spicy": "SRMuNqYSHdI",       # Default to cauliflower for spicy recipes
            "default": "SRMuNqYSHdI"      # Default cauliflower video
        }
        
        if recipe_context and recipe_context.lower() in recipe_video_mapping:
            logger.info(f"🎥🔍 Found video mapping: {recipe_context} -> {recipe_video_mapping[recipe_context.lower()]}")
            return recipe_video_mapping[recipe_context.lower()]
        
        # Fallback to default video
        logger.info(f"🎥🔍 Using default video for context: {recipe_context}")
        return recipe_video_mapping["default"]

    def _check_and_display_videos(self, message: str):
        """Check AI response for numbered citations and auto-display them using proper video data"""
        try:
            import re
            import asyncio
            
            logger.info(f"🎥🔍 Checking AI response for numbered citations: {message[:200]}...")
            
            # Look for numbered citations in the format [1], [2], etc.
            citation_pattern = r'\[(\d+)\]'
            citation_matches = re.findall(citation_pattern, message)
            
            if not citation_matches:
                logger.info(f"🎥❌ No numbered citations found in AI response")
                logger.info(f"🎥💡 Voice agent should generate content with proper citations like the chat system")
                return
            
            logger.info(f"🎥📋 Found {len(citation_matches)} numbered citations: {citation_matches}")
            
            # Get proper video data from the knowledge base using the same method as chat
            asyncio.create_task(self._fetch_and_display_videos_from_citations(message))
            
        except Exception as e:
            logger.error(f"❌ Error checking for videos in response: {e}")
            logger.exception("Full video checking error:")
            # Clear user message if there was an error
            if hasattr(self, 'current_user_message') and self.current_user_message:
                logger.info(f"🎥🧹 Clearing user message context after video error")
                self.current_user_message = None

    async def _fetch_and_display_videos_from_citations(self, ai_message: str):
        """Use intelligent video tools instead of old RAG system to prevent premature video displays"""
        try:
            import aiohttp
            import re
            
            logger.info(f"🎥🧠 Using intelligent video system for citations...")
            logger.info(f"🎥🔍 Analyzing AI message: '{ai_message[:100]}...'")
            
            # Get the user message - try current first, then fallback to conversation history
            user_message = self.current_user_message
            if not user_message and self.conversation_history:
                # Find the most recent user message
                for entry in reversed(self.conversation_history):
                    if entry["role"] == "user":
                        user_message = entry["content"]
                        logger.info(f"🎥🔍 Retrieved user message from conversation history: {user_message[:50]}...")
                        break
            
            if not user_message:
                logger.warning(f"🎥⚠️ No user message context available for video analysis")
                return
            
            logger.info(f"🎥🧠 Analyzing user intent for: {user_message[:100]}...")
            
            # FIRST: Check if we should suggest videos using intelligent analysis
            api_url = "http://localhost:3000/api/voice/search-videos"
            
            async with aiohttp.ClientSession() as session:
                # Step 1: Analyze intent to see if videos should be suggested
                intent_payload = {
                    "query": user_message,
                    "creatorId": self.creator_id,
                    "limit": 3
                }
                
                async with session.post(api_url, json=intent_payload, headers={
                    'Content-Type': 'application/json',
                }) as response:
                    if response.status == 200:
                        data = await response.json()
                        suggestions = data.get('suggestions', [])
                        
                        # Check if videos should be suggested, but only display them if user explicitly requests
                        if suggestions:
                            logger.info(f"🎥✅ Intelligent system found {len(suggestions)} relevant videos")
                            
                            # Check if user is explicitly asking to SEE/SHOW videos OR if AI is promising to find/show videos
                            user_video_triggers = [
                                'show me', 'let me see', 'display', 'play the video', 'watch', 
                                'see the video', 'view the video', 'show the tutorial', 'see it',
                                'demonstrate', 'let me watch', 'pull up the video', 'share the recipe'
                            ]
                            
                            # Check if agent is actively searching/finding videos in its response
                            agent_search_phrases = [
                                'let me find', 'let me search', 'just a moment while i search',
                                'searching for', 'finding the perfect video', 'i found a video',
                                'here\'s a video', 'i have a video', 'let me show you',
                                'i\'ll show you', 'here\'s the recipe', 'let me get that video'
                            ]
                            
                            user_wants_video = any(trigger in user_message.lower() for trigger in user_video_triggers)
                            agent_promising_video = any(phrase in ai_message.lower() for phrase in agent_search_phrases)
                            
                            should_display_video = user_wants_video or agent_promising_video
                            
                            if should_display_video:
                                if user_wants_video:
                                    logger.info(f"🎥🎯 User explicitly requested to see videos: '{user_message[:50]}...'")
                                elif agent_promising_video:
                                    logger.info(f"🎥🤖 Agent is searching/finding videos: '{ai_message[:50]}...'")
                                
                                # Display videos from the intelligent suggestions
                                for suggestion in suggestions[:3]:  # Limit to first 3
                                    video_id = suggestion.get('youtubeId', 'unknown') 
                                    video_title = suggestion.get('videoTitle', 'Unknown Video')
                                    
                                    if video_id and video_id != 'unknown':
                                        logger.info(f"🎥🚀 Displaying intelligent video: {video_title} (ID: {video_id})")
                                        await self.display_video(video_id, video_title, "knowledge_base")
                            else:
                                logger.info(f"🎥💡 Videos available but neither user nor agent requested display")
                                logger.info(f"🎥💡 User: '{user_message[:50]}...' | Agent: '{ai_message[:50]}...' - suggest videos in response instead")
                        else:
                            logger.info(f"🎥💡 Intelligent system determined no videos needed for: '{user_message[:50]}...'")
                            logger.info(f"🎥✅ This prevents premature video displays for casual conversation!")
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Intelligent video search API error: {response.status} - {error_text}")
                        # Don't fallback to old system - just skip videos for failed requests
                        logger.info(f"🎥⏭️ Skipping video suggestions due to API error - better than forcing wrong videos")
                        
        except Exception as e:
            logger.error(f"❌ Error using intelligent video system: {e}")
            logger.exception("Full intelligent video system error:")
            logger.info(f"🎥⏭️ Skipping video suggestions due to error - preventing unwanted video displays")
        finally:
            # Clear user message context after video processing is complete
            if hasattr(self, 'current_user_message') and self.current_user_message:
                logger.info(f"🎥🧹 Clearing user message context after intelligent video processing")
                self.current_user_message = None
    
    def _extract_requested_item(self, message: str) -> str:
        """Extract the main item being requested from user message"""
        import re
        message_lower = message.lower()
        
        # Common recipe patterns
        patterns = [
            r'([\w\s]+)\s+recipe',
            r'how to (?:make|cook)\s+([\w\s]+)',
            r'recipe for\s+([\w\s]+)',
            r'video (?:for|about|on)\s+([\w\s]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, message_lower)
            if match:
                return match.group(1).strip()
        
        # Fallback to key food words
        food_keywords = ['cauliflower', 'chicken', 'wings', 'nuggets', 'fries', 'burger', 'sandwich']
        for keyword in food_keywords:
            if keyword in message_lower:
                # Get surrounding context
                words = message_lower.split()
                for i, word in enumerate(words):
                    if keyword in word:
                        # Get 2-3 word phrase around the keyword
                        start = max(0, i-1)
                        end = min(len(words), i+2)
                        return ' '.join(words[start:end])
        
        return ""

    async def _fallback_knowledge_search(self, query: str):
        """Fallback to direct knowledge base search when chat API isn't available"""
        try:
            import aiohttp
            
            logger.info(f"🎥🔍 Performing fallback knowledge search for: {query}")
            
            # Try to call the knowledge base search directly
            # This would require creating a new API endpoint for direct search
            # For now, we'll use the recipe mapping as a last resort
            
            query_lower = query.lower()
            recipe_keywords = [
                "cauliflower", "brussels sprouts", "chicken", "beef", "pasta", "pizza", 
                "burger", "fries", "wings", "salad", "potatoes", "onion rings", "fish",
                "shrimp", "bacon", "pork chops", "steak", "vegetables", "broccoli"
            ]
            
            for keyword in recipe_keywords:
                if keyword in query_lower:
                    video_id = self._get_video_id_for_recipe(keyword)
                    video_title = f"Air Fryer {keyword.title()} Recipe"
                    logger.info(f"🎥🍳 Fallback: Displaying recipe video: {video_title} (ID: {video_id})")
                    await self.display_video(video_id, video_title, keyword)
                    break
            else:
                logger.info(f"🎥❌ No suitable fallback video found for query: {query}")
                
        except Exception as e:
            logger.error(f"❌ Error in fallback knowledge search: {e}")
            logger.exception("Full fallback search error:")
    
    def _extract_video_title(self, message: str, video_id: str, recipe_context: str = None) -> str:
        """Extract or generate a video title from the message context"""
        try:
            # Look for text around the video ID that might be the title
            import re
            
            # Find the video ID in the message and get surrounding text
            pattern = rf'.{{0,50}}{re.escape(video_id)}.{{0,50}}'
            context_match = re.search(pattern, message)
            
            if context_match:
                context = context_match.group(0)
                # Clean up the context to create a title
                # Remove the video ID and URL parts
                title_text = re.sub(r'https?://[^\s]+', '', context)
                title_text = re.sub(rf'{re.escape(video_id)}', '', title_text)
                title_text = title_text.strip()
                
                if title_text and len(title_text) > 10:
                    return f"Air Fryer Recipe: {title_text[:50]}..."
            
            # Fallback: Use recipe context if available
            if recipe_context:
                return f"Air Fryer {recipe_context.title()} Recipe"
            
            # Final fallback
            return "Air Fryer Recipe Video"
            
        except Exception as e:
            logger.error(f"Error extracting video title: {e}")
            return "Air Fryer Recipe Video"

    async def display_video(self, video_id: str, video_title: str, recipe_name: str):
        """Display a YouTube video on screen via API call to frontend"""
        try:
            logger.info(f"🎥 Displaying video: {video_title} (ID: {video_id}) for recipe: {recipe_name}")
            
            # Send video display request to frontend
            api_url = "http://localhost:3000/api/voice/display-video"
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "userId": self.user_id,
                    "roomName": self.room_name,
                    "videoId": video_id,
                    "videoTitle": video_title,
                    "recipeName": recipe_name
                }
                
                async with session.post(api_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Video display request sent successfully: {video_title}")
                        return f"I've pulled up the video '{video_title}' on your screen if you want to check it out later!"
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Failed to display video: {response.status} - {error_text}")
                        return "I found a relevant video but couldn't display it right now."
                        
        except Exception as e:
            logger.error(f"❌ Error displaying video: {e}")
            return "I found a relevant video but couldn't display it right now."


# Global memory instances for active users
active_memories: Dict[str, SimpleMemory] = {}

def get_memory(user_id: str) -> SimpleMemory:
    """Get or create memory instance for user"""
    if user_id not in active_memories:
        active_memories[user_id] = SimpleMemory(user_id)
        logger.info(f"🧠 Created new memory instance for user: {user_id}")
    
    return active_memories[user_id]

def cleanup_memories():
    """Cleanup old memory instances"""
    try:
        # Save all active memories
        for user_id, memory in active_memories.items():
            memory.save_memory()
        
        logger.info(f"🧠 Saved {len(active_memories)} memory instances")
    
    except Exception as e:
        logger.error(f"Error cleaning up memories: {e}")