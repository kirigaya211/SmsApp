from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import torch
import calamancy
from transformers import AutoTokenizer, AutoModel
import numpy as np
import os
import matplotlib.pyplot as plt
import io
import base64
from typing import Dict, Any

app = FastAPI()

# --- Load NLP tools and model ---
try:
    nlp = calamancy.load("tl_calamancy_md-0.1.0")
except Exception as e:
    print(f"Error loading calamancy model: {e}")
    print("Attempting to download model...")
    os.system("pip install calamancy")
    nlp = calamancy.load("tl_calamancy_md-0.1.0")

tokenizer = AutoTokenizer.from_pretrained("xlm-roberta-base")
transformer_model = AutoModel.from_pretrained("xlm-roberta-base")
svm_model = joblib.load("svm_model.pkl")

def preprocess_text(text):
    text = str(text)
    doc = nlp(text)
    tokens = [
        token.lemma_.lower() for token in doc
        if not token.is_punct and not token.is_space and token.lemma_.isalpha()
    ]
    return " ".join(tokens) if tokens else text.lower()

def get_embeddings(text_list):
    transformer_model.eval()
    with torch.no_grad():
        encoded = tokenizer(text_list, return_tensors='pt', truncation=True, padding=True, max_length=128)
        output = transformer_model(**encoded)
        cls_embeddings = output.last_hidden_state[:, 0, :]
        return cls_embeddings.numpy()

def get_sender_features(sender):
    is_numeric = int(str(sender).isdigit())
    is_short = int(len(str(sender)) < 6)
    return np.array([is_numeric, is_short])

def generate_prediction_visualization(features: np.ndarray, prediction: int) -> str:
    plt.figure(figsize=(10, 6))
    
    # Create feature importance plot
    feature_names = ['Numeric Sender', 'Short Sender'] + [f'Embedding Dim {i+1}' for i in range(features.shape[0]-2)]
    feature_importance = np.abs(features)
    
    # Sort features by importance
    sorted_idx = np.argsort(feature_importance)
    pos = np.arange(sorted_idx.shape[0]) + .5
    
    plt.barh(pos, feature_importance[sorted_idx])
    plt.yticks(pos, [feature_names[i] for i in sorted_idx])
    plt.xlabel('Feature Importance')
    plt.title(f'Feature Importance for {"SPAM" if prediction == 1 else "HAM"} Prediction')
    
    # Convert plot to base64 string
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    buf.seek(0)
    img_str = base64.b64encode(buf.read()).decode()
    plt.close()
    
    return img_str

class SMSRequest(BaseModel):
    sender: str
    message: str

@app.post("/predict")
def predict(data: SMSRequest) -> Dict[str, Any]:
    processed = preprocess_text(data.message)
    embedding = get_embeddings([processed])[0]
    sender_features = get_sender_features(data.sender)
    features = np.concatenate([embedding, sender_features])
    prediction = svm_model.predict([features])[0]
    label = "SPAM" if prediction == 1 else "HAM"
    
    # Generate visualization
    visualization = generate_prediction_visualization(features, prediction)
    
    return {
        "sender": data.sender,
        "message": data.message,
        "processed": processed,
        "prediction": label,
        "visualization": visualization
    } 