import google.generativeai as genai
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import os
import requests

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def create_embedding(text_list):
    """Create embeddings using Ollama's bge-m3 model"""
    try:
        print(f"📡 Requesting embeddings for {len(text_list)} texts...")
        
        r = requests.post("http://localhost:11434/api/embed", json={
            "model": "bge-m3",
            "input": text_list
        }, timeout=60)
        
        if r.status_code != 200:
            raise Exception(f"Ollama API error: {r.status_code}")
        
        result = r.json()
        
        if 'embeddings' in result:
            print(f"✅ Embeddings received: {len(result['embeddings'])} vectors")
            return result['embeddings']
        else:
            raise Exception("No embeddings in response")
            
    except requests.exceptions.ConnectionError:
        print("❌ Embedding creation error: Cannot connect to Ollama. Make sure Ollama is running.")
        raise Exception("Cannot connect to Ollama. Make sure Ollama is running.")
    except Exception as e:
        print(f"❌ Embedding creation error: {str(e)}")
        raise

def generate_answer_gemini(question, context, has_context=False, similarity_score=0.0):
    """
    Generate answer using Gemini with proper source attribution
    
    ALWAYS provides an answer - either from documents OR general knowledge
    """
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    HIGH_CONFIDENCE_THRESHOLD = 0.60  
    MEDIUM_CONFIDENCE_THRESHOLD = 0.40  
    
    print(f"🤖 Generating answer (similarity: {similarity_score:.3f}, has_context: {has_context})")
    
    if has_context and similarity_score >= HIGH_CONFIDENCE_THRESHOLD:
        print("   Strategy: HIGH confidence - Using document content")
        prompt = f"""You are a helpful teaching assistant. Answer the question using the provided document content.

Document Content:
{context}

Question: {question}

Instructions:
- Answer based on the document content above
- Be comprehensive and clear
- If the documents partially cover the topic, combine document info with your knowledge to give a complete answer

Answer:"""
    elif has_context and similarity_score >= MEDIUM_CONFIDENCE_THRESHOLD:
        print("   Strategy: MEDIUM confidence - Supplement with general knowledge")
        prompt = f"""You are a helpful teaching assistant. The user has some documents that may be partially relevant.

Potentially Relevant Content:
{context}

Question: {question}

Instructions:
1. Check if the above content answers the question
2. If YES: Use it and mention "Based on your documents..."
3. If PARTIAL: Combine the document info with your general knowledge
4. If NO: Provide a complete answer from your knowledge

Provide a helpful, complete answer:"""

    else:
        print("   Strategy: LOW confidence - General knowledge")
        prompt = f"""You are a helpful teaching assistant.

Question: {question}

Instructions:
- Provide a comprehensive, accurate answer from your general knowledge
- Explain the concept clearly with examples if helpful
- Be educational and thorough

Answer:"""
    try:
        response = model.generate_content(prompt)
        answer = response.text.strip()
        
        return {
            'answer': answer,
            'used_documents': similarity_score >= MEDIUM_CONFIDENCE_THRESHOLD,
            'confidence': 'high' if similarity_score >= HIGH_CONFIDENCE_THRESHOLD else 
                         'medium' if similarity_score >= MEDIUM_CONFIDENCE_THRESHOLD else 'low'
        }
    except Exception as e:
        print(f"❌ Gemini error: {str(e)}")
        return {
            'answer': f"I encountered an error: {str(e)}",
            'used_documents': False,
            'confidence': 'error'
        }

def search_knowledge_base(df, question, top_k=3):
    """
    Search knowledge base with similarity scoring
    
    FIXED: Now uses .iloc for filtered DataFrames and better thresholds
    """
    try:
        print(f"🔍 Searching for: '{question}'")
        
        question_embedding = create_embedding([question])
        
        if not question_embedding or len(question_embedding) == 0:
            raise Exception("Failed to create question embedding")
        
        question_vector = np.array(question_embedding[0])
        
        embeddings_list = df['embedding'].tolist()
        similarities = cosine_similarity([question_vector], embeddings_list)[0]
        
        max_indx = np.argsort(similarities)[-top_k:][::-1]
        max_similarity = float(similarities[max_indx[0]])
        
        print(f"📊 Top similarities: {[f'{similarities[i]:.3f}' for i in max_indx]}")
        print(f"📊 Max similarity: {max_similarity:.3f}")
        
        results = df.iloc[max_indx]

        has_context = max_similarity >= 0.35
        
        if max_similarity < 0.35:
            print(f"   ⚠️ Similarity too low ({max_similarity:.3f}) - Documents not relevant")
        elif max_similarity < 0.50:
            print(f"   ⚠️ Moderate similarity ({max_similarity:.3f}) - Partial relevance")
        else:
            print(f"   ✅ High similarity ({max_similarity:.3f}) - Documents relevant")
        
        return {
            'results': results,
            'max_similarity': max_similarity,
            'has_context': has_context
        }
        
    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Search failed: {str(e)}")

def filter_relevant_chunks(results, similarities, threshold=0.40):
    """
    Filter out chunks that aren't actually relevant
    Returns only chunks above threshold
    """
    relevant_indices = [i for i, sim in enumerate(similarities) if sim >= threshold]
    
    if not relevant_indices:
        return None, []
    
    relevant_results = results.iloc[relevant_indices]
    relevant_sims = [similarities[i] for i in relevant_indices]
    
    return relevant_results, relevant_sims