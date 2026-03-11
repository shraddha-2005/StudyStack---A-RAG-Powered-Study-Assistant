# StudyStack – A RAG-Powered Study Assistant Web Application

This project is an AI-powered study assistant designed to help students learn efficiently from multiple educational resources. The application processes PDFs, documents, lecture videos, audio files, and YouTube transcripts, converting them into searchable text. It uses Retrieval-Augmented Generation (RAG) and semantic search to retrieve relevant information and generate context-aware answers through an interactive chat interface.

## Features

- Multi-format content processing (PDFs, Word files, text notes, videos, audio, YouTube transcripts)
- Media transcription and text extraction
- Intelligent content chunking with metadata
- Vector embeddings for semantic similarity search
- Natural language question answering
- Semantic search using cosine similarity
- RAG-based contextual answer generation
- Source attribution for transparency
- Interactive chat with session persistence
- File management and knowledge base optimization

## How to Run

### Installation Steps
### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/StudyStack---A-RAG-Powered-Study-Assistant.git
cd StudyStack---A-RAG-Powered-Study-Assistant
```

###2. Create Virtual Environment
###Windows
```bash
python -m venv venv
venv\Scripts\activate

###macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

###3. Install Dependencies
```bash
pip install -r requirements.txt
```

###4. Apply Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

###5. Run Development Server
```bash
python manage.py runserver
```

###6. Access the Application
Open your browser and navigate to:
http://localhost:8000
