StudyStack – A RAG-Powered Study Assistant Web Application
This project is an AI-powered study assistant designed to help students learn efficiently from multiple educational resources. The application processes PDFs, documents, lecture videos, audio files, and YouTube transcripts, converting them into searchable text. It utilizes Retrieval-Augmented Generation (RAG) with semantic search to retrieve relevant knowledge and generate context-aware answers through an interactive chat interface.
Features
Multi-format content processing (PDFs, Word files, text notes, videos, audio, YouTube transcripts)
Media transcription and text extraction from audio/video content
Intelligent content chunking with contextual metadata
Vector embedding generation for semantic similarity search
Natural language query interface for asking study-related questions
Semantic search with cosine similarity for accurate knowledge retrieval
RAG-based contextual answer generation using LLM integration
Source attribution for transparency and verification
Interactive chat interface with session persistence
File upload, deletion, and knowledge base management system
How to Run
Installation Steps
1. Clone the Repository
git clone https://github.com/shraddha-2005/StudyStack---A-RAG-Powered-Study-Assistant.git
cd StudyStack---A-RAG-Powered-Study-Assistant
2. Create Virtual Environment

Windows

python -m venv venv
venv\Scripts\activate

macOS/Linux

python3 -m venv venv
source venv/bin/activate
3. Install Dependencies
pip install -r requirements.txt
4. Run the Application
streamlit run app.py

(Replace app.py with your main file if it is different)

5. Access the Application

Open your browser and navigate to:

http://localhost:8501
