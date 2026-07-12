from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, event
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
    find_noc_credits = Column(Integer, default=2, nullable=False)  # free full NOC Finder reports before the Optimize gate
    audit_letter_credits = Column(Integer, default=0, nullable=False)
    letter_builder_credits = Column(Integer, default=0, nullable=False)
    ita_strategy_credits = Column(Integer, default=0, nullable=False)
    profile_builder_credits = Column(Integer, default=0, nullable=False)
    gcms_credits = Column(Integer, default=0, nullable=False)  # prepaid GCMS notes orders (skip payment step)
    subscription_tier = Column(String, default="free", nullable=False)  # "free", "starter", "complete"


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


def _noc_code_from_payload(payload) -> str | None:
    """Pull the resulting NOC code out of an evaluation payload, regardless of tool shape:
    NOC Finder uses `recommended_noc.code`; the Auditor uses `noc_analysis.detected_code`."""
    if not isinstance(payload, dict):
        return None
    rec = payload.get("recommended_noc")
    if isinstance(rec, dict) and rec.get("code"):
        return str(rec["code"]).strip() or None
    na = payload.get("noc_analysis")
    if isinstance(na, dict) and na.get("detected_code"):
        return str(na["detected_code"]).strip() or None
    return None


@event.listens_for(Evaluation, "before_insert")
@event.listens_for(Evaluation, "before_update")
def _populate_detected_noc_code(mapper, connection, target):
    """Keep the denormalized `detected_noc_code` column in sync with the payload on every write,
    so analytics/filtering by NOC code work without each call site remembering to set it."""
    code = _noc_code_from_payload(target.payload)
    if code:
        target.detected_noc_code = code


class GCMSOrder(Base):
    """A GCMS/ATIP notes order: applicant info (step 1) -> Stripe payment (step 2)
    -> signed consent form upload (step 3). Fulfilled manually via an ATIP request."""
    __tablename__ = "gcms_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)

    # 'awaiting_payment' -> 'awaiting_consent' -> 'received' -> 'filed' -> 'delivered'
    status = Column(String, default="awaiting_payment", nullable=False)

    # Step 1 — applicant details
    full_name = Column(String, nullable=False)           # computed "given family" (kept for emails/summaries)
    family_name = Column(String, nullable=True)          # surname, as on passport (IMM 5744 sec. 2)
    given_name = Column(String, nullable=True)           # given name(s), as on passport
    email = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=False)       # YYYY-MM-DD (string keeps it timezone-proof)
    # Other people on the application (IMM 5744 sec. 2.1-2.3, max 3):
    # [{family_name, given_name, date_of_birth, relationship, under_16}]
    related_persons = Column(JSON, nullable=True)
    country_of_residence = Column(String, nullable=True)
    uci = Column(String, nullable=True)                  # Unique Client Identifier (if known)
    application_number = Column(String, nullable=True)   # e.g. E000123456 (if known)
    application_type = Column(String, nullable=True)     # Express Entry PR / study / work / etc.
    notes_type = Column(String, default="ircc", nullable=False)  # 'ircc' (GCMS) or 'cbsa'
    extra_notes = Column(String, nullable=True)

    # Step 2/3 — payment + consent artifacts
    stripe_session_id = Column(String, index=True, nullable=True)
    consent_file_id = Column(String, nullable=True)      # stored filename in the documents bucket

    timestamp_utc = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp_toronto = Column(DateTime, default=get_toronto_now)


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True, nullable=False)
    stripe_session_id = Column(String, unique=True, index=True, nullable=False)
    
    event_type = Column(String, nullable=False) # 'checkout_initiated', 'checkout_returned_unpaid', 'checkout_success'
    pass_type = Column(String, nullable=False) # 'auditor' or 'finder'
    
    timestamp_utc = Column(DateTime, default=datetime.datetime.utcnow)
    timestamp_toronto = Column(DateTime, default=get_toronto_now)
