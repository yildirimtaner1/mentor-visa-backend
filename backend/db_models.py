from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
import datetime
import pytz
from database import Base

def get_toronto_now():
    """Generates the absolute naive datetime representing current Toronto wall-clock time."""
    toronto_tz = pytz.timezone('America/Toronto')
    return datetime.datetime.now(toronto_tz).replace(tzinfo=None)

class UserAccount(Base):
    __tablename__ = "users"
    
    user_id = Column(String, primary_key=True, index=True)
    find_noc_credits = Column(Integer, default=0, nullable=False)
    audit_letter_credits = Column(Integer, default=0, nullable=False)
    letter_builder_credits = Column(Integer, default=0, nullable=False)
    ita_strategy_credits = Column(Integer, default=0, nullable=False)


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    evaluation_type = Column(String, index=True, nullable=False) # 'audit' or 'noc_finder'
    
    document_type = Column(String, nullable=True)
    role_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    stored_file_id = Column(String, index=True, nullable=True)
    
    # Extracted fields for queryability
    compliance_status = Column(String, nullable=True)
    detected_noc_code = Column(String, index=True, nullable=True)
    
    is_premium_unlocked = Column(Integer, default=0) 
    
    timestamp_utc = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp_toronto = Column(DateTime, default=get_toronto_now)
    
    payload = Column(JSON, nullable=False)


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    stripe_session_id = Column(String, unique=True, index=True, nullable=False)
    
    event_type = Column(String, nullable=False) # 'checkout_initiated', 'checkout_returned_unpaid', 'checkout_success'
    pass_type = Column(String, nullable=False) # 'auditor' or 'finder'
    
    timestamp_utc = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp_toronto = Column(DateTime, default=get_toronto_now)
