import subprocess
import whisper
import os
from pathlib import Path
import re
from .embeddings import create_embedding

WHISPER_MODEL = None

def get_whisper_model():
    """Lazy load Whisper model (loads only once)"""
    global WHISPER_MODEL
    if WHISPER_MODEL is None:
        print("📥 Loading Whisper model (one-time setup)...")
        WHISPER_MODEL = whisper.load_model("base")
    return WHISPER_MODEL

try:
    from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled
    YOUTUBE_TRANSCRIPT_AVAILABLE = True
    print("✅ youtube-transcript-api loaded successfully")
except ImportError:
    YOUTUBE_TRANSCRIPT_AVAILABLE = False
    print("⚠️ youtube-transcript-api not available")

def extract_video_id(input_str):
    """
    Extract YouTube video ID from:
    - Full YouTube URLs (youtube.com/watch?v=...)
    - Short links (youtu.be/...)
    - Raw video IDs
    - Filenames containing IDs
    """
    if not input_str:
        return None
    
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11})', 
        r'^([0-9A-Za-z_-]{11})$'  
    ]
    
    for pattern in patterns:
        match = re.search(pattern, input_str)
        if match:
            video_id = match.group(1)
            if len(video_id) == 11:
                return video_id
    return None

def get_youtube_transcript(video_id):
    """
    Fetch YouTube transcript - handles all English variants
    """
    if not YOUTUBE_TRANSCRIPT_AVAILABLE:
        print("❌ youtube-transcript-api not available")
        return None
    
    try:
        print(f"📺 Fetching YouTube transcript for: {video_id}")
        
        from youtube_transcript_api import NoTranscriptFound, TranscriptsDisabled
        
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        except TranscriptsDisabled:
            print(f"   ❌ Transcripts are disabled for this video")
            return None
        except NoTranscriptFound:
            print(f"   ❌ No transcripts found for this video")
            return None
        except Exception as e:
            print(f"   ❌ Cannot access transcripts: {e}")
            return None
        
        transcript_data = None
        used_language = None
        
        try:
            for transcript in transcript_list:
                if transcript.language_code.startswith('en') and not transcript.is_generated:
                    print(f"   ✅ Found manual {transcript.language} transcript")
                    transcript_data = transcript.fetch()
                    used_language = transcript.language_code
                    break
        except Exception as e:
            print(f"   ⚠️ Manual transcript fetch failed: {e}")
        
        if not transcript_data:
            try:
                for transcript in transcript_list:
                    if transcript.language_code.startswith('en'):
                        print(f"   ✅ Found auto-generated {transcript.language} transcript")
                        transcript_data = transcript.fetch()
                        used_language = transcript.language_code
                        break
            except Exception as e:
                print(f"   ⚠️ Auto-generated transcript fetch failed: {e}")
        
        if not transcript_data:
            print(f"   ❌ No English transcripts available")
            return None
        
        print(f"   ✅ Fetched {len(transcript_data)} entries using language: {used_language}")
        
        chunks = []
        current_chunk = []
        current_start = 0
        chunk_duration = 0
        chunk_char_count = 0
        
        for entry in transcript_data:
            text = entry['text'].strip()
            start = entry['start']
            duration = entry['duration']
            
            if not text:
                continue
            
            current_chunk.append(text)
            chunk_duration += duration
            chunk_char_count += len(text)
            
            should_split = chunk_duration >= 60 or chunk_char_count >= 800
            
            if should_split and len(current_chunk) > 0:
                chunk_text = ' '.join(current_chunk)
                chunks.append({
                    'text': chunk_text,
                    'start': current_start,
                    'end': start + duration,
                    'number': f"{len(chunks) + 1:02d}"
                })
                
                current_chunk = []
                current_start = start + duration
                chunk_duration = 0
                chunk_char_count = 0
        
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'text': chunk_text,
                'start': current_start,
                'end': transcript_data[-1]['start'] + transcript_data[-1]['duration'],
                'number': f"{len(chunks) + 1:02d}"
            })
        
        full_transcript = ' '.join([entry['text'] for entry in transcript_data])
        
        print(f"✅ YouTube transcript retrieved successfully:")
        print(f"   - Language: {used_language}")
        print(f"   - Chunks: {len(chunks)}")
        
        return {
            'chunks': chunks,
            'full_transcript': full_transcript,
            'source': 'youtube_api',
            'caption_type': 'manual',
            'language': used_language
        }
        
    except Exception as e:
        print(f"❌ Error getting YouTube transcript: {e}")
        import traceback
        traceback.print_exc()
        return None

