import os
import json
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not found in .env")
        return

    client = OpenAI(api_key=api_key)
    
    noc_file_path = os.path.join(os.path.dirname(__file__), "..", "noc_index.json")
    embeddings_file_path = os.path.join(os.path.dirname(__file__), "..", "noc_embeddings.json")
    
    print(f"Loading NOC database from {noc_file_path}...")
    with open(noc_file_path, "r", encoding="utf-8") as f:
        noc_index = json.load(f)
        
    print(f"Loaded {len(noc_index)} NOC unit groups.")
    
    embeddings_db = {}
    
    # We will batch requests to save time
    batch_size = 50
    keys = list(noc_index.keys())
    
    print("Generating embeddings using text-embedding-3-small...")
    
    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i+batch_size]
        texts_to_embed = []
        
        for key in batch_keys:
            entry = noc_index[key]
            # Create a rich semantic text chunk for the embedding model
            title = entry.get("title", "")
            lead = entry.get("lead_statement", "")
            duties = "\n".join(entry.get("duties_flat", []))
            
            rich_text = f"NOC Code: {key}\nTitle: {title}\nLead Statement: {lead}\nMain Duties:\n{duties}"
            texts_to_embed.append(rich_text)
            
        print(f"Embedding batch {i//batch_size + 1}/{(len(keys) + batch_size - 1)//batch_size}...")
        
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=texts_to_embed
        )
        
        for j, key in enumerate(batch_keys):
            # Save the embedding vector directly
            embeddings_db[key] = response.data[j].embedding
            
    print(f"Saving {len(embeddings_db)} embeddings to {embeddings_file_path}...")
    with open(embeddings_file_path, "w", encoding="utf-8") as f:
        json.dump(embeddings_db, f)
        
    print("Done! The NOC Finder can now use semantic vector search.")

if __name__ == "__main__":
    main()
