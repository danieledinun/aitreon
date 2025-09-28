#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class VideoSearchTool:
    """Tool for voice agent to search and suggest videos intelligently"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.creator_id = "cmeggjlxp0015wvebg2952wcq"  # Air Fryer Geek correct ID
        
    async def search_videos(self, query: str, limit: int = 3) -> Dict[str, Any]:
        """
        Search for relevant videos based on user query
        Returns video suggestions with relevance and reasoning
        """
        try:
            logger.info(f"🔍 Video tool searching for: '{query}'")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "query": query,
                    "creatorId": self.creator_id,
                    "limit": limit
                }
                
                async with session.post(
                    f"{self.base_url}/api/voice/search-videos",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Video search found {len(result.get('suggestions', []))} suggestions")
                        return result
                    else:
                        logger.error(f"❌ Video search failed: {response.status}")
                        return {
                            "success": False,
                            "error": f"Search failed with status {response.status}",
                            "suggestions": [],
                            "availableVideos": []
                        }
                        
        except Exception as e:
            logger.error(f"❌ Video search error: {e}")
            return {
                "success": False,
                "error": str(e),
                "suggestions": [],
                "availableVideos": []
            }
    
    async def get_available_videos(self, limit: int = 20) -> Dict[str, Any]:
        """Get list of all available videos for the creator"""
        try:
            logger.info(f"📋 Getting available videos list")
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/api/voice/search-videos?creatorId={self.creator_id}&limit={limit}"
                
                async with session.get(url) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Retrieved {len(result.get('videos', []))} available videos")
                        return result
                    else:
                        logger.error(f"❌ Video list failed: {response.status}")
                        return {
                            "success": False,
                            "videos": []
                        }
                        
        except Exception as e:
            logger.error(f"❌ Video list error: {e}")
            return {
                "success": False,
                "error": str(e),
                "videos": []
            }
    
    async def should_suggest_video(self, user_query: str, conversation_context: List[str] = None) -> Dict[str, Any]:
        """
        Determine if the agent should suggest videos based on user intent
        Returns decision and reasoning
        """
        try:
            # Analyze user intent for video suggestions
            learning_indicators = [
                "how do i", "show me how", "teach me", "i want to learn",
                "can you show", "demonstrate", "tutorial", "step by step",
                "how to make", "recipe for", "cooking technique"
            ]
            
            casual_indicators = [
                "hello", "hi", "thanks", "thank you", "goodbye", "bye",
                "what's up", "how are you", "nice", "cool", "awesome"
            ]
            
            query_lower = user_query.lower()
            
            # Check for strong learning intent
            has_learning_intent = any(indicator in query_lower for indicator in learning_indicators)
            is_casual_chat = any(indicator in query_lower for indicator in casual_indicators)
            
            # Don't suggest videos for casual conversation
            if is_casual_chat and not has_learning_intent:
                return {
                    "should_suggest": False,
                    "reason": "Casual conversation - no learning intent detected",
                    "confidence": 0.9
                }
            
            # Strongly suggest for explicit learning requests
            if has_learning_intent:
                return {
                    "should_suggest": True,
                    "reason": "User explicitly asking to learn something",
                    "confidence": 0.95
                }
            
            # Check for food/recipe mentions without learning intent
            food_keywords = [
                "chicken", "nuggets", "fries", "wings", "vegetables", "beef",
                "cooking", "recipe", "air fryer", "crispy", "seasoning"
            ]
            
            has_food_mention = any(keyword in query_lower for keyword in food_keywords)
            
            if has_food_mention:
                return {
                    "should_suggest": True,
                    "reason": "Food/cooking topic mentioned - might benefit from video demonstration",
                    "confidence": 0.7
                }
            
            # Default to no video suggestion for unclear intent
            return {
                "should_suggest": False,
                "reason": "No clear learning intent or food topic detected",
                "confidence": 0.8
            }
            
        except Exception as e:
            logger.error(f"❌ Intent analysis error: {e}")
            return {
                "should_suggest": False,
                "reason": f"Error analyzing intent: {e}",
                "confidence": 0.5
            }
    
    async def display_video(self, user_id: str, room_name: str, video_id: str, 
                          video_title: str, recipe_name: str = None) -> Dict[str, Any]:
        """
        Request video display on the frontend
        """
        try:
            logger.info(f"🎥 Requesting video display: {video_title}")
            
            async with aiohttp.ClientSession() as session:
                payload = {
                    "userId": user_id,
                    "roomName": room_name,
                    "videoId": video_id,
                    "videoTitle": video_title,
                    "recipeName": recipe_name or video_title
                }
                
                async with session.post(
                    f"{self.base_url}/api/voice/display-video",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Video display request sent successfully")
                        return result
                    else:
                        logger.error(f"❌ Video display failed: {response.status}")
                        return {
                            "success": False,
                            "error": f"Display request failed with status {response.status}"
                        }
                        
        except Exception as e:
            logger.error(f"❌ Video display error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Get OpenAI function calling tool definitions
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_videos",
                    "description": "Search for relevant cooking/air fryer videos based on user query. Use this when user shows interest in learning a recipe or technique.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The user's query or topic to search videos for (e.g., 'chicken nuggets', 'crispy vegetables')"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum number of videos to return (default: 3)",
                                "default": 3
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "should_suggest_video",
                    "description": "Analyze if the agent should suggest videos based on user intent and conversation context.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "user_query": {
                                "type": "string",
                                "description": "The current user message to analyze"
                            },
                            "conversation_context": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Previous messages in the conversation for context"
                            }
                        },
                        "required": ["user_query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "display_video",
                    "description": "Display a specific video to the user. Only use after confirming user wants to see a video.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "user_id": {
                                "type": "string",
                                "description": "The user ID"
                            },
                            "room_name": {
                                "type": "string", 
                                "description": "The current room name"
                            },
                            "video_id": {
                                "type": "string",
                                "description": "The YouTube video ID"
                            },
                            "video_title": {
                                "type": "string",
                                "description": "The title of the video"
                            },
                            "recipe_name": {
                                "type": "string",
                                "description": "The recipe or technique name"
                            }
                        },
                        "required": ["user_id", "room_name", "video_id", "video_title"]
                    }
                }
            }
        ]

    async def call_function(self, function_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a function call from the LLM
        """
        try:
            if function_name == "search_videos":
                return await self.search_videos(
                    query=arguments.get("query", ""),
                    limit=arguments.get("limit", 3)
                )
            elif function_name == "should_suggest_video":
                return await self.should_suggest_video(
                    user_query=arguments.get("user_query", ""),
                    conversation_context=arguments.get("conversation_context", [])
                )
            elif function_name == "display_video":
                return await self.display_video(
                    user_id=arguments.get("user_id", ""),
                    room_name=arguments.get("room_name", ""),
                    video_id=arguments.get("video_id", ""),
                    video_title=arguments.get("video_title", ""),
                    recipe_name=arguments.get("recipe_name")
                )
            else:
                return {
                    "success": False,
                    "error": f"Unknown function: {function_name}"
                }
        except Exception as e:
            logger.error(f"❌ Function call error: {e}")
            return {
                "success": False,
                "error": str(e)
            }

# Global instance
video_tool = VideoSearchTool()

async def test_video_tools():
    """Test the video tools functionality"""
    # Test video search
    print("🔍 Testing video search...")
    search_result = await video_tool.search_videos("chicken nuggets")
    print(f"Search result: {search_result}")
    
    # Test intent analysis
    print("\n🤔 Testing intent analysis...")
    intent_result = await video_tool.should_suggest_video("How do I make crispy chicken nuggets?")
    print(f"Intent result: {intent_result}")
    
    # Test casual conversation
    casual_result = await video_tool.should_suggest_video("Hello, how are you?")
    print(f"Casual result: {casual_result}")

if __name__ == "__main__":
    asyncio.run(test_video_tools())