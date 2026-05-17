"""
One-time script: Generate per-duty embeddings for duty-level reranking.

Embeds each individual duty from each NOC as a separate vector.
This enables duty-level matching at query time with zero additional API calls.

Cost: ~$0.002 (4974 short texts via text-embedding-3-small)
Output: noc_duty_embeddings.npz (duty vectors) + noc_duty_index.json (metadata)
"""
import os
import json
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not found in .env")
        return

    client = OpenAI(api_key=api_key)
    
    noc_file_path = os.path.join(os.path.dirname(__file__), "..", "noc_index.json")
    duty_embeddings_path = os.path.join(os.path.dirname(__file__), "..", "noc_duty_embeddings.npz")
    duty_index_path = os.path.join(os.path.dirname(__file__), "..", "noc_duty_index.json")
    
    print(f"Loading NOC database from {noc_file_path}...")
    with open(noc_file_path, "r", encoding="utf-8") as f:
        noc_index = json.load(f)
    
    # Build flat list of all duties
    all_duties = []  # List of {"code": str, "duty_idx": int, "text": str}
    for entry in noc_index.values():
        code = entry.get("code", "")
        for i, duty in enumerate(entry.get("duties", [])):
            all_duties.append({
                "code": code,
                "duty_idx": i,
                "text": duty
            })
    
    print(f"Total individual duties: {len(all_duties)}")
    
    # Embed in batches
    batch_size = 200
    all_vectors = []
    
    print("Generating per-duty embeddings using text-embedding-3-small...")
    for i in range(0, len(all_duties), batch_size):
        batch_texts = [d["text"] for d in all_duties[i:i+batch_size]]
        print(f"  Embedding batch {i//batch_size + 1}/{(len(all_duties) + batch_size - 1)//batch_size}...")
        
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch_texts
        )
        for item in response.data:
            all_vectors.append(item.embedding)
    
    # Save as numpy compressed file for fast loading
    matrix = np.array(all_vectors, dtype=np.float32)
    np.savez_compressed(duty_embeddings_path, embeddings=matrix)
    print(f"Saved duty embedding matrix: {matrix.shape} to {duty_embeddings_path}")
    
    # Save duty index metadata (code + text for each row)
    # Also build the ranges index: code -> (start_row, end_row)
    duty_ranges = {}
    current_code = None
    start_idx = 0
    for idx, d in enumerate(all_duties):
        if d["code"] != current_code:
            if current_code is not None:
                duty_ranges[current_code] = [start_idx, idx]
            current_code = d["code"]
            start_idx = idx
    if current_code:
        duty_ranges[current_code] = [start_idx, len(all_duties)]
    
    index_data = {
        "duties": [{"code": d["code"], "text": d["text"]} for d in all_duties],
        "ranges": duty_ranges  # code -> [start, end]
    }
    
    with open(duty_index_path, "w", encoding="utf-8") as f:
        json.dump(index_data, f)
    print(f"Saved duty index: {len(duty_ranges)} NOCs, {len(all_duties)} duties to {duty_index_path}")
    
    # Verify
    loaded = np.load(duty_embeddings_path)
    print(f"\nVerification: loaded matrix shape = {loaded['embeddings'].shape}")
    print("Done!")


if __name__ == "__main__":
    main()
