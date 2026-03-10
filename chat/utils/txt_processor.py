from pathlib import Path
import re

def process_txt(file_path, filename):
    try:
        print(f"\n{'='*70}")
        print(f"📝 Processing TXT File (Semantic Chunking)")
        print(f"   File: {filename}")
        print(f"{'='*70}")
        
        title = Path(filename).stem
        
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        text = text.strip()
        
        if not text or len(text) < 10:
            raise Exception("File is empty or too short")
        
        print(f"✅ Read {len(text)} characters from file")

        is_youtube_transcript = detect_youtube_transcript_format(text)
        
        if is_youtube_transcript:
            print("🎬 YouTube transcript detected - using semantic chunking")

            text = remove_timestamps(text)
        
        print("📄 Creating semantic chunks...")
        chunks = create_semantic_chunks(text, title)
        
        print(f"\n✅ TXT Processing Complete:")
        print(f"   - Chunks: {len(chunks)}")
        print(f"   - Avg chunk size: {sum(len(c['text']) for c in chunks) // len(chunks)} chars")
        print(f"   - Total text: {len(text)} chars")
        print(f"{'='*70}\n")
        
        return {
            'chunks': chunks,
            'title': title,
            'full_text': text,
            'source': 'txt_file'
        }
        
    except Exception as e:
        print(f"❌ TXT processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"TXT processing failed: {str(e)}")

def detect_youtube_transcript_format(text):
    """Detect if text contains YouTube-style timestamps"""
    timestamp_patterns = [
        r'\[\d{1,2}:\d{2}\]',
        r'\[\d{1,2}:\d{2}:\d{2}\]',
        r'^\d{1,2}:\d{2}\s',
        r'^\d{1,2}:\d{2}:\d{2}\s',
    ]
    
    for pattern in timestamp_patterns:
        if re.search(pattern, text, re.MULTILINE):
            return True
    return False

def remove_timestamps(text):

    text = re.sub(r'\[\d{1,2}:\d{2}(?::\d{2})?\]\s*', '', text)
    text = re.sub(r'^\d{1,2}:\d{2}(?::\d{2})?\s+', '', text, flags=re.MULTILINE)
    
    text = re.sub(r'^[A-Za-z\s]+:\s*', '', text, flags=re.MULTILINE)
    
    text = re.sub(r'\n\s*\n', '\n\n', text)
    
    return text.strip()

def create_semantic_chunks(text, title, target_size=900, overlap=150):
    chunks = []
    
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    if len(paragraphs) <= 1:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        paragraphs = [s for s in sentences if s.strip()]
    
    current_chunk_text = []
    current_length = 0
    chunk_num = 1
    
    for i, para in enumerate(paragraphs):
        para_length = len(para)
        
        if current_length + para_length > target_size and current_chunk_text:
            chunk_text = '\n\n'.join(current_chunk_text)
            
            chunks.append({
                'number': f"{chunk_num:02d}",
                'title': f"{title} (Text)",
                'text': chunk_text
            })
            
            print(f"   Chunk {chunk_num}: {len(chunk_text)} chars")
            chunk_num += 1
            
            if overlap > 0 and current_chunk_text:
                last_para = current_chunk_text[-1]
                if len(last_para) <= overlap:
                    current_chunk_text = [last_para]
                    current_length = len(last_para)
                else:
                    overlap_text = last_para[-overlap:]
                    current_chunk_text = [overlap_text]
                    current_length = len(overlap_text)
            else:
                current_chunk_text = []
                current_length = 0
        
        current_chunk_text.append(para)
        current_length += para_length + 2  
    
    if current_chunk_text:
        chunk_text = '\n\n'.join(current_chunk_text)
        chunks.append({
            'number': f"{chunk_num:02d}",
            'title': f"{title} (Text)",
            'text': chunk_text
        })
        print(f"   Chunk {chunk_num}: {len(chunk_text)} chars")
    
    return chunks