def extract_audio(video_path, output_path):
    """Extract audio from video using ffmpeg"""
    try:
        print(f"🎵 Extracting audio from video...")
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-vn",  
            "-acodec", "libmp3lame",  
            "-q:a", "2", 
            output_path
        ], check=True, capture_output=True)
        print(f"   ✅ Audio extracted to: {output_path}")
        return True
    except subprocess.CalledProcessError as e:
        raise Exception(f"Audio extraction failed: {str(e)}")

def is_audio_file(file_path):
    """Check if file is already an audio file"""
    audio_extensions = {'.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.wma'}
    ext = Path(file_path).suffix.lower()
    return ext in audio_extensions

def prepare_audio_for_transcription(input_path):

    if is_audio_file(input_path):
        print(f"🎵 Input is already audio file: {Path(input_path).name}")
        return input_path, False 
    else:
        print(f"🎬 Input is video file: {Path(input_path).name}")
        audio_path = str(Path(input_path).with_suffix('.mp3'))
        extract_audio(input_path, audio_path)
        return audio_path, True  

def transcribe_audio(audio_path):
    """Whisper transcription with enhanced settings"""
    try:
        print("🎤 Transcribing with Whisper...")
        print("   Using enhanced settings for technical content...")
        
        model = get_whisper_model()
        
        result = model.transcribe(
            audio=audio_path,
            language="en",
            word_timestamps=True,
            condition_on_previous_text=True,
            temperature=0.0,
            compression_ratio_threshold=2.4,
            logprob_threshold=-1.0,
            no_speech_threshold=0.6,
            initial_prompt="This is a technical coding tutorial. It may contain programming terms, "
                          "function names, variable names, file paths, and code syntax. "
                          "Accurately transcribe all technical terms."
        )
        
        filtered_segments = []
        for segment in result['segments']:
            text = segment['text'].strip()
            
            if (len(text) > 3 and 
                not is_repetitive(text) and
                segment.get('avg_logprob', -0.5) > -1.0):
                filtered_segments.append(segment)
        
        result['segments'] = filtered_segments
        result['text'] = ' '.join([seg['text'] for seg in filtered_segments])
        
        print(f"✅ Whisper transcription complete:")
        print(f"   - Filtered segments: {len(filtered_segments)}")
        print(f"   - Characters: {len(result['text'])}")
        
        return result
        
    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")

def is_repetitive(text):
    """Detect repetitive text (Whisper hallucination)"""
    words = text.lower().split()
    if len(words) < 3:
        return False
    
    for i in range(len(words) - 2):
        phrase = ' '.join(words[i:i+3])
        if text.lower().count(phrase) > 2:
            return True
    
    return False

