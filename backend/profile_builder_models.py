"""
Profile Builder Agent — Pydantic request models & SQLAlchemy conversation model.

The Conversation model persists chat history so users can resume sessions
across multiple days while filling out their IRCC Express Entry profile.
"""

from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from database import Base
from db_models import get_toronto_now


# ── Pydantic Request / Response Models ──

class ChatMessage(BaseModel):
    """A single message in the conversation."""
    role: str  # "user" or "assistant"
    content: str
    image_data: Optional[str] = None  # Base64 encoded screenshot (sent from frontend, converted to URL on backend)


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    messages: List[ChatMessage]
    conversation_id: Optional[str] = None  # If resuming an existing conversation


class ConversationSummary(BaseModel):
    """Lightweight summary for the conversation list."""
    conversation_id: str
    title: str
    updated_at: Optional[str] = None


# ── SQLAlchemy ORM Model ──

class Conversation(Base):
    """Persisted chat conversation for the Profile Builder agent.
    
    Messages are stored as a JSON array of {role, content, image_url} objects.
    Image data is never stored here — only Supabase Storage URLs.
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    title = Column(String, nullable=True)  # Auto-generated from first user message
    messages = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=get_toronto_now)
    updated_at = Column(DateTime, default=get_toronto_now, onupdate=get_toronto_now)
