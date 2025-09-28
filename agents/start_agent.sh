#!/bin/bash

echo "🤖 Starting AITreon Voice Agent..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Start the agent
echo "🚀 Starting voice agent..."
python correct_voice_agent.py dev

# Keep script alive
echo "🎤 Voice agent is running. Press Ctrl+C to stop."
wait