def chunk_transcription(result, title, max_chars=800):
    """Create chunks with silence detection"""
    chunks = []
    current_text = ""
    start_time = None
    end_time = None
    chunk_num = 1
    last_end_time = 0
    
    for segment in result["segments"]:
        segment_start = segment["start"]
        segment_text = segment["text"].strip()
        segment_end = segment["end"]
        
        silence_duration = segment_start - last_end_time
        
        if silence_duration > 30:
            if current_text:
                chunks.append({
                    "number": f"{chunk_num:02d}",
                    "title": title,
                    "start": start_time,
                    "end": last_end_time,
                    "text": current_text.strip()
                })
                current_text = ""
                start_time = None
                chunk_num += 1
            
            chunks.append({
                "number": f"{chunk_num:02d}",
                "title": title,
                "start": last_end_time,
                "end": segment_start,
                "text": f"[{int(silence_duration)}s of silent coding/demonstration]"
            })
            chunk_num += 1
        
        if start_time is None:
            start_time = segment_start
        
        current_text += " " + segment_text
        end_time = segment_end
        last_end_time = segment_end
        
        if len(current_text) >= max_chars:
            chunks.append({
                "number": f"{chunk_num:02d}",
                "title": title,
                "start": start_time,
                "end": end_time,
                "text": current_text.strip()
            })
            current_text = ""
            start_time = None
            chunk_num += 1
    
    if current_text.strip():
        chunks.append({
            "number": f"{chunk_num:02d}",
            "title": title,
            "start": start_time,
            "end": end_time,
            "text": current_text.strip()
        })
    
    return chunks

def process_video(video_path, filename):

    try:
        print(f"\n{'='*70}")
        print(f"🎬 Video/Audio Processor")
        print(f"   File: {filename}")
        print(f"{'='*70}")
        
        title = Path(filename).stem
        
        video_id = extract_video_id(filename) or extract_video_id(video_path)
        
        if video_id and YOUTUBE_TRANSCRIPT_AVAILABLE:
            print(f"\n📺 YouTube video detected (ID: {video_id})")
            youtube_result = get_youtube_transcript(video_id)
            
            if youtube_result:
                print(f"\n✅ Using YouTube Official Transcript")
                
                for chunk in youtube_result['chunks']:
                    chunk['title'] = f"{title} (Video)"
                
                return {
                    'chunks': youtube_result['chunks'],
                    'title': title,
                    'full_transcript': youtube_result['full_transcript'],
                    'source': youtube_result['source'],
                    'caption_type': youtube_result.get('caption_type', 'manual')
                }
            else:
                print(f"\n⚠️ YouTube transcript unavailable, using Whisper...")
        
        print(f"\n📼 Local Processing with Whisper")
        
        audio_path, needs_cleanup = prepare_audio_for_transcription(video_path)
        
        print(f"\n🎤 Transcribing...")
        result = transcribe_audio(audio_path)
        
        if needs_cleanup and os.path.exists(audio_path):
            os.remove(audio_path)
            print("🧹 Cleaned up temporary audio file")
        
        print(f"\n📦 Creating chunks...")
        chunks = chunk_transcription(result, title)
        
        for chunk in chunks:
            chunk['title'] = f"{title} (Video)"
        
        silent_chunks = sum(1 for c in chunks if 'silent' in c['text'].lower())
        
        print(f"\n✅ Processing Complete:")
        print(f"   - Total chunks: {len(chunks)}")
        print(f"   - Speech chunks: {len(chunks) - silent_chunks}")
        print(f"   - Silent sections: {silent_chunks}")
        print(f"   - Total text: {len(result['text'])} chars")
        print(f"{'='*70}\n")
        
        return {
            'chunks': chunks,
            'title': title,
            'full_transcript': result["text"],
            'source': 'whisper_enhanced',
            'silent_sections': silent_chunks
        }
        
    except Exception as e:
        audio_path = str(Path(video_path).with_suffix('.mp3'))
        if os.path.exists(audio_path) and audio_path != video_path:
            try:
                os.remove(audio_path)
            except:
                pass
        
        print(f"❌ Processing failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Processing failed: {str(e)}")

def create_video_embeddings(chunks):
    """Create embeddings for video chunks"""
    try:
        all_texts = [c['text'] for c in chunks]
        embeddings = create_embedding(all_texts)
        
        for i, chunk in enumerate(chunks):
            chunk['embedding'] = embeddings[i]
        
        return chunks
    except Exception as e:
        raise Exception(f"Embedding creation failed: {str(e)}")