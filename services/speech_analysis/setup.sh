#!/bin/bash

# Speech Analysis System Setup Script
# This script sets up the Python environment and installs required dependencies

set -e

echo "🚀 Setting up Speech Analysis System"
echo "===================================="

# Check if we're in the right directory
if [[ ! -f "requirements.txt" ]]; then
    echo "❌ Error: requirements.txt not found. Please run this script from the speech_analysis directory."
    exit 1
fi

# Check Python version
echo "🐍 Checking Python installation..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version 2>&1 | awk '{print $2}')
    echo "   Found Python $python_version"
else
    echo "❌ Error: Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment
echo "📦 Creating virtual environment..."
if [[ -d "venv" ]]; then
    echo "   Virtual environment already exists, removing old one..."
    rm -rf venv
fi

python3 -m venv venv
echo "   ✅ Virtual environment created"

# Activate virtual environment
echo "⚡ Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📈 Upgrading pip..."
pip install --upgrade pip

# Install base requirements first
echo "📥 Installing base requirements..."
pip install wheel setuptools

# Install main requirements
echo "📚 Installing speech analysis requirements..."
pip install -r requirements.txt

# Download spaCy model
echo "🧠 Downloading spaCy English model..."
python -m spacy download en_core_web_sm

# Download NLTK data
echo "📖 Downloading NLTK data..."
python -c "
import nltk
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
    print('   ✅ NLTK data downloaded')
except Exception as e:
    print(f'   ⚠️ NLTK download warning: {e}')
"

# Test the installation
echo "🧪 Testing installation..."
python -c "
import spacy
import nltk
import pandas
import numpy
import sklearn
print('   ✅ All packages imported successfully')
"

# Run basic test
echo "🔬 Running system test..."
if [[ -f "test_system.py" ]]; then
    echo "   Running basic functionality test..."
    python test_system.py > test_output.log 2>&1
    if [[ $? -eq 0 ]]; then
        echo "   ✅ System test passed!"
        echo "   📋 Test output saved to test_output.log"
    else
        echo "   ⚠️ System test had issues, check test_output.log for details"
    fi
else
    echo "   ⚠️ test_system.py not found, skipping system test"
fi

# Create activation script
echo "📝 Creating activation script..."
cat > activate.sh << 'EOF'
#!/bin/bash
# Speech Analysis Environment Activation Script
echo "Activating Speech Analysis System environment..."
source venv/bin/activate
echo "✅ Environment activated. You can now use the speech analysis tools."
echo ""
echo "Available commands:"
echo "  python main.py analyze --creator-id CREATOR_ID"
echo "  python main.py score --creator-id CREATOR_ID --text 'sample text'"
echo "  python main.py list"
echo ""
EOF

chmod +x activate.sh

echo ""
echo "🎉 Setup complete!"
echo "========================================"
echo ""
echo "To use the speech analysis system:"
echo "1. Activate the environment: source activate.sh"
echo "2. Run analysis: python main.py --help"
echo ""
echo "Environment is now ready for speech pattern analysis!"

# Deactivate virtual environment
deactivate