import PyPDF2
import json
import pandas as pd
from pathlib import Path
from .embeddings import create_embedding

def chunk_text(text, chunk_size=800, overlap=100):
    """Split text into chunks with overlap"""
    chunks = []
    start = 0
    chunk_number = 1
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        if end < len(text):
            last_period = chunk.rfind('. ')
            last_question = chunk.rfind('? ')
            last_exclamation = chunk.rfind('! ')
            break_point = max(last_period, last_question, last_exclamation)
            
            if break_point > chunk_size * 0.5:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        if chunk.strip():
            chunks.append({
                'number': f"{chunk_number:02d}",
                'text': chunk.strip(),
                'char_start': start,
                'char_end': end
            })
            chunk_number += 1
        
        start = end - overlap
    
    return chunks

def process_pdf(file_path, filename):
    """Process PDF and return chunks"""
    try:
        print(f"\n{'='*60}")
        print(f"📄 Processing PDF: {filename}")
        print(f"{'='*60}")
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)
            
            print(f"📖 Total pages: {num_pages}")
            
            full_text = ""
            for page_num in range(num_pages):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                if text.strip():
                    full_text += text.strip() + "\n\n"
            
            if not full_text.strip():
                raise Exception("No text could be extracted from PDF")
            
            print(f"📝 Total text length: {len(full_text)} characters")
            
            chunks = chunk_text(full_text, chunk_size=800, overlap=100)
            
            print(f"✂️ Created {len(chunks)} chunks")

            title = Path(filename).stem
            for chunk in chunks:
                chunk['title'] = title
            
            print(f"✅ PDF processing complete")
            print(f"{'='*60}\n")
            
            return {
                'chunks': chunks,
                'title': title,
                'pages': num_pages
            }
            
    except Exception as e:
        print(f"❌ PDF processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"PDF processing failed: {str(e)}")

def create_pdf_embeddings(chunks):
    """Create embeddings for PDF chunks"""
    try:
        if not chunks or len(chunks) == 0:
            raise Exception("No chunks provided for embedding creation")
        
        print(f"\n{'='*60}")
        print(f"🧠 Creating embeddings for {len(chunks)} PDF chunks")
        print(f"{'='*60}")
        
        all_texts = [c['text'] for c in chunks]
        
        batch_size = 10
        all_embeddings = []
        
        for i in range(0, len(all_texts), batch_size):
            batch = all_texts[i:i+batch_size]
            print(f"📡 Processing batch {i//batch_size + 1}/{(len(all_texts)-1)//batch_size + 1}")
            embeddings = create_embedding(batch)
            all_embeddings.extend(embeddings)
        
        for i, chunk in enumerate(chunks):
            chunk['embedding'] = all_embeddings[i]
        
        print(f"✅ All embeddings created successfully")
        print(f"{'='*60}\n")
        
        return chunks
        
    except Exception as e:
        print(f"❌ Embedding creation error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Embedding creation failed: {str(e)}")